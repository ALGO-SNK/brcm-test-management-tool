import { useEffect, useMemo, useRef, useState } from 'react';
import {
  IconAddLink,
  IconChevronRight,
  IconCode,
  IconDescription,
  IconFolder,
  IconFolderOpen,
  IconLinkOff,
  IconRefresh,
  IconSearch,
  IconUnfoldLess,
  IconUnfoldMore,
  IconX,
} from '../Common/Icons';
import { useNotification } from '../../context/useNotification';
import { GitManager, type GitFile } from './GitManager';
import { CodeEditor, detectLanguage } from '../Common/CodeEditor';
import { QuickOpen, type FileItem } from './QuickOpen';
import { FindInFiles } from './FindInFiles';
import { CommandPalette, type PaletteCommand } from './CommandPalette';
import { DebugVariableRow } from './DebugVariableRow';
import type { editor as MonacoEditorNS } from 'monaco-editor';

interface SeleniumRepoBrowserModalProps {
  repoPath: string;
  onClose: () => void;
  embedded?: boolean;
  mode?: 'browse' | 'manage-automation';
  generatedMethodName?: string;
  associatedMethodName?: string | null;
  associatedClassName?: string | null;
  onWriteCode?: (filePath: string) => void;
  onAddAssociation?: (filePath: string, methodName: string) => void;
  onRemoveAssociation?: (filePath: string, methodName: string) => void;
  actionBusy?: boolean;
  refreshToken?: number;
  /** Optional — when provided, enables the in-browser debug commands (Phase 3b). */
  workspaceSettings?: import('../pages/WorkspaceSettings').WorkspaceSettingsValues;
}

type NodeState = {
  entries: DesktopDirectoryEntry[];
  loading: boolean;
  error: string | null;
};

type FileTestNamesState = {
  loading: boolean;
  names: string[];
};

type GitBranchState = {
  loading: boolean;
  branch: string | null;
  isGitRepository: boolean;
  gitAvailable: boolean;
  branches: DesktopGitBranch[];
  message: string | null;
};

type PendingBranchSwitch = {
  branch: DesktopGitBranch;
  changedFiles: DesktopGitChangedFile[];
};

type MethodSearchState = {
  loading: boolean;
  methodName: string;
};

function extractTestMethodNames(content: string): string[] {
  const matches = Array.from(content.matchAll(/\[Test\][\s\S]*?public\s+void\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/g));
  return matches.map((match) => match[1]).filter(Boolean);
}


// Normalize git status strings from various sources (porcelain codes, words, etc.)
// to our single-char codes: M=modified, A=added (includes untracked), D=deleted, U=unmerged
// Note: '?' (untracked) maps to 'A' for consistent UI — new files always show as 'A'.
function normalizeGitStatus(raw: string | undefined | null): 'M' | 'A' | 'D' | 'U' | '?' {
  if (!raw) return 'M';
  const s = String(raw).trim().toUpperCase();
  // Single-char already
  if (s === 'M' || s === 'A' || s === 'D' || s === 'U') return s;
  // Untracked → display as Added for consistency
  if (s === '??' || s === '?') return 'A';
  // Porcelain codes
  if (s === 'UU' || s === 'AA' || s === 'DD' || s === 'AU' || s === 'UA' || s === 'DU' || s === 'UD') return 'U';
  if (s === 'MM' || s === 'AM' || s === 'MD' || s === 'AD' || s === 'RM') return 'M';
  // Word forms
  if (s === 'MODIFIED') return 'M';
  if (s === 'ADDED' || s === 'NEW' || s === 'UNTRACKED') return 'A';
  if (s === 'DELETED' || s === 'REMOVED') return 'D';
  if (s === 'UNMERGED' || s === 'CONFLICT' || s === 'CONFLICTED') return 'U';
  if (s === 'RENAMED') return 'M';
  if (s === 'COPIED') return 'A';
  // Fallback: take first letter
  const firstChar = s.charAt(0);
  if (firstChar === 'M' || firstChar === 'A' || firstChar === 'D' || firstChar === 'U') {
    return firstChar as 'M' | 'A' | 'D' | 'U';
  }
  if (firstChar === '?') return 'A';
  return 'M';
}

function getAncestorDirectoryPaths(rootPath: string, targetFilePath: string): string[] {
  const normalizedRoot = rootPath.replace(/[\\/]+$/, '').toLowerCase();
  const directories: string[] = [];
  let currentPath = targetFilePath.replace(/[\\/][^\\/]+$/, '');

  while (currentPath && currentPath.toLowerCase().startsWith(normalizedRoot)) {
    directories.push(currentPath);
    if (currentPath.toLowerCase() === normalizedRoot) {
      break;
    }
    currentPath = currentPath.replace(/[\\/][^\\/]+$/, '');
  }

  return directories.reverse();
}

