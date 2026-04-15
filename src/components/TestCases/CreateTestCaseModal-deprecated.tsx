/*
import { useState } from 'react';
import { IconX } from '../Common/Icons';
import { CreateTestCaseForm } from './CreateTestCaseForm';
import { createTestCase } from '../../services/adoApi';
import { serializeStepsToXML } from '../../utils/xmlParser';
import type { ParsedStep } from './StepsEditor';
import type { WorkspaceSettingsValues } from '../pages/WorkspaceSettings';
import type { ADOTestCase } from '../../types';

interface CreateTestCaseModalProps {
  isOpen: boolean;
  suiteName: string;
  workspaceSettings: WorkspaceSettingsValues;
  onClose: () => void;
  onSuccess: (newCase: ADOTestCase) => void;
}

export function CreateTestCaseModal({
  isOpen,
  suiteName,
  workspaceSettings,
  onClose,
  onSuccess,
}: CreateTestCaseModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (formData: {
    title: string;
    status: string;
    method: string;
    region: string;
    execProcess: string;
    pltpProcess: string;
    initialSteps: string;
    steps: ParsedStep[];
  }) => {
    setIsLoading(true);
    setError(null);

    try {
      // Serialize steps to XML if any steps exist
      let stepsXml: string | undefined;
      if (formData.steps.length > 0) {
        stepsXml = serializeStepsToXML(
          formData.steps.map((step, idx) => ({
            id: String(idx + 1),
            action: step.action,
            element: step.element,
            elementCategory: step.elementCategory,
            value: step.value,
            expectedValue: step.expectedValue,
            key: step.key,
            headers: step.headers,
            description: step.description,
            isConcatenated: step.isConcatenated,
            isElementPathDynamic: step.isElementPathDynamic,
            elementReplaceTextDataKey: step.elementReplaceTextDataKey,
            order: idx + 1,
          })),
        );
      }

      const newCase = await createTestCase(workspaceSettings, {
        title: formData.title,
        status: formData.status,
        method: formData.method,
        region: formData.region,
        execProcess: formData.execProcess,
        pltpProcess: formData.pltpProcess,
        initialSteps: formData.initialSteps,
        stepsXml,
      });

      setIsLoading(false);
      onSuccess(newCase);
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create test case';
      setError(message);
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Create Test Case"
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'var(--color-bg)',
          borderRadius: 'var(--radius-md)',
          boxShadow: 'var(--shadow-lg)',
          maxWidth: '600px',
          width: '90%',
          maxHeight: '85vh',
          overflow: 'auto',
          padding: 'var(--space-5)',
          position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          disabled={isLoading}
          aria-label="Close"
          style={{
            position: 'absolute',
            top: 'var(--space-4)',
            right: 'var(--space-4)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 'var(--space-1)',
            color: 'var(--color-text)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <IconX size={18} />
        </button>

        {error && (
          <div
            style={{
              marginBottom: 'var(--space-4)',
              padding: 'var(--space-4)',
              backgroundColor: 'var(--color-danger-soft)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--color-danger-border)',
              color: 'var(--color-danger)',
            }}
          >
            <p style={{ margin: 0 }}>{error}</p>
          </div>
        )}

        <CreateTestCaseForm
          suiteName={suiteName}
          isLoading={isLoading}
          onCancel={onClose}
          onSubmit={handleSubmit}
        />
      </div>
    </div>
  );
}
*/
