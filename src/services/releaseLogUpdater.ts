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

      const createdDate = parseDate(releaseDetails.createdOn);
      const modifiedDate = parseDate(releaseDetails.modifiedOn);

      // Only update if release was created after cutoff time
      if (createdDate && modifiedDate) {
        const createdTime = createdDate.getTime();
        if (createdTime >= releaseCutoffTime) {
          // Calculate runtime
          const runtime = modifiedDate.getTime() - createdDate.getTime();

          // Fetch test run details if we have a test run ID
          let passCount: number | undefined;
          let failCount: number | undefined;

          if (log.testRunId) {
            try {
              const testRunDetails = await fetchTestRunDetails(settings, log.testRunId, signal);
              passCount = extractTestCount(testRunDetails, 'passedTests', 'PassedTests');
              failCount = extractTestCount(testRunDetails, 'failedTests', 'FailedTests');
            } catch {
              // If test run fetch fails, skip counts
            }
          }

          const updated = {
            ...log,
            runtime,
            passCount,
            failCount,
            modifiedAt: modifiedDate.getTime(),
          };
          updatedLogs.push(updated);

          // Persist updated counts/runtime to local SQLite (mirrors C# UpdateReleaseLog)
          if (window.desktop?.upsertReleaseLog) {
            try {
              const totalTests =
                passCount !== undefined && failCount !== undefined ? passCount + failCount : null;
              await window.desktop.upsertReleaseLog({
                releaseId: log.releaseId,
                releaseDefinitionId: log.releaseDefinitionId ?? 0,
                releaseDefinitionName: log.releaseDefinitionName,
                testSuiteId: log.suiteId,
                totalTests,
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
