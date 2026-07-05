const { app, BrowserWindow } = require('electron');
const path = require('path');
const { exec } = require('child_process');
const http = require('http');

let mainWindow;
let pythonBackendProcess;

const isDev = !app.isPackaged;

function startBackend() {
  const rootPath = path.join(__dirname, '..'); 
  const pythonExecutable = path.join(rootPath, 'venv', 'Scripts', 'python.exe');

  // Check if port 8000 is already active before trying to launch a new process
  const checkRequest = http.get('http://127.0.0.1:8000/', (res) => {
    console.log("[Electron Core]: Backend engine already running on port 8000. Skipping duplicate spawn.");
  });

  checkRequest.on('error', () => {
    console.log("[Electron Core]: Port 8000 free. Spawning background Python AI Engine...");
    pythonBackendProcess = exec(`"${pythonExecutable}" -m uvicorn backend.main:app --port 8000`, { cwd: rootPath });

    pythonBackendProcess.stdout.on('data', (data) => console.log(`[Python Engine]: ${data}`));
    pythonBackendProcess.stderr.on('data', (data) => console.error(`[Python Err]: ${data}`));
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: "AURA AI - Crisis Command Platform",
    backgroundColor: '#020617',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  // Start the background engine securely
  startBackend();

  if (isDev) {
    // Wait 3 seconds on cold launch for servers to clear ports
    setTimeout(() => {
      if (mainWindow) mainWindow.loadURL('http://localhost:5173');
    }, 3000);
  } else {
    mainWindow.loadURL(`file://${path.join(__dirname, '../dist/index.html')}`);
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

// Hard taskkill sequence to cleanly turn off camera hardware and clear memory on close
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    if (pythonBackendProcess) {
      console.log("Purging background AI Engine process tree securely...");
      exec(`taskkill /PID ${pythonBackendProcess.pid} /T /F`, () => {
        app.quit();
      });
    } else {
      app.quit();
    }
  }
});