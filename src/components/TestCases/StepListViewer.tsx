/**
 * Step List Viewer
 * Displays test steps in read-only view mode
 */

/**
 * Step List Viewer
 * Displays test steps in read-only view mode
 */
import type {ParsedStep} from './StepsEditor';
import { ACTION_REGISTRY } from '../../utils/actionRegistry';

interface StepListViewerProps {
  steps: ParsedStep[];
}

function getActionLabel(actionName: string): string {
  const definition = ACTION_REGISTRY[actionName];
  return definition?.description || actionName;
}

// function getActionCategory(actionName: string): string {
//   const definition = ACTION_REGISTRY[actionName];
//   return definition?.category || 'unknown';
// }

function formatParameterValue(value: string | boolean | undefined): string {
  if (!value) return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'string' && value.length > 50) {
    return value.substring(0, 47) + '...';
  }
  return String(value);
}

export function StepListViewer({ steps }: StepListViewerProps) {
  if (steps.length === 0) {
    return (
      <div className="steps-viewer">
        <div className="steps-viewer__empty">
          <p>No steps defined</p>
        </div>
      </div>
    );
  }

  return (
    <div className="steps-viewer">
      <div className="steps-viewer__list">
        {steps.map((step) => (
          <div key={`step-${step.index}`} className="steps-viewer__step">
            {/* Step Header */}
            <div className="steps-viewer__step-header">
              <div className="steps-viewer__step-number">{step.index}</div>

              <div className="steps-viewer__step-action">
                <div className="steps-viewer__action-badge">
                  {step.action || 'ACTION'}
                </div>
                <div className="steps-viewer__action-description">
                  {getActionLabel(step.action)}
                </div>
              </div>

              {step.description && (
                <div className="steps-viewer__step-summary">
                  {step.description}
                </div>
              )}
            </div>

            {/* Step Details */}
            <div className="steps-viewer__step-details">
              {/* Element Information */}
              {(step.element || step.elementCategory) && (
                <div className="steps-viewer__detail-group">
                  <h4 className="steps-viewer__detail-label">Locator</h4>
                  <div className="steps-viewer__detail-row">
                    <span className="steps-viewer__detail-name">Type:</span>
                    <span className="steps-viewer__detail-value">{step.elementCategory || 'XPATH'}</span>
                  </div>
                  {step.element && (
                    <div className="steps-viewer__detail-row">
                      <span className="steps-viewer__detail-name">Selector:</span>
                      <code className="steps-viewer__detail-value">{step.element}</code>
                    </div>
                  )}
                  {step.isElementPathDynamic && (
                    <div className="steps-viewer__detail-row">
                      <span className="steps-viewer__detail-name">Dynamic:</span>
                      <span className="steps-viewer__detail-value">Yes</span>
                    </div>
                  )}
                  {step.elementReplaceTextDataKey && (
                    <div className="steps-viewer__detail-row">
                      <span className="steps-viewer__detail-name">Replace Key:</span>
                      <code className="steps-viewer__detail-value">{step.elementReplaceTextDataKey}</code>
                    </div>
                  )}
                </div>
              )}

              {/* Action Parameters */}
              {(step.value || step.expectedValue) && (
                <div className="steps-viewer__detail-group">
                  <h4 className="steps-viewer__detail-label">Parameters</h4>
                  {step.value && (
                    <div className="steps-viewer__detail-row">
                      <span className="steps-viewer__detail-name">Value:</span>
                      <span className="steps-viewer__detail-value">{formatParameterValue(step.value)}</span>
                    </div>
                  )}
                  {step.expectedValue && (
                    <div className="steps-viewer__detail-row">
                      <span className="steps-viewer__detail-name">Expected:</span>
                      <span className="steps-viewer__detail-value">{formatParameterValue(step.expectedValue)}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Data Store Keys */}
              {(step.key || step.headers) && (
                <div className="steps-viewer__detail-group">
                  <h4 className="steps-viewer__detail-label">Data & Headers</h4>
                  {step.key && (
                    <div className="steps-viewer__detail-row">
                      <span className="steps-viewer__detail-name">Data Key:</span>
                      <code className="steps-viewer__detail-value">{step.key}</code>
                    </div>
                  )}
                  {step.headers && (
                    <div className="steps-viewer__detail-row">
                      <span className="steps-viewer__detail-name">Headers:</span>
                      <code className="steps-viewer__detail-value">{step.headers}</code>
                    </div>
                  )}
                </div>
              )}

              {/* Flags */}
              {(step.isConcatenated) && (
                <div className="steps-viewer__detail-group">
                  <h4 className="steps-viewer__detail-label">Flags</h4>
                  {step.isConcatenated && (
                    <div className="steps-viewer__detail-row">
                      <span className="steps-viewer__detail-name">Concatenated:</span>
                      <span className="steps-viewer__detail-value">Yes</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="steps-viewer__footer">
        <div className="steps-viewer__summary">
          <span className="steps-viewer__summary-label">Total Steps:</span>
          <span className="steps-viewer__summary-value">{steps.length}</span>
        </div>
      </div>
    </div>
  );
}
