import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import {
  IconArrowDownward,
  IconArrowRight,
  IconArrowUpward,
  IconChevronDown,
  IconCopy,
  IconPlus,
  IconTune,
  IconX,
} from '../Common/Icons';
import { SearchableSelect } from '../Common/SearchableSelect';
import { StepFieldRenderer } from './StepFieldRenderer';
import { parseXMLSteps } from '../../utils/xmlParser';
import { ACTION_REGISTRY, type ParameterContract } from '../../utils/actionRegistry';

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

export type OptionalStepField = Exclude<keyof ParsedStep, 'id' | 'index' | 'action' | 'description'>;

interface StepEditorState extends ParsedStep {
  uiId: string;
  isDragging: boolean;
  isDropTarget: boolean;
  visibleOptionalFields: OptionalStepField[];
}

interface StepsEditorProps {
  rawSteps: unknown;
  onChange: (steps: ParsedStep[]) => void;
  errors?: string[];
}

function createEditorUiId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `step-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createBlankStep(index: number): StepEditorState {
  return {
    index,
    uiId: createEditorUiId(),
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
    isDropTarget: false,
    visibleOptionalFields: [],
  };
}

function toEditorStep(step: ParsedStep): StepEditorState {
  const actionDef = ACTION_REGISTRY[step.action];
  const contract = actionDef?.contract;
  const visibleOptionalFields: OptionalStepField[] = [];

  if (contract) {
    (['elementCategory', 'element', 'value', 'expectedValue', 'key', 'headers', 'isConcatenated'] as OptionalStepField[])
      .forEach((field) => {
        const value = step[field];
        const hasValue = typeof value === 'boolean' ? value : Boolean(value?.trim());
        if (contract[field] === 'optional' && hasValue) {
          visibleOptionalFields.push(field);
        }
      });

    if (
      contract.isElementPathDynamic !== 'not-used'
      && contract.element === 'required'
      && contract.elementCategory === 'required'
      && step.isElementPathDynamic
    ) {
      visibleOptionalFields.push('isElementPathDynamic');
    }
  }

  return {
    ...step,
    uiId: createEditorUiId(),
    isDragging: false,
    isDropTarget: false,
    visibleOptionalFields,
  };
}

function sanitizeEditorSteps(updatedSteps: Array<StepEditorState | undefined>): StepEditorState[] {
  return updatedSteps
    .filter((step): step is StepEditorState => Boolean(step))
    .map((step, index) => ({
      ...step,
      index: index + 1,
      isDragging: false,
      isDropTarget: false,
    }));
}

function stripEditorMetadata(step: StepEditorState): ParsedStep {
  return {
    id: step.id,
    index: step.index,
    action: step.action,
    element: step.element,
    elementCategory: step.elementCategory,
    value: step.value,
    expectedValue: step.expectedValue,
    key: step.key,
    headers: step.headers,
    description: step.description,
    elementReplaceTextDataKey: step.elementReplaceTextDataKey,
    isElementPathDynamic: step.isElementPathDynamic,
    isConcatenated: step.isConcatenated,
  };
}

const OPTIONAL_FIELD_ORDER: OptionalStepField[] = [
  'elementCategory',
  'element',
  'value',
  'expectedValue',
  'key',
  'headers',
  'elementReplaceTextDataKey',
  'isElementPathDynamic',
  'isConcatenated',
];

const OPTIONAL_FIELD_LABELS: Partial<Record<OptionalStepField, string>> = {
  elementCategory: 'Locator type',
  element: 'Locator',
  value: 'Value',
  expectedValue: 'Expected value',
  key: 'Data key',
  headers: 'Headers',
  isConcatenated: 'Concatenated',
  isElementPathDynamic: 'Dynamic locator',
};

function getOptionalFieldsForContract(contract: ParameterContract | undefined): OptionalStepField[] {
  if (!contract) return [];

  return OPTIONAL_FIELD_ORDER.filter((field) => {
    if (field === 'elementReplaceTextDataKey') {
      return false;
    }

    if (field === 'isElementPathDynamic') {
      return contract.element === 'required'
        && contract.elementCategory === 'required'
        && contract.isElementPathDynamic !== 'not-used';
    }

    return contract[field] === 'optional';
  });
}

function reorderSteps(steps: StepEditorState[], fromIndex: number, toIndex: number): StepEditorState[] {
  if (
    fromIndex < 0 ||
    fromIndex >= steps.length ||
    toIndex < 0 ||
    toIndex >= steps.length ||
    fromIndex === toIndex
  ) {
    return sanitizeEditorSteps(steps);
  }

  const updated = [...steps];
  const [moved] = updated.splice(fromIndex, 1);
  if (!moved) return sanitizeEditorSteps(steps);

  updated.splice(toIndex, 0, moved);
  return sanitizeEditorSteps(updated);
}

function insertStepAfter(steps: StepEditorState[], stepIndex: number, stepToInsert: StepEditorState): StepEditorState[] {
  const safeIndex = Math.max(0, Math.min(stepIndex, steps.length - 1));
  const before = steps.slice(0, safeIndex + 1);
  const after = steps.slice(safeIndex + 1);
  return sanitizeEditorSteps([...before, stepToInsert, ...after]);
}

// ── Individual step card ───────────────────────────────────────────────────
interface StepItemProps {
  step: StepEditorState;
  actionOptions: { value: string; label: string }[];
  onFieldChange: (field: keyof ParsedStep, value: string | boolean) => void;
  onOptionalFieldToggle: (field: OptionalStepField, checked: boolean) => void;
  onCopy: () => void;
  onDelete: () => void;
  onDragStart: (event: DragEvent<HTMLDivElement>) => void;
  onDragOver: (event: DragEvent<HTMLDivElement>) => void;
  onDrop: (event: DragEvent<HTMLDivElement>) => void;
  onDragEnd: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}

function StepItem({
  step,
  actionOptions,
  onFieldChange,
  onOptionalFieldToggle,
  onCopy,
  onDelete,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
}: StepItemProps) {
  const [showOptionalMenu, setShowOptionalMenu] = useState(false);
  const optionalMenuRef = useRef<HTMLDivElement>(null);
  const actionDef = ACTION_REGISTRY[step.action];
  const contract = actionDef?.contract;
  const visibleOptionalCount = step.visibleOptionalFields.length;
  const optionalFields = getOptionalFieldsForContract(contract);

  useEffect(() => {
    if (!showOptionalMenu) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (optionalMenuRef.current && !optionalMenuRef.current.contains(event.target as Node)) {
        setShowOptionalMenu(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [showOptionalMenu]);

  return (
    <div
      className={`steps-editor__step${step.isDragging ? ' is-dragging' : ''}${step.isDropTarget ? ' is-drop-target' : ''}`}
      data-step-id={step.uiId}
      onDragOver={onDragOver}
      onDrop={onDrop}
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
          aria-label="Drag to reorder step"
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
        <div className="steps-editor__optional-picker" ref={optionalMenuRef}>
          <button
            type="button"
            className={`steps-editor__advanced-toggle steps-editor__advanced-toggle--compact${showOptionalMenu ? ' is-active' : ''}`}
            onClick={() => {
              setShowOptionalMenu((value) => !value);
            }}
            aria-pressed={showOptionalMenu}
            aria-haspopup="menu"
            aria-expanded={showOptionalMenu}
            title="Add optional fields"
          >
            <span className="steps-editor__advanced-toggle__icon" aria-hidden="true">
              <IconTune size={12} />
            </span>
            <span className="steps-editor__advanced-toggle__label">
              Additional Fields
            </span>
            {visibleOptionalCount > 0 && (
              <span className="steps-editor__advanced-toggle__count" aria-hidden="true">
                {visibleOptionalCount}
              </span>
            )}
            <span
              className={`steps-editor__advanced-toggle__chevron${showOptionalMenu ? ' is-open' : ''}`}
              aria-hidden="true"
            >
              <IconChevronDown size={12} />
            </span>
          </button>

          {showOptionalMenu && (
            <div className="steps-editor__optional-menu" role="menu" aria-label="Optional fields">
              {optionalFields.length > 0 ? (
                <div className="steps-editor__optional-menu-list">
                  {optionalFields.map((field) => {
                    const checked = step.visibleOptionalFields.includes(field);
                    return (
                      <label
                        key={field}
                        className={`steps-editor__optional-toggle${checked ? ' is-active' : ''}`}
                        role="menuitemcheckbox"
                        aria-checked={checked}
                      >
                        <span className="steps-editor__optional-toggle-copy">
                          <span className="steps-editor__optional-toggle-title">
                            {OPTIONAL_FIELD_LABELS[field] ?? field}
                          </span>
                        </span>
                        <input
                          type="checkbox"
                          className="steps-editor__switch"
                          role="switch"
                          checked={checked}
                          onChange={(e) => onOptionalFieldToggle(field, e.target.checked)}
                        />
                      </label>
                    );
                  })}
                </div>
              ) : (
                <div className="steps-editor__optional-menu-empty">
                  No additional fields available
                </div>
              )}
            </div>
          )}
        </div>
        <div className="steps-editor__reorder-controls" aria-label="Step reorder controls">
          <button
            type="button"
            className="steps-editor__reorder-btn"
            onClick={onMoveUp}
            disabled={!canMoveUp}
            title="Move step up"
            aria-label="Move step up"
          >
            <IconArrowUpward size={12} />
          </button>
          <button
            type="button"
            className="steps-editor__reorder-btn"
            onClick={onMoveDown}
            disabled={!canMoveDown}
            title="Move step down"
            aria-label="Move step down"
          >
            <IconArrowDownward size={12} />
          </button>
        </div>



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
      <div className="steps-editor__step-fields" id={`step-advanced-fields-${step.uiId}`}>
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
          visibleOptionalFields={step.visibleOptionalFields}
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
  const [deleteTargetIndex, setDeleteTargetIndex] = useState<number | null>(null);

  const publishChanges = (updatedSteps: StepEditorState[]) => {
    const nextSteps = sanitizeEditorSteps(updatedSteps);
    setSteps(nextSteps);
    onChange(nextSteps.map(stripEditorMetadata));
  };

  const handleStepFieldChange = (
    stepIndex: number,
    field: keyof ParsedStep,
    value: string | boolean,
  ) => {
    publishChanges(
      steps.map((step, idx) => {
        if (idx !== stepIndex) return step;
        const nextStep: StepEditorState = { ...step, [field]: value } as StepEditorState;
        if (field === 'action') {
          nextStep.visibleOptionalFields = [];
        }
        return nextStep;
      }),
    );
  };

  const handleOptionalFieldToggle = (stepIndex: number, field: OptionalStepField, checked: boolean) => {
    publishChanges(
      steps.map((step, idx) => {
        if (idx !== stepIndex) return step;

        const nextVisibleFields = new Set(step.visibleOptionalFields);
        if (checked) {
          nextVisibleFields.add(field);
        } else {
          nextVisibleFields.delete(field);
        }

        const nextStep: StepEditorState = {
          ...step,
          visibleOptionalFields: Array.from(nextVisibleFields) as OptionalStepField[],
        };

        if (field === 'isElementPathDynamic') {
          nextStep.isElementPathDynamic = checked;
        }

        return nextStep;
      }),
    );
  };

  const handleDragStart = (stepIndex: number, event: DragEvent<HTMLDivElement>) => {
    setDraggedIndex(stepIndex);
    dragOverIndex.current = stepIndex;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', String(stepIndex));
    setSteps((current) =>
      current.map((step, idx) => ({
        ...step,
        isDragging: idx === stepIndex,
        isDropTarget: idx === stepIndex,
      })),
    );
  };

  const handleDragOver = (stepIndex: number, event: DragEvent<HTMLDivElement>) => {
    if (draggedIndex === null) return;
    event.preventDefault();
    dragOverIndex.current = stepIndex;
    setSteps((current) =>
      current.map((step, idx) => ({
        ...step,
        isDragging: idx === draggedIndex,
        isDropTarget: idx === stepIndex && idx !== draggedIndex,
      })),
    );
  };

  const handleDrop = (stepIndex: number, event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (draggedIndex === null) return;

    publishChanges(reorderSteps(steps, draggedIndex, stepIndex));
    setDraggedIndex(null);
    dragOverIndex.current = null;
  };

  const handleDragEnd = () => {
    if (draggedIndex !== null && dragOverIndex.current !== null && draggedIndex !== dragOverIndex.current) {
      publishChanges(reorderSteps(steps, draggedIndex, dragOverIndex.current));
    }
    setDraggedIndex(null);
    dragOverIndex.current = null;
  };

  const handleMoveStep = (stepIndex: number, direction: -1 | 1) => {
    const targetIndex = stepIndex + direction;
    publishChanges(reorderSteps(steps, stepIndex, targetIndex));
  };

  const handleCopyStep = (stepIndex: number) => {
    if (!steps[stepIndex]) return;
    const copy: StepEditorState = {
      ...steps[stepIndex],
      index: stepIndex + 2,
      uiId: createEditorUiId(),
      isDragging: false,
      isDropTarget: false,
    };
    publishChanges(insertStepAfter(steps, stepIndex, copy));
  };

  const handleDeleteStep = (stepIndex: number) => {
    if (!steps[stepIndex]) return;
    setDeleteTargetIndex(stepIndex);
  };

  const confirmDeleteStep = () => {
    if (deleteTargetIndex === null) return;

    publishChanges(
      steps
        .filter((_, idx) => idx !== deleteTargetIndex)
        .map((step, idx) => ({ ...step, index: idx + 1 })),
    );
    setDeleteTargetIndex(null);
  };

  const cancelDeleteStep = () => {
    setDeleteTargetIndex(null);
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
            key={step.uiId}
            step={step}
            actionOptions={actionOptions}
            onFieldChange={(field, value) => handleStepFieldChange(stepIndex, field, value)}
            onOptionalFieldToggle={(field, checked) => handleOptionalFieldToggle(stepIndex, field, checked)}
            onCopy={() => handleCopyStep(stepIndex)}
            onDelete={() => handleDeleteStep(stepIndex)}
            onDragStart={(event) => handleDragStart(stepIndex, event)}
            onDragOver={(event) => handleDragOver(stepIndex, event)}
            onDrop={(event) => handleDrop(stepIndex, event)}
            onDragEnd={handleDragEnd}
            onMoveUp={() => handleMoveStep(stepIndex, -1)}
            onMoveDown={() => handleMoveStep(stepIndex, 1)}
            canMoveUp={stepIndex > 0}
            canMoveDown={stepIndex < steps.length - 1}
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
          publishChanges([...steps, createBlankStep(steps.length + 1)]);
        }}
        aria-label="Add a new step"
        title="Add a new step"
      >
        <span className="steps-editor__add-step-icon" aria-hidden="true">
          <IconPlus size={16} />
        </span>
        <span className="steps-editor__add-step-copy">
          <strong>Add step</strong>
          <span>Insert a new action at the end</span>
        </span>
        <span className="steps-editor__add-step-chevron" aria-hidden="true">
          <IconArrowRight size={14} />
        </span>
      </button>

      {deleteTargetIndex !== null && steps[deleteTargetIndex] && (
        <div className="steps-editor__confirm-overlay" role="dialog" aria-modal="true" aria-label="Delete step confirmation">
          <button
            type="button"
            className="steps-editor__confirm-backdrop"
            onClick={cancelDeleteStep}
            aria-label="Close delete confirmation"
          />
          <div className="steps-editor__confirm-card steps-editor__confirm-card--danger" role="document">
            <div className="steps-editor__confirm-head">
              <div>
                <p className="steps-editor__confirm-kicker steps-editor__confirm-kicker--danger">Delete step</p>
                <h3 className="steps-editor__confirm-title steps-editor__confirm-title--danger">
                  Remove Step {steps[deleteTargetIndex].index}?
                </h3>
              </div>
              <button
                type="button"
                className="steps-editor__confirm-close"
                onClick={cancelDeleteStep}
                aria-label="Close delete confirmation"
                title="Close"
              >
                <IconX size={16} />
              </button>
            </div>

            <p className="steps-editor__confirm-copy">
              {steps[deleteTargetIndex].action
                ? <>This will delete <strong>{steps[deleteTargetIndex].action}</strong> from the step list.</>
                : 'This will delete the selected step from the list.'}
            </p>

            <div className="steps-editor__confirm-meta">
              <span className="steps-editor__confirm-meta-label">Summary</span>
              <strong className="steps-editor__confirm-meta-value">
                {steps[deleteTargetIndex].description || 'No summary provided'}
              </strong>
            </div>

            <div className="steps-editor__confirm-actions">
              <button type="button" className="btn btn--secondary btn--sm" onClick={cancelDeleteStep}>
                Keep step
              </button>
              <button type="button" className="btn btn--danger btn--sm" onClick={confirmDeleteStep}>
                Delete step
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
