'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { format } from 'date-fns';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { 
  getPracticePlans,
  getPracticePlanByName,
  createPracticePlan,
  updatePracticePlan,
  getDrillByName,
  ensurePlanHasTimeline,
} from '@/lib/db';
import type { 
  PracticePlan, 
  PracticePlanDrill, 
  Drill,
  PracticeDuration,
  EquipmentOption,
  Location,
} from '@/lib/types';
import type { TimelineItem } from '@/lib/types';
import {
  PRACTICE_DURATIONS, 
  parsePracticeDurationToSeconds,
  parseEquipmentString,
  equipmentSelectionsToString,
  getTimelineDuration,
  flattenTimelineDrills,
  convertDrillsToTimeline,
  convertTimelineToDrills,
  createDrillItem,
  createParallelSplit,
  addGroupToSplit,
  removeGroupFromSplit,
} from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { DrillsList } from '@/components/practice/DrillsList';
import { DrillPicker } from '@/components/practice/DrillPicker';
import { PracticeTimeline } from '@/components/practice/PracticeTimeline';
import { LocationPicker } from '@/components/ui/LocationPicker';
import { 
  ClipboardList, 
  Save, 
  Plus, 
  FileText,
  Clock,
  Trash2,
  GitBranch,
  FolderOpen,
  Calendar,
  MapPin
} from 'lucide-react';
import { LAYOUT_CONFIG, LAYOUT_STYLES, px } from '@/lib/layoutConfig';

const DRAFT_STORAGE_KEY = 'practice-plan-draft';

interface DraftData {
  formData: {
    name: string;
    description: string;
    date: string;
    duration: PracticeDuration;
    location: Location | null;
    notes: string;
  };
  drills: PracticePlanDrill[];
  timeline?: TimelineItem[]; // New: timeline structure (optional for backward compat)
}

const getDefaultFormData = () => ({
  name: format(new Date(), 'MMMM d, yyyy') + ' Practice',
  description: '',
  date: format(new Date(), 'yyyy-MM-dd'),
  duration: '50 minutes' as PracticeDuration,
  location: null as Location | null,
  notes: '',
});

const getLocationLabel = (location: PracticePlan['location']) => {
  if (!location) return '';
  if (typeof location === 'string') return location;
  return location.name || location.formattedAddress || '';
};

