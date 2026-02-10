'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useAuth } from '@/components/AuthProvider';
import { getDrills, getDrillByName, getDrillWithAuditInfo, createDrill, updateDrill, deleteDrill } from '@/lib/db';
import type { Drill, DrillCategory } from '@/lib/types';
import { DRILL_CATEGORIES, DRILL_TAG_CATEGORIES, DRILL_TAG_CATEGORY_NAMES, getTagColor } from '@/lib/types';
import { DrillCard } from '@/components/drills/DrillCard';
import { DrillForm } from '@/components/drills/DrillForm';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { HelpTooltip } from '@/components/ui/HelpTooltip';
import { Plus, Search, Library, Save, Filter, X, Check, ChevronDown, LayoutGrid, Rows, ArrowUpDown } from 'lucide-react';
import { LAYOUT_STYLES } from '@/lib/layoutConfig';

const FILTER_STORAGE_KEY = 'drills-filter';
const SORT_STORAGE_KEY = 'drills-sort';
const SORT_OPTIONS = [
  { value: 'name-asc', label: 'Name (A–Z)' },
  { value: 'name-desc', label: 'Name (Z–A)' },
  { value: 'category-asc', label: 'Category (A–Z)' },
  { value: 'updated-desc', label: 'Recently Updated' },
  { value: 'created-desc', label: 'Recently Created' },
] as const;

