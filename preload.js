const { contextBridge, ipcRenderer } = require('electron');

// Exposing limited API to the renderer process
contextBridge.exposeInMainWorld('electron', {
  ipcRenderer: {
    send: (channel, data) => {
      const validChannels = ['flask-port', 'folder-structure']; // List valid channels
      if (validChannels.includes(channel)) {
        ipcRenderer.send(channel, data);
      }
    },
    on: (channel, func) => {
      const validChannels = ['flask-port', 'folder-structure']; // List valid channels
      if (validChannels.includes(channel)) {
        ipcRenderer.on(channel, (event, ...args) => func(event, ...args));
      }
    },
    removeAllListeners: (channel) => {
      const validChannels = ['flask-port', 'folder-structure']; // List valid channels
      if (validChannels.includes(channel)) {
        ipcRenderer.removeAllListeners(channel);
      }
    }
  }
});
