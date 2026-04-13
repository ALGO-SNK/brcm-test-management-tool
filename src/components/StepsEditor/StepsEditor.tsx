import { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { StepData, ADOTestCase } from '../../types';
import { StepsList } from './StepsList';
import { StepForm } from './StepForm';
import { fetchStepsForCase, saveSteps } from '../../mock/handlers';
import { useNotification } from '../../context/useNotification';
import { IconPlus, IconSave, IconDownload } from '../Common/Icons';

interface StepsEditorProps {
  testCase: ADOTestCase;
  onSaved: () => void;
}

export function StepsEditor({ testCase, onSaved }: StepsEditorProps) {
  const [steps, setSteps] = useState<StepData[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasChanges, setHasChanges] = useState(false);
  const { addNotification } = useNotification();

  useEffect(() => {
    const loadSteps = async () => {
      try {
        setLoading(true);
        const data = await fetchStepsForCase(testCase.id);
        setSteps(data);
        setHasChanges(false);
      } catch (err) {
        addNotification('error', `Failed to load steps: ${err instanceof Error ? err.message : 'Unknown error'}`);
      } finally {
        setLoading(false);
      }
    };
    loadSteps();
  }, [testCase.id, addNotification]);

  const handleAddStep = () => {
    const newStep: StepData = {
      id: uuidv4(),
      action: 'CLICK',
      element: '',
      elementCategory: 'XPATH',
      value: '',
      expectedValue: '',
      key: '',
      headers: '',
      description: '',
      stepDescription: '',
      isConcatenated: false,
      isElementPathDynamic: false,
      elementReplaceTextDataKey: '',
      extraFields: {},
      order: steps.length,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setSteps([...steps, newStep]);
    setSelectedIndex(steps.length);
    setHasChanges(true);
    addNotification('info', 'New step added');
  };

  const handleSelectStep = (_step: StepData, index: number) => {
    setSelectedIndex(index);
  };

  const handleDeleteStep = (index: number) => {
    const newSteps = steps.filter((_, idx) => idx !== index);
    setSteps(newSteps);
    if (selectedIndex === index) {
      setSelectedIndex(newSteps.length > 0 ? 0 : null);
    }
    setHasChanges(true);
    addNotification('info', 'Step deleted');
  };

  const handleDuplicateStep = (index: number) => {
    const _stepToDuplicate = steps[index];
    const duplicated: StepData = {
      ..._stepToDuplicate,
      id: uuidv4(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const newSteps = [...steps];
    newSteps.splice(index + 1, 0, duplicated);
    newSteps.forEach((step, idx) => { step.order = idx; });
    setSteps(newSteps);
    setHasChanges(true);
    addNotification('success', 'Step duplicated');
  };

  const handleSaveStep = (updatedStep: StepData) => {
    if (selectedIndex === null) return;
    const newSteps = [...steps];
    newSteps[selectedIndex] = updatedStep;
    setSteps(newSteps);
    setHasChanges(true);
    addNotification('success', 'Step updated');
  };

  const handleSaveAllSteps = async () => {
    try {
      const orderedSteps = steps.map((step, idx) => ({ ...step, order: idx }));
      await saveSteps(testCase.id, orderedSteps);
      setHasChanges(false);
      addNotification('success', `Saved ${orderedSteps.length} steps`);
      onSaved();
    } catch (err) {
      addNotification('error', `Failed to save steps: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleExportSteps = () => {
    const csv = [
      ['Order', 'Action', 'Element', 'Category', 'Value', 'Expected', 'Description'].join(','),
      ...steps.map(s =>
        [(s.order ?? 0) + 1, s.action, `"${s.element}"`, s.elementCategory, `"${s.value}"`, `"${s.expectedValue}"`, `"${s.description}"`].join(',')
      ),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${testCase.name.replace(/\s+/g, '_')}_steps.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (loading) {
    return <div className="loading-center"><div className="spinner" /></div>;
  }

  return (
    <div>
      {hasChanges && (
        <div className="alert alert--info mb-md">You have unsaved changes</div>
      )}

      <div className="section-header mb-md">
        <h3 className="text-xl font-semibold">Steps ({steps.length})</h3>
        <div className="flex gap-sm">
          <button className="btn btn--ghost btn--sm" onClick={handleExportSteps}>
            <IconDownload size={14} />
            Export CSV
          </button>
          <button
            className="btn btn--primary btn--sm"
            onClick={handleSaveAllSteps}
            disabled={!hasChanges}
          >
            <IconSave size={14} />
            Save All
          </button>
        </div>
      </div>

      <div className="steps-layout">
        <div>
          <StepsList
            steps={steps}
            onSelectStep={handleSelectStep}
            onDeleteStep={handleDeleteStep}
            onAddStep={handleAddStep}
            onDuplicateStep={handleDuplicateStep}
            selectedIndex={selectedIndex}
          />
        </div>

        <div>
          {selectedIndex !== null && selectedIndex < steps.length ? (
            <StepForm
              key={steps[selectedIndex].id}
              step={steps[selectedIndex]}
              onSave={handleSaveStep}
              onCancel={() => setSelectedIndex(null)}
            />
          ) : (
            <div className="card">
              <div className="card__body text-center" style={{ padding: 'var(--space-xl)' }}>
                <p className="text-secondary mb-md">Select a step to edit or add a new one</p>
                <button className="btn btn--primary" onClick={handleAddStep}>
                  <IconPlus size={16} />
                  Add First Step
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
