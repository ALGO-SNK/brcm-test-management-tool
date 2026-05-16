import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SuiteTreeNode } from './SuiteTreeNode';
import {
  IconChevronDown,
  IconMotionPlay,
  IconRefresh,
  IconSearch,
  IconUnfoldLess,
  IconUnfoldMore,
  IconX,
} from '../Common/Icons';
import type { ADOTestPlan, ADOTestSuite } from '../../types';
import type { WorkspaceSettingsValues } from '../pages/WorkspaceSettings';
import {
  buildSuiteAdoUrl,
  fetchBuilds,
  fetchReleaseDefinitionAvailability,
  fetchReleaseDefinitionIdsByFolder,
  createStaticSuite,
  fetchTestConfigurations,
  fetchSuitesForPlan,
  getCachedSuitesForPlan,
  type ADOBuildSummary,
  type ADOReleaseDefinitionAvailability,
  type ADOTestConfigurationSummary,
} from '../../services/adoApi';
import { useNotification } from '../../context/useNotification';
import { BatchSizeInput } from '../Common/BatchSizeInput';
import {
  buildOnDemandSuiteRunPayload,
  formatCdLabel,
  getConfiguration,
  getWorldPayPlanIds,
  runOnDemandSuite,
  toBuildOptionLabel,
  type OnDemandSuiteRunMode,
} from '../../services/onDemandSuiteRunner';

/** Imperative trigger exposed to siblings (e.g. the CaseTable toolbar). */
export interface SuiteRunTrigger {
  trigger: (suite: ADOTestSuite, mode: OnDemandSuiteRunMode) => void;
}

interface SuiteTreePanelProps {
  plan: ADOTestPlan;
  selectedSuiteId: number | null;
  onSelectSuite: (suite: ADOTestSuite, path: ADOTestSuite[]) => void;
  onAddTestCase: (suite: ADOTestSuite, path: ADOTestSuite[]) => void;
  workspaceSettings: WorkspaceSettingsValues;
  createPlanSuiteRequest?: number;
  /** Optional: receive a trigger that the parent can call to open the suite-run modal. */
  onRunTriggerReady?: (trigger: SuiteRunTrigger) => void;
}

interface PendingSuiteRun {
  suite: ADOTestSuite;
  mode: OnDemandSuiteRunMode;
}

