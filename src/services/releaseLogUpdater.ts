import type { ReleaseLogRecord, WorkspaceConnectionSettings } from '../types';
import { fetchReleaseDetails, fetchTestRunDetails } from './adoApi';

/**
 * Update pending release logs with runtime and test results
 */
export async function updatePendingReleaseLogs(
  settings: WorkspaceConnectionSettings,
  pendingLogs: ReleaseLogRecord[],
  releaseCutoffTime: number,
  signal?: AbortSignal,
): Promise<ReleaseLogRecord[]> {
  const updatedLogs: ReleaseLogRecord[] = [];

  for (const log of pendingLogs) {
    try {
      if (signal?.aborted) {
        break;
      }

      // Skip logs that already have runtime (already updated)
      if (log.runtime !== null && log.runtime !== undefined) {
        updatedLogs.push(log);
        continue;
      }

      // Fetch release details
      let releaseDetails: Record<string, unknown>;
      try {
        releaseDetails = await fetchReleaseDetails(settings, log.releaseId, signal);
      } catch {
        // If fetch fails, keep log as-is
        updatedLogs.push(log);
        continue;
      }

      // Use environment[0].createdOn/modifiedOn (mirrors C# SyncPageViewModel.cs:617).
      // The release root createdOn fires immediately on POST; env timings track the
      // actual deployment lifecycle — that's the real runtime.
      const envs = Array.isArray(releaseDetails.environments)
        ? (releaseDetails.environments as Array<Record<string, unknown>>)
        : [];
      const env0 = envs[0];

      const createdDate = parseDate(env0?.createdOn ?? releaseDetails.createdOn);
      const modifiedDate = parseDate(env0?.modifiedOn ?? releaseDetails.modifiedOn);

      // If we don't have a stored testRunId, try to recover it from the release
      // env variables (matches C# TestSuitesRunService.cs:128). Check both keys.
      let effectiveRunId: number | null | undefined = log.testRunId;
      if (!effectiveRunId && env0) {
        const envVars = (env0.variables as Record<string, unknown>) || {};
        const fromRun = readRunIdFromVar(envVars['test.RunId']);
        const fromRund = readRunIdFromVar(envVars['test.RundId']);
        effectiveRunId = fromRun ?? fromRund ?? null;
      }
      // Last resort: the release root may also carry the variable
      if (!effectiveRunId) {
        const rootVars = (releaseDetails.variables as Record<string, unknown>) || {};
        const fromRun = readRunIdFromVar(rootVars['test.RunId']);
        const fromRund = readRunIdFromVar(rootVars['test.RundId']) ?? readRunIdFromVar(rootVars.RunId);
        effectiveRunId = fromRun ?? fromRund ?? null;
      }

      // Only update if release was created after cutoff time
      if (createdDate && modifiedDate) {
        const createdTime = createdDate.getTime();
        if (createdTime >= releaseCutoffTime) {
          // Calculate runtime
          const runtime = modifiedDate.getTime() - createdDate.getTime();

          // Fetch test run details if we now have a test run ID
          let passCount: number | undefined;
          let failCount: number | undefined;
          let totalCount: number | undefined;

          if (effectiveRunId) {
            try {
              const testRunDetails = await fetchTestRunDetails(settings, effectiveRunId, signal);
              passCount = extractTestCount(testRunDetails, 'passedTests', 'PassedTests');
              totalCount = extractTestCount(testRunDetails, 'totalTests', 'TotalTests');
              const failed = extractTestCount(testRunDetails, 'failedTests', 'FailedTests');
              const unanalyzed = extractTestCount(testRunDetails, 'unanalyzedTests', 'UnanalyzedTests');
              const incomplete = extractTestCount(testRunDetails, 'incompleteTests', 'IncompleteTests');
              // C# uses UnanalyzedTests as the "failed" value (TestSuitesRunService.cs:143).
              // Prefer explicit failedTests if present; otherwise sum unanalyzed + incomplete.
              failCount = failed !== undefined
                ? failed
                : (unanalyzed ?? 0) + (incomplete ?? 0);
            } catch {
              // If test run fetch fails, skip counts
            }
          }

          const updated = {
            ...log,
            testRunId: effectiveRunId ?? log.testRunId ?? null,
            runtime,
            passCount,
            failCount,
            modifiedAt: modifiedDate.getTime(),
          };
          updatedLogs.push(updated);

          // Persist (mirrors C# UpdateReleaseLog). Also persist recovered testRunId
          // so subsequent passes can use it directly.
          if (window.desktop?.upsertReleaseLog) {
            try {
              const finalTotal = totalCount !== undefined
                ? totalCount
                : (passCount !== undefined && failCount !== undefined ? passCount + failCount : null);
              await window.desktop.upsertReleaseLog({
                releaseId: log.releaseId,
                releaseDefinitionId: log.releaseDefinitionId ?? 0,
                releaseDefinitionName: log.releaseDefinitionName,
                testSuiteId: log.suiteId,
                testRunId: effectiveRunId ?? undefined,
                totalTests: finalTotal,
                passedTests: passCount ?? null,
                failedTests: failCount ?? null,
                releaseStartTime: createdDate.toISOString(),
                releaseRunTime: `${(runtime / 1000).toFixed(1)}s`,
                releaseLogModifiedTime: modifiedDate.toISOString(),
              });
            } catch {
              // Persistence is best-effort; the in-memory log is still returned
            }
          }
        } else {
          updatedLogs.push(log);
        }
      } else {
        updatedLogs.push(log);
      }
    } catch {
      // On any error, keep original log
      updatedLogs.push(log);
    }
  }

  return updatedLogs;
}

