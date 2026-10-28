const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('faber', {
  capabilities: () => ipcRenderer.invoke('sf:capabilities'),
  pickFolder: () => ipcRenderer.invoke('sf:pickFolder'),
  run: (opts) => ipcRenderer.invoke('sf:run', opts),
  approve: (decision, notes) => ipcRenderer.invoke('sf:approve', decision, notes),
  confirm: (id, decision) => ipcRenderer.invoke('sf:confirm', id, decision),
  history: (dir) => ipcRenderer.invoke('sf:history', dir),
  star: (dir, runId, fav) => ipcRenderer.invoke('sf:star', dir, runId, fav),
  vaultList: () => ipcRenderer.invoke('sf:vault:list'),
  vaultSet: (name, value) => ipcRenderer.invoke('sf:vault:set', name, value),
  vaultDelete: (name) => ipcRenderer.invoke('sf:vault:delete', name),
  memoryList: (dir) => ipcRenderer.invoke('sf:memory:list', dir),
  memoryAdd: (dir, scope, category, content) => ipcRenderer.invoke('sf:memory:add', dir, scope, category, content),
  memoryDelete: (dir, hash) => ipcRenderer.invoke('sf:memory:delete', dir, hash),
  memorySync: (dir, token) => ipcRenderer.invoke('sf:memory:sync', dir, token),
  files: (dir) => ipcRenderer.invoke('sf:files', dir),
  readFile: (dir, rel) => ipcRenderer.invoke('sf:read', dir, rel),
  writeFile: (dir, rel, content) => ipcRenderer.invoke('sf:write', dir, rel, content),
  changes: (dir) => ipcRenderer.invoke('sf:changes', dir),
  revert: (dir, index) => ipcRenderer.invoke('sf:revert', dir, index),
  onEvent: (cb) => {
    const fn = (_e, event) => cb(event);
    ipcRenderer.on('sf:event', fn);
    return () => ipcRenderer.removeListener('sf:event', fn);
  },
});
