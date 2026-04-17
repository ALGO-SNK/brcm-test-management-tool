import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { IconChevronDown, IconX } from './Icons';

interface SearchableSelectOption {
  value: string;
  label: string;
}

interface SearchableSelectProps {
  options: SearchableSelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = 'Select…',
  className = '',
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filteredOptions = useMemo(
    () =>
      options.filter(
        (opt) =>
          opt.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
          opt.value.toLowerCase().includes(searchTerm.toLowerCase()),
      ),
    [options, searchTerm],
  );

  const selectedOption = options.find((opt) => opt.value === value);

  // Close on outside click; focus input when opening
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const clickedInsideTrigger = containerRef.current?.contains(target) ?? false;
      const clickedInsideDropdown = dropdownRef.current?.contains(target) ?? false;
      if (!clickedInsideTrigger && !clickedInsideDropdown) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      inputRef.current?.focus();
    }

    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  useLayoutEffect(() => {
    if (!isOpen) return;

    const updateMenuPlacement = () => {
      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;
      const margin = 8;
      const estimatedMenuHeight = Math.min(240, Math.max(56, filteredOptions.length * 40 + 16));
      const spaceBelow = viewportHeight - rect.bottom - margin;
      const spaceAbove = rect.top - margin;
      const shouldOpenUp = spaceBelow < estimatedMenuHeight && spaceAbove > spaceBelow;
      const availableHeight = Math.max(56, Math.min(estimatedMenuHeight, shouldOpenUp ? spaceAbove : spaceBelow));
      const left = Math.min(Math.max(margin, rect.left), Math.max(margin, viewportWidth - rect.width - margin));
      const top = shouldOpenUp
        ? Math.max(margin, rect.top - 4 - availableHeight)
        : rect.bottom + 4;

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
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setSearchTerm('');
  };

  const toggleOpen = () => setIsOpen((v) => !v);

  return (
    // Flat structure — no inner trigger wrapper
    <div ref={containerRef} className={`searchable-select ${className || ''}`}>
      <input
        ref={inputRef}
        type="text"
        className="searchable-select__input"
        placeholder={selectedOption?.label || placeholder}
        value={isOpen ? searchTerm : selectedOption?.label ?? ''}
        onChange={(e) => setSearchTerm(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setIsOpen(false);
            setSearchTerm('');
          }
          if (e.key === 'Enter' && filteredOptions.length > 0) {
            handleSelect(filteredOptions[0].value);
          }
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setIsOpen(true);
          }
        }}
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(true);
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
              {filteredOptions.map((option) => (
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
            </ul>
          ) : (
            <div className="searchable-select__empty">No options found</div>
          )}
        </div>,
        document.body,
      )}
    </div>
  );
}
