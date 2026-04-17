import { useEffect, useMemo, useRef, useState } from 'react';
import { IconChevronDown, IconDelete, IconSearch, IconVisibility, IconX } from '../Common/Icons';
import type { ADOTestCase } from '../../types';
import type { WorkspaceSettingsValues } from '../pages/WorkspaceSettings';
import { EmptyTestCases } from './EmptyTestCases';
import { CreateTestCaseForm } from './CreateTestCaseForm';
import { deleteTestCase, fetchTestCasesForSuite, getCachedTestCasesForSuite, createTestCase } from '../../services/adoApi';
import { buildTestCaseData } from '../../utils/testCaseBuilder';
import { useNotification } from '../../context/useNotification';

function getInitials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'TC';
  return parts.map((word) => word[0]).join('').toUpperCase().slice(0, 2);
}

interface CaseTableProps {
  planId: number;
  suiteId: number;
  suiteName: string;
  suiteTestCasesHref?: string;
  suiteSelfHref?: string;
  workspaceSettings: WorkspaceSettingsValues;
  onSelectCase: (testCase: ADOTestCase) => void;
  onCaseCountChange?: (count: number) => void;
  onTestCaseCreated?: (newCase: ADOTestCase) => void;
  isCreateMode?: boolean;
  onCreateModeChange?: (isCreateMode: boolean) => void;
}

type SortField = 'id' | 'name' | 'state' | 'priority';
type SortOrder = 'asc' | 'desc';

interface SortOption {
  key: string;
  label: string;
  field: SortField;
  order: SortOrder;
}

const SORT_OPTIONS: SortOption[] = [
  { key: 'latest-id', label: 'Latest ID', field: 'id', order: 'desc' },
  { key: 'oldest-id', label: 'Oldest Id', field: 'id', order: 'asc' },
  { key: 'name-asc', label: 'Name: A to Z', field: 'name', order: 'asc' },
  { key: 'name-desc', label: 'Name: Z to A', field: 'name', order: 'desc' },
  { key: 'priority-high', label: 'Priority: High to Low', field: 'priority', order: 'desc' },
  { key: 'priority-low', label: 'Priority: Low to High', field: 'priority', order: 'asc' },
];

function getStatusBadgeClass(status: string): string {
  switch (status.trim().toLowerCase()) {
    case 'ready':
      return 'badge badge--success';
    case 'closed':
      return 'badge badge--neutral';
    case 'removed':
      return 'badge badge--danger';
    case 'design':
      return 'badge badge--info';
    default:
      return 'badge badge--warning';
  }
}

/*function normalizeFieldText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return '';
}*/



