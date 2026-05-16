import { TestCaseFormFields } from './TestCaseFormFields';
import {
  StepsEditor,
  type StepsEditorSearchController,
} from './StepsEditor';
import type { useTestCaseEditor } from './useTestCaseEditor';
import type { WorkspaceSettingsValues } from '../pages/WorkspaceSettings';

interface TestCaseEditorBodyProps {
  editor: ReturnType<typeof useTestCaseEditor>;
  /** Steps XML used to seed the StepsEditor for this edit session. */
  rawStepsXml: unknown;
  workspaceSettings: WorkspaceSettingsValues;
  planId?: number;
  /** Optional external steps search controller (page-level search bar). */
  stepsSearch?: StepsEditorSearchController;
  onPreviewSharedStep?: (testId: string) => void;
  showValidationSummary?: boolean;
}

/**
 * Shared edit surface (form fields + steps editor) wired to {@link useTestCaseEditor}.
 * Used by both the test-case detail edit mode and the shared-step editor modal,
 * so the editing UI/behavior is defined exactly once.
 */
export function TestCaseEditorBody({
  editor,
  rawStepsXml,
  workspaceSettings,
  planId,
  stepsSearch,
  onPreviewSharedStep,
  showValidationSummary = true,
}: TestCaseEditorBodyProps) {
  return (
    <section className="case-detail-edit-section">
      <TestCaseFormFields
        formData={editor.formData}
        onChange={(updatedData) =>
          editor.setFormData((prev) => ({ ...prev, ...updatedData }))
        }
        isLoading={editor.isSaving}
        showTitle
        validationErrors={editor.validationErrors}
        showValidationSummary={showValidationSummary}
        titlePlaceholder="Enter test case title"
        workspaceSettings={workspaceSettings}
        planId={planId}
      />

      <StepsEditor
        rawSteps={rawStepsXml}
        onChange={editor.setSteps}
        errors={editor.validationErrors.filter((e) => e.toLowerCase().includes('step'))}
        hideHeader
        externalSearch={stepsSearch}
        onPreviewSharedStep={onPreviewSharedStep}
      />
    </section>
  );
}
