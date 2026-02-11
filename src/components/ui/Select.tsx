'use client';

import { forwardRef } from 'react';
import type { SelectHTMLAttributes } from 'react';
import { HelpTooltip } from '@/components/ui/HelpTooltip';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
  compact?: boolean;
  helpText?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className = '', label, error, id, options, compact = false, helpText, ...props }, ref) => {
    const sizeClasses = compact 
      ? 'px-2 py-1.5 text-[13px] rounded-lg'
      : 'px-4 py-2.5 rounded-xl';
    
    const labelTextClasses = compact
      ? 'text-[11px]'
      : 'text-sm';
    const labelWrapperClasses = compact
      ? 'mb-1'
      : 'mb-1.5';
    const resolvedHelpText = helpText ?? label;

    return (
      <div className="w-full">
        {label && (
          <div className={`flex items-center gap-1.5 ${labelWrapperClasses}`}>
            <label 
              htmlFor={id} 
              className={`block font-medium text-gray-700 dark:text-gray-300 ${labelTextClasses}`}
            >
              {label}
            </label>
            {resolvedHelpText && (
              <HelpTooltip
                text="Select tool tip."
                iconClassName={compact ? 'w-3 h-3' : 'w-3.5 h-3.5'}
              />
            )}
          </div>
        )}
        <select
          ref={ref}
          id={id}
          className={`
            w-full ${sizeClasses} border
            bg-white dark:bg-gray-800 
            border-gray-300 dark:border-gray-600
            text-gray-900 dark:text-white
            focus:ring-2 focus:ring-primary-500 focus:border-primary-500
            disabled:opacity-50 disabled:cursor-not-allowed
            ${error ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : ''}
            ${className}
          `}
          {...props}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {error && (
          <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
      </div>
    );
  }
);

Select.displayName = 'Select';
