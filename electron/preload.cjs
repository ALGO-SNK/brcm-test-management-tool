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
  searchInFiles(rootPath, options) {
    return ipcRenderer.invoke('desktop:search-in-files', rootPath, options);
  },
  createFile(rootPath, targetPath, initialContent) {
    return ipcRenderer.invoke('desktop:create-file', rootPath, targetPath, initialContent);
  },
  createFolder(rootPath, targetPath) {
    return ipcRenderer.invoke('desktop:create-folder', rootPath, targetPath);
  },
  renamePath(rootPath, fromPath, toPath) {
    return ipcRenderer.invoke('desktop:rename-path', rootPath, fromPath, toPath);
  },
  deletePath(rootPath, targetPath) {
    return ipcRenderer.invoke('desktop:delete-path', rootPath, targetPath);
  },
  watchRepo(rootPath) {
    return ipcRenderer.invoke('desktop:watch-repo', rootPath);
  },
  unwatchRepo() {
    return ipcRenderer.invoke('desktop:unwatch-repo');
  },
  onRepoFsChanged(callback) {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event, payload) => { callback(payload); };
    ipcRenderer.on('desktop:fs-changed', listener);
    return () => ipcRenderer.removeListener('desktop:fs-changed', listener);
  },
  onRepoGitChanged(callback) {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event, payload) => { callback(payload); };
    ipcRenderer.on('desktop:git-changed', listener);
    return () => ipcRenderer.removeListener('desktop:git-changed', listener);
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
  getSchedulerConfig() {
    return ipcRenderer.invoke('desktop:get-scheduler-config');
  },
  syncSchedulerConfig(config) {
    return ipcRenderer.invoke('desktop:sync-scheduler-config', config);
  },
  listSchedulerSchedules() {
    return ipcRenderer.invoke('desktop:list-scheduler-schedules');
  },
  createSchedulerSchedule(payload) {
    return ipcRenderer.invoke('desktop:create-scheduler-schedule', payload);
  },
  updateSchedulerSchedule(scheduleId, payload) {
    return ipcRenderer.invoke('desktop:update-scheduler-schedule', scheduleId, payload);
  },
  deleteSchedulerSchedule(scheduleId) {
    return ipcRenderer.invoke('desktop:delete-scheduler-schedule', scheduleId);
  },
  runSchedulerScheduleNow(scheduleId) {
    return ipcRenderer.invoke('desktop:run-scheduler-schedule-now', scheduleId);
  },
  listSchedulerRunLogs(limit) {
    return ipcRenderer.invoke('desktop:list-scheduler-run-logs', limit);
  },
  queueSchedulerRunRequest(payload) {
    return ipcRenderer.invoke('desktop:queue-scheduler-run-request', payload);
  },
  upsertReleaseLog(payload) {
    return ipcRenderer.invoke('desktop:upsert-release-log', payload);
  },
  listReleaseLogs(limit) {
    return ipcRenderer.invoke('desktop:list-release-logs', limit);
  },
  listPendingReleaseLogs() {
    return ipcRenderer.invoke('desktop:list-pending-release-logs');
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
  debuggerVariables(runId, variablesReference) {
    return ipcRenderer.invoke('desktop:debugger-variables', runId, variablesReference);
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
