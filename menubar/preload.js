const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('timerAPI', {
  getStatus: () => ipcRenderer.invoke('get-status'),
  runCommand: (command) => ipcRenderer.invoke('run-command', command),
  openDashboard: () => ipcRenderer.invoke('open-dashboard')
});