export default function DrillsPage() {
  const { user } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDrill, setEditingDrill] = useState<Drill | null>(null);
  const [newDrillKey, setNewDrillKey] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<Set<DrillCategory>>(
    new Set(DRILL_CATEGORIES)
  );
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [tagSearchQuery, setTagSearchQuery] = useState('');
  const [isTagDropdownOpen, setIsTagDropdownOpen] = useState(false);
  const tagDropdownRef = useRef<HTMLDivElement>(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const filterButtonRef = useRef<HTMLButtonElement>(null);
  const filterPopoverRef = useRef<HTMLDivElement>(null);
  const [isSortOpen, setIsSortOpen] = useState(false);
  const sortButtonRef = useRef<HTMLButtonElement>(null);
  const sortPopoverRef = useRef<HTMLDivElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [drills, setDrills] = useState<Drill[]>([]);
  const [isLoadingDrills, setIsLoadingDrills] = useState(true);
  const [cardLayout, setCardLayout] = useState<'rect' | 'square'>('rect');
  const [sortBy, setSortBy] = useState<'name-asc' | 'name-desc' | 'category-asc' | 'updated-desc' | 'created-desc'>('name-asc');

  // Filter tags by category based on search
  const filteredTagCategories = useMemo(() => {
    const query = tagSearchQuery.toLowerCase().trim();
    if (!query) {
      return DRILL_TAG_CATEGORY_NAMES.map(category => ({
        category,
        tags: [...DRILL_TAG_CATEGORIES[category]],
      }));
    }
    return DRILL_TAG_CATEGORY_NAMES
      .map(category => ({
        category,
        tags: DRILL_TAG_CATEGORIES[category].filter(tag => 
          tag.toLowerCase().includes(query)
        ),
      }))
      .filter(({ tags }) => tags.length > 0);
  }, [tagSearchQuery]);

  // Close tag dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (tagDropdownRef.current && !tagDropdownRef.current.contains(event.target as Node)) {
        setIsTagDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  // Duplicate name modal state
  const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);
  const [duplicateDrillId, setDuplicateDrillId] = useState<string | null>(null);
  const [pendingDrillData, setPendingDrillData] = useState<Omit<Drill, 'id' | 'createdAt' | 'updatedAt'> | null>(null);
  const [newDrillName, setNewDrillName] = useState('');
  const [isSaveAsNew, setIsSaveAsNew] = useState(false);
  const [showOverwriteConfirm, setShowOverwriteConfirm] = useState(false);

  // Fetch drills from database
  const fetchDrills = useCallback(async () => {
    try {
      setIsLoadingDrills(true);
      const data = await getDrills();
      setDrills(data);
    } catch (error) {
      console.error('Failed to fetch drills:', error);
    } finally {
      setIsLoadingDrills(false);
    }
  }, []);

  // Load drills on mount
  useEffect(() => {
    fetchDrills();
  }, [fetchDrills]);

  // Close filter popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        isFilterOpen &&
        filterPopoverRef.current &&
        filterButtonRef.current &&
        !filterPopoverRef.current.contains(event.target as Node) &&
        !filterButtonRef.current.contains(event.target as Node)
      ) {
        setIsFilterOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isFilterOpen]);

  // Close sort popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        isSortOpen &&
        sortPopoverRef.current &&
        sortButtonRef.current &&
        !sortPopoverRef.current.contains(event.target as Node) &&
        !sortButtonRef.current.contains(event.target as Node)
      ) {
        setIsSortOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isSortOpen]);

  // Load saved filters + sort from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(FILTER_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as { categories: DrillCategory[]; tags?: string[] };
        if (parsed.categories) {
          setSelectedCategories(new Set(parsed.categories));
        }
        if (parsed.tags) {
          setSelectedTags(new Set(parsed.tags));
        }
      }
      const savedSort = localStorage.getItem(SORT_STORAGE_KEY);
      if (savedSort && SORT_OPTIONS.some(option => option.value === savedSort)) {
        setSortBy(savedSort as typeof sortBy);
      }
    } catch (error) {
      console.error('Failed to load filters:', error);
    }
    setIsLoaded(true);
  }, []);

  // Save filters + sort to localStorage
  useEffect(() => {
    if (!isLoaded) return;
    try {
      localStorage.setItem(
        FILTER_STORAGE_KEY,
        JSON.stringify({
          categories: Array.from(selectedCategories),
          tags: Array.from(selectedTags),
        })
      );
      localStorage.setItem(SORT_STORAGE_KEY, sortBy);
    } catch (error) {
      console.error('Failed to save filters:', error);
    }
  }, [selectedCategories, selectedTags, sortBy, isLoaded]);

  const isAllCategoriesSelected = selectedCategories.size === DRILL_CATEGORIES.length;
  const hasTagsFilter = selectedTags.size > 0;
  const hasActiveFilters = !isAllCategoriesSelected || hasTagsFilter;
  const activeFilterCount = 
    (isAllCategoriesSelected ? 0 : 1) + 
    (hasTagsFilter ? 1 : 0);

  const clearAllFilters = () => {
    setSelectedCategories(new Set(DRILL_CATEGORIES));
    setSelectedTags(new Set());
  };

  const toggleTag = (tag: string) => {
    const newTags = new Set(selectedTags);
    if (newTags.has(tag)) {
      newTags.delete(tag);
    } else {
      newTags.add(tag);
    }
    setSelectedTags(newTags);
  };

  const removeTag = (tag: string) => {
    const newTags = new Set(selectedTags);
    newTags.delete(tag);
    setSelectedTags(newTags);
  };

  const filteredDrills = drills?.filter((drill) => {
    const matchesSearch = drill.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      drill.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      drill.objective.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategories.has(drill.category);
    // If no tags selected, match all. Otherwise, drill must have at least one of the selected tags
    const matchesTags = selectedTags.size === 0 || 
      drill.tags?.some(tag => selectedTags.has(tag));
    return matchesSearch && matchesCategory && matchesTags;
  });

  const sortedDrills = useMemo(() => {
    if (!filteredDrills) return [];
    const drillsToSort = [...filteredDrills];
    const getName = (drill: Drill) => drill.name?.toLowerCase() ?? '';
    const getCategory = (drill: Drill) => drill.category?.toLowerCase() ?? '';
    const getTime = (value?: Date | string | null) => (value ? new Date(value).getTime() : 0);

    drillsToSort.sort((a, b) => {
      switch (sortBy) {
        case 'name-asc':
          return getName(a).localeCompare(getName(b));
        case 'name-desc':
          return getName(b).localeCompare(getName(a));
        case 'category-asc': {
          const categoryCompare = getCategory(a).localeCompare(getCategory(b));
          if (categoryCompare !== 0) return categoryCompare;
          return getName(a).localeCompare(getName(b));
        }
        case 'updated-desc': {
          const updatedDiff = getTime(b.updatedAt) - getTime(a.updatedAt);
          if (updatedDiff !== 0) return updatedDiff;
          return getName(a).localeCompare(getName(b));
        }
        case 'created-desc': {
          const createdDiff = getTime(b.createdAt) - getTime(a.createdAt);
          if (createdDiff !== 0) return createdDiff;
          return getName(a).localeCompare(getName(b));
        }
        default:
          return getName(a).localeCompare(getName(b));
      }
    });

    return drillsToSort;
  }, [filteredDrills, sortBy]);

  const handleSave = async (drillData: Omit<Drill, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      // Check for existing drill with the same name (excluding current drill if editing)
      const existingDrill = await getDrillByName(drillData.name);
      
      if (existingDrill?.id && existingDrill.id !== editingDrill?.id) {
        // Name collision with a different drill - show modal
        setDuplicateDrillId(existingDrill.id);
        setPendingDrillData(drillData);
        setNewDrillName(drillData.name + ' (copy)');
        setIsSaveAsNew(false);
        setIsDuplicateModalOpen(true);
        return;
      }

      // No collision, proceed with save
      await performSave(drillData);
    } catch (error) {
      console.error('Error during save:', error);
      // If there's an error checking for duplicates, try to save anyway
      await performSave(drillData);
    }
  };

  const handleSaveAsNew = async (drillData: Omit<Drill, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      // Check for existing drill with the same name
      const existingDrill = await getDrillByName(drillData.name);
      
      if (existingDrill?.id) {
        // Name collision - show modal
        setDuplicateDrillId(existingDrill.id);
        setPendingDrillData(drillData);
        setNewDrillName(drillData.name + ' (copy)');
        setIsSaveAsNew(true);
        setIsDuplicateModalOpen(true);
        return;
      }

      // No collision, proceed with creating new drill
      await performSaveAsNew(drillData);
    } catch (error) {
      console.error('Error during save as new:', error);
      // If there's an error checking for duplicates, try to save anyway
      await performSaveAsNew(drillData);
    }
  };

  // Actual save logic (no duplicate check)
  const performSave = async (drillData: Omit<Drill, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (editingDrill?.id) {
      await updateDrill(editingDrill.id, drillData, user?.id);
    } else {
      await createDrill(drillData, user?.id);
    }
    await fetchDrills();
    setIsModalOpen(false);
    setEditingDrill(null);
  };

  // Actual save as new logic (no duplicate check)
  const performSaveAsNew = async (drillData: Omit<Drill, 'id' | 'createdAt' | 'updatedAt'>) => {
    await createDrill(drillData, user?.id);
    await fetchDrills();
    setIsModalOpen(false);
    setEditingDrill(null);
  };

  // Handle overwriting an existing drill
  const handleOverwriteDrillClick = () => {
    setShowOverwriteConfirm(true);
  };

  const handleConfirmOverwriteDrill = async () => {
    if (duplicateDrillId && pendingDrillData) {
      await updateDrill(duplicateDrillId, pendingDrillData, user?.id);
      await fetchDrills();
      setIsModalOpen(false);
      setEditingDrill(null);
    }
    setShowOverwriteConfirm(false);
    closeDuplicateModal();
  };

  // Handle saving with a new name
  const handleSaveWithNewName = async () => {
    if (!pendingDrillData) return;

    // Check if the new name is also a duplicate
    const existingDrill = await getDrillByName(newDrillName);
    if (existingDrill) {
      alert('A drill with this name already exists. Please choose a different name.');
      return;
    }

    const drillDataWithNewName = { ...pendingDrillData, name: newDrillName };
    
    if (isSaveAsNew) {
      await performSaveAsNew(drillDataWithNewName);
    } else if (editingDrill?.id) {
      // When editing, save with new name means update the current drill
      await updateDrill(editingDrill.id, drillDataWithNewName, user?.id);
      await fetchDrills();
      setIsModalOpen(false);
      setEditingDrill(null);
    } else {
      await performSaveAsNew(drillDataWithNewName);
    }
    
    closeDuplicateModal();
  };

  const closeDuplicateModal = () => {
    setIsDuplicateModalOpen(false);
    setDuplicateDrillId(null);
    setPendingDrillData(null);
    setNewDrillName('');
  };

  const handleCardClick = async (drill: Drill) => {
    // Fetch drill with audit info for display in the form
    if (drill.id) {
      const drillWithAudit = await getDrillWithAuditInfo(drill.id);
      setEditingDrill(drillWithAudit || drill);
    } else {
      setEditingDrill(drill);
    }
    setIsModalOpen(true);
  };

  const handleDelete = async (drill: Drill) => {
    if (drill.id) {
      await deleteDrill(drill.id);
      await fetchDrills();
      setIsModalOpen(false);
      setEditingDrill(null);
    }
  };

  const handleNewDrill = () => {
    try {
      localStorage.removeItem('drill-form-new');
    } catch (error) {
      console.error('Failed to clear new drill form data:', error);
    }
    setEditingDrill(null);
    setNewDrillKey(prev => prev + 1);
    setIsModalOpen(true);
  };

  const categoryColors: Record<string, string> = {
    Admin: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-300 dark:border-slate-600',
    Skating: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-blue-300 dark:border-blue-700',
    Shooting: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 border-red-300 dark:border-red-700',
    Passing: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 border-green-300 dark:border-green-700',
    Defensive: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 border-purple-300 dark:border-purple-700',
    Offensive: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 border-orange-300 dark:border-orange-700',
    Goalie: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300 border-yellow-300 dark:border-yellow-700',
    Scrimmage: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300 border-cyan-300 dark:border-cyan-700',
    Other: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border-gray-300 dark:border-gray-600',
  };

  // Layout config - see src/lib/layoutConfig.ts to adjust
  const S = LAYOUT_STYLES;

  return (
    <ProtectedRoute>
    <div className="mx-auto" style={S.container}>
      {/* Header */}
      <div style={S.pageHeaderWrapper}>
        <div className="flex items-center gap-2 mb-1">
          <Library 
            className="text-primary-600 dark:text-primary-400" 
            style={S.pageHeaderIcon}
          />
          <h1 
            className="font-bold text-gray-900 dark:text-white"
            style={S.pageHeaderTitle}
          >
            Drills Library
          </h1>
        </div>
        <p className="text-gray-600 dark:text-gray-400" style={S.pageHeaderSubtitle}>
          Browse, create, and manage your hockey drills
        </p>
      </div>

      {/* Search and Actions Bar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="flex-1 flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search drills..."
              className="pl-9 text-sm"
            />
          </div>
          
          {/* Filter Button */}
          <div className="relative">
            <button
              ref={filterButtonRef}
              type="button"
              onClick={() => setIsFilterOpen(!isFilterOpen)}
              className={`
                flex items-center gap-1.5 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all h-full
                ${hasActiveFilters
                  ? 'bg-primary-50 dark:bg-primary-900/20 border-primary-300 dark:border-primary-700 text-primary-700 dark:text-primary-300'
                  : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                }
              `}
            >
              <Filter className="w-4 h-4" />
              {activeFilterCount > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-primary-600 text-white">
                  {activeFilterCount}
                </span>
              )}
            </button>

            {/* Filter Popover */}
            {isFilterOpen && (
              <div
                ref={filterPopoverRef}
                className="absolute right-0 top-full mt-2 w-72 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50"
              >
                <div className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Filters</h3>
                    {hasActiveFilters && (
                      <button
                        type="button"
                        onClick={clearAllFilters}
                        className="text-xs text-primary-600 dark:text-primary-400 hover:underline"
                      >
                        Clear all
                      </button>
                    )}
                  </div>

                  {/* Category Filter */}
                  <div className="mb-4">
                    <div className="flex items-center gap-1.5 mb-2">
                      <label htmlFor="filter-category" className="block text-xs font-medium text-gray-600 dark:text-gray-400">
                        Category
                      </label>
                      <HelpTooltip text="Category" iconClassName="w-3 h-3" />
                    </div>
                    <select
                      id="filter-category"
                      value={isAllCategoriesSelected ? 'all' : Array.from(selectedCategories)[0] || 'all'}
                      onChange={(e) => {
                        if (e.target.value === 'all') {
                          setSelectedCategories(new Set(DRILL_CATEGORIES));
                        } else {
                          setSelectedCategories(new Set([e.target.value as DrillCategory]));
                        }
                      }}
                      className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm py-2 px-3 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    >
                      <option value="all">All Categories</option>
                      {DRILL_CATEGORIES.map((category) => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Tags Filter */}
                  <div className="mb-4">
                    <div className="flex items-center gap-1.5 mb-2">
                      <label htmlFor="filter-tags" className="block text-xs font-medium text-gray-600 dark:text-gray-400">
                        Tags
                      </label>
                      <HelpTooltip text="Tags" iconClassName="w-3 h-3" />
                    </div>
                    {/* Selected tags pills */}
                    {selectedTags.size > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {Array.from(selectedTags).map(tag => (
                          <span
                            key={tag}
                            className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs ${getTagColor(tag)}`}
                          >
                            {tag}
                            <button type="button" onClick={() => removeTag(tag)} className="hover:opacity-70">
                              <X className="w-2.5 h-2.5" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                    {/* Tag search dropdown */}
                    <div className="relative" ref={tagDropdownRef}>
                      <div
                        className="flex items-center gap-2 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 cursor-pointer"
                        onClick={() => setIsTagDropdownOpen(!isTagDropdownOpen)}
                        onKeyDown={(e) => { if (e.key === 'Enter') setIsTagDropdownOpen(!isTagDropdownOpen); }}
                        role="combobox"
                        aria-expanded={isTagDropdownOpen}
                        tabIndex={0}
                      >
                        <Search className="w-3.5 h-3.5 text-gray-400" />
                        <input
                          id="filter-tags"
                          type="text"
                          value={tagSearchQuery}
                          onChange={(e) => { setTagSearchQuery(e.target.value); setIsTagDropdownOpen(true); }}
                          onFocus={() => setIsTagDropdownOpen(true)}
                          placeholder={selectedTags.size > 0 ? "Add more..." : "Search tags..."}
                          className="flex-1 bg-transparent outline-none text-sm text-gray-900 dark:text-white placeholder-gray-400"
                          onClick={(e) => e.stopPropagation()}
                        />
                        <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${isTagDropdownOpen ? 'rotate-180' : ''}`} />
                      </div>
                      {isTagDropdownOpen && (
                        <div className="absolute z-50 left-0 right-0 mt-1 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg max-h-56 overflow-y-auto">
                          {filteredTagCategories.length === 0 ? (
                            <div className="p-2 text-sm text-gray-500 text-center">No tags found</div>
                          ) : (
                            <div className="py-1">
                              {filteredTagCategories.map(({ category, tags: categoryTags }) => (
                                <div key={category}>
                                  <div className="sticky top-0 bg-gray-100 dark:bg-gray-800 px-3 py-1 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                                    {category}
                                  </div>
                                  <ul>
                                    {categoryTags.map(tag => (
                                      <li key={tag}>
                                        <button
                                          type="button"
                                          onClick={() => { toggleTag(tag); setTagSearchQuery(''); }}
                                          className={`w-full flex items-center justify-between px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-600 text-left ${
                                            selectedTags.has(tag) ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300' : 'text-gray-700 dark:text-gray-300'
                                          }`}
                                        >
                                          <span>{tag}</span>
                                          {selectedTags.has(tag) && <Check className="w-3.5 h-3.5" />}
                                        </button>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Active Filters Summary */}
                  {hasActiveFilters && (
                    <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                      <div className="flex flex-wrap gap-1.5">
                        {!isAllCategoriesSelected && Array.from(selectedCategories).map((cat) => (
                          <span
                            key={cat}
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${categoryColors[cat]}`}
                          >
                            {cat}
                            <button
                              type="button"
                              onClick={() => setSelectedCategories(new Set(DRILL_CATEGORIES))}
                              className="hover:opacity-70"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                        {hasTagsFilter && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300">
                            {selectedTags.size} tag{selectedTags.size !== 1 ? 's' : ''}
                            <button
                              type="button"
                              onClick={() => setSelectedTags(new Set())}
                              className="hover:opacity-70"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Sort Button */}
          <div className="relative">
            <button
              ref={sortButtonRef}
              type="button"
              onClick={() => setIsSortOpen(!isSortOpen)}
              className={`
                flex items-center gap-1.5 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all h-full
                ${isSortOpen
                  ? 'bg-primary-50 dark:bg-primary-900/20 border-primary-300 dark:border-primary-700 text-primary-700 dark:text-primary-300'
                  : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                }
              `}
            >
              <ArrowUpDown className="w-4 h-4" />
            </button>

            {isSortOpen && (
              <div
                ref={sortPopoverRef}
                className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50"
              >
                <div className="py-1">
                  {SORT_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        setSortBy(option.value);
                        setIsSortOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 text-left ${
                        sortBy === option.value
                          ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                          : 'text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      <span>{option.label}</span>
                      {sortBy === option.value && <Check className="w-4 h-4" />}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="inline-flex rounded-xl border border-gray-300 dark:border-gray-600 overflow-hidden h-full">
            <button
              type="button"
              onClick={() => setCardLayout('rect')}
              aria-pressed={cardLayout === 'rect'}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium transition-all ${
                cardLayout === 'rect'
                  ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              <Rows className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setCardLayout('square')}
              aria-pressed={cardLayout === 'square'}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium transition-all border-l border-gray-300 dark:border-gray-600 ${
                cardLayout === 'square'
                  ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>

        </div>
        <Button size="sm" onClick={handleNewDrill}>
          <Plus className="w-4 h-4" />
          New Drill
        </Button>
      </div>

      {/* Drills Grid */}
      {isLoadingDrills ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-3"></div>
          <p className="text-gray-500 dark:text-gray-400">Loading drills...</p>
        </div>
      ) : sortedDrills && sortedDrills.length > 0 ? (
        <div
          className={
            cardLayout === 'square'
              ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'
              : 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3'
          }
        >
          {sortedDrills.map((drill) => (
            <DrillCard
              key={drill.id}
              drill={drill}
              onClick={handleCardClick}
              cardLayout={cardLayout}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-8 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
          <Library className="w-10 h-10 text-gray-400 mx-auto mb-3" />
          <h3 className="text-base font-medium text-gray-900 dark:text-white mb-1">
            {searchQuery || hasActiveFilters ? 'No drills found' : 'No drills yet'}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
            {searchQuery || hasActiveFilters
              ? 'Try adjusting your search or filters'
              : 'Create your first drill to get started'}
          </p>
          {!searchQuery && !hasActiveFilters && (
            <Button size="sm" onClick={handleNewDrill}>
              <Plus className="w-4 h-4" />
              Create First Drill
            </Button>
          )}
        </div>
      )}

      {/* Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingDrill(null);
        }}
        title={editingDrill ? 'Edit Drill' : 'Create New Drill'}
        size="drill"
      >
        <DrillForm
          key={editingDrill ? `drill-${editingDrill.id ?? 'temp'}` : `new-${newDrillKey}`}
          drill={editingDrill}
          onSave={handleSave}
          onCreateNew={editingDrill ? handleSaveAsNew : undefined}
          onDelete={editingDrill ? handleDelete : undefined}
          onCancel={() => {
            setIsModalOpen(false);
            setEditingDrill(null);
          }}
        />
      </Modal>

      {/* Duplicate Name Modal */}
      <Modal
        isOpen={isDuplicateModalOpen}
        onClose={closeDuplicateModal}
        title="Drill Name Already Exists"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-gray-600 dark:text-gray-400">
            A drill named <strong className="text-gray-900 dark:text-white">&quot;{pendingDrillData?.name}&quot;</strong> already exists.
          </p>
          
          <div className="space-y-3">
            <Button
              variant="primary"
              className="w-full justify-center"
              onClick={handleOverwriteDrillClick}
            >
              <Save className="w-4 h-4" />
              Overwrite Existing Drill
            </Button>
            
            <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
              <div className="flex items-center gap-1.5 mb-2">
                <label 
                  htmlFor="newDrillName" 
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Or save with a different name:
                </label>
                <HelpTooltip text="Enter new name" iconClassName="w-3.5 h-3.5" />
              </div>
              <Input
                id="newDrillName"
                type="text"
                value={newDrillName}
                onChange={(e) => setNewDrillName(e.target.value)}
                placeholder="Enter new name"
              />
              <Button
                variant="outline"
                className="w-full justify-center mt-2"
                onClick={handleSaveWithNewName}
                disabled={!newDrillName.trim()}
              >
                <Plus className="w-4 h-4" />
                Save with New Name
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Overwrite Confirmation Modal */}
      <Modal
        isOpen={showOverwriteConfirm}
        onClose={() => setShowOverwriteConfirm(false)}
        title="Confirm Overwrite"
        size="sm"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <Save className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-gray-700 dark:text-gray-300">
                Are you sure you want to overwrite the existing drill?
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                <strong>&quot;{pendingDrillData?.name}&quot;</strong> will be permanently replaced with your current drill data. This action cannot be undone.
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowOverwriteConfirm(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleConfirmOverwriteDrill}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              <Save className="w-4 h-4" />
              Overwrite Drill
            </Button>
          </div>
        </div>
      </Modal>
    </div>
    </ProtectedRoute>
  );
}
