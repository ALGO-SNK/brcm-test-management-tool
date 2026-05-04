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
    status: string;
  }

  interface DesktopMethodSearchResult {
    found: boolean;
    filePath: string | null;
    methodName: string;
    scannedFiles: number;
  }

  type DesktopDbUpdaterTarget = 'all' | 'main' | 'worldPay';
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
    target: 'main' | 'worldPay';
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
    target: 'main' | 'worldPay';
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
    targets: {
      main: DesktopDbUpdaterOverviewTarget;
      worldPay: DesktopDbUpdaterOverviewTarget;
    };
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
    findTestMethod?: (rootPath: string, methodName: string) => Promise<DesktopMethodSearchResult>;
    getGitBranch?: (targetPath: string) => Promise<DesktopGitBranchInfo>;
    switchGitBranch?: (
      targetPath: string,
      targetBranch: { name: string; type: 'local' | 'remote'; allowCommit?: boolean },
    ) => Promise<DesktopGitBranchInfo>;
    runDbUpdater?: (settings: {
      organization: string;
      projectName: string;
      patToken: string;
      apiVersion: string;
      dbDirectory?: string;
      mainDbName?: string;
      worldPayDbName?: string;
    }) => Promise<DesktopDbUpdaterResult>;
    getDbUpdaterOverview?: (settings: {
      organization: string;
      projectName: string;
      patToken: string;
      apiVersion: string;
      dbDirectory?: string;
      mainDbName?: string;
      worldPayDbName?: string;
    }) => Promise<DesktopDbUpdaterOverview>;
    onDbUpdaterProgress?: (callback: (progress: DesktopDbUpdaterProgress) => void) => (() => void);
    readTextFile?: (targetPath: string) => Promise<string>;
    writeTextFile?: (targetPath: string, content: string) => Promise<void>;
  }

  interface Window {
    desktop?: DesktopApi;
  }
}
