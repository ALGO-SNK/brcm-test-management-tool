import type {
  ReleaseLogRecord,
  WorkspaceConnectionSettings,
} from '../types';
import {
  createTestRun,
  createRelease,
  attachTestRunToRelease,
  startReleaseEnvironment,
  fetchTestPointsForSuite,
  updateTestRunAfterRelease,
  type ADOBuildSummary,
  type ADOTestConfigurationSummary,
} from './adoApi';
import { waitForAvailableReleaseDefinition } from './releaseDefinitionWaiter';
import { divideIntoBalancedBatches } from '../utils/divideIntoBalancedBatches';

export interface RunExecutionContext {
  settings: WorkspaceConnectionSettings;
  build: ADOBuildSummary;
  /** Optional WorldPay build — used when a plan's id is in `worldPayPlanIds`. */
  worldPayBuild?: ADOBuildSummary | null;
  /** Plan IDs that should use the WorldPay build. */
  worldPayPlanIds?: number[];
  configuration: ADOTestConfigurationSummary;
  releaseDefinitionIds: number[];
  releaseCutoffTime: number;
  defaultPointConfigurationId: number;
  /** Max test points per CD batch. 0 / undefined => no chunking (all points in one batch). */
  pointBatchSize?: number;
  /** How often to poll for CD availability when none are free. Default 30s. */
  cdPollIntervalMs?: number;
  /** Artifact alias the release definition expects (must match RD's artifact source name). */
  artifactAlias: string;
  /** Environment names to skip auto-deploy at release create time. */
  manualEnvironments?: string[];
  /** When true, suites are persisted with isFailedRerun = true. */
  isFailedRerun?: boolean;
  /** Optional point outcome filter. Default keeps existing all-eligible behavior. */
  pointOutcomeFilter?: 'all' | 'failed';
  /** Persist release log rows. Defaults to true for existing scheduler workspace flows. */
  persistReleaseLogs?: boolean;
  onProgress: (message: string) => void;
  onLog: (record: ReleaseLogRecord) => void;
}

export interface SuiteExecutionPlan {
  planId: number;
  suiteId: number;
  suiteName: string;
  releaseDefinitionId: number;
  batchIndex: number;
}

/**
 * Split test points into balanced batches.
 *
 * Batch size acts as a CAP — the actual size per batch is the smallest integer
 * that keeps every batch ≤ cap. For 25 points with cap 10, the result is
 * [9, 8, 8] rather than [10, 10, 5], so each CD does similar work.
 *
 * Size <= 0 / Infinity => single batch containing all points (used when the
 * user picks "All" in the modal).
 */
function chunkPoints<T>(items: T[], cap: number): T[][] {
  if (!items.length) return [];
  if (!Number.isFinite(cap) || cap <= 0) return [items.slice()];
  return divideIntoBalancedBatches(items, cap);
}

/**
 * Execute test suites from a pool. For each suite, points are filtered to
 * automated + matching configuration, then split into batches. Each batch is
 * submitted to the next available CD from the pool. When the pool is exhausted,
 * the waiter polls indefinitely (UI sees a "paused" banner via onProgress).
 */
