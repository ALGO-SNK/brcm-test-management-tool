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
  IconX,
} from '../Common/Icons';
import { useNotification } from '../../context/useNotification';
import { GitManager, type GitFile } from './GitManager';

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

const CSHARP_KEYWORDS = new Set([
  'abstract', 'as', 'async', 'await', 'base', 'bool', 'break', 'byte', 'case', 'catch',
  'char', 'checked', 'class', 'const', 'continue', 'decimal', 'default', 'delegate',
  'do', 'double', 'else', 'enum', 'event', 'explicit', 'extern', 'false', 'finally',
  'fixed', 'float', 'for', 'foreach', 'goto', 'if', 'implicit', 'in', 'int', 'interface',
  'internal', 'is', 'lock', 'long', 'namespace', 'new', 'null', 'object', 'operator',
  'out', 'override', 'params', 'private', 'protected', 'public', 'readonly', 'ref',
  'return', 'sbyte', 'sealed', 'short', 'sizeof', 'stackalloc', 'static', 'string',
  'struct', 'switch', 'this', 'throw', 'true', 'try', 'typeof', 'uint', 'ulong',
  'unchecked', 'unsafe', 'ushort', 'using', 'var', 'virtual', 'void', 'volatile',
  'while', 'yield', 'get', 'set', 'global', 'partial', 'where', 'add', 'remove',
]);

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function renderCodeWithLineNumbers(html: string): string {
  const lines = html.split('\n');
  // Tab width matches CSS tab-size: 4
  const TAB_WIDTH = 4;
  return lines
    .map((line, idx) => {
      // Detect leading whitespace to compute hanging indent for wrapped lines.
      const leadingMatch = line.match(/^([ \t]*)/);
      const leading = leadingMatch ? leadingMatch[1] : '';
      const indentChars = leading.replace(/\t/g, ' '.repeat(TAB_WIDTH)).length;
      // Add 2ch extra hang so wrapped continuations are visually distinct from real
      // code at the same depth (IDE convention).
      const hangIndent = indentChars + 2;
      // Stored as CSS var — only consumed when .is-wrapped class is on
      const indentStyle = ' style="--cs-indent:' + hangIndent + 'ch"';
      return (
        '<span class="cs-line"><span class="cs-line-number">' +
        (idx + 1) +
        '</span><span class="cs-line-content"' +
        indentStyle +
        '>' +
        (line || ' ') +
        '</span></span>'
      );
    })
    .join('');
}


