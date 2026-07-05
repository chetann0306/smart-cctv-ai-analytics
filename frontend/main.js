const { app, BrowserWindow } = require('electron');
const path = require('path');
const { exec } = require('child_process');

let mainWindow;
let pythonBackendProcess;

// Check if running in development mode
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

  // 🚀 Start your Python backend process in the background using absolute windows mapping
  pythonBackendProcess = exec(`"${pythonExecutable}" -m uvicorn backend.main:app --port 8000`, { cwd: rootPath });

  // Pipe internal logging directly into your terminal environment
  pythonBackendProcess.stdout.on('data', (data) => console.log(`[Python Engine]: ${data}`));
  pythonBackendProcess.stderr.on('data', (data) => console.error(`[Python Err]: ${data}`));

  if (isDev) {
    // ⏳ Wait 3 seconds for backend dependencies to initialize smoothly
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

// 🛡️ HARD TREE-KILL EXCLUSION FOR WINDOWS OS PROCESS LEAKS
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    if (pythonBackendProcess) {
      console.log("Purging background AI Engine process tree securely...");
      
      // Forcefully kills the parent shell process AND all running children (uvicorn, opencv, python)
      exec(`taskkill /PID ${pythonBackendProcess.pid} /T /F`, (err) => {
        if (err) console.error("Process clean up warning:", err);
        app.quit();
      });
    } else {
      app.quit();
    }
  }
});