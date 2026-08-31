/**
 * Whats-Web Integration Server for Student Tracker
 * ------------------------------------------------
 * Automated WhatsApp Web Engine using whatsapp-web.js & Express API.
 * Features:
 * - Scans QR code ONCE via LocalAuth session persistence.
 * - HTTP API for sending automated student reports, text messages, & canvas report images.
 * - Port 3001 API Server with CORS support for seamless integration with index.html (Port 8000).
 */

const express = require('express');
const cors = require('cors');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3001;
const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Client State Storage
let qrCodeData = null;
let clientStatus = 'INITIALIZING'; // INITIALIZING, QR_READY, AUTHENTICATED, READY, DISCONNECTED
let clientInfo = null;

console.log('====================================================');
console.log('🚀 Starting WhatsApp Web Engine (whats-web.js)...');
console.log('====================================================');

// Helper: Find system Chrome or Edge executable on Windows/Linux
function findBrowserExecutable() {
    const possiblePaths = [
        '/usr/bin/chromium',
        '/usr/bin/chromium-browser',
        '/usr/bin/google-chrome-stable',
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
        'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
        path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe')
    ];

    for (const p of possiblePaths) {
        try {
            if (p && fs.existsSync(p)) {
                console.log(`[WhatsApp] 🌐 Found browser executable at: ${p}`);
                return p;
            }
        } catch (e) {}
    }
    return undefined;
}

const executablePath = findBrowserExecutable();

// Initialize WhatsApp Client with LocalAuth for session persistence
const client = new Client({
    authStrategy: new LocalAuth({
        clientId: 'student-tracker-session',
        dataPath: path.join(__dirname, '.wwebjs_auth')
    }),
    puppeteer: {
        executablePath: executablePath,
        headless: true,
        protocolTimeout: 0,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu',
            '--disable-extensions'
        ]
    }
});

// Event: QR Code Generated
client.on('qr', (qr) => {
    qrCodeData = qr;
    clientStatus = 'QR_READY';
    console.log('\n[WhatsApp] 📲 QR Code generated! Scan it with your phone WhatsApp app:');
    qrcode.generate(qr, { small: true });
});

// Event: Authenticating
client.on('authenticated', () => {
    clientStatus = 'AUTHENTICATED';
    qrCodeData = null;
    console.log('[WhatsApp] 🔐 Session authenticated successfully.');
});

// Event: Auth Failure
client.on('auth_failure', (msg) => {
    clientStatus = 'DISCONNECTED';
    qrCodeData = null;
    console.error('[WhatsApp] ❌ Authentication failed:', msg);
});

// Event: Ready to send messages
client.on('ready', () => {
    clientStatus = 'READY';
    qrCodeData = null;
    clientInfo = {
        name: client.info.pushname,
        phone: client.info.wid.user
    };
    console.log(`[WhatsApp] ✅ Client is READY! Logged in as: ${clientInfo.name} (${clientInfo.phone})`);
});

// Event: Disconnected
client.on('disconnected', (reason) => {
    clientStatus = 'DISCONNECTED';
    qrCodeData = null;
    clientInfo = null;
    console.warn('[WhatsApp] ⚠️ Client disconnected:', reason);
});

// Helper: Format Phone Number for WhatsApp (e.g. 0512345678 -> 966512345678@c.us)
function formatPhoneNumber(phone) {
    let clean = phone.toString().replace(/[^\d]/g, '');
    if (clean.startsWith('05')) {
        clean = '966' + clean.slice(1);
    } else if (clean.startsWith('5')) {
        clean = '966' + clean;
    }
    if (!clean.endsWith('@c.us')) {
        clean = clean + '@c.us';
    }
    return clean;
}

// ------------------------------------------------------------
// HTTP API ENDPOINTS
// ------------------------------------------------------------

// GET /api/whatsapp/status - Check connection & QR code
app.get('/api/whatsapp/status', (req, res) => {
    res.json({
        success: true,
        status: clientStatus,
        qr: qrCodeData,
        user: clientInfo
    });
});

