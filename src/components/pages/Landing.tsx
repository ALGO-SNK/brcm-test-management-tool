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
        <div className="mb-lg">
          <div className="row">
            <div className="col s12">
              <h1 className="text-3xl font-semibold mb-md">{projectName}</h1>
              <p className="text-sm text-secondary mb-lg">
                Pick a plan to continue into the suite tree, then move through test cases and details without changing the app's visual language.
              </p>

              {/* Stats Cards */}
              <div className="row">
                <div className="col s12 m6 l3">
                  <div className="card">
                    <div className="card-content">
                      <span className="card-title text-sm text-secondary">Plans</span>
                      <div className="text-2xl font-bold text-primary mt-md">{planCount}</div>
                    </div>
                  </div>
                </div>

                <div className="col s12 m6 l3">
                  <div className="card">
                    <div className="card-content">
                      <span className="card-title text-sm text-secondary">Runtime</span>
                      <div className="flex items-center gap-sm mt-md">
                        <span className="dot dot--green" />
                        <span className="font-bold">Connected</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <p className="text-sm text-secondary mt-lg mb-md">
            Open a plan first. The suite tree and test list appear only after drill-down begins.
          </p>

          <div className="flex gap-sm">
            <button className="btn btn--secondary btn--sm">
              <IconRefresh size={14} />
              Refresh plans
            </button>
          </div>
        </div>

        <div className="mt-xl">
          <div className="mb-lg">
            <h2 className="text-xl font-semibold text-primary mb-sm">Plans</h2>
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
