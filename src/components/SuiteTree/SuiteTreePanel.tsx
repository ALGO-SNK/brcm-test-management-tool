import { useState, useEffect, useMemo } from 'react';
import { SuiteTreeNode } from './SuiteTreeNode';
import { IconSearch, IconX, IconArrowRight } from '../Common/Icons';
import type { ADOTestPlan, ADOTestSuite } from '../../types';
import type { WorkspaceSettingsValues } from '../pages/WorkspaceSettings';
import { fetchSuitesForPlan, getCachedSuitesForPlan } from '../../services/adoApi';

interface SuiteTreePanelProps {
  plan: ADOTestPlan;
  selectedSuiteId: number | null;
  onSelectSuite: (suite: ADOTestSuite) => void;
  onBackToPlan: () => void;
  workspaceSettings: WorkspaceSettingsValues;
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

export function SuiteTreePanel({
  plan,
  selectedSuiteId,
  onSelectSuite,
  onBackToPlan,
  workspaceSettings,
}: SuiteTreePanelProps) {
  const [suites, setSuites] = useState<ADOTestSuite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterText, setFilterText] = useState('');
  // +N = expand all (increments), -N = collapse all (decrements), 0 = initial
  const [expandSignal, setExpandSignal] = useState(0);

  useEffect(() => {
    let active = true;

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
        const response = await fetchSuitesForPlan(workspaceSettings, plan);
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
    return () => { active = false; };
  }, [plan, workspaceSettings]);

  const { children: visibleSuites } = useMemo(() => flattenRoot(suites), [suites]);
  const showExpandControls = hasAnyChildren(visibleSuites);

  useEffect(() => {
    if (selectedSuiteId != null) return;
    if (visibleSuites.length === 0) return;
    onSelectSuite(visibleSuites[0]);
  }, [selectedSuiteId, visibleSuites, onSelectSuite]);

  const isExpanded = expandSignal > 0;

  const handleToggleAll = () => {
    setExpandSignal(prev => {
      const next = Math.abs(prev) + 1;
      return prev > 0 ? -next : next;
    });
  };

  return (
    <div className="suite-panel">
      <div className="suite-panel__header">
        <div className="suite-panel__header-text">
          <h3 className="suite-panel__title">Test Suites</h3>
          {/*{rootName && (
            <span className="suite-panel__root-name" title={rootName}>{rootName}</span>
          )}*/}
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
            <span className="material-symbols-rounded" style={{ fontSize: '16px' }}>
              {isExpanded ? 'unfold_less' : 'unfold_more'}
            </span>
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
                filterText={filterText}
                expandSignal={expandSignal}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
