const { app, BrowserWindow } = require('electron');
const path = require('path');
const { exec } = require('child_process');

let mainWindow;
let pythonBackendProcess;

const isDev = !app.isPackaged;

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

  // 📂 Anchor paths exactly to the parent directory where venv lives
  const rootPath = path.join(__dirname, '..'); 
  const pythonExecutable = path.join(rootPath, 'venv', 'Scripts', 'python.exe');

  // 🚀 Start your Python backend using clean, explicit parameters
  pythonBackendProcess = exec(`"${pythonExecutable}" -m uvicorn backend.main:app --port 8000`, { cwd: rootPath });

  pythonBackendProcess.stdout.on('data', (data) => console.log(`[Python Engine]: ${data}`));
  pythonBackendProcess.stderr.on('data', (data) => console.error(`[Python Err]: ${data}`));

  if (isDev) {
    // ⏳ Allow 3 seconds for backend dependencies to initialize smoothly
    setTimeout(() => {
      mainWindow.loadURL('http://localhost:5173');
    }, 3000);
  } else {
    mainWindow.loadURL(`file://${path.join(__dirname, '../dist/index.html')}`);
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    if (pythonBackendProcess) {
      console.log("Shutting down background Python AI Engine...");
      pythonBackendProcess.kill();
    }
    app.quit();
  }
});