import type { ADOTestPlan, ADOTestSuite, WorkspaceConnectionSettings } from '../types';
import {
  fetchBuilds,
  fetchTestConfigurations,
  type ADOBuildSummary,
  type ADOTestConfigurationSummary,
} from './adoApi';
import {
  executeSuitesSequentially,
  type RunExecutionContext,
  type SuiteExecutionPlan,
} from './suiteRunExecutor';

export type OnDemandSuiteRunMode = 'ci' | 'failed';

export interface OnDemandSuiteRunSettings extends WorkspaceConnectionSettings {
  schedulerBuildDefinitionId: number;
  schedulerDefaultConfigurationId: number;
  schedulerDefaultPointConfigurationId: number;
  schedulerReleaseDefinitionIdsCsv: string;
  schedulerPollSeconds: number;
  schedulerArtifactAlias: string;
  schedulerManualEnvironmentsCsv: string;
  schedulerWorldPayRegressionBranch: string;
  schedulerWorldPayTestPlanId: number;
  dbMappings: Array<{
    id: string;
    label: string;
    planId: number;
    enabled: boolean;
  }>;
}

interface RunOnDemandSuiteOptions {
  settings: OnDemandSuiteRunSettings;
  plan: ADOTestPlan;
  suite: ADOTestSuite;
  mode: OnDemandSuiteRunMode;
  build?: ADOBuildSummary | null;
  worldPayBuild?: ADOBuildSummary | null;
  configuration?: ADOTestConfigurationSummary | null;
  releaseDefinitionIds?: number[];
  selectedReleaseDefinitionId?: number | null;
  batchSize?: number;
  signal?: AbortSignal;
  onProgress?: (message: string) => void;
}

export interface OnDemandSuiteRunResult {
  suiteId: number;
  suiteName: string;
  mode: OnDemandSuiteRunMode;
}

export interface OnDemandSuiteRunPayload {
  mode: 'selected_suite' | 'failed_only_rerun';
  selectedConfigurationId: number;
  suiteIds: number[];
  batchSize: number;
  planId: number;
  selectedWorldPayServer?: string;
  selectedBuildRef: string;
  selectedBuildId: number;
  selectedWorldPayBuildId: number | null;
  selectedReleaseDefinitionId: number;
  notes: string;
}

export function parseDefinitionIdsCsv(value: string): number[] {
  return Array.from(
    new Set(
      value
        .split(/[,\s]+/)
        .map((token) => Number(token.trim()))
        .filter((token) => Number.isInteger(token) && token > 0),
    ),
  );
}

