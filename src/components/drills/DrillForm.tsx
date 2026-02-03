'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/Button';
import { EquipmentPicker } from '@/components/ui/EquipmentPicker';
import { DrillSketchModal } from '@/components/drills/DrillSketchModal';
import type { Drill, SkillFocus } from '@/lib/types';
import { DRILL_CATEGORIES, SKILL_FOCUSES, DRILL_DURATIONS } from '@/lib/types';
import { Save, X, Plus, Trash2, Pencil } from 'lucide-react';

interface DrillFormProps {
  drill?: Drill | null;
  onSave: (drill: Omit<Drill, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onCancel: () => void;
  onCreateNew?: (drill: Omit<Drill, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onDelete?: (drill: Drill) => void;
  isCreatingNew?: boolean;
}

type FormData = {
  name: string;
  category: typeof DRILL_CATEGORIES[number];
  duration: string;
  skillFocus: SkillFocus;
  objective: string;
  setup: string;
  execution: string;
  coachingPoints: string;
  variations: string;
  equipment: string;
  description: string;
  videoLink: string;
  pdfLink: string;
  sketchData: string;
};

const getDefaultFormData = (): FormData => ({
  name: '',
  category: DRILL_CATEGORIES[0],
  duration: '5:00',
  skillFocus: SKILL_FOCUSES[0], // Keep for data compatibility but not shown in UI
  objective: '',
  setup: '',
  execution: '',
  coachingPoints: '',
  variations: '',
  equipment: '',
  description: '',
  videoLink: '',
  pdfLink: '',
  sketchData: '',
});

// Compact styling to match practice plan details panel
const labelStyle = { fontSize: '0.6875rem' }; // 11px
const inputStyle = { 
  fontSize: '0.8125rem', // 13px
  paddingTop: '0.375rem', // 6px
  paddingBottom: '0.375rem',
  paddingLeft: '0.5rem', // 8px
  paddingRight: '0.5rem',
};

// Get storage key for form data
const getStorageKey = (drillId: number | undefined, isCreatingNew: boolean): string => {
  if (isCreatingNew) return 'drill-form-new';
  return drillId ? `drill-form-${drillId}` : 'drill-form-new';
};

export function DrillForm({ drill, onSave, onCancel, onCreateNew, onDelete, isCreatingNew = false }: DrillFormProps) {
  const [formData, setFormData] = useState<FormData>(getDefaultFormData());
  const [isInitialized, setIsInitialized] = useState(false);
  const [isSketchModalOpen, setIsSketchModalOpen] = useState(false);

  // Get form data from drill or defaults
  const getDrillFormData = useCallback((d: Drill): FormData => ({
    name: d.name,
    category: d.category,
    duration: d.duration,
    skillFocus: d.skillFocus,
    objective: d.objective,
    setup: d.setup,
    execution: d.execution,
    coachingPoints: d.coachingPoints,
    variations: d.variations,
    equipment: d.equipment,
    description: d.description,
    videoLink: d.videoLink,
    pdfLink: d.pdfLink,
    sketchData: d.sketchData || '',
  }), []);

  // Load form data - check localStorage first, then fall back to drill data or defaults
  useEffect(() => {
    const storageKey = getStorageKey(drill?.id, isCreatingNew);
    
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        // We have saved form data - use it
        const parsed = JSON.parse(saved) as FormData;
        setFormData(parsed);
      } else if (drill) {
        // No saved data, but we have a drill - use its data
        setFormData(getDrillFormData(drill));
      } else {
        // No saved data and no drill - use defaults
        setFormData(getDefaultFormData());
      }
    } catch (error) {
      console.error('Failed to load form data:', error);
      // Fall back to drill data or defaults
      if (drill) {
        setFormData(getDrillFormData(drill));
      } else {
        setFormData(getDefaultFormData());
      }
    }
    
    setIsInitialized(true);
  }, [drill, isCreatingNew, getDrillFormData]);

