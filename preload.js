// preload.js

const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Method to receive the Flask port from the main process
  receiveFlaskPort: (callback) => {
    ipcRenderer.once('flask-port', (event, data) => {
      callback(data);
    });
  },
  
  // Method to send messages from renderer to main process
  sendToMain: (channel, data) => {
    // List of valid channels
    const validChannels = ['renderer-log', 'user-action'];
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, data);
    }
  },

  // Method to receive messages from main process
  receiveFromMain: (channel, callback) => {
    const validChannels = ['update-message', 'another-message'];
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, (event, data) => {
        callback(data);
      });
    }
  },

  // Method to remove listeners (optional)
  removeListener: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  },
});