function getBuildSortTimestamp(build: ADOBuildSummary): number {
  const parsed = Date.parse(build.queueTime);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function toBranchLabel(sourceBranch: string): string {
  return sourceBranch.trim().replace(/^refs\/heads\//i, '') || sourceBranch.trim();
}

export function toBuildOptionLabel(buildId: number, sourceBranch: string): string {
  return `${buildId} - ${toBranchLabel(sourceBranch)}`;
}

function getBuildIdentityKey(build: ADOBuildSummary): string {
  const branch = toBranchLabel(build.sourceBranch || '').trim();
  if (branch) return `branch:${branch.toLowerCase()}`;
  const buildNumber = build.buildNumber.trim();
  if (buildNumber) return `build:${buildNumber.toLowerCase()}`;
  return `id:${build.id}`;
}

export function toLatestUniqueBuilds(builds: ADOBuildSummary[]): ADOBuildSummary[] {
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

export function getWorldPayPlanIds(settings: OnDemandSuiteRunSettings): number[] {
  const configured = settings.dbMappings
    .filter((mapping) => mapping.enabled)
    .filter((mapping) => /world\s*pay/i.test(`${mapping.id} ${mapping.label}`))
    .map((mapping) => mapping.planId)
    .filter((planId) => Number.isInteger(planId) && planId > 0);
  return configured.length > 0 ? configured : [settings.schedulerWorldPayTestPlanId];
}

export function getConfiguration(
  configurations: ADOTestConfigurationSummary[],
  selectedConfigurationId: number,
): ADOTestConfigurationSummary {
  return configurations.find((configuration) => configuration.id === selectedConfigurationId)
    ?? { id: selectedConfigurationId, name: `Configuration ${selectedConfigurationId}` };
}

function getManualEnvironments(value: string): string[] {
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function assertRunnableSettings(settings: OnDemandSuiteRunSettings): void {
  if (!settings.organization.trim() || !settings.projectName.trim() || !settings.patToken.trim()) {
    throw new Error('Azure DevOps connection settings are required before running a suite.');
  }
}

export function formatCdLabel(idOrName: number | string | null | undefined, name?: string | null): string {
  const id = typeof idOrName === 'number'
    ? idOrName
    : Number.parseInt(String(idOrName ?? ''), 10);
  const cleanName = (name ?? '').toString().trim();
  if (cleanName) {
    return Number.isFinite(id) ? `${cleanName} (ID: ${id})` : cleanName;
  }
  return Number.isFinite(id) ? `CD ${id}` : '';
}

export function buildOnDemandSuiteRunPayload(input: {
  mode: OnDemandSuiteRunMode;
  suiteId: number;
  planId: number;
  selectedConfigurationId: number;
  batchSize: number;
  selectedBuild: ADOBuildSummary;
  selectedWorldPayBuild?: ADOBuildSummary | null;
  selectedReleaseDefinitionId: number;
  selectedReleaseDefinitionName: string;
  requiresWorldPayBuild: boolean;
}): OnDemandSuiteRunPayload {
  const worldPaySegment = input.requiresWorldPayBuild && input.selectedWorldPayBuild
    ? `;worldpayBuild=${input.selectedWorldPayBuild.id}:${input.selectedWorldPayBuild.buildNumber}`
    : '';
  return {
    mode: input.mode === 'failed' ? 'failed_only_rerun' : 'selected_suite',
    selectedConfigurationId: input.selectedConfigurationId,
    suiteIds: [input.suiteId],
    batchSize: input.batchSize,
    planId: input.planId,
    selectedWorldPayServer: input.requiresWorldPayBuild ? 'Regression World Pay' : undefined,
    selectedBuildRef: `build=${input.selectedBuild.id}:${input.selectedBuild.buildNumber};cd=${input.selectedReleaseDefinitionId}${worldPaySegment}`,
    selectedBuildId: input.selectedBuild.id,
    selectedWorldPayBuildId: input.selectedWorldPayBuild?.id ?? null,
    selectedReleaseDefinitionId: input.selectedReleaseDefinitionId,
    notes: formatCdLabel(input.selectedReleaseDefinitionId, input.selectedReleaseDefinitionName),
  };
}

export async function runOnDemandSuite({
  settings,
  plan,
  suite,
  mode,
  build: providedBuild,
  worldPayBuild: providedWorldPayBuild,
  configuration: providedConfiguration,
  releaseDefinitionIds: providedReleaseDefinitionIds,
  selectedReleaseDefinitionId,
  batchSize = 10,
  signal,
  onProgress = () => {},
}: RunOnDemandSuiteOptions): Promise<OnDemandSuiteRunResult> {
  assertRunnableSettings(settings);
  const releaseDefinitionIds = providedReleaseDefinitionIds?.length
    ? providedReleaseDefinitionIds
    : parseDefinitionIdsCsv(settings.schedulerReleaseDefinitionIdsCsv);
  if (releaseDefinitionIds.length === 0) {
    throw new Error('Add at least one scheduler release definition ID in Workspace Settings before running a suite.');
  }

  const shouldFetchBuilds = !providedBuild || (getWorldPayPlanIds(settings).includes(plan.id) && !providedWorldPayBuild);
  const [builds, configurations] = await Promise.all([
    shouldFetchBuilds ? fetchBuilds(settings, settings.schedulerBuildDefinitionId, 50, signal) : Promise.resolve([]),
    providedConfiguration ? Promise.resolve([]) : fetchTestConfigurations(settings, signal),
  ]);

  const build = providedBuild ?? toLatestUniqueBuilds(builds)[0] ?? null;
  if (!build) {
    throw new Error('No CI build was found for the configured build definition.');
  }

  const worldPayPlanIds = getWorldPayPlanIds(settings);
  const requiresWorldPayBuild = worldPayPlanIds.includes(plan.id);
  const worldPayBuild = requiresWorldPayBuild
    ? providedWorldPayBuild
      ?? builds.find((candidate) => candidate.sourceBranch === settings.schedulerWorldPayRegressionBranch)
      ?? null
    : null;
  if (requiresWorldPayBuild && !worldPayBuild) {
    throw new Error('WorldPay suite selected but no matching Regression World Pay build was found.');
  }

  const configuration = providedConfiguration
    ?? getConfiguration(configurations, settings.schedulerDefaultConfigurationId);
  const preferredReleaseDefinitionIds = selectedReleaseDefinitionId
    ? [
        selectedReleaseDefinitionId,
        ...releaseDefinitionIds.filter((definitionId) => definitionId !== selectedReleaseDefinitionId),
      ]
    : releaseDefinitionIds;
  const pointBatchSize = Number.isFinite(batchSize) && batchSize > 0 ? Math.round(batchSize) : 10;
  const plans: SuiteExecutionPlan[] = [{
    planId: plan.id,
    suiteId: suite.id,
    suiteName: suite.name,
    releaseDefinitionId: 0,
    batchIndex: 0,
  }];
  const context: RunExecutionContext = {
    settings,
    build,
    worldPayBuild,
    worldPayPlanIds,
    configuration,
    releaseDefinitionIds: preferredReleaseDefinitionIds,
    releaseCutoffTime: Date.now(),
    defaultPointConfigurationId: settings.schedulerDefaultPointConfigurationId,
    pointBatchSize,
    cdPollIntervalMs: Math.max(10, settings.schedulerPollSeconds || 30) * 1000,
    artifactAlias: settings.schedulerArtifactAlias.trim() || 'drop',
    manualEnvironments: getManualEnvironments(settings.schedulerManualEnvironmentsCsv),
    isFailedRerun: mode === 'failed',
    pointOutcomeFilter: mode === 'failed' ? 'failed' : 'all',
    persistReleaseLogs: false,
    onProgress,
    onLog: () => {},
  };

  await executeSuitesSequentially(context, plans, signal);
  return {
    suiteId: suite.id,
    suiteName: suite.name,
    mode,
  };
}
