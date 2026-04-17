import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SuiteTreeNode } from './SuiteTreeNode';
import {
  IconArrowRight,
  IconSearch,
  IconUnfoldLess,
  IconUnfoldMore,
  IconX,
} from '../Common/Icons';
import type { ADOTestPlan, ADOTestSuite } from '../../types';
import type { WorkspaceSettingsValues } from '../pages/WorkspaceSettings';
import {
  buildSuiteAdoUrl,
  createStaticSuite,
  fetchSuitesForPlan,
  getCachedSuitesForPlan,
} from '../../services/adoApi';
import { useNotification } from '../../context/useNotification';

interface SuiteTreePanelProps {
  plan: ADOTestPlan;
  selectedSuiteId: number | null;
  onSelectSuite: (suite: ADOTestSuite) => void;
  onAddTestCase: (suite: ADOTestSuite) => void;
  onBackToPlan: () => void;
  workspaceSettings: WorkspaceSettingsValues;
  createPlanSuiteRequest?: number;
}

function normalizeSuite(raw: Record<string, unknown>): ADOTestSuite {
  const suite = raw as unknown as ADOTestSuite;
  // ADO API may use different field names for test case count
  if (suite.testCaseCount == null) {
    const count = (raw.testCaseCount ?? raw.testCasesCount ?? raw.TestCaseCount ?? raw.pointCount) as number | undefined;
    if (count != null) suite.testCaseCount = count;
  }
  if (Array.isArray(suite.children)) {
    suite.children = suite.children.map(c => normalizeSuite(c as unknown as Record<string, unknown>));
  }
  return suite;
}

function extractSuites(response: unknown): ADOTestSuite[] {
  if (!response || typeof response !== 'object') return [];
  const obj = response as Record<string, unknown>;
  if (Array.isArray(obj.value)) {
    const suites = (obj.value as Record<string, unknown>[]).map(normalizeSuite);
    // Log first suite's keys for debugging field names
    if (suites.length > 0) {
      console.debug('[SuiteTree] Sample suite keys:', Object.keys(obj.value[0] as object));
    }
    return suites;
  }
  return [];
}

function flattenRoot(suites: ADOTestSuite[]): { rootName: string; children: ADOTestSuite[] } {
  if (suites.length === 1 && suites[0].children && suites[0].children.length > 0) {
    return { rootName: suites[0].name, children: suites[0].children };
  }
  return { rootName: '', children: suites };
}

function hasAnyChildren(suites: ADOTestSuite[]): boolean {
  return suites.some(s => s.children && s.children.length > 0);
}

function findSuiteById(suites: ADOTestSuite[], suiteId: number): ADOTestSuite | null {
  for (const suite of suites) {
    if (suite.id === suiteId) return suite;
    const match = suite.children ? findSuiteById(suite.children, suiteId) : null;
    if (match) return match;
  }
  return null;
}

function insertSuiteIntoTree(
  suites: ADOTestSuite[],
  newSuite: ADOTestSuite,
  parentSuiteId?: number,
): ADOTestSuite[] {
  if (findSuiteById(suites, newSuite.id)) {
    return suites;
  }

  if (typeof parentSuiteId !== 'number') {
    return [...suites, newSuite];
  }

  const insertRecursively = (nodes: ADOTestSuite[]): { nodes: ADOTestSuite[]; inserted: boolean } => {
    let inserted = false;

    const updatedNodes = nodes.map((suite) => {
      if (suite.id === parentSuiteId) {
        inserted = true;
        const children = suite.children ? [...suite.children] : [];
        if (!children.some((child) => child.id === newSuite.id)) {
          children.push(newSuite);
        }
        return { ...suite, children };
      }

      if (!suite.children || suite.children.length === 0) {
        return suite;
      }

      const childResult = insertRecursively(suite.children);
      if (childResult.inserted) {
        inserted = true;
        return { ...suite, children: childResult.nodes };
      }

      return suite;
    });

    return {
      nodes: inserted ? updatedNodes : nodes,
      inserted,
    };
  };

  const result = insertRecursively(suites);
  if (result.inserted) {
    return result.nodes;
  }

  // Fallback: if parent suite is unavailable in current tree, append at root once.
  return [...suites, newSuite];
}

