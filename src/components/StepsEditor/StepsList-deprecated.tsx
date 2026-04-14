/*
import { IconTrash, IconPlus, IconCopy } from '../Common/Icons';
import type { StepData } from '../../types';

interface StepsListProps {
  steps: StepData[];
  onSelectStep: (step: StepData, index: number) => void;
  onDeleteStep: (index: number) => void;
  onAddStep: () => void;
  onDuplicateStep: (index: number) => void;
  selectedIndex: number | null;
}

const ACTION_CSS_MAP: { [key: string]: string } = {
  NAVIGATE: 'navigate',
  CLICK: 'click',
  ENTER_TEXT: 'enter-text',
  VERIFY_TEXT: 'verify-text',
  VERIFY_ELEMENT_VISIBLE: 'verify-element-visible',
  DELAY: 'delay',
  CLEAR_TEXT: 'clear-text',
  HOVER: 'hover',
  DOUBLE_CLICK: 'double-click',
  RIGHT_CLICK: 'right-click',
  PRESS_KEY: 'press-key',
  SELECT_OPTION: 'select-option',
  TAKE_SCREENSHOT: 'take-screenshot',
  SWITCH_TO_FRAME: 'switch-to-frame',
  EXECUTE_SCRIPT: 'execute-script',
};

export function StepsList({
                            steps,
                            onSelectStep,
                            onDeleteStep,
                            onAddStep,
                            onDuplicateStep,
                            selectedIndex,
                          }: StepsListProps) {
  if (steps.length === 0) {
    return (
        <div className="empty-state">
          <p className="text-secondary mb-md">No steps yet</p>
          <button className="btn btn--primary" onClick={onAddStep}>
            <IconPlus size={16}/>
            Add First Step
          </button>
        </div>
    );
  }

  return (
      <div>
        <div className="flex flex-col gap-sm">
          {steps.map((step, idx) => {
            const isSelected = selectedIndex === idx;
            const cssClass = ACTION_CSS_MAP[step.action] || '';

            return (
                <div
                    key={step.id}
                    className={`card card--interactive ${isSelected ? 'card--selected' : ''}`}
                    onClick={() => onSelectStep(step, idx)}
                >
                  <div className="card__body" style={{padding: 'var(--space-4)'}}>
                    <div className="flex items-start gap-md">
                      <span className="step-number">{(step.order ?? 0) + 1}</span>

                      <div className="flex-1 min-w-0">
                        <div className="mb-xs">
                      <span className={`action-badge action-badge--${cssClass}`}>
                        {step.action}
                      </span>
                        </div>
                        <p className="text-sm text-secondary truncate">
                          {step.element || step.value || step.description || 'No details'}
                        </p>
                      </div>

                      <div className="flex gap-xs flex-shrink-0" onClick={e => e.stopPropagation()}>
                        <button
                            className="btn btn--icon btn--ghost"
                            onClick={() => onDuplicateStep(idx)}
                            title="Duplicate step"
                        >
                          <IconCopy size={16}/>
                        </button>
                        <button
                            className="btn btn--icon btn--danger"
                            onClick={() => onDeleteStep(idx)}
                            title="Delete step"
                        >
                          <IconTrash size={16}/>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
            );
          })}
        </div>

        <div className="mt-md">
          <button className="btn btn--secondary w-full" onClick={onAddStep}>
            <IconPlus size={16}/>
            Add Step
          </button>
        </div>
      </div>
  );
}
*/
