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

export function Landing({ onSelectPlan, onSettingsClick, workspaceSettings }: LandingProps) {
  const [planCount, setPlanCount] = useState(0);
  const projectName = workspaceSettings.projectName.trim() || 'Azure Test Plans';

  return (
    <MainLayout title={projectName} onSettingsClick={onSettingsClick}>
      <div>
        {/* Hero Section */}
        <div className="hero">
          <div className="hero__top mb-lg">
            <div className="hero__intro">
              <h1 className="hero__title text-3xl">
                {projectName}
              </h1>
              <p className="hero__copy text-sm text-secondary">
                Pick a plan to continue into the suite tree, then move through test cases and details without changing the app's visual language.
              </p>
            </div>

            <div className="hero__stats-wrap">
              {/* Stats Cards */}
              <div className="hero__stats">
                <div className="stat-card stat-card--primary">
                  <div className="stat-card__label">Plans</div>
                  <div className="stat-card__value text-primary">{planCount}</div>
                </div>
                <div className="stat-card stat-card--success">
                  <div className="stat-card__label">Runtime</div>
                  <div className="flex items-center gap-sm mt-sm">
                    <span className="dot dot--green" />
                    <span className="font-bold">Connected</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <p className="text-sm text-secondary mt-md">
            Open a plan first. The suite tree and test list appear only after drill-down begins.
          </p>

          <div className="flex gap-sm mt-md">
            <button className="btn btn--secondary btn--sm">
              <IconRefresh size={14} />
              Refresh plans
            </button>
          </div>
        </div>

        <div>
          <div className="section-header mb-md">
            <h2 className="text-xl font-semibold text-primary uppercase">Plans</h2>
            <p className="text-sm text-secondary">
              Choose a plan to open its suites, child suites, and test cases.
            </p>
          </div>
          <PlansList
            onSelectPlan={onSelectPlan}
            workspaceSettings={workspaceSettings}
            onPlansLoaded={(plans) => setPlanCount(plans.length)}
          />
        </div>
      </div>
    </MainLayout>
  );
}
