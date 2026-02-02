'use client';

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';
import { EquipmentPicker } from '@/components/ui/EquipmentPicker';
import { Drill, DRILL_CATEGORIES, SKILL_FOCUSES, DRILL_DURATIONS } from '@/lib/types';
import { Save, X } from 'lucide-react';

interface DrillFormProps {
  drill?: Drill | null;
  onSave: (drill: Omit<Drill, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onCancel: () => void;
}

export function DrillForm({ drill, onSave, onCancel }: DrillFormProps) {
  const [formData, setFormData] = useState({
    name: '',
    category: DRILL_CATEGORIES[0],
    duration: '5:00',
    skillFocus: SKILL_FOCUSES[0],
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

  useEffect(() => {
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
    }
  }, [drill]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  const categoryOptions = DRILL_CATEGORIES.map(c => ({ value: c, label: c }));
  const skillFocusOptions = SKILL_FOCUSES.map(s => ({ value: s, label: s }));
  const durationOptions = DRILL_DURATIONS.map(d => ({ value: d, label: d }));

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          id="name"
          label="Drill Name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="Enter drill name"
          required
        />
        <Select
          id="category"
          label="Category"
          value={formData.category}
          onChange={(e) => setFormData({ ...formData, category: e.target.value as typeof formData.category })}
          options={categoryOptions}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Select
          id="duration"
          label="Duration"
          value={formData.duration}
          onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
          options={durationOptions}
        />
        <Select
          id="skillFocus"
          label="Skill Focus"
          value={formData.skillFocus}
          onChange={(e) => setFormData({ ...formData, skillFocus: e.target.value as typeof formData.skillFocus })}
          options={skillFocusOptions}
        />
      </div>

      <Textarea
        id="description"
        label="Description"
        value={formData.description}
        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
        placeholder="Brief description of the drill"
        rows={2}
      />

      <Textarea
        id="objective"
        label="Objective"
        value={formData.objective}
        onChange={(e) => setFormData({ ...formData, objective: e.target.value })}
        placeholder="What is the goal of this drill?"
        rows={2}
      />

      <Textarea
        id="setup"
        label="Setup"
        value={formData.setup}
        onChange={(e) => setFormData({ ...formData, setup: e.target.value })}
        placeholder="How to set up the drill"
        rows={2}
      />

      <Textarea
        id="execution"
        label="Execution"
        value={formData.execution}
        onChange={(e) => setFormData({ ...formData, execution: e.target.value })}
        placeholder="How to run the drill"
        rows={3}
      />

      <Textarea
        id="coachingPoints"
        label="Coaching Points"
        value={formData.coachingPoints}
        onChange={(e) => setFormData({ ...formData, coachingPoints: e.target.value })}
        placeholder="Key points for coaches"
        rows={2}
      />

      <Textarea
        id="variations"
        label="Variations"
        value={formData.variations}
        onChange={(e) => setFormData({ ...formData, variations: e.target.value })}
        placeholder="Alternative ways to run this drill"
        rows={2}
      />

      <EquipmentPicker
        label="Equipment"
        value={formData.equipment}
        onChange={(value) => setFormData({ ...formData, equipment: value })}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          id="videoLink"
          label="Video Link"
          type="url"
          value={formData.videoLink}
          onChange={(e) => setFormData({ ...formData, videoLink: e.target.value })}
          placeholder="https://youtube.com/..."
        />
        <Input
          id="pdfLink"
          label="PDF Link"
          type="url"
          value={formData.pdfLink}
          onChange={(e) => setFormData({ ...formData, pdfLink: e.target.value })}
          placeholder="https://example.com/drill.pdf"
        />
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-800">
        <Button type="button" variant="outline" onClick={onCancel}>
          <X className="w-4 h-4" />
          Cancel
        </Button>
        <Button type="submit">
          <Save className="w-4 h-4" />
          {drill ? 'Update Drill' : 'Create Drill'}
        </Button>
      </div>
    </form>
  );
}
