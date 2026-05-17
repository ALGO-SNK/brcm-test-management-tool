import { useEffect, useState, useCallback } from 'react';
import { DOC_ACTION_DEFINITIONS as fallbackCatalog } from '../utils/actionCatalog.generated';

interface Action {
  action_key: string;
  label: string;
  description?: string;
  category: string;
  contract: Record<string, 'required' | 'optional' | 'not-used'>;
  is_deprecated: number;
  is_user_modified: number;
  created_by?: string;
  created_at: string;
  updated_by?: string;
  updated_at: string;
}

interface UseActionsOptions {
  category?: string;
  includeDeprecated?: boolean;
}

interface UseActionsResult {
  actions: Action[];
  categories: string[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

const CACHE_KEY = 'actions_cache';
const CACHE_VERSION_KEY = 'actions_cache_version';
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

export function useActions(options: UseActionsOptions = {}): UseActionsResult {
  const [actions, setActions] = useState<Action[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const convertFallbackAction = (key: string, action: any): Action => ({
    action_key: key,
    label: action.label || key,
    description: action.description,
    category: action.category || 'custom',
    contract: action.contract || {},
    is_deprecated: 0,
    is_user_modified: 0,
    created_by: 'system-import',
    created_at: new Date().toISOString(),
    updated_by: undefined,
    updated_at: new Date().toISOString(),
  });

  const getCachedActions = useCallback((): Action[] | null => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      const version = localStorage.getItem(CACHE_VERSION_KEY);
      const now = Date.now();

      if (!cached || !version) return null;

      const { timestamp, data } = JSON.parse(cached);
      if (now - timestamp > CACHE_DURATION_MS) {
        localStorage.removeItem(CACHE_KEY);
        localStorage.removeItem(CACHE_VERSION_KEY);
        return null;
      }

      return data as Action[];
    } catch {
      return null;
    }
  }, []);

  const setCachedActions = useCallback((data: Action[]) => {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        timestamp: Date.now(),
        data,
      }));
      localStorage.setItem(CACHE_VERSION_KEY, '1');
    } catch {
      // Cache write failed, continue without cache
    }
  }, []);

  const loadActions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Try database first
      if (window.desktop?.listActions) {
        try {
          const dbActions = await window.desktop.listActions({
            includeDeprecated: options.includeDeprecated !== false,
          });

          const filtered = options.category
            ? dbActions.filter((a) => a.category === options.category)
            : dbActions;

          setActions(filtered);
          setCachedActions(filtered);

          // Load categories
          if (window.desktop?.getActionCategories) {
            const cats = await window.desktop.getActionCategories();
            setCategories(cats);
          }

          return;
        } catch (dbError) {
          console.warn('[useActions] Database fetch failed, falling back to static catalog', dbError);
        }
      }

      // Fall back to cached data
      const cached = getCachedActions();
      if (cached) {
        const filtered = options.category
          ? cached.filter((a) => a.category === options.category)
          : cached;
        setActions(filtered);
        return;
      }

      // Fall back to static import
      const fallbackActions = Object.entries(fallbackCatalog).map(([key, action]) =>
        convertFallbackAction(key, action)
      );

      const filtered = options.category
        ? fallbackActions.filter((a) => a.category === options.category)
        : fallbackActions;

      setActions(filtered);
      setCachedActions(fallbackActions);

      // Extract categories
      const uniqueCategories = Array.from(
        new Set(fallbackActions.map((a) => a.category))
      ).sort();
      setCategories(uniqueCategories);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load actions';
      setError(message);
      console.error('[useActions]', message, err);
    } finally {
      setLoading(false);
    }
  }, [options.category, options.includeDeprecated, getCachedActions, setCachedActions]);

  useEffect(() => {
    loadActions();
  }, [loadActions]);

  return {
    actions,
    categories,
    loading,
    error,
    refetch: loadActions,
  };
}

export function getActionByKey(actionKey: string, actions: Action[]): Action | undefined {
  return actions.find((a) => a.action_key === actionKey);
}

export function getActionsByCategory(category: string, actions: Action[]): Action[] {
  return actions.filter((a) => a.category === category);
}
