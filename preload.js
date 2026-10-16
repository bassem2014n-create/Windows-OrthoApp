// Exposes a tiny, fixed set of functions to the page (nothing else from Node/Electron is reachable).
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('orthoBridge', {
  info: () => ipcRenderer.invoke('bridge:info'),
  write: (text) => ipcRenderer.invoke('bridge:write', String(text)),
  remove: () => ipcRenderer.invoke('bridge:remove'),
  readImport: () => ipcRenderer.invoke('bridge:readImport'),
  openFolder: () => ipcRenderer.invoke('bridge:openFolder'),
});
