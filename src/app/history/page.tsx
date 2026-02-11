'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { format } from 'date-fns';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { getPracticePlans, deletePracticePlan, refreshPlanDrillData } from '@/lib/db';
import type { PracticePlan, TimelineItem, DrillItem, ParallelSplitItem } from '@/lib/types';
import { flattenTimelineDrills, getTimelineItemDuration, secondsToDurationString, PRACTICE_DURATIONS, DRILL_TAG_CATEGORIES, DRILL_TAG_CATEGORY_NAMES, getTagColor } from '@/lib/types';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { HelpTooltip } from '@/components/ui/HelpTooltip';
import { 
  exportPracticePlanToPDF, 
  exportPracticePlanToWord, 
  printPracticePlan 
} from '@/lib/export';
import { 
  History, 
  Calendar, 
  Clock, 
  MapPin, 
  FileText,
  Download,
  Printer,
  Trash2,
  Eye,
  ChevronDown,
  ChevronUp,
  GitBranch,
  Image as ImageIcon,
  Search,
  Filter,
  ArrowUpDown,
  Check,
  X,
  Users
} from 'lucide-react';
import { LAYOUT_STYLES } from '@/lib/layoutConfig';

const FILTER_STORAGE_KEY = 'practice-plans-filter';
const SORT_STORAGE_KEY = 'practice-plans-sort';
const SORT_OPTIONS = [
  { value: 'name-asc', label: 'Name (A–Z)' },
  { value: 'name-desc', label: 'Name (Z–A)' },
  { value: 'date-desc', label: 'Date (Newest)' },
  { value: 'date-asc', label: 'Date (Oldest)' },
  { value: 'updated-desc', label: 'Recently Updated' },
  { value: 'drills-desc', label: 'Most Drills' },
  { value: 'drills-asc', label: 'Least Drills' },
] as const;
const DATE_RANGE_OPTIONS = [
  { value: 'all', label: 'All Dates' },
  { value: 'last-30', label: 'Last 30 Days' },
  { value: 'last-90', label: 'Last 90 Days' },
  { value: 'season', label: 'This Season' },
] as const;
const GROUP_FILTER_OPTIONS = [
  { value: 'all', label: 'All Plans' },
  { value: 'with-groups', label: 'With Groups' },
  { value: 'no-groups', label: 'Without Groups' },
] as const;

const getPlanDate = (plan: PracticePlan) => {
  return plan.date instanceof Date ? plan.date : new Date(plan.date);
};

const getLocationLabel = (location: PracticePlan['location']) => {
  if (!location) return '';
  if (typeof location === 'string') return location;
  return location.name || location.formattedAddress || '';
};

// Helper to extract image preview from sketch data
function getSketchImagePreview(sketchData?: string): string | null {
  if (!sketchData) return null;
  try {
    const data = JSON.parse(sketchData);
    return data.imagePreview || null;
  } catch {
    return null;
  }
}

// Helper to split setup text into bullet points (by sentences)
function splitSetupIntoBullets(setup: string): string[] {
  if (!setup) return [];
  // Split by sentence endings (. ! ?) followed by space or end of string
  // Also handle cases where sentences might be separated by newlines
  const sentences = setup
    .split(/(?<=[.!?])\s+|\n+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);
  return sentences;
}

// Component to render a single drill item
function DrillItemView({ item, index }: { item: DrillItem; index?: number }) {
  const duration = item.customDuration || item.drill.duration;
  const hasVariations = item.selectedVariations && item.selectedVariations.length > 0;
  const sketchImage = getSketchImagePreview(item.drill.sketchData);
  
  return (
    <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
      <div className="flex items-center gap-3">
        {index !== undefined && (
          <span className="w-6 h-6 flex items-center justify-center bg-primary-100 dark:bg-primary-900/30 rounded-full text-xs font-bold text-primary-700 dark:text-primary-300">
            {index + 1}
          </span>
        )}
        <span className="font-medium text-gray-900 dark:text-white text-sm flex-1">
          {item.drill.name}
        </span>
        {sketchImage && <ImageIcon className="w-3.5 h-3.5 text-gray-400" />}
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {duration}
        </span>
        <span className="text-xs px-2 py-0.5 rounded bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
          {item.drill.category}
        </span>
      </div>
      {hasVariations && (
        <div className="mt-1.5 ml-9 flex items-center gap-1.5">
          <span className="text-[10px] font-medium text-gray-700 dark:text-gray-300">Variations:</span>
          <span className="text-[10px] text-gray-600 dark:text-gray-400">
            {item.selectedVariations!.join(', ')}
          </span>
        </div>
      )}
    </div>
  );
}

