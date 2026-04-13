import { useState } from 'react';
import { IconChevronRight, IconFolder, IconFolderOpen } from '../Common/Icons';
import type { ADOTestSuite } from '../../types';

interface SuiteTreeNodeProps {
  suite: ADOTestSuite;
  depth: number;
  selectedSuiteId: number | null;
  onSelect: (suite: ADOTestSuite) => void;
  filterText: string;
  expandSignal: number;
}

function matchesFilter(suite: ADOTestSuite, text: string): boolean {
  if (!text) return true;
  const lower = text.toLowerCase();
  if (suite.name.toLowerCase().includes(lower)) return true;
  return suite.children?.some(child => matchesFilter(child, text)) ?? false;
}

export function SuiteTreeNode({
  suite,
  depth,
  selectedSuiteId,
  onSelect,
  filterText,
  expandSignal,
}: SuiteTreeNodeProps) {
  const hasChildren = Boolean(suite.children && suite.children.length > 0);
  const [expanded, setExpanded] = useState(expandSignal > 0);

  if (filterText && !matchesFilter(suite, filterText)) return null;

  const isSelected = suite.id === selectedSuiteId;
  const showCount = suite.testCaseCount != null && suite.testCaseCount > 0;

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasChildren) setExpanded(prev => !prev);
  };

  const handleSelect = () => {
    onSelect(suite);
  };

  return (
    <li className="suite-tree__item" role="treeitem" aria-expanded={hasChildren ? expanded : undefined}>
      <div
        className={`suite-tree__row${isSelected ? ' suite-tree__row--selected' : ''}`}
        style={{ paddingLeft: `${12 + depth * 20}px` }}
        onClick={handleSelect}
      >
        <button
          type="button"
          className={`suite-tree__toggle${hasChildren ? '' : ' suite-tree__toggle--hidden'}`}
          onClick={handleToggle}
          tabIndex={-1}
          aria-label={expanded ? 'Collapse' : 'Expand'}
        >
          <IconChevronRight
            size={16}
            className={`suite-tree__chevron${expanded ? ' suite-tree__chevron--open' : ''}`}
          />
        </button>

        {hasChildren && expanded
          ? <IconFolderOpen size={16} className="suite-tree__icon" />
          : <IconFolder size={16} className="suite-tree__icon" />
        }

        <span className="suite-tree__name">{suite.name}</span>
        {showCount && (
          <span className="suite-tree__count">{suite.testCaseCount}</span>
        )}
      </div>

      {hasChildren && expanded && (
        <ul className="suite-tree__children" role="group">
          {suite.children!.map(child => (
            <SuiteTreeNode
              key={child.id}
              suite={child}
              depth={depth + 1}
              selectedSuiteId={selectedSuiteId}
              onSelect={onSelect}
              filterText={filterText}
              expandSignal={expandSignal}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
