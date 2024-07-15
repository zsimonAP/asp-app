const { app, BrowserWindow } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let pythonProcess;
let websocketProcess;

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
    if (websocketProcess) {
      websocketProcess.kill();
    }
  });
}

app.whenReady().then(async () => {
  const { default: fetch } = await import('node-fetch'); // Dynamic import of node-fetch

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

  // Wait for the server to start and get the WebSocket port
  let websocketPort;
  while (!websocketPort) {
    try {
      const response = await fetch('http://localhost:5001/get-websocket-port');
      const data = await response.json();
      websocketPort = data.port;
    } catch (error) {
      console.error('Error fetching WebSocket port:', error);
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log(`WebSocket server running on port ${websocketPort}`);

  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (pythonProcess) {
    pythonProcess.kill();
  }
  if (websocketProcess) {
    websocketProcess.kill();
  }
  if (process.platform !== 'darwin') app.quit();
});
