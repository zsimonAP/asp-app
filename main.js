const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { createServer } = require('http');
const next = require('next');
const { spawn, execSync } = require('child_process');
const fs = require('fs');
const { autoUpdater } = require('electron-updater');
const log = require('electron-log');
const fetch = require('node-fetch');
const firebaseAdmin = require('firebase-admin');

// Setup logging
autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = 'info';
log.info('App starting...');

let pythonProcess;
let mainWindow;
let isUpdateInProgress = false;
let flaskPort, websocketPort; // Ports for Flask and WebSocket

// Define the path to the Firebase credentials file
const serviceAccountPath = app.isPackaged
  ? path.join(process.resourcesPath, 'firebase-credentials.json')  // When the app is packaged
  : path.join(__dirname, 'firebase-credentials.json');              // During development

let serviceAccount = null;

try {
  if (fs.existsSync(serviceAccountPath)) {
    serviceAccount = require(serviceAccountPath);
    log.info('Firebase credentials loaded successfully.');
  } else {
    log.error('Firebase credentials file not found.');
    app.quit();
  }
} catch (error) {
  log.error('Error loading Firebase credentials:', error);
  app.quit();
}

firebaseAdmin.initializeApp({
  credential: firebaseAdmin.credential.cert(serviceAccount),
  storageBucket: 'gs://asp-app-36e09.appspot.com', // Replace with your Firebase project ID
});

const bucket = firebaseAdmin.storage().bucket();

async function getFolderStructure() {
  log.info('Fetching folder structure from Firebase Storage...');
  
  try {
    const [files] = await bucket.getFiles();
    log.info(`Fetched ${files.length} files from Firebase.`);

    const folderStructure = {};
    files.forEach((file) => {
      const filePathParts = file.name.split('/');
      const folder = filePathParts[0];
      const fileName = filePathParts.slice(1).join('/');
      log.info(`Processing file: ${file.name} (Folder: ${folder}, File: ${fileName})`);

      if (fileName && fileName.endsWith('.py')) {
        if (!folderStructure[folder]) {
          log.info(`Creating folder entry for: ${folder}`);
          folderStructure[folder] = [];
        }
        folderStructure[folder].push(fileName);
      }
    });

    log.info('Folder structure created successfully.');
    return folderStructure;
  } catch (error) {
    log.error(`Error fetching folder structure: ${error.message}`);
    throw error;
  }
}

async function downloadPythonFiles() {
  const localAppDataPath = process.env.LOCALAPPDATA;
  const destinationDir = path.join(localAppDataPath, 'associated-pension-automation-hub', 'backend', 'scripts');

  if (!fs.existsSync(destinationDir)) {
    log.info(`Creating destination directory: ${destinationDir}`);
    fs.mkdirSync(destinationDir, { recursive: true });
  }

  log.info('Listing files in Firebase Storage bucket...');
  
  try {
    const [files] = await bucket.getFiles();
    log.info(`Found ${files.length} files in the bucket.`);

    const downloadPromises = files.map(file => {
      const destinationPath = path.join(destinationDir, file.name);
      const destinationFolder = path.dirname(destinationPath);
    
      if (file.name.endsWith('/')) {
        log.info(`Skipping download for folder: ${file.name}`);
        return Promise.resolve();  // Skip this folder
      }
    
      if (!fs.existsSync(destinationFolder)) {
        log.info(`Creating directory: ${destinationFolder}`);
        fs.mkdirSync(destinationFolder, { recursive: true });
      }
    
      if (fs.existsSync(destinationPath)) {
        log.info(`File already exists: ${file.name}. Skipping download.`);
        return Promise.resolve();
      }
    
      log.info(`Starting download for: ${file.name} to ${destinationPath}`);
    
      return new Promise((resolve, reject) => {
        const fileStream = file.createReadStream().pipe(fs.createWriteStream(destinationPath));
        fileStream.on('finish', () => {
          log.info(`Downloaded successfully: ${file.name}`);
          resolve();
        });
        fileStream.on('error', (err) => {
          log.error(`Failed to download ${file.name}: ${err.message}`);
          reject(err);
        });
      });
    });

    await Promise.all(downloadPromises);
    log.info('All Python files downloaded successfully.');
  } catch (error) {
    log.error(`Error during file download: ${error.message}`);
    throw error;
  }
}

function createWindow(url) {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 1000,
    icon: path.join(app.getAppPath(), 'app-icon.ico'),
    webPreferences: {
      preload: path.join(app.getAppPath(), 'preload.js'),
      nodeIntegration: true,
      contextIsolation: true, // Ensures security
    },
  });

  mainWindow.loadURL(url);

  mainWindow.on('closed', async () => {
    await stopAllProcesses(); // Gracefully stop all processes
  });
}

