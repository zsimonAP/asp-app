const { contextBridge, ipcRenderer } = require('electron');

// Expose ipcRenderer to the renderer process using contextBridge
contextBridge.exposeInMainWorld('electron', {
  ipcRenderer: {
    send: (channel, data) => {
      // Send messages to the main process
      ipcRenderer.send(channel, data);
    },
    on: (channel, func) => {
      // Receive messages from the main process
      ipcRenderer.on(channel, (event, ...args) => func(event, ...args));
    }
  }
});

// Example to check version numbers (existing functionality)
window.addEventListener('DOMContentLoaded', () => {
  const replaceText = (selector, text) => {
    const element = document.getElementById(selector);
    if (element) element.innerText = text;
  };

  for (const type of ['chrome', 'node', 'electron']) {
    replaceText(`${type}-version`, process.versions[type]);
  }
});