export function CaseTable({
  planId,
  suiteId,
  suiteName,
  suiteTestCasesHref,
  suiteSelfHref,
  workspaceSettings,
  onSelectCase,
  onCaseCountChange,
  onTestCaseCreated,
  isCreateMode: propIsCreateMode,
  onCreateModeChange,
}: CaseTableProps) {
  const showSelectionColumn = false;

  const [cases, setCases] = useState<ADOTestCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('id');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const sortMenuRef = useRef<HTMLDivElement>(null);
  const [localIsCreateMode, setLocalIsCreateMode] = useState(false);
  const createModeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [deleteTargetCase, setDeleteTargetCase] = useState<ADOTestCase | null>(null);
  const [blockedRemovalCase, setBlockedRemovalCase] = useState<ADOTestCase | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const { addNotification } = useNotification();

  // Use prop if provided, otherwise use local state
  const isCreateMode = propIsCreateMode !== undefined ? propIsCreateMode : localIsCreateMode;
  const setIsCreateMode = (value: boolean) => {
    onCreateModeChange?.(value);
    setLocalIsCreateMode(value);
  };

  const workspaceReady = Boolean(
    workspaceSettings.organization.trim()
      && workspaceSettings.projectName.trim()
      && workspaceSettings.patToken.trim(),
  );

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    const loadCases = async () => {
      if (!workspaceReady) {
        setCases([]);
        setLoading(false);
        setRefreshing(false);
        setError('Configure Organization, Project, and PAT in Settings to load test cases.');
        setWarning(null);
        return;
      }

      const cached = getCachedTestCasesForSuite(workspaceSettings, planId, suiteId);
      const hasCachedCases = Boolean(cached && cached.data.length > 0);

      setError(null);
      setWarning(null);
      setSelected(new Set());

      if (cached) {
        setCases(cached.data);
        setLoading(false);
      } else {
        setCases([]);
        setLoading(true);
      }

      if (cached?.fresh) {
        setRefreshing(false);
        return;
      }

      try {
        setRefreshing(hasCachedCases);
        const data = await fetchTestCasesForSuite(
          workspaceSettings,
          planId,
          suiteId,
          suiteTestCasesHref,
          suiteSelfHref,
          controller.signal,
        );
        if (!active) return;
        setCases(data);
      } catch (err) {
        if (!active) return;
        if (hasCachedCases) {
          setWarning('Showing cached test cases. Live sync failed and will retry automatically.');
          return;
        }
        setError(err instanceof Error ? err.message : 'Failed to load test cases');
      } finally {
        if (active) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    };

    loadCases().then();
    return () => {
      active = false;
      controller.abort();
    };
  }, [planId, suiteId, suiteSelfHref, suiteTestCasesHref, workspaceReady, workspaceSettings]);

  useEffect(() => {
    if (!loading) {
      onCaseCountChange?.(cases.length);
    }
  }, [cases.length, loading, onCaseCountChange]);

  useEffect(() => () => {
    if (createModeTimerRef.current) {
      clearTimeout(createModeTimerRef.current);
      createModeTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!deleteTargetCase && !blockedRemovalCase) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isDeleting) {
        setDeleteTargetCase(null);
        setBlockedRemovalCase(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [blockedRemovalCase, deleteTargetCase, isDeleting]);

  useEffect(() => {
    if (!sortMenuOpen) return;

    const handleDocumentMouseDown = (event: MouseEvent) => {
      if (sortMenuRef.current && !sortMenuRef.current.contains(event.target as Node)) {
        setSortMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleDocumentMouseDown);
    return () => {
      document.removeEventListener('mousedown', handleDocumentMouseDown);
    };
  }, [sortMenuOpen]);

  const filteredCases = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return cases.filter((testCase) => {
      const matchesSearch = normalizedSearch.length === 0
        || testCase.name.toLowerCase().includes(normalizedSearch)
        || String(testCase.id).includes(normalizedSearch)
        || testCase.assignedTo?.displayName.toLowerCase().includes(normalizedSearch)
        || false;
      return matchesSearch;
    });
  }, [cases, searchTerm]);

  const sortedCases = useMemo(() => {
    return [...filteredCases].sort((a, b) => {
      let aVal: string | number = '';
      let bVal: string | number = '';

      switch (sortField) {
        case 'id':
          aVal = a.id;
          bVal = b.id;
          break;
        case 'name':
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
          break;
        case 'state':
          aVal = a.state.toLowerCase();
          bVal = b.state.toLowerCase();
          break;
        case 'priority':
          aVal = a.priority;
          bVal = b.priority;
          break;
      }

      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredCases, sortField, sortOrder]);

  const hasActiveFilter = searchTerm.trim().length > 0;
  const noFilteredData = cases.length > 0 && sortedCases.length === 0;

  const selectedSortOption = useMemo(() => {
    return SORT_OPTIONS.find((option) => option.field === sortField && option.order === sortOrder) ?? SORT_OPTIONS[0];
  }, [sortField, sortOrder]);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelected(new Set(sortedCases.map((testCase) => testCase.id)));
      return;
    }
    setSelected(new Set());
  };

  const handleSelectCase = (caseId: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(caseId)) {
        next.delete(caseId);
      } else {
        next.add(caseId);
      }
      return next;
    });
  };

  const handleDeleteSelectedCase = async () => {
    if (!deleteTargetCase || isDeleting) return;

    setIsDeleting(true);
    try {
      await deleteTestCase(
        workspaceSettings,
        deleteTargetCase.id,
        deleteTargetCase._links?.workItem?.href ?? deleteTargetCase._links?.self?.href,
        { planId, suiteId },
      );

      setCases((current) => current.filter((testCase) => testCase.id !== deleteTargetCase.id));
      setDeleteTargetCase(null);
      addNotification('success', `Test case "${deleteTargetCase.name}" removed from this suite.`);
      setWarning(null);
      setError(null);

      try {
        const updatedCases = await fetchTestCasesForSuite(
          workspaceSettings,
          planId,
          suiteId,
          suiteTestCasesHref,
          suiteSelfHref,
        );
        setCases(updatedCases);
      } catch (refreshError) {
        console.warn('Failed to refresh test cases after suite removal:', refreshError);
      }
    } catch (deleteError) {
      const message = deleteError instanceof Error ? deleteError.message : 'Failed to remove test case from suite';
      setError(message);
      addNotification('error', message);
    } finally {
      setIsDeleting(false);
    }
  };

  const requestRemoveFromSuite = (testCase: ADOTestCase) => {
    if (testCase.state.trim().toLowerCase() !== 'removed') {
      setBlockedRemovalCase(testCase);
      return;
    }

    setDeleteTargetCase(testCase);
  };

  if (loading) {
    return (
      <div className="cases-table-shell">
        <div className="cases-toolbar cases-toolbar--skeleton" aria-hidden="true">
          <span className="skeleton skeleton--line" style={{ width: 220, height: 38 }} />
          <span className="skeleton skeleton--line" style={{ width: 140, height: 38 }} />
        </div>
        <div className="data-table-wrapper">
          <div className={`cases-table-skeleton${showSelectionColumn ? '' : ' cases-table-skeleton--no-select'}`}>
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="cases-table-skeleton__row">
                {showSelectionColumn && <span className="skeleton skeleton--icon-sm" />}
                <span className="skeleton skeleton--line" style={{ width: '55%' }} />
                <span className="skeleton skeleton--line" style={{ width: '82%' }} />
                <span className="skeleton skeleton--line" style={{ width: '70%' }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return <div className="alert alert--error">{error}</div>;
  }

  // Show create form instead of table when in create mode
  if (isCreateMode) {
    return (
      <div>
        {successMessage && (
          <div className="alert alert--success" style={{ marginBottom: '16px' }}>
            {successMessage}
          </div>
        )}
        <CreateTestCaseForm
        suiteName={suiteName}
        isLoading={false}
        apiError={error}
        onCancel={() => {
          setIsCreateMode(false);
          setError(null);
        }}
        onSubmit={async (formData) => {
          try {
            const testCaseData = buildTestCaseData(formData, formData.steps);
            const newCase = await createTestCase(
              workspaceSettings,
              planId,
              suiteId,
              {
                ...testCaseData,
                title: testCaseData.title!,
              }
            );

            // Success: show message and refresh test list
            setSuccessMessage(`✅ Test case "${newCase.name}" created successfully!`);
            addNotification('success', `Test case "${newCase.name}" created successfully.`);
            setError(null);
            setWarning(null);
            onTestCaseCreated?.(newCase);

            // Refresh test cases list to show the newly created case
            try {
              const updatedCases = await fetchTestCasesForSuite(
                workspaceSettings,
                planId,
                suiteId,
                suiteTestCasesHref,
                suiteSelfHref,
              );
              setCases(updatedCases);
            } catch (err) {
              console.warn('Failed to refresh test cases after creation:', err);
              // Still add the new case locally even if refresh fails
              setCases([...cases, newCase]);
            }

            // Auto-exit create mode after showing success
            if (createModeTimerRef.current) {
              clearTimeout(createModeTimerRef.current);
            }
            createModeTimerRef.current = setTimeout(() => {
              setIsCreateMode(false);
              setSuccessMessage(null);
            }, 2000);
          } catch (error) {
            // Extract error message from API response
            let errorMessage = 'Failed to create test case';

            if (error instanceof Error) {
              errorMessage = error.message;
            } else if (typeof error === 'object' && error !== null && 'message' in error) {
              errorMessage = (error as { message: string }).message;
            }

            // Display validation error to user
            setError(errorMessage);
            console.error('Failed to create test case:', error);
          }
        }}
      />
      </div>
    );
  }

  if (cases.length === 0) {
    return (
      <EmptyTestCases suiteName={suiteName} onAddTestCase={() => setIsCreateMode(true)} />
    );
  }

  return (
    <div className="cases-table-shell">
      <div className="cases-toolbar">
        <div className="cases-toolbar__search">
          <IconSearch size={15} className="cases-toolbar__search-icon" />
          <input
            type="text"
            className="cases-toolbar__search-input"
            placeholder="Search test cases by id, name, or assignee..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </div>

        <div className="cases-toolbar__filters">
          <button
            type="button"
            className="btn btn--primary btn--sm"
            onClick={() => setIsCreateMode(true)}
            title="Add a new test case to this suite"
          >
            + Add Test Case
          </button>

          <div className="cases-toolbar__sort" ref={sortMenuRef}>
            <button
              type="button"
              className={`cases-toolbar__sort-trigger${sortMenuOpen ? ' is-open' : ''}`}
              onClick={() => setSortMenuOpen((open) => !open)}
              aria-haspopup="menu"
              aria-expanded={sortMenuOpen}
            >
              <span className="cases-toolbar__sort-label">Sort by :</span>
              <strong className="cases-toolbar__sort-value">{selectedSortOption.label}</strong>
              <IconChevronDown
                size={15}
                className={`cases-toolbar__sort-icon${sortMenuOpen ? ' is-open' : ''}`}
              />
            </button>
            {sortMenuOpen && (
              <div className="cases-toolbar__sort-menu" role="menu">
                {SORT_OPTIONS.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    role="menuitemradio"
                    aria-checked={option.key === selectedSortOption.key}
                    className={`cases-toolbar__sort-item${option.key === selectedSortOption.key ? ' is-active' : ''}`}
                    onClick={() => {
                      setSortField(option.field);
                      setSortOrder(option.order);
                      setSortMenuOpen(false);
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {warning && <div className="alert alert--warning mb-md">{warning}</div>}
      {refreshing && (
        <p className="plans-refresh-status" aria-live="polite">
          Showing cached test cases while syncing latest updates.
        </p>
      )}

      <div className="data-table-wrapper">
        <table className="data-table cases-table">
          <thead>
            <tr>
              {showSelectionColumn && (
                <th style={{ width: 44 }}>
                  <input
                    type="checkbox"
                    checked={selected.size === sortedCases.length && sortedCases.length > 0}
                    onChange={(event) => handleSelectAll(event.target.checked)}
                    ref={(element) => {
                      if (!element) return;
                      element.indeterminate = selected.size > 0 && selected.size < sortedCases.length;
                    }}
                  />
                </th>
              )}
              <th style={{ width: 88 }}>
                <span>TC Id</span>
              </th>
              <th>
                <span>Test Case Title</span>
              </th>
              <th style={{ width: 140 }}>
                <span>Status</span>
              </th>
              <th style={{ width: 220 }}>
                <span>Assigned To</span>
              </th>
              <th style={{ width: 100 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {noFilteredData ? (
              <tr>
                <td colSpan={showSelectionColumn ? 6 : 5}>
                  <div className="cases-table__no-data">
                    <strong>No data</strong>
                    <span>
                      {hasActiveFilter
                        ? 'Try clearing or updating the search to see matching test cases.'
                        : 'No test cases available in this suite.'}
                    </span>
                  </div>
                </td>
              </tr>
            ) : (
              sortedCases.map((testCase) => (
                <tr key={testCase.id} className={showSelectionColumn && selected.has(testCase.id) ? 'selected' : ''}>
                  {showSelectionColumn && (
                    <td onClick={(event) => event.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selected.has(testCase.id)}
                        onChange={() => handleSelectCase(testCase.id)}
                      />
                    </td>
                  )}
                  <td>
                    <span className="text-primary font-semibold">{testCase.id}</span>
                  </td>
                  <td>
                    <div className="cases-table__user">
                      <div className="cases-table__user-copy">
                        <button
                          type="button"
                          className="cases-table__name-btn"
                          onClick={() => onSelectCase(testCase)}
                          title={testCase.name}
                        >
                          {testCase.name}
                        </button>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className={getStatusBadgeClass(testCase.state || 'Unknown')}>
                      {testCase.state || 'Unknown'}
                    </span>
                  </td>
                  <td>
                    <div className="cases-table__assigned-to">
                      {testCase.assignedTo ? (
                        <>
                          {testCase._links?.avatar?.href ? (
                            <img
                              src={testCase._links.avatar.href}
                              alt={testCase.assignedTo.displayName}
                              className="cases-table__avatar"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                const fallback = e.currentTarget.parentElement?.querySelector('.avatar');
                                if (fallback) fallback.classList.remove('hidden');
                              }}
                            />
                          ) : null}
                          <span className={`avatar avatar--sm${!testCase._links?.avatar?.href ? '' : ' hidden'}`}>
                            {getInitials(testCase.assignedTo.displayName)}
                          </span>
                          <span className="cases-table__assignee-name">{testCase.assignedTo.displayName}</span>
                        </>
                      ) : (
                        <span className="text-secondary">Unassigned</span>
                      )}
                    </div>
                  </td>
                  <td>
                    <div className="cases-table__actions">
                      <button
                        type="button"
                        className="cases-table__action-btn"
                        onClick={() => onSelectCase(testCase)}
                        title="Open details"
                      >
                        <IconVisibility size={16} />
                      </button>
                      <button
                        type="button"
                        className="cases-table__action-btn cases-table__action-btn--danger"
                        onClick={() => requestRemoveFromSuite(testCase)}
                        title="Remove from suite"
                      >
                        <IconDelete size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {deleteTargetCase && (
        <div className="steps-editor__confirm-overlay" role="dialog" aria-modal="true" aria-label="Remove test case from suite confirmation">
          <button
            type="button"
            className="steps-editor__confirm-backdrop"
            onClick={() => !isDeleting && setDeleteTargetCase(null)}
            aria-label="Close remove confirmation"
            disabled={isDeleting}
          />
          <div className="steps-editor__confirm-card steps-editor__confirm-card--danger" role="document">
            <div className="steps-editor__confirm-head">
              <div>
                <p className="steps-editor__confirm-kicker steps-editor__confirm-kicker--danger">Remove from suite</p>
                <h3 className="steps-editor__confirm-title steps-editor__confirm-title--danger">
                  Remove from suite
                </h3>
              </div>
              <button
                type="button"
                className="steps-editor__confirm-close"
                onClick={() => setDeleteTargetCase(null)}
                aria-label="Close remove confirmation"
                title="Close"
                disabled={isDeleting}
              >
                <IconX size={16} />
              </button>
            </div>

            <p className="steps-editor__confirm-copy">
              This only removes the test case from the current Azure DevOps test suite. The work item remains available in Azure DevOps.
            </p>

            <div className="steps-editor__confirm-meta">
              <span className="steps-editor__confirm-meta-label">Test case</span>
              <strong className="steps-editor__confirm-meta-value">
                {deleteTargetCase.id} - {deleteTargetCase.name}
              </strong>
            </div>

            <div className="steps-editor__confirm-actions">
              <button
                type="button"
                className="btn btn--secondary btn--sm"
                onClick={() => setDeleteTargetCase(null)}
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn--danger btn--sm"
                onClick={() => { void handleDeleteSelectedCase(); }}
                disabled={isDeleting}
              >
                {isDeleting ? 'Removing...' : 'Remove from suite'}
              </button>
            </div>
          </div>
        </div>
      )}

      {blockedRemovalCase && (
        <div className="steps-editor__confirm-overlay" role="dialog" aria-modal="true" aria-label="Remove from suite restriction">
          <button
            type="button"
            className="steps-editor__confirm-backdrop"
            onClick={() => setBlockedRemovalCase(null)}
            aria-label="Close remove restriction"
          />
          <div className="steps-editor__confirm-card steps-editor__confirm-card--warning" role="document">
            <div className="steps-editor__confirm-head">
              <div>
                <p className="steps-editor__confirm-kicker steps-editor__confirm-kicker--warning">Validation</p>
                <h3 className="steps-editor__confirm-title steps-editor__confirm-title--warning">
                  Remove from suite
                </h3>
              </div>
              <button
                type="button"
                className="steps-editor__confirm-close"
                onClick={() => setBlockedRemovalCase(null)}
                aria-label="Close remove restriction"
                title="Close"
              >
                <IconX size={16} />
              </button>
            </div>

            <p className="steps-editor__confirm-copy">
              Only test cases with status <strong>Removed</strong> can be removed from a suite in this app. For any other status, check in the Azure DevOps directly.
            </p>

            <div className="steps-editor__confirm-meta">
              <span className="steps-editor__confirm-meta-label">Current status</span>
              <strong className="steps-editor__confirm-meta-value">
                {blockedRemovalCase.state || 'Unknown'}
              </strong>
            </div>

            <div className="steps-editor__confirm-actions">
              <button
                type="button"
                className="btn btn--secondary btn--sm"
                onClick={() => setBlockedRemovalCase(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
