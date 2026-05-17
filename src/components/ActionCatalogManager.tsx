import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { createPortal } from 'react-dom';
import { IconPlus, IconSave, IconX, IconMoreHoriz, IconSearch, IconDownload, IconAttachFile } from './Common/Icons';
import { useNotification } from '../context/useNotification';
import { actionsToCsv, parseActionsCsv } from '../utils/actionCatalogCsv';
import './ActionCatalogManager.css';

interface Action {
  action_key: string;
  label: string;
  description?: string;
  category: string;
  contract: Record<string, 'required' | 'optional' | 'not-used'>;
  is_deprecated: number;
  is_user_modified: number;
  created_by?: string;
  created_at: string;
  updated_by?: string;
  updated_at: string;
}

interface ActionFormData {
  actionKey: string;
  label: string;
  description: string;
  category: string;
  contract: Record<string, 'required' | 'optional' | 'not-used'>;
}

const CATEGORIES = [
  'attendance', 'browser', 'business', 'compare', 'date',
  'element', 'list', 'table', 'xml', 'custom'
];

const CONTRACT_FIELDS = [
  'locator', 'locatorType', 'value', 'expectedVl', 'dataKey',
  'headers', 'elementPathReplaceKey', 'isElementPathDynamic', 'isConcatenated'
];

