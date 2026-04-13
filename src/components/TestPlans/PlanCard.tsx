import {IconArrowRight} from '../Common/Icons';
import type {ADOTestPlan} from '../../types';

interface PlanCardProps {
    plan: ADOTestPlan;
    onSelect: (plan: ADOTestPlan) => void;
    onOpenSuites: (plan: ADOTestPlan) => void;
}

export function PlanCard({
                             plan,
                             onSelect,
                             onOpenSuites,
                         }: PlanCardProps) {
    const onArrowClick = (event: React.MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();
        onOpenSuites(plan);
    };


    return (
        <div className="card plan-card" onClick={() => onSelect(plan)}>
            <div className="card-content">
                <div className="flex items-center justify-between mb-md">
                    <span className="text-sm text-secondary">Azure Test Plan</span>
                    <span className={`badge ${plan.state === 'Active' ? 'badge--success' : 'badge--warning'}`}>
                        {plan.state}
                    </span>
                </div>

                <h3 className="text-lg font-semibold mb-lg">{plan.name}</h3>

                <div className="plan-card__grid">
                    <div className="plan-card__item">
                        <span className="text-xs text-secondary">ID</span>
                        <strong className="text-sm">{plan.id}</strong>
                    </div>
                    <div className="plan-card__item">
                        <span className="text-xs text-secondary">Iteration</span>
                        <strong className="text-sm">{plan.iteration || '-'}</strong>
                    </div>
                </div>
            </div>

            <div className="card-footer">
                <span className="text-sm text-secondary">Open suite list</span>
                <button
                    type="button"
                    className="btn-icon-flat"
                    onClick={onArrowClick}
                    title="Open suite list"
                >
                    <IconArrowRight size={18}/>
                </button>
            </div>
        </div>
    );
}
