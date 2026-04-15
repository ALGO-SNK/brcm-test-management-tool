import { useMemo, useRef, useState } from 'react';
import { IconCopy, IconX } from '../Common/Icons';
import { SearchableSelect } from '../Common/SearchableSelect';
import { StepFieldRenderer } from './StepFieldRenderer';
import { parseXMLSteps } from '../../utils/xmlParser';
import { ACTION_REGISTRY } from '../../utils/actionRegistry';

export interface ParsedStep {
  id?: string;
  index: number;
  action: string;
  element?: string;
  elementCategory?: string;
  value?: string;
  expectedValue?: string;
  key?: string;
  headers?: string;
  description?: string;
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

// ── Per-step toggle icon (three sliders icon) ──────────────────────────────
function IconSliders({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="2" y1="4" x2="14" y2="4" />
      <circle cx="5" cy="4" r="1.5" fill="currentColor" stroke="none" />
      <line x1="2" y1="8" x2="14" y2="8" />
      <circle cx="11" cy="8" r="1.5" fill="currentColor" stroke="none" />
      <line x1="2" y1="12" x2="14" y2="12" />
      <circle cx="5" cy="12" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

function toEditorStep(step: ParsedStep): StepEditorState {
  return { ...step, isDragging: false };
}

// ── Individual step card ───────────────────────────────────────────────────
interface StepItemProps {
  step: StepEditorState;
  actionOptions: { value: string; label: string }[];
  onFieldChange: (field: keyof ParsedStep, value: string | boolean) => void;
  onCopy: () => void;
  onDelete: () => void;
  onDragStart: () => void;
  onDragOver: () => void;
  onDragEnd: () => void;
}

function StepItem({
  step,
  actionOptions,
  onFieldChange,
  onCopy,
  onDelete,
  onDragStart,
  onDragOver,
  onDragEnd,
}: StepItemProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Count filled optional field values so the toggle can show a hint
  const optionalFilled = [step.expectedValue, step.key, step.headers, step.isConcatenated]
    .filter(Boolean).length;

  return (
    <div
      className={`steps-editor__step${step.isDragging ? ' is-dragging' : ''}`}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
    >
      {/* ── Step header ─────────────────────────────────────────────────── */}
      <div className="steps-editor__step-header">
        {/* Drag handle - only this area can be dragged */}
        <div
          className="steps-editor__drag-handle"
          draggable
          onDragStart={onDragStart}
          title="Drag to reorder steps"
        >
          <span className="material-symbols">drag_indicator</span>
        </div>

        <div className="steps-editor__step-number">{step.index}</div>

        <div className="steps-editor__step-action-badge">
          {step.action || 'ACTION'}
        </div>

        <div className="steps-editor__step-summary">
          {step.description || ''}
        </div>

        {/* Optional-fields toggle */}
        <button
          type="button"
          className={`steps-editor__advanced-toggle${showAdvanced ? ' is-active' : ''}`}
          title={showAdvanced ? 'Hide optional fields' : 'Show optional fields'}
          onClick={() => setShowAdvanced((v) => !v)}
          aria-pressed={showAdvanced}
        >
          <IconSliders size={13} />
          {optionalFilled > 0 && !showAdvanced && (
            <span className="steps-editor__advanced-dot" aria-hidden="true" />
          )}
        </button>

        <button
          type="button"
          className="steps-editor__step-copy"
          title="Duplicate step"
          onClick={onCopy}
        >
          <IconCopy size={16} />
        </button>

        <button
          type="button"
          className="steps-editor__step-delete"
          title="Delete step"
          onClick={onDelete}
        >
          <IconX size={16} />
        </button>
      </div>

      {/* ── Fields grid ─────────────────────────────────────────────────── */}
      <div className="steps-editor__step-fields">
        {/* Action — col 1 */}
        <div className="steps-editor__field steps-editor__field--action">
          <label className="steps-editor__label">ACTION *</label>
          <SearchableSelect
            options={actionOptions}
            value={step.action}
            onChange={(value) => onFieldChange('action', value)}
            placeholder="Search actions…"
            className="steps-editor__input"
          />
        </div>

        {/* Remaining fields rendered by StepFieldRenderer (col 2-3 starts with Summary) */}
        <StepFieldRenderer
          step={step}
          onFieldChange={onFieldChange}
          showAdvanced={showAdvanced}
        />
      </div>
    </div>
  );
}

// ── Main StepsEditor ───────────────────────────────────────────────────────
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
    return steps.map((step, idx) => ({ ...step, index: idx + 1 }));
  }, [input]);

  const actionOptions = useMemo(
    () =>
      Object.values(ACTION_REGISTRY)
        .map((action) => ({ value: action.name, label: action.name }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [],
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
    publishChanges(
      steps.map((step, idx) => (idx === stepIndex ? { ...step, [field]: value } : step)),
    );
  };

  const handleDragStart = (stepIndex: number) => setDraggedIndex(stepIndex);
  const handleDragOver  = (stepIndex: number) => { dragOverIndex.current = stepIndex; };

  const handleDragEnd = () => {
    if (
      draggedIndex !== null &&
      dragOverIndex.current !== null &&
      draggedIndex !== dragOverIndex.current
    ) {
      const updated = [...steps];
      const [dragged] = updated.splice(draggedIndex, 1);
      updated.splice(dragOverIndex.current, 0, dragged);
      publishChanges(updated.map((step, idx) => ({ ...step, index: idx + 1 })));
    }
    setDraggedIndex(null);
    dragOverIndex.current = null;
  };

  const handleCopyStep = (stepIndex: number) => {
    const copy: StepEditorState = {
      ...steps[stepIndex],
      index: steps.length + 1,
      isDragging: false,
    };
    publishChanges([...steps, copy]);
  };

  const handleDeleteStep = (stepIndex: number) => {
    const step = steps[stepIndex];
    const confirmDelete = window.confirm(
      `Are you sure you want to delete Step ${step.index}?\n\nAction: ${step.action || 'Unknown'}\n\nThis action cannot be undone.`
    );

    if (!confirmDelete) return;

    publishChanges(
      steps
        .filter((_, idx) => idx !== stepIndex)
        .map((step, idx) => ({ ...step, index: idx + 1 })),
    );
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
          <StepItem
            key={`step-${stepIndex}`}
            step={step}
            actionOptions={actionOptions}
            onFieldChange={(field, value) => handleStepFieldChange(stepIndex, field, value)}
            onCopy={() => handleCopyStep(stepIndex)}
            onDelete={() => handleDeleteStep(stepIndex)}
            onDragStart={() => handleDragStart(stepIndex)}
            onDragOver={() => handleDragOver(stepIndex)}
            onDragEnd={handleDragEnd}
          />
        ))}

        {steps.length === 0 && (
          <div className="steps-editor__empty">
            <p>No steps yet. Click <strong>+ Add Step</strong> to begin.</p>
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
            elementCategory: '',
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
