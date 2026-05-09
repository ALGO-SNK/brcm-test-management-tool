import { useEffect, useRef, useState } from 'react';
import {
  IconBranch,
  IconChevronRight,
  IconRefresh,
  IconPlus,
} from '../Common/Icons';
import { useNotification } from '../../context/useNotification';
import { SearchableSelect } from '../Common/SearchableSelect';

// Discard / Undo icon (curved arrow pointing back, like Material "undo")
function IconUndo({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 8h7a3 3 0 0 1 3 3v1" />
      <path d="M6 5L3 8l3 3" />
    </svg>
  );
}

// Git action icons (inline SVG for precise styling)
function IconGitPull({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 2v9" />
      <path d="M4 7l4 4 4-4" />
      <path d="M3 14h10" />
    </svg>
  );
}

function IconGitFetch({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 2v9" strokeDasharray="2 2" />
      <path d="M4 7l4 4 4-4" />
    </svg>
  );
}

function IconGitPush({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 2h10" />
      <path d="M8 5v9" />
      <path d="M4 9l4-4 4 4" />
    </svg>
  );
}

// Sync = bidirectional sync arrows (different from Refresh's circular arrow)
function IconGitSync({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M11 4l2 2-2 2" />
      <path d="M3 6h10" />
      <path d="M5 12l-2-2 2-2" />
      <path d="M13 10H3" />
    </svg>
  );
}

export interface GitFile {
  path: string;
  status: 'M' | 'A' | 'D' | 'U' | '?';
  additions?: number;
  deletions?: number;
}

interface GitManagerProps {
  repoPath: string;
  unstagedFiles: GitFile[];
  stagedFiles: GitFile[];
  branch: string | null;
  branches?: DesktopGitBranch[];
  aheadCount?: number;
  behindCount?: number;
  isLoading?: boolean;
  onStatusChange?: (status: { unstaged: GitFile[]; staged: GitFile[]; branch: string | null; aheadCount: number; behindCount: number }) => void;
  onAddFiles?: (files: GitFile[]) => void;
  onUnstageFiles?: (files: GitFile[]) => void;
  onCommit?: (message: string) => void;
  onPush?: () => void;
  onPull?: () => void;
  onFetch?: () => void;
  onSync?: () => void;
  onBranchChange?: (branchValue: string) => void;
}

