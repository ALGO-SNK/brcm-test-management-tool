import { ActionCatalogManager } from './ActionCatalogManager';
import { IconX } from './Common/Icons';
import './ActionCatalogPanel.css';

interface ActionCatalogPanelProps {
  onClose: () => void;
}

export function ActionCatalogPanel({ onClose }: ActionCatalogPanelProps) {
  return (
    <div className="action-catalog-panel">
      <div className="panel-header">
        <h2>Action Catalog</h2>
        <button className="btn--icon" onClick={onClose} title="Close panel">
          <IconX />
        </button>
      </div>
      <div className="panel-content">
        <ActionCatalogManager />
      </div>
    </div>
  );
}
