const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const licensing = require('./licensing');

const PORT = 8000;
const DATA_FILE = path.join(__dirname, 'data.json');
const LOG_FILE = path.join(__dirname, 'server.log');

// Hand-off slot for the Madrasati browser extension's auto-detected grades
// (extension/background.js posts here). In-memory and single-slot on
// purpose: this is a transient relay, not persisted data - the frontend
// (js/madrasati-noor.js) polls and consumes it, same effect as the
// extension pushing straight to the tab but working identically whether
// the frontend is a plain browser tab or the Electron desktop app (an
// extension's chrome.tabs API has no visibility into a separate Electron
// process, so pushing directly to "the tracker tab" only ever worked for
// the plain-browser case).
let pendingMadrasatiImport = null;

// Grade-cell changes applied via /api/mobile/sync that haven't yet survived
// a POST /api/data write. The desktop app's saveData() overwrites data.json
// wholesale from its own in-memory copy - which is loaded once and never
// refreshed - so without this, any grade recorded on the phone gets silently
// erased the moment the laptop saves next (even just opening a class
// triggers a save). POST /api/data below replays this queue onto the
// incoming body immediately before writing, so a mobile-recorded cell always
// survives even though the laptop's snapshot never knew about it.
let pendingMobileChangesForDesktopSave = [];

// Applies one mobile changeQueue-shaped change directly onto a parsed
// data.json object (classes/students/grades), in place. Shared by
// /api/mobile/sync (writes straight to disk) and POST /api/data (replays
// onto the desktop's incoming payload before it's written) so both paths
// use the exact same merge rule.
function applyMobileGradeChange(data, change) {
    data.classes = data.classes || [];
    const cls = data.classes.find(c => c.id === change.classId);
    const student = cls && (cls.students || []).find(s => s.id === change.studentId);
    if (!student) return false;
    if (!student.grades) student.grades = {};
    if (!student.grades[change.periodId]) student.grades[change.periodId] = {};
    if (!student.grades[change.periodId][change.subjectId]) student.grades[change.periodId][change.subjectId] = {};
    const g = student.grades[change.periodId][change.subjectId];

    if (change.kind === 'numeric') {
        g[change.categoryId] = change.value;
    } else {
        if (!Array.isArray(g[change.categoryId])) g[change.categoryId] = [];
        const arr = g[change.categoryId];
        const targetLen = Math.max(change.arrayLength || 0, change.index + 1);
        while (arr.length < targetLen) arr.push(false);
        arr[change.index] = change.value;
    }
    return true;
}

// Writes to a temp file in the same directory, then renames it over the
// real path. rename() is atomic on the same filesystem, so a crash or
// power loss mid-write leaves either the old data.json intact or the new
// one fully written - never a truncated/corrupted file in between.
function atomicWriteFileSync(filePath, data) {
    const tempPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
    fs.writeFileSync(tempPath, data, 'utf8');
    fs.renameSync(tempPath, filePath);
}

function logMessage(msg) {
    try {
        const timestamp = new Date().toISOString();
        const line = `[${timestamp}] ${msg}\n`;
        fs.appendFileSync(LOG_FILE, line, 'utf8');
        console.log(`[Server] ${msg}`);
    } catch (e) {
        console.error('Logging failed:', e);
    }
}

// Clear log file on startup
try {
    fs.writeFileSync(LOG_FILE, '', 'utf8');
    logMessage('Server starting up on port ' + PORT + '...');
} catch(e) {}

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.txt': 'text/plain; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.pdf': 'application/pdf'
};

// Optional Puppeteer for PDF export
let puppeteer = null;
try {
    puppeteer = require('puppeteer');
} catch (e) {
    logMessage('Puppeteer loading notice: ' + e.message);
}

function getBrowserExecutablePath() {
    const possiblePaths = [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        (process.env.LOCALAPPDATA || '') + '\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
        'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
    ];
    for (const p of possiblePaths) {
        if (p && fs.existsSync(p)) return p;
    }
    return undefined;
}

