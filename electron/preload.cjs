const { contextBridge, ipcRenderer } = require('electron');
const pkg = require('../package.json');

contextBridge.exposeInMainWorld('desktop', {
  versions: {
    chrome: process.versions.chrome,
    electron: process.versions.electron,
    node: process.versions.node,
    version: pkg.version,
  },
  setUnsavedChanges(source, isDirty) {
    ipcRenderer.send('app:set-unsaved-changes', {
      source,
      isDirty: Boolean(isDirty),
    });
  },
  onWindowCloseRequested(callback) {
    if (typeof callback !== 'function') {
      return () => {};
    }

    const listener = () => {
      callback();
    };

    ipcRenderer.on('app:window-close-requested', listener);
    return () => {
      ipcRenderer.removeListener('app:window-close-requested', listener);
    };
  },
  respondToWindowClose(shouldClose) {
    ipcRenderer.send('app:window-close-response', {
      shouldClose: Boolean(shouldClose),
    });
  },
  selectDirectory(options) {
    return ipcRenderer.invoke('desktop:select-directory', options ?? {});
  },
  listDirectory(targetPath) {
    return ipcRenderer.invoke('desktop:list-directory', targetPath);
  },
  findTestMethod(rootPath, methodName) {
    return ipcRenderer.invoke('desktop:find-test-method', rootPath, methodName);
  },
  getGitBranch(targetPath) {
    return ipcRenderer.invoke('desktop:get-git-branch', targetPath);
  },
  switchGitBranch(targetPath, targetBranch) {
    return ipcRenderer.invoke('desktop:switch-git-branch', targetPath, targetBranch);
  },
  runDbUpdater(settings, options) {
    return ipcRenderer.invoke('desktop:run-db-updater', settings, options);
  },
  syncDbUpdaterTestCase(settings, payload) {
    return ipcRenderer.invoke('desktop:sync-db-updater-test-case', settings, payload);
  },
  getDbUpdaterOverview(settings) {
    return ipcRenderer.invoke('desktop:get-db-updater-overview', settings);
  },
  onDbUpdaterProgress(callback) {
    if (typeof callback !== 'function') {
      return () => {};
    }

    const listener = (_event, payload) => {
      callback(payload);
    };

    ipcRenderer.on('desktop:db-updater-progress', listener);
    return () => {
      ipcRenderer.removeListener('desktop:db-updater-progress', listener);
    };
  },
  readTextFile(targetPath) {
    return ipcRenderer.invoke('desktop:read-text-file', targetPath);
  },
  writeTextFile(targetPath, content) {
    return ipcRenderer.invoke('desktop:write-text-file', targetPath, content);
  },
});
