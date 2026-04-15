const path = require('node:path');
const { app, BrowserWindow, shell, ipcMain } = require('electron');
const { autoUpdater } = require('electron-updater');

const version = app.getVersion();
const isDev = Boolean(process.env.ELECTRON_RENDERER_URL);
const assetsDir = path.join(__dirname, '..', 'src', 'assets');
const appIconPath = path.join(assetsDir, 'app-icon.png');
const brandLogoPath = path.join(assetsDir, 'brand-logo.png');
const splashHtml = path.join(assetsDir, 'splash.html');
const SPLASH_MIN_MS = 2000;

let mainWindow = null;
let splashWindow = null;
let splashStartTime = 0;

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
    icon: appIconPath,
    backgroundColor: '#0b1220',
    webPreferences: {
      devTools: false,
    },
  });

  splashWindow.once('ready-to-show', () => {
    splashWindow.show();
  });

  splashWindow.loadFile(splashHtml, {query: {version}}).then();
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
    icon: appIconPath,
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
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL).then();
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html')).then();
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url).then();
    return { action: 'deny' };
  });

  mainWindow.webContents.on('did-fail-load', () => {
    closeSplashAndShowMain();
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

autoUpdater.checkForUpdatesAndNotify().then();

ipcMain.handle('app:get-version', () => app.getVersion());


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
      detail: 'Restart the app to install the update.'
    });

    if (result.response === 0) {
      autoUpdater.quitAndInstall();
    }
  });
}

app.whenReady().then(() => {
  setupAutoUpdate();
  autoUpdater.checkForUpdatesAndNotify().then();
});

app.setAppUserModelId('com.bromcom.testbuilder');