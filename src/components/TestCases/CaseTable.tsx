import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import {
  IconArrowDownward,
  IconArrowUpward,
  IconCheckCircle,
  IconCopy,
  IconDelete,
  IconDescription,
  IconError,
  IconChevronDown,
  IconMotionPlay,
  IconAnalytics,
  IconMoreHoriz,
  IconRefresh,
  IconSearch,
  IconSort,
  IconTimelapse,
  IconX,
} from '../Common/Icons';
import type { ADOTestCase } from '../../types';
import type { WorkspaceSettingsValues } from '../pages/WorkspaceSettings';
import { EmptyTestCases } from './EmptyTestCases';
import { CreateTestCaseForm } from './CreateTestCaseForm';
import { buildWorkItemAdoUrl, deleteTestCase, fetchTestCaseDetail, fetchTestCasesForSuite, getCachedTestCasesForSuite, createTestCase } from '../../services/adoApi';
import { buildTestCaseData } from '../../utils/testCaseBuilder';
import { useNotification } from '../../context/useNotification';
import azureLogo from '../../assets/azure.png';
import { buildCloneDraftFromTestCase, type CloneSourceMeta, type CreateTestCaseDraft } from '../../utils/testCaseClone';

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
  onCreateTitleChange?: (title: string) => void;
  isCreateMode?: boolean;
  onCreateModeChange?: (isCreateMode: boolean) => void;
  initialCreateDraft?: CreateTestCaseDraft | null;
  createSourceCase?: CloneSourceMeta | null;
  onRequestCreate?: () => void;
  refreshToken?: number;
  /** Trigger the suite-run modal (owned by SuiteTreePanel). */
  onRunSuite?: (mode: 'ci' | 'failed') => void;
}

type SortField = 'order' | 'id' | 'name' | 'state';
type SortOrder = 'asc' | 'desc';

interface SortOption {
  label: string;
  field: SortField;
}

const SORT_OPTIONS: SortOption[] = [
  { label: 'Order', field: 'order' },
  { label: 'TC Id', field: 'id' },
  { label: 'Test Case Title', field: 'name' },
  { label: 'Outcome', field: 'state' },
];

/**
 * Computed analytic state per test point, using EXACT property combinations:
 *
 *   Failed       → state="notReady"   lastResultState="completed" outcome="failed"      isActive=false
 *   Passed       → state="completed"  lastResultState="completed" outcome="passed"      isActive=false
 *   In Progress  → state="inProgress" lastResultState="pending"   outcome="failed"      isActive=false
 *   Active       → state="ready"      outcome="unspecified"        isActive=true
 *
 * Anything that doesn't match an exact combination falls back via loose
 * heuristics so the column is never blank (Active is the safe default).
 *
 * If a case has multiple points (multi-config), the worst-case wins:
 *   Failed > In Progress > Active > Passed
 */
type AnalyticState = 'failed' | 'in-progress' | 'active' | 'passed';

function classifyPoint(point: {
  outcome?: string;
  state?: string;
  lastResultState?: string;
  isActive?: boolean;
}): AnalyticState {
  const outcome = (point.outcome ?? '').trim().toLowerCase();
  const state = (point.state ?? '').trim().toLowerCase();
  const last = (point.lastResultState ?? '').trim().toLowerCase();
  const isActive = point.isActive === true;

  // ── Exact combinations (per product spec) ──
  if (isActive && state === 'ready' && outcome === 'unspecified') {
    return 'active';
  }
  if (!isActive && state === 'completed' && last === 'completed' && outcome === 'passed') {
    return 'passed';
  }
  if (!isActive && state === 'notready' && last === 'completed' && outcome === 'failed') {
    return 'failed';
  }
  if (!isActive && state === 'inprogress' && last === 'pending' && outcome === 'failed') {
    return 'in-progress';
  }

  // ── Fallback heuristics for any other real-world combination ──
  if (isActive) return 'active';
  if (state === 'inprogress' || last === 'pending') return 'in-progress';
  if (outcome === 'failed' || state === 'notready') return 'failed';
  if (outcome === 'passed') return 'passed';
  return 'active';
}

