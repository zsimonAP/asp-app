const { app, BrowserWindow } = require('electron');
const path = require('path');
const { createServer } = require('http');
const next = require('next');
const { spawn, execSync } = require('child_process');
const fs = require('fs');
const { autoUpdater } = require('electron-updater');
const log = require('electron-log');

// Setup logging
autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = 'info';
log.info('App starting...');

let pythonProcess;

function createWindow(url) {
  log.info(`Creating window with URL: ${url}`);
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

function waitForNextJsServer(port = 3000) {
  return new Promise((resolve) => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`http://localhost:${port}`);
        if (response.ok) {
          clearInterval(interval);
          log.info(`Next.js server is ready at http://localhost:${port}.`);
          resolve(`http://localhost:${port}`);
        }
      } catch (error) {
        log.info(`Waiting for Next.js server on port ${port}...`);
      }
    }, 1000);
  });
}

function killPort(port) {
  try {
    log.info(`Killing process on port ${port}...`);
    const platform = process.platform;
    let command;

    if (platform === 'win32') {
      command = `netstat -ano | findstr :${port}`;
      const processOutput = execSync(command).toString();
      const pid = processOutput.split(/\s+/)[4];
      execSync(`taskkill /PID ${pid} /F`);
    } else {
      command = `lsof -ti:${port}`;
      const processOutput = execSync(command).toString().trim();
      if (processOutput) {
        execSync(`kill -9 ${processOutput}`);
      }
    }

    log.info(`Killed process on port ${port}.`);
  } catch (err) {
    log.error(`Failed to kill process on port ${port}: ${err.message}`);
  }
}

app.whenReady().then(async () => {
  const nextConfigPath = path.join(process.resourcesPath, 'next.config.mjs');
  log.info(`Next config path: ${nextConfigPath}`);
  if (!fs.existsSync(nextConfigPath)) {
    log.error('Next.js config file is missing. Please ensure that next.config.mjs is included in the package.');
    app.quit();
    return;
  }

  const nextAppPath = path.join(app.getAppPath(), '.next');
  log.info(`Next.js path: ${nextAppPath}`);

  if (process.env.NODE_ENV === 'production' && !fs.existsSync(nextAppPath)) {
    log.error('Next.js build files are missing. Please ensure that .next folder is included in the package.');
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
    log.info('> Ready on http://localhost:3000');
  });

  const appPath = process.resourcesPath || app.getAppPath();
  const pythonPath = process.platform === 'win32' 
    ? path.join(appPath, 'env_win', 'Scripts', 'python.exe') 
    : path.join(appPath, 'env', 'bin', 'python3'); 

  log.info(`Python path: ${pythonPath}`);
  const serverScriptPath = path.join(appPath, 'backend', 'server.py');
  log.info(`Server script path: ${serverScriptPath}`);

  if (!fs.exists(pythonPath)) {
    log.error('Python executable not found:', pythonPath);
    app.quit();
    return;
  }
 
  if (!fs.exists(serverScriptPath)) {
    log.error('Server script not found:', serverScriptPath);
    app.quit();
    return;
  }

  // Kill any process using port 5001
  killPort(5001);

  // Activate the virtual environment and start the Python server
  const activateCommand = process.platform === 'win32' 
    ? `${path.join(appPath, 'env_win', 'Scripts', 'activate')}`
    : `source ${path.join(appPath, 'env', 'bin', 'activate')}`;
 
  const activateScript = process.platform === 'win32' 
    ? `cmd.exe /c ${activateCommand} && ${pythonPath} ${serverScriptPath}`
    : `bash -c "${activateCommand} && exec ${pythonPath} ${serverScriptPath}"`;

  pythonProcess = spawn(activateScript, [], { shell: true });

  pythonProcess.stdout.on('data', (data) => {
    log.info(`stdout: ${data}`);
  });

  pythonProcess.stderr.on('data', (data) => {
    log.error(`stderr: ${data}`);
  });

  pythonProcess.on('close', (code) => {
    log.info(`Python server exited with code ${code}`);
  });

  const startUrl = await waitForNextJsServer(3000); // Ensure the Next.js server is ready before creating the window
  createWindow(startUrl);

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow(startUrl);
  });

  // Check for updates after the window is created
  autoUpdater.checkForUpdatesAndNotify();
});

app.on('window-all-closed', function () {
  if (pythonProcess) {
    pythonProcess.kill();
  }
  if (process.platform !== 'darwin') app.quit();
});

// Event handlers for the updater
autoUpdater.on('update-available', () => {
  log.info('Update available.');
});

autoUpdater.on('update-downloaded', (info) => {
  log.info('Update downloaded');
  autoUpdater.quitAndInstall();
});
