import { useEffect, useMemo, useState } from 'react';
import {
  IconX,
  IconPlus,
  IconRocketLaunch,
  IconCheckCircle,
  IconOpenInNew,
} from '../Common/Icons';
import { SearchableSelect } from '../Common/SearchableSelect';
import { useNotification } from '../../context/useNotification';
import {
  queueBuild,
  fetchBuildDefinitions,
  type QueuedBuildResult,
  type BuildDefinitionSummary,
} from '../../services/adoApi';

export interface QueueBuildConnection {
  organization: string;
  projectName: string;
  patToken: string;
  apiVersion: string;
}

interface QueueBuildModalProps {
  isOpen: boolean;
  onClose: () => void;
  connection: QueueBuildConnection;
  branches: DesktopGitBranch[];
  currentBranch: string | null;
  /** Seed value for the pipeline id field when nothing is remembered yet. */
  defaultDefinitionId?: number;
  onQueued?: (result: QueuedBuildResult) => void;
}

interface VarRow {
  id: string;
  key: string;
  value: string;
}

const STORAGE_KEY = 'repo-browser:queue-build';

/** Turn a branch name / "origin/foo" into a full `refs/heads/foo` ref. */
function toBranchRef(name: string | null | undefined): string {
  const trimmed = (name ?? '').trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('refs/')) return trimmed;
  // Strip a leading remote segment (origin/, upstream/, …).
  const withoutRemote = trimmed.replace(/^[^/]+\//, (m) => (trimmed.includes('/') ? '' : m));
  return `refs/heads/${withoutRemote || trimmed}`;
}

function makeRowId(): string {
  return Math.random().toString(36).slice(2, 9);
}

