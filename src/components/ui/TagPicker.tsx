'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { DRILL_TAG_CATEGORIES, DRILL_TAG_CATEGORY_NAMES, getTagColor } from '@/lib/types';
import { X, Search, Check, ChevronDown } from 'lucide-react';
import { HelpTooltip } from '@/components/ui/HelpTooltip';
import { createFeedback } from '@/lib/db';
import { useAuth } from '@/components/AuthProvider';

interface TagPickerProps {
  value: string[];
  onChange: (value: string[]) => void;
  label?: string;
  compact?: boolean;
  helpText?: string;
}

export function TagPicker({ value, onChange, label, compact = false, helpText }: TagPickerProps) {
  const { profile, user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [createdCustomTags, setCreatedCustomTags] = useState<string[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Ensure value is always an array (handles undefined from old data)
  const tags = value ?? [];

  const CUSTOM_CATEGORY_LABEL = 'custom';

  const knownTags = useMemo(
    () => new Set(Object.values(DRILL_TAG_CATEGORIES).flat().map((tag) => tag.toLowerCase())),
    []
  );

  const customTags = useMemo(() => {
    const allCustomTags = [...createdCustomTags, ...tags.filter((tag) => !knownTags.has(tag.toLowerCase()))];
    return Array.from(new Set(allCustomTags));
  }, [createdCustomTags, knownTags, tags]);

  useEffect(() => {
    if (customTags.length === 0) return;
    setCreatedCustomTags((prev) => {
      const merged = Array.from(new Set([...prev, ...customTags]));
      if (merged.length === prev.length && merged.every((tag, index) => tag === prev[index])) {
        return prev;
      }
      return merged;
    });
  }, [customTags]);

  // Filter categories and tags based on search query
  const filteredCategories = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    const baseCategories = DRILL_TAG_CATEGORY_NAMES.map(category => ({
      category,
      tags: [...DRILL_TAG_CATEGORIES[category]],
    }));

    if (!query) {
      if (customTags.length > 0) {
        return [...baseCategories, { category: CUSTOM_CATEGORY_LABEL, tags: customTags }];
      }
      return baseCategories;
    }

    // Filter tags within each category
    const filtered = baseCategories
      .map(categoryData => ({
        ...categoryData,
        tags: categoryData.tags.filter(tag => tag.toLowerCase().includes(query)),
      }))
      .filter(({ tags: categoryTags }) => categoryTags.length > 0);

    const matchingCustomTags = customTags.filter((tag) => tag.toLowerCase().includes(query));
    if (matchingCustomTags.length > 0) {
      return [...filtered, { category: CUSTOM_CATEGORY_LABEL, tags: matchingCustomTags }];
    }
    return filtered;
  }, [customTags, searchQuery]);

  // Separate selected and unselected tags for display
  const selectedSet = useMemo(() => new Set(tags), [tags]);

  const normalizedQuery = useMemo(() => searchQuery.trim().replace(/\s+/g, ' '), [searchQuery]);
  const allAvailableTags = useMemo(
    () => [...Object.values(DRILL_TAG_CATEGORIES).flat(), ...customTags],
    [customTags]
  );
  const existingTagMatch = useMemo(
    () => allAvailableTags.find((tag) => tag.toLowerCase() === normalizedQuery.toLowerCase()),
    [allAvailableTags, normalizedQuery]
  );
  const canCreateCustomTag = normalizedQuery.length > 0 && !existingTagMatch;

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleTag = (tag: string) => {
    if (selectedSet.has(tag)) {
      onChange(tags.filter(t => t !== tag));
    } else {
      onChange([...tags, tag]);
    }
  };

  const removeTag = (tag: string) => {
    onChange(tags.filter(t => t !== tag));
  };

  const clearAll = () => {
    onChange([]);
  };

  const createCustomTag = async () => {
    if (!canCreateCustomTag) return;

    const newTag = normalizedQuery;
    setCreatedCustomTags((prev) => Array.from(new Set([...prev, newTag])));
    if (!selectedSet.has(newTag)) {
      onChange([...tags, newTag]);
    }
    setSearchQuery('');

    try {
      await createFeedback(
        `Custom tag created: "${newTag}". Please assign it to an existing category or create a new category for it.`,
        {
          fullName: profile?.fullName || '',
          userId: user?.id,
        }
      );
    } catch (error) {
      console.error('Failed to log custom tag feedback:', error);
    }
  };

  const labelClasses = compact ? 'text-[11px] mb-1' : 'text-sm mb-2';
  const resolvedHelpText = helpText ?? label;

  return (
    <div className="w-full" ref={containerRef}>
      {label && (
        <div className={`flex items-center gap-1.5 ${labelClasses}`}>
          <div className="block font-medium text-gray-700 dark:text-gray-300">
            {label}
          </div>
          {resolvedHelpText && (
            <HelpTooltip text="Select tags to categorize the drill. Tags can be used to filter drills in the practice picker. The more tags you add, the easier it will be to find the drill in the practice picker." iconClassName={compact ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
          )}
        </div>
      )}

      {/* Selected tags display */}
      {tags.length > 0 && (
        <div className={`flex flex-wrap ${compact ? 'gap-1 mb-1.5' : 'gap-1.5 mb-2'}`}>
          {tags.map(tag => (
            <span
              key={tag}
              className={`
                inline-flex items-center gap-1 rounded-full
                ${getTagColor(tag)}
                ${compact ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm'}
              `}
            >
              {tag}
              <button
                type="button"
                onClick={() => removeTag(tag)}
                className="p-0.5 hover:opacity-70 rounded-full transition-colors"
              >
                <X className={compact ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
              </button>
            </span>
          ))}
          {tags.length > 1 && (
            <button
              type="button"
              onClick={clearAll}
              className={`
                inline-flex items-center gap-1 rounded-full
                bg-gray-100 dark:bg-gray-800 
                border border-gray-300 dark:border-gray-600
                text-gray-600 dark:text-gray-400
                hover:bg-gray-200 dark:hover:bg-gray-700
                transition-colors
                ${compact ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm'}
              `}
            >
              Clear all
            </button>
          )}
        </div>
      )}

      {/* Dropdown trigger and search */}
      <div className="relative">
        <div
          role="combobox"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          tabIndex={0}
          className={`
            flex items-center gap-2 w-full rounded-lg border 
            border-gray-300 dark:border-gray-600 
            bg-white dark:bg-gray-800 
            cursor-pointer
            ${compact ? 'px-2 py-1.5' : 'px-3 py-2'}
            ${isOpen ? 'ring-2 ring-primary-500 border-primary-500' : ''}
          `}
          onClick={() => {
            setIsOpen(true);
            setTimeout(() => inputRef.current?.focus(), 0);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setIsOpen(true);
              setTimeout(() => inputRef.current?.focus(), 0);
            }
          }}
        >
          <Search className={`text-gray-400 ${compact ? 'w-3.5 h-3.5' : 'w-4 h-4'}`} />
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && canCreateCustomTag) {
                e.preventDefault();
                void createCustomTag();
              }
            }}
            onFocus={() => setIsOpen(true)}
            placeholder={tags.length > 0 ? "Add more tags..." : "Search tags..."}
            className={`
              flex-1 bg-transparent outline-none
              text-gray-900 dark:text-white
              placeholder-gray-400 dark:placeholder-gray-500
              ${compact ? 'text-xs' : 'text-sm'}
            `}
          />
          <ChevronDown 
            className={`
              text-gray-400 transition-transform
              ${compact ? 'w-3.5 h-3.5' : 'w-4 h-4'}
              ${isOpen ? 'rotate-180' : ''}
            `} 
          />
        </div>

        {/* Dropdown list */}
        {isOpen && (
          <div 
            className={`
              absolute z-50 left-0 right-0 mt-1
              bg-white dark:bg-gray-800 
              border border-gray-200 dark:border-gray-700
              rounded-lg shadow-lg
              max-h-64 overflow-y-auto
            `}
          >
            {filteredCategories.length === 0 ? (
              <div className="py-1">
                {canCreateCustomTag && (
                  <button
                    type="button"
                    onClick={() => void createCustomTag()}
                    className={`
                      w-full text-left border-b border-gray-100 dark:border-gray-700
                      ${compact ? 'px-2 py-1.5 text-xs' : 'px-3 py-2 text-sm'}
                      text-primary-700 dark:text-primary-300
                      hover:bg-primary-50 dark:hover:bg-primary-900/20
                      transition-colors
                    `}
                  >
                    Create custom tag &quot;{normalizedQuery}&quot;
                  </button>
                )}
                <div className={`${compact ? 'p-2 text-xs' : 'p-3 text-sm'} text-gray-500 dark:text-gray-400 text-center`}>
                  No tags found
                </div>
              </div>
            ) : (
              <div className="py-1">
                {canCreateCustomTag && (
                  <button
                    type="button"
                    onClick={() => void createCustomTag()}
                    className={`
                      w-full text-left border-b border-gray-100 dark:border-gray-700
                      ${compact ? 'px-2 py-1.5 text-xs' : 'px-3 py-2 text-sm'}
                      text-primary-700 dark:text-primary-300
                      hover:bg-primary-50 dark:hover:bg-primary-900/20
                      transition-colors
                    `}
                  >
                    Create custom tag &quot;{normalizedQuery}&quot;
                  </button>
                )}
                {filteredCategories.map(({ category, tags: categoryTags }) => (
                  <div key={category}>
                    {/* Category header */}
                    <div 
                      className={`
                        sticky top-0 bg-gray-50 dark:bg-gray-900 
                        ${compact ? 'px-2 py-1 text-[10px]' : 'px-3 py-1.5 text-xs'}
                        font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide
                        border-b border-gray-100 dark:border-gray-700
                      `}
                    >
                      {category}
                    </div>
                    {/* Tags in this category */}
                    <ul>
                      {categoryTags.map(tag => {
                        const isSelected = selectedSet.has(tag);
                        return (
                          <li key={tag}>
                            <button
                              type="button"
                              onClick={() => toggleTag(tag)}
                              className={`
                                w-full flex items-center justify-between
                                ${compact ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-sm'}
                                hover:bg-gray-100 dark:hover:bg-gray-700
                                transition-colors text-left
                                ${isSelected 
                                  ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300' 
                                  : 'text-gray-700 dark:text-gray-300'
                                }
                              `}
                            >
                              <span>{tag}</span>
                              {isSelected && (
                                <Check className={`text-primary-600 dark:text-primary-400 ${compact ? 'w-3.5 h-3.5' : 'w-4 h-4'}`} />
                              )}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tag count summary */}
      {tags.length > 0 && (
        <div className={`${compact ? 'mt-1 text-[10px]' : 'mt-1.5 text-xs'} text-gray-500 dark:text-gray-400`}>
          {tags.length} tag{tags.length !== 1 ? 's' : ''} selected
        </div>
      )}
    </div>
  );
}
