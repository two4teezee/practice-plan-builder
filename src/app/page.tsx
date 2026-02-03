'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { db } from '@/lib/db';
import { 
  PracticePlan, 
  PracticePlanDrill, 
  Drill,
  PRACTICE_DURATIONS, 
  PracticeDuration,
  getEffectiveDuration,
  parseDurationToSeconds,
  parsePracticeDurationToSeconds,
  parseEquipmentString,
  equipmentSelectionsToString,
  EQUIPMENT_OPTIONS
} from '@/lib/types';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { DrillsList } from '@/components/practice/DrillsList';
import { DrillPicker } from '@/components/practice/DrillPicker';
import { 
  ClipboardList, 
  Save, 
  Plus, 
  FileText,
  Clock,
  Trash2
} from 'lucide-react';

const DRAFT_STORAGE_KEY = 'practice-plan-draft';

interface DraftData {
  formData: {
    name: string;
    description: string;
    date: string;
    duration: PracticeDuration;
    location: string;
    notes: string;
  };
  drills: PracticePlanDrill[];
}

const getDefaultFormData = () => ({
  name: format(new Date(), 'MMMM d, yyyy') + ' Practice',
  description: '',
  date: format(new Date(), 'yyyy-MM-dd'),
  duration: '50 minutes' as PracticeDuration,
  location: 'Hylo Park Arena',
  notes: '',
});

