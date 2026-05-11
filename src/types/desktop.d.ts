export {};

declare global {
  interface DesktopDirectoryEntry {
    name: string;
    path: string;
    type: 'file' | 'directory';
  }

  interface DesktopGitBranchInfo {
    branch: string | null;
    repositoryRoot: string | null;
    isGitRepository: boolean;
    gitAvailable: boolean;
    branches: DesktopGitBranch[];
    message: string | null;
    requiresCommit?: boolean;
    changedFiles?: DesktopGitChangedFile[];
  }

  interface DesktopGitBranch {
    name: string;
    type: 'local' | 'remote';
    current: boolean;
  }

  interface DesktopGitChangedFile {
    path: string;
    additions: number;
    deletions: number;
    status: 'M' | 'A' | 'D' | 'U' | '?' | string;
  }

  interface DesktopGitStatus {
    branch: string | null;
    isGitRepository: boolean;
    staged: DesktopGitChangedFile[];
    unstaged: DesktopGitChangedFile[];
    untracked: DesktopGitChangedFile[];
    aheadCount: number;
    behindCount: number;
  }

  interface DesktopGitOperationResult {
    success: boolean;
    message?: string;
    error?: string;
  }

  interface DesktopGitCommitResult extends DesktopGitOperationResult {
    commitHash?: string;
  }

  interface DesktopMethodSearchResult {
    found: boolean;
    filePath: string | null;
    methodName: string;
    scannedFiles: number;
  }

  interface DesktopSearchMatch {
    line: number;
    column: number;
    matchLength: number;
    lineText: string;
  }

  interface DesktopSearchFileResult {
    path: string;
    matches: DesktopSearchMatch[];
  }

  interface DesktopSearchResult {
    matches: DesktopSearchFileResult[];
    totalMatches: number;
    truncated: boolean;
    canceled?: boolean;
    error?: string;
  }

  type DesktopDbUpdaterTarget = string;
  type DesktopDbUpdaterLevel = 'info' | 'success' | 'error';
  type DesktopDbUpdaterStatus = 'running' | 'complete' | 'failed' | 'partial';

  interface DesktopDbUpdaterProgress {
    runId: string;
    target: DesktopDbUpdaterTarget;
    level: DesktopDbUpdaterLevel;
    status: DesktopDbUpdaterStatus;
    phase: string;
    message: string;
    timestamp: string;
    currentSuite?: number;
    totalSuites?: number;
    fetched?: number;
    inserted?: number;
    total?: number;
    durationMs?: number;
    dbPath?: string;
  }

  interface DesktopDbUpdaterTargetResult {
    target: string;
    label: string;
    dbPath: string;
    inserted: number;
    status: 'complete' | 'failed';
    error?: string;
  }

  interface DesktopDbUpdaterResult {
    runId: string;
    status: DesktopDbUpdaterStatus;
    durationMs: number;
    results: DesktopDbUpdaterTargetResult[];
  }

  interface DesktopDbUpdaterTestCaseSyncPayload {
    planId: number;
    suiteId: number;
    suiteName: string;
    testCaseId: number;
  }

  interface DesktopDbUpdaterTestCaseSyncResult {
    status: 'complete' | 'skipped';
    reason?: string;
    testCaseId: number;
    planId: number;
    suiteId: number;
    target?: string;
    label?: string;
    dbName?: string;
    dbPath?: string;
    action?: 'created' | 'updated';
    hasAutomation?: boolean;
    row?: DesktopDbUpdaterRow;
  }

  interface DesktopDbUpdaterTestCaseDeletePayload {
    planId: number;
    testCaseId: number;
  }

  interface DesktopDbUpdaterTestCaseDeleteResult {
    status: 'complete' | 'skipped';
    reason?: string;
    planId: number;
    testCaseId: number;
    target?: string;
    dbPath?: string;
    deleted?: number;
  }

  interface DesktopDbUpdaterRow {
    id: number;
    title: string;
    isAutomationMethod: boolean;
    automatedTestName: string;
    browserName: string;
    batchName: string;
    testSuitId: string;
    initialStepsJson: string;
    testStepsJson: string;
    initialStepCount: number;
    testStepCount: number;
  }

  interface DesktopDbUpdaterOverviewTarget {
    target: string;
    label: string;
    planId: number;
    planName: string | null;
    dbName: string;
    dbPath: string;
    exists: boolean;
    tableExists: boolean;
    rowCount: number;
    automatedCount: number;
    rows: DesktopDbUpdaterRow[];
    error: string | null;
  }

  interface DesktopDbUpdaterOverview {
    rootDirectory: string;
    targetOrder: string[];
    targets: Record<string, DesktopDbUpdaterOverviewTarget>;
  }

  type DesktopTestRunLevel = 'info' | 'error';
  type DesktopTestRunStatus = 'running' | 'complete' | 'failed' | 'cancelled';
  type DesktopTestRunMode = 'run' | 'debug';
  type DesktopDebuggerEventName = 'stopped' | 'continued' | 'terminated' | 'exited';

  interface DesktopDebuggerVariable {
    name: string;
    value: string;
    type?: string;
    variablesReference?: number;
  }

  interface DesktopDebuggerScope {
    name: string;
    expensive?: boolean;
    variables: DesktopDebuggerVariable[];
  }

  interface DesktopDebuggerStackFrame {
    id: number;
    name: string;
    line: number;
    column: number;
    sourcePath?: string;
    sourceName?: string;
  }

  interface DesktopDebuggerStopDetails {
    reason?: string;
    threadId?: number | null;
    sourcePath?: string;
    sourceName?: string;
    line?: number;
    column?: number;
    description?: string;
    callStack?: DesktopDebuggerStackFrame[];
    scopes?: DesktopDebuggerScope[];
  }

  interface DesktopDebuggerEvent {
    event: DesktopDebuggerEventName;
    reason?: string;
    threadId?: number | null;
    details?: DesktopDebuggerStopDetails | null;
  }

  interface DesktopDebugBreakpoint {
    sourcePath: string;
    line: number;
  }

  interface DesktopTestRunProgress {
    runId: string;
    status: DesktopTestRunStatus;
    level: DesktopTestRunLevel;
    message: string;
    timestamp: string;
    mode?: DesktopTestRunMode;
    stream?: 'stdout' | 'stderr' | 'system';
    exitCode?: number | null;
    debuggerEvent?: DesktopDebuggerEvent;
  }

  interface DesktopTestRunRequest {
    workingDirectory: string;
    projectPath: string;
    runSettingsPath?: string;
    testFilter: string;
    logger?: string;
    patToken?: string;
    passPatAsEnv?: boolean;
    debuggerPath?: string;
    breakOnExceptions?: boolean;
    debugBreakpoints?: DesktopDebugBreakpoint[];
  }

  interface DesktopTestRunResult {
    runId: string;
    status: DesktopTestRunStatus;
    exitCode: number | null;
    attachments?: string[];
  }

  interface DesktopTestDebugResult extends DesktopTestRunResult {
    testHostPid: number | null;
    debuggerStarted: boolean;
    debuggerAttached: boolean;
  }

  interface DesktopApi {
    versions?: {
      chrome: string;
      electron: string;
      node: string;
      version: string;
    };
    setUnsavedChanges?: (source: string, isDirty: boolean) => void;
    onWindowCloseRequested?: (callback: () => void) => (() => void);
    respondToWindowClose?: (shouldClose: boolean) => void;
    selectDirectory?: (options?: { title?: string; defaultPath?: string }) => Promise<string | null>;
    listDirectory?: (targetPath: string) => Promise<DesktopDirectoryEntry[]>;
    searchInFiles?: (
      rootPath: string,
      options: { query: string; caseSensitive?: boolean; isRegex?: boolean; wholeWord?: boolean },
    ) => Promise<DesktopSearchResult>;
    createFile?: (
      rootPath: string,
      targetPath: string,
      initialContent?: string,
    ) => Promise<{ ok: boolean; path?: string; error?: string }>;
    createFolder?: (
      rootPath: string,
      targetPath: string,
    ) => Promise<{ ok: boolean; path?: string; error?: string }>;
    renamePath?: (
      rootPath: string,
      fromPath: string,
      toPath: string,
    ) => Promise<{ ok: boolean; path?: string; error?: string }>;
    deletePath?: (
      rootPath: string,
      targetPath: string,
    ) => Promise<{ ok: boolean; trashed?: boolean; error?: string }>;
    watchRepo?: (rootPath: string) => Promise<{ ok: boolean; path?: string; error?: string }>;
    unwatchRepo?: () => Promise<{ ok: boolean }>;
    onRepoFsChanged?: (
      callback: (payload: { rootPath: string; dirPath: string }) => void,
    ) => () => void;
    onRepoGitChanged?: (
      callback: (payload: { rootPath: string }) => void,
    ) => () => void;
    findTestMethod?: (rootPath: string, methodName: string) => Promise<DesktopMethodSearchResult>;
    getGitBranch?: (targetPath: string) => Promise<DesktopGitBranchInfo>;
    getGitStatus?: (targetPath: string) => Promise<DesktopGitStatus>;
    gitAdd?: (targetPath: string, filePaths: string[]) => Promise<DesktopGitOperationResult>;
    gitUnstage?: (targetPath: string, filePaths: string[]) => Promise<DesktopGitOperationResult>;
    gitCommit?: (targetPath: string, message: string) => Promise<DesktopGitCommitResult>;
    gitPush?: (targetPath: string) => Promise<DesktopGitOperationResult>;
    gitPull?: (targetPath: string) => Promise<DesktopGitOperationResult>;
    gitFetch?: (targetPath: string) => Promise<DesktopGitOperationResult>;
    gitSync?: (targetPath: string) => Promise<DesktopGitOperationResult>;
    switchGitBranch?: (
      targetPath: string,
      targetBranch: { name: string; type: 'local' | 'remote'; allowCommit?: boolean },
    ) => Promise<DesktopGitBranchInfo>;
    gitDiscard?: (targetPath: string, filePaths: string[]) => Promise<DesktopGitOperationResult>;
    gitStash?: (
      targetPath: string,
      payload?: { message?: string; files?: string[] },
    ) => Promise<DesktopGitOperationResult>;
    gitStashPop?: (
      targetPath: string,
      payload?: { stashRef?: string },
    ) => Promise<DesktopGitOperationResult>;
    gitListStashes?: (targetPath: string) => Promise<Array<{ ref: string; message: string; age: string }>>;
    runDbUpdater?: (settings: {
      organization: string;
      projectName: string;
      patToken: string;
      apiVersion: string;
      dbDirectory?: string;
      mainDbName?: string;
      worldPayDbName?: string;
      dbMappings?: Array<{
        id: string;
        label: string;
        planId: number;
        dbName: string;
        enabled: boolean;
      }>;
    }, options?: { targetIds?: string[] }) => Promise<DesktopDbUpdaterResult>;
    syncDbUpdaterTestCase?: (settings: {
      organization: string;
      projectName: string;
      patToken: string;
      apiVersion: string;
      dbDirectory?: string;
      mainDbName?: string;
      worldPayDbName?: string;
      dbMappings?: Array<{
        id: string;
        label: string;
        planId: number;
        dbName: string;
        enabled: boolean;
      }>;
    }, payload: DesktopDbUpdaterTestCaseSyncPayload) => Promise<DesktopDbUpdaterTestCaseSyncResult>;
    deleteDbUpdaterTestCase?: (settings: {
      organization: string;
      projectName: string;
      patToken: string;
      apiVersion: string;
      dbDirectory?: string;
      mainDbName?: string;
      worldPayDbName?: string;
      dbMappings?: Array<{
        id: string;
        label: string;
        planId: number;
        dbName: string;
        enabled: boolean;
      }>;
    }, payload: DesktopDbUpdaterTestCaseDeletePayload) => Promise<DesktopDbUpdaterTestCaseDeleteResult>;
    getDbUpdaterOverview?: (settings: {
      organization: string;
      projectName: string;
      patToken: string;
      apiVersion: string;
      dbDirectory?: string;
      mainDbName?: string;
      worldPayDbName?: string;
      dbMappings?: Array<{
        id: string;
        label: string;
        planId: number;
        dbName: string;
        enabled: boolean;
      }>;
    }) => Promise<DesktopDbUpdaterOverview>;
    onDbUpdaterProgress?: (callback: (progress: DesktopDbUpdaterProgress) => void) => (() => void);
    readTextFile?: (targetPath: string) => Promise<string>;
    readImageBase64?: (targetPath: string) => Promise<string | null>;
    writeTextFile?: (targetPath: string, content: string) => Promise<void>;
    openPath?: (targetPath: string) => Promise<{ ok: boolean; error?: string }>;
    runDotnetTest?: (request: DesktopTestRunRequest) => Promise<DesktopTestRunResult>;
    debugDotnetTest?: (request: DesktopTestRunRequest) => Promise<DesktopTestDebugResult>;
    debuggerContinue?: (runId: string) => Promise<{ ok: boolean }>;
    debuggerNext?: (runId: string) => Promise<{ ok: boolean }>;
    debuggerStepIn?: (runId: string) => Promise<{ ok: boolean }>;
    debuggerStepOut?: (runId: string) => Promise<{ ok: boolean }>;
    debuggerVariables?: (
      runId: string,
      variablesReference: number,
    ) => Promise<{ ok: boolean; variables: DesktopDebuggerVariable[]; error?: string }>;
    debuggerPause?: (runId: string) => Promise<{ ok: boolean }>;
    stopDotnetTest?: (runId: string) => Promise<{ ok: boolean }>;
    onTestRunProgress?: (callback: (progress: DesktopTestRunProgress) => void) => (() => void);
  }

  interface Window {
    desktop?: DesktopApi;
  }
}
