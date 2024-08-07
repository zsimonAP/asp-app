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
  win.on('closed', async () => {
    if (pythonProcess) {
      pythonProcess.kill();
    }
    await shutdownFlaskServer(); // Shutdown Flask server
    killPort(5001); // Kill tasks on port 5001 when the window is closed
  });
}

const fetch = require('node-fetch');

async function shutdownFlaskServer() {
  try {
    await fetch('http://localhost:5001/shutdown', { method: 'POST' });
    log.info('Flask server shutdown initiated.');
  } catch (error) {
    log.error(`Failed to shutdown Flask server: ${error.message}`);
  }
}

async function waitForNextJsServer(port = 3000) {
  return new Promise((resolve, reject) => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`http://localhost:${port}`);
        if (response.ok) {
          clearInterval(interval);
          resolve(`http://localhost:${port}`);
        }
      } catch (error) {
        log.info(`Waiting for Next.js server on port ${port}...`);
      }
    }, 1000);
    setTimeout(() => {
      clearInterval(interval);
      reject(new Error("Next.js server did not start in time"));
    }, 30000); // Timeout after 30 seconds
  });
}


function killPort(port) {
  try {
    log.info(`Killing process on port ${port}...`);
    const platform = process.platform;

    if (platform === 'win32') {
      const command = `netstat -ano | findstr :${port}`;
      const result = execSync(command).toString().trim();
      if (result) {
        const pid = result.split('\n')[0].split(' ').filter(Boolean).pop();
        if (pid) {
          execSync(`taskkill /PID ${pid} /F`);
        }
      }
    } else {
      const command = `lsof -ti:${port}`;
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

async function startApp() {
  const nextAppPath = path.join(__dirname, '.next');
  log.info(`Checking Next.js build files at: ${nextAppPath}`);

  if (process.env.NODE_ENV === 'production' && !fs.existsSync(nextAppPath)) {
    log.error('Next.js build files are missing. Please ensure that .next folder is included in the package.');
    app.quit();
    return;
  }

  try {
    const nextApp = next({ dev: false, dir: __dirname });

    await nextApp.prepare();
    log.info('Next.js application prepared successfully.');

    const nextHandler = nextApp.getRequestHandler();
    const server = createServer((req, res) => nextHandler(req, res));

    server.listen(3000, (err) => {
      if (err) {
        log.error('Failed to start Next.js server:', err);
        app.quit();
      }
      log.info('> Ready on http://localhost:3000');
    });

    log.info(`App path: ${__dirname}`);

    let pythonPath;
    if (process.env.NODE_ENV === 'production') {
      // Production path
      pythonPath = path.join(process.resourcesPath, 'env', 'Scripts', 'python.exe');
    } else {
      // Development path
      pythonPath = path.join(__dirname, 'env', 'Scripts', 'python.exe');
    }
    
    log.info(`Python path: ${pythonPath}`);
    const serverScriptPath = path.join(process.resourcesPath, 'backend', 'server.py');
    log.info(`Server script path: ${serverScriptPath}`);

    if (!fs.existsSync(pythonPath)) {
      log.error(`Python executable not found at: ${pythonPath}`);
      app.quit();
      return;
    }

    if (!fs.existsSync(serverScriptPath)) {
      log.error(`Server script not found: ${serverScriptPath}`);
      app.quit();
      return;
    }

    try {
      const command = `"${pythonPath}" "${serverScriptPath}"`;
      pythonProcess = spawn(command, { shell: true });

      pythonProcess.stdout.on('data', (data) => {
        log.info(`Python stdout: ${data}`);
      });

      pythonProcess.stderr.on('data', (data) => {
        log.error(`Python stderr: ${data}`);
      });

      pythonProcess.on('error', (err) => {
        log.error(`Python process failed to start: ${err.message}`);
      });

      pythonProcess.on('exit', (code, signal) => {
        log.info(`Python process exited with code ${code} and signal ${signal}`);
      });

      log.info(`Python process started successfully`);
    } catch (error) {
      log.error(`Failed to start Python process: ${error.message}`);
    }

    const startUrl = await waitForNextJsServer(3000);
    createWindow(startUrl);

    app.on('activate', function () {
      if (BrowserWindow.getAllWindows().length === 0) createWindow(startUrl);
    });

    autoUpdater.checkForUpdatesAndNotify();
  } catch (error) {
    log.error(`Failed to prepare Next.js application: ${error.message}`);
    app.quit();
  }
}


app.whenReady().then(startApp);

app.on('window-all-closed', async function () {
  if (pythonProcess) {
    pythonProcess.kill();
  }
  await shutdownFlaskServer(); // Shutdown Flask server
  killPort(5001); // Kill tasks on port 5001 when all windows are closed
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
