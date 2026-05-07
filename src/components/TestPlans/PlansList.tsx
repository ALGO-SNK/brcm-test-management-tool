import { useState, useEffect, useMemo, useRef } from 'react';
import type { ADOTestPlan } from '../../types';
import type { WorkspaceSettingsValues } from '../pages/WorkspaceSettings';
import { buildPlanAdoUrl, fetchPlans, getCachedPlans } from '../../services/adoApi';
import { IconArrowDownward, IconArrowRight, IconArrowUpward, IconCreateNewFolder, IconMoreHoriz, IconRefresh, IconSearch, IconSort } from '../Common/Icons';
import azureLogo from '../../assets/azure.png';

export type ConnectionStatus = 'checking' | 'connected' | 'cached' | 'disconnected';

interface PlansListProps {
  onSelectPlan: (plan: ADOTestPlan) => void;
  onCreateSuiteForPlan: (plan: ADOTestPlan) => void;
  workspaceSettings: WorkspaceSettingsValues;
  onPlansLoaded?: (plans: ADOTestPlan[]) => void;
  onConnectionStatusChange?: (status: ConnectionStatus) => void;
  onRefreshPlans?: () => void;
  refreshToken?: number;
}

type SortField = 'id' | 'name' | 'state' | 'iteration';
type SortOrder = 'asc' | 'desc';

interface SortOption {
  label: string;
  field: SortField;
}

const SORT_OPTIONS: SortOption[] = [
  { label: 'Plan Id', field: 'id' },
  { label: 'Plan Name', field: 'name' },
  { label: 'State', field: 'state' },
  { label: 'Iteration', field: 'iteration' },
];

