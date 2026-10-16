const { app, BrowserWindow, Menu, shell, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

if (!app.requestSingleInstanceLock()) { app.quit(); }

function createWindow() {
  const win = new BrowserWindow({
    width: 1280, height: 860, minWidth: 420, minHeight: 600,
    title: 'OrthoApp', backgroundColor: '#f3f6f8', autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, preload: path.join(__dirname, 'preload.js') }
  });
  Menu.setApplicationMenu(null);
  win.loadFile(path.join(__dirname, 'index.html'));
  // Keep the app offline: block navigation away; open any web link in the default browser.
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('file://')) { e.preventDefault(); shell.openExternal(url); } });
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) shell.openExternal(url); return { action: 'deny' }; });
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('second-instance', () => { const w = BrowserWindow.getAllWindows()[0]; if (w) { if (w.isMinimized()) w.restore(); w.focus(); } });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

/* ---- Optional link to the Claude extension -------------------------------------------------
 * The page may keep ONE copy of its data (no images) in Documents/OrthoApp-Bridge, only when the
 * user switches the option on. The extension reads that file; it can leave `import-from-claude.json`
 * next to it, which the user imports with Merge. Only file:// pages of this app may call these. */
const BRIDGE_DIR = () => path.join(app.getPath('documents'), 'OrthoApp-Bridge');
const DATA_FILE = () => path.join(BRIDGE_DIR(), 'orthoapp-data.json');
const IMPORT_FILE = () => path.join(BRIDGE_DIR(), 'import-from-claude.json');
const trusted = (e) => !!(e.senderFrame && String(e.senderFrame.url).startsWith('file://'));

ipcMain.handle('bridge:info', (e) => {
  if (!trusted(e)) return null;
  let modified = null, importReady = false;
  try { modified = fs.statSync(DATA_FILE()).mtime.toISOString(); } catch (_) {}
  try { importReady = fs.statSync(IMPORT_FILE()).isFile(); } catch (_) {}
  return { dir: BRIDGE_DIR(), file: DATA_FILE(), modified, importReady };
});
ipcMain.handle('bridge:write', (e, text) => {
  if (!trusted(e)) throw new Error('not allowed');
  if (typeof text !== 'string' || text.length > 200 * 1024 * 1024) throw new Error('bad data');
  const o = JSON.parse(text);
  if (!o || o.app !== 'OrthoApp' || !o.stores) throw new Error('not an OrthoApp backup');
  fs.mkdirSync(BRIDGE_DIR(), { recursive: true });
  const tmp = DATA_FILE() + '.tmp';
  fs.writeFileSync(tmp, text, 'utf8');
  fs.renameSync(tmp, DATA_FILE());                 // replace in one step so a reader never sees half a file
  return { file: DATA_FILE(), modified: new Date().toISOString() };
});
ipcMain.handle('bridge:remove', (e) => {
  if (!trusted(e)) throw new Error('not allowed');
  try { fs.unlinkSync(DATA_FILE()); } catch (_) {}
  return true;
});
ipcMain.handle('bridge:readImport', (e) => {
  if (!trusted(e)) throw new Error('not allowed');
  try { return fs.readFileSync(IMPORT_FILE(), 'utf8'); } catch (_) { return null; }
});
ipcMain.handle('bridge:openFolder', (e) => {
  if (!trusted(e)) throw new Error('not allowed');
  fs.mkdirSync(BRIDGE_DIR(), { recursive: true });
  return shell.openPath(BRIDGE_DIR());
});
