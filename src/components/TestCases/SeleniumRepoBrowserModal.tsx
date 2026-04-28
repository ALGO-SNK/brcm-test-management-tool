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

interface SeleniumRepoBrowserModalProps {
  repoPath: string;
  onClose: () => void;
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

function getNodeName(repoPath: string): string {
  const normalized = repoPath.replace(/[\\/]+$/, '');
  const parts = normalized.split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] ?? repoPath;
}

export function SeleniumRepoBrowserModal({
  repoPath,
  onClose,
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
      const matches = Array.from(content.matchAll(/\[Test\][\s\S]*?public\s+void\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/g));
      const names = matches.map((match) => match[1]).filter(Boolean);
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

  useEffect(() => {
    void loadPath(repoPath, true);
  }, [repoPath, refreshToken]);

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
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

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
          const currentMethodDisplayName = currentMethodName || generatedMethodName || associatedMethodName;

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
    <div className="settings-overlay" role="dialog" aria-modal="true" aria-label="Selenium repo browser">
      <button
        type="button"
        className="settings-overlay__backdrop"
        onClick={onClose}
        aria-label="Close Selenium repo browser"
      />
      <div className="settings-dock settings-dock--no-aside">
        <section className="settings-workbench repo-browser">
          <header className="settings-workbench__header">
            <div>
              <p className="settings-workbench__crumb">Selenium Scripts / Repo Browser</p>
              <h1 className="settings-workbench__title">{getNodeName(repoPath)}</h1>
              <p className="settings-workbench__subtitle">{repoPath}</p>
            </div>
            <div className="repo-browser__header-actions">
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
                onClick={() => { void loadPath(repoPath, true); }}
                title="Refresh repo browser"
              >
                <IconRefresh size={16} />
              </button>
              <button
                type="button"
                className="settings-workbench__close"
                onClick={onClose}
                aria-label="Close Selenium repo browser"
                title="Close Selenium repo browser"
              >
                <IconX size={18} />
              </button>
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
                          Generated method: {generatedMethodName || 'Unavailable'}
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
    </div>
  );
}
