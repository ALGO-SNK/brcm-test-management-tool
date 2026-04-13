import {useState, useRef, useEffect} from 'react';
import {IconChevronDown, IconX} from './Icons';

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
                                     placeholder = 'Select...',
                                     className = '',
                                 }: SearchableSelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const filteredOptions = options.filter((option) =>
        option.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
        option.value.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const selectedOption = options.find((opt) => opt.value === value);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            inputRef.current?.focus();
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

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

    return (
        <div
            ref={containerRef}
            className={`searchable-select ${className || ''}`}
        >
            <div
                className="searchable-select__trigger"
                onClick={() => setIsOpen(!isOpen)}
            >
                <input
                    ref={inputRef}
                    type="text"
                    className="searchable-select__input"
                    placeholder={selectedOption?.label || placeholder}
                    value={isOpen ? searchTerm : (selectedOption?.label || '')}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Escape') {
                            setIsOpen(false);
                            setSearchTerm('');
                        }
                        if (e.key === 'Enter' && filteredOptions.length > 0) {
                            handleSelect(filteredOptions[0].value);
                        }
                    }}
                    onClick={(e) => {
                        e.stopPropagation();
                        setIsOpen(true);
                    }}
                    readOnly={!isOpen}
                />
                {value && !isOpen && (
                    <button
                        type="button"
                        className="searchable-select__clear"
                        onClick={handleClear}
                        title="Clear selection"
                    >
                        <IconX size={14}/>
                    </button>
                )}
                <div className={`searchable-select__icon${isOpen ? ' is-open' : ''}`}>
                    <IconChevronDown size={14}/>
                </div>
            </div>

            {isOpen && (
                <div className="searchable-select__dropdown">
                    {filteredOptions.length > 0 ? (
                        <ul className="searchable-select__options">
                            {filteredOptions.map((option) => (
                                <li key={option.value}>
                                    <button
                                        type="button"
                                        className={`searchable-select__option${
                                            option.value === value ? ' is-selected' : ''
                                        }`}
                                        onClick={() => handleSelect(option.value)}
                                    >
                                        {option.label}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <div className="searchable-select__empty">
                            No options found
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
