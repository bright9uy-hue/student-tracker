// Downloads a standalone Windows node.exe and places it at bin/node.exe so
// electron-builder bundles it into the installer (see package.json's
// "build".files: "bin/**"). Without this, every machine the packaged app
// is installed on would need Node.js pre-installed separately, since
// electron/main.js's spawnServer() shells out to `node server.js` - fine
// for a developer's own machine, not acceptable for handing the .exe to a
// teacher who just wants to double-click and run it.
//
// Runs automatically before `npm run dist:win` (see package.json's
// "predist:win" script). Safe to re-run - skips the download if bin/node.exe
// already exists.
//
// Node's official Windows zip ships node.exe as a single, statically
// linked ~80MB executable with no other required DLLs beyond standard
// Windows system libraries, so extracting just that one file is enough.

const fs = require('fs');
const path = require('path');
const os = require('os');
const extract = require('extract-zip');

const NODE_VERSION = 'v22.11.0';
const DOWNLOAD_URL = `https://nodejs.org/dist/${NODE_VERSION}/node-${NODE_VERSION}-win-x64.zip`;
const BIN_DIR = path.join(__dirname, '..', 'bin');
const TARGET_EXE = path.join(BIN_DIR, 'node.exe');

async function main() {
    if (fs.existsSync(TARGET_EXE)) {
        console.log(`[prepare-bundled-node] bin/node.exe already present, skipping download.`);
        return;
    }

    fs.mkdirSync(BIN_DIR, { recursive: true });
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bundled-node-'));
    const zipPath = path.join(tmpDir, 'node.zip');

    console.log(`[prepare-bundled-node] Downloading ${DOWNLOAD_URL} ...`);
    const res = await fetch(DOWNLOAD_URL);
    if (!res.ok) throw new Error(`Download failed: HTTP ${res.status}`);
    const buffer = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(zipPath, buffer);

    console.log('[prepare-bundled-node] Extracting node.exe ...');
    const extractDir = path.join(tmpDir, 'extracted');
    await extract(zipPath, { dir: extractDir });

    const extractedExe = path.join(extractDir, `node-${NODE_VERSION}-win-x64`, 'node.exe');
    if (!fs.existsSync(extractedExe)) {
        throw new Error(`Expected file not found after extraction: ${extractedExe}`);
    }
    fs.copyFileSync(extractedExe, TARGET_EXE);
    fs.rmSync(tmpDir, { recursive: true, force: true });

    console.log(`[prepare-bundled-node] Done - bin/node.exe ready (${(fs.statSync(TARGET_EXE).size / 1024 / 1024).toFixed(1)} MB).`);
}

main().catch(err => {
    console.error('[prepare-bundled-node] FAILED:', err.message);
    process.exit(1);
});
