'use client';

import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { DRILL_TAG_CATEGORIES, DRILL_TAG_CATEGORY_NAMES, TAG_CATEGORY_COLORS, getTagColor } from '@/lib/types';
import type { DrillTagCategory } from '@/lib/types';
import { X, Search, Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { HelpTooltip } from '@/components/ui/HelpTooltip';

interface InlineTagPickerProps {
  value: string[];
  onChange: (value: string[]) => void;
  label?: string;
  maxHeight?: string;
  helpText?: string;
}

export function InlineTagPicker({ value, onChange, label, maxHeight = '160px', helpText }: InlineTagPickerProps) {
  const [activeCategory, setActiveCategory] = useState<DrillTagCategory>(DRILL_TAG_CATEGORY_NAMES[0]);
  const [searchQuery, setSearchQuery] = useState('');
  const [focusedTagIndex, setFocusedTagIndex] = useState(-1);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const tagGridRef = useRef<HTMLDivElement>(null);
  const categoryTabsRef = useRef<HTMLDivElement>(null);
  const tagButtonRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  // Ensure value is always an array
  const tags = value ?? [];
  const selectedSet = useMemo(() => new Set(tags), [tags]);

  // Get tags for active category, filtered by search
  const activeCategoryTags = useMemo(() => {
    const categoryTags = [...DRILL_TAG_CATEGORIES[activeCategory]];
    if (!searchQuery.trim()) return categoryTags;
    return categoryTags.filter(tag => 
      tag.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [activeCategory, searchQuery]);

  // Get all matching tags across categories when searching
  const allMatchingTags = useMemo(() => {
    if (!searchQuery.trim()) return null;
    const query = searchQuery.toLowerCase();
    const matches: { tag: string; category: DrillTagCategory }[] = [];
    
    for (const category of DRILL_TAG_CATEGORY_NAMES) {
      for (const tag of DRILL_TAG_CATEGORIES[category]) {
        if (tag.toLowerCase().includes(query)) {
          matches.push({ tag, category });
        }
      }
    }
    return matches;
  }, [searchQuery]);

  // Count selected tags per category for badges
  const selectedCountByCategory = useMemo(() => {
    const counts: Partial<Record<DrillTagCategory, number>> = {};
    for (const tag of tags) {
      for (const category of DRILL_TAG_CATEGORY_NAMES) {
        if ((DRILL_TAG_CATEGORIES[category] as readonly string[]).includes(tag)) {
          counts[category] = (counts[category] || 0) + 1;
          break;
        }
      }
    }
    return counts;
  }, [tags]);

  const toggleTag = useCallback((tag: string) => {
    if (selectedSet.has(tag)) {
      onChange(tags.filter(t => t !== tag));
    } else {
      onChange([...tags, tag]);
    }
  }, [selectedSet, tags, onChange]);

  const removeTag = useCallback((tag: string) => {
    onChange(tags.filter(t => t !== tag));
  }, [tags, onChange]);

  const clearAll = useCallback(() => {
    onChange([]);
  }, [onChange]);

  // Auto-scroll to focused tag
  useEffect(() => {
    if (focusedTagIndex >= 0) {
      const currentTags = allMatchingTags 
        ? allMatchingTags.map(m => m.tag) 
        : activeCategoryTags;
      const tag = currentTags[focusedTagIndex];
      if (tag) {
        const button = tagButtonRefs.current.get(tag);
        button?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [focusedTagIndex, allMatchingTags, activeCategoryTags]);

  // Navigate to next/prev category
  const navigateCategory = useCallback((direction: 'next' | 'prev') => {
    const currentIndex = DRILL_TAG_CATEGORY_NAMES.indexOf(activeCategory);
    let newIndex: number;
    if (direction === 'next') {
      newIndex = currentIndex < DRILL_TAG_CATEGORY_NAMES.length - 1 ? currentIndex + 1 : 0;
    } else {
      newIndex = currentIndex > 0 ? currentIndex - 1 : DRILL_TAG_CATEGORY_NAMES.length - 1;
    }
    setActiveCategory(DRILL_TAG_CATEGORY_NAMES[newIndex]);
    setFocusedTagIndex(-1);
  }, [activeCategory]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const currentTags = allMatchingTags 
      ? allMatchingTags.map(m => m.tag) 
      : activeCategoryTags;

    if (e.key === 'Tab' && !searchQuery) {
      // Tab cycles through categories when not searching
      e.preventDefault();
      navigateCategory(e.shiftKey ? 'prev' : 'next');
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      e.preventDefault();
      setFocusedTagIndex(prev => 
        prev < currentTags.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      e.preventDefault();
      setFocusedTagIndex(prev => 
        prev > 0 ? prev - 1 : currentTags.length - 1
      );
    } else if (e.key === 'Enter' && focusedTagIndex >= 0) {
      e.preventDefault();
      const tag = currentTags[focusedTagIndex];
      if (tag) toggleTag(tag);
    } else if (e.key === 'Escape') {
      setSearchQuery('');
      setFocusedTagIndex(-1);
      searchInputRef.current?.blur();
    }
  }, [activeCategoryTags, allMatchingTags, focusedTagIndex, toggleTag, searchQuery, navigateCategory]);

  // Reset focused index when category or search changes
  const handleCategoryChange = useCallback((category: DrillTagCategory) => {
    setActiveCategory(category);
    setSearchQuery('');
    setFocusedTagIndex(-1);
  }, []);

  // Scroll category tabs to show active category
  const scrollCategoryIntoView = useCallback((category: DrillTagCategory) => {
    if (categoryTabsRef.current) {
      const tabs = categoryTabsRef.current;
      const activeTab = tabs.querySelector(`[data-category="${category}"]`) as HTMLElement;
      if (activeTab) {
        const tabsRect = tabs.getBoundingClientRect();
        const activeRect = activeTab.getBoundingClientRect();
        if (activeRect.left < tabsRect.left || activeRect.right > tabsRect.right) {
          activeTab.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
        }
      }
    }
  }, []);

  // Scroll to active category when it changes
  useEffect(() => {
    scrollCategoryIntoView(activeCategory);
  }, [activeCategory, scrollCategoryIntoView]);

  return (
    <div className="w-full">
      {label && (
        <div className="flex items-center gap-1.5 text-[11px] mb-1">
          <div className="block font-medium text-gray-700 dark:text-gray-300">
            {label}
          </div>
          <HelpTooltip text="Select tags to categorize the drill. Tags can be used to filter drills in the practice picker." iconClassName="w-3 h-3" />
        </div>
      )}

      <div className="border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden bg-white dark:bg-gray-800">
        {/* Selected tags row */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1 p-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
            {tags.map(tag => (
              <span
                key={tag}
                className={`
                  inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs
                  ${getTagColor(tag)}
                `}
              >
                {tag}
                <button
                  type="button"
                  onClick={() => removeTag(tag)}
                  className="p-0.5 hover:opacity-70 rounded-full transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            {tags.length > 1 && (
              <button
                type="button"
                onClick={clearAll}
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs
                  bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400
                  hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                Clear all
              </button>
            )}
          </div>
        )}

        {/* Category tabs + search */}
        <div className="flex items-center gap-1 p-1.5 border-b border-gray-200 dark:border-gray-700">
          {/* Previous category button */}
          <button
            type="button"
            onClick={() => navigateCategory('prev')}
            className="flex-shrink-0 p-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title="Previous category (Shift+Tab)"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>

          {/* Scrollable category tabs */}
          <div 
            ref={categoryTabsRef}
            className="flex-1 flex items-center gap-1 overflow-x-auto scrollbar-hide"
          >
            {DRILL_TAG_CATEGORY_NAMES.map(category => {
              const isActive = activeCategory === category && !searchQuery;
              const count = selectedCountByCategory[category];
              return (
                <button
                  key={category}
                  type="button"
                  data-category={category}
                  onClick={() => handleCategoryChange(category)}
                  className={`
                    flex-shrink-0 px-2 py-1 rounded text-xs font-medium transition-all
                    ${isActive 
                      ? `${TAG_CATEGORY_COLORS[category]} shadow-sm`
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }
                  `}
                >
                  {category}
                  {count && count > 0 && (
                    <span className="ml-1 px-1.5 py-0.5 rounded-full bg-primary-500 text-white text-[10px] leading-none font-semibold">
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Next category button */}
          <button
            type="button"
            onClick={() => navigateCategory('next')}
            className="flex-shrink-0 p-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title="Next category (Tab)"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
          
          {/* Search input */}
          <div className="flex-shrink-0 flex items-center gap-1 px-2 py-1 rounded-md bg-gray-100 dark:bg-gray-700 border border-transparent focus-within:border-primary-500 focus-within:ring-1 focus-within:ring-primary-500 transition-all">
            <Search className="w-3.5 h-3.5 text-gray-400" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setFocusedTagIndex(-1);
              }}
              onKeyDown={handleKeyDown}
              placeholder="Search tags..."
              className="w-24 bg-transparent text-xs text-gray-900 dark:text-white placeholder-gray-400 outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="p-0.5 hover:opacity-70 transition-opacity"
              >
                <X className="w-3 h-3 text-gray-400" />
              </button>
            )}
          </div>
        </div>

        {/* Tag grid */}
        <div 
          ref={tagGridRef}
          className="flex flex-wrap gap-1.5 p-2.5 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600"
          style={{ maxHeight }}
        >
          {searchQuery && allMatchingTags ? (
            // Show search results across all categories
            allMatchingTags.length > 0 ? (
              allMatchingTags.map(({ tag, category }, index) => {
                const isSelected = selectedSet.has(tag);
                const isFocused = focusedTagIndex === index;
                return (
                  <button
                    key={`${category}-${tag}`}
                    ref={(el) => {
                      if (el) tagButtonRefs.current.set(tag, el);
                    }}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    className={`
                      inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium
                      transition-all cursor-pointer border
                      ${isSelected 
                        ? `${getTagColor(tag)} border-transparent ring-2 ring-primary-500/50`
                        : 'bg-gray-50 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                      }
                      ${isFocused ? 'ring-2 ring-primary-400 ring-offset-1 dark:ring-offset-gray-800' : ''}
                    `}
                  >
                    {isSelected && <Check className="w-3 h-3 flex-shrink-0" />}
                    <span>{tag}</span>
                    <span className="text-[10px] opacity-50 ml-0.5">({category})</span>
                  </button>
                );
              })
            ) : (
              <div className="w-full text-center text-xs text-gray-500 dark:text-gray-400 py-6">
                No tags found matching &quot;{searchQuery}&quot;
              </div>
            )
          ) : (
            // Show tags for active category
            activeCategoryTags.map((tag, index) => {
              const isSelected = selectedSet.has(tag);
              const isFocused = focusedTagIndex === index;
              return (
                <button
                  key={tag}
                  ref={(el) => {
                    if (el) tagButtonRefs.current.set(tag, el);
                  }}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className={`
                    inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium
                    transition-all cursor-pointer border
                    ${isSelected 
                      ? `${getTagColor(tag)} border-transparent ring-2 ring-primary-500/50`
                      : 'bg-gray-50 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                    }
                    ${isFocused ? 'ring-2 ring-primary-400 ring-offset-1 dark:ring-offset-gray-800' : ''}
                  `}
                >
                  {isSelected && <Check className="w-3 h-3 flex-shrink-0" />}
                  {tag}
                </button>
              );
            })
          )}
        </div>

        {/* Tag count footer */}
        <div className="flex items-center justify-between px-2.5 py-1.5 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
          <span className="text-[10px] text-gray-500 dark:text-gray-400">
            {tags.length} tag{tags.length !== 1 ? 's' : ''} selected
            {!searchQuery && ` • ${activeCategoryTags.length} in ${activeCategory}`}
          </span>
          <span className="text-[10px] text-gray-400 dark:text-gray-500">
            Tab to switch categories • Arrow keys to navigate • Enter to select
          </span>
        </div>
      </div>
    </div>
  );
}
