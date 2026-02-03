'use client';

import { SelectHTMLAttributes, forwardRef } from 'react';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
  compact?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className = '', label, error, id, options, compact = false, ...props }, ref) => {
    const sizeClasses = compact 
      ? 'px-2 py-1.5 text-[13px] rounded-lg'
      : 'px-4 py-2.5 rounded-xl';
    
    const labelClasses = compact
      ? 'text-[11px] mb-1'
      : 'text-sm mb-1.5';

    return (
      <div className="w-full">
        {label && (
          <label 
            htmlFor={id} 
            className={`block font-medium text-gray-700 dark:text-gray-300 ${labelClasses}`}
          >
            {label}
          </label>
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
