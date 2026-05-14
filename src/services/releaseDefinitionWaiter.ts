import type { ADOReleaseDefinitionAvailability, WorkspaceConnectionSettings } from '../types';
import { fetchReleaseDefinitionAvailability } from './adoApi';

/**
 * Waits for an available release definition from a pool of definitions.
 * Retries every [retryDelayMs] if none are available.
 */
export async function waitForAvailableReleaseDefinition(
  settings: WorkspaceConnectionSettings,
  definitionIds: number[],
  maxRetries: number = 3,
  retryDelayMs: number = 300_000, // 5 minutes
  signal?: AbortSignal,
): Promise<ADOReleaseDefinitionAvailability | null> {
  if (!definitionIds.length) {
    return null;
  }

  let lastError: Error | null = null;
  let retryCount = 0;

  while (retryCount <= maxRetries) {
    try {
      // Check if abort signal was triggered
      if (signal?.aborted) {
        throw new Error('Release definition waiter was cancelled');
      }

      // Fetch availability for all definitions
      const availability = await fetchReleaseDefinitionAvailability(settings, definitionIds, signal);

      // Find first available definition
      const available = availability.find((def) => def.isAvailable);
      if (available) {
        return available;
      }

      // If no available definitions and we haven't exhausted retries
      if (retryCount < maxRetries) {
        // Wait before retrying
        await sleep(retryDelayMs, signal);
        retryCount += 1;
        continue;
      }

      // All retries exhausted, return null
      return null;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // If abort signal, propagate immediately
      if (signal?.aborted || error instanceof Error && error.message.includes('cancelled')) {
        throw error;
      }

      // If we haven't exhausted retries, wait and retry
      if (retryCount < maxRetries) {
        try {
          await sleep(retryDelayMs, signal);
        } catch {
          // Sleep was cancelled, propagate
          throw error;
        }
        retryCount += 1;
        continue;
      }

      // Retries exhausted, throw last error
      throw lastError;
    }
  }

  return null;
}

/**
 * Sleep for a duration, respecting abort signals
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