// ------------------------------------------------------------
// INTEGRATED WHATSAPP ENGINE (whatsapp-web.js)
// ------------------------------------------------------------
let whatsappClient = null;
let MessageMedia = null;
let waStatus = 'DISCONNECTED'; // INITIALIZING, QR_READY, READY, AUTH_FAILED, DISCONNECTED, NOT_INSTALLED
let waQrCode = null;
let waClientInfo = null;

let WAClient = null;
let WALocalAuth = null;
try {
    const { Client, LocalAuth, MessageMedia: MM } = require('whatsapp-web.js');
    WAClient = Client;
    WALocalAuth = LocalAuth;
    MessageMedia = MM;
} catch (e) {
    logMessage('Notice: whatsapp-web.js not available or failed to load: ' + e.message);
    waStatus = 'NOT_INSTALLED';
}

// Builds and initializes a fresh WhatsApp client. Used both at server
// startup and on-demand (manual reconnect from the UI, or after a
// logout) - previously the client was only ever created ONCE at startup,
// so any disconnection (session invalidated remotely, logged out from
// the phone, a network hiccup) left waStatus stuck at DISCONNECTED
// forever with no code path to actually retry, and the whole server
// process had to be restarted to reconnect.
function initWhatsappClient() {
    if (!WAClient) return; // whatsapp-web.js itself failed to load
    if (waStatus === 'INITIALIZING') return; // already starting up, don't double-launch Chrome

    const chromePath = getBrowserExecutablePath();
    const puppeteerOpts = {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu'
        ]
    };
    if (chromePath) {
        puppeteerOpts.executablePath = chromePath;
    }

    whatsappClient = new WAClient({
        authStrategy: new WALocalAuth({ dataPath: path.join(__dirname, '.wwebjs_auth') }),
        puppeteer: puppeteerOpts
    });

    whatsappClient.on('qr', (qr) => {
        waStatus = 'QR_READY';
        waQrCode = qr;
        logMessage('WhatsApp QR code received.');
    });

    whatsappClient.on('ready', () => {
        waStatus = 'READY';
        waQrCode = null;
        waClientInfo = {
            pushname: whatsappClient.info ? whatsappClient.info.pushname : '',
            wid: whatsappClient.info ? whatsappClient.info.wid.user : ''
        };
        logMessage(`WhatsApp client is READY! Connected as: ${waClientInfo.pushname || waClientInfo.wid}`);
    });

    whatsappClient.on('authenticated', () => {
        waStatus = 'AUTHENTICATED';
        logMessage('WhatsApp client authenticated successfully.');
    });

    whatsappClient.on('auth_failure', (msg) => {
        waStatus = 'AUTH_FAILED';
        logMessage('WhatsApp authentication failure: ' + msg);
    });

    whatsappClient.on('disconnected', (reason) => {
        waStatus = 'DISCONNECTED';
        waQrCode = null;
        waClientInfo = null;
        logMessage('WhatsApp client disconnected: ' + reason);
    });

    waStatus = 'INITIALIZING';
    whatsappClient.initialize().catch(err => {
        logMessage('WhatsApp initialize error: ' + err.message);
        waStatus = 'DISCONNECTED';
    });
}

initWhatsappClient();

function formatPhoneNumber(phone) {
    if (!phone) return '';
    let clean = phone.toString().replace(/[^0-9]/g, '');
    if (clean.startsWith('05')) {
        clean = '966' + clean.substring(1);
    } else if (clean.startsWith('5')) {
        clean = '966' + clean;
    }
    if (!clean.endsWith('@c.us')) {
        clean = clean + '@c.us';
    }
    return clean;
}

