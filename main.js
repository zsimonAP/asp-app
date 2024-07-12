const { app, BrowserWindow } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let pythonProcess;

function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: true,
    },
  });

  win.loadURL('http://localhost:3000');

  // Open the DevTools.
  // win.webContents.openDevTools();

  // Handle window close
  win.on('closed', () => {
    if (pythonProcess) {
      pythonProcess.kill();
    }
  });
}

app.whenReady().then(() => {
  // Path to the Python executable in the virtual environment
  const pythonPath = process.platform === 'win32' 
    ? path.join(__dirname, 'env', 'Scripts', 'python.exe') 
    : path.join(__dirname, 'env', 'bin', 'python');

  // Path to the server script
  const serverScriptPath = path.join(__dirname, 'backend', 'server.py');

  // Start Python server
  pythonProcess = spawn(pythonPath, [serverScriptPath], { cwd: path.join(__dirname, 'backend') });

  pythonProcess.stdout.on('data', (data) => {
    console.log(`stdout: ${data}`);
  });

  pythonProcess.stderr.on('data', (data) => {
    console.error(`stderr: ${data}`);
  });

  pythonProcess.on('close', (code) => {
    console.log(`Python server exited with code ${code}`);
  });

  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (pythonProcess) {
    pythonProcess.kill();
  }
  if (process.platform !== 'darwin') app.quit();
});
