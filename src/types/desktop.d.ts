export {};

interface DesktopDirectoryEntry {
  name: string;
  path: string;
  type: 'file' | 'directory';
}

declare global {
  interface Window {
    desktop?: {
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
      readTextFile?: (targetPath: string) => Promise<string>;
      writeTextFile?: (targetPath: string, content: string) => Promise<void>;
    };
  }
}
