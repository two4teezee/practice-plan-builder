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
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <ClipboardList className="w-8 h-8 text-primary-600 dark:text-primary-400" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Create Practice Plan
          </h1>
        </div>
        <p className="text-gray-600 dark:text-gray-400">
          Build a new practice plan by selecting drills from your library
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left Column - Practice Details */}
        <div className="xl:col-span-1 space-y-6">
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Practice Details
            </h2>
            
            <div className="space-y-4">
              <Input
                id="name"
                label="Practice Name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Enter practice name"
              />

              <Textarea
                id="description"
                label="Description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="What's the focus of this practice?"
                rows={2}
              />

              <Input
                id="date"
                label="Practice Date"
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              />

              <Select
                id="duration"
                label="Practice Duration"
                value={formData.duration}
                onChange={(e) => setFormData({ ...formData, duration: e.target.value as PracticeDuration })}
                options={durationOptions}
              />

              <Input
                id="location"
                label="Location"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="Enter location"
              />

              <Textarea
                id="notes"
                label="Notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Additional notes for this practice..."
                rows={3}
              />

              {/* Equipment Summary */}
              {equipment && (
                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Equipment Needed
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {equipment}
                  </p>
                </div>
              )}
            </div>
          </Card>

          {/* Actions */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={handleClear}
            >
              <Trash2 className="w-4 h-4" />
              Clear
            </Button>
            <Button
              className="flex-1"
              onClick={handleSave}
              disabled={isSaving}
            >
              <Save className="w-4 h-4" />
              {isSaving ? 'Saving...' : saveSuccess ? 'Saved!' : 'Save Plan'}
            </Button>
          </div>
        </div>

        {/* Right Column - Drills */}
        <div className="xl:col-span-2">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  Practice Drills
                  <span className="text-sm font-normal text-gray-500 dark:text-gray-400">
                    ({drills.length} drills)
                  </span>
                </h2>
                <div className="flex items-center gap-3 text-sm mt-1">
                  <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
                    <Clock className="w-4 h-4" />
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
              <Button onClick={() => setIsPickerOpen(true)}>
                <Plus className="w-4 h-4" />
                Add Drill
              </Button>
            </div>

            <DrillsList
              drills={drills}
              onReorder={handleReorderDrills}
              onRemove={handleRemoveDrill}
              onUpdateDuration={handleUpdateDuration}
              onViewDetails={() => {}}
            />
          </Card>
        </div>
      </div>

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
