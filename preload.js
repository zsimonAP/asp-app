const { contextBridge, ipcRenderer } = require('electron');

console.log('preload.js is loaded');

// Expose a limited API to the renderer process
contextBridge.exposeInMainWorld('electron', {
  ipcRenderer: {
    send: (channel, data) => ipcRenderer.send(channel, data),
    on: (channel, func) => ipcRenderer.on(channel, (event, ...args) => func(...args)),
    removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
  },
});

console.log('preload.js loaded and ipcRenderer exposed');