/** Extract a numeric run id from a variable that may be `{ value: "1274240" }` or just a string. */
function readRunIdFromVar(raw: unknown): number | null {
  if (raw == null) return null;
  let str: string | null = null;
  if (typeof raw === 'string') {
    str = raw;
  } else if (typeof raw === 'object') {
    const value = (raw as { value?: unknown }).value;
    if (typeof value === 'string' || typeof value === 'number') {
      str = String(value);
    }
  } else if (typeof raw === 'number') {
    str = String(raw);
  }
  if (!str) return null;
  const parsed = Number(str.trim());
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : null;
}

/**
 * Parse ISO date string to Date object
 */
function parseDate(dateValue: unknown): Date | null {
  if (!dateValue) return null;

  try {
    if (typeof dateValue === 'string') {
      return new Date(dateValue);
    }
    if (dateValue instanceof Date) {
      return dateValue;
    }
    if (typeof dateValue === 'number') {
      return new Date(dateValue);
    }
  } catch {
    // Invalid date
  }

  return null;
}

/**
 * Extract test count from various possible field names
 */
function extractTestCount(
  testRunDetails: Record<string, unknown>,
  ...fieldNames: string[]
): number | undefined {
  for (const fieldName of fieldNames) {
    const value = testRunDetails[fieldName];
    if (typeof value === 'number' && value >= 0) {
      return value;
    }
  }
  return undefined;
}

/**
 * Format release log for text file output
 */
export function formatReleaseLogLine(log: ReleaseLogRecord): string {
  const timestamp = new Date(log.modifiedAt).toISOString();
  const runtime = log.runtime !== null && log.runtime !== undefined ? `${log.runtime}ms` : 'pending';
  const results = log.passCount !== null && log.passCount !== undefined
    ? `${log.passCount}/${log.passCount + (log.failCount || 0)}`
    : 'pending';

  return [
    timestamp,
    `Suite: ${log.suiteId}`,
    `Plan: ${log.planId}`,
    `Release: ${log.releaseId}`,
    `Build: ${log.buildNumber}`,
    `Config: ${log.configurationId}`,
    `Runtime: ${runtime}`,
    `Result: ${results}`,
    `Notes: ${log.notes}`,
  ].join(' | ');
}