export function SuiteTreePanel({
  plan,
  selectedSuiteId,
  onSelectSuite,
  onAddTestCase,
  onBackToPlan,
  workspaceSettings,
  createPlanSuiteRequest = 0,
}: SuiteTreePanelProps) {
  const [suites, setSuites] = useState<ADOTestSuite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterText, setFilterText] = useState('');
  // +N = expand all (increments), -N = collapse all (decrements), 0 = initial
  const [expandSignal, setExpandSignal] = useState(0);
  const [isCreateSuiteOpen, setIsCreateSuiteOpen] = useState(false);
  const [createSuiteParent, setCreateSuiteParent] = useState<ADOTestSuite | null>(null);
  const [newSuiteName, setNewSuiteName] = useState('');
  const [createSuiteError, setCreateSuiteError] = useState<string | null>(null);
  const [isCreatingSuite, setIsCreatingSuite] = useState(false);
  const suitesRef = useRef<ADOTestSuite[]>([]);
  const { addNotification } = useNotification();
  const canCreateSuite = Boolean(
    workspaceSettings.organization.trim()
      && workspaceSettings.projectName.trim()
      && workspaceSettings.patToken.trim(),
  );

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    const load = async () => {
      setError(null);

      const cached = getCachedSuitesForPlan(workspaceSettings, plan.id);
      if (cached) {
        setSuites(extractSuites(cached.data));
        setLoading(false);
      } else {
        setLoading(true);
      }

      if (cached?.fresh) return;

      try {
        const response = await fetchSuitesForPlan(workspaceSettings, plan, controller.signal);
        if (!active) return;
        setSuites(extractSuites(response));
      } catch (err) {
        if (!active) return;
        if (!cached) {
          setError(err instanceof Error ? err.message : 'Failed to load suites');
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    load().then();
    return () => { active = false; controller.abort(); };
  }, [plan, workspaceSettings]);

  useEffect(() => {
    suitesRef.current = suites;
  }, [suites]);

  const { children: visibleSuites } = useMemo(() => flattenRoot(suites), [suites]);
  const showExpandControls = hasAnyChildren(visibleSuites);

  useEffect(() => {
    if (selectedSuiteId != null) return;
    if (visibleSuites.length === 0) return;
    onSelectSuite(visibleSuites[0]);
  }, [selectedSuiteId, visibleSuites, onSelectSuite]);

  const isExpanded = expandSignal > 0;
  const canOpenInAdo = Boolean(
    workspaceSettings.organization.trim()
      && workspaceSettings.projectName.trim(),
  );
  const createSuitePlanLabel = plan.name.trim() || `Plan ${plan.id}`;

  const refreshSuites = useCallback(async () => {
    const response = await fetchSuitesForPlan(workspaceSettings, plan);
    return extractSuites(response);
  }, [plan, workspaceSettings]);

  const handleToggleAll = () => {
    setExpandSignal(prev => {
      const next = Math.abs(prev) + 1;
      return prev > 0 ? -next : next;
    });
  };

  const openAdoUrl = useCallback((url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  }, []);

  const openCreateSuiteModal = useCallback((parentSuite: ADOTestSuite | null) => {
    setCreateSuiteParent(parentSuite);
    setNewSuiteName('');
    setCreateSuiteError(null);
    setIsCreateSuiteOpen(true);
  }, []);

  useEffect(() => {
    if (!createPlanSuiteRequest) return;
    openCreateSuiteModal(null);
  }, [createPlanSuiteRequest, openCreateSuiteModal]);

  const closeCreateSuiteModal = useCallback(() => {
    if (isCreatingSuite) return;
    setIsCreateSuiteOpen(false);
    setCreateSuiteParent(null);
    setNewSuiteName('');
    setCreateSuiteError(null);
  }, [isCreatingSuite]);

  useEffect(() => {
    if (!isCreateSuiteOpen || isCreatingSuite) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeCreateSuiteModal();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [closeCreateSuiteModal, isCreateSuiteOpen, isCreatingSuite]);

  const handleOpenSuiteInAdo = (suite: ADOTestSuite) => {
    if (!canOpenInAdo) return;
    openAdoUrl(buildSuiteAdoUrl(workspaceSettings, plan.id, suite.id));
  };

  const handleAddTestCase = (suite: ADOTestSuite) => {
    onAddTestCase(suite);
  };

  const handleCreateSuite = async () => {
    const trimmedName = newSuiteName.trim();
    if (!trimmedName) {
      setCreateSuiteError('Suite name is required.');
      return;
    }

    setIsCreatingSuite(true);
    setCreateSuiteError(null);

    try {
      const createdSuite = await createStaticSuite(
        workspaceSettings,
        plan.id,
        trimmedName,
        createSuiteParent?.id,
      );
      // Collapse tree first; selected-path auto-expand will reveal only the created branch.
      setExpandSignal(prev => -(Math.abs(prev) + 1));

      const optimisticTree = insertSuiteIntoTree(suitesRef.current, createdSuite, createSuiteParent?.id);
      setSuites(optimisticTree);
      suitesRef.current = optimisticTree;

      let refreshedSuites: ADOTestSuite[] = [];
      try {
        refreshedSuites = await refreshSuites();
      } catch (refreshError) {
        console.warn('Failed to refresh suite tree after suite creation:', refreshError);
      }

      const refreshedTree = refreshedSuites.length > 0
        ? insertSuiteIntoTree(refreshedSuites, createdSuite, createSuiteParent?.id)
        : optimisticTree;
      setSuites(refreshedTree);
      suitesRef.current = refreshedTree;

      const createdSuiteInTree = findSuiteById(refreshedTree, createdSuite.id) ?? createdSuite;

      if (createdSuiteInTree) {
        onSelectSuite(createdSuiteInTree);
      }

      setFilterText('');
      setIsCreateSuiteOpen(false);
      setCreateSuiteParent(null);
      setNewSuiteName('');
      addNotification('success', `Suite "${trimmedName}" created successfully.`);
    } catch (error) {
      setCreateSuiteError(error instanceof Error ? error.message : "We couldn't create the suite. Please try again.");
    } finally {
      setIsCreatingSuite(false);
    }
  };

  return (
    <>
      <div className="suite-panel">
        <div className="suite-panel__header">
          <div className="suite-panel__header-main">
            <div className="suite-panel__header-text">
              <h3 className="suite-panel__title">Test Suites</h3>
              <span className="suite-panel__root-name" title={createSuitePlanLabel}>{createSuitePlanLabel}</span>
            </div>
            <button
              type="button"
              className="suite-panel__back-btn"
              onClick={onBackToPlan}
              title="Back to plans"
            >
              <IconArrowRight size={14} className="suite-panel__back-icon" />
            </button>
          </div>
        </div>

        <div className="suite-panel__toolbar">
          <div className="suite-panel__search">
            <IconSearch size={14} className="suite-panel__search-icon" />
            <input
              type="text"
              className="suite-panel__search-input"
              placeholder="Filter suites by name"
              value={filterText}
              onChange={e => setFilterText(e.target.value)}
            />
            {filterText && (
              <button
                type="button"
                className="suite-panel__search-clear"
                onClick={() => setFilterText('')}
                aria-label="Clear filter"
              >
                <IconX size={14} />
              </button>
            )}
          </div>

          {showExpandControls && (
            <button
              type="button"
              className="suite-panel__expand-btn"
              onClick={handleToggleAll}
              title={isExpanded ? 'Collapse all' : 'Expand all'}
            >
              {isExpanded ? <IconUnfoldLess size={16} /> : <IconUnfoldMore size={16} />}
            </button>
          )}
        </div>

        <div className="suite-panel__tree-wrap">
          {loading && (
            <div className="suite-panel__skeleton">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="suite-panel__skeleton-row" style={{ paddingLeft: `${12 + (i % 3) * 20}px` }}>
                  <span className="skeleton skeleton--icon-sm" />
                  <span className="skeleton skeleton--line" style={{ flex: 1 }} />
                </div>
              ))}
            </div>
          )}

          {!loading && error && (
            <div className="suite-panel__error">{error}</div>
          )}

          {!loading && !error && visibleSuites.length === 0 && (
            <div className="suite-panel__empty">No suites found</div>
          )}

          {!loading && !error && visibleSuites.length > 0 && (
            <ul className="suite-tree" role="tree">
              {visibleSuites.map(suite => (
                <SuiteTreeNode
                  key={`${suite.id}:${expandSignal}`}
                  suite={suite}
                  depth={0}
                  selectedSuiteId={selectedSuiteId}
                  onSelect={onSelectSuite}
                  onAddSuite={(selectedSuite) => openCreateSuiteModal(selectedSuite)}
                  onAddTestCase={handleAddTestCase}
                  onOpenInAdo={handleOpenSuiteInAdo}
                  filterText={filterText}
                  expandSignal={expandSignal}
                  canCreateSuite={canCreateSuite}
                  canAddTestCase
                  canOpenInAdo={canOpenInAdo}
                />
              ))}
            </ul>
          )}
        </div>
      </div>

      {isCreateSuiteOpen && (
        <div className="steps-editor__confirm-overlay" role="dialog" aria-modal="true" aria-label="Create static suite">
          <button
            type="button"
            className="steps-editor__confirm-backdrop"
            onClick={closeCreateSuiteModal}
            aria-label="Close create suite dialog"
            disabled={isCreatingSuite}
          />
          <div className="steps-editor__confirm-card suite-create-dialog" role="document">
            <div className="steps-editor__confirm-head">
              <div>
                <p className="steps-editor__confirm-kicker suite-create-dialog__kicker">Add suite</p>
                <h3 className="steps-editor__confirm-title">Add static suite</h3>
              </div>
              <button
                type="button"
                className="steps-editor__confirm-close"
                onClick={closeCreateSuiteModal}
                aria-label="Close create suite dialog"
                title="Close"
                disabled={isCreatingSuite}
              >
                <IconX size={16} />
              </button>
            </div>

            <p className="steps-editor__confirm-copy">
              Create a new static suite in Azure DevOps and open it here as soon as it is ready.
            </p>

            <div className="steps-editor__confirm-meta suite-create-dialog__context">
              <div className="suite-create-dialog__context-row">
                <span className="steps-editor__confirm-meta-label">Plan</span>
                <strong className="steps-editor__confirm-meta-value">{createSuitePlanLabel}</strong>
              </div>
              {createSuiteParent && (
                <div className="suite-create-dialog__context-row">
                  <span className="steps-editor__confirm-meta-label">Parent suite</span>
                  <strong className="steps-editor__confirm-meta-value">{createSuiteParent.name}</strong>
                </div>
              )}
            </div>

            <div className="suite-create-dialog__body">
              <div className="case-detail-edit-form__field">
                <label className="case-detail-edit-form__label" htmlFor="create-suite-name">Suite name</label>
                <input
                  id="create-suite-name"
                  type="text"
                  className="case-detail-edit-form__input"
                  value={newSuiteName}
                  onChange={(event) => setNewSuiteName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      void handleCreateSuite();
                    }
                  }}
                  placeholder="Enter suite name"
                  autoFocus
                  disabled={isCreatingSuite}
                />
              </div>
              {createSuiteError && (
                <p className="suite-create-dialog__error">{createSuiteError}</p>
              )}
            </div>

            <div className="steps-editor__confirm-actions">
              <button
                type="button"
                className="btn btn--secondary btn--sm"
                onClick={closeCreateSuiteModal}
                disabled={isCreatingSuite}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn--primary btn--sm"
                onClick={() => { void handleCreateSuite(); }}
                disabled={isCreatingSuite}
              >
                {isCreatingSuite ? 'Creating...' : 'Create suite'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
