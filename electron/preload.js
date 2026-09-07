// electron/preload.js — the only bridge between the sandboxed renderer
// (contextIsolation: true, nodeIntegration: false) and the main process.
// Exposes exactly one method: triggering the self-update flow implemented
// in main.js. Everything the update actually does (network, filesystem,
// process control) stays in the main process; the renderer only gets to
// ask for it and read back a result.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    checkForUpdate: () => ipcRenderer.invoke('check-for-update')
});