function highlightCSharp(code: string): string {
  const placeholders: string[] = [];
  const placeholder = (cls: string, text: string) => {
    const idx = placeholders.length;
    placeholders.push(`<span class="cs-${cls}">${escapeHtml(text)}</span>`);
    return `__SENTINEL__${idx}__SENTINEL__`;
  };

  let working = code;
  // Block comments
  working = working.replace(/\/\*[\s\S]*?\*\//g, (m) => placeholder('comment', m));
  // Line comments
  working = working.replace(/\/\/[^\n]*/g, (m) => placeholder('comment', m));
  // Strings (double-quoted, including verbatim @"...")
  working = working.replace(/@"(?:[^"]|"")*"/g, (m) => placeholder('string', m));
  working = working.replace(/"(?:\\.|[^"\\])*"/g, (m) => placeholder('string', m));
  // Char literals
  working = working.replace(/'(?:\\.|[^'\\])'/g, (m) => placeholder('string', m));
  // Attributes [Test], [Category("x")]
  working = working.replace(/\[[A-Za-z_][A-Za-z0-9_.]*(?:\([^\]]*\))?\]/g, (m) => placeholder('attribute', m));
  // Numbers
  working = working.replace(/\b\d+(?:\.\d+)?[fFdDmMlL]?\b/g, (m) => placeholder('number', m));

  // Escape what's left
  working = escapeHtml(working);

  // Highlight keywords
  working = working.replace(/\b([A-Za-z_][A-Za-z0-9_]*)\b/g, (m, word) => {
    if (CSHARP_KEYWORDS.has(word)) {
      return `<span class="cs-keyword">${word}</span>`;
    }
    return m;
  });

  // Highlight type names following `class`, `new`, `:` (inheritance)
  working = working.replace(
    /(<span class="cs-keyword">(?:class|new|interface|struct|enum)<\/span>\s+)([A-Za-z_][A-Za-z0-9_]*)/g,
    (_m, prefix, name) => `${prefix}<span class="cs-type">${name}</span>`,
  );

  // Restore placeholders (loop to handle nested placeholders, e.g. string inside attribute)
  let prev = '';
  while (prev !== working) {
    prev = working;
    working = working.replace(/__SENTINEL__(\d+)__SENTINEL__/g, (_m, idx) => placeholders[Number(idx)] ?? '');
  }

  return working;
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
    content: string;
    loading: boolean;
    error: string | null;
  } | null>(null);
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

  const loadFilePreview = async (filePath: string) => {
    if (!window.desktop?.readTextFile) {
      setPreviewFile({ path: filePath, content: '', loading: false, error: 'File reading not available' });
      return;
    }
    setPreviewFile({ path: filePath, content: '', loading: true, error: null });
    try {
      const content = await window.desktop.readTextFile(filePath);
      setPreviewFile({ path: filePath, content, loading: false, error: null });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load file';
      setPreviewFile({ path: filePath, content: '', loading: false, error: message });
    }
  };

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
            next.add(ancestorPath);
          });
          next.add(matchingFilePath);
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
        next.add(ancestorPath);
      });
      next.add(matchingFilePath);
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

  const reloadRepository = async () => {
    setNodesByPath({});
    setFileTestNamesByPath({});
    setExpandedPaths(new Set([repoPath]));
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
      const next = new Set(current);
      next.add(matchingPath);
      return next;
    });
  }, [currentMethodName, fileTestNamesByPath]);

  // When the user types a search term, auto-expand any class file whose method
  // names match. This makes search results visible without manual clicks.
  useEffect(() => {
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
        if (!next.has(p)) {
          next.add(p);
          changed = true;
        }
        // Also expand all ancestor directories
        getAncestorDirectoryPaths(repoPath, p).forEach((ancestor) => {
          if (!next.has(ancestor)) {
            next.add(ancestor);
            changed = true;
          }
        });
      });
      return changed ? next : current;
    });
  }, [searchTerm, fileTestNamesByPath, repoPath]);

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
        if (!next.has(p)) {
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

  const toggleNode = (targetPath: string) => {
    setExpandedPaths((current) => {
      const next = new Set(current);
      if (next.has(targetPath)) {
        next.delete(targetPath);
      } else {
        next.add(targetPath);
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
                    {mode === 'manage-automation' && !currentMethodExistsInFile && (
                      <button
                        type="button"
                        className="repo-browser__action-btn"
                        onClick={() => onWriteCode?.(entry.path)}
                        title={generatedMethodName ? `Write ${generatedMethodName} into this class` : 'Write automated test code'}
                        disabled={actionBusy || !generatedMethodName}
                      >
                        <IconCode size={15} />
                      </button>
                    )}
                  </div>
                ) : (
                  <div
                    className={`repo-browser__item repo-browser__item--file is-clickable${previewFile?.path === entry.path ? ' is-preview-active' : ''}`}
                    title={entry.path}
                    onClick={() => void loadFilePreview(entry.path)}
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
                        {mode === 'manage-automation' && !associatedMethodName && generatedMethodName === name && (
                          <button
                            type="button"
                            className="repo-browser__action-btn"
                            onClick={() => onAddAssociation?.(entry.path, name)}
                            title="Add automated test association"
                            disabled={actionBusy}
                          >
                            <IconAddLink size={15} />
                          </button>
                        )}
                        {mode === 'manage-automation' && associatedMethodName === name && associatedClassName === entryClassName && (
                          <button
                            type="button"
                            className="repo-browser__action-btn repo-browser__action-btn--danger"
                            onClick={() => onRemoveAssociation?.(entry.path, name)}
                            title="Remove automated test association"
                            disabled={actionBusy}
                          >
                            <IconLinkOff size={15} />
                          </button>
                        )}
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
      <div className={`settings-dock settings-dock--no-aside${embedded ? ' settings-dock--embedded-page' : ''}`}>
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
            className="repo-browser__split-pane"
            ref={splitPaneRef}
            style={{
              gridTemplateColumns: `${panelWidths.left}fr 2px ${panelWidths.middle}fr 2px ${panelWidths.right}fr`,
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
                      {mode === 'manage-automation' && methodSearch.loading && (
                        <p className="repo-browser__scan-status" aria-live="polite">
                          <span className="repo-browser__scan-spinner" aria-hidden="true" />
                          {`Searching repository for ${methodSearch.methodName}...`}
                        </p>
                      )}
                    </div>
                    <div className="repo-browser__header-actions">
                      <label className="repo-browser__search repo-browser__search--header" htmlFor="repo-browser-search">
                        <IconSearch size={15} />
                        <input
                          id="repo-browser-search"
                          type="text"
                          value={searchTerm}
                          onChange={(event) => setSearchTerm(event.target.value)}
                          placeholder="Search files"
                        />
                      </label>
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
                      <button
                        type="button"
                        className="btn btn--secondary btn--sm"
                        onClick={() => {
                          // Collapse everything except the repo root
                          setExpandedPaths(new Set([repoPath]));
                        }}
                        title="Collapse all folders"
                        aria-label="Collapse all folders"
                      >
                        <svg
                          width={16}
                          height={16}
                          viewBox="0 0 16 16"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d="M3 7l3-3 3 3" />
                          <path d="M3 12l3-3 3 3" />
                          <path d="M11 5h2" />
                          <path d="M11 9h2" />
                          <path d="M11 13h2" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  <div className="repo-browser__panel">
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
                  {mode === 'manage-automation' && (
                    <div className="repo-browser__assign-bar">
                      <div className="repo-browser__preview">
                        <div className="repo-browser__preview-title">Automation Manager</div>
                        <div className="repo-browser__preview-line">
                          {associatedMethodName ? 'Azure method' : 'Generated method'}: {currentMethodName || 'Unavailable'}
                        </div>
                        <div className="repo-browser__preview-line">
                          Associated method: {associatedMethodName || 'Not associated'}
                        </div>
                        <div className="repo-browser__preview-line">
                          Associated class: {associatedClassName || 'Not associated'}
                        </div>
                        <div className="repo-browser__preview-line">
                          {hasMatchingMethodAnywhere
                            ? 'Showing related class and current test method.'
                            : 'Current test script is not available. Pick a class and add code first.'}
                        </div>
                      </div>
                    </div>
                  )}
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
                <span className="repo-browser__preview-label">PREVIEW</span>
                {previewFile && (
                  <span className="repo-browser__preview-filename" title={previewFile.path}>
                    {previewFile.path.split(/[\\/]/).pop()}
                  </span>
                )}
                {previewFile && (
                  <button
                    type="button"
                    className={`repo-browser__preview-toggle${wrapCode ? ' is-active' : ''}`}
                    onClick={() => setWrapCode((w) => !w)}
                    title={wrapCode ? 'Disable word wrap' : 'Enable word wrap'}
                    aria-label="Toggle word wrap"
                    aria-pressed={wrapCode}
                  >
                    ↩
                  </button>
                )}
                {previewFile && (
                  <button
                    type="button"
                    className="repo-browser__preview-close"
                    onClick={() => setPreviewFile(null)}
                    title="Close preview"
                    aria-label="Close preview"
                  >
                    <IconX size={14} />
                  </button>
                )}
              </div>
              <div className="repo-browser__preview-body">
                {!previewFile ? (
                  <div className="repo-browser__preview-empty">
                    <IconCode size={32} />
                    <p>Select a file from the repository to preview its content</p>
                  </div>
                ) : previewFile.loading ? (
                  <div className="repo-browser__preview-empty">Loading...</div>
                ) : previewFile.error ? (
                  <div className="repo-browser__preview-empty repo-browser__preview-empty--error">
                    {previewFile.error}
                  </div>
                ) : (
                  <pre className={`repo-browser__preview-code${wrapCode ? ' is-wrapped' : ''}`}>
                    <code
                      dangerouslySetInnerHTML={{
                        __html: renderCodeWithLineNumbers(
                          previewFile.path.toLowerCase().endsWith('.cs')
                            ? highlightCSharp(previewFile.content)
                            : escapeHtml(previewFile.content),
                        ),
                      }}
                    />
                  </pre>
                )}
              </div>
            </div>

            {/* Resize handle: middle | right */}
            <div
              className="repo-browser__resize-handle"
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize preview and git panels"
              onMouseDown={handleResizeStart('right')}
            />

            {/* Right Panel: Git Manager */}
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
          </div>
        </section>
      </div>
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
