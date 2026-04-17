export {};

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
    };
  }
}