export function ActionCatalogManager() {
  const [actions, setActions] = useState<Action[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedAction, setSelectedAction] = useState<Action | null>(null);
  const [filter, setFilter] = useState<{ deprecated?: boolean }>({});
  const [search, setSearch] = useState('');
  const [menuOpenKey, setMenuOpenKey] = useState<string | null>(null);
  const [formData, setFormData] = useState<ActionFormData>({
    actionKey: '',
    label: '',
    description: '',
    category: 'custom',
    contract: {},
  });
  const [busy, setBusy] = useState(false);
  const { addNotification } = useNotification();
  const menuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadActions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!menuOpenKey) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpenKey(null);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [menuOpenKey]);

  const loadActions = async () => {
    if (!window.desktop?.listActions) return;

    try {
      setLoading(true);
      const allActions = await window.desktop.listActions({
        includeDeprecated: filter.deprecated !== false
      });

      setActions(allActions);
    } catch (error) {
      addNotification('error', `Failed to load actions: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAction = () => {
    setSelectedAction(null);
    setFormData({
      actionKey: '',
      label: '',
      description: '',
      category: 'custom',
      contract: CONTRACT_FIELDS.reduce((acc, field) => {
        acc[field] = 'not-used';
        return acc;
      }, {} as Record<string, 'required' | 'optional' | 'not-used'>),
    });
    setShowForm(true);
  };

  const handleEditAction = (action: Action) => {
    setMenuOpenKey(null);
    setSelectedAction(action);
    setFormData({
      actionKey: action.action_key,
      label: action.label,
      description: action.description || '',
      category: action.category,
      contract: action.contract,
    });
    setShowForm(true);
  };

  const handleSaveAction = async () => {
    if (!window.desktop?.updateAction || !window.desktop?.createAction) return;

    try {
      if (!formData.actionKey || !formData.label || !formData.category) {
        addNotification('error', 'Action key, label, and category are required');
        return;
      }

      if (selectedAction) {
        await window.desktop.updateAction(selectedAction.action_key, {
          label: formData.label,
          description: formData.description,
          category: formData.category,
          contract: formData.contract,
        });
        addNotification('success', `Updated action: ${formData.actionKey}`);
      } else {
        await window.desktop.createAction({
          actionKey: formData.actionKey,
          label: formData.label,
          description: formData.description,
          category: formData.category,
          contract: formData.contract,
        });
        addNotification('success', `Created action: ${formData.actionKey}`);
      }

      setShowForm(false);
      await loadActions();
    } catch (error) {
      addNotification('error', `Failed to save action: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleDeprecateAction = async (action: Action) => {
    setMenuOpenKey(null);
    if (!window.desktop?.deprecateAction) return;

    try {
      await window.desktop.deprecateAction(action.action_key, !action.is_deprecated);
      addNotification('success', action.is_deprecated ? 'Action restored' : 'Action deprecated');
      await loadActions();
    } catch (error) {
      addNotification('error', `Failed to deprecate action: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleDeleteAction = async (action: Action) => {
    setMenuOpenKey(null);
    if (!window.desktop?.deleteAction) return;

    if (!confirm(`Delete action "${action.action_key}"? This cannot be undone.`)) {
      return;
    }

    try {
      await window.desktop.deleteAction(action.action_key);
      addNotification('success', `Deleted action: ${action.action_key}`);
      await loadActions();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      addNotification('error', `Failed to delete action: ${message}`);
    }
  };

  const handleExportCsv = async () => {
    if (!window.desktop?.listActions) return;
    try {
      setBusy(true);
      // Export the full catalog, ignoring UI filters, for a complete transfer.
      const all = await window.desktop.listActions({ includeDeprecated: true });
      const csv = actionsToCsv(all);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const stamp = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `action-catalog-${stamp}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      addNotification('success', `Exported ${all.length} actions to CSV`);
    } catch (error) {
      addNotification('error', `Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setBusy(false);
    }
  };

  const handleImportFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!window.desktop?.createAction || !window.desktop?.updateAction || !window.desktop?.listActions) {
      addNotification('error', 'Import is not available in this environment');
      return;
    }

    try {
      setBusy(true);
      const text = await file.text();
      const { rows, errors } = parseActionsCsv(text);

      if (rows.length === 0) {
        addNotification('error', `No valid rows found. ${errors[0] ?? ''}`);
        return;
      }

      const existing = await window.desktop.listActions({ includeDeprecated: true });
      const existingKeys = new Set(existing.map((a) => a.action_key.toUpperCase()));

      let created = 0;
      let updated = 0;
      let failed = 0;

      for (const row of rows) {
        try {
          if (existingKeys.has(row.action_key)) {
            await window.desktop.updateAction(row.action_key, {
              label: row.label,
              description: row.description,
              category: row.category,
              contract: row.contract,
            });
            updated++;
          } else {
            await window.desktop.createAction({
              actionKey: row.action_key,
              label: row.label,
              description: row.description,
              category: row.category,
              contract: row.contract,
            });
            created++;
          }
        } catch {
          failed++;
        }
      }

      await loadActions();
      const summary = `Import complete: ${created} added, ${updated} updated${failed ? `, ${failed} failed` : ''}`;
      addNotification(failed ? 'error' : 'success', summary);
    } catch (error) {
      addNotification('error', `Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setBusy(false);
    }
  };

  const visibleActions = actions.filter((a) =>
    a.action_key.toLowerCase().includes(search.trim().toLowerCase())
  );

  if (loading) {
    return (
      <div className="plans-table-shell action-catalog">
        <div className="empty-state">
          <p className="empty-state__title">Loading actions…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="plans-table-shell action-catalog">
      <div className="cases-toolbar">
        <div className="cases-toolbar__search">
          <IconSearch size={15} className="cases-toolbar__search-icon" />
          <input
            type="text"
            className="cases-toolbar__search-input"
            placeholder="Search action key..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="cases-toolbar__filters">
          <label className="checkbox-inline">
            <input
              type="checkbox"
              checked={filter.deprecated === false}
              onChange={(e) => setFilter({ ...filter, deprecated: e.target.checked ? false : undefined })}
            />
            Hide deprecated
          </label>

          <button
            type="button"
            className="btn btn--secondary btn--sm"
            onClick={handleExportCsv}
            disabled={busy}
            title="Export the full catalog to a CSV file (opens in Excel)"
          >
            <IconDownload size={14} /> Export CSV
          </button>

          <button
            type="button"
            className="btn btn--secondary btn--sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={busy}
            title="Import actions from a CSV file (updates existing, adds new)"
          >
            <IconAttachFile size={14} /> Import CSV
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            style={{ display: 'none' }}
            onChange={handleImportFile}
          />

          <button type="button" className="btn btn--primary btn--sm" onClick={handleCreateAction} disabled={busy}>
            <IconPlus size={14} /> Create Action
          </button>
        </div>
      </div>

      <div className="data-table-wrapper">
      <table className="data-table plans-table">
        <thead>
          <tr>
            <th style={{ width: 280 }}>Key</th>
            <th>Description</th>
            <th style={{ width: 80 }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {visibleActions.length === 0 ? (
            <tr>
              <td colSpan={3}>
                <div className="cases-table__no-data">
                  <strong>No actions</strong>
                  <span>
                    {search.trim()
                      ? 'Try changing the search.'
                      : 'Create one to get started.'}
                  </span>
                </div>
              </td>
            </tr>
          ) : (
            visibleActions.map((action) => (
              <tr key={action.action_key}>
                <td>
                  <span className="action-catalog__key">{action.action_key}</span>
                  {action.is_deprecated ? (
                    <span className="badge badge--warning" style={{ marginLeft: 8 }}>Deprecated</span>
                  ) : null}
                </td>
                <td>
                  <span className="text-secondary" title={action.description || ''}>
                    {action.description || '—'}
                  </span>
                </td>
                <td>
                  <div
                    className="cases-table__row-menu"
                    ref={menuOpenKey === action.action_key ? menuRef : undefined}
                  >
                    <button
                      type="button"
                      className="cases-table__action-btn"
                      aria-label={`Actions for ${action.action_key}`}
                      aria-haspopup="menu"
                      aria-expanded={menuOpenKey === action.action_key}
                      onClick={() => setMenuOpenKey(menuOpenKey === action.action_key ? null : action.action_key)}
                    >
                      <IconMoreHoriz size={16} />
                    </button>
                    {menuOpenKey === action.action_key && (
                      <div className="action-menu cases-table__action-menu" role="menu">
                        <button
                          type="button"
                          role="menuitem"
                          className="action-menu__item"
                          onClick={() => handleEditAction(action)}
                        >
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          className="action-menu__item"
                          onClick={() => handleDeprecateAction(action)}
                        >
                          <span>{action.is_deprecated ? 'Restore' : 'Deprecate'}</span>
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          className="action-menu__item action-menu__item--danger"
                          onClick={() => handleDeleteAction(action)}
                        >
                          <span>Delete</span>
                        </button>
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      </div>

      {showForm && (
        <ActionForm
          data={formData}
          isEditing={!!selectedAction}
          onSave={handleSaveAction}
          onCancel={() => setShowForm(false)}
          onChange={setFormData}
        />
      )}
    </div>
  );
}

interface ActionFormProps {
  data: ActionFormData;
  isEditing: boolean;
  onSave: () => void;
  onCancel: () => void;
  onChange: (data: ActionFormData) => void;
}

function ActionForm({ data, isEditing, onSave, onCancel, onChange }: ActionFormProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return createPortal(
    <div className="modal-overlay" role="presentation">
      <button
        type="button"
        className="modal-overlay__backdrop"
        aria-label="Close dialog"
        onClick={onCancel}
      />
      <div className="modal action-catalog-modal" role="dialog" aria-modal="true">
        <div className="modal__header">
          <div>
            <h3 className="modal__title">{isEditing ? 'Edit Action' : 'Create Action'}</h3>
            <p className="modal__subtitle">Define the action key, metadata, and parameter contract.</p>
          </div>
        </div>

        <div className="modal__body">
          <div className="action-catalog-form-grid">
            <label className="settings-field">
              <span className="settings-field__label">Action Key *</span>
              <input
                type="text"
                className="settings-input"
                disabled={isEditing}
                placeholder="MY_ACTION"
                value={data.actionKey}
                onChange={(e) => onChange({ ...data, actionKey: e.target.value.toUpperCase() })}
              />
            </label>

            <label className="settings-field">
              <span className="settings-field__label">Category *</span>
              <select
                className="settings-input"
                value={data.category}
                onChange={(e) => onChange({ ...data, category: e.target.value })}
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </label>
          </div>

          <label className="settings-field settings-field--full">
            <span className="settings-field__label">Label *</span>
            <input
              type="text"
              className="settings-input"
              placeholder="My Custom Action"
              value={data.label}
              onChange={(e) => onChange({ ...data, label: e.target.value })}
            />
          </label>

          <label className="settings-field settings-field--full">
            <span className="settings-field__label">Description</span>
            <textarea
              className="settings-input"
              placeholder="What does this action do?"
              value={data.description}
              onChange={(e) => onChange({ ...data, description: e.target.value })}
              rows={3}
            />
          </label>

          <fieldset className="action-catalog-contract">
            <legend className="settings-field__label">Parameter Contract</legend>
            <div className="action-catalog-contract-grid">
              {CONTRACT_FIELDS.map((field) => (
                <label key={field} className="settings-field">
                  <span className="settings-field__label">{field}</span>
                  <select
                    className="settings-input"
                    value={data.contract[field] || 'not-used'}
                    onChange={(e) => onChange({
                      ...data,
                      contract: { ...data.contract, [field]: e.target.value as 'required' | 'optional' | 'not-used' }
                    })}
                  >
                    <option value="required">Required</option>
                    <option value="optional">Optional</option>
                    <option value="not-used">Not Used</option>
                  </select>
                </label>
              ))}
            </div>
          </fieldset>
        </div>

        <div className="modal__footer">
          <button type="button" className="btn btn--secondary" onClick={onCancel}>
            <IconX size={14} /> Cancel
          </button>
          <button type="button" className="btn btn--primary" onClick={onSave}>
            <IconSave size={14} /> Save Action
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
