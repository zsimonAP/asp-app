const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { createServer } = require('http');
const next = require('next');
const { spawn, execSync } = require('child_process');
const fs = require('fs');
const { autoUpdater } = require('electron-updater');
const log = require('electron-log');
const fetch = require('node-fetch');

// Setup logging
autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = 'info';
log.info('App starting...');

let pythonProcess;
let mainWindow;
let isUpdateInProgress = false;

// Gracefully stop all processes (Python, Flask, etc.)
async function stopAllProcesses() {
  if (pythonProcess) {
    log.info('Killing Python process...');
    pythonProcess.kill();
  }
  await shutdownFlaskServer(); // Shutdown Flask server
  killPort(5001); // Kill tasks on port 5001
}

async function shutdownFlaskServer() {
  try {
    await fetch('http://localhost:5001/shutdown', { method: 'POST' });
    log.info('Flask server shutdown initiated.');
  } catch (error) {
    log.error(`Failed to shutdown Flask server: ${error.message}`);
  }
}

function killPort(port) {
  try {
    log.info(`Attempting to kill process on port ${port}...`);
    const platform = process.platform;

    if (platform === 'win32') {
      const command = `netstat -ano | findstr :${port}`;
      const result = execSync(command).toString().trim();
      if (result) {
        const pid = result.split('\n')[0].split(' ').filter(Boolean).pop();
        if (pid) {
          execSync(`taskkill /PID ${pid} /F`);
          log.info(`Successfully killed process with PID ${pid} on port ${port}.`);
        }
      }
    } else {
      const command = `lsof -ti:${port}`;
      const processOutput = execSync(command).toString().trim();
      if (processOutput) {
        execSync(`kill -9 ${processOutput}`);
        log.info(`Successfully killed process on port ${port}.`);
      }
    }
  } catch (err) {
    log.error(`Failed to kill process on port ${port}: ${err.message}`);
  }
}

// Check for updates before starting anything else
function checkForUpdates() {
  log.info('Checking for updates...');
  autoUpdater.checkForUpdatesAndNotify();
  
  autoUpdater.on('update-available', () => {
    log.info('Update available. Downloading...');
    isUpdateInProgress = true;
  });

  autoUpdater.on('update-not-available', () => {
    log.info('No updates available.');
    startApp(); // Start the app if no updates
  });

  autoUpdater.on('error', (error) => {
    log.error(`Error checking for updates: ${error.message}`);
    startApp(); // Start the app even if update check failed
  });

  autoUpdater.on('update-downloaded', async () => {
    log.info('Update downloaded. Preparing for installation...');
    
    // Stop all processes before applying update
    await stopAllProcesses();
    
    log.info('All processes stopped, quitting app to install the update.');
    autoUpdater.quitAndInstall();
  });
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

    const appRootPath = process.resourcesPath; // Points to the resources directory

    const pythonHome = path.join(appRootPath, 'env');
    const pythonPath = path.join(pythonHome, 'python.exe');
    const pythonPathEnv = path.join(pythonHome, 'Lib', 'site-packages');

    // Set environment variables
    process.env.PYTHONHOME = pythonHome;
    process.env.PYTHONPATH = pythonPathEnv;
    process.env.PYTHONEXECUTABLE = pythonPath;
    process.env.PYTHONNOUSERSITE = '1';
    process.env.PATH = `${path.dirname(pythonPath)}${path.delimiter}${process.env.PATH}`;

    // Log all relevant paths and environment variables
    log.info(`Python path: ${pythonPath}`);
    log.info(`Python home: ${pythonHome}`);
    log.info(`Python path environment: ${pythonPathEnv}`);
    log.info(`Environment PATH: ${process.env.PATH}`);
    log.info(`Environment PYTHONHOME: ${process.env.PYTHONHOME}`);
    log.info(`Environment PYTHONPATH: ${process.env.PYTHONPATH}`);
    log.info(`Environment PYTHONEXECUTABLE: ${process.env.PYTHONEXECUTABLE}`);

    const serverScriptPath = path.join(appRootPath, 'backend', 'server.py');
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
      log.info('Spawning Python process with the following command:');
      log.info(`Command: ${pythonPath} ${serverScriptPath}`);
      log.info(
        'Environment Variables:',
        JSON.stringify(
          {
            PYTHONHOME: process.env.PYTHONHOME,
            PYTHONPATH: process.env.PYTHONPATH,
            PYTHONEXECUTABLE: process.env.PYTHONEXECUTABLE,
            PATH: process.env.PATH,
          },
          null,
          2
        )
      );

      pythonProcess = spawn(pythonPath, [serverScriptPath], {
        env: {
          ...process.env,
          PYTHONHOME: pythonHome,
          PYTHONPATH: pythonPathEnv,
          PYTHONEXECUTABLE: pythonPath,
          PATH: `${path.dirname(pythonPath)}${path.delimiter}${process.env.PATH}`,
        },
      });

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

      log.info('Python process started successfully');
    } catch (error) {
      log.error(`Failed to start Python process: ${error.message}`);
    }

    const startUrl = await waitForNextJsServer(3000);
    createWindow(startUrl);
  } catch (error) {
    log.error(`Failed to prepare Next.js application: ${error.message}`);
    app.quit();
  }
}

app.whenReady().then(() => {
  checkForUpdates(); // Check for updates before anything else
});

app.on('window-all-closed', async function () {
  if (pythonProcess) {
    log.info('Killing Python process...');
    pythonProcess.kill();
  }
  await shutdownFlaskServer(); // Shutdown Flask server
  killPort(5001); // Kill tasks on port 5001 when all windows are closed
  if (process.platform !== 'darwin') app.quit();
});