// Component to render a parallel split
function ParallelSplitView({ item }: { item: ParallelSplitItem }) {
  const duration = getTimelineItemDuration(item);
  return (
    <div className="border-2 border-dashed border-primary-300 dark:border-primary-700 rounded-lg p-3 bg-primary-50/50 dark:bg-primary-900/20">
      <div className="flex items-center gap-2 mb-2">
        <GitBranch className="w-4 h-4 text-primary-600 dark:text-primary-400" />
        <span className="text-sm font-medium text-primary-700 dark:text-primary-300">
          Parallel Groups ({item.groups.length})
        </span>
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {secondsToDurationString(duration)}
        </span>
      </div>
      <div className={`grid gap-3 ${
        item.groups.length === 2 ? 'grid-cols-2' :
        item.groups.length === 3 ? 'grid-cols-3' : 'grid-cols-4'
      }`}>
        {item.groups.map(group => (
          <div 
            key={group.id} 
            className="rounded-lg border-2 overflow-hidden"
            style={{ borderColor: group.color + '40' }}
          >
            <div 
              className="px-2 py-1.5 text-xs font-medium"
              style={{ backgroundColor: group.color + '20', color: group.color }}
            >
              {group.name} ({group.items.length})
            </div>
            <div className="p-2 space-y-1 bg-white dark:bg-gray-800">
              {group.items.map((groupItem) => (
                <TimelineItemView key={groupItem.id} item={groupItem} compact />
              ))}
              {group.items.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-2">No drills</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Component to render any timeline item
function TimelineItemView({ item, index, compact = false }: { item: TimelineItem; index?: number; compact?: boolean }) {
  if (item.type === 'drill') {
    if (compact) {
      const duration = item.customDuration || item.drill.duration;
      const hasVariations = item.selectedVariations && item.selectedVariations.length > 0;
      return (
        <div className="p-1.5 bg-gray-50 dark:bg-gray-700 rounded text-xs">
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-900 dark:text-white truncate flex-1">
              {item.drill.name}
            </span>
            <span className="text-gray-500 dark:text-gray-400 flex-shrink-0">
              {duration}
            </span>
          </div>
          {hasVariations && (
            <div className="mt-1 text-[10px] text-gray-600 dark:text-gray-400 truncate">
              Vars: {item.selectedVariations!.join(', ')}
            </div>
          )}
        </div>
      );
    }
    return <DrillItemView item={item} index={index} />;
  }
  return <ParallelSplitView item={item} />;
}

// Detailed drill view for modal
function DrillItemModalView({ item, index }: { item: DrillItem; index: number }) {
  const duration = item.customDuration || item.drill.duration;
  const hasVariations = item.selectedVariations && item.selectedVariations.length > 0;
  const sketchImage = getSketchImagePreview(item.drill.sketchData);
  
  return (
    <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
      <div className="flex items-start gap-3">
        <span className="w-8 h-8 flex items-center justify-center bg-primary-100 dark:bg-primary-900/30 rounded-full font-bold text-primary-700 dark:text-primary-300 flex-shrink-0">
          {index + 1}
        </span>
        <div className={`flex-1 min-w-0 ${sketchImage ? 'flex gap-4' : ''}`}>
          {/* Text content */}
          <div className={sketchImage ? 'flex-1 min-w-0' : ''}>
            <div className="flex items-center gap-2 mb-2">
              <h4 className="font-medium text-gray-900 dark:text-white">{item.drill.name}</h4>
              <span className="text-sm text-gray-500 dark:text-gray-400">{duration}</span>
              {item.customDuration && item.customDuration !== item.drill.duration && (
                <span className="text-xs text-primary-600 dark:text-primary-400">(modified)</span>
              )}
            </div>
            {item.drill.objective && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                <strong>Objective:</strong> {item.drill.objective}
              </p>
            )}
            {item.drill.setup && (() => {
              const bullets = splitSetupIntoBullets(item.drill.setup);
              return bullets.length > 1 ? (
                <ul className="text-sm text-gray-600 dark:text-gray-400 mb-1 list-disc list-inside space-y-0.5">
                  {bullets.map((bullet, idx) => (
                    <li key={`setup-${item.id}-${idx}`}>{bullet}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">{item.drill.setup}</p>
              );
            })()}
            {item.drill.execution && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                <strong>Execution:</strong> {item.drill.execution}
              </p>
            )}
            {item.drill.coachingPoints && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                <strong>Coaching Points:</strong> {item.drill.coachingPoints}
              </p>
            )}
            {hasVariations && (
              <p className="text-sm text-gray-600 dark:text-gray-400">
                <strong>Variations:</strong> {item.selectedVariations!.join(', ')}
              </p>
            )}
          </div>
          {/* Sketch Image - right column */}
          {sketchImage && (
            <div className="flex-shrink-0 w-48 border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden bg-white self-start">
              <img 
                src={sketchImage} 
                alt={`Sketch for ${item.drill.name}`}
                className="w-full"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Detailed parallel split view for modal
function ParallelSplitModalView({ item }: { item: ParallelSplitItem }) {
  const duration = getTimelineItemDuration(item);
  return (
    <div className="border-2 border-dashed border-primary-300 dark:border-primary-700 rounded-xl p-4 bg-primary-50/50 dark:bg-primary-900/20">
      <div className="flex items-center gap-2 mb-3">
        <GitBranch className="w-5 h-5 text-primary-600 dark:text-primary-400" />
        <span className="font-semibold text-primary-700 dark:text-primary-300">
          Parallel Groups
        </span>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          ({item.groups.length} groups, {secondsToDurationString(duration)})
        </span>
      </div>
      <div className={`grid gap-4 ${
        item.groups.length === 2 ? 'grid-cols-2' :
        item.groups.length === 3 ? 'grid-cols-3' : 'grid-cols-2 lg:grid-cols-4'
      }`}>
        {item.groups.map(group => (
          <div 
            key={group.id} 
            className="rounded-lg border-2 overflow-hidden bg-white dark:bg-gray-800"
            style={{ borderColor: group.color + '60' }}
          >
            <div 
              className="px-3 py-2 font-medium text-sm"
              style={{ backgroundColor: group.color + '20', color: group.color }}
            >
              {group.name}
            </div>
            <div className="p-3 space-y-2">
              {group.items.map((groupItem, idx) => (
                <TimelineItemModalView key={groupItem.id} item={groupItem} index={idx} nested />
              ))}
              {group.items.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-2">No drills</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Timeline item for modal (with full details)
function TimelineItemModalView({ item, index, nested = false }: { item: TimelineItem; index: number; nested?: boolean }) {
  if (item.type === 'drill') {
    if (nested) {
      const duration = item.customDuration || item.drill.duration;
      const hasVariations = item.selectedVariations && item.selectedVariations.length > 0;
      const sketchImage = getSketchImagePreview(item.drill.sketchData);
      return (
        <div className="p-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <div className={sketchImage ? 'flex gap-2' : ''}>
            {/* Text content */}
            <div className={sketchImage ? 'flex-1 min-w-0' : ''}>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium text-sm text-gray-900 dark:text-white">{item.drill.name}</span>
                <span className="text-xs text-gray-500 dark:text-gray-400">{duration}</span>
              </div>
              {item.drill.objective && (
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  {item.drill.objective}
                </p>
              )}
              {item.drill.setup && (() => {
                const bullets = splitSetupIntoBullets(item.drill.setup);
                return bullets.length > 1 ? (
                  <ul className="text-xs text-gray-600 dark:text-gray-400 list-disc list-inside space-y-0.5">
                    {bullets.map((bullet, idx) => (
                      <li key={`setup-nested-${item.id}-${idx}`}>{bullet}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-gray-600 dark:text-gray-400">{item.drill.setup}</p>
                );
              })()}
              {hasVariations && (
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  <strong>Variations:</strong> {item.selectedVariations!.join(', ')}
                </p>
              )}
            </div>
            {/* Sketch - right column */}
            {sketchImage && (
              <div className="flex-shrink-0 w-24 border border-gray-200 dark:border-gray-600 rounded overflow-hidden bg-white self-start">
                <img 
                  src={sketchImage} 
                  alt={`Sketch for ${item.drill.name}`}
                  className="w-full"
                />
              </div>
            )}
          </div>
        </div>
      );
    }
    return <DrillItemModalView item={item} index={index} />;
  }
  return <ParallelSplitModalView item={item} />;
}

export default function HistoryPage() {
  const [selectedPlan, setSelectedPlan] = useState<PracticePlan | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [expandedPlanId, setExpandedPlanId] = useState<string | null>(null);
  const [practicePlans, setPracticePlans] = useState<PracticePlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState<typeof DATE_RANGE_OPTIONS[number]['value']>('all');
  const [selectedDurations, setSelectedDurations] = useState<Set<string>>(new Set());
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [tagSearchQuery, setTagSearchQuery] = useState('');
  const [isTagDropdownOpen, setIsTagDropdownOpen] = useState(false);
  const tagDropdownRef = useRef<HTMLDivElement>(null);
  const [locationQuery, setLocationQuery] = useState('');
  const [teamNameQuery, setTeamNameQuery] = useState('');
  const [groupFilter, setGroupFilter] = useState<typeof GROUP_FILTER_OPTIONS[number]['value']>('all');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const filterButtonRef = useRef<HTMLButtonElement>(null);
  const filterPopoverRef = useRef<HTMLDivElement>(null);
  const [isSortOpen, setIsSortOpen] = useState(false);
  const sortButtonRef = useRef<HTMLButtonElement>(null);
  const sortPopoverRef = useRef<HTMLDivElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [sortBy, setSortBy] = useState<typeof SORT_OPTIONS[number]['value']>('date-desc');

  // Fetch practice plans
  const fetchPlans = useCallback(async () => {
    try {
      setIsLoading(true);
      const plans = await getPracticePlans();
      // Ensure all plans have timeline and refresh drill data (for updated sketches, etc.)
      const refreshedPlans = await Promise.all(
        plans.map(plan => refreshPlanDrillData(plan))
      );
      setPracticePlans(refreshedPlans);
    } catch (error) {
      console.error('Failed to fetch practice plans:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load plans on mount
  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

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

  // Load saved filters + sort from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(FILTER_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as {
          dateRange?: typeof dateRange;
          durations?: string[];
          tags?: string[];
          locationQuery?: string;
          teamNameQuery?: string;
          groupFilter?: typeof groupFilter;
        };
        if (parsed.dateRange && DATE_RANGE_OPTIONS.some(opt => opt.value === parsed.dateRange)) {
          setDateRange(parsed.dateRange);
        }
        if (parsed.durations && parsed.durations.length > 0) {
          setSelectedDurations(new Set(parsed.durations));
        }
        if (parsed.tags) {
          setSelectedTags(new Set(parsed.tags));
        }
        if (typeof parsed.locationQuery === 'string') {
          setLocationQuery(parsed.locationQuery);
        }
        if (typeof parsed.teamNameQuery === 'string') {
          setTeamNameQuery(parsed.teamNameQuery);
        }
        if (parsed.groupFilter && GROUP_FILTER_OPTIONS.some(opt => opt.value === parsed.groupFilter)) {
          setGroupFilter(parsed.groupFilter);
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
          dateRange,
          durations: Array.from(selectedDurations),
          tags: Array.from(selectedTags),
          locationQuery,
          teamNameQuery,
          groupFilter,
        })
      );
      localStorage.setItem(SORT_STORAGE_KEY, sortBy);
    } catch (error) {
      console.error('Failed to save filters:', error);
    }
  }, [dateRange, selectedDurations, selectedTags, locationQuery, teamNameQuery, groupFilter, sortBy, isLoaded]);

  const handleDelete = async (plan: PracticePlan) => {
    if (plan.id && confirm(`Are you sure you want to delete "${plan.name}"?`)) {
      await deletePracticePlan(plan.id);
      await fetchPlans();
    }
  };

  const handleView = (plan: PracticePlan) => {
    setSelectedPlan(plan);
    setIsViewModalOpen(true);
  };

  const handleExportPDF = async (plan: PracticePlan) => {
    await exportPracticePlanToPDF(plan);
  };

  const handleExportWord = async (plan: PracticePlan) => {
    await exportPracticePlanToWord(plan);
  };

  const handlePrint = async (plan: PracticePlan) => {
    await printPracticePlan(plan);
  };

  const toggleExpand = (planId: string | undefined) => {
    if (planId === undefined) return;
    setExpandedPlanId(expandedPlanId === planId ? null : planId);
  };

  const clearAllFilters = () => {
    setDateRange('all');
    setSelectedDurations(new Set());
    setSelectedTags(new Set());
    setLocationQuery('');
    setTeamNameQuery('');
    setGroupFilter('all');
  };

  const toggleDuration = (duration: string) => {
    const next = new Set(selectedDurations);
    if (next.has(duration)) {
      next.delete(duration);
    } else {
      next.add(duration);
    }
    setSelectedDurations(next);
  };

  const toggleTag = (tag: string) => {
    const next = new Set(selectedTags);
    if (next.has(tag)) {
      next.delete(tag);
    } else {
      next.add(tag);
    }
    setSelectedTags(next);
  };

  const removeTag = (tag: string) => {
    const next = new Set(selectedTags);
    next.delete(tag);
    setSelectedTags(next);
  };

  const isWithinDateRange = useCallback((planDate: Date) => {
    if (dateRange === 'all') return true;
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (dateRange === 'last-30') {
      const cutoff = new Date(startOfToday);
      cutoff.setDate(cutoff.getDate() - 30);
      return planDate >= cutoff;
    }
    if (dateRange === 'last-90') {
      const cutoff = new Date(startOfToday);
      cutoff.setDate(cutoff.getDate() - 90);
      return planDate >= cutoff;
    }
    // Hockey season: Aug 1 -> Jul 31
    const seasonStartYear = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
    const seasonStart = new Date(seasonStartYear, 7, 1);
    const seasonEnd = new Date(seasonStartYear + 1, 6, 31, 23, 59, 59, 999);
    return planDate >= seasonStart && planDate <= seasonEnd;
  }, [dateRange]);

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

  const planSummaries = useMemo(() => {
    return practicePlans.map((plan) => {
      const timelineDrills = plan.timeline ? flattenTimelineDrills(plan.timeline) : [];
      const allDrills = timelineDrills.length > 0 ? timelineDrills : plan.drills;
      const drillNames = allDrills.map(d => d.drill.name);
      const tagSet = new Set<string>();
      for (const drill of allDrills) {
        if (drill.drill.tags && drill.drill.tags.length > 0) {
          for (const tag of drill.drill.tags) {
            tagSet.add(tag);
          }
        }
      }
      const hasGroups = !!plan.timeline?.some(item => item.type === 'parallel');
      const drillCount = timelineDrills.length || plan.drills.length;
      return { plan, drillCount, hasGroups, planDate: getPlanDate(plan), drillNames, tagSet };
    });
  }, [practicePlans]);

  const filteredPlans = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return planSummaries.filter(({ plan, drillCount, hasGroups, planDate, drillNames, tagSet }) => {
      const locationLabel = getLocationLabel(plan.location);
      const matchesSearch = !query || [
        plan.name,
        plan.description,
        plan.notes,
        ...drillNames,
      ]
        .filter(Boolean)
        .some(value => value.toLowerCase().includes(query));

      const matchesDateRange = isWithinDateRange(planDate);

      const matchesDuration =
        selectedDurations.size === 0 || selectedDurations.has(plan.duration);

      const matchesTags =
        selectedTags.size === 0 ||
        Array.from(selectedTags).some(tag => tagSet.has(tag));

      const matchesLocation =
        !locationQuery.trim() ||
        locationLabel.toLowerCase().includes(locationQuery.trim().toLowerCase());

      const matchesTeamName =
        !teamNameQuery.trim() ||
        plan.teamName?.toLowerCase().includes(teamNameQuery.trim().toLowerCase());

      const matchesGroup =
        groupFilter === 'all' ||
        (groupFilter === 'with-groups' && hasGroups) ||
        (groupFilter === 'no-groups' && !hasGroups);

      return matchesSearch && matchesDateRange && matchesDuration && matchesTags && matchesLocation && matchesTeamName && matchesGroup && drillCount >= 0;
    });
  }, [planSummaries, searchQuery, selectedDurations, selectedTags, locationQuery, teamNameQuery, groupFilter, isWithinDateRange]);

  const sortedPlans = useMemo(() => {
    const plansToSort = [...filteredPlans];
    plansToSort.sort((a, b) => {
      const getName = (p: PracticePlan) => p.name?.toLowerCase() ?? '';
      switch (sortBy) {
        case 'name-asc':
          return getName(a.plan).localeCompare(getName(b.plan));
        case 'name-desc':
          return getName(b.plan).localeCompare(getName(a.plan));
        case 'date-asc':
          return a.planDate.getTime() - b.planDate.getTime();
        case 'date-desc':
          return b.planDate.getTime() - a.planDate.getTime();
        case 'updated-desc': {
          const aUpdated = a.plan.updatedAt ? new Date(a.plan.updatedAt).getTime() : 0;
          const bUpdated = b.plan.updatedAt ? new Date(b.plan.updatedAt).getTime() : 0;
          return bUpdated - aUpdated;
        }
        case 'drills-asc':
          return a.drillCount - b.drillCount;
        case 'drills-desc':
          return b.drillCount - a.drillCount;
        default:
          return b.planDate.getTime() - a.planDate.getTime();
      }
    });
    return plansToSort;
  }, [filteredPlans, sortBy]);

  const hasActiveFilters = dateRange !== 'all' ||
    selectedDurations.size > 0 ||
    selectedTags.size > 0 ||
    locationQuery.trim().length > 0 ||
    teamNameQuery.trim().length > 0 ||
    groupFilter !== 'all';
  const activeFilterCount =
    (dateRange !== 'all' ? 1 : 0) +
    (selectedDurations.size > 0 ? 1 : 0) +
    (selectedTags.size > 0 ? 1 : 0) +
    (locationQuery.trim().length > 0 ? 1 : 0) +
    (teamNameQuery.trim().length > 0 ? 1 : 0) +
    (groupFilter !== 'all' ? 1 : 0);

  // Layout config - see src/lib/layoutConfig.ts to adjust
  const S = LAYOUT_STYLES;

  return (
    <ProtectedRoute>
    <div className="mx-auto" style={S.container}>
      {/* Header */}
      <div style={S.pageHeaderWrapper}>
        <div className="flex items-center gap-2 mb-1">
          <History 
            className="text-primary-600 dark:text-primary-400" 
            style={S.pageHeaderIcon}
          />
          <h1 
            className="font-bold text-gray-900 dark:text-white"
            style={S.pageHeaderTitle}
          >
            Previous Practice Plans
          </h1>
        </div>
        <p className="text-gray-600 dark:text-gray-400" style={S.pageHeaderSubtitle}>
          View, export, and manage your saved practice plans
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
              placeholder="Search practice plans..."
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
                className="absolute right-0 top-full mt-2 w-96 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50"
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

                  {/* Date Range Filter */}
                  <div className="mb-4">
                    <div className="flex items-center gap-1.5 mb-2">
                      <label htmlFor="filter-date-range" className="block text-xs font-medium text-gray-600 dark:text-gray-400">
                        Date Range
                      </label>
                      <HelpTooltip text="Date Range" iconClassName="w-3 h-3" />
                    </div>
                    <select
                      id="filter-date-range"
                      value={dateRange}
                      onChange={(e) => setDateRange(e.target.value as typeof dateRange)}
                      className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm py-2 px-3 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    >
                      {DATE_RANGE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Duration Filter */}
                  <div className="mb-4">
                    <div className="flex items-center gap-1.5 mb-2">
                      <p className="block text-xs font-medium text-gray-600 dark:text-gray-400">
                        Duration
                      </p>
                      <HelpTooltip text="Duration" iconClassName="w-3 h-3" />
                    </div>
                    {selectedDurations.size > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {Array.from(selectedDurations).map(duration => (
                          <span
                            key={duration}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300"
                          >
                            {duration}
                            <button
                              type="button"
                              onClick={() => toggleDuration(duration)}
                              className="hover:opacity-70"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {PRACTICE_DURATIONS.map(duration => (
                        <button
                          key={duration}
                          type="button"
                          onClick={() => toggleDuration(duration)}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors text-center whitespace-nowrap ${
                            selectedDurations.has(duration)
                              ? 'bg-primary-50 dark:bg-primary-900/20 border-primary-300 dark:border-primary-700 text-primary-700 dark:text-primary-300'
                              : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
                          }`}
                        >
                          {duration}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Tags Filter */}
                  <div className="mb-4">
                    <div className="flex items-center gap-1.5 mb-2">
                      <label htmlFor="filter-tags" className="block text-xs font-medium text-gray-600 dark:text-gray-400">
                        Tags
                      </label>
                      <HelpTooltip text="Tags" iconClassName="w-3 h-3" />
                    </div>
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

                  {/* Location Filter */}
                  <div className="mb-4">
                    <div className="flex items-center gap-1.5 mb-2">
                      <label htmlFor="filter-location" className="block text-xs font-medium text-gray-600 dark:text-gray-400">
                        Location
                      </label>
                      <HelpTooltip text="Filter by location..." iconClassName="w-3 h-3" />
                    </div>
                    <Input
                      id="filter-location"
                      value={locationQuery}
                      onChange={(e) => setLocationQuery(e.target.value)}
                      placeholder="Filter by location..."
                      className="text-sm"
                    />
                  </div>

                  {/* Team Name Filter */}
                  <div className="mb-4">
                    <div className="flex items-center gap-1.5 mb-2">
                      <label htmlFor="filter-team-name" className="block text-xs font-medium text-gray-600 dark:text-gray-400">
                        Team Name
                      </label>
                      <HelpTooltip text="Filter by team name..." iconClassName="w-3 h-3" />
                    </div>
                    <Input
                      id="filter-team-name"
                      value={teamNameQuery}
                      onChange={(e) => setTeamNameQuery(e.target.value)}
                      placeholder="Filter by team name..."
                      className="text-sm"
                    />
                  </div>

                  {/* Groups Filter */}
                  <div className="mb-2">
                    <div className="flex items-center gap-1.5 mb-2">
                      <label htmlFor="filter-groups" className="block text-xs font-medium text-gray-600 dark:text-gray-400">
                        Groups
                      </label>
                      <HelpTooltip text="Groups" iconClassName="w-3 h-3" />
                    </div>
                    <select
                      id="filter-groups"
                      value={groupFilter}
                      onChange={(e) => setGroupFilter(e.target.value as typeof groupFilter)}
                      className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm py-2 px-3 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    >
                      {GROUP_FILTER_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
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
        </div>
      </div>

      {/* Practice Plans List */}
      {isLoading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-3"></div>
          <p className="text-gray-500 dark:text-gray-400">Loading practice plans...</p>
        </div>
      ) : sortedPlans && sortedPlans.length > 0 ? (
        <div className="space-y-3">
          {sortedPlans.map(({ plan, planDate }) => {
            const isExpanded = expandedPlanId === plan.id;
            const locationLabel = getLocationLabel(plan.location);
            
            return (
              <Card key={plan.id} className="overflow-hidden" style={S.card}>
                {/* Main Info */}
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                        {plan.name}
                      </h3>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-xs text-gray-600 dark:text-gray-400">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>{format(planDate, 'MMM d, yyyy')}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          <span>{plan.duration}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5" />
                          <span>{locationLabel || '—'}</span>
                        </div>
                        {plan.teamName && (
                          <div className="flex items-center gap-1">
                            <Users className="w-3.5 h-3.5" />
                            <span>{plan.teamName}</span>
                          </div>
                        )}
                      </div>
                      {plan.description && (
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 line-clamp-1">
                          {plan.description}
                        </p>
                      )}
                    </div>
                    
                    {/* Quick Actions */}
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant="ghost" onClick={() => handleView(plan)}>
                        <Eye className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => toggleExpand(plan.id)}>
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </Button>
                    </div>
                  </div>

                  {/* Drills Summary */}
                  {(() => {
                    const allDrills = plan.timeline ? flattenTimelineDrills(plan.timeline) : [];
                    const hasParallel = plan.timeline?.some(item => item.type === 'parallel');
                    return (
                      <div className="mt-2 flex items-center gap-2 flex-wrap">
                        <FileText className="w-3.5 h-3.5 text-gray-400" />
                        <span className="text-xs text-gray-600 dark:text-gray-400">
                          {allDrills.length} drill{allDrills.length !== 1 ? 's' : ''}
                        </span>
                        {hasParallel && (
                          <span className="flex items-center gap-0.5 text-[10px] text-primary-600 dark:text-primary-400">
                            <GitBranch className="w-2.5 h-2.5" />
                            Groups
                          </span>
                        )}
                        <div className="flex gap-1 ml-1">
                          {allDrills.slice(0, 3).map((d) => (
                            <span 
                              key={d.id} 
                              className="px-1.5 py-0.5 text-[10px] rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
                            >
                              {d.drill.name}
                            </span>
                          ))}
                          {allDrills.length > 3 && (
                            <span className="text-[10px] text-gray-500 dark:text-gray-400">
                              +{allDrills.length - 3} more
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Expanded Section */}
                {isExpanded && (
                  <div className="border-t border-gray-100 dark:border-gray-800 pt-3 mt-3">
                    {/* Export Buttons */}
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      <Button size="sm" variant="secondary" onClick={() => handleExportPDF(plan)}>
                        <Download className="w-3.5 h-3.5" />
                        PDF
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => handleExportWord(plan)}>
                        <Download className="w-3.5 h-3.5" />
                        Word
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => handlePrint(plan)}>
                        <Printer className="w-3.5 h-3.5" />
                        Print
                      </Button>
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        onClick={() => handleDelete(plan)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 ml-auto"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete
                      </Button>
                    </div>

                    {/* Timeline Items */}
                    <div className="space-y-1.5">
                      <h4 className="text-xs font-medium text-gray-700 dark:text-gray-300">Practice Plan:</h4>
                      {plan.timeline && plan.timeline.length > 0 ? (
                        <div className="space-y-2">
                          {plan.timeline.map((item, index) => (
                            <TimelineItemView key={item.id} item={item} index={item.type === 'drill' ? index : undefined} />
                          ))}
                        </div>
                      ) : (
                        // Fallback to legacy drills if no timeline
                        plan.drills.map((item, index) => (
                          <div 
                            key={item.id} 
                            className="flex items-center gap-3 p-2 bg-gray-50 dark:bg-gray-800 rounded-lg"
                          >
                            <span className="w-6 h-6 flex items-center justify-center bg-primary-100 dark:bg-primary-900/30 rounded-full text-xs font-bold text-primary-700 dark:text-primary-300">
                              {index + 1}
                            </span>
                            <span className="font-medium text-gray-900 dark:text-white text-sm">
                              {item.drill.name}
                            </span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {item.drill.duration}
                            </span>
                            <span className="text-xs px-2 py-0.5 rounded bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                              {item.drill.category}
                            </span>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Equipment and Notes */}
                    {plan.equipment && (
                      <div className="mt-3">
                        <h4 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-0.5">Equipment:</h4>
                        <p className="text-xs text-gray-600 dark:text-gray-400">{plan.equipment}</p>
                      </div>
                    )}
                    {plan.notes && (
                      <div className="mt-3">
                        <h4 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-0.5">Notes:</h4>
                        <p className="text-xs text-gray-600 dark:text-gray-400">{plan.notes}</p>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-8 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
          <History className="w-10 h-10 text-gray-400 mx-auto mb-3" />
          <h3 className="text-base font-medium text-gray-900 dark:text-white mb-1">
            {searchQuery || hasActiveFilters ? 'No plans found' : 'No practice plans yet'}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {searchQuery || hasActiveFilters
              ? 'Try adjusting your search or filters'
              : 'Create your first practice plan to see it here'}
          </p>
        </div>
      )}

      {/* View Modal */}
      <Modal
        isOpen={isViewModalOpen}
        onClose={() => {
          setIsViewModalOpen(false);
          setSelectedPlan(null);
        }}
        title={selectedPlan?.name || 'Practice Plan'}
        size="lg"
      >
        {selectedPlan && (
          <div className="space-y-6">
            {/* Practice Info */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Date</p>
                <p className="font-medium text-gray-900 dark:text-white">
                  {format(selectedPlan.date instanceof Date ? selectedPlan.date : new Date(selectedPlan.date), 'MMMM d, yyyy')}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Duration</p>
                <p className="font-medium text-gray-900 dark:text-white">{selectedPlan.duration}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Location</p>
                <p className="font-medium text-gray-900 dark:text-white">
                  {getLocationLabel(selectedPlan.location)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Team</p>
                <p className="font-medium text-gray-900 dark:text-white">
                  {selectedPlan.teamName || '—'}
                </p>
              </div>
            </div>

            {selectedPlan.description && (
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Description</p>
                <p className="text-gray-900 dark:text-white">{selectedPlan.description}</p>
              </div>
            )}

            {selectedPlan.equipment && (
              <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl">
                <p className="text-sm font-medium text-amber-800 dark:text-amber-300 mb-1">Equipment Needed</p>
                <p className="text-amber-700 dark:text-amber-400">{selectedPlan.equipment}</p>
              </div>
            )}

            {/* Practice Timeline */}
            <div>
              {(() => {
                const allDrills = selectedPlan.timeline ? flattenTimelineDrills(selectedPlan.timeline) : [];
                return (
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                    Practice Plan ({allDrills.length} drills)
                  </h3>
                );
              })()}
              <div className="space-y-3">
                {selectedPlan.timeline && selectedPlan.timeline.length > 0 ? (
                  selectedPlan.timeline.map((item, index) => (
                    <TimelineItemModalView key={item.id} item={item} index={index} />
                  ))
                ) : (
                  // Fallback to legacy drills
                  selectedPlan.drills.map((item, index) => (
                    <div key={item.id} className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
                      <div className="flex items-start gap-3">
                        <span className="w-8 h-8 flex items-center justify-center bg-primary-100 dark:bg-primary-900/30 rounded-full font-bold text-primary-700 dark:text-primary-300">
                          {index + 1}
                        </span>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="font-medium text-gray-900 dark:text-white">{item.drill.name}</h4>
                            <span className="text-sm text-gray-500 dark:text-gray-400">{item.drill.duration}</span>
                          </div>
                          {item.drill.objective && (
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                              <strong>Objective:</strong> {item.drill.objective}
                            </p>
                          )}
                          {item.drill.setup && (() => {
                            const bullets = splitSetupIntoBullets(item.drill.setup);
                            return bullets.length > 1 ? (
                              <ul className="text-sm text-gray-600 dark:text-gray-400 mb-1 list-disc list-inside space-y-0.5">
                                {bullets.map((bullet, idx) => (
                                  <li key={`setup-legacy-${item.id}-${idx}`}>{bullet}</li>
                                ))}
                              </ul>
                            ) : (
                              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">{item.drill.setup}</p>
                            );
                          })()}
                          {item.drill.execution && (
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                              <strong>Execution:</strong> {item.drill.execution}
                            </p>
                          )}
                          {item.drill.coachingPoints && (
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              <strong>Coaching Points:</strong> {item.drill.coachingPoints}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {selectedPlan.notes && (
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                <p className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-1">Notes</p>
                <p className="text-blue-700 dark:text-blue-400">{selectedPlan.notes}</p>
              </div>
            )}

            {/* Export Actions */}
            <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-800">
              <Button variant="secondary" onClick={() => handleExportPDF(selectedPlan)}>
                <Download className="w-4 h-4" />
                Export PDF
              </Button>
              <Button variant="secondary" onClick={() => handleExportWord(selectedPlan)}>
                <Download className="w-4 h-4" />
                Export Word
              </Button>
              <Button variant="secondary" onClick={() => handlePrint(selectedPlan)}>
                <Printer className="w-4 h-4" />
                Print
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
    </ProtectedRoute>
  );
}
