// Exposes a tiny, fixed set of functions to the page (nothing else from Node/Electron is reachable).
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('orthoBridge', {
  info: () => ipcRenderer.invoke('bridge:info'),
  write: (text) => ipcRenderer.invoke('bridge:write', String(text)),
  remove: () => ipcRenderer.invoke('bridge:remove'),
  readImport: () => ipcRenderer.invoke('bridge:readImport'),
  readJson: (n) => ipcRenderer.invoke('bridge:readJson', String(n)),
  deleteJson: (n) => ipcRenderer.invoke('bridge:deleteJson', String(n)),
  writeImage: (n, b64) => ipcRenderer.invoke('bridge:writeImage', String(n), String(b64)),
  openFolder: () => ipcRenderer.invoke('bridge:openFolder'),
});
