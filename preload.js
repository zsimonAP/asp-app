import { contextBridge, ipcRenderer } from 'electron';
import { readFileSync as _readFileSync, existsSync as _existsSync } from 'fs';
import { join as _join } from 'path';

// Define valid channels for IPC communication
const validChannels = ['flask-port', 'folder-structure'];
console.log('preload.js loaded');

// Expose APIs to the renderer process securely
contextBridge.exposeInMainWorld('electron', {
  // IPC Renderer communication
  ipcRenderer: {
    send: (channel, data) => {
      if (validChannels.includes(channel)) {
        ipcRenderer.send(channel, data);
      } else {
        console.error(`Blocked attempt to send on channel: ${channel}`);
      }
    },
    on: (channel, func) => {
      if (validChannels.includes(channel)) {
        ipcRenderer.on(channel, (event, ...args) => func(...args));
      } else {
        console.error(`Blocked attempt to listen on channel: ${channel}`);
      }
    },
    once: (channel, func) => {
      if (validChannels.includes(channel)) {
        ipcRenderer.once(channel, (event, ...args) => func(...args));
      } else {
        console.error(`Blocked attempt to listen once on channel: ${channel}`);
      }
    }
  },
  
  // File System operations, restricted to essential functions
  fs: {
    readFileSync: (filePath, encoding = 'utf8') => {
      try {
        return _readFileSync(filePath, encoding);
      } catch (error) {
        console.error(`Error reading file at ${filePath}:`, error);
        return null;
      }
    },
    existsSync: (filePath) => {
      try {
        return _existsSync(filePath);
      } catch (error) {
        console.error(`Error checking existence of file at ${filePath}:`, error);
        return false;
      }
    }
  },
  
  // Path operations, exposing only essential methods
  path: {
    join: (...args) => {
      try {
        return _join(...args);
      } catch (error) {
        console.error('Error joining paths:', error);
        return null;
      }
    }
  }
});

// DOM content loaded listener to display version numbers
window.addEventListener('DOMContentLoaded', () => {
  const replaceText = (selector, text) => {
    const element = document.getElementById(selector);
    if (element) element.innerText = text;
  };

  for (const type of ['chrome', 'node', 'electron']) {
    replaceText(`${type}-version`, process.versions[type]);
  }
});