// ------------------------------------------------------------
// HTTP SERVER
// ------------------------------------------------------------
const server = http.createServer((req, res) => {
    logMessage(`Request: ${req.method} ${req.url}`);

    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle CORS preflight options request
    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    const parsedUrl = new URL(req.url, `http://localhost:${PORT}`);
    const pathname = parsedUrl.pathname;

    // API: DATA GET / POST
    if (pathname === '/api/data') {
        if (req.method === 'GET') {
            if (fs.existsSync(DATA_FILE)) {
                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(fs.readFileSync(DATA_FILE, 'utf8'));
                logMessage('GET /api/data - Served existing data.json');
            } else {
                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({}));
                logMessage('GET /api/data - No data.json found, returned empty object');
            }
            return;
        } else if (req.method === 'POST') {
            req.setEncoding('utf8');
            let body = '';
            req.on('data', chunk => { body += chunk; });
            req.on('end', () => {
                try {
                    let finalBody = body;
                    // Re-apply any grade cells recorded via the mobile app
                    // since the laptop last loaded its copy - otherwise this
                    // wholesale overwrite would silently erase them (the
                    // laptop's in-memory snapshot has no way to know about
                    // them). See pendingMobileChangesForDesktopSave above.
                    if (pendingMobileChangesForDesktopSave.length > 0) {
                        const parsed = JSON.parse(body);
                        const queued = pendingMobileChangesForDesktopSave;
                        pendingMobileChangesForDesktopSave = [];
                        queued.forEach(change => applyMobileGradeChange(parsed, change));
                        finalBody = JSON.stringify(parsed);
                        logMessage(`POST /api/data - Re-applied ${queued.length} mobile-recorded change(s) onto the incoming save`);
                    }
                    atomicWriteFileSync(DATA_FILE, finalBody);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true }));
                    logMessage(`POST /api/data - Successfully wrote ${finalBody.length} bytes to data.json`);
                } catch (e) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: e.message }));
                    logMessage(`POST /api/data - ERROR writing data: ${e.message}`);
                }
            });
            return;
        }
    }

    // ------------------------------------------------------------
    // API: STANDALONE MOBILE GRADING APP (/mobile/)
    //
    // The mobile app keeps its own offline copy of the grading-relevant
    // data and only ever talks to the server through these three
    // endpoints - it never touches /api/data, because that endpoint is a
    // full-file overwrite (see POST /api/data above): if the mobile app's
    // offline snapshot POSTed itself back wholesale, it would silently
    // destroy any WhatsApp/portfolio/other-class edits made directly on
    // the laptop in the meantime. These endpoints instead read data.json
    // fresh and apply a targeted patch (sync) or a filtered read (roster),
    // never a wholesale replace.
    // ------------------------------------------------------------

    // Cheap reachability + staleness probe: the mobile app polls this to
    // detect "back on the laptop's network" and to know whether its local
    // roster is stale, without paying for a full roster fetch every time.
    if (pathname === '/api/mobile/version' && req.method === 'GET') {
        let version = 0;
        try { version = fs.statSync(DATA_FILE).mtimeMs; } catch (e) { /* no data.json yet */ }
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ version }));
        return;
    }

    // Full grading-relevant snapshot, stripped of settings the mobile app
    // has no business touching (WhatsApp, portfolio, weekly report
    // schedule, counselors, grading distribution, last report date). Used
    // for first-run seeding and to refresh the phone's roster (new
    // students/subjects added on the laptop) on every ordinary sync too.
    if (pathname === '/api/mobile/roster' && req.method === 'GET') {
        let version = 0;
        let data = {};
        try {
            version = fs.statSync(DATA_FILE).mtimeMs;
            data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        } catch (e) { /* no data.json yet - respond with an empty roster */ }
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
            version,
            classes: data.classes || [],
            activeClassId: data.activeClassId || null,
            subjects: data.subjects || [],
            activeSubjectId: data.activeSubjectId || null,
            periods: data.periods || [],
            activePeriodId: data.activePeriodId || 'period-1'
        }));
        logMessage('GET /api/mobile/roster - served');
        return;
    }

    // Targeted merge: applies exactly the grade cells the mobile app has
    // queued (in the order it queued them) directly onto a fresh read of
    // data.json, then writes the result back - never a full overwrite, so
    // whatever else changed on the laptop in the meantime is untouched.
    if (pathname === '/api/mobile/sync' && req.method === 'POST') {
        req.setEncoding('utf8');
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
            try {
                const { changes } = JSON.parse(body || '{}');
                let data = {};
                try { data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); } catch (e) { /* no data.json yet */ }
                data.classes = data.classes || [];

                const accepted = [];
                const rejected = [];

                (Array.isArray(changes) ? changes : []).forEach(change => {
                    if (!applyMobileGradeChange(data, change)) {
                        rejected.push({ id: change.id, reason: 'student-not-found' });
                        return;
                    }
                    accepted.push(change.id);
                    // Kept until it survives a desktop save too (see
                    // pendingMobileChangesForDesktopSave above) - the write
                    // to data.json just below isn't enough on its own,
                    // since the laptop's next saveData() would otherwise
                    // clobber it with a stale in-memory copy.
                    pendingMobileChangesForDesktopSave.push(change);
                });

                atomicWriteFileSync(DATA_FILE, JSON.stringify(data));
                const version = fs.statSync(DATA_FILE).mtimeMs;

                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({
                    success: true,
                    accepted,
                    rejected,
                    version,
                    roster: {
                        version,
                        classes: data.classes || [],
                        activeClassId: data.activeClassId || null,
                        subjects: data.subjects || [],
                        activeSubjectId: data.activeSubjectId || null,
                        periods: data.periods || [],
                        activePeriodId: data.activePeriodId || 'period-1'
                    }
                }));
                logMessage(`POST /api/mobile/sync - accepted ${accepted.length}, rejected ${rejected.length}`);
            } catch (e) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: e.message }));
                logMessage(`POST /api/mobile/sync - ERROR: ${e.message}`);
            }
        });
        return;
    }

    // API: LICENSE ACTIVATION / STATUS
    // POST: user-entered key -> verified against the Supabase Edge Function,
    // cached locally on success. GET: current cached status, used by the
    // frontend to show the activation screen, the owner name in the
    // sidebar, and to decide whether to warn before an export is blocked.
    if (pathname === '/api/license/status' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(licensing.currentStatus()));
        return;
    }
    if (pathname === '/api/license/activate' && req.method === 'POST') {
        req.setEncoding('utf8');
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', async () => {
            try {
                const { key } = JSON.parse(body || '{}');
                await licensing.activate(key);
                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ success: true, status: licensing.currentStatus() }));
                logMessage('POST /api/license/activate - Activated successfully');
            } catch (e) {
                res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ success: false, error: e.message }));
                logMessage(`POST /api/license/activate - ERROR: ${e.message}`);
            }
        });
        return;
    }

    // API: MADRASATI AUTO-IMPORT HAND-OFF
    // POST: the browser extension's background script posts scraped grades
    // here the moment it detects them on schools.madrasati.sa.
    // GET: the frontend polls this and consumes (clears) whatever is
    // pending, so the same data is never delivered twice.
    if (pathname === '/api/madrasati-import' && req.method === 'POST') {
        req.setEncoding('utf8');
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
            try {
                const payload = JSON.parse(body);
                pendingMadrasatiImport = { list: payload.list, assignmentTitle: payload.assignmentTitle || null };
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
                logMessage(`POST /api/madrasati-import - Received ${Array.isArray(payload.list) ? payload.list.length : 0} student record(s) from the browser extension`);
            } catch (e) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: e.message }));
            }
        });
        return;
    }
    if (pathname === '/api/madrasati-import' && req.method === 'GET') {
        const data = pendingMadrasatiImport;
        pendingMadrasatiImport = null;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ data }));
        return;
    }

    // API: WHATSAPP STATUS
    if (pathname === '/api/whatsapp/status' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
            success: true,
            status: waStatus,
            qr: waQrCode,
            user: waClientInfo
        }));
        return;
    }

    // API: WHATSAPP RECONNECT — actually retries the connection (unlike
    // /api/whatsapp/status, which only reports the last known state).
    // Needed because the client is never automatically retried once it
    // drops (session invalidated, logged out from the phone, network
    // hiccup) - without this there was no way to recover short of
    // restarting the whole server process.
    if (pathname === '/api/whatsapp/reconnect' && req.method === 'POST') {
        if (waStatus === 'INITIALIZING') {
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ success: false, error: 'جاري الاتصال بالفعل، يرجى الانتظار...' }));
            return;
        }
        if (waStatus === 'READY' || waStatus === 'QR_READY' || waStatus === 'AUTHENTICATED') {
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ success: false, error: 'المحرك متصل بالفعل أو بانتظار مسح رمز QR الحالي.' }));
            return;
        }
        (async () => {
            try {
                if (whatsappClient) {
                    await whatsappClient.destroy().catch(() => {});
                }
            } finally {
                whatsappClient = null;
                waClientInfo = null;
                waQrCode = null;
                initWhatsappClient();
                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ success: true, message: 'جاري إعادة تشغيل محرك الواتساب...' }));
            }
        })();
        return;
    }

    // API: WHATSAPP SEND MESSAGE / MEDIA
    if (pathname === '/api/whatsapp/send' && req.method === 'POST') {
        req.setEncoding('utf8');
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', async () => {
            try {
                if (waStatus !== 'READY' || !whatsappClient) {
                    res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({
                        success: false,
                        error: `واتساب غير متصل حالياً! الحالة: ${waStatus}. يرجى مسح رمز QR أولاً.`
                    }));
                    return;
                }

                const payload = JSON.parse(body);
                const { phone, message, mediaBase64, filename } = payload;

                if (!phone) {
                    res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({ success: false, error: 'رقم الهاتف مطلوب!' }));
                    return;
                }

                const formattedPhone = formatPhoneNumber(phone);
                let sentMessage = null;

                if (mediaBase64 && MessageMedia) {
                    let mimeType = 'application/pdf';
                    let rawData = mediaBase64;
                    let isDocument = true;

                    if (mediaBase64.startsWith('data:')) {
                        const commaIdx = mediaBase64.indexOf(',');
                        const header = mediaBase64.substring(0, commaIdx);
                        rawData = mediaBase64.substring(commaIdx + 1);

                        if (header.includes('image/')) {
                            mimeType = header.split(';')[0].replace('data:', '');
                            isDocument = false;
                        } else {
                            mimeType = 'application/pdf';
                            isDocument = true;
                        }
                    }

                    let mediaName = (filename || (isDocument ? 'التقرير_الأسبوعي.pdf' : 'report.png')).replace(/[/\\:*?"<>|]/g, '_');
                    if (isDocument && !mediaName.toLowerCase().endsWith('.pdf')) {
                        mediaName += '.pdf';
                    } else if (!isDocument && !mediaName.toLowerCase().match(/\.(png|jpe?g|webp)$/)) {
                        mediaName += '.png';
                    }

                    const media = new MessageMedia(mimeType, rawData, mediaName);
                    const sendPromise = whatsappClient.sendMessage(formattedPhone, media, {
                        caption: message || '',
                        sendMediaAsDocument: isDocument
                    });
                    const timeoutPromise = new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('انتهت مهلة إرسال الوسائط في واتساب (Timeout 25s)')), 25000)
                    );
                    sentMessage = await Promise.race([sendPromise, timeoutPromise]);
                } else if (message) {
                    const sendPromise = whatsappClient.sendMessage(formattedPhone, message);
                    const timeoutPromise = new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('انتهت مهلة إرسال الرسالة في واتساب (Timeout 15s)')), 15000)
                    );
                    sentMessage = await Promise.race([sendPromise, timeoutPromise]);
                } else {
                    res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({ success: false, error: 'الرسالة أو الصورة مطلوبة!' }));
                    return;
                }

                const messageId = sentMessage?.id?._serialized || sentMessage?.id?.id || 'SENT';
                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({
                    success: true,
                    message: 'تم إرسال الرسالة عبر واتساب بنجاح!',
                    messageId: messageId
                }));
            } catch (err) {
                logMessage(`WhatsApp send error: ${err.message}`);
                res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({
                    success: false,
                    error: `حدث خطأ أثناء إرسال الرسالة: ${err.message}`
                }));
            }
        });
        return;
    }

    // API: WHATSAPP LOGOUT
    if (pathname === '/api/whatsapp/logout' && req.method === 'POST') {
        (async () => {
            try {
                if (whatsappClient) {
                    await whatsappClient.logout();
                }
                whatsappClient = null;
                waStatus = 'DISCONNECTED';
                waQrCode = null;
                waClientInfo = null;
                // Re-launch right away so a fresh QR shows up on its own -
                // previously logout left the engine at DISCONNECTED with
                // nothing to bring it back except restarting the server.
                initWhatsappClient();
                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ success: true, message: 'تم تسجيل الخروج وتصفير الجلسة بنجاح.' }));
            } catch (err) {
                res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ success: false, error: err.message }));
            }
        })();
        return;
    }

    // API: PDF GENERATION via Puppeteer
    if (pathname === '/api/generate-pdf' && req.method === 'POST') {
        if (!licensing.isPdfAllowed()) {
            res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ error: 'license_required', status: licensing.currentStatus() }));
            logMessage('POST /api/generate-pdf - BLOCKED: no valid license');
            return;
        }
        req.setEncoding('utf8');
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', async () => {
            try {
                const payload = JSON.parse(body);
                const html = payload.html || '';
                const filename = payload.filename || 'report.pdf';
                const landscape = !!payload.landscape;

                if (!puppeteer) {
                    throw new Error('Puppeteer engine is not available on the server');
                }

                const execPath = getBrowserExecutablePath();
                const launchOpts = {
                    headless: 'new',
                    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
                };
                if (execPath) {
                    launchOpts.executablePath = execPath;
                }

                const browser = await puppeteer.launch(launchOpts);
                const page = await browser.newPage();
                
                const fullHtml = `
                <!DOCTYPE html>
                <html lang="ar" dir="rtl">
                <head>
                    <meta charset="utf-8">
                    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
                    <style>
                        @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap');
                        * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                        body {
                            font-family: 'Tajawal', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
                            margin: 0;
                            padding: 0;
                            background: #ffffff;
                            color: #0f172a;
                            direction: rtl;
                        }
                        table { border-collapse: collapse; }
                        @page {
                            size: ${landscape ? 'A4 landscape' : 'A4 portrait'};
                            margin: 10mm;
                        }
                    </style>
                </head>
                <body>
                    ${html}
                </body>
                </html>`;

                await page.setContent(fullHtml, { waitUntil: ['load', 'networkidle0'], timeout: 15000 });
                
                const pdfBuffer = await page.pdf({
                    format: 'A4',
                    landscape: landscape,
                    printBackground: true,
                    margin: { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' }
                });

                await browser.close();

                res.writeHead(200, {
                    'Content-Type': 'application/pdf',
                    'Content-Length': pdfBuffer.length,
                    'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`
                });
                res.end(pdfBuffer);
                logMessage(`POST /api/generate-pdf - Generated ${pdfBuffer.length} bytes for ${filename}`);
            } catch (err) {
                logMessage(`POST /api/generate-pdf - ERROR: ${err.message}`);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: err.message }));
            }
        });
        return;
    }

    // Serve static files
    let urlPath = pathname;
    if (urlPath === '/') {
        urlPath = '/index.html';
    } else if (urlPath === '/mobile' || urlPath === '/mobile/') {
        // The standalone mobile grading app - everything else under
        // /mobile/* (its own js/css/manifest/service-worker) is served by
        // the generic static handler below with no special-casing needed.
        urlPath = '/mobile/index.html';
    }

    let filePath = path.join(__dirname, urlPath);
    
    const relative = path.relative(__dirname, filePath);
    const isSafe = relative && !relative.startsWith('..') && !path.isAbsolute(relative);
    if (!isSafe && urlPath !== '/index.html') {
        res.writeHead(403);
        res.end('Forbidden');
        logMessage(`Blocked forbidden request: ${urlPath}`);
        return;
    }

    const ext = path.extname(filePath);
    const mime = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404);
            res.end('Not Found');
            logMessage(`File not found: ${filePath}`);
        } else {
            res.writeHead(200, { 
                'Content-Type': mime,
                'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
                'Pragma': 'no-cache',
                'Expires': '0'
            });
            res.end(data);
        }
    });
});

