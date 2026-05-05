/**
 * App Version Utility
 * Provides access to the current app version from Electron/package.json
 */

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
