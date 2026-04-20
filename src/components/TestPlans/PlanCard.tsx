import React from 'react';
import { IconPlus } from '../Common/Icons';
import type { ADOTestPlan } from '../../types';
import type { WorkspaceSettingsValues } from '../pages/WorkspaceSettings';
import { buildPlanAdoUrl } from '../../services/adoApi';
import azureLogo from '../../assets/azure.png';

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
      {/* Status Badge */}
      <div className="plan-card__status">
        <span className={`badge ${plan.state === 'Active' ? 'badge--success' : 'badge--warning'}`}>
          {plan.state}
        </span>
      </div>

      {/* Plan Title */}
      <h3 className="plan-card__title">{plan.name}</h3>

      {/* Metadata */}
      <div className="plan-card__meta">
        <div className="plan-card__meta-item">
          <span className="plan-card__meta-label">ID</span>
          <strong className="plan-card__meta-value">{plan.id}</strong>
        </div>

        <div
          className="plan-card__meta-item"
          style={{
            borderLeft: '1px solid var(--color-border-soft)',
            paddingLeft: 'var(--space-4)',
          }}
        >
          <span className="plan-card__meta-label">Iteration</span>
          <strong className="plan-card__meta-value">{plan.iteration || '-'}</strong>
        </div>
      </div>

      {/* Actions Footer */}
      <div className="plan-card__actions">
        <button
          type="button"
          className="btn btn--primary plan-card__primary-btn"
          onClick={onArrowClick}
          title="Open suite list"
          aria-label={`Open suite list for ${plan.name}`}
        >
          Suite List
        </button>

        <button
          type="button"
          className="btn btn--secondary plan-card__icon-btn"
          onClick={onAddSuiteClick}
          disabled={!canCreateSuite}
          title={canCreateSuite ? 'Add a static suite to this plan' : 'Configure workspace settings to create suites'}
          aria-label="Add suite"
        >
          <IconPlus size={18} />
        </button>

        <button
          type="button"
          className="btn btn--secondary plan-card__icon-btn"
          onClick={onOpenAdoClick}
          disabled={!canOpenInAdo}
          title={canOpenInAdo ? 'Open plan in Azure DevOps' : 'Configure workspace settings to open Azure DevOps'}
          aria-label="Open in Azure DevOps"
        >
          <img src={azureLogo} alt="" width={18} height={18} aria-hidden="true" />
        </button>
      </div>
    </article>
  );
}