// ------------------------------------------------------------
// AUTOMATED WEEKLY REPORT SCHEDULER
// ------------------------------------------------------------
// Reads weeklyReportSchedule straight out of data.json (the same file
// app.js writes via POST /api/data), so the browser tab and this server
// always agree on the configured schedule without a separate API. Drives
// a headless page through the exact same window.sendWeeklyReport() the
// manual button calls, so behavior (report content, PDF/image generation,
// WhatsApp send) is identical either way.
function readWeeklyReportSchedule() {
    try {
        const parsed = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        return parsed.weeklyReportSchedule || null;
    } catch (e) {
        return null;
    }
}

function persistLastAutoSentAt(timestamp) {
    try {
        const parsed = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        parsed.weeklyReportSchedule = Object.assign({}, parsed.weeklyReportSchedule, { lastAutoSentAt: timestamp });
        atomicWriteFileSync(DATA_FILE, JSON.stringify(parsed));
    } catch (e) {
        logMessage('[Auto Weekly Report] Failed to persist lastAutoSentAt: ' + e.message);
    }
}

// Most recent datetime matching {dayOfWeek, hour, minute} that is <= now.
// Using "most recent past occurrence" (rather than an exact-minute match)
// means a PC that was off/asleep exactly at the scheduled moment still
// catches up and sends once it's back on, instead of silently skipping
// that week.
function getMostRecentScheduledOccurrence(dayOfWeek, hour, minute, now) {
    const d = new Date(now);
    d.setHours(hour, minute, 0, 0);
    const diffDays = (d.getDay() - dayOfWeek + 7) % 7;
    d.setDate(d.getDate() - diffDays);
    if (d.getTime() > now.getTime()) {
        d.setDate(d.getDate() - 7);
    }
    return d;
}

