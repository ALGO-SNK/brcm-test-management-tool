import { useEffect, useState } from 'react';
import { IconPlus, IconDelete, IconSave, IconX } from './Common/Icons';
import { useNotification } from '../context/useNotification';
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
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedAction, setSelectedAction] = useState<Action | null>(null);
  const [filter, setFilter] = useState<{ category?: string; deprecated?: boolean }>({});
  const [formData, setFormData] = useState<ActionFormData>({
    actionKey: '',
    label: '',
    description: '',
    category: 'custom',
    contract: {},
  });
  const [usageCounts, setUsageCounts] = useState<Record<string, number>>({});
  const { addNotification } = useNotification();

  useEffect(() => {
    loadActions();
    loadCategories();
  }, []);

  const loadActions = async () => {
    if (!window.desktop?.listActions) return;

    try {
      setLoading(true);
      const allActions = await window.desktop.listActions({
        includeDeprecated: filter.deprecated !== false
      });

      const filtered = filter.category
        ? allActions.filter((a: { category: string }) => a.category === filter.category)
        : allActions;

      setActions(filtered);

      // Load usage counts for all actions
      const counts: Record<string, number> = {};
      for (const action of filtered) {
        const count = await window.desktop!.getActionUsageCount!(action.action_key);
        counts[action.action_key] = count;
      }
      setUsageCounts(counts);
    } catch (error) {
      addNotification('error', `Failed to load actions: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    if (!window.desktop?.getActionCategories) return;

    try {
      const cats = await window.desktop.getActionCategories();
      setCategories(cats);
    } catch (error) {
      console.error('Failed to load categories:', error);
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
        // Update existing action
        await window.desktop.updateAction(selectedAction.action_key, {
          label: formData.label,
          description: formData.description,
          category: formData.category,
          contract: formData.contract,
        });
        addNotification('success', `Updated action: ${formData.actionKey}`);
      } else {
        // Create new action
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

  if (loading) {
    return <div className="action-catalog-manager"><p>Loading actions...</p></div>;
  }

  return (
    <div className="action-catalog-manager">
      <div className="catalog-header">
        <div className="catalog-stats">
          <div className="stat-chip">
            <span>Total Actions</span>
            <strong>{actions.length}</strong>
          </div>
          <div className="stat-chip">
            <span>Custom Actions</span>
            <strong>{actions.filter((a) => a.is_user_modified).length}</strong>
          </div>
          <div className="stat-chip">
            <span>Deprecated</span>
            <strong>{actions.filter((a) => a.is_deprecated).length}</strong>
          </div>
        </div>

        <div className="catalog-controls">
          <select
            value={filter.category || ''}
            onChange={(e) => setFilter({ ...filter, category: e.target.value || undefined })}
            className="select-filter"
          >
            <option value="">All Categories</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

          <label className="checkbox-filter">
            <input
              type="checkbox"
              checked={filter.deprecated === false}
              onChange={(e) => setFilter({ ...filter, deprecated: e.target.checked ? false : undefined })}
            />
            Hide deprecated
          </label>

          <button className="btn btn--primary btn--sm" onClick={handleCreateAction}>
            <IconPlus /> Create Action
          </button>
        </div>
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

      <table className="action-table">
        <thead>
          <tr>
            <th>Key</th>
            <th>Label</th>
            <th>Category</th>
            <th>Usage</th>
            <th>Status</th>
            <th>Modified By</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {actions.map((action) => (
            <tr key={action.action_key} className={action.is_deprecated ? 'deprecated' : ''}>
              <td className="key-cell">
                <code>{action.action_key}</code>
              </td>
              <td>{action.label}</td>
              <td><span className="category-badge">{action.category}</span></td>
              <td className="usage-cell">
                <span className="usage-count">{usageCounts[action.action_key] || 0}</span>
              </td>
              <td>
                {action.is_deprecated ? (
                  <span className="status-badge status-deprecated">Deprecated</span>
                ) : (
                  <span className="status-badge status-active">Active</span>
                )}
              </td>
              <td className="modified-cell">
                {action.is_user_modified ? (
                  <span className="modified-badge">Custom</span>
                ) : (
                  <span className="built-in-badge">Built-in</span>
                )}
              </td>
              <td className="action-buttons">
                <button
                  className="btn btn--xs btn--secondary"
                  onClick={() => handleEditAction(action)}
                  title="Edit action"
                >
                  Edit
                </button>
                <button
                  className={`btn btn--xs ${action.is_deprecated ? 'btn--success' : 'btn--warning'}`}
                  onClick={() => handleDeprecateAction(action)}
                  title={action.is_deprecated ? 'Restore action' : 'Deprecate action'}
                >
                  {action.is_deprecated ? 'Restore' : 'Deprecate'}
                </button>
                <button
                  className="btn btn--xs btn--danger"
                  onClick={() => handleDeleteAction(action)}
                  disabled={usageCounts[action.action_key] > 0}
                  title={usageCounts[action.action_key] > 0 ? 'Cannot delete actions in use' : 'Delete action'}
                >
                  <IconDelete /> Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {actions.length === 0 && (
        <div className="empty-state">
          <p>No actions found. {filter.category ? 'Try changing the filter.' : 'Create one to get started.'}</p>
        </div>
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
  return (
    <div className="action-form-modal">
      <div className="modal-overlay" onClick={onCancel} />
      <div className="modal-content">
        <div className="modal-header">
          <h3>{isEditing ? 'Edit Action' : 'Create Action'}</h3>
          <button className="btn--icon" onClick={onCancel}>
            <IconX />
          </button>
        </div>

        <div className="form-body">
          <div className="form-group">
            <label>Action Key *</label>
            <input
              type="text"
              disabled={isEditing}
              placeholder="MY_ACTION"
              value={data.actionKey}
              onChange={(e) => onChange({ ...data, actionKey: e.target.value.toUpperCase() })}
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label>Label *</label>
            <input
              type="text"
              placeholder="My Custom Action"
              value={data.label}
              onChange={(e) => onChange({ ...data, label: e.target.value })}
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label>Description</label>
            <textarea
              placeholder="What does this action do?"
              value={data.description}
              onChange={(e) => onChange({ ...data, description: e.target.value })}
              className="form-input"
              rows={3}
            />
          </div>

          <div className="form-group">
            <label>Category *</label>
            <select
              value={data.category}
              onChange={(e) => onChange({ ...data, category: e.target.value })}
              className="form-input"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <fieldset className="contract-fieldset">
            <legend>Parameter Contract</legend>
            <div className="contract-grid">
              {CONTRACT_FIELDS.map((field) => (
                <div key={field} className="contract-field">
                  <label>{field}</label>
                  <select
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
                </div>
              ))}
            </div>
          </fieldset>
        </div>

        <div className="modal-footer">
          <button className="btn btn--secondary" onClick={onCancel}>
            <IconX /> Cancel
          </button>
          <button className="btn btn--primary" onClick={onSave}>
            <IconSave /> Save Action
          </button>
        </div>
      </div>
    </div>
  );
}
