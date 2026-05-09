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
  getGitStatus(targetPath) {
    return ipcRenderer.invoke('desktop:get-git-status', targetPath);
  },
  gitAdd(targetPath, filePaths) {
    return ipcRenderer.invoke('desktop:git-add', targetPath, filePaths);
  },
  gitUnstage(targetPath, filePaths) {
    return ipcRenderer.invoke('desktop:git-unstage', targetPath, filePaths);
  },
  gitCommit(targetPath, message) {
    return ipcRenderer.invoke('desktop:git-commit', targetPath, message);
  },
  gitPush(targetPath) {
    return ipcRenderer.invoke('desktop:git-push', targetPath);
  },
  gitPull(targetPath) {
    return ipcRenderer.invoke('desktop:git-pull', targetPath);
  },
  gitFetch(targetPath) {
    return ipcRenderer.invoke('desktop:git-fetch', targetPath);
  },
  gitSync(targetPath) {
    return ipcRenderer.invoke('desktop:git-sync', targetPath);
  },
  gitDiscard(targetPath, filePaths) {
    return ipcRenderer.invoke('desktop:git-discard', targetPath, filePaths);
  },
  gitStash(targetPath, payload) {
    return ipcRenderer.invoke('desktop:git-stash', targetPath, payload);
  },
  gitStashPop(targetPath, payload) {
    return ipcRenderer.invoke('desktop:git-stash-pop', targetPath, payload);
  },
  gitListStashes(targetPath) {
    return ipcRenderer.invoke('desktop:git-list-stashes', targetPath);
  },
  runDbUpdater(settings, options) {
    return ipcRenderer.invoke('desktop:run-db-updater', settings, options);
  },
  syncDbUpdaterTestCase(settings, payload) {
    return ipcRenderer.invoke('desktop:sync-db-updater-test-case', settings, payload);
  },
  deleteDbUpdaterTestCase(settings, payload) {
    return ipcRenderer.invoke('desktop:delete-db-updater-test-case', settings, payload);
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
  readImageBase64(targetPath) {
    return ipcRenderer.invoke('desktop:read-image-base64', targetPath);
  },
  writeTextFile(targetPath, content) {
    return ipcRenderer.invoke('desktop:write-text-file', targetPath, content);
  },
  openPath(targetPath) {
    return ipcRenderer.invoke('desktop:open-path', targetPath);
  },
  runDotnetTest(request) {
    return ipcRenderer.invoke('desktop:run-dotnet-test', request);
  },
  debugDotnetTest(request) {
    return ipcRenderer.invoke('desktop:debug-dotnet-test', request);
  },
  debuggerContinue(runId) {
    return ipcRenderer.invoke('desktop:debugger-continue', runId);
  },
  debuggerNext(runId) {
    return ipcRenderer.invoke('desktop:debugger-next', runId);
  },
  debuggerStepIn(runId) {
    return ipcRenderer.invoke('desktop:debugger-step-in', runId);
  },
  debuggerStepOut(runId) {
    return ipcRenderer.invoke('desktop:debugger-step-out', runId);
  },
  debuggerPause(runId) {
    return ipcRenderer.invoke('desktop:debugger-pause', runId);
  },
  stopDotnetTest(runId) {
    return ipcRenderer.invoke('desktop:stop-dotnet-test', runId);
  },
  onTestRunProgress(callback) {
    if (typeof callback !== 'function') {
      return () => {};
    }

    const listener = (_event, payload) => {
      callback(payload);
    };

    ipcRenderer.on('desktop:test-run-progress', listener);
    return () => {
      ipcRenderer.removeListener('desktop:test-run-progress', listener);
    };
  },
});