// Gracefully stop all processes (Python, Flask, etc.)
async function stopAllProcesses() {
  if (pythonProcess) {
    log.info('Killing Python process...');
    pythonProcess.kill();
  }
  
  await shutdownFlaskServer();
  killPort(flaskPort);

  try {
    if (process.platform === 'win32') {
      log.info('Attempting to forcefully kill all python.exe processes...');
      execSync('taskkill /F /IM python.exe');
      log.info('Successfully killed all python.exe processes.');
    }
  } catch (error) {
    log.error(`Failed to kill python.exe processes: ${error.message}`);
  }
}

async function shutdownFlaskServer() {
  try {
    await fetch(`http://localhost:${flaskPort}/shutdown`, { method: 'POST' });
    log.info('Flask server shutdown initiated.');
  } catch (error) {
    log.error(`Failed to shutdown Flask server: ${error.message}`);
  }
}

function deleteDirectory(directoryPath) {
  if (fs.existsSync(directoryPath)) {
    fs.readdirSync(directoryPath).forEach((file) => {
      const currentPath = path.join(directoryPath, file);
      if (fs.lstatSync(currentPath).isDirectory()) {
        deleteDirectory(currentPath);
      } else {
        fs.unlinkSync(currentPath);
      }
    });
    fs.rmdirSync(directoryPath); // Remove the empty directory
    log.info(`Deleted directory: ${directoryPath}`);
  } else {
    log.warn(`Directory not found: ${directoryPath}`);
  }
}

function getPortsFromConfig() {
  const configPath = path.join(process.env.LOCALAPPDATA, 'associated-pension-automation-hub', 'config.json');
  
  if (fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    return { flaskPort: config.flask_port, websocketPort: config.websocket_port };
  } else {
    log.error('Config file not found.');
    return null;
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

    const folderStructure = await getFolderStructure();
    const startUrl = await waitForNextJsServer(3000);
    createWindow(startUrl);

    mainWindow.webContents.once('did-finish-load', () => {
      mainWindow.webContents.send('folder-structure', folderStructure);
    });

    await downloadPythonFiles();

    log.info('App started successfully.');
  } catch (error) {
    log.error(`Failed to start the app: ${error.message}`);
    app.quit();
  }

    const appRootPath = process.resourcesPath; // Points to the resources directory

    const pythonHome = path.join(appRootPath, 'env');
    const pythonPath = path.join(pythonHome, 'python.exe');
    const pythonPathEnv = path.join(pythonHome, 'Lib', 'site-packages');

    process.env.PYTHONHOME = pythonHome;
    process.env.PYTHONPATH = pythonPathEnv;
    process.env.PYTHONEXECUTABLE = pythonPath;
    process.env.PYTHONNOUSERSITE = '1';
    process.env.PATH = `${path.dirname(pythonPath)}${path.delimiter}${process.env.PATH}`;

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

      // After Python process starts, read the ports from config.json
      const ports = getPortsFromConfig();
      if (ports) {
        flaskPort = ports.flaskPort;
        websocketPort = ports.websocketPort;
        log.info(`Flask server running on port: ${flaskPort}`);
        log.info(`WebSocket server running on port: ${websocketPort}`);
      }
    } catch (error) {
      log.error(`Failed to start Python process: ${error.message}`);
    }
}

let appStarted = false;  // Flag to ensure app only starts once

function checkForUpdates() {
  log.info('Checking for updates...');
  autoUpdater.checkForUpdatesAndNotify();
  
  autoUpdater.on('update-available', () => {
    log.info('Update available. Downloading...');
    isUpdateInProgress = true;
  });

  autoUpdater.on('update-not-available', () => {
    log.info('No updates available.');
    if (!appStarted) {
      appStarted = true;
      startApp();  // Start the app if no updates
    }
  });

  autoUpdater.on('error', (error) => {
    log.error(`Error checking for updates: ${error.message}`);
    if (!appStarted) {
      appStarted = true;
      startApp();  // Start the app even if update check failed
    }
  });

  autoUpdater.on('update-downloaded', async () => {
    log.info('Update downloaded. Preparing for installation...');
    
    // Stop all processes before applying update
    await stopAllProcesses();
    
    log.info('All processes stopped, quitting app to install the update.');
    autoUpdater.quitAndInstall();
  });

  // Fallback: If no update mechanism is triggered, start the app after 5 seconds
  setTimeout(() => {
    if (!isUpdateInProgress && !appStarted) {
      log.info('No update in progress. Starting the app...');
      appStarted = true;
      startApp();
    }
  }, 5000);  // Start app if no update is detected after 5 seconds
}

app.whenReady().then(() => {
  checkForUpdates(); // Check for updates first
});

app.on('window-all-closed', async function () {
  if (pythonProcess) {
    log.info('Killing Python process...');
    pythonProcess.kill();
  }
  await shutdownFlaskServer();
  killPort(flaskPort);

  const localAppDataPath = process.env.LOCALAPPDATA;
  const destinationDir = path.join(localAppDataPath, 'associated-pension-automation-hub', 'backend', 'scripts');
  
  log.info(`Deleting all files and folders in: ${destinationDir}`);
  deleteDirectory(destinationDir);

  if (process.platform !== 'darwin') app.quit();
});
