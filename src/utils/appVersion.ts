/**
 * App Version Utility
 * Provides access to the current app version from Electron/package.json
 */

declare global {
  interface Window {
    desktop?: {
      versions?: {
        version: string;
        electron: string;
        node: string;
        chrome: string;
      };
      setUnsavedChanges(source: string, isDirty: boolean): void;
      onWindowCloseRequested(callback: () => void): () => void;
      respondToWindowClose(shouldClose: boolean): void;
    };
  }
}

export function getAppVersion(): string {
  try {
    return window.desktop?.versions?.version ?? 'Unknown';
  } catch {
    return 'Unknown';
  }
}

export function getAppVersions() {
  try {
    return {
      app: window.desktop?.versions?.version ?? 'Unknown',
      electron: window.desktop?.versions?.electron ?? 'Unknown',
      node: window.desktop?.versions?.node ?? 'Unknown',
      chrome: window.desktop?.versions?.chrome ?? 'Unknown',
    };
  } catch {
    return {
      app: 'Unknown',
      electron: 'Unknown',
      node: 'Unknown',
      chrome: 'Unknown',
    };
  }
}
