const fs = require('node:fs');
const path = require('node:path');
const { app, BrowserWindow, shell, ipcMain, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');

const APP_ID = 'com.bromcom.testbuilder';
const PRODUCT_NAME = 'Bromcom Test Builder';
const SPLASH_MIN_MS = 2000;
const isDev = Boolean(process.env.ELECTRON_RENDERER_URL);
const version = app.getVersion();

let mainWindow = null;
let splashWindow = null;
let splashStartTime = 0;

function resolveAssetFile(fileNames) {
  const names = Array.isArray(fileNames) ? fileNames : [fileNames];
  const assetDirs = [
    path.join(__dirname, '..', 'src', 'assets'),
    path.join(process.resourcesPath || '', 'src', 'assets'),
    path.join(process.cwd(), 'src', 'assets'),
  ];

  for (const dir of assetDirs) {
    for (const name of names) {
      const fullPath = path.join(dir, name);
      if (fs.existsSync(fullPath)) {
        return fullPath;
      }
    }
  }

  return null;
}

const iconCandidates = process.platform === 'win32'
  ? ['app-icon.ico', 'app-icon.png', 'brand-logo.png']
  : ['app-icon.png', 'brand-logo.png', 'app-icon.ico'];

const appIconPath = resolveAssetFile(iconCandidates);
const brandLogoPath = resolveAssetFile(['brand-logo.png', 'Bromcom_logo.svg', 'app-icon.png', 'app-icon.ico']);
const splashHtmlPath = resolveAssetFile('splash.html');

function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 560,
    height: 380,
    frame: false,
    resizable: false,
    movable: true,
    minimizable: false,
    maximizable: false,
    show: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    icon: appIconPath || undefined,
    backgroundColor: '#0b1220',
    webPreferences: {
      devTools: false,
    },
  });

  splashWindow.once('ready-to-show', () => {
    splashWindow.show();
  });

  if (splashHtmlPath) {
    splashWindow.loadFile(splashHtmlPath, { query: { version } }).catch(() => {});
  } else {
    splashWindow.loadURL('data:text/html,<body style="background:#0b1220;color:#fff;font-family:Segoe UI,sans-serif;display:flex;align-items:center;justify-content:center;">Loading...</body>').catch(() => {});
  }

  splashStartTime = Date.now();
}

function closeSplashAndShowMain() {
  const elapsed = Date.now() - splashStartTime;
  const remaining = Math.max(0, SPLASH_MIN_MS - elapsed);

  setTimeout(() => {
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.close();
    }

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
    }
  }, remaining);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    show: false,
    autoHideMenuBar: true,
    icon: appIconPath || undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.once('ready-to-show', () => {
    closeSplashAndShowMain();
  });

  if (isDev) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL).catch(() => {});
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html')).catch(() => {});
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url).catch(() => {});
    return { action: 'deny' };
  });

  mainWindow.webContents.on('did-fail-load', () => {
    closeSplashAndShowMain();
  });
}

function setupAutoUpdate() {
  autoUpdater.logger = console;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => {
    console.log('Checking for update...');
  });

  autoUpdater.on('update-available', (info) => {
    console.log('Update available:', info.version);
  });

  autoUpdater.on('update-not-available', (info) => {
    console.log('No update available:', info.version);
  });

  autoUpdater.on('error', (err) => {
    console.error('Auto-update error:', err);
  });

  autoUpdater.on('download-progress', (progress) => {
    console.log(`Download: ${Math.round(progress.percent)}%`);
  });

  autoUpdater.on('update-downloaded', async (info) => {
    const result = await dialog.showMessageBox({
      type: 'info',
      buttons: ['Restart now', 'Later'],
      defaultId: 0,
      cancelId: 1,
      title: 'Update ready',
      message: `Version ${info.version} has been downloaded.`,
      detail: 'Restart the app to install the update.',
    });

    if (result.response === 0) {
      autoUpdater.quitAndInstall();
    }
  });
}

app.setAppUserModelId(APP_ID);

app.whenReady().then(() => {
  app.setName(PRODUCT_NAME);

  if (process.platform === 'darwin' && app.dock && brandLogoPath) {
    app.dock.setIcon(brandLogoPath);
  }

  createSplashWindow();
  createWindow();

  setupAutoUpdate();
  autoUpdater.checkForUpdatesAndNotify().catch((error) => {
    console.error('Initial auto-update check failed:', error);
  });

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

ipcMain.handle('app:get-version', () => app.getVersion());
