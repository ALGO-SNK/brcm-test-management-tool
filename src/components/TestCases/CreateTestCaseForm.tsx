import React, { useState } from 'react';
import { StepsEditor } from './StepsEditor';
import { TestCaseFormFields } from './TestCaseFormFields';
import type { ParsedStep } from './StepsEditor';

interface CreateTestCaseFormProps {
  suiteName: string;
  isLoading?: boolean;
  apiError?: string | null;
  onCancel: () => void;
  onSubmit: (formData: {
    title: string;
    status: string;
    method: string;
    region: string;
    execProcess: string;
    pltpProcess: string;
    initialSteps: string;
    steps: ParsedStep[];
  }) => void;
}

export function CreateTestCaseForm({
  isLoading = false,
  apiError = null,
  onCancel,
  onSubmit,
}: CreateTestCaseFormProps) {
  const [formData, setFormData] = useState({
    title: '',
    status: 'Design',
    method: 'Selenium',
    region: 'All Region',
    execProcess: '',
    pltpProcess: '',
    initialSteps: '',
  });

  const [steps, setSteps] = useState<ParsedStep[]>([]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate required fields
    const errors: string[] = [];
    if (!formData.title.trim()) {
      errors.push('❌ Test case title is required');
    }
    if (!formData.status.trim()) {
      errors.push('❌ Status is required');
    }
    if (!formData.method.trim()) {
      errors.push('❌ Testing method is required');
    }
    if (!formData.region.trim()) {
      errors.push('❌ Region is required');
    }
    if (!formData.execProcess.trim()) {
      errors.push('❌ Executive process is required');
    }
    if (!formData.pltpProcess.trim()) {
      errors.push('❌ PLTP process area is required');
    }

    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }

    setValidationErrors([]);
    onSubmit({
      ...formData,
      steps,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="case-detail-pane case-detail-pane--edit">
      {(validationErrors.length > 0 || apiError) && (
        <div className="case-detail-edit-errors">
          {apiError && (
            <p className="case-detail-edit-error">❌ API Error: {apiError}</p>
          )}
          {validationErrors.map((error, idx) => (
            <p key={idx} className="case-detail-edit-error">{error}</p>
          ))}
        </div>
      )}

        <div className="case-detail-section__head case-detail-section__head--merged case-detail-section__head--fixed">
          <div>
            <h3>Details & Steps</h3>
          </div>
          <div className="case-detail-section__actions">
            <button
              type="submit"
              className="btn btn--primary btn--sm"
              disabled={isLoading}
            >
              {isLoading ? 'Creating...' : 'Create Test Case'}
            </button>
            <button
              type="button"
              className="btn btn--secondary btn--sm"
              onClick={onCancel}
              disabled={isLoading}
            >
              Cancel
            </button>
          </div>
        </div>

        <div className="case-detail-pane__content">
          <section className="case-detail-edit-section">
            {/* Shared Form Fields - Identical to Edit Mode */}
            <TestCaseFormFields
              formData={formData}
              onChange={(updatedData) => setFormData(prev => ({ ...prev, ...updatedData }))}
              isLoading={isLoading}
              showTitle={true}
              validationErrors={[]}
              titlePlaceholder="Enter test case title"
            />

            {/* Steps Editor - Identical to Edit Mode */}
            <StepsEditor
              rawSteps=""
              onChange={setSteps}
              errors={validationErrors.filter((e) => e.includes('step'))}
            />
          </section>
        </div>
      </form>
  );
}