let weeklyReportRunInProgress = false;

async function runAutomatedWeeklyReport() {
    if (weeklyReportRunInProgress) return;
    weeklyReportRunInProgress = true;
    logMessage('[Auto Weekly Report] Scheduled time reached — launching headless report run...');

    if (!puppeteer) {
        logMessage('[Auto Weekly Report] ERROR: Puppeteer engine is not available on this server, cannot run automated report.');
        weeklyReportRunInProgress = false;
        return;
    }

    let browser = null;
    try {
        const execPath = getBrowserExecutablePath();
        const launchOpts = {
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
        };
        if (execPath) launchOpts.executablePath = execPath;

        browser = await puppeteer.launch(launchOpts);
        const page = await browser.newPage();
        page.on('console', msg => logMessage(`[Auto Weekly Report][page] ${msg.text()}`));
        page.on('dialog', async (dialog) => { try { await dialog.dismiss(); } catch (e) {} });

        await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'load', timeout: 30000 });
        await page.waitForFunction(() => window.appInitComplete === true, { timeout: 20000 });

        const result = await page.evaluate(() => {
            return new Promise((resolve) => {
                window.addEventListener('weeklyReportSendComplete', (e) => resolve(e.detail), { once: true });
                window.sendWeeklyReport();
                // Safety net: sendWeeklyReport should always eventually
                // dispatch weeklyReportSendComplete, but don't hang forever
                // if something inside it throws before reaching one.
                setTimeout(() => resolve({ sent: false, reason: 'timeout' }), 45000);
            });
        });

        logMessage(`[Auto Weekly Report] Run finished: ${JSON.stringify(result)}`);
        // Marked as attempted only once we actually got a completion
        // result (sent, no-issues-found, or the internal timeout safety
        // net) so a persistent infra failure (e.g. page.goto timing out
        // before the app even loads) doesn't get silently marked "done" —
        // it retries on the next 60s check instead.
        persistLastAutoSentAt(Date.now());
    } catch (err) {
        logMessage('[Auto Weekly Report] ERROR: ' + err.message);
    } finally {
        if (browser) {
            try { await browser.close(); } catch (e) {}
        }
        weeklyReportRunInProgress = false;
    }
}

