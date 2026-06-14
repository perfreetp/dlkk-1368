import { app, BrowserWindow } from 'electron';
import path from 'path';
import { databaseManager } from './database';
import { registerIpcHandlers, setMainWindow } from './ipcHandlers';

const isDevelopment = process.env.NODE_ENV === 'development';

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    title: '情侣私密空间',
    frame: false,
    backgroundColor: '#ffffff',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: true,
    },
    show: false,
  });

  setMainWindow(mainWindow);

  mainWindow.once('ready-to-show', () => {
    if (mainWindow) {
      mainWindow.show();
      if (isDevelopment) {
        mainWindow.webContents.openDevTools();
      }
    }
  });

  mainWindow.on('maximize', () => {
    if (mainWindow) {
      mainWindow.webContents.send('window:maximized', true);
    }
  });

  mainWindow.on('unmaximize', () => {
    if (mainWindow) {
      mainWindow.webContents.send('window:maximized', false);
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    setMainWindow(null);
  });

  if (isDevelopment) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(() => {
  databaseManager.init();
  registerIpcHandlers();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  databaseManager.close();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  databaseManager.close();
});

app.on('web-contents-created', (_event, contents) => {
  contents.on('will-navigate', (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl);
    if (isDevelopment && parsedUrl.origin === 'http://localhost:5173') {
      return;
    }
    if (parsedUrl.protocol !== 'file:') {
      event.preventDefault();
    }
  });

  contents.setWindowOpenHandler(({ url }) => {
    const parsedUrl = new URL(url);
    if (isDevelopment && parsedUrl.origin === 'http://localhost:5173') {
      return { action: 'allow' };
    }
    return { action: 'deny' };
  });
});

if (isDevelopment) {
  console.log('开发模式已启动，可手动打开开发者工具');
}
