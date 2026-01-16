const { contextBridge, ipcRenderer } = require('electron');

// Since nodeIntegration is true, we can expose the API directly
window.electronAPI = {
  saveConfig: (config) => ipcRenderer.invoke('save-config', config),
  wizardComplete: () => ipcRenderer.invoke('wizard-complete'),
  getConfig: () => ipcRenderer.invoke('get-config')
};
