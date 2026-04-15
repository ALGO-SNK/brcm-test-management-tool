const path = require('node:path');
const { app, BrowserWindow, shell } = require('electron');

const isDev = Boolean(process.env.ELECTRON_RENDERER_URL);
const assetsDir = path.join(__dirname, 'assets');
const appIconPath = path.join(assetsDir, 'app-icon.ico');
const brandLogoPath = path.join(assetsDir, 'brand-logo.png');
const splashHtml = path.join(assetsDir, 'splash.html');

let mainWindow = null;
let splashWindow = null;

function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 560,
    height: 380,
    frame: false,
    transparent: false,
    resizable: false,
    movable: true,
    minimizable: false,
    maximizable: false,
    show: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    icon: appIconPath,
    webPreferences: {
      devTools: false,
    },
  });

  splashWindow.loadFile(splashHtml);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    show: false,
    autoHideMenuBar: true,
    icon: appIconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.once('ready-to-show', () => {
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.close();
    }
    mainWindow.show();
  });

  if (isDev) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('did-fail-load', () => {
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.close();
    }
    mainWindow.show();
  });
}

app.whenReady().then(() => {
  app.setName('BromCom Desktop');

  if (process.platform === 'darwin' && app.dock) {
    app.dock.setIcon(brandLogoPath);
  }

  createSplashWindow();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
