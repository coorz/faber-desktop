// Faber 桌面客户端：本地模式（agent 直接操作本地文件夹，代码不出本机）。
const { app, BrowserWindow, shell, Menu, ipcMain, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const fs = require('node:fs');
const path = require('node:path');
const engine = require('./engine.js');
const vault = require('./vault.js');
const memory = require('./memory.js');

const APP_URL = 'https://faber.echo-ai.chat';

function logFile(name) {
  try {
    const dir = app.getPath('logs');
    fs.mkdirSync(dir, { recursive: true });
    return path.join(dir, name);
  } catch { return null; }
}
function localLog(level, msg) {
  const f = logFile('faber.log');
  if (f) fs.appendFileSync(f, `${new Date().toISOString()} [${level}] ${msg}\n`);
}
process.on('uncaughtException', (e) => { localLog('crash', e.stack || String(e)); });

let win = null;

function createWindow() {
  win = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    title: 'Faber',
    backgroundColor: '#0f1115',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  win.loadURL(APP_URL);

  // 站内 SPA 路由照常；新开目标（商店页/制品下载）交给系统浏览器
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(APP_URL)) {
      win.loadURL(url);
      return { action: 'deny' };
    }
    shell.openExternal(url);
    return { action: 'deny' };
  });

  win.webContents.on('render-process-gone', (_e, details) => localLog('render-gone', JSON.stringify(details)));
  win.webContents.on('did-fail-load', (_e, code, desc, url) => {
    if (url === APP_URL && code < -100) {
      setTimeout(() => win?.loadURL(APP_URL).catch(() => {}), 3000); // 断网自动重试
    }
  });
}

const template = [
  ...(process.platform === 'darwin' ? [{
    label: app.name,
    submenu: [
      { role: 'about' },
      { type: 'separator' },
      { role: 'quit' },
    ],
  }] : []),
  {
    label: 'View',
    submenu: [
      { role: 'reload' },
      { role: 'forceReload' },
      { type: 'separator' },
      { role: 'zoomIn' }, { role: 'zoomOut' }, { role: 'resetZoom' },
      { type: 'separator' },
      { role: 'toggleDevTools' },
    ],
  },
];

// ============ 本地模式 IPC ============
let pendingApproval = null;

ipcMain.handle('sf:capabilities', () => ({ local: true, version: app.getVersion() }));

ipcMain.handle('sf:pickFolder', async () => {
  const r = await dialog.showOpenDialog(win, { properties: ['openDirectory', 'createDirectory'] });
  return r.canceled ? null : r.filePaths[0];
});

const confirmResolvers = new Map();

ipcMain.handle('sf:confirm', (_e, id, decision) => {
  const r = confirmResolvers.get(id);
  if (r) { confirmResolvers.delete(id); r(decision); }
  return true;
});

ipcMain.handle('sf:run', async (_e, opts) => {
  const { dir, scenario, brief, token } = opts;
  if (!dir) return { ok: false, error: 'no folder' };
  let resolveApproval;
  pendingApproval = new Promise((r) => { resolveApproval = r; });
  const getApproval = () => pendingApproval;
  opts.registerConfirm = (id, resolve) => confirmResolvers.set(id, resolve);
  const emit = (event) => {
    event.dir = dir;
    if (win && !win.isDestroyed()) win.webContents.send('sf:event', event);
  };
  engine.runPipeline({ dir, scenario, brief, token, emit, userData: app.getPath('userData'), getApproval, secrets: vault.resolveAll(app.getPath('userData')) })
    .then(async () => {
      // 跑完：提取记忆 → 与服务器同步
      try {
        await engine.extractMemories(token, { logs: [] }, app.getPath('userData'), dir);
      } catch {}
      const sync = await engine.syncMemories(token, app.getPath('userData'), dir).catch(() => null);
      if (sync) localLog('memory', `synced: uploaded ${sync.uploaded}, pulled ${sync.added}`);
      emit({ type: 'memory-synced', at: Date.now(), data: sync || {} });
    })
    .catch((e) => { localLog('engine-error', e.stack || String(e)); emit({ type: 'log', at: Date.now(), data: { text: `引擎错误: ${e.message}` } }); })
    .finally(() => { pendingApproval = null; });
  return { ok: true };
});

