import React from 'react';
import { IconArrowRight, IconOpenInNew, IconPlus } from '../Common/Icons';
import type { ADOTestPlan } from '../../types';
import type { WorkspaceSettingsValues } from '../pages/WorkspaceSettings';
import { buildPlanAdoUrl } from '../../services/adoApi';

interface PlanCardProps {
  plan: ADOTestPlan;
  onOpenSuites: (plan: ADOTestPlan) => void;
  onCreateSuite: (plan: ADOTestPlan) => void;
  workspaceSettings: WorkspaceSettingsValues;
}

export function PlanCard({ plan, onOpenSuites, onCreateSuite, workspaceSettings }: PlanCardProps) {
  const canOpenInAdo = Boolean(
    workspaceSettings.organization.trim()
      && workspaceSettings.projectName.trim(),
  );
  const canCreateSuite = Boolean(
    workspaceSettings.organization.trim()
      && workspaceSettings.projectName.trim()
      && workspaceSettings.patToken.trim(),
  );

  const onArrowClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onOpenSuites(plan);
  };

  const onAddSuiteClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onCreateSuite(plan);
  };

  const onOpenAdoClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    window.open(buildPlanAdoUrl(workspaceSettings, plan.id), '_blank', 'noopener,noreferrer');
  };

  return (
    <article className="plan-card" aria-label={`Plan ${plan.name}`}>
      <div className="plan-card__header">
        <span className="plan-card__type">Azure Test Plan</span>
        <span className={`badge ${plan.state === 'Active' ? 'badge--success' : 'badge--warning'}`}>
          {plan.state}
        </span>
      </div>

      <h3 className="plan-card__name">{plan.name}</h3>

      <div className="plan-card__kv-grid">
        <div className="plan-card__kv-item">
          <span>ID</span>
          <strong>{plan.id}</strong>
        </div>

        <div className="plan-card__kv-item">
          <span>Iteration</span>
          <strong>{plan.iteration || '-'}</strong>
        </div>
      </div>

      <div className="plan-card__footer">
        <button
          type="button"
          className="btn btn--primary btn--sm plan-card__suite-btn"
          onClick={onArrowClick}
          title="Open suite list"
          aria-label={`Open suite list for ${plan.name}`}
        >
          <span>Open suite list</span>
          <IconArrowRight size={16} className="plan-card__arrow" />
        </button>

        <div className="plan-card__footer-actions">
          <button
            type="button"
            className="btn btn--secondary btn--sm plan-card__secondary-btn"
            onClick={onAddSuiteClick}
            disabled={!canCreateSuite}
            title={canCreateSuite ? 'Add a static suite to this plan' : 'Configure workspace settings to create suites'}
          >
            <IconPlus size={16} />
            Add suite
          </button>
          <button
            type="button"
            className="btn btn--secondary btn--sm plan-card__secondary-btn"
            onClick={onOpenAdoClick}
            disabled={!canOpenInAdo}
            title={canOpenInAdo ? 'Open plan in Azure DevOps' : 'Configure workspace settings to open Azure DevOps'}
          >
            <IconOpenInNew size={16} />
            Open in ADO
          </button>
        </div>
      </div>
    </article>
  );
}