export function QueueBuildModal({
  isOpen,
  onClose,
  connection,
  branches,
  currentBranch,
  defaultDefinitionId = 762,
  onQueued,
}: QueueBuildModalProps) {
  const { addNotification } = useNotification();

  const [definitionId, setDefinitionId] = useState<string>(String(defaultDefinitionId));
  const [branchRef, setBranchRef] = useState<string>('');
  const [agentSpec, setAgentSpec] = useState<string>('windows-latest');
  const [vars, setVars] = useState<VarRow[]>([
    { id: makeRowId(), key: 'system.debug', value: 'false' },
  ]);
  const [isQueueing, setIsQueueing] = useState(false);
  const [result, setResult] = useState<QueuedBuildResult | null>(null);
  const [definitions, setDefinitions] = useState<BuildDefinitionSummary[]>([]);
  const [defsLoading, setDefsLoading] = useState(false);

  // Hydrate remembered values + current branch when the modal opens.
  useEffect(() => {
    if (!isOpen) return;
    let remembered: Partial<{ definitionId: number; agentSpec: string; vars: Array<{ key: string; value: string }> }> = {};
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) remembered = JSON.parse(raw);
    } catch {
      /* ignore corrupt storage */
    }
    setDefinitionId(String(remembered.definitionId ?? defaultDefinitionId));
    setAgentSpec(remembered.agentSpec ?? 'windows-latest');
    setVars(
      remembered.vars && remembered.vars.length > 0
        ? remembered.vars.map((v) => ({ id: makeRowId(), key: v.key, value: v.value }))
        : [{ id: makeRowId(), key: 'system.debug', value: 'false' }],
    );
    setBranchRef(toBranchRef(currentBranch));
    setIsQueueing(false);
    setResult(null);
  }, [isOpen, currentBranch, defaultDefinitionId]);

  // Only remote branches are buildable on the server, so hide local-only ones.
  // No `group` is set on purpose: a single grouped option renders a cramped
  // scrollbox in the shared SearchableSelect, and a lone category header is noise.
  const dedupedBranchOptions = useMemo(() => {
    const seen = new Set<string>();
    return branches
      .filter((b) => b.type === 'remote')
      .map((b) => ({
        value: toBranchRef(b.name),
        label: b.name.replace(/^[^/]+\//, ''),
      }))
      .filter((o) => {
        if (!o.value || seen.has(o.value)) return false;
        seen.add(o.value);
        return true;
      });
  }, [branches]);

  // Load the full pipeline list once per open so the picker can show names.
  useEffect(() => {
    if (!isOpen) return undefined;
    let cancelled = false;
    setDefsLoading(true);
    void fetchBuildDefinitions(connection)
      .then((defs) => {
        if (cancelled) return;
        setDefinitions(defs);
      })
      .catch(() => {
        // Non-fatal: the field still accepts a typed id (allowCustomValue).
        if (!cancelled) setDefinitions([]);
      })
      .finally(() => {
        if (!cancelled) setDefsLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // Primitive connection fields only — the parent recreates `connection`
    // every render, which would refetch the list repeatedly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isOpen,
    connection.organization,
    connection.projectName,
    connection.patToken,
    connection.apiVersion,
  ]);

  const pipelineOptions = useMemo(
    () =>
      definitions.map((d) => ({
        value: String(d.id),
        label: `${d.name || `Pipeline ${d.id}`} (#${d.id})`,
      })),
    [definitions],
  );

  if (!isOpen) return null;

  const parsedDefinitionId = Number(definitionId);
  const definitionIdValid = Number.isInteger(parsedDefinitionId) && parsedDefinitionId > 0;
  const canSubmit = definitionIdValid && Boolean(branchRef.trim()) && !isQueueing;

  const updateVar = (id: string, patch: Partial<VarRow>) => {
    setVars((rows) => rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };
  const addVarRow = () => {
    setVars((rows) => [...rows, { id: makeRowId(), key: '', value: '' }]);
  };
  const removeVarRow = (id: string) => {
    setVars((rows) => (rows.length <= 1 ? rows : rows.filter((row) => row.id !== id)));
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    const parameters: Record<string, string> = {};
    for (const row of vars) {
      const key = row.key.trim();
      if (key) parameters[key] = row.value;
    }

    setIsQueueing(true);
    try {
      const queued = await queueBuild(connection, {
        definitionId: parsedDefinitionId,
        sourceBranch: branchRef.trim(),
        agentSpecification: agentSpec.trim() || undefined,
        parameters: Object.keys(parameters).length ? parameters : undefined,
      });

      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            definitionId: parsedDefinitionId,
            agentSpec: agentSpec.trim(),
            vars: vars
              .filter((v) => v.key.trim())
              .map((v) => ({ key: v.key.trim(), value: v.value })),
          }),
        );
      } catch {
        /* non-fatal */
      }

      addNotification(
        'success',
        `Build ${queued.buildNumber} queued${queued.definitionName ? ` for ${queued.definitionName}` : ''}.`,
      );
      onQueued?.(queued);
      setResult(queued);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to queue the build.';
      addNotification('error', message);
    } finally {
      setIsQueueing(false);
    }
  };

  return (
    <div className="modal-overlay" role="presentation">
      <button
        type="button"
        className="modal-overlay__backdrop"
        onClick={() => !isQueueing && onClose()}
        aria-label="Close queue build dialog"
      />
      <div
        className="modal queue-build-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="queueBuildTitle"
      >
        <div className="modal__header">
          <div className="queue-build-modal__heading">
            <span
              className={`queue-build-modal__icon${result ? ' queue-build-modal__icon--done' : ''}`}
              aria-hidden="true"
            >
              {result ? <IconCheckCircle size={18} /> : <IconRocketLaunch size={18} />}
            </span>
            <h3 className="modal__title" id="queueBuildTitle">
              {result ? 'Build queued' : 'Queue pipeline build'}
            </h3>
          </div>
          <button
            type="button"
            className="btn btn--ghost btn--icon queue-build-modal__close"
            onClick={() => !isQueueing && onClose()}
            aria-label="Close"
          >
            <IconX size={16} />
          </button>
        </div>

        <div className="modal__body queue-build-modal__body">
          {isQueueing && (
            <div
              className="queue-build-modal__progress"
              role="progressbar"
              aria-label="Queuing build"
            >
              <span className="queue-build-modal__progress-bar" />
            </div>
          )}

          {result ? (
            <div className="queue-build-modal__result">
              <div className="queue-build-modal__result-badge" aria-hidden="true">
                <IconCheckCircle size={30} />
              </div>
              <div className="queue-build-modal__result-title">
                Build #{result.buildNumber} queued
              </div>
              <dl className="queue-build-modal__result-grid">
                {result.definitionName && (
                  <>
                    <dt>Pipeline</dt>
                    <dd>{result.definitionName}</dd>
                  </>
                )}
                <dt>Branch</dt>
                <dd>{branchRef}</dd>
                <dt>Status</dt>
                <dd>
                  <span className="queue-build-modal__status-pill">{result.status}</span>
                </dd>
              </dl>
            </div>
          ) : (
          <>
          <div className="settings-field-grid">
            <div className="settings-field">
              <span className="settings-field__label">Pipeline</span>
              <SearchableSelect
                className="queue-build-modal__pipeline-picker"
                options={pipelineOptions}
                value={definitionId}
                onChange={(value) => setDefinitionId(value.replace(/[^0-9]/g, ''))}
                placeholder={defsLoading ? 'Loading pipelines…' : 'Search pipelines'}
                emptyLabel={
                  defsLoading
                    ? 'Loading pipelines…'
                    : (definitionId ? `Pipeline #${definitionId}` : 'Select a pipeline')
                }
                allowCustomValue
              />
              {!definitionIdValid && definitionId.trim() !== '' && (
                <span className="queue-build-modal__hint queue-build-modal__hint--error">
                  Pick or enter a valid pipeline.
                </span>
              )}
            </div>

            <label className="settings-field queue-build-modal__agent-field" htmlFor="qb-agent">
              <span className="settings-field__label">Agent specification</span>
              <input
                id="qb-agent"
                className="settings-input queue-build-modal__agent-input"
                value={agentSpec}
                onChange={(e) => setAgentSpec(e.target.value)}
                placeholder="windows-latest"
              />
            </label>
          </div>

          <div className="queue-build-modal__field">
            <span className="settings-field__label">Source branch</span>
            <SearchableSelect
              className="queue-build-modal__branch-picker"
              options={dedupedBranchOptions}
              value={branchRef}
              onChange={(value) => value && setBranchRef(value)}
              placeholder="Pick a branch or type a ref"
              emptyLabel="refs/heads/master"
              allowCustomValue
            />
          </div>

          <div className="queue-build-modal__field">
            <div className="queue-build-modal__vars-head">
              <span className="settings-field__label">Queue-time variables</span>
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={addVarRow}
              >
                <IconPlus size={13} /> Add variable
              </button>
            </div>
            <div className="queue-build-modal__vars">
              {vars.map((row) => (
                <div className="queue-build-modal__var-row" key={row.id}>
                  <input
                    className="settings-input"
                    value={row.key}
                    onChange={(e) => updateVar(row.id, { key: e.target.value })}
                    placeholder="system.debug"
                    aria-label="Variable name"
                  />
                  <input
                    className="settings-input"
                    value={row.value}
                    onChange={(e) => updateVar(row.id, { value: e.target.value })}
                    placeholder="false"
                    aria-label="Variable value"
                  />
                  <button
                    type="button"
                    className="btn btn--ghost btn--icon queue-build-modal__var-remove"
                    onClick={() => removeVarRow(row.id)}
                    disabled={vars.length <= 1}
                    aria-label="Remove variable"
                    title="Remove variable"
                  >
                    <IconX size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
          </>
          )}
        </div>

        <div className="modal__footer">
          {result ? (
            <>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => setResult(null)}
              >
                Queue another
              </button>
              {result.webUrl && (
                <button
                  type="button"
                  className="btn btn--secondary"
                  onClick={() => window.open(result.webUrl, '_blank', 'noopener')}
                >
                  <IconOpenInNew size={14} />
                  Open in Azure DevOps
                </button>
              )}
              <button
                type="button"
                className="btn btn--primary"
                onClick={onClose}
              >
                Done
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => !isQueueing && onClose()}
                disabled={isQueueing}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => void handleSubmit()}
                disabled={!canSubmit}
              >
                <IconRocketLaunch size={14} />
                {isQueueing ? 'Queuing…' : 'Queue build'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
