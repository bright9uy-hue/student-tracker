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
    } catch (e) {
        console.error('Logging failed:', e);
    }
}

// Clear log file on startup
try {
    fs.writeFileSync(LOG_FILE, '', 'utf8');
    logMessage('Server starting up...');
} catch(e) {}

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.png': 'image/png',
    '.txt': 'text/plain; charset=utf-8',
    '.json': 'application/json; charset=utf-8'
};

const server = http.createServer((req, res) => {
    logMessage(`Request: ${req.method} ${req.url}`);

    // Set CORS headers so that file:/// protocol pages can fetch/save data
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle CORS preflight options request
    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    // Handle API endpoints
    if (req.url === '/api/data') {
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
            let body = '';
            req.on('data', chunk => {
                body += chunk.toString();
            });
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

    // Serve static files
    let urlPath = req.url.split('?')[0];
    if (urlPath === '/') {
        urlPath = '/index.html';
    }
    
    let filePath = path.join(__dirname, urlPath);
    
    // Safety check to ensure requested files are inside our project directory
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
