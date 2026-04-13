import { useMemo, useRef, useState } from 'react';
import { IconCopy, IconX } from '../Common/Icons';
import { SearchableSelect } from '../Common/SearchableSelect';
import { StepFieldRenderer } from './StepFieldRenderer';
import { parseXMLSteps } from '../../utils/xmlParser';
import { ACTION_REGISTRY } from '../../utils/actionRegistry';

export interface ParsedStep {
  id?: string; // Original step ID from ADO (e.g., "15", "14", "2", etc.)
  index: number;
  action: string;
  element?: string;
  elementCategory?: string;
  value?: string;
  expectedValue?: string;
  key?: string;
  headers?: string;
  description?: string;
  // Extended fields from ACTION_PARAMETER_MATRIX
  elementReplaceTextDataKey?: string;
  isElementPathDynamic?: boolean;
  isConcatenated?: boolean;
}

interface StepEditorState extends ParsedStep {
  isDragging: boolean;
}

interface StepsEditorProps {
  rawSteps: unknown;
  onChange: (steps: ParsedStep[]) => void;
  errors?: string[];
}

function toEditorStep(step: ParsedStep): StepEditorState {
  return {
    ...step,
    isDragging: false,
  };
}

export function StepsEditor({ rawSteps, onChange, errors = [] }: StepsEditorProps) {
  const normalizeFieldText = (value: unknown): string => {
    if (typeof value === 'string') return value;
    if (typeof value === 'number') return String(value);
    return '';
  };

  const input = normalizeFieldText(rawSteps).trim();
  const parsedSteps = useMemo(() => {
    if (!input) return [];
    const { steps } = parseXMLSteps(input);
    return steps.map((step, idx) => ({
      ...step,
      index: idx + 1,
    }));
  }, [input]);

  const actionOptions = useMemo(
    () => Object.values(ACTION_REGISTRY)
      .map((action) => ({ value: action.name, label: action.name }))
      .sort((a, b) => a.label.localeCompare(b.label)),
    []
  );

  const [steps, setSteps] = useState<StepEditorState[]>(parsedSteps.map(toEditorStep));
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const dragOverIndex = useRef<number | null>(null);

  const publishChanges = (updatedSteps: StepEditorState[]) => {
    setSteps(updatedSteps);
    onChange(updatedSteps.map(({ isDragging, ...step }) => step));
  };

  const handleStepFieldChange = (
    stepIndex: number,
    field: keyof ParsedStep,
    value: string | boolean,
  ) => {
    const updated = steps.map((step, idx) => {
      if (idx === stepIndex) return { ...step, [field]: value };
      return step;
    });
    publishChanges(updated);
  };

  const handleDragStart = (stepIndex: number) => {
    setDraggedIndex(stepIndex);
  };

  const handleDragOver = (stepIndex: number) => {
    dragOverIndex.current = stepIndex;
  };

  const handleDragEnd = () => {
    if (draggedIndex !== null && dragOverIndex.current !== null && draggedIndex !== dragOverIndex.current) {
      const updated = [...steps];
      const [draggedStep] = updated.splice(draggedIndex, 1);
      updated.splice(dragOverIndex.current, 0, draggedStep);

      const reindexed = updated.map((step, idx) => ({
        ...step,
        index: idx + 1,
      }));

      publishChanges(reindexed);
    }

    setDraggedIndex(null);
    dragOverIndex.current = null;
  };

  const handleCopyStep = (stepIndex: number) => {
    const stepToCopy = steps[stepIndex];
    const copiedStep: StepEditorState = {
      ...stepToCopy,
      index: steps.length + 1,
      isDragging: false,
    };
    publishChanges([...steps, copiedStep]);
  };

  const handleDeleteStep = (stepIndex: number) => {
    const updated = steps
      .filter((_, idx) => idx !== stepIndex)
      .map((step, idx) => ({ ...step, index: idx + 1 }));
    publishChanges(updated);
  };

  return (
    <div className="steps-editor">
      <div className="steps-editor__header">
        <span className="steps-editor__title">
          STEPS <span className="steps-editor__badge">{steps.length}</span>
        </span>
      </div>

      {errors.length > 0 && (
        <div className="steps-editor__errors">
          {errors.map((error, idx) => (
            <p key={idx} className="steps-editor__error">{error}</p>
          ))}
        </div>
      )}

      <div className="steps-editor__list">
        {steps.map((step, stepIndex) => (
          <div
            key={`step-${stepIndex}`}
            className={`steps-editor__step${step.isDragging ? ' is-dragging' : ''}`}
            draggable
            onDragStart={() => handleDragStart(stepIndex)}
            onDragOver={() => handleDragOver(stepIndex)}
            onDragEnd={handleDragEnd}
          >
            <div className="steps-editor__step-header">
              <div className="steps-editor__step-number">{step.index}</div>
              <div className="steps-editor__step-action-badge">
                {step.action || 'ACTION'}
              </div>
              <div className="steps-editor__step-summary">{step.description || ''}</div>
              <button
                type="button"
                className="steps-editor__step-copy"
                title="Copy step"
                onClick={() => handleCopyStep(stepIndex)}
              >
                <IconCopy size={16} />
              </button>
              <button
                type="button"
                className="steps-editor__step-delete"
                title="Delete step"
                onClick={() => handleDeleteStep(stepIndex)}
              >
                <IconX size={16} />
              </button>
            </div>

            <div className="steps-editor__step-fields">
              <div className="steps-editor__field steps-editor__field--action">
                <label className="steps-editor__label">ACTION *</label>
                <SearchableSelect
                  options={actionOptions}
                  value={step.action}
                  onChange={(value) => handleStepFieldChange(stepIndex, 'action', value)}
                  placeholder="Search actions..."
                  className="steps-editor__input"
                />
              </div>

              <StepFieldRenderer
                step={step}
                onFieldChange={(field, value) => handleStepFieldChange(stepIndex, field, value)}
              />
            </div>
          </div>
        ))}

        {steps.length === 0 && (
          <div className="steps-editor__empty">
            <p>No steps defined. Add a step to begin.</p>
          </div>
        )}
      </div>

      <button
        type="button"
        className="steps-editor__add-step"
        onClick={() => {
          const newStep: StepEditorState = {
            index: steps.length + 1,
            action: '',
            element: '',
            elementCategory: 'XPATH',
            value: '',
            expectedValue: '',
            description: '',
            key: '',
            headers: '',
            elementReplaceTextDataKey: '',
            isElementPathDynamic: false,
            isConcatenated: false,
            isDragging: false,
          };
          publishChanges([...steps, newStep]);
        }}
      >
        + Add Step
      </button>
    </div>
  );
}
