const { app, BrowserWindow } = require('electron');
const path = require('path');
const { createServer } = require('http');
const next = require('next');
const { spawn } = require('child_process');
const fs = require('fs');

let pythonProcess;

function createWindow(url) {
  console.log(`Creating window with URL: ${url}`);
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(app.getAppPath(), 'preload.js'),
      nodeIntegration: true,
      contextIsolation: true // Ensures security
    },
  });

  win.loadURL(url);

  // Open the DevTools optionally
  win.webContents.openDevTools();

  // Handle window close
  win.on('closed', () => {
    if (pythonProcess) {
      pythonProcess.kill();
    }
  });
}

async function waitForNextJsServer() {
  let serverReady = false;
  let startUrl = 'http://localhost:3000';
  const ports = [3000, 3001, 3002, 3003, 3004];

  const fetch = (await import('node-fetch')).default; // Dynamically import node-fetch

  while (!serverReady) {
    for (const port of ports) {
      try {
        const response = await fetch(`http://localhost:${port}`);
        if (response.ok) {
          startUrl = `http://localhost:${port}`;
          serverReady = true;
          break;
        }
      } catch (error) {
        console.log(`Waiting for Next.js server on port ${port}...`);
      }
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  console.log(`Next.js server is ready at ${startUrl}.`);
  return startUrl;
}

app.whenReady().then(async () => {
  const nextConfigPath = path.join(process.resourcesPath, 'next.config.mjs');
  console.log(`Next config path: ${nextConfigPath}`);
  if (!fs.existsSync(nextConfigPath)) {
    console.error('Next.js config file is missing. Please ensure that next.config.mjs is included in the package.');
    app.quit();
    return;
  }

  const nextAppPath = path.join(app.getAppPath(), '.next');
  console.log(`Next.js path: ${nextAppPath}`);

  if (process.env.NODE_ENV === 'production' && !fs.existsSync(nextAppPath)) {
    console.error('Next.js build files are missing. Please ensure that .next folder is included in the package.');
    app.quit();
    return;
  }

  const nextApp = next({ dev: false, dir: path.join(app.getAppPath()) });
  await nextApp.prepare();
  const nextHandler = nextApp.getRequestHandler();

  const server = createServer((req, res) => {
    return nextHandler(req, res);
  });

  server.listen(3000, (err) => {
    if (err) throw err;
    console.log('> Ready on http://localhost:3000');
  });

  const startUrl = 'http://localhost:3000';

  const appPath = process.resourcesPath || app.getAppPath();
  const pythonPath = process.platform === 'win32' 
    ? path.join(appPath, 'env', 'Scripts', 'python.exe') 
    : path.join(appPath, 'env', 'bin', 'python3'); 

  console.log(`Python path: ${pythonPath}`);
  const serverScriptPath = path.join(appPath, 'backend', 'server.py');
  console.log(`Server script path: ${serverScriptPath}`);

  if (!fs.existsSync(pythonPath)) {
    console.error('Python executable not found:', pythonPath);
    app.quit();
    return;
  }
  
  if (!fs.existsSync(serverScriptPath)) {
    console.error('Server script not found:', serverScriptPath);
    app.quit();
    return;
  }

  pythonProcess = spawn(pythonPath, [serverScriptPath], { cwd: path.join(appPath, 'backend') });

  pythonProcess.stdout.on('data', (data) => {
    console.log(`stdout: ${data}`);
  });

  pythonProcess.stderr.on('data', (data) => {
    console.error(`stderr: ${data}`);
  });

  pythonProcess.on('close', (code) => {
    console.log(`Python server exited with code ${code}`);
  });

  createWindow(startUrl);

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow(startUrl);
  });
});

app.on('window-all-closed', function () {
  if (pythonProcess) {
    pythonProcess.kill();
  }
  if (process.platform !== 'darwin') app.quit();
});