// ---------- 统一密钥库（本机 OS 加密，永不上云） ----------
ipcMain.handle('sf:vault:list', () => vault.list(app.getPath('userData')));
ipcMain.handle('sf:vault:set', (_e, name, value) => vault.set(app.getPath('userData'), name, value));
ipcMain.handle('sf:vault:delete', (_e, name) => vault.del(app.getPath('userData'), name));

// ---------- 统一记忆 ----------
ipcMain.handle('sf:memory:list', (_e, dir) => memory.listAll(app.getPath('userData'), dir));
ipcMain.handle('sf:memory:add', (_e, dir, scope, category, content) => {
  const f = scope === 'global' ? memory._g(app.getPath('userData')) : memory._p(dir);
  return memory.addItem(f, scope, dir ? dir : null, category, content);
});
ipcMain.handle('sf:memory:delete', (_e, dir, hash) => memory.deleteItem(app.getPath('userData'), dir, hash));
ipcMain.handle('sf:memory:sync', async (_e, dir, token) => engine.syncMemories(token, app.getPath('userData'), dir));

// ---------- 编辑器 + Review 面板 ----------
const EDIT_SKIP = new Set(['node_modules', '.git', 'dist', 'build', 'out', '.cache', 'Library', 'Temp', 'Logs', 'obj', 'bin', '.gradle', '__pycache__', '.faber', '.sf']);
ipcMain.handle('sf:files', (_e, dir) => {
  const out = [];
  const walk = (d, rel, depth) => {
    if (depth > 5 || out.length > 1500) return;
    let entries = [];
    try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (e.name.startsWith('.') && e.name !== '.env.example') continue;
      if (EDIT_SKIP.has(e.name)) continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) { out.push({ path: path.join(rel, e.name), dir: true }); walk(p, path.join(rel, e.name), depth + 1); }
      else { let size = 0; try { size = fs.statSync(p).size; } catch {} out.push({ path: path.join(rel, e.name), dir: false, size }); }
      if (out.length > 1500) return;
    }
  };
  walk(dir, '', 0);
  return out;
});
ipcMain.handle('sf:read', (_e, dir, rel) => {
  const p = path.join(dir, rel);
  if (!p.startsWith(dir)) throw new Error('路径越界');
  return fs.readFileSync(p, 'utf8');
});
ipcMain.handle('sf:write', (_e, dir, rel, content) => {
  const p = path.join(dir, rel);
  if (!p.startsWith(dir)) throw new Error('路径越界');
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content);
  return true;
});
ipcMain.handle('sf:changes', (_e, dir) => {
  try { return JSON.parse(fs.readFileSync(path.join(dir, '.faber', 'changes.json'), 'utf8')); } catch { return []; }
});
ipcMain.handle('sf:revert', (_e, dir, index) => {
  const changes = JSON.parse(fs.readFileSync(path.join(dir, '.faber', 'changes.json'), 'utf8'));
  const c = changes[index];
  if (!c) return false;
  const p = path.join(dir, c.path);
  if (c.before === '') { try { fs.unlinkSync(p); } catch {} } else fs.writeFileSync(p, c.before);
  c.reverted = true;
  fs.writeFileSync(path.join(dir, '.faber', 'changes.json'), JSON.stringify(changes));
  return true;
});

ipcMain.handle('sf:history', (_e, dir) => engine.history(dir));
ipcMain.handle('sf:star', (_e, dir, runId, fav) => engine.star(dir, runId, fav));

ipcMain.handle('sf:approve', (_e, decision, notes) => {
  if (pendingApproval) { const r = pendingApproval; pendingApproval = null; r({ decision, notes: notes || '' }); }
  return true;
});

function setupAutoUpdate() {
  // 静默升级：后台下载，退出时安装（更新源 = 官网 CDN）
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('update-downloaded', () => localLog('update', `已下载新版本 ${autoUpdater.updateInfo?.version}，退出时自动安装`));
  autoUpdater.on('error', (e) => localLog('update-error', String(e?.message ?? e)));
  autoUpdater.checkForUpdates().catch(() => {});
  setInterval(() => autoUpdater.checkForUpdates().catch(() => {}), 4 * 3600 * 1000);
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
  createWindow();
  setupAutoUpdate();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
