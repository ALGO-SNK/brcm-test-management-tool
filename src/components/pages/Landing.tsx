import { useState } from 'react';
import { MainLayout } from '../layouts/MainLayout';
import { PlansList } from '../TestPlans/PlansList';
import { IconRefresh } from '../Common/Icons';
import type { ADOTestPlan } from '../../types';
import type { WorkspaceSettingsValues } from './WorkspaceSettings';

interface LandingProps {
  onSelectPlan: (plan: ADOTestPlan) => void;
  onSettingsClick: () => void;
  workspaceSettings: WorkspaceSettingsValues;
}

export function Landing({
                          onSelectPlan,
                          onSettingsClick,
                          workspaceSettings,
                        }: LandingProps) {
  const [planCount, setPlanCount] = useState(0);

  const projectName =
      workspaceSettings.projectName.trim() || 'Azure Test Plans';

  return (
      <MainLayout title={projectName} onSettingsClick={onSettingsClick}>
        <div className="page-shell">
          <div className="hero">
            <div className="hero__top">
              <div className="hero__intro">
                <h1 className="hero__title">{projectName}</h1>
                <p className="hero__copy">
                  Pick a plan to continue into the suite tree, then move through
                  test cases and details.
                </p>
              </div>

              <div className="hero__stats-wrap">
                <div className="hero__stats">
                  <div className="stat-card">

                    <div className="stat-card__label">Plans</div>
                    <div className="stat-card__value">{planCount}</div>
                  </div>

                  <div className="stat-card">
                    <div className="stat-card__label">Runtime</div>
                    <div className="stat-card__value flex items-center gap-2">
                      <span className="dot dot--green" />
                      <span>Connected</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-2 mt-4">
              <button type="button" className="btn btn--secondary btn--sm">
                <IconRefresh size={14} />
                <span>Refresh plans</span>
              </button>
            </div>
          </div>

          <section className="mt-6">
            <div className="mb-4">
              <h2 className="text-xl font-semibold text-primary mb-2">Plans</h2>
              <p className="text-sm text-muted">
                Choose a plan to open its suites, child suites, and test cases.
              </p>
            </div>

            <PlansList
                onSelectPlan={onSelectPlan}
                workspaceSettings={workspaceSettings}
                onPlansLoaded={(plans) => setPlanCount(plans.length)}
            />
          </section>
        </div>
      </MainLayout>
  );
}