export function PlansList({
  onSelectPlan,
  onCreateSuiteForPlan,
  workspaceSettings,
  onPlansLoaded,
  onConnectionStatusChange,
  onRefreshPlans,
  refreshToken = 0,
}: PlansListProps) {
  const [plans, setPlans] = useState<ADOTestPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('id');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [openRowActionPlanId, setOpenRowActionPlanId] = useState<number | null>(null);
  const [rowActionMenuPlacement, setRowActionMenuPlacement] = useState<'down' | 'up'>('down');
  const rowActionMenuRef = useRef<HTMLDivElement | null>(null);

  const workspaceReady = Boolean(
      workspaceSettings.organization.trim() &&
      workspaceSettings.projectName.trim() &&
      workspaceSettings.patToken.trim()
  );
  const canOpenInAdo = Boolean(
    workspaceSettings.organization.trim()
      && workspaceSettings.projectName.trim(),
  );
  const canCreateSuite = workspaceReady;
  const canRefresh = workspaceReady && !loading && !refreshing;

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const forceLiveRefresh = refreshToken > 0;

    const updateConnectionStatus = (status: ConnectionStatus) => {
      onConnectionStatusChange?.(status);
    };

    const loadPlans = async () => {
      if (!workspaceReady) {
        setPlans([]);
        setLoading(false);
        setRefreshing(false);
        setError('Configure Organization, Project, and PAT in Settings to load test plans.');
        setWarning(null);
        onPlansLoaded?.([]);
        updateConnectionStatus('disconnected');
        return;
      }

      const cached = getCachedPlans(workspaceSettings);
      const hasCachedPlans = Boolean(cached && cached.data.length > 0);

      setError(null);
      setWarning(null);

      if (cached) {
        setPlans(cached.data);
        setLoading(false);
        onPlansLoaded?.(cached.data);
        updateConnectionStatus(cached.fresh && !forceLiveRefresh ? 'connected' : 'cached');
      } else {
        setPlans([]);
        setLoading(true);
        updateConnectionStatus('checking');
      }

      if (cached?.fresh && !forceLiveRefresh) {
        setRefreshing(false);
        return;
      }

      try {
        setRefreshing(hasCachedPlans);
        updateConnectionStatus(hasCachedPlans ? 'cached' : 'checking');
        const data = await fetchPlans(workspaceSettings, controller.signal);
        if (!active) return;

        setPlans(data);
        setError(null);
        setWarning(null);
        onPlansLoaded?.(data);
        updateConnectionStatus('connected');
      } catch (err) {
        if (!active) return;

        if (hasCachedPlans) {
          setWarning('Showing cached plans. Live data sync failed, retrying on next refresh.');
          setError(null);
          updateConnectionStatus('cached');
          return;
        }

        setPlans([]);
        onPlansLoaded?.([]);
        setError(err instanceof Error ? err.message : 'Failed to load test plans');
        updateConnectionStatus('disconnected');
      } finally {
        if (active) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    };

    loadPlans().then();

    return () => {
      active = false;
      controller.abort();
    };
  }, [workspaceReady, workspaceSettings, onPlansLoaded, onConnectionStatusChange, refreshToken]);

  useEffect(() => {
    if (openRowActionPlanId === null) return;

    const handleMouseDown = (event: MouseEvent) => {
      if (rowActionMenuRef.current && !rowActionMenuRef.current.contains(event.target as Node)) {
        setOpenRowActionPlanId(null);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpenRowActionPlanId(null);
      }
    };

    document.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [openRowActionPlanId]);

  const filteredPlans = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    return plans.filter((plan) => {
      if (!normalizedSearch) return true;
      return (
        plan.name.toLowerCase().includes(normalizedSearch)
        || String(plan.id).includes(normalizedSearch)
        || plan.state.toLowerCase().includes(normalizedSearch)
        || (plan.iteration || '').toLowerCase().includes(normalizedSearch)
      );
    });
  }, [plans, searchTerm]);

  const sortedPlans = useMemo(() => {
    return [...filteredPlans].sort((a, b) => {
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
        case 'iteration':
          aVal = (a.iteration || '').toLowerCase();
          bVal = (b.iteration || '').toLowerCase();
          break;
      }

      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredPlans, sortField, sortOrder]);

  const hasActiveFilter = searchTerm.trim().length > 0;
  const noFilteredData = plans.length > 0 && sortedPlans.length === 0;

  const handleSortToggle = (field: SortField) => {
    if (sortField === field) {
      setSortOrder((current) => (current === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortField(field);
    setSortOrder('asc');
  };

  const getRowActionMenuPlacement = (triggerButton: HTMLElement): 'down' | 'up' => {
    const fallbackBoundary = {
      top: 0,
      bottom: window.innerHeight,
    };
    const boundary = triggerButton.closest('.data-table-wrapper')?.getBoundingClientRect() ?? fallbackBoundary;
    const triggerRect = triggerButton.getBoundingClientRect();
    const estimatedMenuHeight = 120;
    const spaceBelow = boundary.bottom - triggerRect.bottom;
    const spaceAbove = triggerRect.top - boundary.top;
    return spaceBelow < estimatedMenuHeight && spaceAbove > spaceBelow ? 'up' : 'down';
  };

  const toggleRowActionMenu = (planId: number, triggerButton: HTMLButtonElement) => {
    setOpenRowActionPlanId((current) => {
      if (current === planId) {
        setRowActionMenuPlacement('down');
        return null;
      }
      setRowActionMenuPlacement(getRowActionMenuPlacement(triggerButton));
      return planId;
    });
  };

  const renderSortableHeader = (option: SortOption, width?: number) => {
    const isActive = sortField === option.field;

    return (
      <th
        key={option.field}
        style={width ? { width } : undefined}
        className={`sortable${isActive ? ' sorted' : ''}`}
        onClick={() => handleSortToggle(option.field)}
        aria-sort={isActive ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
      >
        <span>{option.label}</span>
        <span className="sort-arrow" aria-hidden="true">
          {isActive ? (
            sortOrder === 'asc' ? <IconArrowUpward size={12} /> : <IconArrowDownward size={12} />
          ) : (
            <IconSort size={10} />
          )}
        </span>
      </th>
    );
  };

  if (loading) {
    return (
      <div className="plans-table-shell">
        <div className="cases-toolbar cases-toolbar--skeleton" aria-hidden="true">
          <span className="skeleton skeleton--line" style={{ width: 260, height: 38 }} />
        </div>
        <div className="data-table-wrapper">
          <div className="cases-table-skeleton cases-table-skeleton--no-select">
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="cases-table-skeleton__row">
                <span className="skeleton skeleton--line" style={{ width: '20%' }} />
                <span className="skeleton skeleton--line" style={{ width: '60%' }} />
                <span className="skeleton skeleton--line" style={{ width: '24%' }} />
                <span className="skeleton skeleton--line" style={{ width: '30%' }} />
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

  if (plans.length === 0) {
    return (
        <div className="empty-state">
          <p className="empty-state__title">No test plans found</p>
          <p className="empty-state__desc">
            Check your workspace settings or refresh after confirming Azure DevOps access.
          </p>
        </div>
    );
  }

  return (
    <div className="plans-table-shell">
      <div className="cases-toolbar">
        <div className="cases-toolbar__search">
          <IconSearch size={15} className="cases-toolbar__search-icon" />
          <input
            type="text"
            className="cases-toolbar__search-input"
            placeholder="Search plans by id, name, state, or iteration..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </div>
        <div className="cases-toolbar__filters">
          <button
            type="button"
            className="btn btn--secondary btn--sm"
            onClick={onRefreshPlans}
            title="Refresh plans"
            disabled={!canRefresh}
          >
            <IconRefresh size={14} />
            Refresh
          </button>
        </div>
      </div>

      {warning && <div className="alert alert--warning mb-md">{warning}</div>}
      {refreshing && (
        <p className="text-sm text-muted mb-md" aria-live="polite">
          Showing cached plans while syncing the latest updates.
        </p>
      )}

      <div className="data-table-wrapper">
        <table className="data-table plans-table">
          <thead>
            <tr>
              {renderSortableHeader(SORT_OPTIONS[0], 108)}
              {renderSortableHeader(SORT_OPTIONS[1])}
              {renderSortableHeader(SORT_OPTIONS[2], 132)}
              {renderSortableHeader(SORT_OPTIONS[3], 300)}
              <th style={{ width: 124 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {noFilteredData ? (
              <tr>
                <td colSpan={5}>
                  <div className="cases-table__no-data">
                    <strong>No data</strong>
                    <span>
                      {hasActiveFilter
                        ? 'Try clearing or updating the search to see matching plans.'
                        : 'No plans available.'}
                    </span>
                  </div>
                </td>
              </tr>
            ) : (
              sortedPlans.map((plan) => (
                <tr key={plan.id}>
                  <td>
                    <span className="text-primary font-semibold">{plan.id}</span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="cases-table__name-btn plans-table__name-btn"
                      title={plan.name}
                      onClick={() => onSelectPlan(plan)}
                    >
                      {plan.name}
                    </button>
                  </td>
                  <td>
                    <span className={`badge ${plan.state === 'Active' ? 'badge--success' : 'badge--warning'}`}>
                      {plan.state}
                    </span>
                  </td>
                  <td>
                    <span className="text-secondary plans-table__iteration" title={plan.iteration || '-'}>
                      {plan.iteration || '-'}
                    </span>
                  </td>
                  <td>
                    <div className="plans-table__actions">
                      <button
                        type="button"
                        className="cases-table__action-btn"
                        onClick={() => window.open(buildPlanAdoUrl(workspaceSettings, plan.id), '_blank', 'noopener,noreferrer')}
                        disabled={!canOpenInAdo}
                        title={canOpenInAdo ? 'Open plan in Azure DevOps' : 'Configure workspace settings to open Azure DevOps'}
                        aria-label={`Open plan ${plan.id} in Azure DevOps`}
                      >
                        <img src={azureLogo} alt="" width={16} height={16} aria-hidden="true" />
                      </button>
                      <div
                        className={`cases-table__row-menu${openRowActionPlanId === plan.id ? ' is-open' : ''}${openRowActionPlanId === plan.id && rowActionMenuPlacement === 'up' ? ' cases-table__row-menu--up' : ''}`}
                        ref={openRowActionPlanId === plan.id ? rowActionMenuRef : undefined}
                      >
                        <button
                          type="button"
                          className="cases-table__action-btn"
                          aria-label={`Actions for plan ${plan.id}`}
                          aria-haspopup="menu"
                          aria-expanded={openRowActionPlanId === plan.id}
                          onClick={(event) => {
                            toggleRowActionMenu(plan.id, event.currentTarget);
                          }}
                        >
                          <IconMoreHoriz size={16} />
                        </button>
                        {openRowActionPlanId === plan.id && (
                          <div className="action-menu cases-table__action-menu" role="menu">
                            <button
                              type="button"
                              role="menuitem"
                              className="action-menu__item"
                              onClick={() => {
                                setOpenRowActionPlanId(null);
                                onSelectPlan(plan);
                              }}
                            >
                              <IconArrowRight size={16} />
                              <span>Go to Suite</span>
                            </button>
                            <button
                              type="button"
                              role="menuitem"
                              className="action-menu__item"
                              onClick={() => {
                                setOpenRowActionPlanId(null);
                                onCreateSuiteForPlan(plan);
                              }}
                              disabled={!canCreateSuite}
                            >
                              <IconCreateNewFolder size={16} />
                              <span>Add Suite</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