function checkWeeklyReportSchedule() {
    const schedule = readWeeklyReportSchedule();
    if (!schedule || !schedule.enabled) return;
    if (weeklyReportRunInProgress) return;

    const now = new Date();
    const target = getMostRecentScheduledOccurrence(schedule.dayOfWeek, schedule.hour, schedule.minute, now);
    const lastSent = schedule.lastAutoSentAt || 0;

    if (lastSent < target.getTime()) {
        runAutomatedWeeklyReport();
    }
}

setInterval(checkWeeklyReportSchedule, 60 * 1000);

// ------------------------------------------------------------
// DAILY BACKUP TO ONEDRIVE
// ------------------------------------------------------------
// Writes one dated copy of data.json per day into the teacher's own
// OneDrive folder - Windows sets the OneDrive env var automatically once
// OneDrive is installed and signed in, so this needs no API keys/OAuth,
// no new dependency, and no configuration: whatever OneDrive is already
// syncing to the cloud, this file rides along with it. Protects against
// a deleted/corrupted data.json or a lost/broken laptop, which a
// same-device-only backup can't.
function getOneDriveFolder() {
    const candidates = [
        process.env.OneDrive,
        process.env.OneDriveConsumer,
        process.env.OneDriveCommercial,
        path.join(os.homedir(), 'OneDrive')
    ].filter(Boolean);
    for (const p of candidates) {
        if (fs.existsSync(p)) return p;
    }
    return null;
}