function getAnalyticStateForCase(testCase: ADOTestCase): AnalyticState {
  const points = testCase.pointBreakdown;
  if (!points || points.length === 0) {
    // Fall back to top-level outcome if no point breakdown is available.
    return classifyPoint({ outcome: testCase.outcome });
  }
  const order: AnalyticState[] = ['failed', 'in-progress', 'active', 'passed'];
  let worst: AnalyticState = 'passed';
  for (const point of points) {
    const state = classifyPoint(point);
    if (order.indexOf(state) < order.indexOf(worst)) {
      worst = state;
    }
  }
  return worst;
}

function getAnalyticBadgeModel(state: AnalyticState): {
  label: string;
  badgeClass: string;
  Icon: (props: { size?: number }) => ReactElement;
} {
  switch (state) {
    case 'failed':
      return { label: 'Failed', badgeClass: 'badge badge--danger', Icon: IconError };
    case 'in-progress':
      return { label: 'In Progress', badgeClass: 'badge badge--info', Icon: IconTimelapse };
    case 'passed':
      return { label: 'Passed', badgeClass: 'badge badge--success', Icon: IconCheckCircle };
    case 'active':
    default:
      return { label: 'Active', badgeClass: 'badge badge--primary', Icon: IconMotionPlay };
  }
}

interface OutcomeChartSlice {
  key: string;
  label: string;
  count: number;
  badgeClass: string;
  color: string;
}

interface DonutSegment {
  key: string;
  startAngle: number;
  endAngle: number;
  value: number;
  label: string;
  count: number;
  color: string;
  percentage: number;
  path: string;
}

function polarToCartesian(cx: number, cy: number, radius: number, angleInDegrees: number) {
  const radians = (angleInDegrees * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(radians),
    y: cy + radius * Math.sin(radians),
  };
}