export default function CreatePracticePlanPage() {
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  
  const [formData, setFormData] = useState(getDefaultFormData);
  const [drills, setDrills] = useState<PracticePlanDrill[]>([]);

  // Load draft from localStorage on mount, or add default drill if no draft
  useEffect(() => {
    const initializePlan = async () => {
      try {
        const saved = localStorage.getItem(DRAFT_STORAGE_KEY);
        if (saved) {
          // Load existing draft
          const draft: DraftData = JSON.parse(saved);
          setFormData(draft.formData);
          setDrills(draft.drills);
        } else {
          // No draft - add the default "Setup Ice and Warm Ups" drill
          const setupDrill = await db.drills.where('name').equals('Setup Ice and Warm Ups').first();
          if (setupDrill && setupDrill.id) {
            const defaultDrill: PracticePlanDrill = {
              id: `drill-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              drillId: setupDrill.id,
              drill: setupDrill,
              order: 1,
            };
            setDrills([defaultDrill]);
          }
        }
      } catch (error) {
        console.error('Failed to initialize practice plan:', error);
      }
      setIsLoaded(true);
    };
    
    initializePlan();
  }, []);

  // Save draft to localStorage whenever formData or drills change
  useEffect(() => {
    if (!isLoaded) return; // Don't save until initial load is complete
    
    try {
      const draft: DraftData = { formData, drills };
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
    } catch (error) {
      console.error('Failed to save draft:', error);
    }
  }, [formData, drills, isLoaded]);

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
    return drills.reduce((acc, d) => {
      const duration = getEffectiveDuration(d);
      return acc + parseDurationToSeconds(duration);
    }, 0);
  }, [drills]);

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
    
    // Go through each drill's equipment
    for (const d of drills) {
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
        item: item as typeof EQUIPMENT_OPTIONS[number], 
        quantity 
      }));
    
    return equipmentSelectionsToString(consolidatedSelections);
  }, [drills]);

  const handleAddDrill = (drill: Drill) => {
    if (!drill.id) return;
    
    const newDrill: PracticePlanDrill = {
      id: `drill-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      drillId: drill.id,
      drill: drill,
      order: drills.length + 1,
    };
    
    setDrills([...drills, newDrill]);
  };

  const handleRemoveDrill = (id: string) => {
    const updated = drills
      .filter((d) => d.id !== id)
      .map((d, i) => ({ ...d, order: i + 1 }));
    setDrills(updated);
  };

  const handleReorderDrills = (reordered: PracticePlanDrill[]) => {
    setDrills(reordered);
  };

  const handleUpdateDuration = (id: string, duration: string) => {
    setDrills(drills.map((d) => 
      d.id === id ? { ...d, customDuration: duration } : d
    ));
  };

  // Helper to add the default "Setup Ice and Warm Ups" drill
  const addDefaultSetupDrill = useCallback(async () => {
    try {
      const setupDrill = await db.drills.where('name').equals('Setup Ice and Warm Ups').first();
      if (setupDrill && setupDrill.id) {
        const defaultDrill: PracticePlanDrill = {
          id: `drill-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          drillId: setupDrill.id,
          drill: setupDrill,
          order: 1,
        };
        setDrills([defaultDrill]);
      } else {
        setDrills([]);
      }
    } catch (error) {
      console.error('Failed to add default drill:', error);
      setDrills([]);
    }
  }, []);

  const handleSave = async () => {
    if (drills.length === 0) {
      alert('Please add at least one drill to the practice plan.');
      return;
    }

    setIsSaving(true);
    try {
      const now = new Date();
      const practicePlan: Omit<PracticePlan, 'id'> = {
        name: formData.name,
        description: formData.description,
        date: new Date(formData.date),
        duration: formData.duration,
        location: formData.location,
        drills: drills,
        notes: formData.notes,
        equipment: equipment,
        createdAt: now,
        updatedAt: now,
      };

      await db.practicePlans.add(practicePlan);
      
      // Clear draft and reset form after successful save
      clearDraft();
      setFormData(getDefaultFormData());
      
      // Re-add the default setup drill for the next practice plan
      await addDefaultSetupDrill();
      
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error('Failed to save practice plan:', error);
      alert('Failed to save practice plan. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClear = async () => {
    if (confirm('Are you sure you want to clear the practice plan?')) {
      clearDraft();
      setFormData(getDefaultFormData());
      
      // Re-add the default setup drill
      await addDefaultSetupDrill();
    }
  };

  const durationOptions = PRACTICE_DURATIONS.map((d) => ({ value: d, label: d }));

  const addedDrillIds = drills.map((d) => d.drillId);

  return (
    <div className="h-[calc(100vh-6rem)] flex flex-col max-w-7xl mx-auto">
      {/* Header - Compact */}
      <div className="flex items-center justify-between mb-3 flex-shrink-0">
        <div className="flex items-center gap-3">
          <ClipboardList className="w-6 h-6 text-primary-600 dark:text-primary-400" />
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            Create Practice Plan
          </h1>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleClear}
          >
            <Trash2 className="w-4 h-4" />
            Clear
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isSaving}
          >
            <Save className="w-4 h-4" />
            {isSaving ? 'Saving...' : saveSuccess ? 'Saved!' : 'Save Plan'}
          </Button>
        </div>
      </div>

      {/* Main Content - Fills available space */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 flex-1 min-h-0">
        {/* Left Column - Practice Details */}
        <div className="xl:col-span-1 flex flex-col min-h-0">
          <Card className="p-4 flex-1 overflow-y-auto">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Practice Details
            </h2>
            
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Input
                  id="name"
                  label="Practice Name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Enter practice name"
                  className="text-sm"
                />
                <Input
                  id="date"
                  label="Date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Select
                  id="duration"
                  label="Duration"
                  value={formData.duration}
                  onChange={(e) => setFormData({ ...formData, duration: e.target.value as PracticeDuration })}
                  options={durationOptions}
                />
                <Input
                  id="location"
                  label="Location"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="Location"
                  className="text-sm"
                />
              </div>

              <Textarea
                id="description"
                label="Description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="What's the focus of this practice?"
                rows={2}
              />

              <Textarea
                id="notes"
                label="Notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Additional notes..."
                rows={2}
              />

              {/* Equipment Summary */}
              {equipment && (
                <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-0.5">
                    Equipment Needed
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    {equipment}
                  </p>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Right Column - Drills */}
        <div className="xl:col-span-2 flex flex-col min-h-0">
          <Card className="p-4 flex-1 flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-3 flex-shrink-0">
              <div>
                <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  Practice Drills
                  <span className="text-xs font-normal text-gray-500 dark:text-gray-400">
                    ({drills.length} drills)
                  </span>
                </h2>
                <div className="flex items-center gap-2 text-xs mt-0.5">
                  <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
                    <Clock className="w-3 h-3" />
                    <span>Used: {formatTime(totalDrillTime)}</span>
                  </div>
                  <span className="text-gray-300 dark:text-gray-600">|</span>
                  <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
                    <span>Available: {formatTime(availablePracticeTime)}</span>
                  </div>
                  <span className="text-gray-300 dark:text-gray-600">|</span>
                  <div className={`flex items-center gap-1 font-medium ${
                    remainingTime < 0 
                      ? 'text-red-600 dark:text-red-400' 
                      : remainingTime < 300 
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-green-600 dark:text-green-400'
                  }`}>
                    <span>Remaining: {formatTime(remainingTime)}</span>
                  </div>
                </div>
              </div>
              <Button size="sm" onClick={() => setIsPickerOpen(true)}>
                <Plus className="w-4 h-4" />
                Add Drill
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto min-h-0">
              <DrillsList
                drills={drills}
                onReorder={handleReorderDrills}
                onRemove={handleRemoveDrill}
                onUpdateDuration={handleUpdateDuration}
                onViewDetails={() => {}}
              />
            </div>
          </Card>
        </div>
      </div>

      {/* Timeline View - Fixed at bottom */}
      {drills.length > 0 && (
        <div className="flex-shrink-0 mt-3">
          <TimelineView 
            drills={drills} 
            totalDuration={availablePracticeTime}
            formatTime={formatTime}
          />
        </div>
      )}

      {/* Drill Picker Modal */}
      <Modal
        isOpen={isPickerOpen}
        onClose={() => setIsPickerOpen(false)}
        title="Add Drill to Practice"
        size="fixed"
      >
        <DrillPicker onAdd={handleAddDrill} addedDrillIds={addedDrillIds} />
      </Modal>
    </div>
  );
}

// Timeline View Component
interface TimelineViewProps {
  drills: PracticePlanDrill[];
  totalDuration: number;
  formatTime: (seconds: number) => string;
}

function TimelineView({ drills, totalDuration, formatTime }: TimelineViewProps) {
  const categoryColors: Record<string, { bg: string; text: string; border: string }> = {
    Admin: { bg: 'bg-slate-100 dark:bg-slate-800', text: 'text-slate-700 dark:text-slate-300', border: 'border-slate-300 dark:border-slate-600' },
    Skating: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-300', border: 'border-blue-300 dark:border-blue-700' },
    Shooting: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-300', border: 'border-red-300 dark:border-red-700' },
    Passing: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-300', border: 'border-green-300 dark:border-green-700' },
    Defensive: { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-300', border: 'border-purple-300 dark:border-purple-700' },
    Offensive: { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-300', border: 'border-orange-300 dark:border-orange-700' },
    Other: { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-700 dark:text-gray-300', border: 'border-gray-300 dark:border-gray-600' },
  };

  // Calculate the total drill time
  const totalDrillTime = drills.reduce((acc, d) => {
    const duration = getEffectiveDuration(d);
    return acc + parseDurationToSeconds(duration);
  }, 0);

  // Use the larger of total duration or total drill time for the timeline width
  const timelineWidth = Math.max(totalDuration, totalDrillTime);

  // Calculate cumulative start times for each drill
  let cumulativeTime = 0;
  const drillsWithTiming = drills.map((drill) => {
    const duration = parseDurationToSeconds(getEffectiveDuration(drill));
    const startTime = cumulativeTime;
    cumulativeTime += duration;
    return {
      ...drill,
      startTime,
      duration,
    };
  });

  // Generate time markers (every 5 minutes)
  const timeMarkers: number[] = [];
  for (let t = 0; t <= timelineWidth; t += 300) {
    timeMarkers.push(t);
  }
  // Always include the end time if it doesn't align with a marker
  if (timelineWidth % 300 !== 0) {
    timeMarkers.push(timelineWidth);
  }

  return (
    <Card className="p-3">
      <div className="flex items-center gap-2 mb-2">
        <Clock className="w-3 h-3 text-gray-500" />
        <h3 className="text-xs font-semibold text-gray-900 dark:text-white">
          Practice Timeline
        </h3>
        {/* Inline Legend */}
        <div className="flex flex-wrap gap-1.5 ml-auto">
          {Array.from(new Set(drills.map(d => d.drill.category))).map((category) => {
            const colors = categoryColors[category] || categoryColors.Other;
            return (
              <span 
                key={category}
                className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${colors.bg} ${colors.text}`}
              >
                {category}
              </span>
            );
          })}
        </div>
      </div>
      
      <div className="relative">
        {/* Time markers */}
        <div className="relative h-4 text-[10px] text-gray-500 dark:text-gray-400">
          {timeMarkers.map((t) => (
            <span 
              key={t} 
              className="absolute transform -translate-x-1/2"
              style={{ left: `${(t / timelineWidth) * 100}%` }}
            >
              {formatTime(t)}
            </span>
          ))}
        </div>

        {/* Timeline bar */}
        <div className="relative h-8 bg-gray-100 dark:bg-gray-800 rounded-md overflow-hidden">
          {/* Practice duration background */}
          <div 
            className="absolute inset-y-0 left-0 bg-gray-50 dark:bg-gray-700/50 border-r-2 border-dashed border-gray-300 dark:border-gray-600"
            style={{ width: `${Math.min((totalDuration / timelineWidth) * 100, 100)}%` }}
          />
          
          {/* Drill blocks */}
          {drillsWithTiming.map((drill) => {
            const leftPercent = (drill.startTime / timelineWidth) * 100;
            const widthPercent = (drill.duration / timelineWidth) * 100;
            const colors = categoryColors[drill.drill.category] || categoryColors.Other;
            
            return (
              <div
                key={drill.id}
                className={`absolute inset-y-0.5 ${colors.bg} ${colors.border} border rounded flex items-center justify-center overflow-hidden transition-all duration-200 hover:scale-[1.02] hover:z-10`}
                style={{
                  left: `${leftPercent}%`,
                  width: `${widthPercent}%`,
                  minWidth: '2px',
                }}
                title={`${drill.drill.name} (${getEffectiveDuration(drill)})`}
              >
                <span className={`${colors.text} text-[10px] font-medium truncate px-0.5`}>
                  {widthPercent > 10 ? drill.drill.name : ''}
                </span>
              </div>
            );
          })}

          {/* Overflow indicator (if drills exceed practice duration) */}
          {totalDrillTime > totalDuration && (
            <div 
              className="absolute inset-y-0 bg-red-100/50 dark:bg-red-900/20 border-l-2 border-red-400 dark:border-red-600"
              style={{ 
                left: `${(totalDuration / timelineWidth) * 100}%`,
                width: `${((totalDrillTime - totalDuration) / timelineWidth) * 100}%`
              }}
            />
          )}
        </div>
      </div>
    </Card>
  );
}