function getTodayDateString() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

const BACKUP_RETENTION_DAYS = 30;

function pruneOldBackups(backupDir) {
    try {
        const files = fs.readdirSync(backupDir).filter(f => /^backup-\d{4}-\d{2}-\d{2}\.json$/.test(f));
        files.sort(); // filenames sort chronologically (YYYY-MM-DD)
        const excess = files.length - BACKUP_RETENTION_DAYS;
        for (let i = 0; i < excess; i++) {
            fs.unlinkSync(path.join(backupDir, files[i]));
        }
    } catch (e) {
        logMessage('[Daily Backup] Failed to prune old backups: ' + e.message);
    }
}

function checkDailyBackup() {
    if (!fs.existsSync(DATA_FILE)) return; // nothing to back up yet

    const oneDriveFolder = getOneDriveFolder();
    if (!oneDriveFolder) return; // OneDrive not installed/signed in on this machine - silently skip

    const backupDir = path.join(oneDriveFolder, 'StudentTrackerBackups');
    const todayFile = path.join(backupDir, `backup-${getTodayDateString()}.json`);
    if (fs.existsSync(todayFile)) return; // already backed up today

    try {
        fs.mkdirSync(backupDir, { recursive: true });
        fs.copyFileSync(DATA_FILE, todayFile);
        logMessage(`[Daily Backup] Backed up data.json to ${todayFile}`);
        pruneOldBackups(backupDir);
    } catch (e) {
        logMessage('[Daily Backup] Failed to write backup: ' + e.message);
    }
}

checkDailyBackup();
setInterval(checkDailyBackup, 60 * 60 * 1000);

server.on('error', (e) => {
    if (e.code === 'EADDRINUSE') {
        logMessage('Port 8000 already in use. Server exiting.');
        console.log('Port 8000 already in use. Server is likely already running.');
        process.exit(0);
    } else {
        logMessage(`Server error: ${e.message}`);
        console.error('Server error:', e);
    }
});

server.listen(PORT, () => {
    logMessage(`Server listening on port ${PORT}`);
    console.log(`Server running at http://localhost:${PORT}`);
    licensing.init();
});