export default function CreatePracticePlanPage() {
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isLoadModalOpen, setIsLoadModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  
  // Duplicate name modal state
  const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);
  const [duplicatePlanId, setDuplicatePlanId] = useState<string | null>(null);
  const [newPlanName, setNewPlanName] = useState('');
  const [showOverwriteConfirm, setShowOverwriteConfirm] = useState(false);
  
  const [formData, setFormData] = useState(getDefaultFormData);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  
  // For drill picker context - which group to add drills to (null = main timeline)
  const [activeGroupPath, setActiveGroupPath] = useState<string[] | null>(null);

  // Drill preview modal state
  const [previewDrill, setPreviewDrill] = useState<Drill | null>(null);

  // Saved practice plans state
  const [savedPlans, setSavedPlans] = useState<PracticePlan[]>([]);
  const [isLoadingPlans, setIsLoadingPlans] = useState(false);

  // Fetch saved practice plans
  const fetchSavedPlans = useCallback(async () => {
    try {
      setIsLoadingPlans(true);
      const plans = await getPracticePlans();
      setSavedPlans(plans.map(plan => ensurePlanHasTimeline(plan)));
    } catch (error) {
      console.error('Failed to fetch saved plans:', error);
    } finally {
      setIsLoadingPlans(false);
    }
  }, []);

  // Load saved plans when modal opens
  useEffect(() => {
    if (isLoadModalOpen) {
      fetchSavedPlans();
    }
  }, [isLoadModalOpen, fetchSavedPlans]);
  
  // Compute legacy drills array from timeline for backward compatibility
  const drills = useMemo(() => convertTimelineToDrills(timeline), [timeline]);

  // Load draft from localStorage on mount, or add default drill if no draft
  useEffect(() => {
    const initializePlan = async () => {
      try {
        const saved = localStorage.getItem(DRAFT_STORAGE_KEY);
        if (saved) {
          // Load existing draft
          const draft: DraftData = JSON.parse(saved);
          setFormData(draft.formData);
          // Prefer timeline if available, otherwise convert legacy drills
          if (draft.timeline && draft.timeline.length > 0) {
            setTimeline(draft.timeline);
          } else if (draft.drills && draft.drills.length > 0) {
            setTimeline(convertDrillsToTimeline(draft.drills));
          }
        } else {
          // No draft - add the default "Setup Ice and Warm Ups" drill
          const setupDrill = await getDrillByName('Setup Ice and Warm Ups');
          if (setupDrill?.id) {
            const defaultDrillItem = createDrillItem(setupDrill);
            setTimeline([defaultDrillItem]);
          }
        }
      } catch (error) {
        console.error('Failed to initialize practice plan:', error);
      }
      setIsLoaded(true);
    };
    
    initializePlan();
  }, []);

  // Save draft to localStorage whenever formData or timeline change
  useEffect(() => {
    if (!isLoaded) return; // Don't save until initial load is complete
    
    try {
      const draft: DraftData = { formData, drills, timeline };
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
    } catch (error) {
      console.error('Failed to save draft:', error);
    }
  }, [formData, drills, timeline, isLoaded]);

  // Clear the draft from localStorage
  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch (error) {
      console.error('Failed to clear draft:', error);
    }
  }, []);

  // Calculate total drill time (using custom durations if set)
  const totalDrillTime = useMemo(() => {
    return getTimelineDuration(timeline);
  }, [timeline]);

  // Calculate available practice time based on selected duration
  const availablePracticeTime = useMemo(() => {
    return parsePracticeDurationToSeconds(formData.duration);
  }, [formData.duration]);

  // Calculate remaining time
  const remainingTime = availablePracticeTime - totalDrillTime;

  const formatTime = (seconds: number) => {
    const absSeconds = Math.abs(seconds);
    const mins = Math.floor(absSeconds / 60);
    const secs = absSeconds % 60;
    const sign = seconds < 0 ? '-' : '';
    return `${sign}${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Auto-calculate equipment (take max quantity for each type across all drills)
  const equipment = useMemo(() => {
    const maxQuantities = new Map<string, number>();
    const allDrills = flattenTimelineDrills(timeline);
    
    // Go through each drill's equipment
    for (const d of allDrills) {
      if (!d.drill.equipment) continue;
      
      const selections = parseEquipmentString(d.drill.equipment);
      
      // For each equipment item, keep the maximum quantity
      for (const selection of selections) {
        const current = maxQuantities.get(selection.item) || 0;
        if (selection.quantity > current) {
          maxQuantities.set(selection.item, selection.quantity);
        }
      }
    }
    
    // Convert back to string format
    const consolidatedSelections = Array.from(maxQuantities.entries())
      .map(([item, quantity]) => ({ 
        item: item as EquipmentOption, 
        quantity 
      }));
    
    return equipmentSelectionsToString(consolidatedSelections);
  }, [timeline]);

  // Helper to update an item deep in the timeline tree
  const updateTimelineItem = useCallback((
    items: TimelineItem[],
    itemId: string,
    updater: (item: TimelineItem) => TimelineItem | null
  ): TimelineItem[] => {
    return items.flatMap(item => {
      if (item.id === itemId) {
        const updated = updater(item);
        return updated ? [updated] : [];
      }
      if (item.type === 'parallel') {
        return [{
          ...item,
          groups: item.groups.map(group => ({
            ...group,
            items: updateTimelineItem(group.items, itemId, updater)
          }))
        }];
      }
      return [item];
    });
  }, []);

  // Helper to add item to a specific group in the timeline
  const addItemToTimeline = useCallback((
    items: TimelineItem[],
    newItem: TimelineItem,
    groupPath: string[] | null
  ): TimelineItem[] => {
    if (!groupPath || groupPath.length === 0) {
      // Add to main timeline
      return [...items, newItem];
    }
    
    const [parallelId, groupId, ...restPath] = groupPath;
    return items.map(item => {
      if (item.id === parallelId && item.type === 'parallel') {
        return {
          ...item,
          groups: item.groups.map(group => {
            if (group.id === groupId) {
              return {
                ...group,
                items: addItemToTimeline(group.items, newItem, restPath.length > 0 ? restPath : null)
              };
            }
            return group;
          })
        };
      }
      return item;
    });
  }, []);

  const handleAddDrill = (drill: Drill) => {
    if (!drill.id) return;
    const newDrillItem = createDrillItem(drill);
    setTimeline(prev => addItemToTimeline(prev, newDrillItem, activeGroupPath));
  };

  const handleRemoveDrill = (id: string) => {
    setTimeline(prev => updateTimelineItem(prev, id, () => null));
  };

  const handleReorderTimeline = (reorderedItems: TimelineItem[]) => {
    setTimeline(reorderedItems);
  };

  // Reorder items within a specific group
  const handleReorderGroup = (parallelId: string, groupId: string, reorderedItems: TimelineItem[]) => {
    setTimeline(prev => prev.map(item => {
      if (item.id === parallelId && item.type === 'parallel') {
        return {
          ...item,
          groups: item.groups.map(group => {
            if (group.id === groupId) {
              return { ...group, items: reorderedItems };
            }
            return group;
          })
        };
      }
      return item;
    }));
  };

  const handleUpdateDuration = (id: string, duration: string) => {
    setTimeline(prev => updateTimelineItem(prev, id, item => {
      if (item.type === 'drill') {
        return { ...item, customDuration: duration };
      }
      return item;
    }));
  };

  const handleUpdateVariations = (id: string, variations: string[]) => {
    setTimeline(prev => updateTimelineItem(prev, id, item => {
      if (item.type === 'drill') {
        return { ...item, selectedVariations: variations };
      }
      return item;
    }));
  };

  // Update drill overrides for practice-specific modifications
  const handleUpdateOverrides = (id: string, overrides: Partial<Drill> | undefined) => {
    setTimeline(prev => updateTimelineItem(prev, id, item => {
      if (item.type === 'drill') {
        return { ...item, overrides };
      }
      return item;
    }));
  };

  // Add a parallel split to the main timeline
  const handleAddParallelSplit = () => {
    const newSplit = createParallelSplit(2);
    setTimeline(prev => [...prev, newSplit]);
  };

  // Add a parallel split inside a group (nested)
  const handleAddNestedSplit = (parallelId: string, groupId: string) => {
    const newSplit = createParallelSplit(2);
    setTimeline(prev => prev.map(item => {
      if (item.id === parallelId && item.type === 'parallel') {
        return {
          ...item,
          groups: item.groups.map(group => {
            if (group.id === groupId) {
              return { ...group, items: [...group.items, newSplit] };
            }
            return group;
          })
        };
      }
      return item;
    }));
  };

  // Add a group to an existing parallel split
  const handleAddGroup = (parallelId: string) => {
    setTimeline(prev => updateTimelineItem(prev, parallelId, item => {
      if (item.type === 'parallel' && item.groups.length < 4) {
        return addGroupToSplit(item);
      }
      return item;
    }));
  };

  // Remove a group from a parallel split
  const handleRemoveGroup = (parallelId: string, groupId: string) => {
    setTimeline(prev => updateTimelineItem(prev, parallelId, item => {
      if (item.type === 'parallel' && item.groups.length > 2) {
        return removeGroupFromSplit(item, groupId);
      }
      return item;
    }));
  };

  // Remove an entire parallel split
  const handleRemoveParallelSplit = (id: string) => {
    setTimeline(prev => updateTimelineItem(prev, id, () => null));
  };

  // Update group name
  const handleUpdateGroupName = (parallelId: string, groupId: string, name: string) => {
    setTimeline(prev => prev.map(item => {
      if (item.id === parallelId && item.type === 'parallel') {
        return {
          ...item,
          groups: item.groups.map(group => {
            if (group.id === groupId) {
              return { ...group, name };
            }
            return group;
          })
        };
      }
      return item;
    }));
  };

  // Open drill picker for a specific group
  const handleOpenPickerForGroup = (groupPath: string[] | null) => {
    setActiveGroupPath(groupPath);
    setIsPickerOpen(true);
  };

  // Helper to add the default "Setup Ice and Warm Ups" drill
  const addDefaultSetupDrill = useCallback(async () => {
    try {
      const setupDrill = await getDrillByName('Setup Ice and Warm Ups');
      if (setupDrill?.id) {
        const defaultDrillItem = createDrillItem(setupDrill);
        setTimeline([defaultDrillItem]);
      } else {
        setTimeline([]);
      }
    } catch (error) {
      console.error('Failed to add default drill:', error);
      setTimeline([]);
    }
  }, []);

  const handleSave = async () => {
    if (timeline.length === 0) {
      alert('Please add at least one drill to the practice plan.');
      return;
    }

    // Check for existing plan with the same name
    const existingPlan = await getPracticePlanByName(formData.name);
    if (existingPlan?.id) {
      // Open duplicate modal to ask user what to do
      setDuplicatePlanId(existingPlan.id);
      setNewPlanName(formData.name + ' (copy)');
      setIsDuplicateModalOpen(true);
      return;
    }

    await saveNewPlan();
  };

  // Save as a new plan (no duplicate check)
  const saveNewPlan = async (overrideName?: string) => {
    setIsSaving(true);
    try {
      const practicePlan: Omit<PracticePlan, 'id' | 'createdAt' | 'updatedAt'> = {
        name: overrideName || formData.name,
        description: formData.description,
        date: new Date(formData.date),
        duration: formData.duration,
        location: formData.location,
        drills: drills, // Legacy format for backward compatibility
        timeline: timeline, // New branching timeline
        notes: formData.notes,
        equipment: equipment,
      };

      await createPracticePlan(practicePlan);
      
      // Update the form name if we used an override name
      if (overrideName) {
        setFormData(prev => ({ ...prev, name: overrideName }));
      }
      
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error('Failed to save practice plan:', error);
      alert('Failed to save practice plan. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // Overwrite an existing plan
  const overwritePlan = async (planId: string) => {
    setIsSaving(true);
    try {
      await updatePracticePlan(planId, {
        name: formData.name,
        description: formData.description,
        date: new Date(formData.date),
        duration: formData.duration,
        location: formData.location,
        drills: drills,
        timeline: timeline,
        notes: formData.notes,
        equipment: equipment,
      });
      
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error('Failed to overwrite practice plan:', error);
      alert('Failed to overwrite practice plan. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle duplicate modal actions
  const handleOverwritePlanClick = () => {
    setShowOverwriteConfirm(true);
  };

  const handleConfirmOverwritePlan = async () => {
    if (duplicatePlanId) {
      await overwritePlan(duplicatePlanId);
    }
    setShowOverwriteConfirm(false);
    setIsDuplicateModalOpen(false);
    setDuplicatePlanId(null);
  };

  const handleSaveAsNew = async () => {
    // Check if the new name is also a duplicate
    const existingPlan = await getPracticePlanByName(newPlanName);
    if (existingPlan) {
      alert('A plan with this name already exists. Please choose a different name.');
      return;
    }
    await saveNewPlan(newPlanName);
    setIsDuplicateModalOpen(false);
    setDuplicatePlanId(null);
  };

  const handleClear = async () => {
    if (confirm('Are you sure you want to clear the practice plan?')) {
      clearDraft();
      setFormData(getDefaultFormData());
      
      // Re-add the default setup drill
      await addDefaultSetupDrill();
    }
  };

  const handleLoadPlan = (plan: PracticePlan) => {
    // Load the plan data into the form
    setFormData({
      name: plan.name,
      description: plan.description || '',
      date: format(new Date(plan.date), 'yyyy-MM-dd'),
      duration: plan.duration,
      location: plan.location,
      notes: plan.notes || '',
    });
    
    // Load the timeline (prefer timeline, fall back to converting drills)
    if (plan.timeline && plan.timeline.length > 0) {
      setTimeline(plan.timeline);
    } else if (plan.drills && plan.drills.length > 0) {
      setTimeline(convertDrillsToTimeline(plan.drills));
    } else {
      setTimeline([]);
    }
    
    setIsLoadModalOpen(false);
  };

  const durationOptions = PRACTICE_DURATIONS.map((d) => ({ value: d, label: d }));


  /*
   * LAYOUT VALUES - Edit src/lib/layoutConfig.ts to adjust these
   * The LAYOUT_STYLES object provides pre-computed CSS for inline styles
   */
  const L = LAYOUT_CONFIG;
  const S = LAYOUT_STYLES;

  return (
    <ProtectedRoute>
    <div 
      className="mx-auto h-[calc(100vh-3rem)] lg:h-[calc(100vh-2.5rem)] flex flex-col"
      style={{ maxWidth: px(L.maxWidth) }}
    >
      {/* Header */}
      <div className="flex-shrink-0" style={S.pageHeader}>
        <div className="flex items-center gap-2">
          <ClipboardList 
            className="text-primary-600 dark:text-primary-400" 
            style={S.headerIcon}
          />
          <h1 
            className="font-bold text-gray-900 dark:text-white"
            style={S.headerTitle}
          >
            Create Practice Plan
          </h1>
        </div>
      </div>

      {/* Main Content - 5-column grid: 1 for details, 4 for drills */}
      <div 
        className="flex-1 min-h-0 grid grid-cols-1 xl:grid-cols-5"
        style={S.columnGap}
      >
        {/* Left Column - Practice Details (narrower: 1/5 = 20%) */}
        <div className="xl:col-span-1 flex flex-col gap-2 min-h-0">
          <Card className="flex-1 overflow-y-auto" style={S.detailsCard}>
            <h2 
              className="font-semibold text-gray-900 dark:text-white flex items-center gap-1.5"
              style={S.detailsHeader}
            >
              <FileText className="w-3.5 h-3.5" />
              Details
            </h2>
            
            <div className="flex flex-col" style={S.detailsFieldSpacing}>
              <div>
                <label 
                  htmlFor="name" 
                  className="block font-medium text-gray-700 dark:text-gray-300 mb-1"
                  style={S.detailsLabel}
                >
                  Practice Name
                </label>
                <input
                  id="name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Enter practice name"
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  style={S.detailsInput}
                />
              </div>

              <div className="grid grid-cols-2" style={S.formRowGap}>
                <div>
                  <label 
                    htmlFor="date" 
                    className="block font-medium text-gray-700 dark:text-gray-300 mb-1"
                    style={S.detailsLabel}
                  >
                    Date
                  </label>
                  <input
                    id="date"
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    style={S.detailsInput}
                  />
                </div>

                <div>
                  <label 
                    htmlFor="duration" 
                    className="block font-medium text-gray-700 dark:text-gray-300 mb-1"
                    style={S.detailsLabel}
                  >
                    Duration
                  </label>
                  <select
                    id="duration"
                    value={formData.duration}
                    onChange={(e) => setFormData({ ...formData, duration: e.target.value as PracticeDuration })}
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    style={S.detailsInput}
                  >
                    {durationOptions.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <LocationPicker
                  label="Location"
                  value={formData.location}
                  onChange={(location) => setFormData({ ...formData, location })}
                  placeholder="Search for a location..."
                  compact
                  style={S.detailsInput}
                />
              </div>

              <div>
                <label 
                  htmlFor="notes" 
                  className="block font-medium text-gray-700 dark:text-gray-300 mb-1"
                  style={S.detailsLabel}
                >
                  Notes
                </label>
                <textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Additional notes..."
                  rows={2}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
                  style={S.detailsInput}
                />
              </div>

              {/* Equipment Summary */}
              {equipment && (
                <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <p className="text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">
                    Equipment Needed
                  </p>
                  <p className="text-[10px] text-gray-600 dark:text-gray-400">
                    {equipment}
                  </p>
                </div>
              )}
            </div>
          </Card>

          {/* Actions */}
          <div className="flex-shrink-0 flex" style={S.actionButtonGap}>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 text-xs px-2"
              onClick={handleClear}
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 text-xs px-2"
              onClick={() => setIsLoadModalOpen(true)}
            >
              <FolderOpen className="w-3.5 h-3.5" />
              Load
            </Button>
            <Button
              size="sm"
              className="flex-1 text-xs px-2"
              onClick={handleSave}
              disabled={isSaving}
            >
              <Save className="w-3.5 h-3.5" />
              {isSaving ? '...' : saveSuccess ? 'Saved!' : 'Save'}
            </Button>
          </div>
        </div>

        {/* Right Column - Drills (wider: 4/5 = 80%) */}
        <div className="xl:col-span-4 flex flex-col min-h-0">
          <Card className="flex-1 flex flex-col min-h-0" style={S.drillsCard}>
            <div className="flex-shrink-0 flex items-center justify-between" style={S.drillsHeader}>
              <div>
                <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  Practice Drills
                  <span className="text-xs font-normal text-gray-500 dark:text-gray-400">
                    ({drills.length})
                  </span>
                </h2>
                <div className="flex items-center gap-2 text-xs mt-0.5">
                  <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{formatTime(totalDrillTime)}</span>
                  </div>
                  <span className="text-gray-300 dark:text-gray-600">/</span>
                  <span className="text-gray-500 dark:text-gray-400">{formatTime(availablePracticeTime)}</span>
                  <span className={`font-medium ${
                    remainingTime < 0 
                      ? 'text-red-600 dark:text-red-400' 
                      : remainingTime < 300 
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-green-600 dark:text-green-400'
                  }`}>
                    ({remainingTime >= 0 ? '+' : ''}{formatTime(remainingTime)} left)
                  </span>
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={handleAddParallelSplit}>
                  <GitBranch className="w-4 h-4" />
                  Split Groups
                </Button>
                <Button size="sm" onClick={() => handleOpenPickerForGroup(null)}>
                  <Plus className="w-4 h-4" />
                  Add Drill
                </Button>
              </div>
            </div>

            {/* Scrollable drills list */}
            <div className="flex-1 overflow-y-auto min-h-0">
              <DrillsList
                timeline={timeline}
                onReorder={handleReorderTimeline}
                onReorderGroup={handleReorderGroup}
                onRemove={handleRemoveDrill}
                onUpdateDuration={handleUpdateDuration}
                onUpdateVariations={handleUpdateVariations}
                onViewDetails={() => {}}
                onAddDrillToGroup={handleOpenPickerForGroup}
                onAddParallelSplit={handleAddParallelSplit}
                onAddNestedSplit={handleAddNestedSplit}
                onAddGroup={handleAddGroup}
                onRemoveGroup={handleRemoveGroup}
                onRemoveParallelSplit={handleRemoveParallelSplit}
                onUpdateGroupName={handleUpdateGroupName}
                onUpdateOverrides={handleUpdateOverrides}
              />
            </div>
          </Card>
        </div>
      </div>

      {/* Timeline View - Fixed at bottom */}
      <div className="flex-shrink-0" style={S.timeline}>
        <PracticeTimeline timeline={timeline} practiceDuration={formData.duration} />
      </div>

      {/* Drill Picker Modal */}
      <Modal
        isOpen={isPickerOpen}
        onClose={() => setIsPickerOpen(false)}
        title="Add Drill to Practice"
        size="fixed"
      >
        <DrillPicker onAdd={handleAddDrill} onPreview={setPreviewDrill} />
      </Modal>

      {/* Drill Preview Modal */}
      <Modal
        isOpen={!!previewDrill}
        onClose={() => setPreviewDrill(null)}
        title={previewDrill?.name || 'Drill Preview'}
        size="lg"
      >
        {previewDrill && (
          <div className="space-y-4">
            {/* Header with category and duration */}
            <div className="flex items-center gap-3 flex-wrap">
              <span className="px-2.5 py-1 text-sm font-medium rounded-lg bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300">
                {previewDrill.category}
              </span>
              <span className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
                <Clock className="w-4 h-4" />
                {previewDrill.duration}
              </span>
            </div>

            {/* Description */}
            {previewDrill.description && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">{previewDrill.description}</p>
              </div>
            )}

            {/* Objective */}
            {previewDrill.objective && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Objective</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">{previewDrill.objective}</p>
              </div>
            )}

            {/* Setup */}
            {previewDrill.setup && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Setup</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">{previewDrill.setup}</p>
              </div>
            )}

            {/* Execution */}
            {previewDrill.execution && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Execution</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">{previewDrill.execution}</p>
              </div>
            )}

            {/* Coaching Points */}
            {previewDrill.coachingPoints && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Coaching Points</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">{previewDrill.coachingPoints}</p>
              </div>
            )}

            {/* Sketch */}
            {previewDrill.sketchData && (() => {
              try {
                const parsed = JSON.parse(previewDrill.sketchData);
                if (parsed.imagePreview) {
                  return (
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Sketch</h4>
                      <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-900">
                        <Image 
                          src={parsed.imagePreview} 
                          alt={`Sketch for ${previewDrill.name}`}
                          width={600}
                          height={256}
                          className="w-full max-h-64 object-contain"
                          unoptimized
                        />
                      </div>
                    </div>
                  );
                }
              } catch {
                return null;
              }
              return null;
            })()}

            {/* Tags */}
            {previewDrill.tags && previewDrill.tags.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Tags</h4>
                <div className="flex flex-wrap gap-1.5">
                  {previewDrill.tags.map(tag => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 text-xs font-medium rounded bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Action button */}
            <div className="pt-2 flex justify-end">
              <Button
                onClick={() => {
                  handleAddDrill(previewDrill);
                  setPreviewDrill(null);
                }}
              >
                <Plus className="w-4 h-4" />
                Add to Practice
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Load Practice Plan Modal */}
      <Modal
        isOpen={isLoadModalOpen}
        onClose={() => setIsLoadModalOpen(false)}
        title="Load Practice Plan"
        size="lg"
      >
        <div className="max-h-[60vh] overflow-y-auto">
          {isLoadingPlans ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-3"></div>
              <p className="text-gray-500 dark:text-gray-400">Loading plans...</p>
            </div>
          ) : !savedPlans || savedPlans.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <FolderOpen className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No saved practice plans found.</p>
              <p className="text-sm mt-1">Save a practice plan first to load it later.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {savedPlans.map((plan) => (
                <button
                  key={plan.id}
                  type="button"
                  onClick={() => handleLoadPlan(plan)}
                  className="w-full text-left p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-primary-500 dark:hover:border-primary-500 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-gray-900 dark:text-white truncate">
                        {plan.name}
                      </h3>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-sm text-gray-500 dark:text-gray-400">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          {format(new Date(plan.date), 'MMM d, yyyy')}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {plan.duration}
                        </span>
                        {plan.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5" />
                            {getLocationLabel(plan.location)}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                        {plan.timeline?.length || plan.drills?.length || 0} drills
                        {plan.createdAt && (
                          <> · Created {format(new Date(plan.createdAt), 'MMM d, yyyy')}</>
                        )}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </Modal>

      {/* Duplicate Name Modal */}
      <Modal
        isOpen={isDuplicateModalOpen}
        onClose={() => {
          setIsDuplicateModalOpen(false);
          setDuplicatePlanId(null);
        }}
        title="Plan Already Exists"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-gray-600 dark:text-gray-400">
            A practice plan named <strong className="text-gray-900 dark:text-white">&quot;{formData.name}&quot;</strong> already exists.
          </p>
          
          <div className="space-y-3">
            <Button
              variant="primary"
              className="w-full justify-center"
              onClick={handleOverwritePlanClick}
              disabled={isSaving}
            >
              <Save className="w-4 h-4" />
              Overwrite Existing Plan
            </Button>
            
            <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
              <label 
                htmlFor="newPlanName" 
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                Or save as a new plan with a different name:
              </label>
              <input
                id="newPlanName"
                type="text"
                value={newPlanName}
                onChange={(e) => setNewPlanName(e.target.value)}
                placeholder="Enter new name"
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500 px-3 py-2 text-sm"
              />
              <Button
                variant="outline"
                className="w-full justify-center mt-2"
                onClick={handleSaveAsNew}
                disabled={isSaving || !newPlanName.trim()}
              >
                <Plus className="w-4 h-4" />
                Save as New Plan
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
                Are you sure you want to overwrite the existing practice plan?
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                <strong>&quot;{formData.name}&quot;</strong> will be permanently replaced with your current plan. This action cannot be undone.
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowOverwriteConfirm(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleConfirmOverwritePlan}
              disabled={isSaving}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              <Save className="w-4 h-4" />
              {isSaving ? 'Overwriting...' : 'Overwrite Plan'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
    </ProtectedRoute>
  );
}
