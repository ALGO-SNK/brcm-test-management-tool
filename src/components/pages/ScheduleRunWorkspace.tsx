import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNotification } from '../../context/useNotification';
import {
  fetchBuilds,
  fetchPlans,
  fetchReleaseDefinitionAvailability,
  fetchSuiteReleaseMappings,
  fetchSuitesForPlan,
  fetchTestConfigurations,
  fetchTestPointsForSuite,
  type ADOBuildSummary,
  type ADOTestConfigurationSummary,
  type ADOReleaseDefinitionAvailability,
} from '../../services/adoApi';
import {
  isSuiteNameExcluded,
  parseExcludedSuiteIdsCsv,
  parseExcludedSuiteNamePatterns,
  parseWorkItemIdsCsv,
} from '../../services/mappingParser';
import { updatePendingReleaseLogs } from '../../services/releaseLogUpdater';
import {
  executeSuitesSequentially,
  type RunExecutionContext,
  type SuiteExecutionPlan,
} from '../../services/suiteRunExecutor';
import type { ADOTestPlan, ADOTestSuite, ReleaseLogRecord, TestSuiteMapping } from '../../types';
import {
  IconArrowDownward,
  IconArrowUpward,
  IconChevronDown,
  IconMotionPlay,
  IconRefresh,
  IconSort,
  IconX,
} from '../Common/Icons';
import { BatchSizeInput } from '../Common/BatchSizeInput';
import type { WorkspaceSettingsValues } from './WorkspaceSettings';

type RunMode = 'selected_suite' | 'nightly_full' | 'failed_only_rerun';
type WorldPayServer = 'Regression World Pay' | 'Kanban World Pay';

interface SuiteRow {
  planId: number;
  planName: string;
  suiteId: number;
  suiteName: string;
  depth: number;
  testCaseCount: number;
  tag?: string;
  releaseDefinitionId?: number;
}

type SuiteSortKey = 'suiteName' | 'planName' | 'suiteId';

interface SuitePointPlan {
  suiteId: number;
  suiteName: string;
  planId: number;
  totalPoints: number;
  automatedPoints: number;
  eligiblePointIds: number[];
}

