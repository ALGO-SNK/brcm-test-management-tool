import { useState, useMemo, useRef } from 'react';
import { IconX, IconCopy } from '../Common/Icons';
import { SearchableSelect } from '../Common/SearchableSelect';
import { StepFieldRenderer } from './StepFieldRenderer';
import { parseXMLSteps } from '../../utils/xmlParser';

export interface ParsedStep {
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
  isExpanded: boolean;
  isDragging: boolean;
}

interface StepsEditorProps {
  rawSteps: unknown;
  onChange: (steps: ParsedStep[]) => void;
  errors?: string[];
}

const ACTION_OPTIONS = [
  // Browser Actions
  { value: 'CLICK', label: 'CLICK' },
  { value: 'CLICK_DELAY', label: 'CLICK_DELAY' },
  { value: 'CLICK_IF_PRESENT', label: 'CLICK_IF_PRESENT' },
  { value: 'DOUBLE_CLICK', label: 'DOUBLE_CLICK' },
  { value: 'RIGHT_CLICK', label: 'RIGHT_CLICK' },
  { value: 'HOVER', label: 'HOVER' },
  { value: 'HOVER_DELAY', label: 'HOVER_DELAY' },
  { value: 'DRAG_DROP', label: 'DRAG_DROP' },
  { value: 'DRAG_DROP_BY_OFFSET', label: 'DRAG_DROP_BY_OFFSET' },
  { value: 'TYPE', label: 'TYPE' },
  { value: 'TYPE_DELAY', label: 'TYPE_DELAY' },
  { value: 'TYPE_DATE', label: 'TYPE_DATE' },
  { value: 'TYPE_RANDOM_STRING', label: 'TYPE_RANDOM_STRING' },
  { value: 'TYPE_INVISIBLE_ELEMENT', label: 'TYPE_INVISIBLE_ELEMENT' },
  { value: 'CLEAR_TEXT', label: 'CLEAR_TEXT' },
  { value: 'SELECT', label: 'SELECT' },
  { value: 'SELECT_DELAY', label: 'SELECT_DELAY' },
  { value: 'SELECT_BY_INDEX', label: 'SELECT_BY_INDEX' },
  { value: 'SCROLL_TO_TOP', label: 'SCROLL_TO_TOP' },
  { value: 'SCROLL_TO_LEFT', label: 'SCROLL_TO_LEFT' },
  { value: 'SCROLL_TO_RIGHT', label: 'SCROLL_TO_RIGHT' },
  { value: 'SCROLL_UNTIL_VISIBLE', label: 'SCROLL_UNTIL_VISIBLE' },
  { value: 'ACCEPT_ALERT', label: 'ACCEPT_ALERT' },
  { value: 'CANCEL_ALERT', label: 'CANCEL_ALERT' },
  { value: 'POPUP_TEXT', label: 'POPUP_TEXT' },

  // Verification
  { value: 'VERIFYDATA', label: 'VERIFYDATA' },
  { value: 'ISVISIBLE', label: 'ISVISIBLE' },
  { value: 'ISVISIBLE_DELAY', label: 'ISVISIBLE_DELAY' },
  { value: 'ISENABLED', label: 'ISENABLED' },
  { value: 'ISEMPTY', label: 'ISEMPTY' },
  { value: 'EQUAL', label: 'EQUAL' },
  { value: 'EQUAL_DELAY', label: 'EQUAL_DELAY' },
  { value: 'DOES_NOT_CONTAIN', label: 'DOES_NOT_CONTAIN' },
  { value: 'COMPARE_ELEMENT_VALUE_WITH_REGEX', label: 'COMPARE_ELEMENT_VALUE_WITH_REGEX' },
  { value: 'VERIFY_STYLE', label: 'VERIFY_STYLE' },
  { value: 'VERIFY_CLASS_EQUAL', label: 'VERIFY_CLASS_EQUAL' },
  { value: 'CHECKED', label: 'CHECKED' },
  { value: 'UNCHECKED', label: 'UNCHECKED' },
  { value: 'CHECK_IF_UNCHECKED', label: 'CHECK_IF_UNCHECKED' },

  // Data
  { value: 'SAVEDATA', label: 'SAVEDATA' },
  { value: 'SAVE_HARDCODE_DATA', label: 'SAVE_HARDCODE_DATA' },
  { value: 'SAVE_DATE_TIME', label: 'SAVE_DATE_TIME' },
  { value: 'CLEAR_KEYS', label: 'CLEAR_KEYS' },

  // Table/Filter
  { value: 'FILTER_BY', label: 'FILTER_BY' },
  { value: 'SORT_BY', label: 'SORT_BY' },
  { value: 'SELECT_LIST_ITEM', label: 'SELECT_LIST_ITEM' },
  { value: 'TABLE_CLICK_ROW', label: 'TABLE_CLICK_ROW' },
  { value: 'IS_COLUMN_VISIBLE', label: 'IS_COLUMN_VISIBLE' },

  // Attendance/Marks
  { value: 'ENTER_MARK', label: 'ENTER_MARK' },
  { value: 'ENTER_MARK_IF_NOT_ENTERED', label: 'ENTER_MARK_IF_NOT_ENTERED' },

  // Calculations
  { value: 'CALCULATE_PERCENTAGE', label: 'CALCULATE_PERCENTAGE' },
  { value: 'ADD_MULTIPLE_NUMBERS', label: 'ADD_MULTIPLE_NUMBERS' },
];

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

  const [steps, setSteps] = useState<StepEditorState[]>(
    parsedSteps.map((step) => {
      const hasOptionalFieldValues = !!(step.key || step.headers);
      return {
        ...step,
        isExpanded: hasOptionalFieldValues,
        isDragging: false,
      };
    })
  );

  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const dragOverIndex = useRef<number | null>(null);

  const handleStepFieldChange = (stepIndex: number, field: keyof ParsedStep, value: string) => {
    const updated = steps.map((step, idx) => {
      if (idx === stepIndex) {
        return { ...step, [field]: value };
      }
      return step;
    });
    setSteps(updated);
    onChange(updated.map(({ isExpanded, isDragging, ...step }) => step));
  };

  const handleToggleExpand = (stepIndex: number) => {
    const updated = steps.map((step, idx) => {
      if (idx === stepIndex) {
        return { ...step, isExpanded: !step.isExpanded };
      }
      return step;
    });
    setSteps(updated);
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

      // Recalculate indices
      const reindexed = updated.map((step, idx) => ({
        ...step,
        index: idx + 1,
      }));

      setSteps(reindexed);
      onChange(reindexed.map(({ isExpanded, isDragging, ...step }) => step));
    }
    setDraggedIndex(null);
    dragOverIndex.current = null;
  };

  const handleCopyStep = (stepIndex: number) => {
    const stepToCopy = steps[stepIndex];
    const copiedStep: StepEditorState = {
      ...stepToCopy,
      index: steps.length + 1,
      isExpanded: true,
      isDragging: false,
    };
    const updated = [...steps, copiedStep];
    setSteps(updated);
    onChange(updated.map(({ isExpanded, isDragging, ...step }) => step));
  };

  const handleDeleteStep = (stepIndex: number) => {
    const updated = steps
      .filter((_, idx) => idx !== stepIndex)
      .map((step, idx) => ({
        ...step,
        index: idx + 1,
      }));
    setSteps(updated);
    onChange(updated.map(({ isExpanded, isDragging, ...step }) => step));
  };

  const moreFieldsCount = (step: ParsedStep): number => {
    let count = 0;
    if (step.elementCategory) count++;
    if (step.key) count++;
    if (step.headers) count++;
    if (step.description) count++;
    return count;
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
              <div className="steps-editor__step-summary">
                {step.description || ''}
              </div>
              <button
                type="button"
                className="steps-editor__step-toggle"
                onClick={() => handleToggleExpand(stepIndex)}
              >
                {step.isExpanded ? '−' : '+'} More step fields ({moreFieldsCount(step)})
              </button>
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
              {/* Action Selection - Always visible */}
              <div className="steps-editor__field">
                <label className="steps-editor__label">ACTION *</label>
                <SearchableSelect
                  options={ACTION_OPTIONS}
                  value={step.action}
                  onChange={(value) => handleStepFieldChange(stepIndex, 'action', value)}
                  placeholder="Search actions..."
                  className="steps-editor__input"
                />
              </div>

              {/* Dynamic Fields Based on Action */}
              <StepFieldRenderer
                step={step}
                onFieldChange={(field, value) => handleStepFieldChange(stepIndex, field, String(value))}
              />

              {/* Expanded Optional Fields */}
              {step.isExpanded && (
                <>
                  <div className="steps-editor__field">
                    <label className="steps-editor__label steps-editor__label--optional">DYNAMIC LOCATOR KEY</label>
                    <input
                      type="text"
                      className="steps-editor__input"
                      style={{ fontFamily: 'var(--font-mono)' }}
                      value={step.elementReplaceTextDataKey || ''}
                      onChange={(e) => handleStepFieldChange(stepIndex, 'elementReplaceTextDataKey', e.target.value)}
                      placeholder="e.g., saved_key_1, saved_key_2"
                    />
                  </div>

                  <div className="steps-editor__field">
                    <label className="steps-editor__label steps-editor__label--optional">DYNAMIC ELEMENT PATH</label>
                    <select
                      className="steps-editor__select"
                      value={step.isElementPathDynamic ? 'true' : 'false'}
                      onChange={(e) => handleStepFieldChange(stepIndex, 'isElementPathDynamic', e.target.value)}
                    >
                      <option value="false">Static</option>
                      <option value="true">Dynamic</option>
                    </select>
                  </div>

                  <div className="steps-editor__field">
                    <label className="steps-editor__label steps-editor__label--optional">CONCATENATED COMPARE</label>
                    <select
                      className="steps-editor__select"
                      value={step.isConcatenated ? 'true' : 'false'}
                      onChange={(e) => handleStepFieldChange(stepIndex, 'isConcatenated', e.target.value)}
                    >
                      <option value="false">No</option>
                      <option value="true">Yes</option>
                    </select>
                  </div>
                </>
              )}
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
            isExpanded: false,
            isDragging: false,
          };
          const updated = [...steps, newStep];
          setSteps(updated);
          onChange(updated.map(({ isExpanded, isDragging, ...step }) => step));
        }}
      >
        + Add Step
      </button>
    </div>
  );
}
