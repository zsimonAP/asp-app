const { contextBridge, ipcRenderer } = require('electron');
const fs = require('fs');
const path = require('path');

// Expose ipcRenderer, fs, and path to the renderer process using contextBridge
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
  },
  // Expose filesystem operations to renderer
  fs: {
    readFileSync: (filePath, encoding) => fs.readFileSync(filePath, encoding),
    existsSync: (filePath) => fs.existsSync(filePath),
  },
  // Expose path operations to renderer
  path: {
    join: (...args) => path.join(...args),
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