export function GitManager({
  repoPath,
  unstagedFiles = [],
  stagedFiles = [],
  branch,
  branches = [],
  aheadCount = 0,
  behindCount = 0,
  isLoading = false,
  onStatusChange,
  onAddFiles,
  onUnstageFiles,
  onCommit,
  onPush,
  onPull,
  onFetch,
  onSync,
  onBranchChange,
}: GitManagerProps) {
  const { addNotification } = useNotification();
  // Helper: signal parent to refresh git status after any successful op.
  const triggerRefresh = () => {
    onStatusChange?.({
      unstaged: [],
      staged: [],
      branch,
      aheadCount,
      behindCount,
    });
  };
  const [selectedUnstaged, setSelectedUnstaged] = useState<Set<string>>(new Set());
  const [selectedStaged, setSelectedStaged] = useState<Set<string>>(new Set());
  const [commitMessage, setCommitMessage] = useState('');
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const [stashes, setStashes] = useState<Array<{ ref: string; message: string; age: string }>>([]);
  const [selectedStashRef, setSelectedStashRef] = useState<string>('');
  const [expandedSections, setExpandedSections] = useState({
    unstaged: true,
    staged: true,
    stash: false,
    advanced: false,
  });
  const [isCommitting, setIsCommitting] = useState(false);
  const [isOperating, setIsOperating] = useState(false);
  const unstagedCheckboxRef = useRef<HTMLInputElement | null>(null);
  const stagedCheckboxRef = useRef<HTMLInputElement | null>(null);
  const actionsMenuRef = useRef<HTMLDivElement | null>(null);

  const refreshStashes = async () => {
    if (!repoPath || !window.desktop?.gitListStashes) return;
    try {
      const list = await window.desktop.gitListStashes(repoPath);
      setStashes(list || []);
      if (list && list.length > 0 && !selectedStashRef) {
        setSelectedStashRef(list[0].ref);
      }
    } catch { /* ignore */ }
  };

  const performStashPop = async () => {
    if (!window.desktop?.gitStashPop) {
      addNotification('error', 'Stash pop unavailable. Restart the app to load latest changes.');
      return;
    }
    setIsOperating(true);
    try {
      const result = await window.desktop.gitStashPop(repoPath, {
        stashRef: selectedStashRef || undefined,
      });
      if (result?.success) {
        addNotification('success', 'Stash applied.');
        setSelectedStashRef('');
        triggerRefresh();
      } else {
        addNotification('error', `Failed to pop stash: ${result?.error || result?.message || 'Unknown error'}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to pop stash';
      addNotification('error', message);
    } finally {
      setIsOperating(false);
    }
  };

  // Load stashes on mount, refresh after every operation
  useEffect(() => {
    void refreshStashes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repoPath, isOperating]);

  const updateCheckboxIndeterminate = (
    ref: React.RefObject<HTMLInputElement | null>,
    isIndeterminate: boolean
  ) => {
    if (ref.current) {
      ref.current.indeterminate = isIndeterminate;
    }
  };

  useEffect(() => {
    const isIndeterminate =
      selectedUnstaged.size > 0 && selectedUnstaged.size < unstagedFiles.length;
    updateCheckboxIndeterminate(unstagedCheckboxRef, isIndeterminate);
  }, [selectedUnstaged, unstagedFiles.length]);

  useEffect(() => {
    const isIndeterminate =
      selectedStaged.size > 0 && selectedStaged.size < stagedFiles.length;
    updateCheckboxIndeterminate(stagedCheckboxRef, isIndeterminate);
  }, [selectedStaged, stagedFiles.length]);

  const toggleUnstagedSelection = (path: string) => {
    setSelectedUnstaged((current) => {
      const next = new Set(current);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const toggleStagedSelection = (path: string) => {
    setSelectedStaged((current) => {
      const next = new Set(current);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const selectAllUnstaged = () => {
    if (selectedUnstaged.size === unstagedFiles.length) {
      setSelectedUnstaged(new Set());
    } else {
      setSelectedUnstaged(new Set(unstagedFiles.map((f) => f.path)));
    }
  };

  const selectAllStaged = () => {
    if (selectedStaged.size === stagedFiles.length) {
      setSelectedStaged(new Set());
    } else {
      setSelectedStaged(new Set(stagedFiles.map((f) => f.path)));
    }
  };

  const getStatusColor = (status: GitFile['status']): string => {
    switch (status) {
      case 'M': return 'git-status--modified';
      case 'A': return 'git-status--added';
      case 'D': return 'git-status--deleted';
      case 'U': return 'git-status--unmerged';
      case '?': return 'git-status--untracked';
      default: return '';
    }
  };

  const getStatusLabel = (status: GitFile['status']): string => {
    switch (status) {
      case 'M': return 'Modified — file content changed';
      case 'A': return 'Added — new file (untracked or staged for commit)';
      case 'D': return 'Deleted — file removed from working tree';
      case 'U': return 'Unmerged — conflict needs resolution';
      case '?': return 'Untracked — new file not yet tracked by git';
      default: return status;
    }
  };

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections((current) => ({
      ...current,
      [section]: !current[section],
    }));
  };

  const performGitAdd = async (filesOverride?: GitFile[]) => {
    const filesToAdd = filesOverride ?? unstagedFiles.filter((f) => selectedUnstaged.has(f.path));
    if (filesToAdd.length === 0) return;

    if (!window.desktop?.gitAdd) {
      addNotification('error', 'Stage operation unavailable. Restart the app to load latest changes.');
      return;
    }

    setIsOperating(true);
    try {
      const result = await window.desktop.gitAdd(repoPath, filesToAdd.map((f) => f.path));

      if (result?.success) {
        addNotification('success', `Staged ${filesToAdd.length} file(s)`);
        onAddFiles?.(filesToAdd);
        if (!filesOverride) setSelectedUnstaged(new Set());
        triggerRefresh();
      } else {
        const errorDetail = result?.error || result?.message || 'Unknown error';
        addNotification('error', `Failed to stage: ${errorDetail}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to stage files';
      addNotification('error', message);
    } finally {
      setIsOperating(false);
    }
  };

  const performDiscardFile = async (file: GitFile) => {
    const fileName = file.path.split(/[\\/]/).pop() || file.path;
    const confirmed = window.confirm(`Discard changes to "${fileName}"? This cannot be undone.`);
    if (!confirmed) return;

    if (!window.desktop?.gitDiscard) {
      addNotification('error', 'Discard unavailable. Restart the app to load latest changes.');
      return;
    }

    setIsOperating(true);
    try {
      const result = await window.desktop.gitDiscard(repoPath, [file.path]);
      if (result?.success) {
        addNotification('success', `Discarded "${fileName}".`);
        triggerRefresh();
      } else {
        addNotification('error', `Failed to discard: ${result?.error || result?.message || 'Unknown error'}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to discard file';
      addNotification('error', message);
    } finally {
      setIsOperating(false);
    }
  };

  const performStashSelected = async () => {
    const filesToStash = unstagedFiles.filter((f) => selectedUnstaged.has(f.path));
    if (filesToStash.length === 0) return;

    if (!window.desktop?.gitStash) {
      addNotification('error', 'Stash unavailable. Restart the app to load latest changes.');
      return;
    }

    setIsOperating(true);
    try {
      const result = await window.desktop.gitStash(repoPath, {
        files: filesToStash.map((f) => f.path),
      });
      if (result?.success) {
        addNotification('success', `Stashed ${filesToStash.length} file(s).`);
        setSelectedUnstaged(new Set());
        triggerRefresh();
      } else {
        addNotification('error', `Failed to stash: ${result?.error || result?.message || 'Unknown error'}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to stash files';
      addNotification('error', message);
    } finally {
      setIsOperating(false);
    }
  };

  const performGitUnstageFile = async (file: GitFile) => {
    setIsOperating(true);
    try {
      const result = await window.desktop?.gitUnstage?.(repoPath, [file.path]);
      if (result?.success) {
        addNotification('success', `Unstaged ${file.path.split(/[\\/]/).pop()}`);
        onUnstageFiles?.([file]);
        triggerRefresh();
      } else {
        const errorDetail = result?.error || result?.message || 'Unknown error';
        addNotification('error', `Failed to unstage: ${errorDetail}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to unstage file';
      addNotification('error', message);
    } finally {
      setIsOperating(false);
    }
  };

  const performGitUnstage = async () => {
    if (selectedStaged.size === 0) return;

    setIsOperating(true);
    try {
      const filesToUnstage = stagedFiles.filter((f) => selectedStaged.has(f.path));
      const result = await window.desktop?.gitUnstage?.(repoPath, filesToUnstage.map((f) => f.path));

      if (result?.success) {
        addNotification('success', `Unstaged ${filesToUnstage.length} file(s)`);
        onUnstageFiles?.(filesToUnstage);
        setSelectedStaged(new Set());
        triggerRefresh();
      } else {
        const errorDetail = result?.error || result?.message || 'Unknown error';
        addNotification('error', `Failed to unstage: ${errorDetail}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to unstage files';
      addNotification('error', message);
    } finally {
      setIsOperating(false);
    }
  };

  const performGitCommit = async () => {
    if (!commitMessage.trim()) {
      addNotification('error', 'Commit message is required');
      return;
    }

    setIsCommitting(true);
    try {
      const result = await window.desktop?.gitCommit?.(repoPath, commitMessage);

      if (result?.success) {
        addNotification('success', 'Changes committed');
        onCommit?.(commitMessage);
        setCommitMessage('');
        setSelectedStaged(new Set());
        triggerRefresh();
      } else {
        const errorDetail = result?.error || result?.message || 'Unknown error';
        addNotification('error', `Failed to commit: ${errorDetail}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to commit';
      addNotification('error', message);
    } finally {
      setIsCommitting(false);
    }
  };

  const performGitPush = async () => {
    setIsOperating(true);
    try {
      const result = await window.desktop?.gitPush?.(repoPath);
      if (result?.success) {
        addNotification('success', 'Changes pushed');
        onPush?.();
        triggerRefresh();
      } else {
        const errorDetail = result?.error || result?.message || 'Unknown error';
        addNotification('error', `Failed to push: ${errorDetail}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to push';
      addNotification('error', message);
    } finally {
      setIsOperating(false);
    }
  };

  const performGitPull = async () => {
    setIsOperating(true);
    try {
      const result = await window.desktop?.gitPull?.(repoPath);
      if (result?.success) {
        addNotification('success', 'Latest changes pulled');
        onPull?.();
        triggerRefresh();
      } else {
        const errorDetail = result?.error || result?.message || 'Unknown error';
        addNotification('error', `Failed to pull: ${errorDetail}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to pull';
      addNotification('error', message);
    } finally {
      setIsOperating(false);
    }
  };

  const performGitFetch = async () => {
    setIsOperating(true);
    try {
      const result = await window.desktop?.gitFetch?.(repoPath);
      if (result?.success) {
        addNotification('success', 'Remote changes fetched');
        onFetch?.();
        triggerRefresh();
      } else {
        const errorDetail = result?.error || result?.message || 'Unknown error';
        addNotification('error', `Failed to fetch: ${errorDetail}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch';
      addNotification('error', message);
    } finally {
      setIsOperating(false);
    }
  };

  const performGitSync = async () => {
    setIsOperating(true);
    try {
      const result = await window.desktop?.gitSync?.(repoPath);
      if (result?.success) {
        addNotification('success', 'Repository synchronized');
        onSync?.();
        triggerRefresh();
      } else {
        const errorDetail = result?.error || result?.message || 'Unknown error';
        addNotification('error', `Failed to sync: ${errorDetail}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to sync';
      addNotification('error', message);
    } finally {
      setIsOperating(false);
    }
  };

  const branchOptions = branches.map((b) => ({
    value: `${b.type}:${b.name}`,
    label: b.name,
    group: b.type === 'remote' ? 'Remote branches' : 'Local branches',
  }));

  const currentBranchEntry = branches.find((b) => b.current)
    ?? branches.find((b) => b.type === 'local' && b.name === branch);
  const currentBranchValue = currentBranchEntry
    ? `${currentBranchEntry.type}:${currentBranchEntry.name}`
    : '';

  return (
    <div className="git-manager">
      {/* Unified 36px header bar with title + branch + actions */}
      <div className="git-manager__title-bar">
        <span className="git-manager__title-label">GIT</span>
        <div className="git-manager__header-top">
          <div className="git-manager__status">
            <div className="git-manager__branch-selector">
              <IconBranch size={14} className="git-manager__icon" />
              {branches.length > 0 ? (
                <SearchableSelect
                  className="git-manager__branch-dropdown"
                  options={branchOptions}
                  value={currentBranchValue}
                  onChange={(value) => {
                    if (!value) return;
                    onBranchChange?.(value);
                  }}
                  placeholder="Search branches"
                  emptyLabel={branch || 'Not a Git repository'}
                />
              ) : (
                <span className="git-manager__branch-name">
                  {branch || 'Not a Git repository'}
                </span>
              )}
            </div>
            {(aheadCount > 0 || behindCount > 0) && (
              <div className="git-manager__commits">
                {aheadCount > 0 && (
                  <span
                    className="git-manager__ahead"
                    title={`${aheadCount} local commit${aheadCount !== 1 ? 's' : ''} not yet pushed to remote. Click Push to upload them.`}
                  >
                    <IconGitPush size={11} /> {aheadCount}
                  </span>
                )}
                {behindCount > 0 && (
                  <span
                    className="git-manager__behind"
                    title={`${behindCount} commit${behindCount !== 1 ? 's' : ''} on remote not yet pulled to local. Click Pull to download them.`}
                  >
                    <IconGitPull size={11} /> {behindCount}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Actions Menu */}
          <div className="git-manager__actions-menu" ref={actionsMenuRef}>
            <button
              type="button"
              className="git-manager__actions-trigger"
              onClick={() => setShowActionsMenu(!showActionsMenu)}
              disabled={isLoading || isOperating}
              title="Git actions"
              aria-label="More git actions"
            >
              ⋮
            </button>
            {showActionsMenu && (
              <div className="git-manager__actions-dropdown">
                <button
                  type="button"
                  className="git-manager__action-item"
                  onClick={() => {
                    void performGitPull();
                    setShowActionsMenu(false);
                  }}
                  disabled={isLoading || isOperating}
                  title="Pull latest changes"
                >
                  <IconGitPull size={14} />
                  Pull
                </button>
                <button
                  type="button"
                  className="git-manager__action-item"
                  onClick={() => {
                    void performGitFetch();
                    setShowActionsMenu(false);
                  }}
                  disabled={isLoading || isOperating}
                  title="Fetch remote changes"
                >
                  <IconGitFetch size={14} />
                  Fetch
                </button>
                <button
                  type="button"
                  className="git-manager__action-item"
                  onClick={() => {
                    void performGitPush();
                    setShowActionsMenu(false);
                  }}
                  disabled={isLoading || isOperating}
                  title="Push changes to remote"
                >
                  <IconGitPush size={14} />
                  Push
                </button>
                <button
                  type="button"
                  className="git-manager__action-item"
                  onClick={() => {
                    void performGitSync();
                    setShowActionsMenu(false);
                  }}
                  disabled={isLoading || isOperating}
                  title="Pull then push (sync with remote)"
                >
                  <IconGitSync size={14} aria-hidden="true" />
                  Sync
                </button>
                <button
                  type="button"
                  className="git-manager__action-item"
                  onClick={() => {
                    triggerRefresh();
                    setShowActionsMenu(false);
                  }}
                  disabled={isLoading || isOperating}
                  title="Refresh git status"
                >
                  <IconRefresh size={14} aria-hidden="true" />
                  Refresh
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Changes Sections */}
      <div className="git-manager__changes">
        {/* Unstaged Files */}
        <section className="git-manager__section">
          <button
            type="button"
            className="git-manager__section-header"
            onClick={() => toggleSection('unstaged')}
          >
            <span
              className={`git-manager__chevron${expandedSections.unstaged ? ' is-expanded' : ''}`}
              aria-hidden="true"
            >
              <IconChevronRight size={16} />
            </span>
            <span className="git-manager__section-title">
              Changes ({unstagedFiles.length})
            </span>
            {selectedUnstaged.size > 0 && (
              <span className="git-manager__selection-badge">
                {selectedUnstaged.size} selected
              </span>
            )}
          </button>

          {expandedSections.unstaged && (
            <>
              <div className="git-manager__section-controls">
                <label className="git-manager__checkbox-label">
                  <input
                    ref={unstagedCheckboxRef}
                    type="checkbox"
                    className="git-manager__checkbox"
                    checked={
                      unstagedFiles.length > 0 &&
                      selectedUnstaged.size === unstagedFiles.length
                    }
                    onChange={selectAllUnstaged}
                  />
                  <span>Select All</span>
                </label>
                {selectedUnstaged.size > 0 && (
                  <div className="git-manager__inline-actions">
                    <button
                      type="button"
                      className="git-manager__inline-btn git-manager__inline-btn--primary"
                      onClick={() => void performGitAdd()}
                      disabled={isLoading || isOperating}
                      title="Stage selected files"
                    >
                      <IconPlus size={11} aria-hidden="true" />
                      Stage {selectedUnstaged.size}
                    </button>
                    <button
                      type="button"
                      className="git-manager__inline-btn"
                      onClick={() => void performStashSelected()}
                      disabled={isLoading || isOperating}
                      title="Stash selected changes"
                    >
                      📦 Stash {selectedUnstaged.size}
                    </button>
                  </div>
                )}
              </div>

              {unstagedFiles.length > 0 ? (
                <div className="git-manager__file-list">
                  {unstagedFiles.map((file) => {
                    const lastSep = Math.max(file.path.lastIndexOf('/'), file.path.lastIndexOf('\\'));
                    const fileName = lastSep >= 0 ? file.path.substring(lastSep + 1) : file.path;
                    const dirPath = lastSep >= 0 ? file.path.substring(0, lastSep) : '';
                    return (
                      <div
                        key={file.path}
                        className={`git-manager__file-row ${getStatusColor(file.status)}`}
                      >
                        <label className="git-manager__file-checkbox">
                          <input
                            type="checkbox"
                            className="git-manager__checkbox"
                            checked={selectedUnstaged.has(file.path)}
                            onChange={() => toggleUnstagedSelection(file.path)}
                          />
                        </label>
                        <div className="git-manager__file-info">
                          <span className="git-manager__file-name" title={file.path}>
                            {fileName}
                          </span>
                          {dirPath && (
                            <span className="git-manager__file-dir" title={dirPath}>
                              {dirPath}
                            </span>
                          )}
                        </div>
                        <span className="git-manager__file-status" title={getStatusLabel(file.status)}>
                          {file.status}
                        </span>
                        <button
                          type="button"
                          className="git-manager__file-action git-manager__file-action--discard"
                          title="Discard changes"
                          disabled={isLoading || isOperating}
                          onClick={() => void performDiscardFile(file)}
                        >
                          <IconUndo size={14} />
                        </button>
                        <button
                          type="button"
                          className="git-manager__file-action git-manager__file-action--stage"
                          title="Stage this file"
                          disabled={isLoading || isOperating}
                          onClick={() => void performGitAdd([file])}
                        >
                          <IconPlus size={14} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="git-manager__empty-state">
                  No changes to stage
                </div>
              )}

            </>
          )}
        </section>

        {/* Staged Files */}
        <section className="git-manager__section">
          <button
            type="button"
            className="git-manager__section-header"
            onClick={() => toggleSection('staged')}
          >
            <span
              className={`git-manager__chevron${expandedSections.staged ? ' is-expanded' : ''}`}
              aria-hidden="true"
            >
              <IconChevronRight size={16} />
            </span>
            <span className="git-manager__section-title">
              Staged ({stagedFiles.length})
            </span>
            {selectedStaged.size > 0 && (
              <span className="git-manager__selection-badge">
                {selectedStaged.size} selected
              </span>
            )}
          </button>

          {expandedSections.staged && (
            <>
              <div className="git-manager__section-controls">
                <label className="git-manager__checkbox-label">
                  <input
                    ref={stagedCheckboxRef}
                    type="checkbox"
                    className="git-manager__checkbox"
                    checked={
                      stagedFiles.length > 0 &&
                      selectedStaged.size === stagedFiles.length
                    }
                    onChange={selectAllStaged}
                  />
                  <span>Select All</span>
                </label>
                {selectedStaged.size > 0 && (
                  <div className="git-manager__inline-actions">
                    <button
                      type="button"
                      className="git-manager__inline-btn"
                      onClick={() => void performGitUnstage()}
                      disabled={isLoading || isOperating}
                      title="Unstage selected files"
                    >
                      <IconUndo size={11} />
                      Unstage {selectedStaged.size}
                    </button>
                  </div>
                )}
              </div>

              {stagedFiles.length > 0 ? (
                <div className="git-manager__file-list">
                  {stagedFiles.map((file) => {
                    const lastSep = Math.max(file.path.lastIndexOf('/'), file.path.lastIndexOf('\\'));
                    const fileName = lastSep >= 0 ? file.path.substring(lastSep + 1) : file.path;
                    const dirPath = lastSep >= 0 ? file.path.substring(0, lastSep) : '';
                    return (
                      <div
                        key={file.path}
                        className={`git-manager__file-row ${getStatusColor(file.status)}`}
                      >
                        <label className="git-manager__file-checkbox">
                          <input
                            type="checkbox"
                            className="git-manager__checkbox"
                            checked={selectedStaged.has(file.path)}
                            onChange={() => toggleStagedSelection(file.path)}
                          />
                        </label>
                        <div className="git-manager__file-info">
                          <span className="git-manager__file-name" title={file.path}>
                            {fileName}
                          </span>
                          {dirPath && (
                            <span className="git-manager__file-dir" title={dirPath}>
                              {dirPath}
                            </span>
                          )}
                        </div>
                        <span className="git-manager__file-status" title={getStatusLabel(file.status)}>
                          {file.status}
                        </span>
                        <button
                          type="button"
                          className="git-manager__file-action git-manager__file-action--discard"
                          title="Unstage this file"
                          disabled={isLoading || isOperating}
                          onClick={() => void performGitUnstageFile(file)}
                        >
                          <IconUndo size={14} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="git-manager__empty-state">
                  No files staged for commit
                </div>
              )}

            </>
          )}
        </section>
      </div>

      {/* Commit Section */}
      {stagedFiles.length > 0 && (
        <section className="git-manager__commit">
          <h4 className="git-manager__commit-label">
            Commit ({stagedFiles.length} file{stagedFiles.length !== 1 ? 's' : ''})
          </h4>
          <textarea
            className="git-manager__commit-message"
            placeholder="Commit message (required)"
            value={commitMessage}
            onChange={(e) => setCommitMessage(e.target.value)}
            disabled={isCommitting}
            rows={4}
          />
          <div className="git-manager__commit-actions">
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => void performGitCommit()}
              disabled={!commitMessage.trim() || isCommitting}
            >
              {isCommitting ? 'Committing...' : 'Commit'}
            </button>
            <button
              type="button"
              className="btn btn--secondary"
              onClick={() => {
                setCommitMessage('');
              }}
              disabled={isCommitting}
            >
              Clear
            </button>
          </div>
        </section>
      )}

      {/* Stash Operations (collapsible) */}
      <section className="git-manager__section">
        <button
          type="button"
          className="git-manager__section-header"
          onClick={() => toggleSection('stash')}
        >
          <span
            className={`git-manager__chevron${expandedSections.stash ? ' is-expanded' : ''}`}
            aria-hidden="true"
          >
            <IconChevronRight size={16} />
          </span>
          <span className="git-manager__section-title">Stash</span>
        </button>

        {expandedSections.stash && (
          <div className="git-manager__advanced">
            <div className="git-manager__advanced-group">
              <label className="git-manager__stash-label">
                <span className="git-manager__advanced-title">Select Stash</span>
                <select
                  className="git-manager__stash-select"
                  disabled={stashes.length === 0 || isOperating}
                  value={selectedStashRef}
                  onChange={(e) => setSelectedStashRef(e.target.value)}
                  title="Stash list"
                >
                  {stashes.length === 0 ? (
                    <option value="">No stashes available</option>
                  ) : (
                    stashes.map((s) => (
                      <option key={s.ref} value={s.ref}>
                        {s.ref}: {s.message} {s.age ? `(${s.age})` : ''}
                      </option>
                    ))
                  )}
                </select>
              </label>
            </div>
            <div className="git-manager__advanced-group">
              <div className="git-manager__advanced-actions">
                <button
                  type="button"
                  className="btn btn--secondary btn--sm"
                  onClick={() => void performStashSelected()}
                  disabled={isOperating || (selectedUnstaged.size === 0 && unstagedFiles.length === 0)}
                  title={selectedUnstaged.size > 0 ? 'Stash selected files' : 'Stash all changes'}
                >
                  📦 Stash{selectedUnstaged.size > 0 ? ` ${selectedUnstaged.size}` : ' All'}
                </button>
                <button
                  type="button"
                  className="btn btn--secondary btn--sm"
                  onClick={() => void performStashPop()}
                  disabled={isOperating || stashes.length === 0}
                  title="Apply (and remove) the selected stash"
                >
                  📥 Stash Pop
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
