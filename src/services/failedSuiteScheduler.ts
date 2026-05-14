import type { WorkspaceConnectionSettings } from '../types';
import {
  parseExcludedSuiteIdsCsv,
  parseExcludedSuiteNamePatterns,
  isSuiteNameExcluded,
} from './mappingParser';

/**
 * Starts a background scheduler that triggers failed-suite reruns at 5 AM local time.
 * Returns an AbortController to cancel the scheduler.
 */
export function startFailedSuiteScheduler(
  settings: WorkspaceConnectionSettings,
  onStatusChange: (status: string) => void,
  onRerun: (message: string) => void,
  onError: (error: Error) => void,
): AbortController {
  const abortController = new AbortController();

  // Start scheduler in background
  void runFailedSuiteScheduler(settings, onStatusChange, onRerun, onError, abortController.signal);

  return abortController;
}

/**
 * Main scheduler loop that waits for 5 AM and triggers reruns
 */
async function runFailedSuiteScheduler(
  settings: WorkspaceConnectionSettings,
  onStatusChange: (status: string) => void,
  onRerun: (message: string) => void,
  onError: (error: Error) => void,
  signal: AbortSignal,
): Promise<void> {
  if (!settings.patToken) {
    onError(new Error('Scheduler cannot start: no PAT token configured'));
    return;
  }

  // Wait 5 minutes before starting to monitor
  const initialDelay = 5 * 60 * 1000;
  onStatusChange('Scheduler waiting for initial delay (5 minutes)...');

  try {
    await sleep(initialDelay, signal);
  } catch {
    // Aborted during initial delay
    onStatusChange('Scheduler aborted during initial delay');
    return;
  }

  onStatusChange('Scheduler active, waiting for 5 AM local time');

  // Poll for 5 AM
  const pollIntervalMs = 60 * 1000; // Check every 60 seconds

  while (!signal.aborted) {
    try {
      const now = new Date();
      const hour = now.getHours();

      if (hour === 5) {
        onStatusChange('5 AM reached! Triggering failed-suite rerun...');
        onRerun('Failed-suite rerun triggered at 5 AM');

        // Wait until we're past 5 AM to avoid duplicate triggers
        while (new Date().getHours() === 5) {
          await sleep(60 * 1000, signal);
        }

        onStatusChange('Scheduler active, waiting for next 5 AM');
      }

      // Sleep before next check
      await sleep(pollIntervalMs, signal);
    } catch (error) {
      if (signal.aborted) {
        onStatusChange('Scheduler stopped');
        break;
      }
      if (error instanceof Error) {
        onError(error);
      }
      // Continue polling despite errors
      try {
        await sleep(pollIntervalMs, signal);
      } catch {
        break;
      }
    }
  }
}

/**
 * Sleep for a duration, respecting abort signals
 */
function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new Error('Sleep cancelled'));
      return;
    }

    const timeoutId = setTimeout(resolve, ms);

    const handleAbort = () => {
      clearTimeout(timeoutId);
      reject(new Error('Sleep cancelled'));
    };

    signal.addEventListener('abort', handleAbort, { once: true });
  });
}

/**
 * Filter suites to determine which ones failed and should be rerun
 */
export function filterFailedSuites(
  suites: Array<{ id: number; name: string; outcome?: string; state?: string }>,
  excludedSuiteIds: Set<number>,
  excludedPatterns: string[],
): Array<{ id: number; name: string }> {
  return suites
    .filter((suite) => {
      // Exclude by ID
      if (excludedSuiteIds.has(suite.id)) {
        return false;
      }

      // Exclude by name pattern
      if (isSuiteNameExcluded(suite.name, excludedPatterns)) {
        return false;
      }

      // Only include if outcome is failed
      if (suite.outcome !== 'Failed' && suite.outcome !== 'failed') {
        return false;
      }

      // Only include if state is not in-progress
      if (suite.state === 'InProgress' || suite.state === 'in-progress') {
        return false;
      }

      return true;
    })
    .map((suite) => ({
      id: suite.id,
      name: suite.name,
    }));
}

/**
 * Parse exclusion settings from workspace configuration
 */
export function parseFailedSuiteExclusions(
  excludedSuiteIdsCsv: string,
  excludedSuiteNamePatterns: string,
): { excludedIds: Set<number>; excludedPatterns: string[] } {
  const excludedIds = parseExcludedSuiteIdsCsv(excludedSuiteIdsCsv);
  const excludedPatterns = parseExcludedSuiteNamePatterns(excludedSuiteNamePatterns);

  return {
    excludedIds,
    excludedPatterns,
  };
}
