import React, { useEffect, useRef, useState } from 'react';
import {
  IconChevronRight,
  IconFolder,
  IconFolderOpen,
  IconMoreHoriz,
  IconOpenInNew,
  IconPlus,
} from '../Common/Icons';
import type { ADOTestSuite } from '../../types';

interface SuiteTreeNodeProps {
  suite: ADOTestSuite;
  depth: number;
  ancestry: ADOTestSuite[];
  selectedSuiteId: number | null;
  onSelect: (suite: ADOTestSuite, path: ADOTestSuite[]) => void;
  onAddSuite: (suite: ADOTestSuite) => void;
  onAddTestCase: (suite: ADOTestSuite, path: ADOTestSuite[]) => void;
  onOpenInAdo: (suite: ADOTestSuite) => void;
  filterText: string;
  expandSignal: number;
  canCreateSuite: boolean;
  canAddTestCase: boolean;
  canOpenInAdo: boolean;
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
  ancestry,
  selectedSuiteId,
  onSelect,
  onAddSuite,
  onAddTestCase,
  onOpenInAdo,
  filterText,
  expandSignal,
  canCreateSuite,
  canAddTestCase,
  canOpenInAdo,
}: SuiteTreeNodeProps) {
  const hasChildren = Boolean(suite.children && suite.children.length > 0);
  const [expanded, setExpanded] = useState(expandSignal > 0);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const isVisible = !filterText || matchesFilter(suite, filterText);
  const shouldAutoExpand = hasChildren
    && (filterText ? suite.children?.some(child => matchesFilter(child, filterText)) ?? false : false);

  const isSelected = suite.id === selectedSuiteId;
  const showCount = suite.testCaseCount != null && suite.testCaseCount > 0;

  useEffect(() => {
    setExpanded(expandSignal > 0);
  }, [expandSignal]);

  useEffect(() => {
    if (shouldAutoExpand) {
      setExpanded(true);
    }
  }, [shouldAutoExpand]);

  useEffect(() => {
    if (!menuOpen) return;

    const handleMouseDown = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [menuOpen]);

  if (!isVisible) return null;

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasChildren) setExpanded(prev => !prev);
  };

  const handleSelect = () => {
    onSelect(suite, [...ancestry, suite]);
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
        <div
          className={`suite-tree__actions${menuOpen ? ' is-open' : ''}`}
          ref={menuRef}
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            className="suite-tree__action-btn"
            aria-label={`Actions for ${suite.name}`}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <IconMoreHoriz size={16} />
          </button>
          {menuOpen && (
            <div className="action-menu action-menu--suite-tree" role="menu">
              <button
                type="button"
                role="menuitem"
                className="action-menu__item"
                onClick={() => {
                  setMenuOpen(false);
                  onAddSuite(suite);
                }}
                disabled={!canCreateSuite}
              >
                <IconPlus size={16} />
                <span>Add static suite</span>
              </button>
              <button
                type="button"
                role="menuitem"
                className="action-menu__item"
                onClick={() => {
                  setMenuOpen(false);
                  onAddTestCase(suite, [...ancestry, suite]);
                }}
                disabled={!canAddTestCase}
              >
                <IconPlus size={16} />
                <span>Add test case</span>
              </button>
              <button
                type="button"
                role="menuitem"
                className="action-menu__item"
                onClick={() => {
                  setMenuOpen(false);
                  onOpenInAdo(suite);
                }}
                disabled={!canOpenInAdo}
              >
                <IconOpenInNew size={16} />
                <span>Open in ADO</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {hasChildren && expanded && (
        <ul className="suite-tree__children" role="group">
          {suite.children!.map(child => (
            <SuiteTreeNode
              key={child.id}
              suite={child}
              depth={depth + 1}
              ancestry={[...ancestry, suite]}
              selectedSuiteId={selectedSuiteId}
              onSelect={onSelect}
              onAddSuite={onAddSuite}
              onAddTestCase={onAddTestCase}
              onOpenInAdo={onOpenInAdo}
              filterText={filterText}
              expandSignal={expandSignal}
              canCreateSuite={canCreateSuite}
              canAddTestCase={canAddTestCase}
              canOpenInAdo={canOpenInAdo}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
