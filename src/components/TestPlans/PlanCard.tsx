import {IconArrowRight} from '../Common/Icons';
import type {ADOTestPlan} from '../../types';
import React from "react";

interface PlanCardProps {
    plan: ADOTestPlan;
    onOpenSuites: (plan: ADOTestPlan) => void;
}

export function PlanCard({plan, onOpenSuites}: PlanCardProps) {
    const onArrowClick = (event: React.MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();
        onOpenSuites(plan);
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
                <div className="plan-card__action">
                    <span className="plan-card__cta">Open suite list</span>

                    <button
                        type="button"
                        className="plan-card__arrow-btn"
                        onClick={onArrowClick}
                        title="Open suite list"
                        aria-label={`Open suite list for ${plan.name}`}
                    >
                        <IconArrowRight size={18} className="plan-card__arrow"/>
                    </button>
                </div>
            </div>
        </article>
    );
}