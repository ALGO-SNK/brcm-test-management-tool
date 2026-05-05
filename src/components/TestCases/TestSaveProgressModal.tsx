import type { ADOTestCase } from '../../types';
import { IconX } from '../Common/Icons';

export type TestSaveProgressMode = 'create' | 'update';
export type TestSaveProgressStatus = 'running' | 'success' | 'skipped' | 'error';

export interface TestSaveProgressLine {
  id: string;
  label: string;
  status: TestSaveProgressStatus;
}

interface TestSaveProgressModalProps {
  mode: TestSaveProgressMode;
  lines: TestSaveProgressLine[];
  status: TestSaveProgressStatus;
  message: string;
  testCase?: ADOTestCase | null;
  hasAutomation?: boolean;
  onClose: () => void;
  onRetry?: () => void;
  onAddAutomation?: () => void;
}

function getTitle(mode: TestSaveProgressMode, status: TestSaveProgressStatus) {
  if (status === 'running') {
    return mode === 'create' ? 'Creating test case' : 'Updating test case';
  }
  if (status === 'error') {
    return mode === 'create' ? 'Create needs attention' : 'Update needs attention';
  }
  return mode === 'create' ? 'Test case created' : 'Test case updated';
}

function getQuestion(mode: TestSaveProgressMode, hasAutomation?: boolean) {
  if (mode === 'update' && hasAutomation) {
    return 'Automation is already linked.';
  }
  return 'Add automation code now?';
}

export function TestSaveProgressModal({
  mode,
  lines,
  status,
  message,
  testCase,
  hasAutomation,
  onClose,
  onRetry,
  onAddAutomation,
}: TestSaveProgressModalProps) {
  const canAskAutomation = status === 'success' && !(mode === 'update' && hasAutomation);
  const canClose = status !== 'running';

  return (
    <div className="modal-overlay" role="presentation">
      <div className="test-save-progress" role="dialog" aria-modal="true" aria-labelledby="testSaveProgressTitle">
        <div className="test-save-progress__head">
          <div>
            <h2 id="testSaveProgressTitle">{getTitle(mode, status)}</h2>
            <p>{message}</p>
          </div>
          <button type="button" className="btn btn--ghost btn--icon" onClick={onClose} disabled={!canClose} aria-label="Close">
            <IconX size={16} />
          </button>
        </div>

        <div className="test-save-progress__body">
          {testCase && (
            <div className="test-save-progress__case">
              <span>TC {testCase.id}</span>
              <strong>{testCase.name}</strong>
            </div>
          )}

          <div className="test-save-progress__steps">
            {lines.map((line) => (
              <div className={`test-save-progress__step test-save-progress__step--${line.status}`} key={line.id}>
                <span aria-hidden="true" />
                <p>{line.label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="test-save-progress__actions">
          {status === 'error' && onRetry && (
            <button type="button" className="btn btn--primary" onClick={onRetry}>
              Retry local DB sync
            </button>
          )}
          {canAskAutomation && (
            <>
              <button type="button" className="btn btn--secondary" onClick={onClose}>
                No, close
              </button>
              <button type="button" className="btn btn--primary" onClick={onAddAutomation}>
                Yes, add automation
              </button>
            </>
          )}
          {!canAskAutomation && canClose && (
            <button type="button" className="btn btn--primary" onClick={onClose}>
              Close
            </button>
          )}
        </div>

        {status === 'success' && (
          <div className="test-save-progress__footer">{getQuestion(mode, hasAutomation)}</div>
        )}
      </div>
    </div>
  );
}