  // Save form data to localStorage when it changes
  useEffect(() => {
    if (!isInitialized) return;
    
    const storageKey = getStorageKey(drill?.id, isCreatingNew);
    try {
      localStorage.setItem(storageKey, JSON.stringify(formData));
    } catch (error) {
      console.error('Failed to save form data:', error);
    }
  }, [formData, drill?.id, isCreatingNew, isInitialized]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  const handleCreateNew = () => {
    if (onCreateNew) {
      onCreateNew(formData);
    }
  };

  const handleDelete = () => {
    if (drill && onDelete) {
      onDelete(drill);
    }
  };

  const handleSketchSave = (sketchData: string) => {
    setFormData({ ...formData, sketchData });
  };

  const inputClasses = "w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500";

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      {/* Name, Duration, Category on single line */}
      <div className="grid grid-cols-[1fr_auto_auto] gap-2">
        <div>
          <label htmlFor="name" className="block font-medium text-gray-700 dark:text-gray-300 mb-1" style={labelStyle}>
            Drill Name
          </label>
          <input
            id="name"
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Enter drill name"
            required
            className={inputClasses}
            style={inputStyle}
          />
        </div>
        <div>
          <label htmlFor="duration" className="block font-medium text-gray-700 dark:text-gray-300 mb-1" style={labelStyle}>
            Duration
          </label>
          <select
            id="duration"
            value={formData.duration}
            onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
            className={inputClasses}
            style={{ ...inputStyle, minWidth: '5rem' }}
          >
            {DRILL_DURATIONS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="category" className="block font-medium text-gray-700 dark:text-gray-300 mb-1" style={labelStyle}>
            Category
          </label>
          <select
            id="category"
            value={formData.category}
            onChange={(e) => setFormData({ ...formData, category: e.target.value as typeof formData.category })}
            className={inputClasses}
            style={{ ...inputStyle, minWidth: '6rem' }}
          >
            {DRILL_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="description" className="block font-medium text-gray-700 dark:text-gray-300 mb-1" style={labelStyle}>
          Description
        </label>
        <textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Brief description of the drill"
          rows={2}
          className={`${inputClasses} resize-none`}
          style={inputStyle}
        />
      </div>

      <div>
        <label htmlFor="objective" className="block font-medium text-gray-700 dark:text-gray-300 mb-1" style={labelStyle}>
          Objective
        </label>
        <textarea
          id="objective"
          value={formData.objective}
          onChange={(e) => setFormData({ ...formData, objective: e.target.value })}
          placeholder="What is the goal of this drill?"
          rows={2}
          className={`${inputClasses} resize-none`}
          style={inputStyle}
        />
      </div>

      <div>
        <label htmlFor="setup" className="block font-medium text-gray-700 dark:text-gray-300 mb-1" style={labelStyle}>
          Setup
        </label>
        <textarea
          id="setup"
          value={formData.setup}
          onChange={(e) => setFormData({ ...formData, setup: e.target.value })}
          placeholder="How to set up the drill"
          rows={2}
          className={`${inputClasses} resize-none`}
          style={inputStyle}
        />
      </div>

      <div>
        <label htmlFor="execution" className="block font-medium text-gray-700 dark:text-gray-300 mb-1" style={labelStyle}>
          Execution
        </label>
        <textarea
          id="execution"
          value={formData.execution}
          onChange={(e) => setFormData({ ...formData, execution: e.target.value })}
          placeholder="How to run the drill"
          rows={2}
          className={`${inputClasses} resize-none`}
          style={inputStyle}
        />
      </div>

      <div>
        <label htmlFor="coachingPoints" className="block font-medium text-gray-700 dark:text-gray-300 mb-1" style={labelStyle}>
          Coaching Points
        </label>
        <textarea
          id="coachingPoints"
          value={formData.coachingPoints}
          onChange={(e) => setFormData({ ...formData, coachingPoints: e.target.value })}
          placeholder="Key points for coaches"
          rows={2}
          className={`${inputClasses} resize-none`}
          style={inputStyle}
        />
      </div>

      <div>
        <label htmlFor="variations" className="block font-medium text-gray-700 dark:text-gray-300 mb-1" style={labelStyle}>
          Variations
        </label>
        <textarea
          id="variations"
          value={formData.variations}
          onChange={(e) => setFormData({ ...formData, variations: e.target.value })}
          placeholder="Alternative ways to run this drill"
          rows={2}
          className={`${inputClasses} resize-none`}
          style={inputStyle}
        />
      </div>

      <EquipmentPicker
        label="Equipment"
        value={formData.equipment}
        onChange={(value) => setFormData({ ...formData, equipment: value })}
        compact
        hideSummary
      />

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label htmlFor="videoLink" className="block font-medium text-gray-700 dark:text-gray-300 mb-1" style={labelStyle}>
            Video Link
          </label>
          <input
            id="videoLink"
            type="url"
            value={formData.videoLink}
            onChange={(e) => setFormData({ ...formData, videoLink: e.target.value })}
            placeholder="https://youtube.com/..."
            className={inputClasses}
            style={inputStyle}
          />
        </div>
        <div>
          <label htmlFor="pdfLink" className="block font-medium text-gray-700 dark:text-gray-300 mb-1" style={labelStyle}>
            PDF Link
          </label>
          <input
            id="pdfLink"
            type="url"
            value={formData.pdfLink}
            onChange={(e) => setFormData({ ...formData, pdfLink: e.target.value })}
            placeholder="https://example.com/drill.pdf"
            className={inputClasses}
            style={inputStyle}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2 pt-3 border-t border-gray-200 dark:border-gray-800 mt-1">
        <Button type="button" variant="outline" onClick={onCancel}>
          <X className="w-4 h-4" />
          Cancel
        </Button>
        
        <Button
          type="button"
          variant={formData.sketchData ? 'secondary' : 'outline'}
          onClick={() => setIsSketchModalOpen(true)}
        >
          <Pencil className="w-4 h-4" />
          {formData.sketchData ? 'Edit Sketch' : 'Sketch Drill'}
        </Button>
        
        {isCreatingNew ? (
          // Creating new drill mode - only show Create button
          <Button type="submit" className="ml-auto">
            <Plus className="w-4 h-4" />
            Create Drill
          </Button>
        ) : drill ? (
          // Editing existing drill - show Update, Create New, and Delete
          <>
            {onDelete && (
              <Button 
                type="button" 
                variant="outline" 
                onClick={handleDelete}
                className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 border-red-300 dark:border-red-700"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </Button>
            )}
            <div className="flex gap-2 ml-auto">
              {onCreateNew && (
                <Button type="button" variant="secondary" onClick={handleCreateNew}>
                  <Plus className="w-4 h-4" />
                  Create as New
                </Button>
              )}
              <Button type="submit">
                <Save className="w-4 h-4" />
                Update Drill
              </Button>
            </div>
          </>
        ) : (
          // No drill selected - shouldn't happen but fallback
          <Button type="submit" className="ml-auto">
            <Save className="w-4 h-4" />
            Save
          </Button>
        )}
      </div>

      {/* Sketch Modal */}
      <DrillSketchModal
        isOpen={isSketchModalOpen}
        onClose={() => setIsSketchModalOpen(false)}
        onSave={handleSketchSave}
        initialSketchData={formData.sketchData}
      />
    </form>
  );
}
