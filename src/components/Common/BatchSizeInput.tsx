import { useEffect, useRef, useState } from 'react';
import { IconChevronDown } from './Icons';

/**
 * Combobox input for the test-point batch size used when queueing a run.
 *
 * Custom dropdown (not native `<datalist>`) so the full preset list is always
 * visible regardless of what the user has typed. User can also type any value.
 *
 * Internal value is a number:
 *   - 0          → "single batch, all points to one CD" (displayed as empty, "All" in dropdown)
 *   - any > 0    → that many points per batch
 */

interface BatchSizeInputProps {
  value: number;
  onChange: (value: number) => void;
  id?: string;
  className?: string;
  disabled?: boolean;
}

const PRESETS: Array<{ label: string; value: number }> = [
  { label: '10', value: 10 },
  { label: '15', value: 15 },
  { label: '20', value: 20 },
  { label: '50', value: 50 },
  { label: 'All', value: 0 },
];

export function BatchSizeInput({
  value,
  onChange,
  id = 'batchSizeInput',
  className = 'settings-input batch-combo__input',
  disabled,
}: BatchSizeInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const onMouseDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [isOpen]);

  // 0 → "All" (so the user sees what's actually selected), >0 → numeric string
  const displayValue = value > 0 ? String(value) : 'All';

  /**
   * Typing strategy: strip every non-digit from the raw input.
   * - Empty result → 0 (= "All")
   * - Otherwise → the numeric value, clamped to 0..500
   * This means the user can backspace through "All" or paste anything and we
   * gracefully collapse it to digits. The visible "All" is auto-selected on focus,
   * so typing immediately replaces it.
   */
  const commitText = (raw: string) => {
    const digits = raw.replace(/\D/g, '');
    if (digits === '') {
      onChange(0);
      return;
    }
    const parsed = Number(digits);
    if (Number.isFinite(parsed) && parsed >= 0) {
      onChange(Math.min(500, Math.round(parsed)));
    }
  };

  const selectPreset = (presetValue: number) => {
    onChange(presetValue);
    setIsOpen(false);
  };

  return (
    <div className="batch-combo" ref={containerRef}>
      <div className="batch-combo__inputrow">
        <input
          id={id}
          type="text"
          className={className}
          value={displayValue}
          placeholder="10, 15, 20, All"
          disabled={disabled}
          onChange={(event) => commitText(event.target.value)}
          onFocus={(event) => {
            setIsOpen(true);
            // Select all so typing replaces "All" / current number cleanly.
            event.target.select();
          }}
          inputMode="numeric"
          autoComplete="off"
        />
        <button
          type="button"
          className="batch-combo__chevron"
          onClick={() => setIsOpen((open) => !open)}
          disabled={disabled}
          tabIndex={-1}
          aria-label="Show batch size options"
        >
          <IconChevronDown size={14} />
        </button>
      </div>
      {isOpen && !disabled && (
        <div className="batch-combo__popover" role="listbox">
          {PRESETS.map((preset) => {
            const isActive = preset.value === value;
            return (
              <button
                key={preset.label}
                type="button"
                role="option"
                aria-selected={isActive}
                className={`batch-combo__option${isActive ? ' is-active' : ''}`}
                onClick={() => selectPreset(preset.value)}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
