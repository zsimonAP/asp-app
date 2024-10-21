import { contextBridge, ipcRenderer } from 'electron';

try {
  console.log('preload.js is loaded');

  contextBridge.exposeInMainWorld('electron', {
    ipcRenderer: {
      send: (channel, data) => ipcRenderer.send(channel, data),
      invoke: (channel, data) => ipcRenderer.invoke(channel, data),
      on: (channel, listener) => ipcRenderer.on(channel, listener),
      once: (channel, listener) => ipcRenderer.once(channel, listener),
      removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
    },
  });
} catch (error) {
  console.error('Error in preload.js:', error);
}
