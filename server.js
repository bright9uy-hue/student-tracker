const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8000;
const DATA_FILE = path.join(__dirname, 'data.json');
const LOG_FILE = path.join(__dirname, 'server.log');

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

try {
    const { Client, LocalAuth, MessageMedia: MM } = require('whatsapp-web.js');
    MessageMedia = MM;

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

    whatsappClient = new Client({
        authStrategy: new LocalAuth({ dataPath: path.join(__dirname, '.wwebjs_auth') }),
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
} catch (e) {
    logMessage('Notice: whatsapp-web.js not available or failed to load: ' + e.message);
    waStatus = 'NOT_INSTALLED';
}

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
                    fs.writeFileSync(DATA_FILE, body, 'utf8');
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true }));
                    logMessage(`POST /api/data - Successfully wrote ${body.length} bytes to data.json`);
                } catch (e) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: e.message }));
                    logMessage(`POST /api/data - ERROR writing data: ${e.message}`);
                }
            });
            return;
        }
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
                waStatus = 'DISCONNECTED';
                waQrCode = null;
                waClientInfo = null;
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
        fs.writeFileSync(DATA_FILE, JSON.stringify(parsed), 'utf8');
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
});
