import type {
  ADOBuildSummary,
  ADOTestConfigurationSummary,
  ReleaseLogRecord,
  WorkspaceConnectionSettings,
} from '../types';
import {
  createTestRun,
  createRelease,
  attachTestRunToRelease,
  startReleaseEnvironment,
  fetchTestPointsForSuite,
} from './adoApi';
import { waitForAvailableReleaseDefinition } from './releaseDefinitionWaiter';

export interface RunExecutionContext {
  settings: WorkspaceConnectionSettings;
  build: ADOBuildSummary;
  configuration: ADOTestConfigurationSummary;
  releaseDefinitionIds: number[];
  releaseCutoffTime: number;
  defaultPointConfigurationId: number;
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
 * Execute test suites sequentially with release orchestration
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

  for (const plan of plans) {
    if (signal?.aborted) {
      context.onProgress('Execution cancelled');
      return;
    }

    try {
      context.onProgress(`Executing suite ${plan.suiteId}: ${plan.suiteName}`);

      // Fetch test points for this suite
      const testPoints = await fetchTestPointsForSuite(
        context.settings,
        plan.planId,
        plan.suiteId,
        signal,
      );

      // Filter to eligible points (automated, with correct configuration)
      const eligiblePoints = testPoints
        .filter((point) => point.isAutomated !== false)
        .filter((point) => {
          const pointConfig = point.configurationId || 0;
          return pointConfig === context.defaultPointConfigurationId || pointConfig === context.configuration.id;
        })
        .map((point) => point.id);

      if (!eligiblePoints.length) {
        context.onProgress(`No eligible points for suite ${plan.suiteId}`);
        continue;
      }

      context.onProgress(`Found ${eligiblePoints.length} eligible points for suite ${plan.suiteId}`);

      // Wait for available release definition
      context.onProgress(`Waiting for available CD from pool of ${context.releaseDefinitionIds.length}`);
      const availableCd = await waitForAvailableReleaseDefinition(
        context.settings,
        context.releaseDefinitionIds,
        3, // maxRetries
        300_000, // retryDelayMs (5 minutes)
        signal,
      );

      if (!availableCd) {
        throw new Error('No available release definition found after retries');
      }

      context.onProgress(`Using CD ${availableCd.definitionId} (${availableCd.definitionName})`);

      // Create test run
      const runResult = await createTestRun(
        context.settings,
        plan.planId,
        plan.suiteId,
        eligiblePoints,
        context.configuration.id,
        signal,
      );

      context.onProgress(`Created test run ${runResult.id} for suite ${plan.suiteId}`);

      // Create release
      const releaseResult = await createRelease(
        context.settings,
        availableCd.definitionId,
        context.build.id,
        context.build.buildNumber,
        signal,
      );

      context.onProgress(`Created release ${releaseResult.id}`);

      // Attach test run to release (use first environment, typically id 1)
      const environmentId = 1;
      await attachTestRunToRelease(
        context.settings,
        releaseResult.id,
        environmentId,
        runResult.id,
        signal,
      );

      context.onProgress(`Attached test run ${runResult.id} to release ${releaseResult.id}`);

      // Start release environment
      await startReleaseEnvironment(
        context.settings,
        releaseResult.id,
        environmentId,
        signal,
      );

      context.onProgress(`Started release environment for release ${releaseResult.id}`);

      // Log the execution
      const logRecord: ReleaseLogRecord = {
        releaseId: releaseResult.id,
        releaseDefinitionId: availableCd.definitionId,
        releaseDefinitionName: availableCd.definitionName,
        testRunId: runResult.id,
        suiteId: plan.suiteId,
        suiteName: plan.suiteName,
        planId: plan.planId,
        buildNumber: context.build.buildNumber,
        buildId: context.build.id,
        configurationId: context.configuration.id,
        batchIndex: plan.batchIndex,
        releaseCutoffTime: context.releaseCutoffTime,
        createdAt: Date.now(),
        modifiedAt: Date.now(),
        runtime: undefined,
        passCount: undefined,
        failCount: undefined,
        notes: `CD ${availableCd.definitionId}`,
      };

      context.onLog(logRecord);

      // Persist to local SQLite release_logs table (mirrors C# ReleaseLogRepository)
      if (window.desktop?.upsertReleaseLog) {
        try {
          await window.desktop.upsertReleaseLog({
            releaseId: releaseResult.id,
            releaseName: `Release-${releaseResult.id}`,
            releaseDefinitionId: availableCd.definitionId,
            releaseDefinitionName: availableCd.definitionName,
            testSuiteId: plan.suiteId,
            isFailedRerun: false,
            releaseStartTime: new Date().toISOString(),
          });
        } catch (persistError) {
          const message =
            persistError instanceof Error ? persistError.message : String(persistError);
          context.onProgress(`Warning: could not persist release log: ${message}`);
        }
      }

      context.onProgress(`Logged execution for suite ${plan.suiteId}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      context.onProgress(`Error executing suite ${plan.suiteId}: ${message}`);
      throw error;
    }
  }

  context.onProgress('All suites executed successfully');
}
