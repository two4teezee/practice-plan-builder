'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/Button';
import { EquipmentPicker } from '@/components/ui/EquipmentPicker';
import { DrillSketchModal } from '@/components/drills/DrillSketchModal';
import { Modal } from '@/components/ui/Modal';
import type { Drill, SkillFocus } from '@/lib/types';
import { DRILL_CATEGORIES, SKILL_FOCUSES, DRILL_DURATIONS } from '@/lib/types';
import { Save, X, Plus, Trash2, Pencil, AlertTriangle } from 'lucide-react';

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
const getStorageKey = (drillId: string | undefined, isCreatingNew: boolean): string => {
  if (isCreatingNew) return 'drill-form-new';
  return drillId ? `drill-form-${drillId}` : 'drill-form-new';
};

export function DrillForm({ drill, onSave, onCancel, onCreateNew, onDelete, isCreatingNew = false }: DrillFormProps) {
  const [formData, setFormData] = useState<FormData>(getDefaultFormData());
  const [originalFormData, setOriginalFormData] = useState<FormData | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isSketchModalOpen, setIsSketchModalOpen] = useState(false);
  const [showUpdateConfirm, setShowUpdateConfirm] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [newVariation, setNewVariation] = useState('');

  // Parse variations string into array
  const variationsList = useMemo(() => {
    if (!formData.variations) return [];
    return formData.variations.split('\n').filter(v => v.trim() !== '');
  }, [formData.variations]);

  // Update variations from array
  const updateVariations = useCallback((variations: string[]) => {
    setFormData(prev => ({ ...prev, variations: variations.join('\n') }));
  }, []);

  const addVariation = useCallback(() => {
    if (newVariation.trim()) {
      updateVariations([...variationsList, newVariation.trim()]);
      setNewVariation('');
    }
  }, [newVariation, variationsList, updateVariations]);

  const removeVariation = useCallback((index: number) => {
    updateVariations(variationsList.filter((_, i) => i !== index));
  }, [variationsList, updateVariations]);

  const updateVariationText = useCallback((index: number, text: string) => {
    const updated = [...variationsList];
    updated[index] = text;
    updateVariations(updated);
  }, [variationsList, updateVariations]);

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
    
    // Store the original data for change detection
    const originalData = drill ? getDrillFormData(drill) : getDefaultFormData();
    setOriginalFormData(originalData);
    
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

  // Check if form has unsaved changes compared to the original drill data
  const hasChanges = useMemo(() => {
    if (!originalFormData) return false;
    return JSON.stringify(formData) !== JSON.stringify(originalFormData);
  }, [formData, originalFormData]);

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
    // For existing drills, show confirmation modal
    if (drill && !isCreatingNew) {
      setShowUpdateConfirm(true);
    } else {
      // For new drills, save directly
      onSave(formData);
    }
  };

  const handleConfirmUpdate = () => {
    setShowUpdateConfirm(false);
    onSave(formData);
  };

  const handleCreateNew = () => {
    if (onCreateNew) {
      onCreateNew(formData);
    }
  };

  const handleDeleteClick = () => {
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = () => {
    if (drill && onDelete) {
      // Clear localStorage for this form
      const storageKey = getStorageKey(drill.id, isCreatingNew);
      try {
        localStorage.removeItem(storageKey);
      } catch (error) {
        console.error('Failed to clear form data:', error);
      }
      setShowDeleteConfirm(false);
      onDelete(drill);
    }
  };

  const handleCancelClick = () => {
    if (hasChanges) {
      setShowDiscardConfirm(true);
    } else {
      onCancel();
    }
  };

  const handleConfirmDiscard = () => {
    // Clear localStorage for this form
    const storageKey = getStorageKey(drill?.id, isCreatingNew);
    try {
      localStorage.removeItem(storageKey);
    } catch (error) {
      console.error('Failed to clear form data:', error);
    }
    setShowDiscardConfirm(false);
    onCancel();
  };

  const handleSketchSave = (sketchData: string) => {
    setFormData({ ...formData, sketchData });
  };

  const inputClasses = "w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500";

  // Extract image preview from sketch data
  const sketchPreviewUrl = useMemo(() => {
    if (!formData.sketchData) return null;
    try {
      const parsed = JSON.parse(formData.sketchData);
      return parsed.imagePreview || null;
    } catch {
      // If it's not valid JSON, it might be an old format or direct data URL
      return formData.sketchData.startsWith('data:') ? formData.sketchData : null;
    }
  }, [formData.sketchData]);

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      {/* Name, Duration, Category row - spans full width */}
      <div className="grid grid-cols-3 gap-2">
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
            className={`${inputClasses} w-full`}
            style={inputStyle}
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
            className={`${inputClasses} w-full`}
            style={inputStyle}
          >
            {DRILL_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {/* Three-column layout: Fields | Variations | Sketch (all same height) */}
      <div className="grid grid-cols-3 gap-2">
        {/* Column 1: Description, Setup, Execution, Coaching Points */}
        <div className="flex flex-col gap-2">
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
        </div>

        {/* Column 2: Variations (spans full height) */}
        <div className="flex flex-col">
          <div className="block font-medium text-gray-700 dark:text-gray-300 mb-1" style={labelStyle}>
            Variations
          </div>
          <div className="flex-1 flex flex-col rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 overflow-hidden">
            {/* Variations list */}
            <div className="flex-1 overflow-y-auto">
              {variationsList.length > 0 ? (
                <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                  {variationsList.map((variation, index) => (
                    <li key={`variation-${index}-${variation.slice(0, 10)}`} className="flex items-center gap-2 px-2 py-1.5 group">
                      <input
                        type="text"
                        value={variation}
                        onChange={(e) => updateVariationText(index, e.target.value)}
                        className="flex-1 bg-transparent text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-1 focus:ring-primary-500 rounded px-1"
                        style={{ fontSize: '0.8125rem' }}
                      />
                      <button
                        type="button"
                        onClick={() => removeVariation(index)}
                        className="p-1 text-gray-400 hover:text-red-500 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Remove variation"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="flex-1 flex items-center justify-center text-gray-400 dark:text-gray-500 text-xs p-4">
                  No variations yet
                </div>
              )}
            </div>
            {/* Add new variation input */}
            <div className="flex items-center gap-2 px-2 py-1.5 border-t border-gray-200 dark:border-gray-700 mt-auto">
              <input
                type="text"
                value={newVariation}
                onChange={(e) => setNewVariation(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addVariation();
                  }
                }}
                placeholder="Add a variation..."
                className="flex-1 bg-transparent text-gray-900 dark:text-white text-sm placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none"
                style={{ fontSize: '0.8125rem' }}
              />
              <button
                type="button"
                onClick={addVariation}
                disabled={!newVariation.trim()}
                className="p-1 text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                title="Add variation"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Column 3: Sketch preview (same height as variations) */}
        <div className="flex flex-col">
          <div className="block font-medium text-gray-700 dark:text-gray-300 mb-1" style={labelStyle}>
            Drill Sketch
          </div>
          <div className="flex-1 flex flex-col rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 overflow-hidden">
            {sketchPreviewUrl ? (
              <div className="flex-1 p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img 
                  src={sketchPreviewUrl} 
                  alt="Drill sketch preview" 
                  className="w-full h-full object-contain rounded"
                />
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-400 dark:text-gray-500 text-sm">
                <div className="text-center p-4">
                  <Pencil className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No sketch yet</p>
                </div>
              </div>
            )}
            <div className="p-2 border-t border-gray-200 dark:border-gray-700">
              <Button
                type="button"
                variant={formData.sketchData ? 'secondary' : 'outline'}
                onClick={() => setIsSketchModalOpen(true)}
                className="w-full"
                size="sm"
              >
                <Pencil className="w-4 h-4" />
                {formData.sketchData ? 'Edit Sketch' : 'Create Sketch'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Equipment - spans full width */}
      <EquipmentPicker
        label="Equipment"
        value={formData.equipment}
        onChange={(value) => setFormData({ ...formData, equipment: value })}
        compact
        hideSummary
      />

      <div className="flex flex-wrap gap-2 pt-3 border-t border-gray-200 dark:border-gray-800 mt-1">
        <Button type="button" variant="outline" onClick={handleCancelClick}>
          <X className="w-4 h-4" />
          Cancel
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
                onClick={handleDeleteClick}
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
              <Button 
                type="submit" 
                disabled={!hasChanges}
                className={!hasChanges ? 'opacity-50 cursor-not-allowed' : ''}
              >
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

      {/* Update Confirmation Modal */}
      <Modal
        isOpen={showUpdateConfirm}
        onClose={() => setShowUpdateConfirm(false)}
        title="Confirm Update"
        size="sm"
      >
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-primary-600 dark:text-primary-400" />
            </div>
            <div>
              <p className="text-gray-700 dark:text-gray-300">
                Are you sure you want to update this drill?
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                This will save all changes to <strong>{formData.name || 'this drill'}</strong>.
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowUpdateConfirm(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirmUpdate}>
              <Save className="w-4 h-4" />
              Update Drill
            </Button>
          </div>
        </div>
      </Modal>

      {/* Discard Changes Confirmation Modal */}
      <Modal
        isOpen={showDiscardConfirm}
        onClose={() => setShowDiscardConfirm(false)}
        title="Discard Changes?"
        size="sm"
      >
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-gray-700 dark:text-gray-300">
                You have unsaved changes.
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Are you sure you want to discard your changes? This action cannot be undone.
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowDiscardConfirm(false)}>
              Keep Editing
            </Button>
            <Button 
              variant="outline" 
              onClick={handleConfirmDiscard}
              className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 border-red-300 dark:border-red-700"
            >
              <Trash2 className="w-4 h-4" />
              Discard Changes
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Drill Confirmation Modal */}
      <Modal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title="Delete Drill?"
        size="sm"
      >
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <Trash2 className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-gray-700 dark:text-gray-300">
                Are you sure you want to delete this drill?
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                <strong>{formData.name || 'This drill'}</strong> will be permanently deleted. This action cannot be undone.
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>
              Cancel
            </Button>
            <Button 
              variant="outline" 
              onClick={handleConfirmDelete}
              className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 border-red-300 dark:border-red-700"
            >
              <Trash2 className="w-4 h-4" />
              Delete Drill
            </Button>
          </div>
        </div>
      </Modal>
    </form>
  );
}
