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
    killPort(5001); // Kill tasks on port 5001 when the window is closed
  });
}

async function waitForNextJsServer(port = 3000) {
  const fetch = (await import('node-fetch')).default;
  return new Promise((resolve, reject) => {
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
      const scriptPath = path.join(app.getAppPath(), 'kill_port_5001.bat');
      execSync(`cmd.exe /c .\\kill_port_5001.bat`, { cwd: path.dirname(scriptPath) });
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

app.whenReady().then(async () => {
  const nextConfigPath = path.join(app.getAppPath(), 'next.config.mjs');
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

  try {
    await nextApp.prepare();
    log.info('Next.js application prepared successfully.');
  } catch (error) {
    log.error('Failed to prepare Next.js application:', error);
    app.quit();
    return;
  }

  const nextHandler = nextApp.getRequestHandler();
  const server = createServer((req, res) => nextHandler(req, res));

  server.listen(3000, (err) => {
    if (err) {
      log.error('Failed to start Next.js server:', err);
      app.quit();
    }
    log.info('> Ready on http://localhost:3000');
  });

  log.info(`App path: ${app.getAppPath()}`);
  const pythonPath = process.platform === 'win32' 
    ? path.join(app.getAppPath(), 'env', 'Scripts', 'python.exe') 
    : path.join(app.getAppPath(), 'env', 'bin', 'python3'); 

  log.info(`Python path: ${pythonPath}`);
  const serverScriptPath = path.join(app.getAppPath(), 'backend', 'server.py');
  log.info(`Server script path: ${serverScriptPath}`);

  if (!fs.existsSync(pythonPath)) {
    log.error(`Python executable not found: ${pythonPath}`);
    app.quit();
    return;
  }

  if (!fs.existsSync(serverScriptPath)) {
    log.error(`Server script not found: ${serverScriptPath}`);
    app.quit();
    return;
  }

  // Kill any process using port 5001
  killPort(5001);

  // Directly run the Python script using the virtual environment's Python executable
  pythonProcess = spawn(pythonPath, [serverScriptPath], { shell: true });

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

  try {
    const startUrl = await waitForNextJsServer(3000); // Ensure the Next.js server is ready before creating the window
    createWindow(startUrl);
  } catch (error) {
    log.error(error.message);
    app.quit();
  }

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
