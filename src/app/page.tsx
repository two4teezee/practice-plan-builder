'use client';

import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { db } from '@/lib/db';
import { 
  PracticePlan, 
  PracticePlanDrill, 
  Drill,
  PRACTICE_DURATIONS, 
  COACHES,
  PracticeDuration,
  Coach 
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

export default function CreatePracticePlanPage() {
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  
  const [formData, setFormData] = useState({
    name: format(new Date(), 'MMMM d, yyyy') + ' Practice',
    description: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    duration: '60 minutes' as PracticeDuration,
    location: 'Hylo Park Arena',
    coach: 'Coach 1' as Coach,
    notes: '',
  });
  
  const [drills, setDrills] = useState<PracticePlanDrill[]>([]);

  // Calculate total drill time
  const totalDrillTime = useMemo(() => {
    return drills.reduce((acc, d) => {
      const [min, sec] = d.drill.duration.split(':').map(Number);
      return acc + min * 60 + sec;
    }, 0);
  }, [drills]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Auto-calculate equipment
  const equipment = useMemo(() => {
    const allEquipment = drills
      .map((d) => d.drill.equipment)
      .filter(Boolean)
      .join(', ');
    
    // Remove duplicates
    const unique = [...new Set(allEquipment.split(/,\s*/).filter(Boolean))];
    return unique.join(', ');
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
        coach: formData.coach,
        drills: drills,
        notes: formData.notes,
        equipment: equipment,
        createdAt: now,
        updatedAt: now,
      };

      await db.practicePlans.add(practicePlan);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error('Failed to save practice plan:', error);
      alert('Failed to save practice plan. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClear = () => {
    if (confirm('Are you sure you want to clear the practice plan?')) {
      setFormData({
        name: format(new Date(), 'MMMM d, yyyy') + ' Practice',
        description: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        duration: '60 minutes',
        location: 'Hylo Park Arena',
        coach: 'Coach 1',
        notes: '',
      });
      setDrills([]);
    }
  };

  const durationOptions = PRACTICE_DURATIONS.map((d) => ({ value: d, label: d }));
  const coachOptions = COACHES.map((c) => ({ value: c, label: c }));

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

              <Select
                id="coach"
                label="Coach"
                value={formData.coach}
                onChange={(e) => setFormData({ ...formData, coach: e.target.value as Coach })}
                options={coachOptions}
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
                <div className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 mt-1">
                  <Clock className="w-4 h-4" />
                  <span>Total time: {formatTime(totalDrillTime)}</span>
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
        size="lg"
      >
        <DrillPicker onAdd={handleAddDrill} addedDrillIds={addedDrillIds} />
      </Modal>
    </div>
  );
}
