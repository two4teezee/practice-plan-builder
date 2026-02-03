'use client';

import { useState, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';
import { EquipmentPicker } from '@/components/ui/EquipmentPicker';
import { Drill, DRILL_CATEGORIES, SKILL_FOCUSES, DRILL_DURATIONS } from '@/lib/types';
import { Save, X, Copy, Trash2 } from 'lucide-react';

const DRAFT_STORAGE_KEY = 'drill-form-draft';

interface DrillFormData {
  name: string;
  category: string;
  duration: string;
  skillFocus: string;
  objective: string;
  setup: string;
  execution: string;
  coachingPoints: string;
  variations: string;
  equipment: string;
  description: string;
  videoLink: string;
  pdfLink: string;
}

interface StoredDraft {
  drillId: number | null;
  formData: DrillFormData;
}

interface DrillFormProps {
  drill?: Drill | null;
  onSave: (drill: Omit<Drill, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onSaveAsNew?: (drill: Omit<Drill, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onDelete?: (drill: Drill) => void;
  onCancel: () => void;
}

const getInitialFormData = (): DrillFormData => ({
  name: '',
  category: DRILL_CATEGORIES[0],
  duration: '5:00',
  skillFocus: SKILL_FOCUSES[0], // Keep for data compatibility but not shown in form
  objective: '',
  setup: '',
  execution: '',
  coachingPoints: '',
  variations: '',
  equipment: '',
  description: '',
  videoLink: '',
  pdfLink: '',
});

export function DrillForm({ drill, onSave, onSaveAsNew, onDelete, onCancel }: DrillFormProps) {
  const [formData, setFormData] = useState<DrillFormData>(getInitialFormData);
  const [hasChanges, setHasChanges] = useState(false);

  // Load saved draft or drill data on mount
  useEffect(() => {
    try {
      const savedDraft = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (savedDraft) {
        const parsed: StoredDraft = JSON.parse(savedDraft);
        // Only restore if editing the same drill (or both are new drills)
        if (parsed.drillId === (drill?.id ?? null)) {
          setFormData(parsed.formData);
          setHasChanges(true);
          return;
        }
      }
    } catch (error) {
      console.error('Failed to load draft:', error);
    }

    // No matching draft, load from drill prop
    if (drill) {
      setFormData({
        name: drill.name,
        category: drill.category,
        duration: drill.duration,
        skillFocus: drill.skillFocus,
        objective: drill.objective,
        setup: drill.setup,
        execution: drill.execution,
        coachingPoints: drill.coachingPoints,
        variations: drill.variations,
        equipment: drill.equipment,
        description: drill.description,
        videoLink: drill.videoLink,
        pdfLink: drill.pdfLink,
      });
    } else {
      setFormData(getInitialFormData());
    }
    setHasChanges(false);
  }, [drill]);

  // Save draft to localStorage whenever form data changes
  const saveDraft = useCallback(() => {
    if (!hasChanges) return;
    try {
      const draft: StoredDraft = {
        drillId: drill?.id ?? null,
        formData,
      };
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
    } catch (error) {
      console.error('Failed to save draft:', error);
    }
  }, [drill?.id, formData, hasChanges]);

  // Save draft on unmount or when navigating away
  useEffect(() => {
    const handleBeforeUnload = () => {
      saveDraft();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      saveDraft();
    };
  }, [saveDraft]);

  const clearDraft = () => {
    try {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch (error) {
      console.error('Failed to clear draft:', error);
    }
  };

  const handleFieldChange = (field: keyof DrillFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const isEditing = !!drill;

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    // For editing existing drills, confirm before updating
    if (isEditing) {
      if (confirm('Are you sure you want to update this drill?')) {
        clearDraft();
        onSave(formData as Omit<Drill, 'id' | 'createdAt' | 'updatedAt'>);
      }
    } else {
      // For new drills, just save directly
      clearDraft();
      onSave(formData as Omit<Drill, 'id' | 'createdAt' | 'updatedAt'>);
    }
  };

  const handleSaveAsNew = () => {
    clearDraft();
    if (onSaveAsNew) {
      onSaveAsNew(formData as Omit<Drill, 'id' | 'createdAt' | 'updatedAt'>);
    }
  };

  const handleDelete = () => {
    if (drill && onDelete) {
      if (confirm(`Are you sure you want to delete "${drill.name}"?`)) {
        clearDraft();
        onDelete(drill);
      }
    }
  };

  const handleCancel = () => {
    // If there are unsaved changes, confirm before discarding
    if (hasChanges) {
      if (confirm('You have unsaved changes. Are you sure you want to discard them?')) {
        clearDraft();
        onCancel();
      }
    } else {
      clearDraft();
      onCancel();
    }
  };

  const categoryOptions = DRILL_CATEGORIES.map(c => ({ value: c, label: c }));
  const durationOptions = DRILL_DURATIONS.map(d => ({ value: d, label: d }));
  
  // For new drills, require at least a name to enable create button
  // For editing, require changes to enable update button
  const canSubmit = isEditing ? hasChanges : formData.name.trim().length > 0;

  return (
    <form onSubmit={handleUpdate} className="flex flex-col h-full">
      {/* Form content - no scrolling, fits on page */}
      <div className="space-y-2">
        {/* Name, Duration, Category on same line */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <Input
            id="name"
            label="Drill Name"
            value={formData.name}
            onChange={(e) => handleFieldChange('name', e.target.value)}
            placeholder="Enter drill name"
            required
            compact
          />
          <Select
            id="duration"
            label="Duration"
            value={formData.duration}
            onChange={(e) => handleFieldChange('duration', e.target.value)}
            options={durationOptions}
            compact
          />
          <Select
            id="category"
            label="Category"
            value={formData.category}
            onChange={(e) => handleFieldChange('category', e.target.value)}
            options={categoryOptions}
            compact
          />
        </div>

        {/* Description and Objective side by side */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <Textarea
            id="description"
            label="Description"
            value={formData.description}
            onChange={(e) => handleFieldChange('description', e.target.value)}
            placeholder="Brief description of the drill"
            rows={2}
            compact
          />
          <Textarea
            id="objective"
            label="Objective"
            value={formData.objective}
            onChange={(e) => handleFieldChange('objective', e.target.value)}
            placeholder="What is the goal of this drill?"
            rows={2}
            compact
          />
        </div>

        {/* Setup and Execution side by side */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <Textarea
            id="setup"
            label="Setup"
            value={formData.setup}
            onChange={(e) => handleFieldChange('setup', e.target.value)}
            placeholder="How to set up the drill"
            rows={2}
            compact
          />
          <Textarea
            id="execution"
            label="Execution"
            value={formData.execution}
            onChange={(e) => handleFieldChange('execution', e.target.value)}
            placeholder="How to run the drill"
            rows={2}
            compact
          />
        </div>

        {/* Coaching Points and Variations side by side */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <Textarea
            id="coachingPoints"
            label="Coaching Points"
            value={formData.coachingPoints}
            onChange={(e) => handleFieldChange('coachingPoints', e.target.value)}
            placeholder="Key points for coaches"
            rows={2}
            compact
          />
          <Textarea
            id="variations"
            label="Variations"
            value={formData.variations}
            onChange={(e) => handleFieldChange('variations', e.target.value)}
            placeholder="Alternative ways to run this drill"
            rows={2}
            compact
          />
        </div>

        {/* Equipment */}
        <EquipmentPicker
          label="Equipment"
          value={formData.equipment}
          onChange={(value) => handleFieldChange('equipment', value)}
          compact
        />

        {/* Video and PDF links */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <Input
            id="videoLink"
            label="Video Link"
            type="url"
            value={formData.videoLink}
            onChange={(e) => handleFieldChange('videoLink', e.target.value)}
            placeholder="https://youtube.com/..."
            compact
          />
          <Input
            id="pdfLink"
            label="PDF Link"
            type="url"
            value={formData.pdfLink}
            onChange={(e) => handleFieldChange('pdfLink', e.target.value)}
            placeholder="https://example.com/drill.pdf"
            compact
          />
        </div>
      </div>

      {/* Fixed action buttons at bottom */}
      <div className="flex justify-between gap-2 pt-3 mt-3 border-t border-gray-200 dark:border-gray-800 flex-shrink-0">
        <div className="flex gap-2">
          {isEditing && onDelete && (
            <Button type="button" variant="ghost" onClick={handleDelete} className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20">
              <Trash2 className="w-4 h-4" />
              Delete
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={handleCancel}>
            <X className="w-4 h-4" />
            Cancel
          </Button>
          {isEditing && onSaveAsNew && (
            <Button type="button" variant="secondary" onClick={handleSaveAsNew}>
              <Copy className="w-4 h-4" />
              Create as New
            </Button>
          )}
          <Button type="submit" disabled={!canSubmit}>
            <Save className="w-4 h-4" />
            {isEditing ? 'Update' : 'Create'}
          </Button>
        </div>
      </div>
    </form>
  );
}
