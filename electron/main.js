// electron/main.js — desktop-app wrapper around the existing web app.
//
// Deliberately does NOT touch server.js, whats-web.js, index.html, js/*, or
// style.css: this file only spawns the exact same `node server.js` process
// the .bat launcher already runs, then shows it in a proper app window
// instead of a Chrome --app= window. Everything about how the app itself
// works (grading, WhatsApp, PDF export, the weekly-report scheduler) is
// unchanged.
//
// server.js is spawned as a genuinely separate child process rather than
// require()'d in-process: server.js has no `require.main` guard and calls
// process.exit(0) on EADDRINUSE (port already taken), which would silently
// kill this whole Electron app if it ran in the same process. Spawning
// avoids that entirely and needs nothing server.js doesn't already need
// today (a system Node.js install — already required for the .bat file).
const { app, BrowserWindow, Tray, Menu, dialog, nativeImage, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

// Repo root: in dev this is the project checkout (one level up from this
// file); in a packaged build (asar disabled — see package.json's "build"
// config, since server.js writes real files like data.json/server.log
// alongside itself, which doesn't work from inside a read-only asar
// archive) it's the "app" folder electron-builder placed under resources.
const APP_ROOT = app.isPackaged
    ? path.join(process.resourcesPath, 'app')
    : path.join(__dirname, '..');

const SERVER_URL = 'http://127.0.0.1:8000';
const ICON_PATH = path.join(APP_ROOT, 'build', 'icon.ico');

let mainWindow = null;
let tray = null;
let serverProcess = null;
let isQuitting = false;

function spawnServer() {
    const child = spawn('node', ['server.js'], {
        cwd: APP_ROOT,
        windowsHide: true,
        stdio: 'ignore'
    });
    child.on('exit', (code, signal) => {
        // Only surface this if we didn't kill it ourselves on quit — an
        // unexpected exit (crash, or another server.js already holding
        // port 8000) should never fail silently.
        if (!isQuitting) {
            dialog.showErrorBox(
                'توقف خادم البرنامج',
                `توقف خادم البرنامج (server.js) بشكل غير متوقع (code=${code}, signal=${signal}).\n` +
                'تأكد أن Node.js مثبت على جهازك وأن المنفذ 8000 غير مستخدم من برنامج آخر، ثم أعد فتح التطبيق.'
            );
        }
    });
    return child;
}

// Polls the real API instead of a fixed delay (the .bat file's `timeout /t
// 2`) — more reliable across slower machines, and fails fast with a clear
// message instead of loading a blank/erroring window.
async function waitForServer(timeoutMs = 15000, intervalMs = 250) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        try {
            const res = await fetch(SERVER_URL + '/api/data');
            if (res.ok) return true;
        } catch (e) { /* not up yet */ }
        await new Promise(r => setTimeout(r, intervalMs));
    }
    return false;
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        autoHideMenuBar: true,
        icon: ICON_PATH,
        title: 'متابعة أداء الطلاب',
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
        }
    });

    mainWindow.loadURL(SERVER_URL + '/');

    // The app calls window.open() in two different ways that need
    // different handling here (Electron denies window.open() by default,
    // unlike a regular browser):
    //  - StudentGroupsModal.js opens a BLANK window (window.open('',
    //    '_blank')) and writes generated HTML into it directly, to print
    //    the groups roster — that one needs a real popup window, so it's
    //    allowed through normally.
    //  - Everything else is a genuine external URL: the WhatsApp Web
    //    fallback link (whatsapp.js) and the Madrasati "auto-sync" page
    //    (madrasati-noor.js). Both need the user's actual default browser,
    //    not a window inside this app — the Madrasati flow depends on a
    //    browser extension that's only installed in the user's real
    //    Chrome (Electron's Chromium instance never loads it, so opening
    //    it here would silently do nothing useful even if the window
    //    itself opened), and WhatsApp Web needs the user's already-
    //    logged-in browser session rather than a fresh, never-logged-in
    //    one inside Electron.
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        if (url === 'about:blank') return { action: 'allow' };
        shell.openExternal(url);
        return { action: 'deny' };
    });

    // Closing the window hides it instead of quitting: server.js's weekly-
    // report scheduler needs to keep running in the background regardless
    // of whether the window is open, exactly like today's .bat-launched
    // background process. Only the tray's "quit" fully exits.
    mainWindow.on('close', (event) => {
        if (!isQuitting) {
            event.preventDefault();
            mainWindow.hide();
        }
    });
}

function createTray() {
    const trayIcon = nativeImage.createFromPath(ICON_PATH);
    tray = new Tray(trayIcon);
    tray.setToolTip('متابعة أداء الطلاب');
    tray.setContextMenu(Menu.buildFromTemplate([
        {
            label: 'فتح البرنامج', click: () => {
                if (mainWindow) { mainWindow.show(); mainWindow.focus(); }
            }
        },
        { type: 'separator' },
        {
            label: 'إنهاء البرنامج بالكامل', click: () => {
                isQuitting = true;
                app.quit();
            }
        }
    ]));
    tray.on('click', () => {
        if (mainWindow) { mainWindow.show(); mainWindow.focus(); }
    });
}

app.whenReady().then(async () => {
    serverProcess = spawnServer();

    const ready = await waitForServer();
    if (!ready) {
        dialog.showErrorBox(
            'تعذّر تشغيل البرنامج',
            'لم يستجب خادم البرنامج خلال الوقت المتوقع. تأكد أن Node.js مثبت على جهازك ثم أعد المحاولة.'
        );
        isQuitting = true;
        app.quit();
        return;
    }

    createWindow();
    createTray();
});

app.on('window-all-closed', () => {
    // Never quit on window close (see the 'close' handler above) — this
    // only fires after an explicit quit, where windows have actually been
    // destroyed, so there's nothing to do here except (on macOS
    // convention) not auto-quit. Kept for completeness; irrelevant on the
    // Windows-only distribution this app targets.
});

app.on('before-quit', () => {
    isQuitting = true;
    if (serverProcess && !serverProcess.killed) {
        serverProcess.kill();
    }
});

app.on('activate', () => {
    if (mainWindow) { mainWindow.show(); mainWindow.focus(); }
});
