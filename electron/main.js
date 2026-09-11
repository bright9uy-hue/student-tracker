// electron/main.js — desktop-app wrapper around the existing web app.
//
// Does NOT touch server.js or style.css: this file spawns the
// exact same `node server.js` process the .bat launcher already runs, then
// shows it in a proper app window instead of a Chrome --app= window.
// Everything about how the app itself works (grading, WhatsApp, PDF export,
// the weekly-report scheduler) is unchanged. index.html/js/electron-update-ui.js
// carry one small addition on top of that: a "تحديث" button that calls back
// into this file (via preload.js's IPC bridge) to self-update from GitHub —
// see performUpdate() below.
//
// server.js is spawned as a genuinely separate child process rather than
// require()'d in-process: server.js has no `require.main` guard and calls
// process.exit(0) on EADDRINUSE (port already taken), which would silently
// kill this whole Electron app if it ran in the same process. Spawning
// avoids that entirely and needs nothing server.js doesn't already need
// today (a system Node.js install — already required for the .bat file).
const { app, BrowserWindow, Tray, Menu, dialog, nativeImage, shell, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn, execFileSync } = require('child_process');

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
// A dedicated small (16/24/32/48) icon for the system tray, resampled
// straight from the same source image (icon-512.png) - the system tray
// renders at a tiny logical size, and a purpose-built small icon stays
// crisp there instead of relying on whichever frame the general-purpose
// window/installer icon.ico happens to pick.
const TRAY_ICON_PATH = path.join(APP_ROOT, 'build', 'tray-icon.ico');

// Self-update: pulls the latest commit of this same branch straight from
// GitHub and replaces the app's own files with it, so the teacher never has
// to rebuild/reinstall by hand for an ordinary code fix. Only these paths
// are touched (kept identical to package.json's electron-builder "files"
// list, minus node_modules) — data.json, the WhatsApp session folders, and
// server.log are never part of the zip in the first place (all gitignored),
// so they're never at risk from this copy.
const REPO_OWNER = 'bright9uy-hue';
const REPO_NAME = 'student-tracker';
const UPDATE_BRANCH = 'claude/electron-desktop-app';
const UPDATE_PATHS = [
    'electron', 'server.js', 'index.html', 'style.css', 'js',
    'manifest.json', 'service-worker.js', 'favicon.ico', 'favicon.png',
    'icon-192.png', 'icon-512.png', 'moe_official_logo.png', 'moe_logo.svg',
    'teacher_signature.png', 'template_blank.png', 'package.json'
];
// Tracked outside APP_ROOT (in Electron's per-user data folder) rather than
// alongside the app files, since the update itself overwrites APP_ROOT.
const UPDATE_INFO_PATH = path.join(app.getPath('userData'), 'update-info.json');

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

// tar.exe (bsdtar, auto-detects zip) has shipped with Windows since the
// 1803 update, so it's the fast path on any current Windows install; if
// it's somehow missing or fails, fall back to Expand-Archive, which ships
// with PowerShell 5+ (also standard on Windows 10/11) and is slower but
// more universally present.
function extractZip(zipPath, destDir) {
    try {
        execFileSync('tar', ['-xf', zipPath, '-C', destDir]);
    } catch (e) {
        execFileSync('powershell', [
            '-NoProfile', '-NonInteractive', '-Command',
            `Expand-Archive -LiteralPath '${zipPath.replace(/'/g, "''")}' -DestinationPath '${destDir.replace(/'/g, "''")}' -Force`
        ]);
    }
}

function readInstalledSha() {
    try { return JSON.parse(fs.readFileSync(UPDATE_INFO_PATH, 'utf8')).sha; }
    catch (e) { return null; }
}

function writeInstalledSha(sha) {
    fs.mkdirSync(path.dirname(UPDATE_INFO_PATH), { recursive: true });
    fs.writeFileSync(UPDATE_INFO_PATH, JSON.stringify({ sha, updatedAt: new Date().toISOString() }));
}

// Runs entirely in the main process (the renderer has no fs/network/process
// access — contextIsolation + nodeIntegration:false — so it can only ask
// for this via the 'check-for-update' IPC channel and read back the result).
async function performUpdate() {
    const headers = { 'User-Agent': 'student-tracker-desktop-app' };

    let latestSha;
    try {
        const res = await fetch(
            `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/commits/${UPDATE_BRANCH}`,
            { headers }
        );
        if (!res.ok) throw new Error(`GitHub API status ${res.status}`);
        latestSha = (await res.json()).sha;
    } catch (e) {
        return { status: 'error', message: 'تعذر الاتصال بخادم التحديثات. تأكد من اتصالك بالإنترنت وحاول مرة أخرى.' };
    }

    if (readInstalledSha() === latestSha) {
        return { status: 'up-to-date' };
    }

    let tmpDir;
    try {
        const zipRes = await fetch(`https://codeload.github.com/${REPO_OWNER}/${REPO_NAME}/zip/${latestSha}`);
        if (!zipRes.ok) throw new Error(`Download status ${zipRes.status}`);
        const zipBuf = Buffer.from(await zipRes.arrayBuffer());

        tmpDir = path.join(app.getPath('temp'), `student-tracker-update-${Date.now()}`);
        fs.mkdirSync(tmpDir, { recursive: true });
        const zipPath = path.join(tmpDir, 'update.zip');
        fs.writeFileSync(zipPath, zipBuf);

        extractZip(zipPath, tmpDir);

        const extractedName = fs.readdirSync(tmpDir).find(name => name !== 'update.zip');
        const extractedRoot = path.join(tmpDir, extractedName);

        const oldPackageJson = fs.existsSync(path.join(APP_ROOT, 'package.json'))
            ? fs.readFileSync(path.join(APP_ROOT, 'package.json'), 'utf8') : null;

        for (const entry of UPDATE_PATHS) {
            const src = path.join(extractedRoot, entry);
            if (!fs.existsSync(src)) continue;
            fs.cpSync(src, path.join(APP_ROOT, entry), { recursive: true, force: true });
        }

        // Only reinstall node_modules when package.json actually changed
        // (new/updated dependency) — most updates are pure code changes and
        // shouldn't pay for an npm install every time.
        const newPackageJson = fs.readFileSync(path.join(APP_ROOT, 'package.json'), 'utf8');
        if (newPackageJson !== oldPackageJson) {
            try {
                execFileSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['install', '--omit=dev'], { cwd: APP_ROOT });
            } catch (e) {
                // Non-fatal: relaunch anyway with whatever node_modules already
                // has — better than blocking the whole update on npm's success.
                console.warn('[Update] npm install failed, continuing with existing node_modules:', e.message);
            }
        }

        writeInstalledSha(latestSha);
        return { status: 'updated' };
    } catch (e) {
        return { status: 'error', message: 'تم تنزيل التحديث لكن حدث خطأ أثناء تثبيته: ' + e.message };
    } finally {
        if (tmpDir) fs.rm(tmpDir, { recursive: true, force: true }, () => {});
    }
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
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
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
    const trayIcon = nativeImage.createFromPath(TRAY_ICON_PATH);
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

// Renderer-triggered self-update (the header's "تحديث" button, via
// preload.js). Runs performUpdate() and, only on success, restarts the
// whole app a moment later — long enough for the renderer to show the
// "تم التحديث" notification before the window disappears.
ipcMain.handle('check-for-update', async () => {
    const result = await performUpdate();
    if (result.status === 'updated') {
        setTimeout(() => {
            isQuitting = true;
            if (serverProcess && !serverProcess.killed) serverProcess.kill();
            app.relaunch();
            app.exit(0);
        }, 1200);
    }
    return result;
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
