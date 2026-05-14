import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { IconChevronDown, IconX } from './Icons';
import { NOT_SELECTED_LABEL } from '../../utils/selectLabels';

interface SearchableSelectOption {
  value: string;
  label: string;
  group?: string;
}

interface SearchableSelectProps {
  options: SearchableSelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  emptyLabel?: string;
  className?: string;
  allowCustomValue?: boolean;
  customValueHeading?: string;
}

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = 'Select…',
  emptyLabel = NOT_SELECTED_LABEL,
  className = '',
  allowCustomValue = false,
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [hasUserEditedSearch, setHasUserEditedSearch] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);
  const selectedLabel = selectedOption?.label ?? (allowCustomValue ? value : '');
  const effectiveSearchTerm = hasUserEditedSearch ? searchTerm : '';
  const optionsWithCustomValue = useMemo(() => {
    const trimmedValue = value.trim();
    const hasSelectedCustomValue = allowCustomValue
      && Boolean(trimmedValue)
      && !options.some((opt) => (
        opt.value.trim().toLowerCase() === trimmedValue.toLowerCase()
        || opt.label.trim().toLowerCase() === trimmedValue.toLowerCase()
      ));

    if (!hasSelectedCustomValue) return options;
    return [...options, { value: trimmedValue, label: trimmedValue }];
  }, [allowCustomValue, options, value]);
  const filteredOptions = useMemo(
    () =>
      optionsWithCustomValue.filter(
        (opt) =>
          opt.label.toLowerCase().includes(effectiveSearchTerm.toLowerCase()) ||
          opt.value.toLowerCase().includes(effectiveSearchTerm.toLowerCase()),
      ),
    [effectiveSearchTerm, optionsWithCustomValue],
  );
  const trimmedSearchTerm = searchTerm.trim();
  const hasExactOptionMatch = optionsWithCustomValue.some((opt) => {
    const normalizedSearchTerm = trimmedSearchTerm.toLowerCase();
    return (
      opt.label.trim().toLowerCase() === normalizedSearchTerm
      || opt.value.trim().toLowerCase() === normalizedSearchTerm
    );
  });
  const canUseCustomValue = allowCustomValue && Boolean(trimmedSearchTerm) && !hasExactOptionMatch;
  const groupedOptions = useMemo(() => {
    const groups: Array<{ label: string | null; options: SearchableSelectOption[] }> = [];
    filteredOptions.forEach((option) => {
      const groupLabel = option.group ?? null;
      let group = groups.find((item) => item.label === groupLabel);
      if (!group) {
        group = { label: groupLabel, options: [] };
        groups.push(group);
      }
      group.options.push(option);
    });
    return groups;
  }, [filteredOptions]);

  const openSelect = () => {
    setSearchTerm(selectedLabel || '');
    setHasUserEditedSearch(false);
    setIsOpen(true);
  };

  const closeSelect = (commitCustomValue = false) => {
    if (commitCustomValue && canUseCustomValue) {
      onChange(trimmedSearchTerm);
    }
    setIsOpen(false);
    setSearchTerm('');
    setHasUserEditedSearch(false);
  };

  // Close on outside click; focus input when opening
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const clickedInsideTrigger = containerRef.current?.contains(target) ?? false;
      const clickedInsideDropdown = dropdownRef.current?.contains(target) ?? false;
      if (!clickedInsideTrigger && !clickedInsideDropdown) {
        closeSelect(true);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      inputRef.current?.focus();
    }

    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [canUseCustomValue, isOpen, trimmedSearchTerm]);

  useLayoutEffect(() => {
    if (!isOpen) return;

    const updateMenuPlacement = () => {
      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;
      const margin = 8;
      const optionCount = filteredOptions.length || (canUseCustomValue ? 1 : 1);
      const estimatedMenuHeight = Math.min(240, Math.max(44, optionCount * 32 + 10));
      const spaceBelow = viewportHeight - rect.bottom - margin;
      const spaceAbove = rect.top - margin;
      const shouldOpenUp = spaceBelow < estimatedMenuHeight && spaceAbove > spaceBelow;
      const availableHeight = Math.max(44, Math.min(estimatedMenuHeight, shouldOpenUp ? spaceAbove : spaceBelow));
      const left = Math.min(Math.max(margin, rect.left), Math.max(margin, viewportWidth - rect.width - margin));
      const dropdownGap = 2;
      const top = shouldOpenUp
        ? Math.max(margin, rect.top - dropdownGap - availableHeight)
        : rect.bottom + dropdownGap;

      setDropdownStyle({
        position: 'fixed',
        top,
        left,
        width: rect.width,
        maxHeight: availableHeight,
        zIndex: 1000,
      });
    };

    updateMenuPlacement();
    window.addEventListener('resize', updateMenuPlacement);
    window.addEventListener('scroll', updateMenuPlacement, true);

    return () => {
      window.removeEventListener('resize', updateMenuPlacement);
      window.removeEventListener('scroll', updateMenuPlacement, true);
    };
  }, [filteredOptions.length, isOpen]);

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    closeSelect(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setSearchTerm('');
    setHasUserEditedSearch(false);
  };

  const toggleOpen = () => {
    if (isOpen) {
      closeSelect(true);
      return;
    }
    openSelect();
  };

  return (
    // Flat structure — no inner trigger wrapper
    <div ref={containerRef} className={`searchable-select ${className || ''}`}>
      <input
        ref={inputRef}
        type="text"
        className="searchable-select__input"
        placeholder={isOpen ? placeholder : (selectedLabel || emptyLabel)}
        value={isOpen ? searchTerm : selectedLabel}
        onChange={(e) => {
          setSearchTerm(e.target.value);
          setHasUserEditedSearch(true);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            closeSelect(false);
          }
          if (e.key === 'Enter' && filteredOptions.length > 0) {
            if (canUseCustomValue) {
              handleSelect(trimmedSearchTerm);
            } else {
              handleSelect(filteredOptions[0].value);
            }
          }
          if (e.key === 'Enter' && filteredOptions.length === 0 && canUseCustomValue) {
            handleSelect(trimmedSearchTerm);
          }
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            openSelect();
          }
        }}
        onClick={(e) => {
          e.stopPropagation();
          openSelect();
        }}
        readOnly={!isOpen}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        role="combobox"
      />

      {value && !isOpen && (
        <button
          type="button"
          className="searchable-select__clear"
          onClick={handleClear}
          title="Clear selection"
          tabIndex={-1}
        >
          <IconX size={14} />
        </button>
      )}

      <button
        type="button"
        className={`searchable-select__icon-btn${isOpen ? ' is-open' : ''}`}
        onClick={(e) => {
          e.stopPropagation();
          toggleOpen();
        }}
        aria-label={isOpen ? 'Close options' : 'Open options'}
        aria-expanded={isOpen}
      >
        <IconChevronDown size={14} />
      </button>

      {isOpen && dropdownStyle && typeof document !== 'undefined' && createPortal(
        <div
          ref={dropdownRef}
          className="searchable-select__dropdown"
          role="listbox"
          style={dropdownStyle}
        >
          {filteredOptions.length > 0 ? (
            <ul className="searchable-select__options">
              {groupedOptions.map((group) => (
                <React.Fragment key={group.label ?? 'ungrouped'}>
                  {group.label && (
                    <li className="searchable-select__group-label" role="presentation">
                      {group.label}
                    </li>
                  )}
                  {group.options.map((option) => (
                    <li key={option.value} role="option" aria-selected={option.value === value}>
                      <button
                        type="button"
                        className={`searchable-select__option${option.value === value ? ' is-selected' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelect(option.value);
                        }}
                      >
                        {option.label}
                      </button>
                    </li>
                  ))}
                </React.Fragment>
              ))}
            </ul>
          ) : (
            canUseCustomValue ? (
              <ul className="searchable-select__options">
                <li role="option" aria-selected={trimmedSearchTerm === value}>
                  <button
                    type="button"
                    className="searchable-select__option searchable-select__option--custom"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelect(trimmedSearchTerm);
                    }}
                  >
                    {trimmedSearchTerm}
                  </button>
                </li>
              </ul>
            ) : (
              <div className="searchable-select__empty">No options found</div>
            )
          )}
        </div>,
        document.body,
      )}
    </div>
  );
}
