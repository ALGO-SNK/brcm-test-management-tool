import type { ADOReleaseDefinitionAvailability, WorkspaceConnectionSettings } from '../types';
import { fetchReleaseDefinitionAvailability } from './adoApi';

export interface WaitOptions {
  /** Poll interval while no CD is available. Default 30s. */
  pollIntervalMs?: number;
  /** Hard cap on attempts. Default Infinity (poll forever until signal aborts). */
  maxAttempts?: number;
  /** Callback fired each time we have to wait (i.e. no CD found in current poll). */
  onWaiting?: (attempt: number) => void;
  signal?: AbortSignal;
}

/**
 * Waits for an available release definition from the pool.
 *
 * Polls indefinitely by default; cancel via AbortSignal. While waiting, emits
 * `onWaiting(attempt)` each poll cycle so the UI can show a "paused" banner.
 *
 * Returns the first available definition, or null if the pool is empty / cancelled.
 */
export async function waitForAvailableReleaseDefinition(
  settings: WorkspaceConnectionSettings,
  definitionIds: number[],
  options: WaitOptions = {},
): Promise<ADOReleaseDefinitionAvailability | null> {
  if (!definitionIds.length) {
    return null;
  }

  const {
    pollIntervalMs = 30_000,
    maxAttempts = Number.POSITIVE_INFINITY,
    onWaiting,
    signal,
  } = options;

  let attempt = 0;

  while (attempt < maxAttempts) {
    if (signal?.aborted) {
      return null;
    }

    try {
      const availability = await fetchReleaseDefinitionAvailability(settings, definitionIds, signal);
      const available = availability.find((def) => def.isAvailable);
      if (available) {
        return available;
      }
    } catch (error) {
      if (signal?.aborted) return null;
      // Swallow transient errors and keep polling. The caller's cancellation
      // path is via AbortSignal, not exceptions from a single fetch.
      console.warn('[CD waiter] fetch failed, will retry:', error);
    }

    attempt += 1;
    if (onWaiting) {
      try { onWaiting(attempt); } catch { /* callback must not crash the poll loop */ }
    }

    try {
      await sleep(pollIntervalMs, signal);
    } catch {
      // Sleep aborted — exit cleanly
      return null;
    }
  }

  return null;
}

/**
 * Sleep for a duration, respecting abort signals.
 */
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error('Sleep cancelled'));
      return;
    }

    const timeoutId = setTimeout(resolve, ms);

    const handleAbort = () => {
      clearTimeout(timeoutId);
      reject(new Error('Sleep cancelled'));
    };

    signal?.addEventListener('abort', handleAbort, { once: true });
  });
}
