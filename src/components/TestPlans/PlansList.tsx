import { useState, useEffect } from 'react';
import type { ADOTestPlan } from '../../types';
import { PlanCard } from './PlanCard';
import type { WorkspaceSettingsValues } from '../pages/WorkspaceSettings';
import { fetchPlans, getCachedPlans } from '../../services/adoApi';

interface PlansListProps {
  onSelectPlan: (plan: ADOTestPlan) => void;
  workspaceSettings: WorkspaceSettingsValues;
  onPlansLoaded?: (plans: ADOTestPlan[]) => void;
}

export function PlansList({ onSelectPlan, workspaceSettings, onPlansLoaded }: PlansListProps) {
  const [plans, setPlans] = useState<ADOTestPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  const workspaceReady = Boolean(
      workspaceSettings.organization.trim() &&
      workspaceSettings.projectName.trim() &&
      workspaceSettings.patToken.trim()
  );

  useEffect(() => {
    let active = true;

    const loadPlans = async () => {
      if (!workspaceReady) {
        setPlans([]);
        setLoading(false);
        setRefreshing(false);
        setError('Configure Organization, Project, and PAT in Settings to load test plans.');
        setWarning(null);
        onPlansLoaded?.([]);
        return;
      }

      const cached = getCachedPlans(workspaceSettings);
      const hasCachedPlans = Boolean(cached && cached.data.length > 0);

      setError(null);
      setWarning(null);

      if (cached) {
        setPlans(cached.data);
        setLoading(false);
        onPlansLoaded?.(cached.data);
      } else {
        setPlans([]);
        setLoading(true);
      }

      if (cached?.fresh) {
        setRefreshing(false);
        return;
      }

      try {
        setRefreshing(hasCachedPlans);
        const data = await fetchPlans(workspaceSettings);
        if (!active) return;

        setPlans(data);
        setError(null);
        setWarning(null);
        onPlansLoaded?.(data);
      } catch (err) {
        if (!active) return;

        if (hasCachedPlans) {
          setWarning('Showing cached plans. Live data sync failed, retrying on next refresh.');
          setError(null);
          return;
        }

        setPlans([]);
        onPlansLoaded?.([]);
        setError(err instanceof Error ? err.message : 'Failed to load test plans');
      } finally {
        if (active) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    };

    loadPlans().then();

    return () => {
      active = false;
    };
  }, [workspaceReady, workspaceSettings, onPlansLoaded]);

  if (loading) {
    return (
        <div className="plans-skeleton-grid" aria-hidden="true">
          {Array.from({ length: 3 }).map((_, index) => (
              <article key={index} className="plan-skeleton-card">
                <div className="plan-skeleton-row">
                  <span className="skeleton skeleton--pill" />
                  <span className="skeleton skeleton--pill skeleton--pill-sm" />
                </div>

                <span className="skeleton skeleton--title" />
                <span className="skeleton skeleton--line" />

                <div className="plan-skeleton-kv">
                  <span className="skeleton skeleton--tile" />
                  <span className="skeleton skeleton--tile" />
                </div>

                <div className="plan-skeleton-row plan-skeleton-row--end">
                  <span className="skeleton skeleton--line-sm" style={{ width: '120px' }} />
                  <span className="skeleton skeleton--icon" />
                </div>
              </article>
          ))}
        </div>
    );
  }

  if (error) {
    return <div className="alert alert--error">{error}</div>;
  }

  if (plans.length === 0) {
    return (
        <div className="empty-state">
          <p className="empty-state__title">No test plans found</p>
          <p className="empty-state__desc">
            Check your workspace settings or refresh after confirming Azure DevOps access.
          </p>
        </div>
    );
  }

  return (
      <>
        {warning && <div className="alert alert--warning mb-md">{warning}</div>}

        {refreshing && (
            <p className="text-sm text-muted mb-md" aria-live="polite">
              Showing cached plans while syncing the latest updates.
            </p>
        )}

        <div className="plans-grid">
          {plans.map((plan) => (
              <PlanCard
                  key={plan.id}
                  plan={plan}
                  onOpenSuites={onSelectPlan}
              />
          ))}
        </div>
      </>
  );
}