function describeDonutArc(
  cx: number,
  cy: number,
  innerRadius: number,
  outerRadius: number,
  startAngle: number,
  endAngle: number,
): string {
  const outerStart = polarToCartesian(cx, cy, outerRadius, startAngle);
  const outerEnd = polarToCartesian(cx, cy, outerRadius, endAngle);
  const innerEnd = polarToCartesian(cx, cy, innerRadius, endAngle);
  const innerStart = polarToCartesian(cx, cy, innerRadius, startAngle);
  const largeArcFlag = endAngle - startAngle > 180 ? 1 : 0;

  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${innerStart.x} ${innerStart.y}`,
    'Z',
  ].join(' ');
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
  onCreateTitleChange,
  isCreateMode: propIsCreateMode,
  onCreateModeChange,
  initialCreateDraft = null,
  createSourceCase = null,
  onRequestCreate,
  refreshToken = 0,
  onRunSuite,
}: CaseTableProps) {
  const showSelectionColumn = false;
  const [isRunMenuOpen, setIsRunMenuOpen] = useState(false);
  const runMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isRunMenuOpen) return;
    const onMouseDown = (event: MouseEvent) => {
      if (!runMenuRef.current?.contains(event.target as Node)) {
        setIsRunMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [isRunMenuOpen]);

  const [cases, setCases] = useState<ADOTestCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('order');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [localIsCreateMode, setLocalIsCreateMode] = useState(false);
  const [deleteTargetCase, setDeleteTargetCase] = useState<ADOTestCase | null>(null);
  const [blockedRemovalCase, setBlockedRemovalCase] = useState<ADOTestCase | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [openRowActionCaseId, setOpenRowActionCaseId] = useState<number | null>(null);
  const [rowActionMenuPlacement, setRowActionMenuPlacement] = useState<'down' | 'up'>('down');
  // Pixel coordinates for the open menu. Used to render it as position:fixed so
  // it escapes any clipping ancestor (`.data-table-wrapper { overflow: auto }`),
  // which previously hid the menu when the table contained only one/two rows.
  const [rowActionMenuCoords, setRowActionMenuCoords] = useState<{ top: number; left: number } | null>(null);
  const [rowCloneDraft, setRowCloneDraft] = useState<CreateTestCaseDraft | null>(null);
  const [rowCloneSourceCase, setRowCloneSourceCase] = useState<CloneSourceMeta | null>(null);
  const [cloningCaseId, setCloningCaseId] = useState<number | null>(null);
  const [isOutcomeChartOpen, setIsOutcomeChartOpen] = useState(false);
  const [activeOutcomeKey, setActiveOutcomeKey] = useState<string | null>(null);
  const rowActionMenuRef = useRef<HTMLDivElement | null>(null);
  const { addNotification } = useNotification();

  // Use prop if provided, otherwise use local state
  const isCreateMode = propIsCreateMode !== undefined ? propIsCreateMode : localIsCreateMode;
  const setIsCreateMode = (value: boolean) => {
    onCreateModeChange?.(value);
    setLocalIsCreateMode(value);
  };
  const handleStartCreate = () => {
    setRowCloneDraft(null);
    setRowCloneSourceCase(null);
    onRequestCreate?.();
    setIsCreateMode(true);
  };

  const handleCloneFromRow = async (testCase: ADOTestCase) => {
    if (!workspaceReady) {
      addNotification('error', 'Configure Organization, Project, and PAT in Settings before cloning.');
      return;
    }

    setOpenRowActionCaseId(null);
    setCloningCaseId(testCase.id);
    try {
      const detailedCase = await fetchTestCaseDetail(
        workspaceSettings,
        testCase.id,
        testCase._links?.workItem?.href ?? testCase._links?.self?.href,
        testCase,
      );
      const draft = buildCloneDraftFromTestCase(detailedCase);
      setRowCloneDraft(draft);
      setRowCloneSourceCase({ id: detailedCase.id, title: detailedCase.name });
      setIsCreateMode(true);
      onCreateTitleChange?.(draft.formData.title ?? '');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to prepare clone draft.';
      addNotification('error', message);
    } finally {
      setCloningCaseId(null);
    }
  };


  const workspaceReady = Boolean(
    workspaceSettings.organization.trim()
      && workspaceSettings.projectName.trim()
      && workspaceSettings.patToken.trim(),
  );
  const canOpenInAzureDevOps = workspaceReady;

  const loadCases = useRef<((forceRefresh?: boolean) => Promise<void>) | null>(null);
  const previousRefreshTokenRef = useRef(refreshToken);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const shouldForceRefresh = refreshToken !== previousRefreshTokenRef.current;
    previousRefreshTokenRef.current = refreshToken;

    const fetchCases = async (forceRefresh = false) => {
      if (!workspaceReady) {
        setCases([]);
        setLoading(false);
        setRefreshing(false);
        setError('Configure Organization, Project, and PAT in Settings to load test cases.');
        setWarning(null);
        return;
      }

      const cached = forceRefresh ? null : getCachedTestCasesForSuite(workspaceSettings, planId, suiteId);
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
          { forceRefresh },
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

    loadCases.current = fetchCases;
    fetchCases(shouldForceRefresh).then();
    return () => {
      active = false;
      controller.abort();
      loadCases.current = null;
    };
  }, [planId, refreshToken, suiteId, suiteSelfHref, suiteTestCasesHref, workspaceReady, workspaceSettings]);

  const handleRefreshCases = async () => {
    if (!workspaceReady || loading || refreshing) {
      return;
    }

    await loadCases.current?.(true);
  };

  useEffect(() => {
    if (!loading) {
      onCaseCountChange?.(cases.length);
    }
  }, [cases.length, loading, onCaseCountChange]);

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
    if (openRowActionCaseId === null) return;

    const handleMouseDown = (event: MouseEvent) => {
      if (rowActionMenuRef.current && !rowActionMenuRef.current.contains(event.target as Node)) {
        setOpenRowActionCaseId(null);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpenRowActionCaseId(null);
      }
    };

    document.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [openRowActionCaseId]);

  useEffect(() => {
    if (!isOutcomeChartOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOutcomeChartOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOutcomeChartOpen]);

  const filteredCases = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return cases.filter((testCase) => {
      const matchesSearch = normalizedSearch.length === 0
        || testCase.name.toLowerCase().includes(normalizedSearch)
        || String(testCase.id).includes(normalizedSearch)
        || (testCase.configurationName?.toLowerCase().includes(normalizedSearch) ?? false)
        || (testCase.outcome?.toLowerCase().includes(normalizedSearch) ?? false)
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
        case 'order':
          aVal = a.order ?? Number.MAX_SAFE_INTEGER;
          bVal = b.order ?? Number.MAX_SAFE_INTEGER;
          break;
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
      }

      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredCases, sortField, sortOrder]);

  // Count points that match the exact "Run failed" pre-filter the executor uses:
  //   state === "notReady" && lastResultState === "completed" && outcome === "failed".
  // Used to gate the "Run failed" action — no point triggering a run with 0 matches.
  const failedPointCount = useMemo(() => {
    let count = 0;
    for (const testCase of cases) {
      const points = testCase.pointBreakdown ?? [];
      for (const point of points) {
        const state = (point.state ?? '').trim().toLowerCase();
        const lastResultState = (point.lastResultState ?? '').trim().toLowerCase();
        const outcome = (point.outcome ?? '').trim().toLowerCase();
        const isActive = point.isActive === true;
        // Exact "Failed" combination — must mirror classifyPoint's failed rule.
        if (!isActive && state === 'notready' && lastResultState === 'completed' && outcome === 'failed') {
          count += 1;
        }
      }
    }
    return count;
  }, [cases]);

  // Chart is a SUMMARY of the table — one classification per test case, using
  // the same getAnalyticStateForCase logic that drives the Outcome column.
  const outcomeChartSlices = useMemo<OutcomeChartSlice[]>(() => {
    const meta: Record<AnalyticState, { label: string; color: string; badgeClass: string }> = {
      passed: { label: 'Passed', color: '#15803d', badgeClass: 'badge badge--success' },
      failed: { label: 'Failed', color: '#dc2626', badgeClass: 'badge badge--danger' },
      'in-progress': { label: 'In Progress', color: '#2563eb', badgeClass: 'badge badge--info' },
      active: { label: 'Active', color: '#60a5fa', badgeClass: 'badge badge--primary' },
    };
    const counts: Record<AnalyticState, number> = {
      passed: 0, failed: 0, 'in-progress': 0, active: 0,
    };
    filteredCases.forEach((testCase) => {
      counts[getAnalyticStateForCase(testCase)] += 1;
    });
    const order: AnalyticState[] = ['failed', 'in-progress', 'active', 'passed'];
    return order
      .filter((state) => counts[state] > 0)
      .map((state) => ({
        key: state,
        label: meta[state].label,
        count: counts[state],
        badgeClass: meta[state].badgeClass,
        color: meta[state].color,
      }));
  }, [filteredCases]);

  const outcomeChartTotal = useMemo(
    () => outcomeChartSlices.reduce((sum, slice) => sum + slice.count, 0),
    [outcomeChartSlices],
  );

  const outcomeSummary = useMemo(() => {
    const get = (key: string) => outcomeChartSlices.find((s) => s.key === key)?.count ?? 0;
    const passed = get('passed');
    const failed = get('failed');
    const total = outcomeChartTotal;
    // Pass rate is passed over ALL cases — In Progress / Active cases have not
    // passed, so they must not inflate the rate (8 passed of 11 total = 73%).
    const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;
    return {
      total,
      passed,
      failed,
      inProgress: get('in-progress'),
      active: get('active'),
      passRate,
    };
  }, [outcomeChartSlices, outcomeChartTotal]);

  const donutSegments = useMemo<DonutSegment[]>(() => {
    if (outcomeChartTotal <= 0) return [];
    let cursor = -90;
    return outcomeChartSlices.map((slice) => {
      const percentage = slice.count / outcomeChartTotal;
      const angleSpan = percentage * 360;
      const startAngle = cursor;
      const endAngle = cursor + angleSpan;
      cursor = endAngle;

      return {
        key: slice.key,
        startAngle,
        endAngle,
        value: percentage,
        label: slice.label,
        count: slice.count,
        color: slice.color,
        percentage,
        path: describeDonutArc(120, 120, 58, 92, startAngle, endAngle),
      };
    });
  }, [outcomeChartSlices, outcomeChartTotal]);

  const activeOutcomeSlice = useMemo(() => {
    if (outcomeChartSlices.length === 0) return null;
    const fallbackKey = outcomeChartSlices[0]?.key;
    const resolvedKey = activeOutcomeKey ?? fallbackKey;
    return outcomeChartSlices.find((slice) => slice.key === resolvedKey) ?? outcomeChartSlices[0];
  }, [activeOutcomeKey, outcomeChartSlices]);
  const hasActiveFilter = searchTerm.trim().length > 0;
  const noFilteredData = cases.length > 0 && sortedCases.length === 0;

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
          undefined,
          { forceRefresh: true },
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

  const handleSortToggle = (field: SortField) => {
    if (sortField === field) {
      setSortOrder((current) => (current === 'asc' ? 'desc' : 'asc'));
      return;
    }

    setSortField(field);
    setSortOrder(field === 'order' ? 'asc' : 'desc');
  };

  const openOutcomeChart = () => {
    if (outcomeChartSlices.length === 0) return;
    setActiveOutcomeKey(outcomeChartSlices[0].key);
    setIsOutcomeChartOpen(true);
  };

  // Computes both the placement (up/down) and the absolute viewport coords
  // for the action menu. Coords are used to render the menu as `position: fixed`
  // so it escapes any clipping ancestor (e.g. `.data-table-wrapper { overflow:auto }`),
  // which previously hid it when the table had only one/two rows.
  const computeRowActionMenuLayout = (
    triggerButton: HTMLElement,
  ): { placement: 'down' | 'up'; coords: { top: number; left: number } } => {
    const triggerRect = triggerButton.getBoundingClientRect();
    const estimatedMenuHeight = 170;
    const estimatedMenuWidth = 240;
    const spaceBelow = window.innerHeight - triggerRect.bottom;
    const spaceAbove = triggerRect.top;
    const placement: 'down' | 'up' =
      spaceBelow < estimatedMenuHeight && spaceAbove > spaceBelow ? 'up' : 'down';
    // Align the menu's right edge with the trigger's right edge.
    let left = triggerRect.right - estimatedMenuWidth;
    if (left < 8) left = 8; // keep within viewport with a little margin
    const top = placement === 'down'
      ? triggerRect.bottom + 6
      : triggerRect.top - estimatedMenuHeight - 6;
    return { placement, coords: { top, left } };
  };

  const toggleRowActionMenu = (testCaseId: number, triggerButton: HTMLButtonElement) => {
    if (openRowActionCaseId === testCaseId) {
      // Toggle closed
      setOpenRowActionCaseId(null);
      setRowActionMenuPlacement('down');
      setRowActionMenuCoords(null);
      return;
    }
    // Compute coords FIRST, then open — guarantees the menu's first render
    // sees valid coordinates (avoids a flicker at 0,0).
    const { placement, coords } = computeRowActionMenuLayout(triggerButton);
    setRowActionMenuPlacement(placement);
    setRowActionMenuCoords(coords);
    setOpenRowActionCaseId(testCaseId);
  };

  const effectiveCreateDraft = rowCloneDraft ?? initialCreateDraft;
  const effectiveCreateSourceCase = rowCloneSourceCase ?? createSourceCase;

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
        <CreateTestCaseForm
          key={effectiveCreateSourceCase ? `clone-${effectiveCreateSourceCase.id}` : `blank-${suiteId}`}
          suiteName={suiteName}
          isLoading={false}
          apiError={error}
          workspaceSettings={workspaceSettings}
          initialDraft={effectiveCreateDraft}
          sourceCaseMeta={effectiveCreateSourceCase}
          onCancel={() => {
            setIsCreateMode(false);
            setRowCloneDraft(null);
            setRowCloneSourceCase(null);
            setError(null);
            onCreateTitleChange?.('');
          }}
          onTitleChange={onCreateTitleChange}
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

              const createdTitle = formData.title || newCase.name;
              const createdCase = {
                ...newCase,
                name: createdTitle,
                fields: {
                  ...newCase.fields,
                  'System.Title': createdTitle,
                },
              };

              addNotification('success', `Test case "${createdCase.name}" created successfully.`);
              setError(null);
              setWarning(null);
              onTestCaseCreated?.(createdCase);

              // Refresh test cases list to show the newly created case
              try {
                const updatedCases = await fetchTestCasesForSuite(
                  workspaceSettings,
                  planId,
                  suiteId,
                  suiteTestCasesHref,
                  suiteSelfHref,
                  undefined,
                  { forceRefresh: true },
                );
                setCases(updatedCases);
              } catch (err) {
                console.warn('Failed to refresh test cases after creation:', err);
                // Still add the new case locally even if refresh fails
                setCases([...cases, createdCase]);
              }
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
      <EmptyTestCases suiteName={suiteName} onAddTestCase={handleStartCreate} />
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
          {/* Group 1 — Refresh */}
          <div className="cases-toolbar__group">
            {refreshing ? (
              <span
                className="btn btn--secondary btn--sm is-syncing"
                role="status"
                aria-live="polite"
                title="Syncing latest test cases from Azure DevOps"
              >
                <IconRefresh size={16} />
                Syncing…
              </span>
            ) : (
              <button
                type="button"
                className="btn btn--secondary btn--sm btn--icon"
                onClick={() => { void handleRefreshCases(); }}
                title="Refresh test cases"
                aria-label="Refresh test cases"
                disabled={!workspaceReady || loading}
              >
                <IconRefresh size={16} />
              </button>
            )}
          </div>

          <span className="cases-toolbar__divider" aria-hidden="true" />

          {/* Group 2 — Outcome + Run menu */}
          <div className="cases-toolbar__group">
            <button
              type="button"
              className="btn btn--secondary btn--sm"
              onClick={openOutcomeChart}
              title="View suite test summary"
              disabled={sortedCases.length === 0}
            >
              <IconAnalytics size={16} />
              <span>Summary</span>
            </button>

            <div className="cases-toolbar__run-menu" ref={runMenuRef}>
              <button
                type="button"
                className="btn btn--secondary btn--sm cases-toolbar__run-trigger"
                onClick={() => setIsRunMenuOpen((open) => !open)}
                aria-haspopup="menu"
                aria-expanded={isRunMenuOpen}
                disabled={!onRunSuite}
                title="Run options for this suite"
              >
                <IconMotionPlay size={15} />
                <span>Run in CI</span>
                <IconChevronDown size={14} />
              </button>
              {isRunMenuOpen && (
                <div className="cases-toolbar__run-popover action-menu" role="menu">
                  <button
                    type="button"
                    role="menuitem"
                    className="action-menu__item"
                    disabled={!onRunSuite}
                    onClick={() => {
                      setIsRunMenuOpen(false);
                      onRunSuite?.('ci');
                    }}
                  >
                    <IconMotionPlay size={16} />
                    <span>Run all</span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="action-menu__item"
                    disabled={!onRunSuite || failedPointCount === 0}
                    title={
                      failedPointCount === 0
                        ? 'No failed test points in this suite to rerun'
                        : `${failedPointCount} failed test point(s) eligible for rerun`
                    }
                    onClick={() => {
                      setIsRunMenuOpen(false);
                      if (failedPointCount === 0) {
                        addNotification(
                          'info',
                          'No failed test points to rerun in this suite.',
                        );
                        return;
                      }
                      onRunSuite?.('failed');
                    }}
                  >
                    <IconRefresh size={16} />
                    <span>Run failed</span>
                    {failedPointCount > 0 && (
                      <span className="action-menu__item-badge">{failedPointCount}</span>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>

          <span className="cases-toolbar__divider" aria-hidden="true" />

          {/* Group 3 — New test */}
          <div className="cases-toolbar__group">
            <button
              type="button"
              className="btn btn--primary btn--sm"
              onClick={handleStartCreate}
              title="Add a new test case to this suite"
            >
              + New Test
            </button>
          </div>
        </div>
      </div>

      {warning && <div className="alert alert--warning mb-md">{warning}</div>}
      {/* "Showing cached..." paragraph removed — sync state is now shown
          inline in the refresh button slot to avoid the table-shift flicker. */}

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
              {renderSortableHeader(SORT_OPTIONS[0], 88)}
              {renderSortableHeader(SORT_OPTIONS[1], 88)}
              {renderSortableHeader(SORT_OPTIONS[2])}
              {renderSortableHeader(SORT_OPTIONS[3], 140)}
              <th style={{ width: 170 }}>
                <span>Config</span>
              </th>
              <th style={{ width: 220 }}>
                <span>Assigned To</span>
              </th>
              <th style={{ width: 132 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {noFilteredData ? (
              <tr>
                <td colSpan={showSelectionColumn ? 8 : 7}>
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
                    <span className="text-secondary">{typeof testCase.order === 'number' ? testCase.order : '-'}</span>
                  </td>
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
                    {(() => {
                      const analyticState = getAnalyticStateForCase(testCase);
                      const badge = getAnalyticBadgeModel(analyticState);
                      const BadgeIcon = badge.Icon;
                      return (
                        <span
                          className={`${badge.badgeClass} cases-table__outcome-badge`}
                          title={`Lifecycle: ${testCase.state || 'Unknown'}`}
                        >
                          <BadgeIcon size={13} />
                          {badge.label}
                        </span>
                      );
                    })()}
                  </td>
                  <td>
                    {testCase.configurationName ? (
                      <span
                        className="badge badge--neutral cases-table__config-badge"
                        title={testCase.configurationName}
                      >
                        {testCase.configurationName}
                      </span>
                    ) : (
                      <span className="cases-table__config-empty">—</span>
                    )}
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
                        onClick={() => window.open(buildWorkItemAdoUrl(workspaceSettings, testCase.id), '_blank', 'noopener,noreferrer')}
                        title="Open in Azure DevOps"
                        aria-label={`Open test case ${testCase.id} in Azure DevOps`}
                        disabled={!canOpenInAzureDevOps}
                      >
                        <img src={azureLogo} alt="" width={16} height={16} aria-hidden="true" />
                      </button>

                      <div
                        className={`cases-table__row-menu${openRowActionCaseId === testCase.id ? ' is-open' : ''}${openRowActionCaseId === testCase.id && rowActionMenuPlacement === 'up' ? ' cases-table__row-menu--up' : ''}`}
                        ref={openRowActionCaseId === testCase.id ? rowActionMenuRef : undefined}
                      >
                        <button
                          type="button"
                          className="cases-table__action-btn"
                          aria-label={`Actions for test case ${testCase.id}`}
                          aria-haspopup="menu"
                          aria-expanded={openRowActionCaseId === testCase.id}
                          onClick={(event) => {
                            toggleRowActionMenu(testCase.id, event.currentTarget);
                          }}
                        >
                          <IconMoreHoriz size={16} />
                        </button>
                        {openRowActionCaseId === testCase.id && (
                          <div
                            className="action-menu cases-table__action-menu cases-table__action-menu--fixed"
                            role="menu"
                            style={rowActionMenuCoords ? {
                              top: rowActionMenuCoords.top,
                              left: rowActionMenuCoords.left,
                            } : undefined}
                          >
                            <button
                              type="button"
                              role="menuitem"
                              className="action-menu__item"
                              onClick={() => {
                                setOpenRowActionCaseId(null);
                                onSelectCase(testCase);
                              }}
                            >
                              <IconDescription size={16} />
                              <span>Step view</span>
                            </button>
                            <button
                              type="button"
                              role="menuitem"
                              className="action-menu__item"
                              disabled={cloningCaseId !== null}
                              onClick={() => {
                                void handleCloneFromRow(testCase);
                              }}
                            >
                              <IconCopy size={16} />
                              <span>{cloningCaseId === testCase.id ? 'Preparing clone...' : 'Clone / Copy'}</span>
                            </button>
                            <button
                              type="button"
                              role="menuitem"
                              className="action-menu__item action-menu__item--danger"
                              onClick={() => {
                                setOpenRowActionCaseId(null);
                                requestRemoveFromSuite(testCase);
                              }}
                            >
                              <IconDelete size={16} />
                              <span>Remove from suite</span>
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

      {isOutcomeChartOpen && (
        <div className="modal-overlay" role="presentation">
          <button
            type="button"
            className="modal-overlay__backdrop"
            onClick={() => setIsOutcomeChartOpen(false)}
            aria-label="Close overall outcome chart"
          />
          <div className="modal cases-outcome-modal" role="dialog" aria-modal="true" aria-labelledby="overallOutcomeChartTitle">
            <div className="modal__header">
              <div>
                <h3 className="modal__title" id="overallOutcomeChartTitle">Suite Test Summary</h3>
              </div>
              <button
                type="button"
                className="btn btn--ghost btn--icon"
                onClick={() => setIsOutcomeChartOpen(false)}
                aria-label="Close outcome chart dialog"
              >
                <IconX size={16} />
              </button>
            </div>

            <div className="modal__body cases-outcome-modal__body">
              <section className="cases-outcome-card" aria-label="Outcome distribution">
                <div className="cases-outcome-card__chart" aria-label="Outcome distribution donut chart">
                  <svg
                    viewBox="0 0 240 240"
                    className="cases-outcome-modal__chart"
                    role="img"
                    aria-label="Overall outcome distribution chart"
                  >
                    {donutSegments.length === 1 ? (
                      <circle
                        cx="120"
                        cy="120"
                        r="92"
                        fill="none"
                        stroke={donutSegments[0].color}
                        strokeWidth="30"
                      />
                    ) : (
                      donutSegments.map((segment) => (
                        <path
                          key={segment.key}
                          d={segment.path}
                          className={`cases-outcome-modal__segment${activeOutcomeSlice?.key === segment.key ? ' is-active' : ''}`}
                          fill={segment.color}
                          onMouseEnter={() => setActiveOutcomeKey(segment.key)}
                          onFocus={() => setActiveOutcomeKey(segment.key)}
                          tabIndex={0}
                        />
                      ))
                    )}
                  </svg>
                  <div className="cases-outcome-modal__center">
                    <strong>Pass rate</strong>
                    <span>{outcomeSummary.passRate}%</span>
                    <small>{outcomeSummary.passed} of {outcomeSummary.total}</small>
                  </div>
                </div>

                <ul className="cases-outcome-legend" aria-label="Outcome breakdown">
                  {outcomeChartSlices.map((slice) => {
                    const percentage = outcomeChartTotal > 0
                      ? Math.round((slice.count / outcomeChartTotal) * 100)
                      : 0;
                    return (
                      <li
                        key={slice.key}
                        className={`cases-outcome-legend__row${activeOutcomeSlice?.key === slice.key ? ' is-active' : ''}`}
                        onMouseEnter={() => setActiveOutcomeKey(slice.key)}
                      >
                        <span
                          className="cases-outcome-legend__dot"
                          style={{ backgroundColor: slice.color }}
                          aria-hidden="true"
                        />
                        <span className="cases-outcome-legend__label">{slice.label}</span>
                        <span className="cases-outcome-legend__count">{slice.count}</span>
                        <span className="cases-outcome-legend__pct">{percentage}%</span>
                      </li>
                    );
                  })}
                </ul>
              </section>

              <section className="cases-outcome-kpis" aria-label="Suite summary stats">
                <div className="cases-outcome-kpis__item">
                  <span className="cases-outcome-kpis__value">{outcomeSummary.total}</span>
                  <span className="cases-outcome-kpis__label">Total cases</span>
                </div>
                <div className="cases-outcome-kpis__item">
                  <span className="cases-outcome-kpis__value cases-outcome-kpis__value--pass">{outcomeSummary.passed}</span>
                  <span className="cases-outcome-kpis__label">Passed</span>
                </div>
                <div className="cases-outcome-kpis__item">
                  <span className="cases-outcome-kpis__value cases-outcome-kpis__value--fail">{outcomeSummary.failed}</span>
                  <span className="cases-outcome-kpis__label">Failed</span>
                </div>
                <div className="cases-outcome-kpis__item">
                  <span className="cases-outcome-kpis__value cases-outcome-kpis__value--progress">{outcomeSummary.inProgress}</span>
                  <span className="cases-outcome-kpis__label">In Progress</span>
                </div>
                <div className="cases-outcome-kpis__item">
                  <span className="cases-outcome-kpis__value cases-outcome-kpis__value--active">{outcomeSummary.active}</span>
                  <span className="cases-outcome-kpis__label">Active</span>
                </div>
              </section>
            </div>
          </div>
        </div>
      )}

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