function toBranchLabel(sourceBranch: string): string {
  const normalized = sourceBranch.trim().replace(/^refs\/heads\//i, '');
  return normalized || sourceBranch.trim();
}

function toBuildOptionLabel(buildId: number, sourceBranch: string): string {
  return `${buildId} - ${toBranchLabel(sourceBranch)}`;
}

function getBuildSortTimestamp(build: ADOBuildSummary): number {
  const parsed = Date.parse(build.queueTime);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getBuildIdentityKey(build: ADOBuildSummary): string {
  const branch = toBranchLabel(build.sourceBranch || '').trim();
  if (branch) return `branch:${branch.toLowerCase()}`;
  const buildNumber = build.buildNumber.trim();
  if (buildNumber) return `build:${buildNumber.toLowerCase()}`;
  return `id:${build.id}`;
}

function toLatestUniqueBuilds(builds: ADOBuildSummary[]): ADOBuildSummary[] {
  const latestFirst = [...builds].sort((left, right) => {
    const leftTs = getBuildSortTimestamp(left);
    const rightTs = getBuildSortTimestamp(right);
    if (leftTs !== rightTs) return rightTs - leftTs;
    return right.id - left.id;
  });
  const seen = new Set<string>();
  const unique: ADOBuildSummary[] = [];
  for (const build of latestFirst) {
    const key = getBuildIdentityKey(build);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(build);
  }
  return unique;
}

function parseDefinitionIdsCsv(value: string): number[] {
  return Array.from(
    new Set(
      value
        .split(/[,\s]+/)
        .map((token) => Number(token.trim()))
        .filter((token) => Number.isInteger(token) && token > 0),
    ),
  );
}

function normalizeSuite(raw: Record<string, unknown>): ADOTestSuite {
  const suite = raw as unknown as ADOTestSuite;
  if (suite.testCaseCount == null) {
    const count = (raw.testCaseCount ?? raw.testCasesCount ?? raw.TestCaseCount ?? raw.pointCount) as number | undefined;
    if (count != null) suite.testCaseCount = count;
  }
  if (Array.isArray(suite.children)) {
    suite.children = suite.children.map((child) => normalizeSuite(child as unknown as Record<string, unknown>));
  }
  return suite;
}

function extractSuites(response: unknown): ADOTestSuite[] {
  if (!response || typeof response !== 'object') return [];
  const candidate = response as Record<string, unknown>;
  if (!Array.isArray(candidate.value)) return [];
  return (candidate.value as Record<string, unknown>[]).map(normalizeSuite);
}

function flattenSuites(suites: ADOTestSuite[], plan: ADOTestPlan, depth = 0): SuiteRow[] {
  return suites.flatMap((suite) => {
    const current: SuiteRow = {
      planId: plan.id,
      planName: plan.name,
      suiteId: suite.id,
      suiteName: suite.name,
      depth,
      testCaseCount: Number(suite.testCaseCount ?? 0),
    };
    const children = Array.isArray(suite.children) ? flattenSuites(suite.children, plan, depth + 1) : [];
    return [current, ...children];
  });
}

function toCdStateLabel(cd: ADOReleaseDefinitionAvailability): string {
  if (cd.isAvailable) return 'Available';
  const status = cd.environmentStatus.trim();
  const normalized = status.replace(/[\s_-]+/g, '').toLowerCase();
  if (normalized === 'inprogress') return 'In Progress';
  return status || 'Busy';
}

/** Display CDs uniformly as "On Demand Test Run-CD - 18 (ID: 26)". */
function formatCdLabel(idOrName: number | string | null | undefined, name?: string | null): string {
  // Two call modes:
  //   formatCdLabel(id, name)
  //   formatCdLabel(name, idAsSecondPositional? — not used)
  // Primary path: pass (id, name).
  const id = typeof idOrName === 'number'
    ? idOrName
    : Number.parseInt(String(idOrName ?? ''), 10);
  const cleanName = (name ?? '').toString().trim();
  if (cleanName) {
    return Number.isFinite(id) ? `${cleanName} (ID: ${id})` : cleanName;
  }
  return Number.isFinite(id) ? `CD ${id}` : '';
}

function toCdStateBadgeClass(cd: ADOReleaseDefinitionAvailability): string {
  if (cd.isAvailable) return 'meta-pill meta-pill--success';
  const status = toCdStateLabel(cd).toLowerCase();
  if (status === 'in progress') {
    return 'meta-pill meta-pill--info';
  }
  if (status.includes('fail') || status.includes('error') || status.includes('cancel')) {
    return 'meta-pill meta-pill--danger';
  }
  if (
    status.includes('busy')
    || status.includes('progress')
    || status.includes('pending')
    || status.includes('queue')
  ) {
    return 'meta-pill meta-pill--warning';
  }
  return 'meta-pill meta-pill--info';
}

export function ScheduleRunWorkspace({ workspaceSettings }: { workspaceSettings: WorkspaceSettingsValues }) {
  const { addNotification } = useNotification();
  const [plans, setPlans] = useState<ADOTestPlan[]>([]);
  const [planFilter, setPlanFilter] = useState<'all' | number>('all');
  const [suiteRows, setSuiteRows] = useState<SuiteRow[]>([]);
  const [suiteMappings, setSuiteMappings] = useState<TestSuiteMapping[]>([]);
  const [selectedTag, setSelectedTag] = useState<string>('all');
  const [selectedWorldPayServer, setSelectedWorldPayServer] = useState<WorldPayServer>('Regression World Pay');
  const [selectedSuiteIds, setSelectedSuiteIds] = useState<number[]>([]);
  const [suiteSearchText, setSuiteSearchText] = useState('');
  const [suiteSort, setSuiteSort] = useState<{ key: SuiteSortKey; direction: 'asc' | 'desc' }>({
    key: 'suiteName',
    direction: 'asc',
  });
  // Run mode is fixed for the modal flow — Failed Batch Rerun uses a separate path.
  const runMode: RunMode = 'selected_suite';
  const [configurations, setConfigurations] = useState<ADOTestConfigurationSummary[]>([]);
  const [selectedConfigurationId, setSelectedConfigurationId] = useState(workspaceSettings.schedulerDefaultConfigurationId);
  const [builds, setBuilds] = useState<ADOBuildSummary[]>([]);
  const [selectedBuildId, setSelectedBuildId] = useState<number | null>(null);
  const [isBuildDropdownOpen, setIsBuildDropdownOpen] = useState(false);
  const [buildDropdownSearch, setBuildDropdownSearch] = useState('');
  const [releaseDefinitions, setReleaseDefinitions] = useState<ADOReleaseDefinitionAvailability[]>([]);
  const [suitePointPlan, setSuitePointPlan] = useState<SuitePointPlan[]>([]);
  const batchSize = workspaceSettings.schedulerDefaultBatchSize;
  const [isLoadingPlans, setIsLoadingPlans] = useState(false);
  const [isLoadingSuites, setIsLoadingSuites] = useState(false);
  const [isLoadingBuilds, setIsLoadingBuilds] = useState(false);
  const [isLoadingConfigurations, setIsLoadingConfigurations] = useState(false);
  const [isLoadingCdPool, setIsLoadingCdPool] = useState(false);
  const [isSubmittingRun, setIsSubmittingRun] = useState(false);
  const [isUpdatingLogs, setIsUpdatingLogs] = useState(false);
  const [isFailedBatchInProgress, setIsFailedBatchInProgress] = useState(false);
  const [isQueueRunModalOpen, setIsQueueRunModalOpen] = useState(false);
  // Per-run batch size override (test points per CD batch). Empty/0 = single batch.
  // Prefilled from workspace setting when modal opens; user can adjust without
  // changing the global default.
  const [modalBatchSize, setModalBatchSize] = useState<number>(10);
  const [isCdModalOpen, setIsCdModalOpen] = useState(false);
  const [pageSize, setPageSize] = useState(20);
  const [pageIndex, setPageIndex] = useState(0);
  const [runProgress, setRunProgress] = useState<string | null>(null);
  const [runMessages, setRunMessages] = useState<Array<{ ts: number; text: string }>>([]);
  const [isRunActive, setIsRunActive] = useState(false);
  const runAbortControllerRef = useRef<AbortController | null>(null);
  const buildDropdownRef = useRef<HTMLDivElement | null>(null);
  const suiteSelectAllRef = useRef<HTMLInputElement | null>(null);

  const isConnectionConfigured = Boolean(
    workspaceSettings.organization.trim()
    && workspaceSettings.projectName.trim()
    && workspaceSettings.patToken.trim(),
  );

  const loadPlans = useCallback(async () => {
    if (!isConnectionConfigured) {
      setPlans([]);
      return;
    }
    setIsLoadingPlans(true);
    try {
      const nextPlans = await fetchPlans(workspaceSettings);
      setPlans(nextPlans);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not load plans.';
      addNotification('error', message);
    } finally {
      setIsLoadingPlans(false);
    }
  }, [addNotification, isConnectionConfigured, workspaceSettings]);

  // Plans enabled for Schedule Run (from settings).
  // Empty array = all plans enabled; otherwise only the listed plan IDs.
  const enabledPlans = useMemo(() => {
    const enabledIds = workspaceSettings.schedulerEnabledPlanIds ?? [];
    if (enabledIds.length === 0) return plans;
    const idSet = new Set(enabledIds);
    return plans.filter((plan) => idSet.has(plan.id));
  }, [plans, workspaceSettings.schedulerEnabledPlanIds]);

  const loadSuites = useCallback(async () => {
    if (!isConnectionConfigured || enabledPlans.length === 0) {
      setSuiteRows([]);
      return;
    }

    // Plan dropdown lists only enabled plans (filtered by settings).
    // 'all' loads suites for every enabled plan; a specific id loads that plan only.
    const planScope = planFilter === 'all'
      ? enabledPlans
      : enabledPlans.filter((plan) => plan.id === planFilter);

    if (planScope.length === 0) {
      setSuiteRows([]);
      return;
    }

    setIsLoadingSuites(true);
    try {
      const workItemIds = parseWorkItemIdsCsv(workspaceSettings.schedulerMappingWorkItemIds || '');
      let mappings: TestSuiteMapping[] = [];
      let mappingFetchSucceeded = false;
      if (workItemIds.length > 0) {
        try {
          mappings = await fetchSuiteReleaseMappings(workspaceSettings, workItemIds);
          mappingFetchSucceeded = true;
        } catch (mappingError) {
          const message = mappingError instanceof Error ? mappingError.message : String(mappingError);
          addNotification(
            'warning',
            `Suite mappings unavailable: ${message}. Suites will load without module tags.`,
          );
        }
      }
      setSuiteMappings(mappings);
      const mappingBySuiteId = new Map<number, TestSuiteMapping>();
      mappings.forEach((mapping) => mappingBySuiteId.set(mapping.testSuiteId, mapping));

      // Empty-mapping warning: fetch succeeded but returned 0 rows — likely XML schema
      // changed or the work items are empty. Helps users debug instead of seeing an empty list.
      if (mappingFetchSucceeded && mappings.length === 0 && workItemIds.length > 0) {
        addNotification(
          'warning',
          `Mapping work item(s) ${workItemIds.join(', ')} returned no rows. ` +
          `Check the work item Parameters field, or disable “Only show suites that have a row in the mapping work items” in Workspace Settings.`,
        );
      }

      const suiteResponses = await Promise.all(
        planScope.map(async (plan) => {
          const response = await fetchSuitesForPlan(workspaceSettings, plan);
          return flattenSuites(extractSuites(response), plan);
        }),
      );
      const allSuites = suiteResponses.flat();

      // Exclusion + presence filters:
      //  Filter 1. Mapping presence — only suites with a row in mappings (toggle: schedulerRequireSuiteMapping)
      //  Filter 2. ID exclusion — schedulerExcludedSuiteIdsCsv (CSV)
      //  Filter 5. Name-pattern exclusion — schedulerExcludedSuiteNamePatterns (CSV)
      // Filter 1 is silently skipped if mappings array is empty (don't drop everything if mappings failed).
      const requireMapping = workspaceSettings.schedulerRequireSuiteMapping
        && mappings.length > 0;
      const namePatterns = parseExcludedSuiteNamePatterns(
        workspaceSettings.schedulerExcludedSuiteNamePatterns || '',
      );
      const excludedIds = parseExcludedSuiteIdsCsv(
        workspaceSettings.schedulerExcludedSuiteIdsCsv || '',
      );
      const anyFilterActive = requireMapping || namePatterns.length > 0 || excludedIds.size > 0;
      const filteredSuites = !anyFilterActive
        ? allSuites
        : allSuites.filter((suite) => {
          if (requireMapping && !mappingBySuiteId.has(suite.suiteId)) return false;
          if (excludedIds.has(suite.suiteId)) return false;
          if (namePatterns.length > 0 && isSuiteNameExcluded(suite.suiteName, namePatterns)) return false;
          return true;
        });

      // Enrich every suite with mapping data (tag + release definition).
      // Test point counts are NOT fetched here — only at run-time via buildSuitePointPlan.
      const enrichedSuites: SuiteRow[] = filteredSuites
        .map((suite) => {
          const mapping = mappingBySuiteId.get(suite.suiteId);
          return {
            ...suite,
            tag: mapping?.tag,
            releaseDefinitionId: mapping?.releaseDefinitionId ?? undefined,
          };
        })
        .sort((left, right) => left.suiteName.localeCompare(right.suiteName));

      setSuiteRows(enrichedSuites);
      // Selection is auto-synced to the visible set by the effect watching
      // [planFilter, selectedTag, suiteSearchText, suiteRows] — no manual cleanup needed.
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not load suites.';
      addNotification('error', message);
      setSuiteRows([]);
    } finally {
      setIsLoadingSuites(false);
    }
  }, [addNotification, enabledPlans, isConnectionConfigured, planFilter, workspaceSettings]);

  const releaseDefinitionPool = useMemo(
    () => parseDefinitionIdsCsv(workspaceSettings.schedulerReleaseDefinitionIdsCsv),
    [workspaceSettings.schedulerReleaseDefinitionIdsCsv],
  );

  const loadBuilds = useCallback(async () => {
    if (!isConnectionConfigured) {
      setBuilds([]);
      setSelectedBuildId(null);
      return;
    }
    setIsLoadingBuilds(true);
    try {
      const nextBuilds = await fetchBuilds(
        workspaceSettings,
        workspaceSettings.schedulerBuildDefinitionId,
        50,
      );
      // No dedup — keep all fetched builds. Default selection = the newest one.
      const sorted = [...nextBuilds].sort((left, right) => {
        const leftTs = Date.parse(left.queueTime);
        const rightTs = Date.parse(right.queueTime);
        return (Number.isFinite(rightTs) ? rightTs : 0) - (Number.isFinite(leftTs) ? leftTs : 0);
      });
      setBuilds(nextBuilds);
      setSelectedBuildId((previous) => (
        previous && sorted.some((build) => build.id === previous)
          ? previous
          : sorted[0]?.id ?? null
      ));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not load builds.';
      addNotification('error', message);
      setBuilds([]);
    } finally {
      setIsLoadingBuilds(false);
    }
  }, [addNotification, isConnectionConfigured, workspaceSettings]);

  const loadConfigurations = useCallback(async () => {
    if (!isConnectionConfigured) {
      setConfigurations([]);
      return;
    }
    setIsLoadingConfigurations(true);
    try {
      // Show every active configuration — user picks the one they want at run time.
      // The previous filter that hid `schedulerDefaultPointConfigurationId` is gone:
      // the default-point config still acts as the eligibility fallback inside the
      // executor, but it's a perfectly valid manual choice in the modal too.
      const nextConfigurations = await fetchTestConfigurations(workspaceSettings);
      setConfigurations(nextConfigurations);
      if (!nextConfigurations.some((configuration) => configuration.id === selectedConfigurationId)) {
        setSelectedConfigurationId(
          nextConfigurations[0]?.id ?? workspaceSettings.schedulerDefaultConfigurationId,
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not load configurations.';
      addNotification('error', message);
      setConfigurations([]);
    } finally {
      setIsLoadingConfigurations(false);
    }
  }, [
    addNotification,
    isConnectionConfigured,
    selectedConfigurationId,
    workspaceSettings,
  ]);

  const loadReleaseDefinitionAvailability = useCallback(async () => {
    if (!isConnectionConfigured || releaseDefinitionPool.length === 0) {
      setReleaseDefinitions([]);
      return;
    }
    setIsLoadingCdPool(true);
    try {
      const availability = await fetchReleaseDefinitionAvailability(
        workspaceSettings,
        releaseDefinitionPool,
      );
      setReleaseDefinitions(availability);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not load CD availability.';
      addNotification('error', message);
      setReleaseDefinitions([]);
    } finally {
      setIsLoadingCdPool(false);
    }
  }, [addNotification, isConnectionConfigured, releaseDefinitionPool, workspaceSettings]);

  useEffect(() => {
    void loadPlans();
  }, [loadPlans]);

  useEffect(() => {
    void loadSuites();
  }, [loadSuites]);

  useEffect(() => {
    setSelectedConfigurationId(workspaceSettings.schedulerDefaultConfigurationId);
  }, [workspaceSettings.schedulerDefaultConfigurationId]);

  useEffect(() => {
    void loadBuilds();
  }, [loadBuilds]);

  useEffect(() => {
    void loadConfigurations();
  }, [loadConfigurations]);

  useEffect(() => {
    void loadReleaseDefinitionAvailability();
  }, [loadReleaseDefinitionAvailability]);

  useEffect(() => {
    if (!isBuildDropdownOpen) {
      return () => {};
    }
    const onDocumentMouseDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (buildDropdownRef.current?.contains(target)) {
        return;
      }
      setIsBuildDropdownOpen(false);
    };
    document.addEventListener('mousedown', onDocumentMouseDown);
    return () => {
      document.removeEventListener('mousedown', onDocumentMouseDown);
    };
  }, [isBuildDropdownOpen]);

  useEffect(() => {
    if (!isQueueRunModalOpen) {
      return () => {};
    }
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isSubmittingRun) {
        setIsQueueRunModalOpen(false);
      }
    };
    window.addEventListener('keydown', onEscape);
    return () => {
      window.removeEventListener('keydown', onEscape);
    };
  }, [isQueueRunModalOpen, isSubmittingRun]);

  useEffect(() => {
    if (!isCdModalOpen) {
      return () => {};
    }
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsCdModalOpen(false);
      }
    };
    window.addEventListener('keydown', onEscape);
    return () => {
      window.removeEventListener('keydown', onEscape);
    };
  }, [isCdModalOpen]);

  // Tag list derived from suite mappings (mirrors C# TestSuiteFilters).
  // Tags come from the work item XML <Tag> field — e.g. "WP1", "WP2", etc.
  // Case-folded for the dedupe so "WP1" and "wp1" become one entry.
  const availableTags = useMemo(() => {
    const seen = new Map<string, string>();
    suiteMappings.forEach((mapping) => {
      const raw = (mapping.tag ?? '').trim();
      if (!raw) return;
      const key = raw.toLowerCase();
      if (!seen.has(key)) {
        seen.set(key, raw);
      }
    });
    return Array.from(seen.values()).sort((a, b) => a.localeCompare(b));
  }, [suiteMappings]);

  // When a tag is selected, restrict to suites whose mapping carries that tag.
  // Comparison is case-insensitive (mirrors C# x.Tag?.ToLower() == filterTag?.ToLower()).
  const tagFilteredSuiteIds = useMemo(() => {
    if (selectedTag === 'all') return null;
    const target = selectedTag.toLowerCase();
    return new Set(
      suiteMappings
        .filter((mapping) => (mapping.tag ?? '').trim().toLowerCase() === target)
        .map((mapping) => mapping.testSuiteId),
    );
  }, [selectedTag, suiteMappings]);

  const visibleSuites = useMemo(() => {
    const search = suiteSearchText.trim().toLowerCase();
    const filtered = suiteRows.filter((suite) => {
      if (tagFilteredSuiteIds && !tagFilteredSuiteIds.has(suite.suiteId)) {
        return false;
      }
      if (!search) {
        return true;
      }
      return (
      suite.suiteName.toLowerCase().includes(search)
      || suite.planName.toLowerCase().includes(search)
      || String(suite.suiteId).includes(search)
      );
    });
    const direction = suiteSort.direction === 'asc' ? 1 : -1;
    const sorted = [...filtered].sort((left, right) => {
      if (suiteSort.key === 'suiteName') {
        const byName = left.suiteName.localeCompare(right.suiteName, undefined, { sensitivity: 'base' });
        if (byName !== 0) return byName * direction;
      } else if (suiteSort.key === 'planName') {
        const byPlan = left.planName.localeCompare(right.planName, undefined, { sensitivity: 'base' });
        if (byPlan !== 0) return byPlan * direction;
      } else if (suiteSort.key === 'suiteId') {
        if (left.suiteId !== right.suiteId) return (left.suiteId - right.suiteId) * direction;
      }
      return left.suiteId - right.suiteId;
    });
    return sorted;
  }, [tagFilteredSuiteIds, suiteRows, suiteSearchText, suiteSort]);

  // Set wrapper for O(1) membership checks. Without this, rendering 1,000+ suite
  // rows triggers Array.includes() per row on every state change → O(N²).
  const selectedSuiteIdSet = useMemo(() => new Set(selectedSuiteIds), [selectedSuiteIds]);

  // Pagination: page-size options grow with the result set. Always includes 20 (min)
  // and "All (N)" at the end so the user can opt into the full list.
  const pageSizeOptions = useMemo(() => {
    const total = visibleSuites.length;
    const tiers = [20, 50, 100, 200, 500, 1000];
    const opts: Array<{ value: number; label: string }> = tiers
      .filter((t) => t === 20 || total >= t)
      .map((v) => ({ value: v, label: v.toLocaleString() }));
    if (total > 20) {
      opts.push({ value: total, label: `All (${total.toLocaleString()})` });
    }
    return opts;
  }, [visibleSuites.length]);

  const totalPages = Math.max(1, Math.ceil(visibleSuites.length / Math.max(1, pageSize)));
  const safePageIndex = Math.min(pageIndex, totalPages - 1);

  const pageSlice = useMemo(
    () => visibleSuites.slice(safePageIndex * pageSize, (safePageIndex + 1) * pageSize),
    [visibleSuites, safePageIndex, pageSize],
  );

  const pageRangeStart = visibleSuites.length === 0 ? 0 : safePageIndex * pageSize + 1;
  const pageRangeEnd = Math.min(visibleSuites.length, (safePageIndex + 1) * pageSize);

  // Reset to page 0 when the filtered set or page size changes
  useEffect(() => {
    setPageIndex(0);
  }, [planFilter, selectedTag, suiteSearchText, pageSize]);

  const visibleSuiteIds = useMemo(
    () => Array.from(new Set(visibleSuites.map((suite) => suite.suiteId))),
    [visibleSuites],
  );

  const selectedVisibleSuiteCount = useMemo(
    () => visibleSuiteIds.filter((suiteId) => selectedSuiteIdSet.has(suiteId)).length,
    [selectedSuiteIdSet, visibleSuiteIds],
  );

  const areAllVisibleSuitesSelected = visibleSuiteIds.length > 0 && selectedVisibleSuiteCount === visibleSuiteIds.length;
  const areSomeVisibleSuitesSelected = selectedVisibleSuiteCount > 0 && !areAllVisibleSuitesSelected;

  useEffect(() => {
    if (!suiteSelectAllRef.current) return;
    suiteSelectAllRef.current.indeterminate = areSomeVisibleSuitesSelected;
  }, [areSomeVisibleSuitesSelected]);

  // Auto-sync selection to the current filter scope.
  // Default = everything in scope is selected. Each filter change (plan, tag, search,
  // or a fresh suite load) overwrites the selection with the new visible set.
  // Sort and pagination do NOT trigger this — they're view-only operations.
  useEffect(() => {
    setSelectedSuiteIds(visibleSuiteIds);
    // visibleSuiteIds is derived; we watch its sources to avoid resetting on sort.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planFilter, selectedTag, suiteSearchText, suiteRows]);

  const selectedSuiteRows = useMemo(
    () => suiteRows.filter((suite) => selectedSuiteIdSet.has(suite.suiteId)),
    [selectedSuiteIdSet, suiteRows],
  );

  const worldPayPlanIds = useMemo(() => {
    const configured = workspaceSettings.dbMappings
      .filter((mapping) => mapping.enabled)
      .filter((mapping) => /world\s*pay/i.test(`${mapping.id} ${mapping.label}`))
      .map((mapping) => mapping.planId)
      .filter((planId) => Number.isInteger(planId) && planId > 0);
    return configured.length > 0 ? configured : [workspaceSettings.schedulerWorldPayTestPlanId];
  }, [workspaceSettings.dbMappings, workspaceSettings.schedulerWorldPayTestPlanId]);

  const requiresWorldPayBuild = useMemo(
    () => {
      if (typeof planFilter === 'number' && worldPayPlanIds.includes(planFilter)) {
        return true;
      }
      return selectedSuiteRows.some((suite) => worldPayPlanIds.includes(suite.planId));
    },
    [planFilter, selectedSuiteRows, worldPayPlanIds],
  );

  const selectedBuild = useMemo(
    () => builds.find((build) => build.id === selectedBuildId) ?? null,
    [builds, selectedBuildId],
  );

  // Show all fetched builds (no branch dedup) sorted newest-first.
  // User can search to narrow; full list is otherwise scrollable.
  const sortedBuilds = useMemo(
    () => [...builds].sort((left, right) => {
      const leftTs = Date.parse(left.queueTime);
      const rightTs = Date.parse(right.queueTime);
      const safeLeft = Number.isFinite(leftTs) ? leftTs : 0;
      const safeRight = Number.isFinite(rightTs) ? rightTs : 0;
      if (safeLeft !== safeRight) return safeRight - safeLeft;
      return right.id - left.id;
    }),
    [builds],
  );

  const selectedBuildLabel = useMemo(() => {
    if (!selectedBuildId) return '';
    const build = sortedBuilds.find((candidate) => candidate.id === selectedBuildId);
    if (!build) return '';
    return toBuildOptionLabel(build.id, build.sourceBranch || build.buildNumber);
  }, [sortedBuilds, selectedBuildId]);

  const visibleBuildOptions = useMemo(() => {
    const search = buildDropdownSearch.trim().toLowerCase();
    if (!search) {
      return sortedBuilds;
    }
    return sortedBuilds.filter((build) => {
      const name = toBranchLabel(build.sourceBranch || build.buildNumber).toLowerCase();
      const buildNumber = build.buildNumber.toLowerCase();
      return (
        String(build.id).includes(search)
        || name.includes(search)
        || buildNumber.includes(search)
      );
    });
  }, [buildDropdownSearch, sortedBuilds]);

  // World Pay build is now resolved from explicit user choice (mirrors C# WorldPay ComboBox)
  const selectedWorldPayBuild = useMemo(() => {
    if (!requiresWorldPayBuild) return null;
    const targetBranch = selectedWorldPayServer === 'Regression World Pay'
      ? workspaceSettings.schedulerWorldPayRegressionBranch
      : workspaceSettings.schedulerWorldPayKanbanBranch;
    return builds.find((build) => build.sourceBranch === targetBranch) ?? null;
  }, [
    builds,
    requiresWorldPayBuild,
    selectedWorldPayServer,
    workspaceSettings.schedulerWorldPayKanbanBranch,
    workspaceSettings.schedulerWorldPayRegressionBranch,
  ]);

  const firstAvailableCd = useMemo(
    () => releaseDefinitions.find((definition) => definition.isAvailable) ?? null,
    [releaseDefinitions],
  );

  const eligiblePointTotal = useMemo(
    () => suitePointPlan.reduce((total, suite) => total + suite.eligiblePointIds.length, 0),
    [suitePointPlan],
  );

  const cdAvailabilityRows = useMemo(
    () => [...releaseDefinitions].sort((left, right) => {
      const leftState = toCdStateLabel(left).toLowerCase();
      const rightState = toCdStateLabel(right).toLowerCase();
      if (leftState !== rightState) {
        return leftState.localeCompare(rightState);
      }
      const leftName = (left.definitionName || `CD ${left.definitionId}`).toLowerCase();
      const rightName = (right.definitionName || `CD ${right.definitionId}`).toLowerCase();
      if (leftName !== rightName) {
        return leftName.localeCompare(rightName);
      }
      return left.definitionId - right.definitionId;
    }),
    [releaseDefinitions],
  );

  const canRunFromModal = useMemo(
    () => (
      selectedSuiteIds.length > 0
      && Boolean(selectedBuild)
      && Boolean(firstAvailableCd)
      && !(requiresWorldPayBuild && !selectedWorldPayBuild)
      && !isLoadingSuites
      && !isSubmittingRun
    ),
    [
      firstAvailableCd,
      isLoadingSuites,
      isSubmittingRun,
      requiresWorldPayBuild,
      selectedBuild,
      selectedSuiteIds.length,
      selectedWorldPayBuild,
    ],
  );

  const toggleSuite = (suiteId: number, checked: boolean) => {
    setSelectedSuiteIds((previous) => {
      if (checked) {
        if (previous.includes(suiteId)) {
          return previous;
        }
        return [...previous, suiteId];
      }
      return previous.filter((item) => item !== suiteId);
    });
  };

  const toggleAllVisibleSuites = (checked: boolean) => {
    setSelectedSuiteIds((previous) => {
      if (checked) {
        const next = new Set(previous);
        visibleSuiteIds.forEach((suiteId) => next.add(suiteId));
        return Array.from(next);
      }
      const visibleSet = new Set(visibleSuiteIds);
      return previous.filter((suiteId) => !visibleSet.has(suiteId));
    });
  };

  const buildSuitePointPlan = useCallback(async (suites: SuiteRow[]): Promise<SuitePointPlan[]> => {
    if (!isConnectionConfigured || suites.length === 0) {
      setSuitePointPlan([]);
      return [];
    }
    try {
      const plans = await Promise.all(
        suites.map(async (suite) => {
          const points = await fetchTestPointsForSuite(workspaceSettings, suite.planId, suite.suiteId);
          const automatedPoints = points.filter((point) => point.isAutomated);
          const eligiblePoints = automatedPoints.filter((point) => (
            point.configurationId === workspaceSettings.schedulerDefaultPointConfigurationId
            || point.configurationId === selectedConfigurationId
          ));
          return {
            suiteId: suite.suiteId,
            suiteName: suite.suiteName,
            planId: suite.planId,
            totalPoints: points.length,
            automatedPoints: automatedPoints.length,
            eligiblePointIds: eligiblePoints.map((point) => point.id),
          } satisfies SuitePointPlan;
        }),
      );
      setSuitePointPlan(plans);
      return plans;
    } finally {
      // kept intentionally for future loading instrumentation
    }
  }, [
    isConnectionConfigured,
    selectedConfigurationId,
    workspaceSettings,
  ]);

  /**
   * Kick off ADO orchestration for the given suite IDs.
   * Fire-and-forget — progress flows through `runProgress` state.
   * Writes a release_logs row per suite via window.desktop.upsertReleaseLog
   * (inside executeSuitesSequentially).
   */
  const startSuiteRun = useCallback((
    suiteIds: number[],
    options: { isFailedRerun?: boolean; pointBatchSizeOverride?: number } = {},
  ) => {
    if (suiteIds.length === 0) return;
    if (!selectedBuild) return;
    const configuration = configurations.find((c) => c.id === selectedConfigurationId)
      ?? { id: selectedConfigurationId, name: `Configuration ${selectedConfigurationId}` };

    const plans: SuiteExecutionPlan[] = suiteIds.map((suiteId, idx) => {
      const row = suiteRows.find((s) => s.suiteId === suiteId);
      return {
        planId: row?.planId ?? 0,
        suiteId,
        suiteName: row?.suiteName ?? `Suite ${suiteId}`,
        releaseDefinitionId: row?.releaseDefinitionId ?? 0,
        batchIndex: Math.floor(idx / Math.max(1, batchSize)),
      };
    }).filter((plan) => plan.planId > 0);

    if (plans.length === 0) {
      addNotification('warning', 'No runnable plans matched the selected suites.');
      return;
    }

    const ctx: RunExecutionContext = {
      settings: workspaceSettings,
      build: selectedBuild,
      worldPayBuild: selectedWorldPayBuild,
      worldPayPlanIds,
      configuration,
      releaseDefinitionIds: releaseDefinitionPool,
      releaseCutoffTime: Date.now(),
      defaultPointConfigurationId: workspaceSettings.schedulerDefaultPointConfigurationId,
      pointBatchSize: options.pointBatchSizeOverride !== undefined
        ? options.pointBatchSizeOverride
        : (workspaceSettings.schedulerPointBatchSize ?? 0),
      cdPollIntervalMs: Math.max(10, workspaceSettings.schedulerPollSeconds ?? 30) * 1000,
      artifactAlias: (workspaceSettings.schedulerArtifactAlias || '').trim() || 'drop',
      manualEnvironments: (workspaceSettings.schedulerManualEnvironmentsCsv || '')
        .split(',')
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0),
      isFailedRerun: Boolean(options.isFailedRerun),
      onProgress: (message) => {
        setRunProgress(message);
        setRunMessages((prev) => {
          // Keep the last 100 messages; newest at the end.
          const next = prev.length >= 100 ? prev.slice(-99) : prev.slice();
          next.push({ ts: Date.now(), text: message });
          return next;
        });
      },
      onLog: () => { /* DB persist already handled inside executor */ },
    };

    const abortController = new AbortController();
    runAbortControllerRef.current = abortController;
    setIsRunActive(true);
    setRunMessages([]);
    setRunProgress(`Starting ${plans.length} suite(s)…`);

    void executeSuitesSequentially(ctx, plans, abortController.signal)
      .then(() => {
        setRunProgress(`Run complete: ${plans.length} suite(s) executed`);
        addNotification('success', `Run complete: ${plans.length} suite(s) executed`);
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        if (abortController.signal.aborted) {
          setRunProgress('Run cancelled');
          addNotification('info', 'Run cancelled');
        } else {
          setRunProgress(`Run failed: ${message}`);
          addNotification('error', `Run failed: ${message}`);
        }
      })
      .finally(() => {
        runAbortControllerRef.current = null;
        setIsRunActive(false);
      });
  }, [
    addNotification,
    batchSize,
    configurations,
    releaseDefinitionPool,
    selectedBuild,
    selectedConfigurationId,
    selectedWorldPayBuild,
    suiteRows,
    workspaceSettings,
    worldPayPlanIds,
  ]);

  const cancelActiveRun = () => {
    if (runAbortControllerRef.current) {
      runAbortControllerRef.current.abort();
    }
  };

  const handleSubmitRun = async (): Promise<boolean> => {
    if (!window.desktop?.queueSchedulerRunRequest) {
      addNotification('error', 'Scheduler run APIs are unavailable. Restart the app to load latest desktop bridge.');
      return false;
    }
    if (!selectedBuild) {
      addNotification('error', 'Select a build before queueing a run.');
      return false;
    }
    if (requiresWorldPayBuild && !selectedWorldPayBuild) {
      addNotification('error', 'WorldPay suites selected but no matching WorldPay build was found.');
      return false;
    }
    if (!firstAvailableCd) {
      addNotification('error', 'No available CD found. Refresh CD status and retry.');
      return false;
    }

    let queuedSuiteIds = selectedSuiteIds;
    if (selectedSuiteIds.length === 0) {
      addNotification('error', 'Select at least one suite before queueing a selected-suites run.');
      return false;
    }
    try {
      const plan = await buildSuitePointPlan(selectedSuiteRows);
      queuedSuiteIds = plan
        .filter((suite) => suite.eligiblePointIds.length > 0)
        .map((suite) => suite.suiteId);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not load suite points for queue validation.';
      addNotification('error', message);
      return false;
    }
    if (queuedSuiteIds.length === 0) {
      addNotification('error', 'No eligible automated points found for the selected suites/configuration.');
      return false;
    }
    setIsSubmittingRun(true);
    try {
      const worldPaySegment = requiresWorldPayBuild && selectedWorldPayBuild
        ? `;worldpayBuild=${selectedWorldPayBuild.id}:${selectedWorldPayBuild.buildNumber}`
        : '';
      const result = await window.desktop.queueSchedulerRunRequest({
        mode: runMode,
        selectedConfigurationId,
        suiteIds: queuedSuiteIds,
        batchSize,
        planId: planFilter === 'all' ? null : planFilter,
        selectedWorldPayServer: requiresWorldPayBuild ? selectedWorldPayServer : undefined,
        selectedBuildRef: `build=${selectedBuild.id}:${selectedBuild.buildNumber};cd=${firstAvailableCd.definitionId}${worldPaySegment}`,
        selectedBuildId: selectedBuild.id,
        selectedWorldPayBuildId: selectedWorldPayBuild?.id ?? null,
        selectedReleaseDefinitionId: firstAvailableCd.definitionId,
        notes: formatCdLabel(firstAvailableCd.definitionId, firstAvailableCd.definitionName),
      });
      addNotification(
        'success',
        result.batchCount > 0
          ? `Run request queued with ${result.batchCount} balanced batches.`
          : 'Run request queued.',
      );

      // Kick off ADO orchestration in the background (Option A).
      // Each suite creates a test run + release in ADO and writes a release_logs row.
      startSuiteRun(queuedSuiteIds, {
        isFailedRerun: false,
        pointBatchSizeOverride: modalBatchSize,
      });
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not queue run request.';
      addNotification('error', message);
      return false;
    } finally {
      setIsSubmittingRun(false);
    }
  };

  const openQueueRunModal = () => {
    setBuildDropdownSearch('');
    setIsBuildDropdownOpen(false);
    // Prefill batch size from workspace default; fall back to 10 if not set.
    const workspaceDefault = workspaceSettings.schedulerPointBatchSize;
    setModalBatchSize(Number.isFinite(workspaceDefault) && workspaceDefault > 0 ? workspaceDefault : 10);
    setIsQueueRunModalOpen(true);
  };

  const closeQueueRunModal = () => {
    if (isSubmittingRun) return;
    setIsBuildDropdownOpen(false);
    setIsQueueRunModalOpen(false);
  };

  const handleRunFromModal = async () => {
    const queued = await handleSubmitRun();
    if (queued) {
      setIsBuildDropdownOpen(false);
      setIsQueueRunModalOpen(false);
    }
  };

  const openCdModal = () => {
    setIsCdModalOpen(true);
    void loadReleaseDefinitionAvailability();
  };

  // Mirrors C# UpdateLogsCommand → LogReleaseDetailsAsync
  const handleUpdateLogs = useCallback(async () => {
    if (!window.desktop?.listPendingReleaseLogs) {
      addNotification('error', 'Release log API unavailable. Restart the desktop app.');
      return;
    }
    setIsUpdatingLogs(true);
    try {
      const pendingDb = await window.desktop.listPendingReleaseLogs();
      if (!Array.isArray(pendingDb) || pendingDb.length === 0) {
        addNotification('info', 'No pending release logs to update.');
        return;
      }
      const pendingRecords: ReleaseLogRecord[] = pendingDb.map((entry) => ({
        releaseId: entry.releaseId,
        releaseDefinitionId: entry.releaseDefinitionId,
        releaseDefinitionName: entry.releaseDefinitionName,
        testRunId: entry.testRunId ?? null,
        suiteId: entry.testSuiteId,
        suiteName: '',
        planId: 0,
        buildNumber: '',
        buildId: 0,
        configurationId: 0,
        batchIndex: entry.batchIndex ?? 0,
        releaseCutoffTime: 0,
        createdAt: 0,
        modifiedAt: 0,
        notes: '',
      }));
      const updated = await updatePendingReleaseLogs(workspaceSettings, pendingRecords, 0);
      const completed = updated.filter((log) => log.runtime != null).length;
      addNotification(
        'success',
        `Update Logs complete: ${completed} of ${pendingRecords.length} releases refreshed.`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not update release logs.';
      addNotification('error', message);
    } finally {
      setIsUpdatingLogs(false);
    }
  }, [addNotification, workspaceSettings]);

  // Mirrors C# failed-batch follow-up after overnight completes (SyncPageViewModel:516-559)
  const handleFailedBatchRerun = useCallback(async () => {
    if (!window.desktop?.listReleaseLogs || !window.desktop?.queueSchedulerRunRequest) {
      addNotification('error', 'Scheduler/release log APIs unavailable.');
      return;
    }
    setIsFailedBatchInProgress(true);
    try {
      const allLogs = await window.desktop.listReleaseLogs(500);
      const failedSuiteIds = Array.from(
        new Set(
          allLogs
            .filter((log) => (log.failedTests ?? 0) > 0)
            .map((log) => log.testSuiteId),
        ),
      );

      // Apply C# exclusion rules from settings
      const excludedIdsCsv = workspaceSettings.schedulerExcludedSuiteIdsCsv || '';
      const excludedIds = new Set(
        excludedIdsCsv
          .split(/[,\s]+/)
          .map((token) => Number(token.trim()))
          .filter((id) => Number.isFinite(id) && id > 0),
      );
      const eligible = failedSuiteIds.filter((id) => !excludedIds.has(id));

      if (eligible.length === 0) {
        addNotification('info', 'No failed suites to rerun.');
        return;
      }

      const result = await window.desktop.queueSchedulerRunRequest({
        mode: 'failed_only_rerun',
        selectedConfigurationId,
        suiteIds: eligible,
        batchSize,
        planId: planFilter === 'all' ? null : planFilter,
        notes: 'Failed-batch rerun (manual trigger)',
      });
      addNotification(
        'success',
        result.batchCount > 0
          ? `Failed-batch rerun queued with ${result.batchCount} batches (${eligible.length} suites).`
          : `Failed-batch rerun queued (${eligible.length} suites).`,
      );

      // Execute the failed suites with isFailedRerun = true so logs are marked correctly
      startSuiteRun(eligible, { isFailedRerun: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not queue failed-batch rerun.';
      addNotification('error', message);
    } finally {
      setIsFailedBatchInProgress(false);
    }
  }, [
    addNotification,
    batchSize,
    planFilter,
    selectedConfigurationId,
    startSuiteRun,
    workspaceSettings.schedulerExcludedSuiteIdsCsv,
  ]);

  const toggleSuiteSort = (key: SuiteSortKey) => {
    setSuiteSort((previous) => {
      if (previous.key === key) {
        return {
          key,
          direction: previous.direction === 'asc' ? 'desc' : 'asc',
        };
      }
      return {
        key,
        direction: 'asc',
      };
    });
  };

  const renderSuiteSortIcon = (key: SuiteSortKey) => {
    if (suiteSort.key !== key) return <IconSort size={10} />;
    return suiteSort.direction === 'asc' ? <IconArrowUpward size={12} /> : <IconArrowDownward size={12} />;
  };

  return (
    <section className="workspace-hub__plans-panel">
      <div className="settings-panel__head workspace-hub__plans-head">
        <div>
          <div className="suite-main-heading">
            <h2>Schedule Run</h2>
          </div>
          <p className="settings-panel__sub">
            Operations workspace for suite-based run planning, build/CD preflight, batching, and scheduler-backed activity.
          </p>
        </div>
        <div className="workspace-hub__plans-meta scheduler-run-screen__actions">
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={openCdModal}
            title="Inspect release definition (CD) availability"
          >
            View CDs
          </button>
          <span className="scheduler-run-screen__action-divider" aria-hidden="true" />
          <button
            type="button"
            className="btn btn--secondary btn--sm"
            onClick={() => { void handleUpdateLogs(); }}
            disabled={isUpdatingLogs}
            title="Refresh release log details from ADO (mirrors C# Update Logs)"
          >
            <IconRefresh size={14} />
            {isUpdatingLogs ? 'Updating…' : 'Update Logs'}
          </button>
          <button
            type="button"
            className="btn btn--warning btn--sm"
            onClick={() => { void handleFailedBatchRerun(); }}
            disabled={isFailedBatchInProgress}
            title="Re-run suites that failed in the last execution"
          >
            <IconMotionPlay size={14} />
            {isFailedBatchInProgress ? 'Queueing…' : 'Failed Batch Rerun'}
          </button>
          <span className="scheduler-run-screen__action-divider" aria-hidden="true" />
          <button
            type="button"
            className="btn btn--primary btn--sm"
            onClick={openQueueRunModal}
            disabled={isSubmittingRun || isLoadingSuites}
          >
            <IconMotionPlay size={15} />
            Queue Run
          </button>
        </div>
      </div>

      <div className={`workspace-hub__plans-body scheduler-run-screen${(isRunActive || runProgress) ? ' has-sidepanel' : ''}`}>
        <div className="scheduler-run-screen__main">
        <div className="scheduler-run-screen__filterbar">
          <select
            className="settings-input scheduler-run-screen__filter-control scheduler-run-screen__filter-plan"
            value={planFilter}
            onChange={(event) => {
              const value = event.target.value;
              setPlanFilter(value === 'all' ? 'all' : Number(value));
            }}
            disabled={isLoadingPlans}
            title="Test Plan"
            aria-label="Filter by test plan"
          >
            <option value="all">All plans</option>
            {enabledPlans.map((plan) => (
              <option key={plan.id} value={plan.id}>{plan.name} ({plan.id})</option>
            ))}
          </select>
          <select
            className="settings-input scheduler-run-screen__filter-control scheduler-run-screen__filter-tag"
            value={selectedTag}
            onChange={(event) => setSelectedTag(event.target.value)}
            disabled={isLoadingSuites || availableTags.length === 0}
            title="Tag filter (from work item mappings)"
            aria-label="Filter by tag"
          >
            <option value="all">All tags</option>
            {availableTags.map((tag) => (
              <option key={tag} value={tag}>{tag}</option>
            ))}
          </select>
          <input
            className="settings-input scheduler-run-screen__filter-search"
            value={suiteSearchText}
            onChange={(event) => setSuiteSearchText(event.target.value)}
            placeholder="Search by name, ID or plan…"
            aria-label="Search suites"
          />
          <button
            type="button"
            className="btn btn--ghost btn--icon btn--sm"
            onClick={() => { void loadSuites(); }}
            disabled={isLoadingSuites}
            title="Refresh suite list"
            aria-label="Refresh suite list"
          >
            <IconRefresh size={15} />
          </button>
        </div>

        <div className="scheduler-run-screen__statusbar">
          <span className="scheduler-run-screen__status-count">
            <strong>{visibleSuites.length.toLocaleString()}</strong>
            {visibleSuites.length === suiteRows.length
              ? ' suites'
              : ` of ${suiteRows.length.toLocaleString()} suites`}
          </span>
          {selectedSuiteIds.length > 0 && (
            <>
              <span className="scheduler-run-screen__status-sep" aria-hidden="true">·</span>
              <span className="scheduler-run-screen__status-selected">
                <strong>{selectedSuiteIds.length.toLocaleString()}</strong> selected
              </span>
              <button
                type="button"
                className="scheduler-run-screen__status-clear"
                onClick={() => setSelectedSuiteIds([])}
              >
                Clear
              </button>
            </>
          )}
        </div>

        <div className="settings-panel scheduler-run-screen__table-panel">
          <div className="scheduler-run-screen__suite-table-shell">
            {isLoadingSuites ? (
              <div className="data-table-wrapper">
                <table className="data-table plans-table">
                  <thead>
                    <tr>
                      <th className="suite-col--run" style={{ width: 52 }}>
                        <input type="checkbox" disabled aria-label="Select all suites" />
                      </th>
                      <th className="suite-col--id" style={{ width: 120 }}>Suite ID</th>
                      <th className="suite-col--suite">Name</th>
                      <th className="suite-col--plan" style={{ width: 220 }}>Plan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: 10 }).map((_, index) => (
                      <tr key={`suite-skeleton-${index}`}>
                        <td className="suite-col--run"><span className="skeleton skeleton--icon-sm" /></td>
                        <td className="suite-col--id"><span className="skeleton skeleton--line-sm" /></td>
                        <td className="suite-col--suite"><span className="skeleton skeleton--line" /></td>
                        <td className="suite-col--plan"><span className="skeleton skeleton--line" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : visibleSuites.length === 0 ? (
              <div className="empty-state scheduler-run-screen__suite-empty">
                <p className="empty-state__title">No suites found</p>
                <p className="empty-state__desc">
                  {isConnectionConfigured
                    ? 'Change plan filter or search text.'
                    : 'Configure Workspace Azure settings to load suites.'}
                </p>
              </div>
            ) : (
              <div className="data-table-wrapper">
                <table className="data-table plans-table">
                  <thead>
                    <tr>
                      <th className="suite-col--run" style={{ width: 52 }}>
                        <input
                          ref={suiteSelectAllRef}
                          type="checkbox"
                          checked={areAllVisibleSuitesSelected}
                          onChange={(event) => toggleAllVisibleSuites(event.target.checked)}
                          aria-label="Select all visible suites"
                        />
                      </th>
                      <th
                        className="suite-col--id"
                        style={{ width: 120 }}
                        aria-sort={suiteSort.key === 'suiteId' ? (suiteSort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
                      >
                        <button
                          type="button"
                          className="scheduler-run-screen__sort-btn scheduler-run-screen__sort-btn--numeric"
                          onClick={() => toggleSuiteSort('suiteId')}
                        >
                          Suite ID
                          <span className="scheduler-run-screen__sort-icon" aria-hidden="true">{renderSuiteSortIcon('suiteId')}</span>
                        </button>
                      </th>
                      <th
                        className="suite-col--suite"
                        aria-sort={suiteSort.key === 'suiteName' ? (suiteSort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
                      >
                        <button
                          type="button"
                          className="scheduler-run-screen__sort-btn"
                          onClick={() => toggleSuiteSort('suiteName')}
                        >
                          Name
                          <span className="scheduler-run-screen__sort-icon" aria-hidden="true">{renderSuiteSortIcon('suiteName')}</span>
                        </button>
                      </th>
                      <th
                        className="suite-col--plan"
                        style={{ width: 220 }}
                        aria-sort={suiteSort.key === 'planName' ? (suiteSort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
                      >
                        <button
                          type="button"
                          className="scheduler-run-screen__sort-btn"
                          onClick={() => toggleSuiteSort('planName')}
                        >
                          Plan
                          <span className="scheduler-run-screen__sort-icon" aria-hidden="true">{renderSuiteSortIcon('planName')}</span>
                        </button>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageSlice.map((suite) => {
                      const isChecked = selectedSuiteIdSet.has(suite.suiteId);
                      return (
                        <tr key={`${suite.planId}-${suite.suiteId}`}>
                          <td className="suite-col--run">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(event) => toggleSuite(suite.suiteId, event.target.checked)}
                            />
                          </td>
                          <td className="suite-col--id">{suite.suiteId}</td>
                          <td className="suite-col--suite">
                            <span style={{ paddingLeft: `${suite.depth * 14}px`, display: 'inline-block' }}>
                              {suite.suiteName}
                            </span>
                          </td>
                          <td className="suite-col--plan">{suite.planName}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {!isLoadingSuites && visibleSuites.length > 0 && (
            <nav className="scheduler-run-screen__pagination" aria-label="Suite pagination">
              <div className="scheduler-run-screen__pagination-range">
                {pageRangeStart.toLocaleString()}–{pageRangeEnd.toLocaleString()} of {visibleSuites.length.toLocaleString()}
              </div>
              <div className="scheduler-run-screen__pagination-controls">
                <button
                  type="button"
                  className="btn btn--ghost btn--icon btn--sm"
                  onClick={() => setPageIndex(0)}
                  disabled={safePageIndex === 0}
                  title="First page"
                  aria-label="First page"
                >
                  «
                </button>
                <button
                  type="button"
                  className="btn btn--ghost btn--icon btn--sm"
                  onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
                  disabled={safePageIndex === 0}
                  title="Previous page"
                  aria-label="Previous page"
                >
                  ‹
                </button>
                <span className="scheduler-run-screen__pagination-page">
                  Page <strong>{safePageIndex + 1}</strong> of {totalPages.toLocaleString()}
                </span>
                <button
                  type="button"
                  className="btn btn--ghost btn--icon btn--sm"
                  onClick={() => setPageIndex((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={safePageIndex >= totalPages - 1}
                  title="Next page"
                  aria-label="Next page"
                >
                  ›
                </button>
                <button
                  type="button"
                  className="btn btn--ghost btn--icon btn--sm"
                  onClick={() => setPageIndex(totalPages - 1)}
                  disabled={safePageIndex >= totalPages - 1}
                  title="Last page"
                  aria-label="Last page"
                >
                  »
                </button>
              </div>
              <label className="scheduler-run-screen__pagination-size">
                Rows per page
                <select
                  className="settings-input"
                  value={pageSize}
                  onChange={(event) => setPageSize(Number(event.target.value))}
                  aria-label="Rows per page"
                >
                  {pageSizeOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </label>
            </nav>
          )}
        </div>
        </div>

        {(isRunActive || runProgress) && (
          <aside
            className={`scheduler-run-screen__sidepanel${isRunActive ? ' is-active' : ' is-done'}`}
            aria-label="Run progress"
          >
            <header className="scheduler-run-screen__sidepanel-head">
              <span
                className={`scheduler-run-screen__sidepanel-dot${isRunActive ? ' is-active' : ' is-done'}`}
                aria-hidden="true"
              />
              <span className="scheduler-run-screen__sidepanel-title">
                {isRunActive ? 'Run in progress' : 'Run complete'}
              </span>
              {isRunActive ? (
                <button
                  type="button"
                  className="btn btn--secondary btn--xs"
                  onClick={cancelActiveRun}
                >
                  Cancel
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn--ghost btn--xs"
                  onClick={() => { setRunProgress(null); setRunMessages([]); }}
                  aria-label="Dismiss run status"
                >
                  Dismiss
                </button>
              )}
            </header>

            <div className="scheduler-run-screen__sidepanel-current">
              {runProgress ?? 'Run in progress…'}
            </div>

            {runMessages.length > 0 && (
              <div className="scheduler-run-screen__sidepanel-log" role="log" aria-live="polite">
                {runMessages.slice().reverse().map((entry, idx) => {
                  const time = new Date(entry.ts).toLocaleTimeString([], { hour12: false });
                  return (
                    <div key={`${entry.ts}-${idx}`} className="scheduler-run-screen__sidepanel-log-row">
                      <span className="scheduler-run-screen__sidepanel-log-time">{time}</span>
                      <span className="scheduler-run-screen__sidepanel-log-text">{entry.text}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </aside>
        )}
      </div>

      {isCdModalOpen && (
        <div className="modal-overlay scheduler-run-modal-overlay" role="presentation">
          <button
            type="button"
            className="modal-overlay__backdrop"
            aria-label="Close CD availability dialog"
            onClick={() => setIsCdModalOpen(false)}
          />
          <div className="modal scheduler-cd-modal" role="dialog" aria-modal="true" aria-labelledby="cdAvailabilityDialogTitle">
            <div className="modal__header scheduler-run-modal__header">
              <div>
                <h3 className="modal__title" id="cdAvailabilityDialogTitle">Available CDs</h3>
                <p className="modal__subtitle">Sorted by availability (available first).</p>
              </div>
              <button type="button" className="btn btn--ghost btn--icon" onClick={() => setIsCdModalOpen(false)} aria-label="Close">
                <IconX size={16} />
              </button>
            </div>
            <div className="modal__body scheduler-cd-modal__body">
              {cdAvailabilityRows.length === 0 ? (
                <div className="empty-state" style={{ margin: 0 }}>
                  <p className="empty-state__title">No CD definitions found</p>
                  <p className="empty-state__desc">Add release definition IDs in workspace settings and refresh CDs.</p>
                </div>
              ) : (
                <div className="data-table-wrapper scheduler-cd-modal__table-wrap">
                  <table className="data-table plans-table">
                    <thead>
                      <tr>
                        <th>Release Definition</th>
                        <th style={{ width: 160 }}>State</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cdAvailabilityRows.map((cd) => (
                        <tr key={cd.definitionId}>
                          <td>{formatCdLabel(cd.definitionId, cd.definitionName)}</td>
                          <td>
                            <span className={toCdStateBadgeClass(cd)}>
                              {toCdStateLabel(cd)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className="modal__footer">
              <button type="button" className="btn btn--secondary" onClick={() => { void loadReleaseDefinitionAvailability(); }} disabled={isLoadingCdPool}>
                <IconRefresh size={14} />
                Refresh CDs
              </button>
              <button type="button" className="btn btn--primary" onClick={() => setIsCdModalOpen(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {isQueueRunModalOpen && (
        <div className="modal-overlay scheduler-run-modal-overlay" role="presentation">
          <button
            type="button"
            className="modal-overlay__backdrop"
            aria-label="Close queue run dialog"
            onClick={closeQueueRunModal}
          />
          <div className="modal scheduler-run-modal" role="dialog" aria-modal="true" aria-labelledby="queueRunDialogTitle">
            <div className="modal__header scheduler-run-modal__header">
              <div>
                <h3 className="modal__title" id="queueRunDialogTitle">Queue Run</h3>
                <p className="modal__subtitle">Review execution inputs before queueing the selected suites.</p>
              </div>
              <button type="button" className="btn btn--ghost btn--icon" onClick={closeQueueRunModal} disabled={isSubmittingRun} aria-label="Close">
                <IconX size={16} />
              </button>
            </div>

            <div className="modal__body scheduler-run-modal__body">
              {/* Summary badges at top — quick context for what will run */}
              {selectedSuiteIds.length === 0 ? (
                <p className="scheduler-run-modal__hint">Select at least one suite to enable Run.</p>
              ) : (
                <div className="scheduler-run-modal__summary">
                  <span className="meta-pill">
                    <strong>{selectedSuiteIds.length.toLocaleString()}</strong>&nbsp;suites selected
                  </span>
                  {requiresWorldPayBuild && (
                    <span className="meta-pill meta-pill--info">Includes World&nbsp;Pay suites</span>
                  )}
                </div>
              )}

              {/* Next available CD — visually distinct status card */}
              <div className={`scheduler-run-modal__cd-card${firstAvailableCd ? '' : ' scheduler-run-modal__cd-card--empty'}`}>
                <div className="scheduler-run-modal__cd-head">
                  <span className="scheduler-run-screen__field-label">Next available CD</span>
                  <button
                    type="button"
                    className="btn btn--ghost btn--xs"
                    onClick={() => { void loadReleaseDefinitionAvailability(); }}
                    disabled={isLoadingCdPool}
                  >
                    <IconRefresh size={13} />
                    Refresh
                  </button>
                </div>
                <div className="scheduler-run-modal__cd-body">
                  <span
                    className={`scheduler-run-modal__cd-dot${firstAvailableCd ? ' is-available' : ' is-unavailable'}`}
                    aria-hidden="true"
                  />
                  {firstAvailableCd ? (
                    <span className="scheduler-run-modal__cd-id">
                      {formatCdLabel(firstAvailableCd.definitionId, firstAvailableCd.definitionName)}
                    </span>
                  ) : (
                    <span className="scheduler-run-modal__cd-empty">
                      No CD available — refresh or expand the CD pool in Workspace Settings.
                    </span>
                  )}
                </div>
              </div>

              {/* Configuration + Batch size on one row (matches Suite Tree modal) */}
              <div className="scheduler-run-modal__inline-fields">
                <label className="scheduler-run-screen__field">
                  <span>Configuration</span>
                  <select
                    className="settings-input"
                    value={selectedConfigurationId}
                    onChange={(event) => {
                      const value = Number(event.target.value);
                      setSelectedConfigurationId(Number.isFinite(value) ? Math.max(1, Math.round(value)) : 1);
                    }}
                    disabled={isLoadingConfigurations}
                  >
                    {configurations.length === 0 ? (
                      <option value={selectedConfigurationId}>
                        {`Configuration ${selectedConfigurationId}`}
                      </option>
                    ) : (
                      configurations.map((configuration) => (
                        <option key={configuration.id} value={configuration.id}>
                          {configuration.name}
                        </option>
                      ))
                    )}
                  </select>
                </label>

                <label className="scheduler-run-screen__field" htmlFor="modalBatchSize">
                  <span>Batch size (per CD)</span>
                  <BatchSizeInput
                    id="modalBatchSize"
                    value={modalBatchSize}
                    onChange={setModalBatchSize}
                  />
                </label>
              </div>

              {/* Build */}
              <label className="scheduler-run-screen__field scheduler-run-screen__field--build">
                <span>Build</span>
                <div className="scheduler-run-screen__build-combobox" ref={buildDropdownRef}>
                  <button
                    type="button"
                    className="settings-input scheduler-run-screen__build-trigger"
                    disabled={isLoadingBuilds}
                    onClick={() => {
                      setBuildDropdownSearch('');
                      setIsBuildDropdownOpen((previous) => !previous);
                    }}
                  >
                    <span className="scheduler-run-screen__build-trigger-label">
                      {selectedBuildLabel || 'Select build'}
                    </span>
                    <IconChevronDown size={16} />
                  </button>
                  {isBuildDropdownOpen && (
                    <div className="scheduler-run-screen__build-popover">
                      <input
                        className="settings-input scheduler-run-screen__build-search"
                        value={buildDropdownSearch}
                        onChange={(event) => setBuildDropdownSearch(event.target.value)}
                        placeholder="Search build id / name"
                        autoFocus
                      />
                      <div className="scheduler-run-screen__build-list">
                        {visibleBuildOptions.map((build) => (
                          <button
                            key={build.id}
                            type="button"
                            className={`scheduler-run-screen__build-item${selectedBuildId === build.id ? ' is-active' : ''}`}
                            onClick={() => {
                              setSelectedBuildId(build.id);
                              setIsBuildDropdownOpen(false);
                            }}
                          >
                            {toBuildOptionLabel(build.id, build.sourceBranch || build.buildNumber)}
                          </button>
                        ))}
                        {visibleBuildOptions.length === 0 && (
                          <div className="scheduler-run-screen__build-empty">No matching builds</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </label>

            </div>

            <div className="modal__footer">
              <button type="button" className="btn btn--secondary" onClick={closeQueueRunModal} disabled={isSubmittingRun}>
                Cancel
              </button>
              <button type="button" className="btn btn--primary" onClick={() => { void handleRunFromModal(); }} disabled={!canRunFromModal}>
                <IconMotionPlay size={15} />
                Run
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
