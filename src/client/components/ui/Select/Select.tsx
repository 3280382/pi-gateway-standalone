import React, { useState, useRef, useEffect } from 'react';
import styles from './Select.module.css';

export type SelectSize = 'small' | 'medium' | 'large';
export type SelectVariant = 'default' | 'filled' | 'outline';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
  icon?: React.ReactNode;
}

export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> {
  size?: SelectSize;
  variant?: SelectVariant;
  label?: string;
  error?: string;
  helperText?: string;
  fullWidth?: boolean;
  options: SelectOption[];
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  searchable?: boolean;
  clearable?: boolean;
  leftIcon?: React.ReactNode;
}

export const Select: React.FC<SelectProps> = ({
  size = 'medium',
  variant = 'default',
  label,
  error,
  helperText,
  fullWidth = false,
  options,
  value,
  onChange,
  placeholder = 'Select an option',
  searchable = false,
  clearable = false,
  leftIcon,
  className = '',
  id,
  required,
  disabled,
  ...props
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOption, setSelectedOption] = useState<SelectOption | null>(
    options.find(opt => opt.value === value) || null
  );
  const selectRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const option = options.find(opt => opt.value === value);
    setSelectedOption(option || null);
  }, [value, options]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (selectRef.current && !selectRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && searchable && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen, searchable]);

  const filteredOptions = searchable
    ? options.filter(option =>
        option.label.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : options;

  const handleSelect = (option: SelectOption) => {
    if (option.disabled) return;
    
    setSelectedOption(option);
    onChange?.(option.value);
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleClear = () => {
    setSelectedOption(null);
    onChange?.('');
    setIsOpen(false);
    setSearchTerm('');
  };

  const selectClass = [
    styles.select,
    styles[`size-${size}`],
    styles[`variant-${variant}`],
    error ? styles.error : '',
    isOpen ? styles.open : '',
    fullWidth ? styles.fullWidth : '',
    disabled ? styles.disabled : '',
    className
  ].filter(Boolean).join(' ');

  const selectId = id || `select-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <div className={styles.selectContainer} ref={selectRef}>
      {label && (
        <label htmlFor={selectId} className={styles.label}>
          {label}
          {required && <span className={styles.required}>*</span>}
        </label>
      )}
      
      <div className={selectClass} onClick={() => !disabled && setIsOpen(!isOpen)}>
        <div className={styles.selectValue}>
          {leftIcon && <span className={styles.leftIcon}>{leftIcon}</span>}
          {selectedOption ? (
            <>
              {selectedOption.icon && (
                <span className={styles.optionIcon}>{selectedOption.icon}</span>
              )}
              <span className={styles.optionLabel}>{selectedOption.label}</span>
            </>
          ) : (
            <span className={styles.placeholder}>{placeholder}</span>
          )}
        </div>
        
        <div className={styles.selectIcons}>
          {clearable && selectedOption && (
            <button
              type="button"
              className={styles.clearButton}
              onClick={(e) => {
                e.stopPropagation();
                handleClear();
              }}
              aria-label="Clear selection"
            >
              ×
            </button>
          )}
          <span className={styles.chevron}>▾</span>
        </div>
      </div>

      {isOpen && (
        <div className={styles.dropdown}>
          {searchable && (
            <div className={styles.searchContainer}>
              <input
                ref={searchInputRef}
                type="text"
                className={styles.searchInput}
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          )}
          
          <div className={styles.optionsList}>
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option) => (
                <div
                  key={option.value}
                  className={[
                    styles.option,
                    option.value === selectedOption?.value ? styles.selected : '',
                    option.disabled ? styles.disabledOption : ''
                  ].filter(Boolean).join(' ')}
                  onClick={() => handleSelect(option)}
                >
                  {option.icon && (
                    <span className={styles.optionIcon}>{option.icon}</span>
                  )}
                  <span className={styles.optionLabel}>{option.label}</span>
                  {option.value === selectedOption?.value && (
                    <span className={styles.checkmark}>✓</span>
                  )}
                </div>
              ))
            ) : (
              <div className={styles.noOptions}>No options found</div>
            )}
          </div>
        </div>
      )}

      {error && (
        <div className={styles.errorText} role="alert">
          {error}
        </div>
      )}
      {helperText && !error && (
        <div className={styles.helperText}>
          {helperText}
        </div>
      )}
    </div>
  );
};