function normalizeSuite(raw: Record<string, unknown>): ADOTestSuite {
  const suite = raw as unknown as ADOTestSuite;
  // Azure DevOps API may use different field names for test case count
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

function findSuitePathById(
  suites: ADOTestSuite[],
  suiteId: number,
  ancestry: ADOTestSuite[] = [],
): ADOTestSuite[] | null {
  for (const suite of suites) {
    const nextPath = [...ancestry, suite];
    if (suite.id === suiteId) return nextPath;

    const match = suite.children ? findSuitePathById(suite.children, suiteId, nextPath) : null;
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
  workspaceSettings,
  createPlanSuiteRequest = 0,
  onRunTriggerReady,
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
  const suiteRunControllersRef = useRef<Set<AbortController>>(new Set());
  const [activeSuiteActionKeys, setActiveSuiteActionKeys] = useState<Set<string>>(() => new Set());
  const [pendingSuiteRun, setPendingSuiteRun] = useState<PendingSuiteRun | null>(null);
  const [builds, setBuilds] = useState<ADOBuildSummary[]>([]);
  const [selectedBuildId, setSelectedBuildId] = useState<number | null>(null);
  const [buildDropdownSearch, setBuildDropdownSearch] = useState('');
  const [isBuildDropdownOpen, setIsBuildDropdownOpen] = useState(false);
  const [configurations, setConfigurations] = useState<ADOTestConfigurationSummary[]>([]);
  const [selectedConfigurationId, setSelectedConfigurationId] = useState(
    workspaceSettings.schedulerDefaultConfigurationId,
  );
  const [releaseDefinitions, setReleaseDefinitions] = useState<ADOReleaseDefinitionAvailability[]>([]);
  const [releaseDefinitionPool, setReleaseDefinitionPool] = useState<number[]>([]);
  const [isLoadingBuilds, setIsLoadingBuilds] = useState(false);
  const [isLoadingConfigurations, setIsLoadingConfigurations] = useState(false);
  const [isLoadingCdPool, setIsLoadingCdPool] = useState(false);
  const [isSubmittingSuiteRun, setIsSubmittingSuiteRun] = useState(false);
  const [suiteRunBatchSize, setSuiteRunBatchSize] = useState(10);
  const buildDropdownRef = useRef<HTMLDivElement | null>(null);
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

  useEffect(() => () => {
    suiteRunControllersRef.current.forEach((controller) => controller.abort());
    suiteRunControllersRef.current.clear();
  }, []);

  const { children: visibleSuites } = useMemo(() => flattenRoot(suites), [suites]);
  const showExpandControls = hasAnyChildren(visibleSuites);

  useEffect(() => {
    if (selectedSuiteId != null) return;
    if (visibleSuites.length === 0) return;
    onSelectSuite(visibleSuites[0], [visibleSuites[0]]);
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

  // Resolve the CD pool from the configured release-definition folder.
  const releaseDefinitionFolder = workspaceSettings.schedulerReleaseDefinitionFolder;
  useEffect(() => {
    if (!canCreateSuite || !releaseDefinitionFolder.trim()) {
      setReleaseDefinitionPool([]);
      return undefined;
    }
    let cancelled = false;
    void fetchReleaseDefinitionIdsByFolder(workspaceSettings, releaseDefinitionFolder)
      .then((ids) => {
        if (!cancelled) setReleaseDefinitionPool(ids);
      })
      .catch((error) => {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : 'Could not resolve the CD folder.';
        addNotification('error', message);
        setReleaseDefinitionPool([]);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canCreateSuite, releaseDefinitionFolder]);

  // Show all fetched builds (no branch dedup) sorted newest-first.
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

  const selectedBuild = useMemo(
    () => sortedBuilds.find((build) => build.id === selectedBuildId) ?? null,
    [sortedBuilds, selectedBuildId],
  );

  const selectedBuildLabel = useMemo(() => {
    if (!selectedBuildId) return '';
    const build = sortedBuilds.find((candidate) => candidate.id === selectedBuildId);
    if (!build) return '';
    return toBuildOptionLabel(build.id, build.sourceBranch || build.buildNumber);
  }, [sortedBuilds, selectedBuildId]);

  const visibleBuildOptions = useMemo(() => {
    const search = buildDropdownSearch.trim().toLowerCase();
    if (!search) return sortedBuilds;
    return sortedBuilds.filter((build) => {
      const name = (build.sourceBranch || build.buildNumber).toLowerCase();
      const buildNumber = build.buildNumber.toLowerCase();
      return (
        String(build.id).includes(search)
        || name.includes(search)
        || buildNumber.includes(search)
      );
    });
  }, [buildDropdownSearch, sortedBuilds]);

  const worldPayPlanIds = useMemo(
    () => getWorldPayPlanIds(workspaceSettings),
    [workspaceSettings],
  );

  const requiresWorldPayBuild = useMemo(
    () => worldPayPlanIds.includes(plan.id),
    [plan.id, worldPayPlanIds],
  );

  const selectedWorldPayBuild = useMemo(() => {
    if (!requiresWorldPayBuild) return null;
    return builds.find((build) => build.sourceBranch === workspaceSettings.schedulerWorldPayRegressionBranch) ?? null;
  }, [
    builds,
    requiresWorldPayBuild,
    workspaceSettings.schedulerWorldPayRegressionBranch,
  ]);

  const firstAvailableCd = useMemo(
    () => releaseDefinitions.find((definition) => definition.isAvailable) ?? null,
    [releaseDefinitions],
  );

  const selectedConfiguration = useMemo(
    () => getConfiguration(configurations, selectedConfigurationId),
    [configurations, selectedConfigurationId],
  );

  const canRunFromSuiteModal = Boolean(
    pendingSuiteRun
      && selectedBuild
      && firstAvailableCd
      && !(requiresWorldPayBuild && !selectedWorldPayBuild)
      && !isLoadingBuilds
      && !isLoadingConfigurations
      && !isLoadingCdPool
      && !isSubmittingSuiteRun,
  );

  const loadBuilds = useCallback(async () => {
    if (!canCreateSuite) {
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
      // No branch dedup — keep all builds. Default to newest.
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
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : 'Could not load builds.';
      addNotification('error', message);
      setBuilds([]);
      setSelectedBuildId(null);
    } finally {
      setIsLoadingBuilds(false);
    }
  }, [addNotification, canCreateSuite, workspaceSettings]);

  const loadConfigurations = useCallback(async () => {
    if (!canCreateSuite) {
      setConfigurations([]);
      return;
    }
    setIsLoadingConfigurations(true);
    try {
      const nextConfigurations = await fetchTestConfigurations(workspaceSettings);
      setConfigurations(nextConfigurations);
      setSelectedConfigurationId((previous) => (
        nextConfigurations.some((configuration) => configuration.id === previous)
          ? previous
          : nextConfigurations[0]?.id ?? workspaceSettings.schedulerDefaultConfigurationId
      ));
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : 'Could not load test configurations.';
      addNotification('error', message);
      setConfigurations([]);
    } finally {
      setIsLoadingConfigurations(false);
    }
  }, [addNotification, canCreateSuite, workspaceSettings]);

  const loadReleaseDefinitionAvailability = useCallback(async () => {
    if (!canCreateSuite || releaseDefinitionPool.length === 0) {
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
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : 'Could not load CD availability.';
      addNotification('error', message);
      setReleaseDefinitions([]);
    } finally {
      setIsLoadingCdPool(false);
    }
  }, [addNotification, canCreateSuite, releaseDefinitionPool, workspaceSettings]);

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

  useEffect(() => {
    setSelectedConfigurationId(workspaceSettings.schedulerDefaultConfigurationId);
  }, [workspaceSettings.schedulerDefaultConfigurationId]);

  useEffect(() => {
    if (!pendingSuiteRun) return;
    setBuildDropdownSearch('');
    setIsBuildDropdownOpen(false);
    setSuiteRunBatchSize(10);
    void loadBuilds();
    void loadConfigurations();
    void loadReleaseDefinitionAvailability();
  }, [
    loadBuilds,
    loadConfigurations,
    loadReleaseDefinitionAvailability,
    pendingSuiteRun,
  ]);

  useEffect(() => {
    if (!pendingSuiteRun || isSubmittingSuiteRun) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsBuildDropdownOpen(false);
        setPendingSuiteRun(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isSubmittingSuiteRun, pendingSuiteRun]);

  useEffect(() => {
    if (!isBuildDropdownOpen) return () => {};

    const handleMouseDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (buildDropdownRef.current?.contains(target)) return;
      setIsBuildDropdownOpen(false);
    };

    document.addEventListener('mousedown', handleMouseDown);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
    };
  }, [isBuildDropdownOpen]);

  const handleOpenSuiteInAdo = (suite: ADOTestSuite) => {
    if (!canOpenInAdo) return;
    openAdoUrl(buildSuiteAdoUrl(workspaceSettings, plan.id, suite.id));
  };

  const handleAddTestCase = (suite: ADOTestSuite, path: ADOTestSuite[]) => {
    onAddTestCase(suite, path);
  };

  const openSuiteRunModal = useCallback((suite: ADOTestSuite, mode: OnDemandSuiteRunMode) => {
    const actionKey = `${suite.id}:${mode}`;
    if (activeSuiteActionKeys.has(actionKey)) {
      addNotification('info', `"${suite.name}" is already running for this action.`);
      return;
    }

    setPendingSuiteRun({ suite, mode });
  }, [
    activeSuiteActionKeys,
    addNotification,
  ]);

  // Expose the run trigger to the parent so siblings (e.g. CaseTable toolbar)
  // can open the run modal without duplicating the modal state machine.
  useEffect(() => {
    if (!onRunTriggerReady) return;
    onRunTriggerReady({ trigger: openSuiteRunModal });
  }, [onRunTriggerReady, openSuiteRunModal]);

  const closeSuiteRunModal = useCallback(() => {
    if (isSubmittingSuiteRun) return;
    setIsBuildDropdownOpen(false);
    setPendingSuiteRun(null);
  }, [isSubmittingSuiteRun]);

  const submitSuiteRunFromModal = useCallback(async () => {
    if (!pendingSuiteRun || !selectedBuild || !firstAvailableCd) return;
    if (requiresWorldPayBuild && !selectedWorldPayBuild) {
      addNotification('error', 'WorldPay suite selected but no matching Regression World Pay build was found.');
      return;
    }

    const { suite, mode } = pendingSuiteRun;
    const actionKey = `${suite.id}:${mode}`;
    if (activeSuiteActionKeys.has(actionKey)) {
      addNotification('info', `"${suite.name}" is already running for this action.`);
      return;
    }

    const labels: Record<OnDemandSuiteRunMode, string> = {
      ci: 'Run in CI',
      failed: 'Run Failed',
    };
    const normalizedBatchSize = Number.isFinite(suiteRunBatchSize) && suiteRunBatchSize > 0
      ? Math.max(1, Math.round(suiteRunBatchSize))
      : 10;
    const requestPayload = buildOnDemandSuiteRunPayload({
      mode,
      suiteId: suite.id,
      planId: plan.id,
      selectedConfigurationId,
      batchSize: normalizedBatchSize,
      selectedBuild,
      selectedWorldPayBuild,
      selectedReleaseDefinitionId: firstAvailableCd.definitionId,
      selectedReleaseDefinitionName: firstAvailableCd.definitionName,
      requiresWorldPayBuild,
    });
    const controller = new AbortController();
    suiteRunControllersRef.current.add(controller);
    setActiveSuiteActionKeys((previous) => new Set(previous).add(actionKey));
    setIsSubmittingSuiteRun(true);
    setIsBuildDropdownOpen(false);
    setPendingSuiteRun(null);
    addNotification('info', `${labels[mode]} started for "${suite.name}".`);
    setIsSubmittingSuiteRun(false);

    void runOnDemandSuite({
      settings: workspaceSettings,
      plan,
      suite,
      mode,
      build: selectedBuild,
      worldPayBuild: selectedWorldPayBuild,
      configuration: selectedConfiguration,
      releaseDefinitionIds: releaseDefinitionPool,
      selectedReleaseDefinitionId: requestPayload.selectedReleaseDefinitionId,
      batchSize: requestPayload.batchSize,
      signal: controller.signal,
      onProgress: (message) => {
        console.debug('[SuiteTreeRun]', message);
      },
    })
      .then(() => {
        addNotification('success', `${labels[mode]} submitted for "${suite.name}".`);
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        const message = error instanceof Error ? error.message : 'Could not run suite.';
        addNotification('error', message);
      })
      .finally(() => {
        suiteRunControllersRef.current.delete(controller);
        setActiveSuiteActionKeys((previous) => {
          const next = new Set(previous);
          next.delete(actionKey);
          return next;
        });
      });
  }, [
    activeSuiteActionKeys,
    addNotification,
    firstAvailableCd,
    plan,
    pendingSuiteRun,
    releaseDefinitionPool,
    requiresWorldPayBuild,
    selectedBuild,
    selectedConfiguration,
    selectedConfigurationId,
    selectedWorldPayBuild,
    suiteRunBatchSize,
    workspaceSettings,
  ]);

  const handleRunSuiteInCi = (suite: ADOTestSuite) => {
    openSuiteRunModal(suite, 'ci');
  };

  const handleRerunFailedTests = (suite: ADOTestSuite) => {
    openSuiteRunModal(suite, 'failed');
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
      const createdSuitePath = findSuitePathById(refreshedTree, createdSuite.id) ?? [createdSuiteInTree];

      if (createdSuiteInTree) {
        onSelectSuite(createdSuiteInTree, createdSuitePath);
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

  const pendingSuiteRunLabel = pendingSuiteRun
    ? ({
        ci: 'Run in CI',
        failed: 'Run Failed',
      } satisfies Record<OnDemandSuiteRunMode, string>)[pendingSuiteRun.mode]
    : 'Queue Run';

  return (
    <>
      <div className="suite-panel">
        <div className="suite-panel__header">
          <div className="suite-panel__header-main">
            <div className="suite-panel__header-text">
              <h3 className="suite-panel__title">Test Suites</h3>
              <span className="suite-panel__root-name" title={createSuitePlanLabel}>{createSuitePlanLabel}</span>
            </div>
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
                  ancestry={[]}
                  selectedSuiteId={selectedSuiteId}
                  onSelect={onSelectSuite}
                  onAddSuite={(selectedSuite) => openCreateSuiteModal(selectedSuite)}
                  onAddTestCase={handleAddTestCase}
                  onRunSuiteInCi={handleRunSuiteInCi}
                  onRerunFailedTests={handleRerunFailedTests}
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

      {pendingSuiteRun && (
        <div className="modal-overlay scheduler-run-modal-overlay" role="presentation">
          <button
            type="button"
            className="modal-overlay__backdrop"
            aria-label="Close queue run dialog"
            onClick={closeSuiteRunModal}
          />
          <div className="modal scheduler-run-modal" role="dialog" aria-modal="true" aria-labelledby="suiteQueueRunDialogTitle">
            <div className="modal__header scheduler-run-modal__header">
              <div>
                <h3 className="modal__title" id="suiteQueueRunDialogTitle">{pendingSuiteRunLabel}</h3>
                <p className="modal__subtitle">Review execution inputs before running this suite.</p>
              </div>
              <button
                type="button"
                className="btn btn--ghost btn--icon"
                onClick={closeSuiteRunModal}
                disabled={isSubmittingSuiteRun}
                aria-label="Close"
              >
                <IconX size={16} />
              </button>
            </div>

            <div className="modal__body scheduler-run-modal__body">
              <div className="scheduler-run-modal__summary">
                <span className="meta-pill">
                  <strong>1</strong>&nbsp;suite selected
                </span>
                <span className="meta-pill">
                  {pendingSuiteRun.suite.name}
                </span>
                {requiresWorldPayBuild && (
                  <span className="meta-pill meta-pill--info">World&nbsp;Pay suite</span>
                )}
              </div>

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

                <label className="scheduler-run-screen__field" htmlFor="suiteRunBatchSize">
                  <span>Batch size (per CD)</span>
                  <BatchSizeInput
                    id="suiteRunBatchSize"
                    value={suiteRunBatchSize}
                    onChange={setSuiteRunBatchSize}
                  />
                </label>
              </div>

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

              {requiresWorldPayBuild && !selectedWorldPayBuild && (
                <p className="scheduler-run-modal__hint">
                  No matching Regression World Pay build was found for this suite.
                </p>
              )}
            </div>

            <div className="modal__footer">
              <button
                type="button"
                className="btn btn--secondary"
                onClick={closeSuiteRunModal}
                disabled={isSubmittingSuiteRun}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => { void submitSuiteRunFromModal(); }}
                disabled={!canRunFromSuiteModal}
              >
                <IconMotionPlay size={15} />
                Run
              </button>
            </div>
          </div>
        </div>
      )}

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
