import { useState } from 'react';
import { IconSave, IconX } from '../Common/Icons';
import type { StepData, ElementCategory } from '../../types';

interface StepFormProps {
  step: StepData;
  onSave: (step: StepData) => void;
  onCancel: () => void;
}

const ELEMENT_CATEGORIES: ElementCategory[] = [
  'XPATH', 'ID', 'TAGNAME', 'CSSSELECTOR', 'LINKTEXT', 'NAME', 'URL', 'JSPATH', 'VERIFY', 'VERIFYERROR',
];

const COMMON_ACTIONS = [
  'NAVIGATE', 'CLICK', 'ENTER_TEXT', 'CLEAR_TEXT', 'VERIFY_TEXT', 'VERIFY_ELEMENT_VISIBLE',
  'DELAY', 'TAKE_SCREENSHOT', 'HOVER', 'DOUBLE_CLICK', 'RIGHT_CLICK', 'PRESS_KEY',
  'SELECT_OPTION', 'SWITCH_TO_FRAME', 'EXECUTE_SCRIPT',
];

export function StepForm({ step, onSave, onCancel }: StepFormProps) {
  const [formData, setFormData] = useState<StepData>(step);
  const [errors, setErrors] = useState<string[]>([]);

  const handleChange = (field: keyof StepData, value: string | number | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value, updatedAt: new Date().toISOString() }));
    if (errors.length > 0) setErrors([]);
  };

  const validate = (): boolean => {
    const newErrors: string[] = [];
    if (!formData.action || formData.action.trim() === '') newErrors.push('Action is required');
    if (!formData.elementCategory) newErrors.push('Element category is required');
    if (['NAVIGATE', 'DELAY', 'TAKE_SCREENSHOT'].indexOf(formData.action) === -1) {
      if (!formData.element || formData.element.trim() === '') newErrors.push('Element is required for this action');
    }
    if (['NAVIGATE', 'ENTER_TEXT', 'DELAY', 'VERIFY_TEXT'].indexOf(formData.action) !== -1) {
      if (!formData.value || formData.value.trim() === '') newErrors.push('Value is required for this action');
    }
    setErrors(newErrors);
    return newErrors.length === 0;
  };

  const handleSave = () => {
    if (validate()) onSave(formData);
  };

  return (
    <div className="card">
      <div className="card__body">
        <h3 className="text-xl font-semibold mb-lg">Edit Step {(formData.order ?? 0) + 1}</h3>

        {errors.length > 0 && (
          <div className="alert alert--error mb-md">
            <div>
              {errors.map((err, idx) => (
                <div key={idx}>{err}</div>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-md">
          <div className="form-group">
            <label className="form-label">Action</label>
            <select
              className="form-select"
              value={formData.action}
              onChange={e => handleChange('action', e.target.value)}
            >
              {COMMON_ACTIONS.map(action => (
                <option key={action} value={action}>{action}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Element Category</label>
            <select
              className="form-select"
              value={formData.elementCategory}
              onChange={e => handleChange('elementCategory', e.target.value as ElementCategory)}
            >
              {ELEMENT_CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Element</label>
            <textarea
              className="form-textarea"
              placeholder="XPath, CSS Selector, ID, etc."
              value={formData.element}
              onChange={e => handleChange('element', e.target.value)}
              rows={2}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Value</label>
            <textarea
              className="form-textarea"
              placeholder="Value for action (text to enter, URL, etc.)"
              value={formData.value}
              onChange={e => handleChange('value', e.target.value)}
              rows={2}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Expected Value</label>
            <input
              className="form-input"
              type="text"
              placeholder="For verification actions"
              value={formData.expectedValue}
              onChange={e => handleChange('expectedValue', e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea
              className="form-textarea"
              placeholder="Step description"
              value={formData.description}
              onChange={e => handleChange('description', e.target.value)}
              rows={2}
            />
          </div>

          <div className="flex gap-sm justify-end" style={{ paddingTop: 'var(--space-md)' }}>
            <button className="btn btn--secondary" onClick={onCancel}>
              <IconX size={16} />
              Cancel
            </button>
            <button className="btn btn--primary" onClick={handleSave}>
              <IconSave size={16} />
              Save Step
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
