const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Window controls
  minimize:  () => ipcRenderer.send('window-minimize'),
  maximize:  () => ipcRenderer.send('window-maximize'),
  close:     () => ipcRenderer.send('window-close'),

  // Updater
  getLocalVersion: () => ipcRenderer.invoke('get-local-version'),
  checkUpdate:     () => ipcRenderer.invoke('check-update'),
  launchApp:       () => ipcRenderer.invoke('launch-app'),
  downloadUpdate:  () => ipcRenderer.invoke('download-update'),
});
