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
    
    // Create a folder structure
    const folderStructure = {};

    files.forEach((file) => {
      const filePathParts = file.name.split('/');
      const folder = filePathParts[0]; // Top-level folder
      const fileName = filePathParts[1]; // File inside folder

      if (fileName && fileName.endsWith('.py')) {
        if (!folderStructure[folder]) {
          folderStructure[folder] = [];
        }
        folderStructure[folder].push(fileName);
      }
    });

    return folderStructure;
  } catch (error) {
    log.error(`Error fetching folder structure: ${error.message}`);
    throw error;
  }
}

async function downloadPythonFiles() {
  // Use a writable directory, such as the app's userData directory
  const localAppDataPath = process.env.LOCALAPPDATA;
  const destinationDir = path.join(localAppDataPath, 'associated-pension-automation-hub', 'backend', 'scripts');
  
  if (!fs.existsSync(destinationDir)) {
    fs.mkdirSync(destinationDir, { recursive: true });  // Create destination directory if it doesn't exist
  }

  log.info('Listing files in Firebase Storage bucket...');
  
  try {
    const [files] = await bucket.getFiles();

    const firebaseFileNames = files
      .filter(file => file.name.endsWith('.py'))  // Filter Python files
      .map(file => file.name.split('/').pop());

    const localFiles = fs.readdirSync(destinationDir).filter(file => file.endsWith('.py'));

    const filesToDelete = localFiles.filter(localFile => !firebaseFileNames.includes(localFile));
    filesToDelete.forEach(fileToDelete => {
      const filePath = path.join(destinationDir, fileToDelete);
      fs.unlinkSync(filePath);  // Delete the file
      log.info(`Deleted local file: ${fileToDelete}`);
    });

    log.info('Local files not in Firebase have been deleted.');

    const downloadPromises = files
      .filter(file => file.name.endsWith('.py'))
      .map(file => {
        const destinationPath = path.join(destinationDir, file.name.split('/').pop());
        
        if (fs.existsSync(destinationPath)) {
          log.info(`File already exists: ${file.name}. Skipping download.`);
          return Promise.resolve();
        }

        log.info(`Downloading ${file.name} to ${destinationPath}`);

        return new Promise((resolve, reject) => {
          const fileStream = file.createReadStream().pipe(fs.createWriteStream(destinationPath));
          fileStream.on('finish', () => {
            log.info(`Downloaded: ${file.name}`);
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
    log.error(`Error listing or downloading files from Firebase Storage: ${error.message}`);
    throw error;
  }
}

function createWindow(url) {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(app.getAppPath(), 'preload.js'),
      nodeIntegration: true,
      contextIsolation: true, // Ensures security
    },
  });

  mainWindow.loadURL(url);

  // Handle window close
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
  
  await shutdownFlaskServer(); // Shutdown Flask server
  killPort(5001); // Kill tasks on port 5001

  // Ensure all python.exe processes are forcefully killed on Windows
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
      reject(new Error('Next.js server did not start in time'));
    }, 30000); // Timeout after 30 seconds
  });
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

async function startApp() {
  // Step 1: Download all Python files from Firebase before proceeding

  try {
    const folderStructure = await getFolderStructure();
    mainWindow.webContents.send('folder-structure', folderStructure);
  } catch (error) {
    log.error(`Failed to retrieve folder structure: ${error.message}`);
  }


  try {
    await downloadPythonFiles();
    log.info('All Python files downloaded successfully.');
  } catch (error) {
    log.error(`Failed to download Python files: ${error.message}`);
    app.quit();
    return;
  }

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
  await shutdownFlaskServer(); // Shutdown Flask server
  killPort(5001); // Kill tasks on port 5001 when all windows are closed
  if (process.platform !== 'darwin') app.quit();
});