export function SeleniumRepoBrowserModal({
  repoPath,
  onClose,
  embedded = false,
  mode = 'browse',
  generatedMethodName = '',
  associatedMethodName = null,
  associatedClassName = null,
  onWriteCode,
  onAddAssociation,
  onRemoveAssociation,
  actionBusy = false,
  refreshToken = 0,
  workspaceSettings,
}: SeleniumRepoBrowserModalProps) {
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set([repoPath]));
  const [nodesByPath, setNodesByPath] = useState<Record<string, NodeState>>({});
  const [fileTestNamesByPath, setFileTestNamesByPath] = useState<Record<string, FileTestNamesState>>({});
  const [gitBranch, setGitBranch] = useState<GitBranchState>({
    loading: false,
    branch: null,
    isGitRepository: false,
    gitAvailable: false,
    branches: [],
    message: null,
  });
  const [gitStatus, setGitStatus] = useState<{
    unstagedFiles: GitFile[];
    stagedFiles: GitFile[];
    aheadCount: number;
    behindCount: number;
  }>({
    unstagedFiles: [],
    stagedFiles: [],
    aheadCount: 0,
    behindCount: 0,
  });
  const [branchSwitching, setBranchSwitching] = useState(false);
  const [pendingBranchSwitch, setPendingBranchSwitch] = useState<PendingBranchSwitch | null>(null);
  const [methodSearch, setMethodSearch] = useState<MethodSearchState>({
    loading: false,
    methodName: '',
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [previewFile, setPreviewFile] = useState<{
    path: string;
    content: string;       // current (possibly edited) value
    original: string;      // last-saved value — for dirty check + discard
    loading: boolean;
    error: string | null;
  } | null>(null);
  // Edit/Save state
  // Always editable — no read-only state. Kept as state so existing references
  // continue to compile, but the UI never flips it back to false.
  const [isEditing, setIsEditing] = useState(true);
  // `setIsSaving` is consumed by saveCurrentFile to drive the autosave pill; the
  // displayed value comes via `autoSaveStatus`, so the state itself isn't read here.
  const [, setIsSaving] = useState(false);
  // Auto-save status surfaced in the status bar (transient "Saved" indicator).
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'pending' | 'saving' | 'saved' | 'error'>('idle');
  const autoSaveTimerRef = useRef<number | null>(null);
  const autoSavedFlashTimerRef = useRef<number | null>(null);
  const isDirty = Boolean(previewFile && previewFile.content !== previewFile.original);
  // Quick Open (Ctrl+P) state
  const [isQuickOpenOpen, setIsQuickOpenOpen] = useState(false);
  const [quickOpenIndex, setQuickOpenIndex] = useState<FileItem[]>([]);
  const [isIndexing, setIsIndexing] = useState(false);
  const indexedRefRoot = useRef<string | null>(null);
  // Find in Files (Ctrl+Shift+F) state
  const [isFindInFilesOpen, setIsFindInFilesOpen] = useState(false);
  // Command palette (Ctrl+Shift+P) state
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  // Recently-opened files for Quick Open (scoped per repo, persisted in localStorage)
  const recentFilesKey = `repo-browser:recent-files:${repoPath}`;
  const [recentFiles, setRecentFiles] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(`repo-browser:recent-files:${repoPath}`);
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return [];
    }
  });
  // Reload recents when repoPath changes (e.g. modal opens for a different repo)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(`repo-browser:recent-files:${repoPath}`);
      setRecentFiles(raw ? (JSON.parse(raw) as string[]) : []);
    } catch {
      setRecentFiles([]);
    }
  }, [repoPath]);
  const pushRecentFile = (filePath: string) => {
    setRecentFiles((prev) => {
      const next = [filePath, ...prev.filter((p) => p !== filePath)].slice(0, 20);
      try {
        localStorage.setItem(recentFilesKey, JSON.stringify(next));
      } catch {
        /* ignore quota errors */
      }
      return next;
    });
  };
  // Tree context menu (right-click on file/folder row)
  const [treeContextMenu, setTreeContextMenu] = useState<
    | {
        x: number;
        y: number;
        entry: DesktopDirectoryEntry | null; // null = repo root
        parentDir: string; // dir whose entries we'll refresh
      }
    | null
  >(null);
  // Monaco editor ref + pending jump (used when opening from a Find result)
  const monacoEditorRef = useRef<MonacoEditorNS.IStandaloneCodeEditor | null>(null);
  const pendingJumpRef = useRef<{ path: string; line: number; column: number } | null>(null);
  // Cursor position for the editor status bar.
  const [cursorPos, setCursorPos] = useState<{ line: number; column: number }>({ line: 1, column: 1 });
  // Refs so the global F9 handler always sees fresh values without re-binding.
  const cursorPosRef = useRef(cursorPos);
  useEffect(() => { cursorPosRef.current = cursorPos; }, [cursorPos]);
  const previewFilePathRef = useRef<string | null>(null);
  const toggleBreakpointRef = useRef<((path: string, line: number) => void) | null>(null);
  // Refs for debug commands so F-key hotkeys always see fresh handlers/state.
  // Declared here (without depending on debug-state values) so the keydown
  // handler set up below the breakpoint block can read them. The sync effect
  // that mirrors debugStatus into the ref lives further down, after the
  // useState declaration of debugStatus (to avoid a TDZ on the dep array).
  const debugStatusRef = useRef<'idle' | 'starting' | 'running' | 'paused' | 'stopping'>('idle');
  const debugHandlersRef = useRef<{
    start: () => Promise<void>;
    stop: () => Promise<void>;
    cont: () => Promise<void>;
    over: () => Promise<void>;
    inFn: () => Promise<void>;
    out: () => Promise<void>;
  } | null>(null);
  // ---------- Breakpoints (Phase 3a) ----------
  // Per-repo, per-file 1-based line numbers. Persisted in localStorage so they
  // survive file switches, modal reopens, and app restarts.
  const breakpointsKey = `repo-browser:breakpoints:${repoPath}`;
  const [breakpointsByFile, setBreakpointsByFile] = useState<Record<string, number[]>>(() => {
    try {
      const raw = localStorage.getItem(`repo-browser:breakpoints:${repoPath}`);
      return raw ? (JSON.parse(raw) as Record<string, number[]>) : {};
    } catch {
      return {};
    }
  });
  useEffect(() => {
    try {
      const raw = localStorage.getItem(`repo-browser:breakpoints:${repoPath}`);
      setBreakpointsByFile(raw ? (JSON.parse(raw) as Record<string, number[]>) : {});
    } catch {
      setBreakpointsByFile({});
    }
  }, [repoPath]);
  const persistBreakpoints = (next: Record<string, number[]>) => {
    try {
      localStorage.setItem(breakpointsKey, JSON.stringify(next));
    } catch {
      /* quota — ignore */
    }
  };
  const toggleBreakpoint = (filePath: string, line: number) => {
    setBreakpointsByFile((current) => {
      const existing = current[filePath] ?? [];
      const hasIt = existing.includes(line);
      const updated = hasIt
        ? existing.filter((l) => l !== line)
        : [...existing, line].sort((a, b) => a - b);
      const next = { ...current };
      if (updated.length === 0) delete next[filePath];
      else next[filePath] = updated;
      persistBreakpoints(next);
      return next;
    });
  };
  const clearAllBreakpoints = () => {
    setBreakpointsByFile({});
    persistBreakpoints({});
  };
  // Keep refs current so the F9 keydown handler (registered once) sees fresh state.
  useEffect(() => {
    previewFilePathRef.current = previewFile?.path ?? null;
  }, [previewFile]);
  useEffect(() => {
    toggleBreakpointRef.current = toggleBreakpoint;
    debugHandlersRef.current = {
      start: startDebugRun,
      stop: stopDebugRun,
      cont: debuggerContinue,
      over: debuggerStepOver,
      inFn: debuggerStepIn,
      out: debuggerStepOut,
    };
  });
  const currentFileBreakpoints = useMemo(
    () => (previewFile ? breakpointsByFile[previewFile.path] ?? [] : []),
    [previewFile, breakpointsByFile],
  );
  const totalBreakpointCount = useMemo(
    () => Object.values(breakpointsByFile).reduce((sum, arr) => sum + arr.length, 0),
    [breakpointsByFile],
  );

  // Breakpoints popover (Phase 3c) — opened by clicking the BP chip in the status bar.
  const [isBreakpointsPopoverOpen, setIsBreakpointsPopoverOpen] = useState(false);

  // ---------- Multi-tab editor ----------
  // Each tab caches the path + last-seen content/original so switching tabs
  // doesn't lose unsaved (in-flight autosave) edits. The ACTIVE tab's state
  // is mirrored into `previewFile` so all existing flows (banner, debug,
  // breakpoints, autosave) continue to read from `previewFile.*`.
  type TabState = { path: string; content: string; original: string };
  const [openTabs, setOpenTabs] = useState<TabState[]>([]);
  // Stash any in-flight content of the currently-active tab when switching.
  const stashActiveTabContent = () => {
    if (!previewFile) return;
    setOpenTabs((tabs) => tabs.map((t) =>
      t.path === previewFile.path
        ? { ...t, content: previewFile.content, original: previewFile.original }
        : t,
    ));
  };
  const closeTab = (path: string) => {
    setOpenTabs((tabs) => {
      const next = tabs.filter((t) => t.path !== path);
      // If the closed tab was the active one, switch to the neighbor.
      if (previewFile?.path === path) {
        if (next.length === 0) {
          setPreviewFile(null);
        } else {
          // Pick the tab to the left if possible, else the first remaining.
          const closedIdx = tabs.findIndex((t) => t.path === path);
          const target = next[Math.max(0, Math.min(closedIdx - 1, next.length - 1))];
          setPreviewFile({
            path: target.path,
            content: target.content,
            original: target.original,
            loading: false,
            error: null,
          });
        }
      }
      return next;
    });
  };
  const switchToTab = (path: string) => {
    if (previewFile?.path === path) return;
    stashActiveTabContent();
    const target = openTabs.find((t) => t.path === path);
    if (target) {
      setPreviewFile({
        path: target.path,
        content: target.content,
        original: target.original,
        loading: false,
        error: null,
      });
    } else {
      // Not in tabs yet — load fresh.
      void loadFilePreview(path);
    }
  };

  // ---------- Debug session state (Phase 3b) ----------
  const [debugRunId, setDebugRunId] = useState<string | null>(null);
  const [debugStatus, setDebugStatus] = useState<'idle' | 'starting' | 'running' | 'paused' | 'stopping'>('idle');
  const [debugStopDetails, setDebugStopDetails] = useState<DesktopDebuggerStopDetails | null>(null);
  // Setter only — threadId is captured for future DAP commands; not displayed in UI.
  const [, setDebugThreadId] = useState<number | null>(null);
  // Mirror debugStatus into the ref so F-key hotkeys (registered once globally) see fresh state.
  useEffect(() => { debugStatusRef.current = debugStatus; }, [debugStatus]);
  // Where the debugger is currently paused (drives the editor pointer + auto-open).
  const debugExecutionLine =
    debugStatus === 'paused' && debugStopDetails && previewFile
      && debugStopDetails.sourcePath
      && debugStopDetails.sourcePath.replace(/\\/g, '/').toLowerCase() === previewFile.path.replace(/\\/g, '/').toLowerCase()
      ? debugStopDetails.line ?? null
      : null;
  const isDebugActive = debugStatus !== 'idle';
  const [wrapCode, setWrapCode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('repo-browser:wrap-code') === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('repo-browser:wrap-code', wrapCode ? '1' : '0');
    } catch { /* ignore */ }
  }, [wrapCode]);
  // Panel widths as percentages of container — defaults to 30:50:20
  const [panelWidths, setPanelWidths] = useState<{ left: number; middle: number; right: number }>(() => {
    try {
      const saved = localStorage.getItem('repo-browser:panel-widths');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.left === 'number' && typeof parsed.middle === 'number' && typeof parsed.right === 'number') {
          return parsed;
        }
      }
    } catch { /* ignore */ }
    return { left: 30, middle: 50, right: 20 };
  });
  const dragStateRef = useRef<{ handle: 'left' | 'right'; startX: number; startLeft: number; startMiddle: number; startRight: number; containerWidth: number } | null>(null);
  const splitPaneRef = useRef<HTMLDivElement | null>(null);
  const methodRowRefs = useRef<Record<string, HTMLDivElement | null>>({});
  // Frozen banner state during action API calls — prevents button-label flicker
  // while the parent is propagating the optimistic association/unassociation.
  const bannerStateRef = useRef<{
    isAssociatedFile: boolean;
    associatedMethodName: string | null;
    associatedClassName: string | null;
    generatedMethodInThisFile: boolean;
    generatedMethodName: string;
    currentMethodName: string;
    previewFilePath: string;
  } | null>(null);
  const [bannerFrozen, setBannerFrozen] = useState(false);
  // Once parent finishes its API roundtrip (actionBusy returns to false),
  // release the freeze on the next tick so banner re-syncs with live state.
  useEffect(() => {
    if (actionBusy || !bannerFrozen) return;
    const timer = window.setTimeout(() => setBannerFrozen(false), 60);
    return () => window.clearTimeout(timer);
  }, [actionBusy, bannerFrozen]);
  const { addNotification } = useNotification();

  // Persist panel widths
  useEffect(() => {
    try {
      localStorage.setItem('repo-browser:panel-widths', JSON.stringify(panelWidths));
    } catch { /* ignore */ }
  }, [panelWidths]);

  const handleResizeStart = (handle: 'left' | 'right') => (event: React.MouseEvent) => {
    event.preventDefault();
    const container = splitPaneRef.current;
    if (!container) return;
    dragStateRef.current = {
      handle,
      startX: event.clientX,
      startLeft: panelWidths.left,
      startMiddle: panelWidths.middle,
      startRight: panelWidths.right,
      containerWidth: container.getBoundingClientRect().width,
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      const drag = dragStateRef.current;
      if (!drag) return;
      const deltaPct = ((event.clientX - drag.startX) / drag.containerWidth) * 100;
      const MIN = 10; // minimum % per panel
      if (drag.handle === 'left') {
        const newLeft = Math.max(MIN, Math.min(drag.startLeft + drag.startMiddle - MIN, drag.startLeft + deltaPct));
        const newMiddle = drag.startLeft + drag.startMiddle - newLeft;
        setPanelWidths({ left: newLeft, middle: newMiddle, right: drag.startRight });
      } else {
        // right handle: between middle and right
        const newRight = Math.max(MIN, Math.min(drag.startMiddle + drag.startRight - MIN, drag.startRight - deltaPct));
        const newMiddle = drag.startMiddle + drag.startRight - newRight;
        setPanelWidths({ left: drag.startLeft, middle: newMiddle, right: newRight });
      }
    };
    const handleMouseUp = () => {
      if (dragStateRef.current) {
        dragStateRef.current = null;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const loadFilePreview = async (filePath: string, options: { force?: boolean } = {}) => {
    if (!window.desktop?.readTextFile) {
      setPreviewFile({ path: filePath, content: '', original: '', loading: false, error: 'File reading not available' });
      return;
    }
    // Multi-tab: if this file is already open in a tab, just switch — don't reload.
    if (!options.force && previewFile?.path !== filePath) {
      const existingTab = openTabs.find((t) => t.path === filePath);
      if (existingTab) {
        // Stash current tab's content before switching
        if (previewFile) {
          setOpenTabs((tabs) => tabs.map((t) =>
            t.path === previewFile.path
              ? { ...t, content: previewFile.content, original: previewFile.original }
              : t,
          ));
        }
        setPreviewFile({
          path: existingTab.path,
          content: existingTab.content,
          original: existingTab.original,
          loading: false,
          error: null,
        });
        return;
      }
    }
    // Stash outgoing tab content (autosave handles disk persistence; this
    // preserves any in-flight edits in memory so switching back is seamless).
    if (previewFile && previewFile.path !== filePath) {
      setOpenTabs((tabs) => tabs.map((t) =>
        t.path === previewFile.path
          ? { ...t, content: previewFile.content, original: previewFile.original }
          : t,
      ));
    }
    setPreviewFile({ path: filePath, content: '', original: '', loading: true, error: null });
    try {
      const content = await window.desktop.readTextFile(filePath);
      setPreviewFile({ path: filePath, content, original: content, loading: false, error: null });
      pushRecentFile(filePath);
      // Ensure this file is in the open-tabs list (or refresh its cached content).
      setOpenTabs((tabs) => {
        const idx = tabs.findIndex((t) => t.path === filePath);
        if (idx === -1) return [...tabs, { path: filePath, content, original: content }];
        const copy = tabs.slice();
        copy[idx] = { path: filePath, content, original: content };
        return copy;
      });
      if (filePath.toLowerCase().endsWith('.cs')) {
        const names = extractTestMethodNames(content);
        setFileTestNamesByPath((current) => ({
          ...current,
          [filePath]: { loading: false, names },
        }));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load file';
      setPreviewFile({ path: filePath, content: '', original: '', loading: false, error: message });
    }
  };

  const saveCurrentFile = async () => {
    if (!previewFile || !isDirty) return;
    if (!window.desktop?.writeTextFile) {
      addNotification('error', 'File saving is not available. Restart the app to load latest changes.');
      return;
    }
    setIsSaving(true);
    try {
      await window.desktop.writeTextFile(previewFile.path, previewFile.content);
      // Mark clean: original now matches content
      setPreviewFile((current) => (current ? { ...current, original: current.content } : current));
      // Re-extract test method names since file content changed
      if (previewFile.path.toLowerCase().endsWith('.cs')) {
        const names = extractTestMethodNames(previewFile.content);
        setFileTestNamesByPath((current) => ({
          ...current,
          [previewFile.path]: { loading: false, names },
        }));
      }
      // Don't spam notifications on every autosave — keep it silent.
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save file';
      addNotification('error', message);
      throw error;
    } finally {
      setIsSaving(false);
    }
  };

  // ---------- Auto-save (debounced) ----------
  // 800ms after the user stops typing, flush dirty content to disk silently.
  // Status surfaces in the toolbar pill: Editing → Saving → Saved → (fades).
  useEffect(() => {
    if (!previewFile || previewFile.loading || previewFile.error) return;
    if (!isDirty) return;
    setAutoSaveStatus('pending');
    if (autoSaveTimerRef.current) window.clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = window.setTimeout(() => {
      autoSaveTimerRef.current = null;
      setAutoSaveStatus('saving');
      void (async () => {
        try {
          await saveCurrentFile();
          setAutoSaveStatus('saved');
          if (autoSavedFlashTimerRef.current) window.clearTimeout(autoSavedFlashTimerRef.current);
          autoSavedFlashTimerRef.current = window.setTimeout(() => setAutoSaveStatus('idle'), 1400);
        } catch {
          setAutoSaveStatus('error');
        }
      })();
    }, 800);
    return () => {
      if (autoSaveTimerRef.current) window.clearTimeout(autoSaveTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewFile?.content, previewFile?.path, isDirty]);

  // ---------- File ops (create / rename / delete) ----------
  // Refresh the directory listing for a given parent path so the tree reflects the FS.
  const refreshDirectory = (dirPath: string) => {
    void loadPath(dirPath, true);
  };

  const handleCreateFile = async (parentDir: string) => {
    if (!window.desktop?.createFile) {
      addNotification('error', 'File creation is unavailable in this build.');
      return;
    }
    const name = window.prompt('New file name (e.g. MyTest.cs):');
    if (!name) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    const sep = parentDir.includes('\\') ? '\\' : '/';
    const target = `${parentDir}${parentDir.endsWith(sep) ? '' : sep}${trimmed}`;
    const res = await window.desktop.createFile(repoPath, target, '');
    if (!res.ok) {
      addNotification('error', res.error || 'Could not create file.');
      return;
    }
    refreshDirectory(parentDir);
    addNotification('success', `Created ${trimmed}`);
    if (res.path) void loadFilePreview(res.path);
  };

  const handleCreateFolder = async (parentDir: string) => {
    if (!window.desktop?.createFolder) {
      addNotification('error', 'Folder creation is unavailable in this build.');
      return;
    }
    const name = window.prompt('New folder name:');
    if (!name) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    const sep = parentDir.includes('\\') ? '\\' : '/';
    const target = `${parentDir}${parentDir.endsWith(sep) ? '' : sep}${trimmed}`;
    const res = await window.desktop.createFolder(repoPath, target);
    if (!res.ok) {
      addNotification('error', res.error || 'Could not create folder.');
      return;
    }
    refreshDirectory(parentDir);
    addNotification('success', `Created folder ${trimmed}`);
  };

  const handleRename = async (entry: DesktopDirectoryEntry, parentDir: string) => {
    if (!window.desktop?.renamePath) {
      addNotification('error', 'Rename is unavailable in this build.');
      return;
    }
    if (previewFile?.path === entry.path && isDirty) {
      addNotification('error', 'Save or discard your edits before renaming this file.');
      return;
    }
    const newName = window.prompt('Rename to:', entry.name);
    if (!newName) return;
    const trimmed = newName.trim();
    if (!trimmed || trimmed === entry.name) return;
    const sep = entry.path.includes('\\') ? '\\' : '/';
    const lastSep = entry.path.lastIndexOf(sep);
    const newPath = entry.path.slice(0, lastSep + 1) + trimmed;
    const res = await window.desktop.renamePath(repoPath, entry.path, newPath);
    if (!res.ok) {
      addNotification('error', res.error || 'Could not rename.');
      return;
    }
    refreshDirectory(parentDir);
    addNotification('success', `Renamed to ${trimmed}`);
    // Update the open tab list for the renamed path so it stays in the strip.
    if (res.path) {
      setOpenTabs((tabs) => tabs.map((t) => (t.path === entry.path ? { ...t, path: res.path! } : t)));
    }
    // If the renamed file is currently previewed, reopen it at its new path.
    if (previewFile?.path === entry.path && res.path) {
      void loadFilePreview(res.path, { force: true });
    }
  };

  const handleDelete = async (entry: DesktopDirectoryEntry, parentDir: string) => {
    if (!window.desktop?.deletePath) {
      addNotification('error', 'Delete is unavailable in this build.');
      return;
    }
    const ok = window.confirm(
      `Move "${entry.name}" to the system trash?\n\nYou can restore it from the Recycle Bin / Trash if needed.`,
    );
    if (!ok) return;
    if (previewFile?.path === entry.path && isDirty) {
      const force = window.confirm(
        'This file has unsaved edits. Delete it anyway and discard the edits?',
      );
      if (!force) return;
    }
    const res = await window.desktop.deletePath(repoPath, entry.path);
    if (!res.ok) {
      addNotification('error', res.error || 'Could not delete.');
      return;
    }
    refreshDirectory(parentDir);
    addNotification('success', res.trashed ? `Moved ${entry.name} to trash` : `Deleted ${entry.name}`);
    // If the deleted file was open in any tab, close it (also handles preview).
    if (openTabs.some((t) => t.path === entry.path)) {
      closeTab(entry.path);
    } else if (previewFile?.path === entry.path) {
      setPreviewFile(null);
      setIsEditing(false);
    }
  };

  // Close the context menu when clicking elsewhere or pressing Escape.
  useEffect(() => {
    if (!treeContextMenu) return;
    const close = () => setTreeContextMenu(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('mousedown', close);
    window.addEventListener('keydown', onKey);
    window.addEventListener('scroll', close, true);
    return () => {
      window.removeEventListener('mousedown', close);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', close, true);
    };
  }, [treeContextMenu]);

  const openTreeContextMenu = (
    e: React.MouseEvent,
    entry: DesktopDirectoryEntry | null,
    parentDir: string,
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setTreeContextMenu({ x: e.clientX, y: e.clientY, entry, parentDir });
  };

  // Apply a pending jump (from Find in Files / auto-open) once the file
  // content has loaded. If the pending jump's line is `1` (the placeholder
  // used by auto-open in manage-automation mode) AND we know the target
  // method name, re-resolve to the actual method-definition line by scanning
  // the loaded content.
  useEffect(() => {
    const pending = pendingJumpRef.current;
    if (!pending || !previewFile || previewFile.loading || previewFile.error) return;
    if (pending.path !== previewFile.path) return;

    // Resolve placeholder-line → real method line for manage-automation auto-open.
    // Read the method name directly from props to avoid TDZ on the derived
    // `currentMethodName` const (which is declared further down in the body).
    const methodName = associatedMethodName || generatedMethodName;
    let targetLine = pending.line;
    let targetColumn = pending.column;
    if (mode === 'manage-automation' && methodName && targetLine === 1) {
      const lines = previewFile.content.split('\n');
      // Match `<methodName>(` with optional whitespace; bare word boundary on the left.
      const safeName = methodName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(`\\b${safeName}\\s*\\(`);
      for (let i = 0; i < lines.length; i += 1) {
        if (re.test(lines[i])) {
          targetLine = i + 1;
          const col = lines[i].search(re);
          if (col >= 0) targetColumn = col + 1;
          break;
        }
      }
    }

    const editor = monacoEditorRef.current;
    if (!editor) return; // will be applied on mount instead
    editor.revealLineInCenter(targetLine);
    editor.setPosition({ lineNumber: targetLine, column: targetColumn });
    editor.focus();
    pendingJumpRef.current = null;
  }, [previewFile, mode, associatedMethodName, generatedMethodName]);

  // ---------- Debug run helpers (Phase 3b) ----------
  // Convert the in-memory breakpoint map → the IPC-friendly array shape.
  const collectDebugBreakpoints = (): { sourcePath: string; line: number }[] => {
    const out: { sourcePath: string; line: number }[] = [];
    for (const [sourcePath, lines] of Object.entries(breakpointsByFile)) {
      for (const line of lines) out.push({ sourcePath, line });
    }
    return out;
  };

  // Find the test method enclosing or nearest above a given line in a .cs file.
  // Naive: scans the names already discovered for the file (fileTestNamesByPath)
  // and returns the first match; if cursor is not on a test method, fall back
  // to the first test method in the file.
  const findTestMethodForDebug = (): string | null => {
    if (!previewFile) return null;
    const names = fileTestNamesByPath[previewFile.path]?.names ?? [];
    if (names.length === 0) return null;
    // Best-effort: locate the test method whose definition starts on or before the cursor line.
    const lines = previewFile.content.split('\n');
    let lastMatch: string | null = null;
    for (let i = 0; i < lines.length; i += 1) {
      for (const name of names) {
        const re = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}\\s*\\(`);
        if (re.test(lines[i])) {
          if (i + 1 <= cursorPos.line) lastMatch = name;
        }
      }
    }
    return lastMatch ?? names[0];
  };

  const startDebugRun = async () => {
    if (!workspaceSettings) {
      addNotification('error', 'Configure workspace settings (PAT, project path, working directory) to use debug.');
      return;
    }
    if (!window.desktop?.debugDotnetTest) {
      addNotification('error', 'Debug runner is unavailable in this build.');
      return;
    }
    if (isDebugActive) {
      addNotification('warning', 'A debug session is already running.');
      return;
    }
    const workingDirectory = workspaceSettings.testRunWorkingDirectory?.trim() || repoPath;
    const projectPath = workspaceSettings.testRunProjectPath?.trim();
    if (!projectPath) {
      addNotification('error', 'Set the test project path in Settings > Workspace.');
      return;
    }
    const methodName = findTestMethodForDebug();
    if (!methodName) {
      addNotification('error', 'No test method found in this file to debug. Open a .cs file with [Test] methods first.');
      return;
    }
    setDebugStatus('starting');
    setDebugStopDetails(null);
    setDebugThreadId(null);
    try {
      const result = await window.desktop.debugDotnetTest({
        workingDirectory,
        projectPath,
        runSettingsPath: workspaceSettings.testRunSettingsPath?.trim() || undefined,
        testFilter: `Name=${methodName}`,
        logger: workspaceSettings.testRunLogger?.trim() || 'console;verbosity=detailed',
        patToken: workspaceSettings.patToken,
        passPatAsEnv: workspaceSettings.testRunUsePatAsEnv !== false,
        breakOnExceptions: true,
        debugBreakpoints: collectDebugBreakpoints(),
      });
      setDebugRunId(result.runId);
      addNotification('info', `Debug started for ${methodName}.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to start debug session.';
      addNotification('error', message);
      setDebugStatus('idle');
    }
  };

  const stopDebugRun = async () => {
    if (!debugRunId || !window.desktop?.stopDotnetTest) return;
    setDebugStatus('stopping');
    try {
      await window.desktop.stopDotnetTest(debugRunId);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to stop debug session.';
      addNotification('error', message);
    }
  };

  const debuggerContinue = async () => {
    if (!debugRunId || !window.desktop?.debuggerContinue) return;
    await window.desktop.debuggerContinue(debugRunId);
  };
  const debuggerStepOver = async () => {
    if (!debugRunId || !window.desktop?.debuggerNext) return;
    await window.desktop.debuggerNext(debugRunId);
  };
  const debuggerStepIn = async () => {
    if (!debugRunId || !window.desktop?.debuggerStepIn) return;
    await window.desktop.debuggerStepIn(debugRunId);
  };
  const debuggerStepOut = async () => {
    if (!debugRunId || !window.desktop?.debuggerStepOut) return;
    await window.desktop.debuggerStepOut(debugRunId);
  };

  // Subscribe to test-run progress events for our active debug run.
  useEffect(() => {
    if (!window.desktop?.onTestRunProgress) return undefined;
    return window.desktop.onTestRunProgress((progress) => {
      if (debugRunId && progress.runId !== debugRunId) return;
      if (!debugRunId && progress.mode === 'debug') {
        // First event for a debug run we just kicked off
        setDebugRunId(progress.runId);
      }
      const ev = progress.debuggerEvent;
      if (ev?.event === 'stopped') {
        setDebugStatus('paused');
        setDebugThreadId(typeof ev.threadId === 'number' ? ev.threadId : null);
        setDebugStopDetails(ev.details ?? null);
      } else if (ev?.event === 'continued') {
        setDebugStatus('running');
        setDebugStopDetails(null);
      } else if (ev?.event === 'terminated' || ev?.event === 'exited') {
        setDebugStatus('idle');
        setDebugStopDetails(null);
        setDebugThreadId(null);
        setDebugRunId(null);
      }
      if (progress.status === 'complete' || progress.status === 'failed' || progress.status === 'cancelled') {
        setDebugStatus('idle');
        setDebugStopDetails(null);
        setDebugThreadId(null);
        setDebugRunId(null);
      } else if (progress.mode === 'debug' && progress.status === 'running' && !ev) {
        setDebugStatus((cur) => (cur === 'starting' || cur === 'idle' ? 'running' : cur));
      }
    });
  }, [debugRunId]);

  // When the debugger stops, auto-open the source file at the stopped line.
  useEffect(() => {
    if (debugStatus !== 'paused' || !debugStopDetails?.sourcePath) return;
    const target = debugStopDetails.sourcePath;
    const targetLower = target.replace(/\\/g, '/').toLowerCase();
    const currentLower = previewFile?.path.replace(/\\/g, '/').toLowerCase();
    if (currentLower === targetLower) {
      // Same file already open — just reveal the line via pendingJumpRef.
      if (debugStopDetails.line && monacoEditorRef.current) {
        monacoEditorRef.current.revealLineInCenter(debugStopDetails.line);
        monacoEditorRef.current.setPosition({ lineNumber: debugStopDetails.line, column: debugStopDetails.column ?? 1 });
      }
      return;
    }
    pendingJumpRef.current = {
      path: target,
      line: debugStopDetails.line ?? 1,
      column: debugStopDetails.column ?? 1,
    };
    void loadFilePreview(target);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debugStatus, debugStopDetails]);

  // ---------- External filesystem watcher ----------
  // When the modal is open with a repoPath, watch the tree so external changes
  // (git pull, external editor, etc.) auto-refresh the affected directory and
  // git status. Debounced in the main process; we also coalesce repeated
  // events for the same dir on the renderer side to avoid thrashing.
  useEffect(() => {
    if (!repoPath || !window.desktop?.watchRepo) return;
    let cancelled = false;
    const pendingDirRefresh = new Set<string>();
    let flushTimer: number | null = null;
    const scheduleFlush = () => {
      if (flushTimer !== null) return;
      flushTimer = window.setTimeout(() => {
        flushTimer = null;
        const dirs = Array.from(pendingDirRefresh);
        pendingDirRefresh.clear();
        // Only refresh dirs we've already loaded — no need to fetch unseen ones.
        dirs.forEach((dir) => {
          if (nodesByPath[dir]) {
            void loadPath(dir, true);
          }
        });
      }, 250);
    };

    void window.desktop.watchRepo(repoPath);

    const offFs = window.desktop.onRepoFsChanged?.((payload) => {
      if (cancelled) return;
      if (payload.rootPath !== repoPath) return;
      pendingDirRefresh.add(payload.dirPath);
      scheduleFlush();
    });
    const offGit = window.desktop.onRepoGitChanged?.((payload) => {
      if (cancelled) return;
      if (payload.rootPath !== repoPath) return;
      void loadGitStatus(repoPath);
    });

    return () => {
      cancelled = true;
      if (flushTimer !== null) window.clearTimeout(flushTimer);
      offFs?.();
      offGit?.();
      void window.desktop?.unwatchRepo?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repoPath]);

  // Mark window as dirty for the global close-handler
  useEffect(() => {
    window.desktop?.setUnsavedChanges?.('selenium-repo-edit', isDirty);
    return () => {
      window.desktop?.setUnsavedChanges?.('selenium-repo-edit', false);
    };
  }, [isDirty]);

  // Quick Open: build a flat index of all files under the repo on first open.
  // Walks recursively but skips hidden/system folders. Uses existing listDirectory IPC.
  const buildQuickOpenIndex = async () => {
    if (!window.desktop?.listDirectory || !repoPath) return;
    if (indexedRefRoot.current === repoPath) return; // already indexed this root
    setIsIndexing(true);
    const SKIP_NAMES = new Set([
      'bin', 'obj', 'node_modules', 'packages',
      'dist', 'build', 'out', '.cache',
      'testresults', '.testresults',
      '.git', '.vs', '.vscode', '.idea', '.svn', '.hg', '.next',
    ]);
    const collected: FileItem[] = [];
    // Cap to avoid runaway scans on huge repos
    const MAX_FILES = 5000;
    const MAX_DEPTH = 15;
    const visit = async (dir: string, depth: number): Promise<void> => {
      if (collected.length >= MAX_FILES || depth > MAX_DEPTH) return;
      let entries: DesktopDirectoryEntry[] = [];
      try {
        entries = await window.desktop!.listDirectory!(dir);
      } catch {
        return;
      }
      for (const entry of entries) {
        const lower = entry.name.toLowerCase();
        if (SKIP_NAMES.has(lower) || entry.name.startsWith('.')) continue;
        if (entry.type === 'file') {
          if (collected.length >= MAX_FILES) return;
          // Display dir relative to repo root for readability
          const rel = entry.path.startsWith(repoPath)
            ? entry.path.substring(repoPath.length).replace(/^[\\/]+/, '')
            : entry.path;
          const lastSep = Math.max(rel.lastIndexOf('/'), rel.lastIndexOf('\\'));
          collected.push({
            path: entry.path,
            name: entry.name,
            dirPath: lastSep >= 0 ? rel.substring(0, lastSep) : '',
          });
        } else if (entry.type === 'directory') {
          await visit(entry.path, depth + 1);
        }
      }
    };
    try {
      await visit(repoPath, 0);
      // Sort alphabetically by filename — base order for empty-query state
      collected.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
      setQuickOpenIndex(collected);
      indexedRefRoot.current = repoPath;
    } finally {
      setIsIndexing(false);
    }
  };

  // Ctrl+P / Cmd+P → open Quick Open
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 'P') && !e.shiftKey && !e.altKey) {
        // Don't steal from a print dialog inside an iframe etc.
        e.preventDefault();
        setIsQuickOpenOpen(true);
        void buildQuickOpenIndex();
      } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'f' || e.key === 'F') && !e.altKey) {
        e.preventDefault();
        setIsFindInFilesOpen(true);
      } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'p' || e.key === 'P') && !e.altKey) {
        e.preventDefault();
        setIsCommandPaletteOpen(true);
      } else if (e.key === 'F9' && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
        // F9 toggles breakpoint at the editor's current cursor line (refs so we don't re-bind).
        const path = previewFilePathRef.current;
        if (path && toggleBreakpointRef.current) {
          e.preventDefault();
          toggleBreakpointRef.current(path, cursorPosRef.current.line);
        }
      } else if (e.key === 'F5' && !e.altKey && !e.ctrlKey && !e.metaKey) {
        // F5 = Continue (when paused) or Start Debug (when idle). Shift+F5 = Stop.
        const handlers = debugHandlersRef.current;
        if (!handlers) return;
        if (e.shiftKey) {
          if (debugStatusRef.current !== 'idle') {
            e.preventDefault();
            void handlers.stop();
          }
        } else if (debugStatusRef.current === 'paused') {
          e.preventDefault();
          void handlers.cont();
        } else if (debugStatusRef.current === 'idle') {
          e.preventDefault();
          void handlers.start();
        }
      } else if (e.key === 'F10' && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
        if (debugStatusRef.current === 'paused' && debugHandlersRef.current) {
          e.preventDefault();
          void debugHandlersRef.current.over();
        }
      } else if (e.key === 'F11' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (debugStatusRef.current === 'paused' && debugHandlersRef.current) {
          e.preventDefault();
          if (e.shiftKey) void debugHandlersRef.current.out();
          else void debugHandlersRef.current.inFn();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repoPath]);

  const rootNode = useMemo(() => nodesByPath[repoPath], [nodesByPath, repoPath]);
  const isClassFile = (entry: DesktopDirectoryEntry) => entry.type === 'file' && entry.name.toLowerCase().endsWith('.cs');

  // Hide system / build folders that clutter the tree
  const HIDDEN_NAMES = new Set([
    'bin', 'obj', 'node_modules', 'packages',
    'dist', 'build', 'out', '.cache',
    'testresults', '.testresults',
    '.git', '.vs', '.vscode', '.idea', '.svn', '.hg', '.next',
  ]);
  const isHiddenEntry = (entry: DesktopDirectoryEntry): boolean => {
    const lower = entry.name.toLowerCase();
    if (HIDDEN_NAMES.has(lower)) return true;
    // Hide other dotfiles/dotfolders
    if (entry.name.startsWith('.')) return true;
    return false;
  };
  const getEntryClassName = (entryName: string) => entryName.replace(/\.cs$/i, '');
  const currentMethodName = associatedMethodName || generatedMethodName;
  const hasMatchingMethodAnywhere = useMemo(
    () => Boolean(
      currentMethodName
        && Object.values(fileTestNamesByPath).some((state) => state.names.includes(currentMethodName)),
    ),
    [currentMethodName, fileTestNamesByPath],
  );

  const loadPath = async (targetPath: string, forceRefresh = false) => {
    if (!window.desktop?.listDirectory) {
      const message = 'Desktop repo browser is unavailable. Restart the app to load the latest Electron changes.';
      setNodesByPath((current) => ({
        ...current,
        [targetPath]: {
          entries: current[targetPath]?.entries ?? [],
          loading: false,
          error: message,
        },
      }));
      addNotification('error', message);
      return;
    }

    if (!forceRefresh && nodesByPath[targetPath]?.loading) {
      return;
    }

    setNodesByPath((current) => ({
      ...current,
      [targetPath]: {
        entries: forceRefresh ? [] : current[targetPath]?.entries ?? [],
        loading: true,
        error: null,
      },
    }));

    try {
      const entries = await window.desktop?.listDirectory?.(targetPath);
      const resolvedEntries = entries ?? [];
      setNodesByPath((current) => ({
        ...current,
        [targetPath]: {
          entries: resolvedEntries,
          loading: false,
          error: null,
        },
      }));

      const classFiles = resolvedEntries.filter((entry) => isClassFile(entry));
      classFiles.forEach((entry) => {
        void loadFileTestNames(entry.path, forceRefresh);
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load folder contents.';
      setNodesByPath((current) => ({
        ...current,
        [targetPath]: {
          entries: current[targetPath]?.entries ?? [],
          loading: false,
          error: message,
        },
      }));
      addNotification('error', message);
    }
  };

  const loadFileTestNames = async (targetPath: string, forceRefresh = false) => {
    if (!window.desktop?.readTextFile) {
      return;
    }

    if (!forceRefresh && fileTestNamesByPath[targetPath]) {
      return;
    }

    setFileTestNamesByPath((current) => ({
      ...current,
      [targetPath]: {
        loading: true,
        names: forceRefresh ? [] : current[targetPath]?.names ?? [],
      },
    }));

    try {
      const content = await window.desktop.readTextFile(targetPath);
      const names = extractTestMethodNames(content);
      setFileTestNamesByPath((current) => ({
        ...current,
        [targetPath]: {
          loading: false,
          names,
        },
      }));
    } catch {
      setFileTestNamesByPath((current) => ({
        ...current,
        [targetPath]: {
          loading: false,
          names: current[targetPath]?.names ?? [],
        },
      }));
    }
  };

  const findMethodInRepo = async (methodName: string) => {
    if (!methodName) {
      return;
    }

    setMethodSearch({
      loading: true,
      methodName,
    });

    if (window.desktop?.findTestMethod) {
      try {
        const result = await window.desktop.findTestMethod(repoPath, methodName);
        setMethodSearch({
          loading: false,
          methodName,
        });

        if (!result.found || !result.filePath) {
          return;
        }

        const matchingFilePath = result.filePath;
        const ancestorPaths = getAncestorDirectoryPaths(repoPath, matchingFilePath);
        await Promise.all(ancestorPaths.map((ancestorPath) => loadPath(ancestorPath, true)));
        await loadFileTestNames(matchingFilePath, true);

        setExpandedPaths((current) => {
          const next = new Set(current);
          ancestorPaths.forEach((ancestorPath) => {
            if (!userCollapsedRef.current.has(ancestorPath)) next.add(ancestorPath);
          });
          if (!userCollapsedRef.current.has(matchingFilePath)) next.add(matchingFilePath);
          return next;
        });
        return;
      } catch {
        // Fall back to the older renderer-side scan if the backend helper is unavailable.
      }
    }

    if (!window.desktop?.listDirectory || !window.desktop?.readTextFile) {
      setMethodSearch({
        loading: false,
        methodName,
      });
      return;
    }

    const desktop = window.desktop;

    const visitedPaths = new Set<string>();
    let scannedFiles = 0;

    const scanDirectory = async (targetPath: string): Promise<string | null> => {
      if (visitedPaths.has(targetPath)) {
        return null;
      }
      visitedPaths.add(targetPath);

      let entries: DesktopDirectoryEntry[];
      try {
        entries = await desktop.listDirectory!(targetPath);
      } catch {
        return null;
      }

      setNodesByPath((current) => ({
        ...current,
        [targetPath]: {
          entries,
          loading: false,
          error: null,
        },
      }));

      for (const entry of entries) {
        if (isClassFile(entry)) {
          try {
            const content = await desktop.readTextFile!(entry.path);
            scannedFiles += 1;
            const names = extractTestMethodNames(content);
            setFileTestNamesByPath((current) => ({
              ...current,
              [entry.path]: {
                loading: false,
                names,
              },
            }));

            if (names.includes(methodName)) {
              return entry.path;
            }
          } catch {
            // Keep scanning the rest of the repository.
          }
        }
      }

      for (const entry of entries) {
        if (entry.type !== 'directory') {
          continue;
        }

        const matchingPath = await scanDirectory(entry.path);
        if (matchingPath) {
          return matchingPath;
        }
      }

      return null;
    };

    const matchingFilePath = await scanDirectory(repoPath);
    setMethodSearch({
      loading: false,
      methodName,
    });

    if (!matchingFilePath) {
      return;
    }

    setExpandedPaths((current) => {
      const next = new Set(current);
      getAncestorDirectoryPaths(repoPath, matchingFilePath).forEach((ancestorPath) => {
        if (!userCollapsedRef.current.has(ancestorPath)) next.add(ancestorPath);
      });
      if (!userCollapsedRef.current.has(matchingFilePath)) next.add(matchingFilePath);
      return next;
    });
  };

  const loadGitBranch = async (targetPath: string) => {
    if (!window.desktop?.getGitBranch) {
      setGitBranch({
        loading: false,
        branch: null,
        isGitRepository: false,
        gitAvailable: false,
        branches: [],
        message: 'Restart the app to load branch support.',
      });
      return;
    }

    setGitBranch((current) => ({
      ...current,
      loading: true,
    }));

    try {
      const info = await window.desktop.getGitBranch(targetPath);
      setGitBranch({
        loading: false,
        branch: info.branch,
        isGitRepository: info.isGitRepository,
        gitAvailable: info.gitAvailable,
        branches: info.branches,
        message: info.message,
      });
    } catch (error) {
      setGitBranch({
        loading: false,
        branch: null,
        isGitRepository: false,
        gitAvailable: false,
        branches: [],
        message: error instanceof Error ? error.message : 'Git branch lookup failed.',
      });
    }
  };

  const loadGitStatus = async (targetPath: string) => {
    if (!window.desktop?.getGitStatus) {
      return;
    }

    try {
      const status = await window.desktop.getGitStatus(targetPath);
      const mapToGitFile = (file: DesktopGitChangedFile): GitFile => ({
        ...file,
        status: normalizeGitStatus(file.status),
      });
      // Untracked files (newly created, not yet in git) display as 'A' (Added)
      // for consistency with newly-staged files. Tooltip clarifies the difference.
      const mapUntrackedToGitFile = (file: DesktopGitChangedFile): GitFile => ({
        ...file,
        status: 'A',
      });

      setGitStatus({
        unstagedFiles: [
          ...(status.unstaged || []).map(mapToGitFile),
          ...(status.untracked || []).map(mapUntrackedToGitFile),
        ],
        stagedFiles: (status.staged || []).map(mapToGitFile),
        aheadCount: status.aheadCount || 0,
        behindCount: status.behindCount || 0,
      });
    } catch {
      setGitStatus({
        unstagedFiles: [],
        stagedFiles: [],
        aheadCount: 0,
        behindCount: 0,
      });
    }
  };

  // Recursively load every (non-hidden) directory under the repo root and add
  // it to expandedPaths so the entire tree opens — even subdirs that the user
  // has never clicked into. Called by Expand-All in toolbar / command palette.
  const expandAllRecursively = async () => {
    if (!window.desktop?.listDirectory) return;
    userCollapsedRef.current.clear();
    const visited = new Set<string>();
    const allDirs: string[] = [];
    const queue: string[] = [repoPath];
    // BFS with a soft cap to avoid runaway loads on huge repos.
    const MAX = 500;
    while (queue.length > 0 && visited.size < MAX) {
      const dir = queue.shift();
      if (!dir || visited.has(dir)) continue;
      visited.add(dir);
      allDirs.push(dir);
      try {
        // Reuse the cached listing if present; otherwise hit disk.
        let entries = nodesByPath[dir]?.entries;
        if (!entries || entries.length === 0) {
          entries = await window.desktop.listDirectory(dir);
          if (entries) {
            setNodesByPath((current) => ({
              ...current,
              [dir]: { entries: entries ?? [], loading: false, error: null },
            }));
          }
        }
        (entries ?? []).forEach((entry) => {
          if (entry.type !== 'directory') return;
          const lower = entry.name.toLowerCase();
          // Skip system / build folders so we don't blow open node_modules etc.
          if (HIDDEN_NAMES.has(lower) || entry.name.startsWith('.')) return;
          queue.push(entry.path);
        });
      } catch {
        // Ignore individual folder failures; continue the walk.
      }
    }
    setExpandedPaths(new Set(allDirs));
  };

  const reloadRepository = async () => {
    setNodesByPath({});
    setFileTestNamesByPath({});
    setExpandedPaths(new Set([repoPath]));
    userCollapsedRef.current.clear();
    await Promise.all([
      loadPath(repoPath, true),
      loadGitBranch(repoPath),
      loadGitStatus(repoPath),
    ]);
  };

  const handleBranchChange = async (branchValue: string) => {
    if (!branchValue || branchSwitching) {
      return;
    }

    const [type, ...nameParts] = branchValue.split(':');
    const name = nameParts.join(':');
    if ((type !== 'local' && type !== 'remote') || !name) {
      return;
    }

    const selectedBranch = gitBranch.branches.find((branch) => branch.type === type && branch.name === name);
    if (!selectedBranch || selectedBranch.current) {
      return;
    }

    if (!window.desktop?.switchGitBranch) {
      addNotification('error', 'Branch switching is unavailable. Restart the app to load the latest Electron changes.');
      return;
    }

    setBranchSwitching(true);
    try {
      const info = await window.desktop.switchGitBranch(repoPath, {
        name: selectedBranch.name,
        type: selectedBranch.type,
      });

      if (info.requiresCommit) {
        setPendingBranchSwitch({
          branch: selectedBranch,
          changedFiles: info.changedFiles ?? [],
        });
        // Populate the Git Manager's CHANGES section from the changedFiles so
        // user can see/stage/commit them. Also call loadGitStatus in case the
        // desktop API provides more detailed staged/unstaged separation.
        const changedAsGitFiles: GitFile[] = (info.changedFiles ?? []).map((f) => ({
          ...f,
          status: normalizeGitStatus(f.status),
        }));
        // Fully reset the status to avoid stale staged/aheadCount from previous branch
        setGitStatus({
          unstagedFiles: changedAsGitFiles,
          stagedFiles: [],
          aheadCount: 0,
          behindCount: 0,
        });
        void loadGitBranch(repoPath);
        void loadGitStatus(repoPath);
        return;
      }

      setGitBranch({
        loading: false,
        branch: info.branch,
        isGitRepository: info.isGitRepository,
        gitAvailable: info.gitAvailable,
        branches: info.branches,
        message: info.message,
      });
      await reloadRepository();
      addNotification('success', `Switched to ${info.branch ?? selectedBranch.name}.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to switch branch.';
      addNotification('error', message);
      void loadGitBranch(repoPath);
    } finally {
      setBranchSwitching(false);
    }
  };

  const handleCommitAndSwitchBranch = async () => {
    if (!pendingBranchSwitch || !window.desktop?.switchGitBranch) {
      return;
    }

    setBranchSwitching(true);
    try {
      const info = await window.desktop.switchGitBranch(repoPath, {
        name: pendingBranchSwitch.branch.name,
        type: pendingBranchSwitch.branch.type,
        allowCommit: true,
      });
      setPendingBranchSwitch(null);
      setGitBranch({
        loading: false,
        branch: info.branch,
        isGitRepository: info.isGitRepository,
        gitAvailable: info.gitAvailable,
        branches: info.branches,
        message: info.message,
      });
      await reloadRepository();
      addNotification('success', `Committed local changes and switched to ${info.branch ?? pendingBranchSwitch.branch.name}.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to commit changes and switch branch.';
      addNotification('error', message);
      void loadGitBranch(repoPath);
    } finally {
      setBranchSwitching(false);
    }
  };

  const handleStashAndSwitchBranch = async () => {
    if (!pendingBranchSwitch || !window.desktop?.gitStash || !window.desktop?.switchGitBranch) {
      addNotification('error', 'Stash unavailable. Restart the app to load latest changes.');
      return;
    }
    setBranchSwitching(true);
    try {
      // Stash all working-tree + untracked changes
      const stashResult = await window.desktop.gitStash(repoPath, {
        message: `Auto-stash before switching to ${pendingBranchSwitch.branch.name}`,
      });
      if (!stashResult?.success) {
        throw new Error(stashResult?.error || stashResult?.message || 'Failed to stash changes');
      }
      // Now safe to switch branch
      const info = await window.desktop.switchGitBranch(repoPath, {
        name: pendingBranchSwitch.branch.name,
        type: pendingBranchSwitch.branch.type,
      });
      setPendingBranchSwitch(null);
      setGitBranch({
        loading: false,
        branch: info.branch,
        isGitRepository: info.isGitRepository,
        gitAvailable: info.gitAvailable,
        branches: info.branches,
        message: info.message,
      });
      await reloadRepository();
      addNotification('success', `Stashed changes and switched to ${info.branch ?? pendingBranchSwitch.branch.name}. Use Stash Pop to restore them.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to stash changes and switch branch.';
      addNotification('error', message);
      void loadGitBranch(repoPath);
    } finally {
      setBranchSwitching(false);
    }
  };

  useEffect(() => {
    void reloadRepository();
  }, [repoPath, refreshToken]);

  // Auto-refresh git status every 4s so the Git Manager always reflects the
  // current repo state (changes from external edits, branch ops, etc.).
  // Also re-fetch when the window regains focus.
  useEffect(() => {
    if (!repoPath) return;
    let cancelled = false;
    const tick = () => {
      if (!cancelled && document.visibilityState === 'visible') {
        void loadGitStatus(repoPath);
      }
    };
    const intervalId = window.setInterval(tick, 4000);
    const handleFocus = () => {
      if (!cancelled) void loadGitStatus(repoPath);
    };
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repoPath]);

  useEffect(() => {
    if (!currentMethodName) {
      return;
    }

    void findMethodInRepo(currentMethodName);
  }, [currentMethodName, repoPath, refreshToken]);

  useEffect(() => {
    if (!currentMethodName) {
      return;
    }

    const matchingPath = Object.entries(fileTestNamesByPath).find(([, state]) => state.names.includes(currentMethodName))?.[0];
    if (!matchingPath) {
      return;
    }

    setExpandedPaths((current) => {
      if (current.has(matchingPath)) {
        return current;
      }
      // Honor explicit user-collapse so we don't silently re-expand it.
      if (userCollapsedRef.current.has(matchingPath)) return current;
      const next = new Set(current);
      next.add(matchingPath);
      return next;
    });
  }, [currentMethodName, fileTestNamesByPath]);

  // Auto-open the matching class file in PREVIEW when navigating from Test
  // Details (manage-automation mode) and the test method is already known to
  // exist somewhere in the repo. The user shouldn't have to manually click the
  // file in the tree just to see code they've already associated.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const previewAutoOpenedRef = useRef<string | null>(null);
  useEffect(() => {
    if (mode !== 'manage-automation') return;
    if (!currentMethodName) return;
    if (previewFile?.path) return; // user already has something open
    const matchingPath = Object.entries(fileTestNamesByPath).find(
      ([, state]) => state.names.includes(currentMethodName),
    )?.[0];
    if (!matchingPath) return;
    if (previewAutoOpenedRef.current === matchingPath) return;
    previewAutoOpenedRef.current = matchingPath;
    // Pre-stash a jump so the file opens with the cursor on the matching method.
    // The line will be resolved against the LOADED content via a follow-up effect
    // below — here we just reserve the slot with line:1 as a fallback.
    pendingJumpRef.current = { path: matchingPath, line: 1, column: 1 };
    void loadFilePreview(matchingPath);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, currentMethodName, fileTestNamesByPath, previewFile?.path]);

  // When the user types a search term, auto-expand any class file whose method
  // names match. Only active in manage-automation mode where the user is hunting
  // for a specific method; in browse mode (from Plan list) we keep the tree
  // calm and let the user expand class files explicitly.
  useEffect(() => {
    if (mode !== 'manage-automation') return;
    const term = searchTerm.trim().toLowerCase();
    if (term.length === 0) return;
    const filesToExpand: string[] = [];
    Object.entries(fileTestNamesByPath).forEach(([filePath, state]) => {
      if (state.names.some((name) => name.toLowerCase().includes(term))) {
        filesToExpand.push(filePath);
      }
    });
    if (filesToExpand.length === 0) return;
    setExpandedPaths((current) => {
      const next = new Set(current);
      let changed = false;
      filesToExpand.forEach((p) => {
        if (!next.has(p) && !userCollapsedRef.current.has(p)) {
          next.add(p);
          changed = true;
        }
        // Also expand all ancestor directories
        getAncestorDirectoryPaths(repoPath, p).forEach((ancestor) => {
          if (!next.has(ancestor) && !userCollapsedRef.current.has(ancestor)) {
            next.add(ancestor);
            changed = true;
          }
        });
      });
      return changed ? next : current;
    });
  }, [mode, searchTerm, fileTestNamesByPath, repoPath]);

  // Auto-load all unloaded directories during search so the strict filter has
  // complete data to evaluate. Avoids "false matches" of unloaded folders.
  useEffect(() => {
    const term = searchTerm.trim();
    if (term.length === 0) return;
    // Walk through all loaded directories and load any of their unloaded subdirs.
    // This cascades: as new dirs load, this effect re-runs and loads deeper dirs.
    Object.values(nodesByPath).forEach((node) => {
      node.entries.forEach((entry) => {
        if (entry.type === 'directory' && !nodesByPath[entry.path]) {
          // Skip system folders (matches isHiddenEntry pattern)
          const lower = entry.name.toLowerCase();
          if (HIDDEN_NAMES.has(lower) || entry.name.startsWith('.')) return;
          void loadPath(entry.path);
        }
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, nodesByPath]);

  // Auto-expand directories that contain matches during search, so users see
  // the matched items immediately without needing to manually expand parents.
  useEffect(() => {
    const term = searchTerm.trim().toLowerCase();
    if (term.length === 0) return;
    const dirsToExpand: string[] = [];
    Object.entries(nodesByPath).forEach(([dirPath, state]) => {
      const hasMatch = state.entries.some((e) => e.name.toLowerCase().includes(term));
      if (hasMatch) {
        dirsToExpand.push(dirPath);
        getAncestorDirectoryPaths(repoPath, dirPath).forEach((a) => dirsToExpand.push(a));
      }
    });
    if (dirsToExpand.length === 0) return;
    setExpandedPaths((current) => {
      const next = new Set(current);
      let changed = false;
      dirsToExpand.forEach((p) => {
        if (!next.has(p) && !userCollapsedRef.current.has(p)) {
          next.add(p);
          changed = true;
        }
      });
      return changed ? next : current;
    });
  }, [searchTerm, nodesByPath, repoPath]);

  useEffect(() => {
    if (!currentMethodName) {
      return;
    }

    const matchingPath = Object.entries(fileTestNamesByPath).find(([, state]) => state.names.includes(currentMethodName))?.[0];
    if (!matchingPath) {
      return;
    }

    const targetKey = `${matchingPath}:${currentMethodName}`;
    const targetRow = methodRowRefs.current[targetKey];
    targetRow?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [currentMethodName, expandedPaths, fileTestNamesByPath]);

  useEffect(() => {
    if (embedded) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [embedded, onClose]);

  // Tracks paths the user has explicitly collapsed. Auto-expand effects (search,
  // method discovery, etc.) honor this set so they never re-open something the
  // user just clicked closed — eliminates the "click does nothing" feel.
  const userCollapsedRef = useRef<Set<string>>(new Set());
  const toggleNode = (targetPath: string) => {
    setExpandedPaths((current) => {
      const next = new Set(current);
      if (next.has(targetPath)) {
        next.delete(targetPath);
        userCollapsedRef.current.add(targetPath);
      } else {
        next.add(targetPath);
        userCollapsedRef.current.delete(targetPath);
      }
      return next;
    });

    const targetNodeEntries = nodesByPath[targetPath]?.entries ?? [];
    const isKnownFilePath = fileTestNamesByPath[targetPath] !== undefined
      || (targetNodeEntries.length === 0 && targetPath.toLowerCase().endsWith('.cs'));

    if (!isKnownFilePath && !nodesByPath[targetPath] && targetPath !== repoPath) {
      void loadPath(targetPath);
    }
  };

  const normalizedSearch = searchTerm.trim().toLowerCase();

  const entryMatchesSearch = (entry: DesktopDirectoryEntry): boolean => {
    if (normalizedSearch.length === 0) {
      return true;
    }

    if (entry.name.toLowerCase().includes(normalizedSearch)) {
      return true;
    }

    if (isClassFile(entry)) {
      const methodNames = fileTestNamesByPath[entry.path]?.names ?? [];
      return methodNames.some((name) => name.toLowerCase().includes(normalizedSearch));
    }

    if (entry.type === 'directory') {
      const childNode = nodesByPath[entry.path];
      // Strict filter: directory shows only if loaded AND contains matches.
      // The auto-loader effect (below) loads unloaded directories during search.
      if (!childNode) {
        return false;
      }
      return childNode.entries.some((childEntry) => entryMatchesSearch(childEntry));
    }

    return false;
  };

  const entryMatchesManageScope = (entry: DesktopDirectoryEntry): boolean => {
    if (mode !== 'manage-automation') {
      return true;
    }

    if (!hasMatchingMethodAnywhere) {
      return true;
    }

    if (entry.type === 'directory') {
      const childNode = nodesByPath[entry.path];
      if (!childNode) {
        return false;
      }
      return childNode.entries.some((childEntry) => entryMatchesManageScope(childEntry));
    }

    if (isClassFile(entry)) {
      const className = getEntryClassName(entry.name);
      const methodNames = fileTestNamesByPath[entry.path]?.names ?? [];
      return methodNames.includes(currentMethodName) || associatedClassName === className;
    }

    return false;
  };

  const renderEntries = (targetPath: string, depth = 0) => {
    const node = nodesByPath[targetPath];
    if (!node) {
      return null;
    }

    if (node.loading && node.entries.length === 0) {
      return <div className="repo-browser__state">Loading folder contents...</div>;
    }

    if (node.error) {
      return <div className="repo-browser__state repo-browser__state--error">{node.error}</div>;
    }

    if (node.entries.length === 0) {
      return <div className="repo-browser__state">This folder is empty.</div>;
    }

    return (
      <div className="repo-browser__tree">
        {node.entries.map((entry) => {
          const isDirectory = entry.type === 'directory';
          const isExpanded = expandedPaths.has(entry.path);
          const fileTestsState = fileTestNamesByPath[entry.path];
          const canExpandClassFile = isClassFile(entry);
          const entryClassName = getEntryClassName(entry.name);
          const fileMatchesSearch = entryMatchesSearch(entry);
          const fileMatchesManageScope = entryMatchesManageScope(entry);
          const isAssociatedClass = associatedClassName === entryClassName;
          const currentMethodExistsInFile = Boolean(currentMethodName && fileTestsState?.names.includes(currentMethodName));
          const visibleMethodNames = mode === 'manage-automation'
            ? fileTestsState?.names.filter((name) => name === currentMethodName) ?? []
            : fileTestsState?.names ?? [];

          if (!fileMatchesSearch || !fileMatchesManageScope) {
            return null;
          }

          // Hide system / build folders (.git, bin, obj, node_modules, etc.)
          if (isHiddenEntry(entry)) {
            return null;
          }

          return (
            <div key={entry.path}>
              <div
                className="repo-browser__row"
                style={{ paddingLeft: `${depth * 18}px` }}
              >
                {isDirectory ? (
                  <button
                    type="button"
                    className="repo-browser__item"
                    onClick={() => toggleNode(entry.path)}
                    onContextMenu={(e) => openTreeContextMenu(e, entry, targetPath)}
                  >
                    <span className={`repo-browser__chevron${isExpanded ? ' is-expanded' : ''}`} aria-hidden="true">
                      <IconChevronRight size={14} />
                    </span>
                    {isExpanded ? <IconFolderOpen size={16} /> : <IconFolder size={16} />}
                    <span className="repo-browser__label">{entry.name}</span>
                  </button>
                ) : canExpandClassFile ? (
                  <div
                    className={`repo-browser__item repo-browser__item--file is-clickable${isAssociatedClass ? ' is-selected' : ''}${previewFile?.path === entry.path ? ' is-preview-active' : ''}`}
                    onClick={() => void loadFilePreview(entry.path)}
                    onContextMenu={(e) => openTreeContextMenu(e, entry, targetPath)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        void loadFilePreview(entry.path);
                      }
                    }}
                  >
                    <button
                      type="button"
                      className={`repo-browser__toggle-btn${isExpanded ? ' is-expanded' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleNode(entry.path);
                      }}
                      title={isExpanded ? 'Collapse class file' : 'Expand class file'}
                    >
                      <IconChevronRight size={14} />
                    </button>
                    <IconDescription size={16} />
                    <span className="repo-browser__item-copy">
                      <span className="repo-browser__label">{entry.name}</span>
                      <span className="repo-browser__meta">
                        {mode === 'manage-automation'
                          ? currentMethodExistsInFile
                            ? 'Current test method found'
                            : 'Current test method not found'
                          : fileTestsState?.loading
                            ? 'Loading tests...'
                            : fileTestsState && fileTestsState.names.length > 0
                              ? `${fileTestsState.names.length} test${fileTestsState.names.length > 1 ? 's' : ''}`
                              : 'No tests found'}
                      </span>
                    </span>
                    {/* "Write code" button removed from tree — action now lives in the
                        contextual banner inside the PREVIEW panel where it has more space
                        and clearer labeling. */}
                  </div>
                ) : (
                  <div
                    className={`repo-browser__item repo-browser__item--file is-clickable${previewFile?.path === entry.path ? ' is-preview-active' : ''}`}
                    title={entry.path}
                    onClick={() => void loadFilePreview(entry.path)}
                    onContextMenu={(e) => openTreeContextMenu(e, entry, targetPath)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        void loadFilePreview(entry.path);
                      }
                    }}
                  >
                    <span className="repo-browser__chevron repo-browser__chevron--placeholder" aria-hidden="true" />
                    <IconDescription size={16} />
                    <span className="repo-browser__item-copy">
                      <span className="repo-browser__label">{entry.name}</span>
                    </span>
                  </div>
                )}
              </div>
              {canExpandClassFile && isExpanded && (
                <div className="repo-browser__method-group" style={{ paddingLeft: `${(depth + 1) * 18}px` }}>
                  {fileTestsState?.loading ? (
                    <div className="repo-browser__state">Loading tests...</div>
                  ) : visibleMethodNames.length > 0 ? (
                    visibleMethodNames
                      .filter((name) => normalizedSearch.length === 0 || name.toLowerCase().includes(normalizedSearch) || entry.name.toLowerCase().includes(normalizedSearch))
                      .map((name) => (
                      <div
                        key={`${entry.path}:${name}`}
                        ref={(element) => {
                          methodRowRefs.current[`${entry.path}:${name}`] = element;
                        }}
                        className={`repo-browser__method-row${associatedMethodName === name && isAssociatedClass ? ' is-selected' : ''}`}
                      >
                        <span className="repo-browser__chevron repo-browser__chevron--placeholder" aria-hidden="true" />
                        <span className="material-symbols repo-browser__method-icon" aria-hidden="true">function</span>
                        <span className="repo-browser__label">{name}</span>
                        {/* Link / unlink icons removed from tree — actions now live in
                            the contextual banner inside the PREVIEW panel. */}
                      </div>
                    ))
                  ) : mode === 'manage-automation' ? (
                    <div className="repo-browser__state">
                      Test script is not available for the current test.
                    </div>
                  ) : (
                    <div className="repo-browser__state">No tests found in this class.</div>
                  )}
                </div>
              )}
              {isDirectory && isExpanded && renderEntries(entry.path, depth + 1)}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div
      className={embedded ? 'settings-page' : 'settings-overlay'}
      role={embedded ? undefined : 'dialog'}
      aria-modal={embedded ? undefined : true}
      aria-label="Selenium repo browser"
    >
      {!embedded && (
        <button
          type="button"
          className="settings-overlay__backdrop"
          onClick={onClose}
          aria-label="Close Selenium repo browser"
        />
      )}
      <div className={`settings-dock settings-dock--no-aside${embedded ? ' settings-dock--embedded-page' : ' settings-dock--repo-browser-modal'}`}>
        <section className="settings-workbench repo-browser">
          <header className="settings-workbench__header">
            <div>
              <p className="settings-workbench__crumb">Selenium Scripts / Repo Browser</p>
              <h1 className="settings-workbench__title">Automation Repo</h1>
              <p className="settings-workbench__subtitle">{repoPath}</p>
            </div>
            <div className="repo-browser__header-actions">
              {!embedded && (
                <button
                  type="button"
                  className="settings-workbench__close"
                  onClick={onClose}
                  aria-label="Close Selenium repo browser"
                  title="Close Selenium repo browser"
                >
                  <IconX size={18} />
                </button>
              )}
            </div>
          </header>

          <div
            className={`repo-browser__split-pane${mode === 'manage-automation' ? ' repo-browser__split-pane--no-git' : ''}`}
            ref={splitPaneRef}
            style={{
              // In manage-automation mode, REPO panel gets the saved left + half of right's
              // width so the header (REPO + search + 2 buttons) fits on one line. Middle
              // (preview) gets the remaining space.
              gridTemplateColumns:
                mode === 'manage-automation'
                  ? `${panelWidths.left + Math.floor(panelWidths.right / 2)}fr 2px ${panelWidths.middle + Math.ceil(panelWidths.right / 2)}fr`
                  : `${panelWidths.left}fr 2px ${panelWidths.middle}fr 2px ${panelWidths.right}fr`,
            }}
          >
            {/* Left Panel: Repo Manager */}
            <div className="repo-browser__left-panel">
              <section className="settings-pane">
                <div className="settings-panel">
                  <div className="settings-panel__head">
                    <div>
                      <h3 className="settings-panel__title">REPO</h3>
                      <p className="settings-panel__sub">
                        {mode === 'manage-automation'
                          ? 'Browse classes, write the generated test method, and manage the Azure test association from the tree.'
                          : 'Browse folders and files from the configured Selenium workspace or repository.'}
                      </p>
                      {/* Repo-scan status moved next to preview filename to avoid
                          taking vertical space in the narrow REPO header. */}
                    </div>
                    <div className="repo-browser__header-actions">
                      <button
                        type="button"
                        className="btn btn--secondary btn--sm"
                        onClick={() => {
                          setIsQuickOpenOpen(true);
                          void buildQuickOpenIndex();
                        }}
                        title="Go to File (Ctrl+P)"
                        aria-label="Go to File"
                      >
                        <span className="material-symbols" aria-hidden="true">description</span>
                      </button>
                      <button
                        type="button"
                        className="btn btn--secondary btn--sm"
                        onClick={() => setIsFindInFilesOpen(true)}
                        title="Find in Files (Ctrl+Shift+F)"
                        aria-label="Find in Files"
                      >
                        <span className="material-symbols" aria-hidden="true">manage_search</span>
                      </button>
                      <button
                        type="button"
                        className="btn btn--secondary btn--sm"
                        onClick={() => {
                          void reloadRepository();
                        }}
                        title="Refresh repo browser"
                      >
                        <IconRefresh size={16} />
                      </button>
                      {(() => {
                        // Toggle behavior matching suite tree: if anything beyond root is
                        // expanded, click collapses everything; otherwise expands all
                        // currently-loaded top-level folders.
                        const isAnythingExpanded = Array.from(expandedPaths).some((p) => p !== repoPath);
                        return (
                          <button
                            type="button"
                            className="btn btn--secondary btn--sm"
                            onClick={() => {
                              // User explicit Expand-All / Collapse-All resets the
                              // "user collapsed" memory so auto-expand can run again.
                              userCollapsedRef.current.clear();
                              if (isAnythingExpanded) {
                                setExpandedPaths(new Set([repoPath]));
                              } else {
                                // Recursively load + expand every dir under the root,
                                // not just already-loaded ones. Honors the hidden-folder
                                // skip list (node_modules, bin, obj, .git, …).
                                void expandAllRecursively();
                              }
                            }}
                            title={isAnythingExpanded ? 'Collapse all' : 'Expand all'}
                            aria-label={isAnythingExpanded ? 'Collapse all folders' : 'Expand all folders'}
                          >
                            {isAnythingExpanded ? <IconUnfoldLess size={16} /> : <IconUnfoldMore size={16} />}
                          </button>
                        );
                      })()}
                    </div>
                  </div>
                  {/* Search row — full width, sits between the action header and
                      the file tree. Has a clear (✕) button when input is non-empty. */}
                  <div className="repo-browser__search-wrap">
                    <label className="repo-browser__search repo-browser__search--row" htmlFor="repo-browser-search">
                      <IconSearch size={14} />
                      <input
                        id="repo-browser-search"
                        type="text"
                        value={searchTerm}
                        onChange={(event) => setSearchTerm(event.target.value)}
                        placeholder="Search files…"
                        autoComplete="off"
                        spellCheck={false}
                      />
                      {searchTerm && (
                        <button
                          type="button"
                          className="repo-browser__search-clear"
                          onClick={() => setSearchTerm('')}
                          title="Clear search"
                          aria-label="Clear search"
                        >
                          <IconX size={12} />
                        </button>
                      )}
                    </label>
                  </div>
                  <div
                    className="repo-browser__panel"
                    onContextMenu={(e) => {
                      // Right-click on tree whitespace (not on a row) → create at repo root.
                      if ((e.target as HTMLElement).closest('.repo-browser__item, .repo-browser__method-row')) {
                        return;
                      }
                      openTreeContextMenu(e, null, repoPath);
                    }}
                  >
                    {rootNode?.loading && rootNode.entries.length === 0 ? (
                      <div className="repo-browser__state">Loading repository contents...</div>
                    ) : null}
                    {(() => {
                      // Detect "no search matches" state. When user is searching but
                      // no entries pass the filter, show a clear message.
                      if (normalizedSearch.length === 0) return renderEntries(repoPath);
                      const hasMatch = (() => {
                        const visit = (entries: DesktopDirectoryEntry[]): boolean => {
                          for (const entry of entries) {
                            if (isHiddenEntry(entry)) continue;
                            if (entry.name.toLowerCase().includes(normalizedSearch)) return true;
                            if (isClassFile(entry)) {
                              const methods = fileTestNamesByPath[entry.path]?.names ?? [];
                              if (methods.some((m) => m.toLowerCase().includes(normalizedSearch))) return true;
                            }
                            if (entry.type === 'directory') {
                              const child = nodesByPath[entry.path];
                              if (child && visit(child.entries)) return true;
                            }
                          }
                          return false;
                        };
                        return visit(rootNode?.entries ?? []);
                      })();
                      // While unloaded directories are still being scanned, show "Searching..."
                      const stillLoading = Object.values(nodesByPath).some((n) => n.loading);
                      if (!hasMatch) {
                        return (
                          <div className="repo-browser__state repo-browser__state--empty">
                            {stillLoading
                              ? `Searching for "${searchTerm}"...`
                              : `No matches for "${searchTerm}"`}
                          </div>
                        );
                      }
                      return renderEntries(repoPath);
                    })()}
                  </div>
                  {/* Bottom Automation Manager footer removed — its content has been
                      promoted to a contextual banner inside the PREVIEW panel header
                      and inline action chips next to each test method in the code. */}
                </div>
              </section>
            </div>

            {/* Resize handle: left | middle */}
            <div
              className="repo-browser__resize-handle"
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize repo and preview panels"
              onMouseDown={handleResizeStart('left')}
            />

            {/* Middle Panel: Code Preview */}
            <div className="repo-browser__middle-panel">
              <div className="repo-browser__preview-header">
                {/* Left: section label + scan status */}
                <div className="repo-browser__preview-header-left">
                  <span className="repo-browser__preview-label">CODE</span>
                  {previewFile && openTabs.length === 0 && (
                    <span className="repo-browser__preview-filename" title={previewFile.path}>
                      {previewFile.path.split(/[\\/]/).pop()}
                    </span>
                  )}
                  {mode === 'manage-automation' && methodSearch.loading && (
                    <span className="repo-browser__preview-scan-status" aria-live="polite" title={`Searching repository for ${methodSearch.methodName}`}>
                      <span className="repo-browser__scan-spinner" aria-hidden="true" />
                      Searching…
                    </span>
                  )}
                </div>

                {/* Center: autosave chip — flex-fills the space so the action group hugs the right edge */}
                <div className="repo-browser__preview-header-center">
                  {previewFile && autoSaveStatus !== 'idle' && (
                    <span
                      className={`repo-browser__autosave repo-browser__autosave--${autoSaveStatus}`}
                      title={
                        autoSaveStatus === 'pending' ? 'Changes will save shortly'
                        : autoSaveStatus === 'saving' ? 'Saving…'
                        : autoSaveStatus === 'saved' ? 'All changes saved'
                        : 'Save failed — see notification'
                      }
                    >
                      {autoSaveStatus === 'pending' && '● Editing'}
                      {autoSaveStatus === 'saving' && 'Saving…'}
                      {autoSaveStatus === 'saved' && '✓ Saved'}
                      {autoSaveStatus === 'error' && '⚠ Save failed'}
                    </span>
                  )}
                </div>

                {/* Right: icon-button action group, all consistent size/style */}
                <div className="repo-browser__preview-header-actions">
                  {previewFile && (
                    <button
                      type="button"
                      className={`btn btn--secondary btn--sm${wrapCode ? ' is-active' : ''}`}
                      onClick={() => setWrapCode((w) => !w)}
                      title={wrapCode ? 'Disable word wrap' : 'Enable word wrap'}
                      aria-label="Toggle word wrap"
                      aria-pressed={wrapCode}
                    >
                      <span className="material-symbols" aria-hidden="true">wrap_text</span>
                    </button>
                  )}
                  {/* Debug launch — icon-only for visual consistency with the other header buttons.
                      Hidden while a session is active so the ribbon below is the sole control surface. */}
                  {previewFile && workspaceSettings && mode !== 'manage-automation' && !isDebugActive && (
                    <button
                      type="button"
                      className="btn btn--secondary btn--sm"
                      onClick={() => { void startDebugRun(); }}
                      title="Debug test at cursor (F5)"
                      aria-label="Start debug session"
                    >
                      <span className="material-symbols" aria-hidden="true">bug_report</span>
                    </button>
                  )}
                  {previewFile && (
                    <>
                      <span className="repo-browser__preview-header-divider" aria-hidden="true" />
                      <button
                        type="button"
                        className="btn btn--secondary btn--sm"
                        onClick={() => {
                          if (isDirty) {
                            const ok = window.confirm('There may be unsaved changes still queued for autosave. Close anyway?');
                            if (!ok) return;
                          }
                          setPreviewFile(null);
                        }}
                        title="Close preview"
                        aria-label="Close preview"
                      >
                        <IconX size={14} />
                      </button>
                    </>
                  )}
                </div>
              </div>
              {/* Tab strip — one tab per open file. Click to switch, ✕ to close. */}
              {openTabs.length > 0 && (
                <div className="repo-browser__tabs" role="tablist" aria-label="Open files">
                  {openTabs.map((tab) => {
                    const isActive = previewFile?.path === tab.path;
                    const fileName = tab.path.split(/[\\/]/).pop() || tab.path;
                    const tabIsDirty = isActive
                      ? isDirty
                      : tab.content !== tab.original;
                    return (
                      <div
                        key={tab.path}
                        className={`repo-browser__tab${isActive ? ' is-active' : ''}`}
                        role="tab"
                        aria-selected={isActive}
                        title={tab.path}
                        onClick={() => switchToTab(tab.path)}
                      >
                        <span className="repo-browser__tab-name">{fileName}</span>
                        {tabIsDirty && <span className="repo-browser__tab-dirty" aria-hidden="true">●</span>}
                        <button
                          type="button"
                          className="repo-browser__tab-close"
                          aria-label={`Close ${fileName}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            closeTab(tab.path);
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="repo-browser__preview-body">
                {!previewFile ? (
                  <div className="repo-browser__preview-empty">
                    {mode === 'manage-automation' ? (
                      <>
                        <IconCode size={32} />
                        <p>
                          Select a class file in the tree to view its code, then associate or write the method{' '}
                          {currentMethodName ? `'${currentMethodName}'` : ''} here.
                        </p>
                      </>
                    ) : (
                      // JetBrains-style "shortcuts cheat-sheet" empty state — invites
                      // the user to discover the IDE features even before opening a file.
                      <ul className="repo-browser__shortcut-list" aria-label="Available commands">
                        <li>
                          <button
                            type="button"
                            className="repo-browser__shortcut"
                            onClick={() => {
                              setIsQuickOpenOpen(true);
                              void buildQuickOpenIndex();
                            }}
                          >
                            <span className="repo-browser__shortcut-label">Go to File</span>
                            <kbd className="repo-browser__shortcut-keys">Ctrl+P</kbd>
                          </button>
                        </li>
                        <li>
                          <button
                            type="button"
                            className="repo-browser__shortcut"
                            onClick={() => setIsFindInFilesOpen(true)}
                          >
                            <span className="repo-browser__shortcut-label">Find in Files</span>
                            <kbd className="repo-browser__shortcut-keys">Ctrl+Shift+F</kbd>
                          </button>
                        </li>
                        <li>
                          <button
                            type="button"
                            className="repo-browser__shortcut"
                            onClick={() => setIsCommandPaletteOpen(true)}
                          >
                            <span className="repo-browser__shortcut-label">Command Palette</span>
                            <kbd className="repo-browser__shortcut-keys">Ctrl+Shift+P</kbd>
                          </button>
                        </li>
                        {recentFiles.length > 0 && (
                          <li>
                            <button
                              type="button"
                              className="repo-browser__shortcut"
                              onClick={() => {
                                setIsQuickOpenOpen(true);
                                void buildQuickOpenIndex();
                              }}
                            >
                              <span className="repo-browser__shortcut-label">Recent Files</span>
                              <kbd className="repo-browser__shortcut-keys">Ctrl+P</kbd>
                            </button>
                          </li>
                        )}
                        {totalBreakpointCount > 0 && (
                          <li>
                            <button
                              type="button"
                              className="repo-browser__shortcut"
                              onClick={() => setIsBreakpointsPopoverOpen(true)}
                            >
                              <span className="repo-browser__shortcut-label">
                                Breakpoints ({totalBreakpointCount})
                              </span>
                              <kbd className="repo-browser__shortcut-keys">F9</kbd>
                            </button>
                          </li>
                        )}
                        <li className="repo-browser__shortcut-hint">
                          Or pick any file from the tree on the left
                        </li>
                      </ul>
                    )}
                  </div>
                ) : previewFile.loading ? (
                  <div className="repo-browser__preview-empty">Loading...</div>
                ) : previewFile.error ? (
                  <div className="repo-browser__preview-empty repo-browser__preview-empty--error">
                    {previewFile.error}
                  </div>
                ) : (() => {
                  const isCsFile = previewFile.path.toLowerCase().endsWith('.cs');
                  const previewClassName = isCsFile ? getEntryClassName(previewFile.path.split(/[\\/]/).pop() || '') : '';
                  const methodsInPreview = isCsFile ? (fileTestNamesByPath[previewFile.path]?.names ?? []) : [];
                  const isAssociatedFile = mode === 'manage-automation' && associatedClassName === previewClassName;
                  const generatedMethodInThisFile = Boolean(generatedMethodName && methodsInPreview.includes(generatedMethodName));

                  return (
                    <>
                      {/* Contextual banner — compact, shown only in manage-automation mode.
                          On click we freeze a snapshot via bannerFrozen state so the button
                          label and method name stay stable until the API roundtrip ends
                          (signaled by actionBusy going false). */}
                      {mode === 'manage-automation' && currentMethodName && (() => {
                        const liveState = {
                          isAssociatedFile,
                          associatedMethodName,
                          associatedClassName,
                          generatedMethodInThisFile,
                          generatedMethodName,
                          currentMethodName,
                          previewFilePath: previewFile.path,
                        };
                        const isFrozen = bannerFrozen || actionBusy;
                        const view = isFrozen && bannerStateRef.current ? bannerStateRef.current : liveState;
                        // Helper that captures the snapshot at click time so the parent's
                        // optimistic re-renders can't change what the banner shows.
                        const freezeSnapshot = () => {
                          bannerStateRef.current = liveState;
                          setBannerFrozen(true);
                        };

                        return (
                          <div className={`repo-browser__assoc-banner${view.isAssociatedFile ? ' is-associated' : ''}${isFrozen ? ' is-busy' : ''}`}>
                            <div className="repo-browser__assoc-banner-info">
                              {view.isAssociatedFile ? (
                                <>
                                  <span className="repo-browser__assoc-banner-status repo-browser__assoc-banner-status--linked">Associated</span>
                                  <code className="repo-browser__assoc-banner-method" title={view.associatedMethodName ?? ''}>
                                    {view.associatedMethodName}
                                  </code>
                                </>
                              ) : view.associatedMethodName ? (
                                <>
                                  <span className="repo-browser__assoc-banner-status repo-browser__assoc-banner-status--linked">Linked elsewhere</span>
                                  <code className="repo-browser__assoc-banner-method" title={`${view.associatedMethodName} in ${view.associatedClassName}`}>
                                    {view.associatedClassName}.{view.associatedMethodName}
                                  </code>
                                </>
                              ) : view.generatedMethodInThisFile ? (
                                <>
                                  <span className="repo-browser__assoc-banner-status repo-browser__assoc-banner-status--found">Method found</span>
                                  <code className="repo-browser__assoc-banner-method" title={view.generatedMethodName ?? ''}>
                                    {view.generatedMethodName}
                                  </code>
                                </>
                              ) : (
                                <>
                                  <span className="repo-browser__assoc-banner-status repo-browser__assoc-banner-status--missing">Not added</span>
                                  <code className="repo-browser__assoc-banner-method" title={view.currentMethodName}>
                                    {view.currentMethodName}
                                  </code>
                                </>
                              )}
                            </div>
                            <div className="repo-browser__assoc-banner-actions">
                              {view.isAssociatedFile && view.associatedMethodName ? (
                                <button
                                  type="button"
                                  className="repo-browser__assoc-btn repo-browser__assoc-btn--danger"
                                  onClick={() => {
                                    if (!view.associatedMethodName) return;
                                    freezeSnapshot();
                                    onRemoveAssociation?.(view.previewFilePath, view.associatedMethodName);
                                  }}
                                  disabled={isFrozen}
                                  title="Unassociate this test from the method"
                                >
                                  <IconLinkOff size={14} />
                                  {isFrozen ? 'Working…' : 'Unassociate Test'}
                                </button>
                              ) : !view.associatedMethodName && view.generatedMethodInThisFile ? (
                                <button
                                  type="button"
                                  className="repo-browser__assoc-btn repo-browser__assoc-btn--primary"
                                  onClick={() => {
                                    if (!view.generatedMethodName) return;
                                    freezeSnapshot();
                                    onAddAssociation?.(view.previewFilePath, view.generatedMethodName);
                                  }}
                                  disabled={isFrozen}
                                  title="Associate this test with the method here"
                                >
                                  <IconAddLink size={14} />
                                  {isFrozen ? 'Working…' : 'Associate Test'}
                                </button>
                              ) : !view.associatedMethodName && !view.generatedMethodInThisFile && view.generatedMethodName ? (
                                <button
                                  type="button"
                                  className="repo-browser__assoc-btn repo-browser__assoc-btn--primary"
                                  onClick={() => {
                                    freezeSnapshot();
                                    onWriteCode?.(view.previewFilePath);
                                  }}
                                  disabled={isFrozen || !view.generatedMethodName}
                                  title={`Inject ${view.generatedMethodName} into this class and associate`}
                                >
                                  <IconCode size={14} />
                                  {isFrozen ? 'Working…' : 'Add Test Code'}
                                </button>
                              ) : null}
                            </div>
                          </div>
                        );
                      })()}
                      {isDebugActive && (
                        <div className={`debug-ribbon debug-ribbon--${debugStatus}`} role="region" aria-label="Debug session">
                          <div className="debug-ribbon__status">
                            <span className="debug-ribbon__dot" aria-hidden="true" />
                            <span className="debug-ribbon__label">
                              {debugStatus === 'starting' && 'Starting debug session…'}
                              {debugStatus === 'running' && 'Running'}
                              {debugStatus === 'paused' && (
                                <>
                                  Paused: {debugStopDetails?.reason || 'breakpoint'}
                                  {debugStopDetails?.sourceName && debugStopDetails.line && (
                                    <> · {debugStopDetails.sourceName}:{debugStopDetails.line}</>
                                  )}
                                </>
                              )}
                              {debugStatus === 'stopping' && 'Stopping…'}
                            </span>
                          </div>
                          <div className="debug-ribbon__actions">
                            <button
                              type="button"
                              className="btn btn--secondary btn--sm debug-ribbon__btn"
                              onClick={() => { void debuggerContinue(); }}
                              disabled={debugStatus !== 'paused'}
                              title="Continue (F5)"
                            >
                              <span className="material-symbols" aria-hidden="true">play_arrow</span>
                              Continue
                            </button>
                            <button
                              type="button"
                              className="btn btn--secondary btn--sm debug-ribbon__btn"
                              onClick={() => { void debuggerStepOver(); }}
                              disabled={debugStatus !== 'paused'}
                              title="Step Over (F10)"
                            >
                              <span className="material-symbols" aria-hidden="true">step_over</span>
                              Step Over
                            </button>
                            <button
                              type="button"
                              className="btn btn--secondary btn--sm debug-ribbon__btn"
                              onClick={() => { void debuggerStepIn(); }}
                              disabled={debugStatus !== 'paused'}
                              title="Step Into (F11)"
                            >
                              <span className="material-symbols" aria-hidden="true">step_into</span>
                              Step In
                            </button>
                            <button
                              type="button"
                              className="btn btn--secondary btn--sm debug-ribbon__btn"
                              onClick={() => { void debuggerStepOut(); }}
                              disabled={debugStatus !== 'paused'}
                              title="Step Out (Shift+F11)"
                            >
                              <span className="material-symbols" aria-hidden="true">step_out</span>
                              Step Out
                            </button>
                            <button
                              type="button"
                              className="btn btn--danger btn--sm debug-ribbon__btn"
                              onClick={() => { void stopDebugRun(); }}
                              disabled={debugStatus === 'stopping'}
                              title="Stop debug session (Shift+F5)"
                            >
                              <span className="material-symbols" aria-hidden="true">stop_circle</span>
                              Stop
                            </button>
                          </div>
                        </div>
                      )}
                      <div className="repo-browser__preview-editor">
                        <CodeEditor
                          filePath={previewFile.path}
                          value={previewFile.content}
                          readOnly={!isEditing}
                          wordWrap={wrapCode}
                          onCursorChange={setCursorPos}
                          breakpoints={currentFileBreakpoints}
                          onToggleBreakpoint={(line) => toggleBreakpoint(previewFile.path, line)}
                          executionLine={debugExecutionLine}
                          onChange={(next) => {
                            setPreviewFile((current) => (current ? { ...current, content: next } : current));
                          }}
                          onMount={(editor) => {
                            monacoEditorRef.current = editor;
                            // Ctrl/Cmd+S → save (only fires when editing)
                            editor.addCommand(
                              // eslint-disable-next-line no-bitwise
                              (2048 /* KeyMod.CtrlCmd */) | (49 /* KeyCode.KeyS */),
                              () => { void saveCurrentFile(); },
                            );
                            // Apply any pending jump that landed before mount.
                            // For manage-automation auto-open the placeholder line is 1 —
                            // re-resolve it against the loaded content to land on the
                            // actual method definition.
                            const pending = pendingJumpRef.current;
                            if (pending && previewFile && pending.path === previewFile.path) {
                              let line = pending.line;
                              let col = pending.column;
                              if (mode === 'manage-automation' && currentMethodName && line === 1) {
                                const content = previewFile.content;
                                const safeName = currentMethodName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                                const re = new RegExp(`\\b${safeName}\\s*\\(`);
                                const lines = content.split('\n');
                                for (let i = 0; i < lines.length; i += 1) {
                                  if (re.test(lines[i])) {
                                    line = i + 1;
                                    const c = lines[i].search(re);
                                    if (c >= 0) col = c + 1;
                                    break;
                                  }
                                }
                              }
                              editor.revealLineInCenter(line);
                              editor.setPosition({ lineNumber: line, column: col });
                              editor.focus();
                              pendingJumpRef.current = null;
                            }
                          }}
                        />
                      </div>
                      {debugStatus === 'paused' && debugStopDetails && (
                        <div className="debug-panel" role="region" aria-label="Debugger state">
                          <div className="debug-panel__col">
                            <div className="debug-panel__heading">Call Stack</div>
                            <div className="debug-panel__list">
                              {(debugStopDetails.callStack ?? []).slice(0, 20).map((frame) => (
                                <button
                                  key={frame.id}
                                  type="button"
                                  className="debug-panel__frame"
                                  title={frame.sourcePath ?? frame.name}
                                  onClick={() => {
                                    if (frame.sourcePath) {
                                      pendingJumpRef.current = {
                                        path: frame.sourcePath,
                                        line: frame.line || 1,
                                        column: frame.column || 1,
                                      };
                                      void loadFilePreview(frame.sourcePath);
                                    }
                                  }}
                                >
                                  <span className="debug-panel__frame-name">{frame.name}</span>
                                  {frame.sourceName && (
                                    <span className="debug-panel__frame-loc">{frame.sourceName}:{frame.line}</span>
                                  )}
                                </button>
                              ))}
                              {(!debugStopDetails.callStack || debugStopDetails.callStack.length === 0) && (
                                <div className="debug-panel__empty">No frames available</div>
                              )}
                            </div>
                          </div>
                          <div className="debug-panel__col">
                            <div className="debug-panel__heading">Variables</div>
                            <div className="debug-panel__list">
                              {(debugStopDetails.scopes ?? []).map((scope) => (
                                <div key={scope.name} className="debug-panel__scope">
                                  <div className="debug-panel__scope-name">{scope.name}</div>
                                  {scope.variables.slice(0, 50).map((v, idx) => (
                                    <DebugVariableRow
                                      key={`${scope.name}:${v.name}:${idx}`}
                                      runId={debugRunId}
                                      variable={v}
                                      depth={0}
                                    />
                                  ))}
                                  {scope.variables.length > 50 && (
                                    <div className="debug-panel__empty">…and {scope.variables.length - 50} more</div>
                                  )}
                                </div>
                              ))}
                              {(!debugStopDetails.scopes || debugStopDetails.scopes.length === 0) && (
                                <div className="debug-panel__empty">No variables available</div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                      {/* Editor status bar — language, line count, cursor pos, dirty state */}
                      <div className="preview-status-bar" role="status" aria-live="polite">
                        <span className="preview-status-bar__group">
                          <span className="preview-status-bar__item" title="Language">
                            {detectLanguage(previewFile.path)}
                          </span>
                          <span className="preview-status-bar__item" title="Line count">
                            {previewFile.content.split('\n').length} lines
                          </span>
                          {/\r\n/.test(previewFile.content) ? (
                            <span className="preview-status-bar__item" title="Line endings">
                              CRLF
                            </span>
                          ) : (
                            <span className="preview-status-bar__item" title="Line endings">
                              LF
                            </span>
                          )}
                        </span>
                        <span className="preview-status-bar__group preview-status-bar__group--right">
                          {totalBreakpointCount > 0 && (
                            <button
                              type="button"
                              className="preview-status-bar__item preview-status-bar__item--bp preview-status-bar__item--clickable"
                              onClick={() => setIsBreakpointsPopoverOpen((v) => !v)}
                              title={
                                currentFileBreakpoints.length > 0
                                  ? `${currentFileBreakpoints.length} breakpoint${currentFileBreakpoints.length > 1 ? 's' : ''} in this file (${totalBreakpointCount} total) — click to list`
                                  : `${totalBreakpointCount} breakpoint${totalBreakpointCount > 1 ? 's' : ''} across the repo — click to list`
                              }
                            >
                              ● {totalBreakpointCount} BP
                            </button>
                          )}
                          <span className="preview-status-bar__item" title="Cursor position">
                            Ln {cursorPos.line}, Col {cursorPos.column}
                          </span>
                          <span className="preview-status-bar__item" title="Auto-save is on">
                            Auto-save
                          </span>
                        </span>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>

            {/* Right Panel: Git Manager — only shown when browsing from Plan list.
                Hidden when launched from Test Details (manage-automation mode) since
                git operations aren't relevant to associating tests with methods. */}
            {mode !== 'manage-automation' && (
              <>
                {/* Resize handle: middle | right */}
                <div
                  className="repo-browser__resize-handle"
                  role="separator"
                  aria-orientation="vertical"
                  aria-label="Resize preview and git panels"
                  onMouseDown={handleResizeStart('right')}
                />
                <div className="repo-browser__right-panel">
                  <GitManager
                    repoPath={repoPath}
                    unstagedFiles={gitStatus.unstagedFiles}
                    stagedFiles={gitStatus.stagedFiles}
                    branch={gitBranch.branch}
                    branches={gitBranch.branches}
                    aheadCount={gitStatus.aheadCount}
                    behindCount={gitStatus.behindCount}
                    isLoading={gitBranch.loading}
                    onStatusChange={() => {
                      // Lightweight refresh — only re-fetch git status (changed files).
                      // No need to reload the file tree or method names.
                      void loadGitStatus(repoPath);
                    }}
                    onBranchChange={(branchValue) => {
                      void handleBranchChange(branchValue);
                    }}
                  />
                </div>
              </>
            )}
          </div>
        </section>
      </div>

      {/* Quick Open (Ctrl+P) — overlay rendered above all panels */}
      <QuickOpen
        isOpen={isQuickOpenOpen}
        onClose={() => setIsQuickOpenOpen(false)}
        files={isIndexing && quickOpenIndex.length === 0 ? [] : quickOpenIndex}
        recentPaths={recentFiles}
        onSelect={(path) => {
          void loadFilePreview(path);
        }}
      />

      {/* Breakpoints popover (Phase 3c) — opened from the status-bar BP chip */}
      {isBreakpointsPopoverOpen && (
        <div
          className="breakpoints-popover-overlay"
          role="dialog"
          aria-label="Breakpoints"
          onClick={() => setIsBreakpointsPopoverOpen(false)}
        >
          <div className="breakpoints-popover" onClick={(e) => e.stopPropagation()}>
            <div className="breakpoints-popover__header">
              <span>Breakpoints ({totalBreakpointCount})</span>
              <div className="breakpoints-popover__header-actions">
                {totalBreakpointCount > 0 && (
                  <button
                    type="button"
                    className="btn btn--secondary btn--sm"
                    onClick={() => {
                      const ok = window.confirm('Remove all breakpoints?');
                      if (ok) clearAllBreakpoints();
                    }}
                  >
                    Remove All
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn--secondary btn--sm"
                  onClick={() => setIsBreakpointsPopoverOpen(false)}
                  aria-label="Close breakpoints list"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="breakpoints-popover__list">
              {totalBreakpointCount === 0 ? (
                <div className="breakpoints-popover__empty">
                  No breakpoints set. Click the gutter in the editor or press F9 to add one.
                </div>
              ) : (
                Object.entries(breakpointsByFile).map(([filePath, lines]) => {
                  const fileName = filePath.split(/[\\/]/).pop() ?? filePath;
                  const dirPath = filePath.slice(0, filePath.length - fileName.length);
                  return (
                    <div key={filePath} className="breakpoints-popover__group">
                      <div className="breakpoints-popover__group-head" title={filePath}>
                        <span className="breakpoints-popover__file-name">{fileName}</span>
                        <span className="breakpoints-popover__file-dir">{dirPath}</span>
                      </div>
                      {lines.map((line) => (
                        <div key={`${filePath}:${line}`} className="breakpoints-popover__row">
                          <button
                            type="button"
                            className="breakpoints-popover__jump"
                            onClick={() => {
                              pendingJumpRef.current = { path: filePath, line, column: 1 };
                              if (previewFile?.path === filePath && monacoEditorRef.current) {
                                monacoEditorRef.current.revealLineInCenter(line);
                                monacoEditorRef.current.setPosition({ lineNumber: line, column: 1 });
                                monacoEditorRef.current.focus();
                                pendingJumpRef.current = null;
                              } else {
                                void loadFilePreview(filePath);
                              }
                              setIsBreakpointsPopoverOpen(false);
                            }}
                          >
                            <span className="breakpoints-popover__dot" aria-hidden="true">●</span>
                            <span className="breakpoints-popover__line">Line {line}</span>
                          </button>
                          <button
                            type="button"
                            className="breakpoints-popover__remove"
                            title="Remove this breakpoint"
                            onClick={() => toggleBreakpoint(filePath, line)}
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tree right-click context menu (file ops) */}
      {treeContextMenu && (
        <div
          className="tree-context-menu"
          style={{ top: treeContextMenu.y, left: treeContextMenu.x }}
          role="menu"
          onMouseDown={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.preventDefault()}
        >
          {(() => {
            const { entry, parentDir } = treeContextMenu;
            const isFolder = !entry || entry.type === 'directory';
            const createIn = isFolder ? (entry ? entry.path : parentDir) : parentDir;
            return (
              <>
                <button
                  type="button"
                  className="tree-context-menu__item"
                  onClick={() => {
                    setTreeContextMenu(null);
                    void handleCreateFile(createIn);
                  }}
                >
                  New File…
                </button>
                <button
                  type="button"
                  className="tree-context-menu__item"
                  onClick={() => {
                    setTreeContextMenu(null);
                    void handleCreateFolder(createIn);
                  }}
                >
                  New Folder…
                </button>
                {entry && (
                  <>
                    <div className="tree-context-menu__sep" />
                    <button
                      type="button"
                      className="tree-context-menu__item"
                      onClick={() => {
                        setTreeContextMenu(null);
                        void handleRename(entry, parentDir);
                      }}
                    >
                      Rename…
                    </button>
                    <button
                      type="button"
                      className="tree-context-menu__item tree-context-menu__item--danger"
                      onClick={() => {
                        setTreeContextMenu(null);
                        void handleDelete(entry, parentDir);
                      }}
                    >
                      Delete
                    </button>
                  </>
                )}
              </>
            );
          })()}
        </div>
      )}

      {/* Command palette (Ctrl+Shift+P) — searchable list of all actions */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        commands={((): PaletteCommand[] => {
          const hasPreview = Boolean(previewFile);
          const previewParent = previewFile
            ? previewFile.path.slice(0, Math.max(previewFile.path.lastIndexOf('\\'), previewFile.path.lastIndexOf('/')))
            : repoPath;
          return [
            {
              id: 'file.goto',
              category: 'File',
              label: 'Go to File…',
              shortcut: 'Ctrl+P',
              run: () => {
                setIsQuickOpenOpen(true);
                void buildQuickOpenIndex();
              },
            },
            {
              id: 'search.findInFiles',
              category: 'Search',
              label: 'Find in Files…',
              shortcut: 'Ctrl+Shift+F',
              run: () => setIsFindInFilesOpen(true),
            },
            {
              id: 'file.newFile',
              category: 'File',
              label: hasPreview ? 'New File in current folder…' : 'New File at repo root…',
              run: () => { void handleCreateFile(previewParent || repoPath); },
            },
            {
              id: 'file.newFolder',
              category: 'File',
              label: hasPreview ? 'New Folder in current folder…' : 'New Folder at repo root…',
              run: () => { void handleCreateFolder(previewParent || repoPath); },
            },
            {
              id: 'file.save',
              category: 'File',
              label: 'Save File Now (also autosaved)',
              shortcut: 'Ctrl+S',
              disabled: !isDirty,
              run: () => { void saveCurrentFile(); },
            },
            {
              id: 'file.reload',
              category: 'File',
              label: 'Reload File from Disk',
              disabled: !previewFile,
              run: () => { if (previewFile) void loadFilePreview(previewFile.path, { force: true }); },
            },
            {
              id: 'editor.toggleWrap',
              category: 'Editor',
              label: wrapCode ? 'Disable Word Wrap' : 'Enable Word Wrap',
              run: () => {
                setWrapCode((v) => {
                  const next = !v;
                  try { localStorage.setItem('repo-browser:wrap-code', next ? '1' : '0'); } catch { /* ignore */ }
                  return next;
                });
              },
            },
            {
              id: 'view.expandAll',
              category: 'View',
              label: 'Expand All Folders',
              run: () => { void expandAllRecursively(); },
            },
            {
              id: 'view.collapseAll',
              category: 'View',
              label: 'Collapse All Folders',
              run: () => {
                userCollapsedRef.current.clear();
                setExpandedPaths(new Set([repoPath]));
              },
            },
            {
              id: 'debug.toggleBreakpoint',
              category: 'Debug',
              label: 'Toggle Breakpoint at Current Line',
              shortcut: 'F9',
              disabled: !previewFile,
              run: () => { if (previewFile) toggleBreakpoint(previewFile.path, cursorPos.line); },
            },
            {
              id: 'debug.clearAllBreakpoints',
              category: 'Debug',
              label: `Remove All Breakpoints${totalBreakpointCount ? ` (${totalBreakpointCount})` : ''}`,
              disabled: totalBreakpointCount === 0,
              run: () => clearAllBreakpoints(),
            },
            {
              id: 'debug.showBreakpoints',
              category: 'Debug',
              label: `Show All Breakpoints${totalBreakpointCount ? ` (${totalBreakpointCount})` : ''}`,
              disabled: totalBreakpointCount === 0,
              run: () => setIsBreakpointsPopoverOpen(true),
            },
            {
              id: 'debug.run',
              category: 'Debug',
              label: 'Debug Test at Cursor',
              shortcut: 'F5',
              disabled: !workspaceSettings || !previewFile || isDebugActive,
              run: () => { void startDebugRun(); },
            },
            {
              id: 'debug.continue',
              category: 'Debug',
              label: 'Continue',
              shortcut: 'F5',
              disabled: debugStatus !== 'paused',
              run: () => { void debuggerContinue(); },
            },
            {
              id: 'debug.stepOver',
              category: 'Debug',
              label: 'Step Over',
              shortcut: 'F10',
              disabled: debugStatus !== 'paused',
              run: () => { void debuggerStepOver(); },
            },
            {
              id: 'debug.stepIn',
              category: 'Debug',
              label: 'Step Into',
              shortcut: 'F11',
              disabled: debugStatus !== 'paused',
              run: () => { void debuggerStepIn(); },
            },
            {
              id: 'debug.stepOut',
              category: 'Debug',
              label: 'Step Out',
              shortcut: 'Shift+F11',
              disabled: debugStatus !== 'paused',
              run: () => { void debuggerStepOut(); },
            },
            {
              id: 'debug.stop',
              category: 'Debug',
              label: 'Stop Debug Session',
              shortcut: 'Shift+F5',
              disabled: !isDebugActive,
              run: () => { void stopDebugRun(); },
            },
            {
              id: 'repo.refresh',
              category: 'Repo',
              label: 'Refresh Repo Browser',
              run: () => { void reloadRepository(); },
            },
            {
              id: 'repo.refreshGit',
              category: 'Repo',
              label: 'Refresh Git Status',
              run: () => { void loadGitStatus(repoPath); },
            },
          ];
        })()}
      />

      {/* Find in Files (Ctrl+Shift+F) — project-wide content search */}
      <FindInFiles
        isOpen={isFindInFilesOpen}
        onClose={() => setIsFindInFilesOpen(false)}
        rootPath={repoPath}
        onOpenMatch={(filePath, line, column) => {
          pendingJumpRef.current = { path: filePath, line, column };
          if (previewFile?.path === filePath && monacoEditorRef.current) {
            // Same file already open — jump immediately
            monacoEditorRef.current.revealLineInCenter(line);
            monacoEditorRef.current.setPosition({ lineNumber: line, column });
            monacoEditorRef.current.focus();
            pendingJumpRef.current = null;
          } else {
            void loadFilePreview(filePath);
          }
          setIsFindInFilesOpen(false);
        }}
      />

      {pendingBranchSwitch && (() => {
        // Dedupe files by case-insensitive path (fixes git's occasional double-reporting)
        const seen = new Set<string>();
        const dedupedFiles = pendingBranchSwitch.changedFiles.filter((f) => {
          const key = f.path.toLowerCase();
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        const getStatusBadge = (rawStatus: string) => {
          const s = normalizeGitStatus(rawStatus);
          const label: Record<string, string> = {
            M: 'Modified',
            A: 'Added',
            D: 'Deleted',
            U: 'Unmerged',
            '?': 'Untracked',
          };
          return { code: s, label: label[s] || s };
        };

        return (
          <div className="repo-browser__branch-conflict" role="dialog" aria-modal="true" aria-label="Switch branch — local changes detected">
            <button
              type="button"
              className="repo-browser__branch-conflict-backdrop"
              onClick={() => {
                if (!branchSwitching) {
                  setPendingBranchSwitch(null);
                }
              }}
              aria-label="Cancel branch switch"
            />
            <div className="repo-browser__branch-conflict-panel">
              <div className="repo-browser__branch-conflict-head">
                <h3>Local changes detected</h3>
                <button
                  type="button"
                  className="repo-browser__branch-conflict-close"
                  onClick={() => setPendingBranchSwitch(null)}
                  disabled={branchSwitching}
                  aria-label="Cancel branch switch"
                >
                  <IconX size={16} />
                </button>
              </div>
              <p className="repo-browser__branch-conflict-copy">
                Switching to <strong>{pendingBranchSwitch.branch.name}</strong> would overwrite the following file{dedupedFiles.length !== 1 ? 's' : ''}:
              </p>
              <div className="repo-browser__branch-conflict-files">
                {dedupedFiles.length > 0 ? (
                  dedupedFiles.map((file) => {
                    const badge = getStatusBadge(file.status);
                    return (
                      <div key={file.path} className={`repo-browser__branch-conflict-file git-status--${badge.code === '?' ? 'untracked' : badge.label.toLowerCase()}`}>
                        <span
                          className={`repo-browser__branch-conflict-status git-status--${badge.code === '?' ? 'untracked' : badge.label.toLowerCase()}`}
                          title={badge.label}
                        >
                          {badge.code}
                        </span>
                        <span className="repo-browser__branch-conflict-path" title={file.path}>{file.path}</span>
                      </div>
                    );
                  })
                ) : (
                  <div className="repo-browser__branch-conflict-file">
                    <span className="repo-browser__branch-conflict-path">Local repository changes</span>
                  </div>
                )}
              </div>
              <p className="repo-browser__branch-conflict-help">
                Choose how to handle them:
              </p>
              <div className="repo-browser__branch-conflict-actions">
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => setPendingBranchSwitch(null)}
                  disabled={branchSwitching}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn--secondary"
                  onClick={() => { void handleStashAndSwitchBranch(); }}
                  disabled={branchSwitching}
                  title="Save changes to stash, switch branch. Use Stash Pop later to restore."
                >
                  📦 {branchSwitching ? 'Stashing...' : 'Stash & Switch'}
                </button>
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={() => { void handleCommitAndSwitchBranch(); }}
                  disabled={branchSwitching}
                  title="Commit changes to current branch, then switch"
                >
                  {branchSwitching ? 'Committing...' : 'Commit & Switch'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
