import { contextBridge, ipcRenderer } from 'electron';

console.log(`Preload.js active`);
contextBridge.exposeInMainWorld('electron', {
  ipcRenderer: {
    on: (channel, listener) => ipcRenderer.on(channel, listener),
    once: (channel, listener) => ipcRenderer.once(channel, listener),
    send: (channel, data) => ipcRenderer.send(channel, data),
    removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
  },
});
