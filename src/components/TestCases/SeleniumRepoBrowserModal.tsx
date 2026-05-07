import { useEffect, useMemo, useRef, useState } from 'react';
import {
  IconAddLink,
  IconBranch,
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
import { SearchableSelect } from '../Common/SearchableSelect';

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

function getNodeName(repoPath: string): string {
  const normalized = repoPath.replace(/[\\/]+$/, '');
  const parts = normalized.split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] ?? repoPath;
}

function extractTestMethodNames(content: string): string[] {
  const matches = Array.from(content.matchAll(/\[Test\][\s\S]*?public\s+void\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/g));
  return matches.map((match) => match[1]).filter(Boolean);
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
  const [branchSwitching, setBranchSwitching] = useState(false);
  const [pendingBranchSwitch, setPendingBranchSwitch] = useState<PendingBranchSwitch | null>(null);
  const [methodSearch, setMethodSearch] = useState<MethodSearchState>({
    loading: false,
    methodName: '',
  });
  const [searchTerm, setSearchTerm] = useState('');
  const methodRowRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const { addNotification } = useNotification();

  const rootNode = useMemo(() => nodesByPath[repoPath], [nodesByPath, repoPath]);
  const isClassFile = (entry: DesktopDirectoryEntry) => entry.type === 'file' && entry.name.toLowerCase().endsWith('.cs');
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

  const reloadRepository = async () => {
    setNodesByPath({});
    setFileTestNamesByPath({});
    setExpandedPaths(new Set([repoPath]));
    await Promise.all([
      loadPath(repoPath, true),
      loadGitBranch(repoPath),
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
        void loadGitBranch(repoPath);
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

  useEffect(() => {
    void reloadRepository();
  }, [repoPath, refreshToken]);

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
  const branchLabel = gitBranch.loading
    ? 'Checking branch...'
    : branchSwitching
      ? 'Switching branch...'
    : gitBranch.branch
      ? `Branch: ${gitBranch.branch}`
      : gitBranch.isGitRepository
        ? 'Branch unavailable'
        : gitBranch.message
          ? 'Git branch lookup unavailable'
        : 'Not a Git repository';
  const currentBranchOption = gitBranch.branches.find((branch) => branch.current)
    ?? gitBranch.branches.find((branch) => branch.type === 'local' && branch.name === gitBranch.branch);
  const currentBranchValue = currentBranchOption ? `${currentBranchOption.type}:${currentBranchOption.name}` : '';
  const branchOptions = useMemo(
    () => gitBranch.branches.map((branch) => ({
      value: `${branch.type}:${branch.name}`,
      label: branch.name,
      group: branch.type === 'remote' ? 'Remote branches' : 'Local branches',
    })),
    [gitBranch.branches],
  );
  const isBranchSelectDisabled = !gitBranch.gitAvailable || gitBranch.loading || branchSwitching || actionBusy;

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
                  <div className={`repo-browser__item repo-browser__item--file${isAssociatedClass ? ' is-selected' : ''}`}>
                    <button
                      type="button"
                      className={`repo-browser__toggle-btn${isExpanded ? ' is-expanded' : ''}`}
                      onClick={() => toggleNode(entry.path)}
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
                  <div className="repo-browser__item repo-browser__item--file" title={entry.path}>
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
              <h1 className="settings-workbench__title">{getNodeName(repoPath)}</h1>
              <p className="settings-workbench__subtitle">{repoPath}</p>
            </div>
            <div className="repo-browser__header-actions">
              <div className="repo-browser__repo-meta" aria-live="polite">
                {gitBranch.isGitRepository && gitBranch.branches.length > 0 ? (
                  <div
                    className={`repo-browser__branch-select${gitBranch.branch ? ' is-active' : ''}${isBranchSelectDisabled ? ' is-disabled' : ''}`}
                    title={gitBranch.gitAvailable ? 'Switch Git branch' : gitBranch.message ?? 'Git executable unavailable'}
                  >
                    <IconBranch size={15} className="repo-browser__branch-select-icon" />
                    <SearchableSelect
                      className="repo-browser__branch-dropdown"
                      options={branchOptions}
                      value={currentBranchValue}
                      onChange={(value) => {
                        if (isBranchSelectDisabled) {
                          return;
                        }
                        void handleBranchChange(value);
                      }}
                      placeholder="Search branches"
                      emptyLabel={branchLabel}
                    />
                  </div>
                ) : (
                  <span
                    className={`repo-browser__branch-pill${gitBranch.branch ? ' is-active' : ''}`}
                    title={gitBranch.message ?? undefined}
                  >
                    <IconBranch size={15} />
                    <span>{branchLabel}</span>
                  </span>
                )}
              </div>
              <label className="repo-browser__search repo-browser__search--header" htmlFor="repo-browser-search">
                <IconSearch size={15} />
                <input
                  id="repo-browser-search"
                  type="text"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search files or test methods"
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

          <div className="settings-workbench__body repo-browser__body">
            <div className="settings-content">
              <section className="settings-pane">
                <div className="settings-panel">
                  <div className="settings-panel__head">
                    <h3 className="settings-panel__title">Repository Contents</h3>
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
                  <div className="repo-browser__panel">
                    {rootNode?.loading && rootNode.entries.length === 0 ? (
                      <div className="repo-browser__state">Loading repository contents...</div>
                    ) : null}
                    {renderEntries(repoPath)}
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
          </div>
        </section>
      </div>
      {pendingBranchSwitch && (
        <div className="repo-browser__branch-conflict" role="dialog" aria-modal="true" aria-label="Commit changes to switch branch">
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
              <h3>Commit changes to switch branch</h3>
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
              Your changes to the following files would be overwritten by checkout:
            </p>
            <div className="repo-browser__branch-conflict-files">
              {pendingBranchSwitch.changedFiles.length > 0 ? (
                pendingBranchSwitch.changedFiles.map((file) => (
                  <div key={`${file.status}:${file.path}`} className="repo-browser__branch-conflict-file">
                    <span className="repo-browser__branch-conflict-path">{file.path}</span>
                    <span className="repo-browser__branch-conflict-stats">
                      <span className="repo-browser__branch-conflict-add">+{file.additions}</span>
                      <span className="repo-browser__branch-conflict-del">-{file.deletions}</span>
                    </span>
                  </div>
                ))
              ) : (
                <div className="repo-browser__branch-conflict-file">
                  <span className="repo-browser__branch-conflict-path">Local repository changes</span>
                </div>
              )}
            </div>
            <p className="repo-browser__branch-conflict-copy">Please commit your changes to continue</p>
            <div className="repo-browser__branch-conflict-actions">
              <button
                type="button"
                className="btn btn--secondary"
                onClick={() => setPendingBranchSwitch(null)}
                disabled={branchSwitching}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => { void handleCommitAndSwitchBranch(); }}
                disabled={branchSwitching}
              >
                {branchSwitching ? 'Committing...' : 'Commit and switch branch...'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