export async function executeSuitesSequentially(
  context: RunExecutionContext,
  plans: SuiteExecutionPlan[],
  signal?: AbortSignal,
): Promise<void> {
  if (!plans.length) {
    context.onProgress('No suites to execute');
    return;
  }

  context.onProgress(`Starting execution of ${plans.length} suite(s)`);
  const worldPayPlanIdSet = new Set(context.worldPayPlanIds ?? []);
  const pointBatchSize = context.pointBatchSize ?? 0;
  const cdPollIntervalMs = context.cdPollIntervalMs ?? 30_000;
  const pointOutcomeFilter = context.pointOutcomeFilter ?? 'all';
  const persistReleaseLogs = context.persistReleaseLogs ?? true;

  let suiteIndex = 0;
  for (const plan of plans) {
    suiteIndex += 1;
    if (signal?.aborted) {
      context.onProgress('Execution cancelled');
      return;
    }

    const buildForPlan = worldPayPlanIdSet.has(plan.planId) && context.worldPayBuild
      ? context.worldPayBuild
      : context.build;

    const suitePrefix = `Suite ${suiteIndex}/${plans.length} · ${plan.suiteName}`;

    try {
      context.onProgress(`${suitePrefix}: fetching test points…`);
      const testPoints = await fetchTestPointsForSuite(
        context.settings,
        plan.planId,
        plan.suiteId,
        signal,
      );

      // Strict automation filter — only keep points explicitly marked automated.
      // Matches C#: `.Where(x => x.IsAutomated)`.
      const automatedPoints = testPoints.filter((point) => point.isAutomated === true);
      const configurationMatchedPoints = automatedPoints
        .filter((point) => {
          const pointConfig = point.configurationId || 0;
          return pointConfig === context.defaultPointConfigurationId
            || pointConfig === context.configuration.id;
        });
      const eligiblePoints = configurationMatchedPoints
        .filter((point) => {
          if (pointOutcomeFilter !== 'failed') return true;
          // "Run failed" pre-filter — exact Failed combination:
          //   state          === "notReady"
          //   lastResultState === "completed"
          //   outcome         === "failed"
          //   isActive        === false
          const state = (point.state ?? '').trim().toLowerCase();
          const lastResultState = (point.lastResultState ?? '').trim().toLowerCase();
          const outcome = (point.outcome ?? '').trim().toLowerCase();
          const isActive = point.isActive === true;
          return !isActive
            && state === 'notready'
            && lastResultState === 'completed'
            && outcome === 'failed';
        })
        .map((point) => point.id);

      context.onProgress(
        pointOutcomeFilter === 'failed'
          ? `${suitePrefix}: ${testPoints.length} total points, ${automatedPoints.length} automated, ${configurationMatchedPoints.length} match configuration, ${eligiblePoints.length} failed`
          : `${suitePrefix}: ${testPoints.length} total points, ${automatedPoints.length} automated, ${eligiblePoints.length} match configuration`,
      );

      if (!eligiblePoints.length) {
        context.onProgress(
          pointOutcomeFilter === 'failed'
            ? `${suitePrefix}: no failed automated points for the selected configuration, skipping`
            : `${suitePrefix}: no eligible automated points, skipping`,
        );
        continue;
      }

      const batches = chunkPoints(eligiblePoints, pointBatchSize);
      const batchSizesSummary = batches.map((b) => b.length).join(', ');
      context.onProgress(
        `${suitePrefix}: ${eligiblePoints.length} points → ${batches.length} batch(es) [${batchSizesSummary}]`,
      );

      let batchIndex = 0;
      for (const batchPoints of batches) {
        batchIndex += 1;
        if (signal?.aborted) {
          context.onProgress('Execution cancelled');
          return;
        }

        const batchPrefix = `${suitePrefix} · Batch ${batchIndex}/${batches.length}`;

        context.onProgress(`${batchPrefix}: waiting for available CD…`);
        const availableCd = await waitForAvailableReleaseDefinition(
          context.settings,
          context.releaseDefinitionIds,
          {
            pollIntervalMs: cdPollIntervalMs,
            signal,
            onWaiting: (attempt) => {
              context.onProgress(
                `${batchPrefix}: paused — no CD free (poll ${attempt}, retrying in ${Math.round(cdPollIntervalMs / 1000)}s)…`,
              );
            },
          },
        );

        if (!availableCd) {
          // Cancelled or empty pool
          context.onProgress(`${batchPrefix}: cancelled while waiting for CD`);
          return;
        }

        const cdLabel = availableCd.definitionName?.trim()
          ? `${availableCd.definitionName} (ID: ${availableCd.definitionId})`
          : `CD ${availableCd.definitionId}`;
        context.onProgress(`${batchPrefix}: using ${cdLabel}`);

        // Create test run for this batch
        const runResult = await createTestRun(
          context.settings,
          plan.planId,
          plan.suiteId,
          batchPoints,
          context.configuration.id,
          signal,
        );

        // Create release on the picked CD using the picked build (with full metadata)
        const releaseResult = await createRelease(
          context.settings,
          availableCd.definitionId,
          buildForPlan,
          {
            artifactAlias: context.artifactAlias,
            manualEnvironments: context.manualEnvironments,
          },
          signal,
        );

        // Pick the right environment from the release.
        // Prefer the env whose name matches the configured `manualEnvironments[0]`
        // (the one we deferred). Fall back to the lowest-rank env.
        const manualEnvName = (context.manualEnvironments ?? [])[0]?.trim().toLowerCase();
        const targetEnv = (manualEnvName
          ? releaseResult.environments.find((env) => env.name.trim().toLowerCase() === manualEnvName)
          : null)
          ?? releaseResult.environments[0];

        if (!targetEnv) {
          throw new Error(
            `Release ${releaseResult.id} created but has no environments. Check the release definition.`,
          );
        }

        // C# step 3: attach release/environment URIs + build to the test run.
        // This MUST happen before starting the env, otherwise the run transitions
        // to "InProgress" automatically and the pipeline can't claim it.
        context.onProgress(`${batchPrefix}: linking run ${runResult.id} to release ${releaseResult.id}…`);
        await updateTestRunAfterRelease(
          context.settings,
          runResult.id,
          releaseResult.id,
          targetEnv.id,
          buildForPlan.id,
          signal,
        );

        context.onProgress(`${batchPrefix}: setting tcmTestRun + variables on release env…`);
        await attachTestRunToRelease(
          context.settings,
          releaseResult.id,
          targetEnv.id,
          runResult.id,
          signal,
        );

        await startReleaseEnvironment(
          context.settings,
          releaseResult.id,
          targetEnv.id,
          signal,
        );

        context.onProgress(`${batchPrefix}: started release ${releaseResult.id} (${batchPoints.length} points)`);

        // In-memory log record (callback for non-DB consumers)
        const logRecord: ReleaseLogRecord = {
          releaseId: releaseResult.id,
          releaseDefinitionId: availableCd.definitionId,
          releaseDefinitionName: availableCd.definitionName,
          testRunId: runResult.id,
          suiteId: plan.suiteId,
          suiteName: plan.suiteName,
          planId: plan.planId,
          buildNumber: buildForPlan.buildNumber,
          buildId: buildForPlan.id,
          configurationId: context.configuration.id,
          batchIndex,
          releaseCutoffTime: context.releaseCutoffTime,
          createdAt: Date.now(),
          modifiedAt: Date.now(),
          runtime: undefined,
          passCount: undefined,
          failCount: undefined,
          notes: `${cdLabel} · batch ${batchIndex}/${batches.length}`,
        };
        context.onLog(logRecord);

        // Persist to SQLite (mirrors C# ReleaseLogRepository).
        if (persistReleaseLogs && window.desktop?.upsertReleaseLog) {
          try {
            await window.desktop.upsertReleaseLog({
              releaseId: releaseResult.id,
              releaseName: `Release-${releaseResult.id}`,
              releaseDefinitionId: availableCd.definitionId,
              releaseDefinitionName: availableCd.definitionName,
              testSuiteId: plan.suiteId,
              testRunId: runResult.id,
              isFailedRerun: Boolean(context.isFailedRerun),
              releaseStartTime: new Date().toISOString(),
              batchIndex,
              batchCount: batches.length,
            });
          } catch (persistError) {
            const message =
              persistError instanceof Error ? persistError.message : String(persistError);
            context.onProgress(`Warning: could not persist release log: ${message}`);
          }
        }
      }

      context.onProgress(`${suitePrefix}: done (${batches.length} batch(es) submitted)`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      context.onProgress(`${suitePrefix}: error — ${message}`);
      throw error;
    }
  }

  context.onProgress('All suites submitted to ADO. Results will populate after Update Logs.');
}