// POST /api/whatsapp/send - Send text message or report image to a phone number
app.post('/api/whatsapp/send', async (req, res) => {
    try {
        if (clientStatus !== 'READY') {
            return res.status(400).json({
                success: false,
                error: `واتساب غير متصل حالياً! الحالة: ${clientStatus}. يرجى مسح رمز QR أولاً.`
            });
        }

        const { phone, message, mediaBase64, filename } = req.body;

        if (!phone) {
            return res.status(400).json({ success: false, error: 'رقم الهاتف مطلوب!' });
        }

        const formattedPhone = formatPhoneNumber(phone);

        let sentMessage = null;

        if (mediaBase64) {
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
            } else {
                mimeType = 'application/pdf';
                isDocument = true;
            }

            let mediaName = (filename || (isDocument ? 'التقرير_الأسبوعي.pdf' : 'report.png')).replace(/[\/\\:\*\?"<>\|]/g, '_');
            if (isDocument && !mediaName.toLowerCase().endsWith('.pdf')) {
                mediaName += '.pdf';
            } else if (!isDocument && !mediaName.toLowerCase().match(/\.(png|jpe?g|webp)$/)) {
                mediaName += '.png';
            }

            console.log(`[WhatsApp API] 📤 Sending ${isDocument ? 'PDF Document' : 'Media'} to ${formattedPhone} (MIME: ${mimeType}, File: ${mediaName})`);

            const media = new MessageMedia(mimeType, rawData, mediaName);
            
            // Timeout after 25s if WhatsApp Web hangs
            const sendPromise = client.sendMessage(formattedPhone, media, {
                caption: message || '',
                sendMediaAsDocument: isDocument
            });
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('انتهت مهلة إرسال الوسائط في واتساب (Timeout 25s)')), 25000)
            );
            sentMessage = await Promise.race([sendPromise, timeoutPromise]);
        } else if (message) {
            const sendPromise = client.sendMessage(formattedPhone, message);
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('انتهت مهلة إرسال الرسالة في واتساب (Timeout 15s)')), 15000)
            );
            sentMessage = await Promise.race([sendPromise, timeoutPromise]);
        } else {
            return res.status(400).json({ success: false, error: 'الرسالة أو الصورة مطلوبة!' });
        }

        const messageId = sentMessage?.id?._serialized || sentMessage?.id?.id || 'SENT';
        console.log(`[WhatsApp] 📤 Sent message to ${phone} (ID: ${messageId})`);
        res.json({
            success: true,
            message: 'تم إرسال الرسالة عبر واتساب بنجاح!',
            messageId: messageId
        });

    } catch (err) {
        console.error('[WhatsApp] ❌ Error sending message:', err);
        res.status(500).json({
            success: false,
            error: `حدث خطأ أثناء إرسال الرسالة: ${err.message}`
        });
    }
});

// POST /api/whatsapp/send-bulk - Send bulk notifications to multiple parents/students
app.post('/api/whatsapp/send-bulk', async (req, res) => {
    try {
        if (clientStatus !== 'READY') {
            return res.status(400).json({
                success: false,
                error: `واتساب غير متصل حالياً! الحالة: ${clientStatus}. يرجى مسح رمز QR أولاً.`
            });
        }

        const { messages } = req.body; // Array of { phone, message, mediaBase64 }

        if (!Array.isArray(messages) || messages.length === 0) {
            return res.status(400).json({ success: false, error: 'قائمة الرسائل فارغة!' });
        }

        const results = [];
        for (const item of messages) {
            try {
                const formattedPhone = formatPhoneNumber(item.phone);
                if (item.mediaBase64) {
                    let mimeType = 'image/png';
                    let rawData = item.mediaBase64;
                    if (item.mediaBase64.includes(';base64,')) {
                        const parts = item.mediaBase64.split(';base64,');
                        mimeType = parts[0].replace('data:', '');
                        rawData = parts[1];
                    }
                    const media = new MessageMedia(mimeType, rawData, 'report.png');
                    await client.sendMessage(formattedPhone, media, { caption: item.message || '' });
                } else if (item.message) {
                    await client.sendMessage(formattedPhone, item.message);
                }
                results.push({ phone: item.phone, status: 'sent' });
                // Delay 1.5 seconds between bulk sends to avoid rate limiting
                await new Promise(r => setTimeout(r, 1500));
            } catch (err) {
                results.push({ phone: item.phone, status: 'failed', error: err.message });
            }
        }

        res.json({
            success: true,
            summary: `تم معالجة ${results.length} رسائل.`,
            details: results
        });

    } catch (err) {
        console.error('[WhatsApp] ❌ Error in bulk send:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// POST /api/whatsapp/logout - Logout & clear session
app.post('/api/whatsapp/logout', async (req, res) => {
    try {
        await client.logout();
        clientStatus = 'DISCONNECTED';
        qrCodeData = null;
        clientInfo = null;
        res.json({ success: true, message: 'تم تسجيل الخروج وتصفير الجلسة بنجاح.' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Start Express API Server
const server = app.listen(PORT, () => {
    console.log(`[WhatsApp API] Server listening on http://localhost:${PORT}`);
});

server.on('error', (e) => {
    if (e.code === 'EADDRINUSE') {
        console.log(`Port ${PORT} is already in use by a running WhatsApp engine instance.`);
        process.exit(0);
    } else {
        console.error('Server error:', e);
    }
});

// Process-level safety guards to keep server alive
process.on('uncaughtException', (err) => {
    console.error('[WhatsApp Engine UncaughtException]', err.message);
});

process.on('unhandledRejection', (reason) => {
    console.error('[WhatsApp Engine UnhandledRejection]', reason);
});

// Initialize Client
client.initialize().catch(err => {
    console.error('[WhatsApp Client Error]', err);
});
