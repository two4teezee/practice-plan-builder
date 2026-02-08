'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { DrillSketchModal } from '@/components/drills/DrillSketchModal';
import type { Drill, DrillItem } from '@/lib/types';
import { getEffectiveDrill, hasDrillOverrides, getOverriddenFields } from '@/lib/types';
import { Save, X, RotateCcw, Pencil, AlertCircle } from 'lucide-react';

interface PracticeDrillEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  drillItem: DrillItem;
  onSave: (overrides: Partial<Drill>) => void;
  onReset: () => void;
}

// Compact styling to match practice plan details panel
const labelStyle = { fontSize: '0.6875rem' }; // 11px
const inputStyle = { 
  fontSize: '0.8125rem', // 13px
  paddingTop: '0.375rem', // 6px
  paddingBottom: '0.375rem',
  paddingLeft: '0.5rem', // 8px
  paddingRight: '0.5rem',
};

export function PracticeDrillEditModal({ 
  isOpen, 
  onClose, 
  drillItem, 
  onSave,
  onReset,
}: PracticeDrillEditModalProps) {
  // Work with a local copy of overrides
  const [localOverrides, setLocalOverrides] = useState<Partial<Drill>>(() => 
    drillItem.overrides ? { ...drillItem.overrides } : {}
  );
  const [isSketchModalOpen, setIsSketchModalOpen] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Reset local state when modal opens with new drill
  const effectiveDrill = getEffectiveDrill({ ...drillItem, overrides: localOverrides });
  const originalDrill = drillItem.drill;
  const hasOverrides = Object.keys(localOverrides).length > 0;
  const overriddenFields = getOverriddenFields({ ...drillItem, overrides: localOverrides });

  // Check if a field has been modified
  const isFieldModified = (field: keyof Drill) => overriddenFields.includes(field);

  // Update a field override
  const updateField = <K extends keyof Drill>(field: K, value: Drill[K]) => {
    // If value matches original, remove the override
    if (value === originalDrill[field]) {
      const newOverrides = { ...localOverrides };
      delete newOverrides[field];
      setLocalOverrides(newOverrides);
    } else {
      setLocalOverrides(prev => ({ ...prev, [field]: value }));
    }
  };

  // Reset a single field to library value
  const resetField = (field: keyof Drill) => {
    const newOverrides = { ...localOverrides };
    delete newOverrides[field];
    setLocalOverrides(newOverrides);
  };

  // Handle save
  const handleSave = () => {
    onSave(localOverrides);
    onClose();
  };

  // Handle reset all
  const handleResetAll = () => {
    onReset();
    setLocalOverrides({});
    setShowResetConfirm(false);
    onClose();
  };

  // Handle sketch save
  const handleSketchSave = (sketchData: string) => {
    updateField('sketchData', sketchData);
  };

  // Get sketch preview URL
  const sketchPreviewUrl = useMemo(() => {
    const sketchData = effectiveDrill.sketchData;
    if (!sketchData) return null;
    try {
      const parsed = JSON.parse(sketchData);
      return parsed.imagePreview || null;
    } catch {
      return sketchData.startsWith('data:') ? sketchData : null;
    }
  }, [effectiveDrill.sketchData]);

  const inputClasses = "w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500";

  // Field wrapper with reset button
  const FieldWrapper = ({ 
    field, 
    label, 
    children 
  }: { 
    field: keyof Drill; 
    label: string; 
    children: React.ReactNode;
  }) => {
    const modified = isFieldModified(field);
    return (
      <div className="relative">
        <div className="flex items-center justify-between mb-1">
          <span className="block font-medium text-gray-700 dark:text-gray-300" style={labelStyle}>
            {label}
            {modified && (
              <span className="ml-1.5 text-amber-600 dark:text-amber-400 text-[10px]">
                (modified)
              </span>
            )}
          </span>
          {modified && (
            <button
              type="button"
              onClick={() => resetField(field)}
              className="text-xs text-gray-500 hover:text-primary-600 dark:text-gray-400 dark:hover:text-primary-400 flex items-center gap-1"
              title="Reset to library version"
            >
              <RotateCcw className="w-3 h-3" />
              Reset
            </button>
          )}
        </div>
        <div className={modified ? 'ring-2 ring-amber-500/30 rounded-lg' : ''}>
          {children}
        </div>
      </div>
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Edit "${originalDrill.name}" for this practice`}
      size="lg"
    >
      <div className="flex flex-col gap-3">
        {/* Info banner */}
        <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-sm">
          <AlertCircle className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
          <p className="text-blue-700 dark:text-blue-300">
            Changes made here only apply to this practice plan. The drill in your library will not be affected.
          </p>
        </div>

        {/* Two-column layout: Text fields | Sketch */}
        <div className="grid grid-cols-2 gap-4">
          {/* Left column: Text fields */}
          <div className="flex flex-col gap-3">
            <FieldWrapper field="setup" label="Setup">
              <textarea
                value={effectiveDrill.setup}
                onChange={(e) => updateField('setup', e.target.value)}
                placeholder="How to set up the drill"
                rows={4}
                className={`${inputClasses} resize-none`}
                style={inputStyle}
              />
            </FieldWrapper>

            <FieldWrapper field="coachingPoints" label="Coaching Points">
              <textarea
                value={effectiveDrill.coachingPoints}
                onChange={(e) => updateField('coachingPoints', e.target.value)}
                placeholder="Key points for coaches"
                rows={4}
                className={`${inputClasses} resize-none`}
                style={inputStyle}
              />
            </FieldWrapper>
            
          </div>

          {/* Right column: Sketch */}
          <div className="flex flex-col">
            <FieldWrapper field="sketchData" label="Drill Sketch">
              <div className="flex flex-col rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 overflow-hidden h-[280px]">
                {/* Sketch preview area */}
                <div className="flex-1 relative">
                  {sketchPreviewUrl ? (
                    <div className="absolute inset-0 p-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img 
                        src={sketchPreviewUrl} 
                        alt="Drill sketch preview" 
                        className="w-full h-full object-contain rounded"
                      />
                    </div>
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-gray-400 dark:text-gray-500 text-sm">
                      <div className="text-center p-4">
                        <Pencil className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p>No sketch</p>
                      </div>
                    </div>
                  )}
                </div>
                <div className="p-2 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
                  <Button
                    type="button"
                    variant={effectiveDrill.sketchData ? 'secondary' : 'outline'}
                    onClick={() => setIsSketchModalOpen(true)}
                    className="w-full"
                    size="sm"
                  >
                    <Pencil className="w-4 h-4" />
                    {effectiveDrill.sketchData ? 'Edit Sketch' : 'Create Sketch'}
                  </Button>
                </div>
              </div>
            </FieldWrapper>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center justify-between pt-3 border-t border-gray-200 dark:border-gray-700">
          <div>
            {(hasOverrides || hasDrillOverrides(drillItem)) && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowResetConfirm(true)}
                className="text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-900/20 border-amber-300 dark:border-amber-700"
              >
                <RotateCcw className="w-4 h-4" />
                Reset All to Library
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              <X className="w-4 h-4" />
              Cancel
            </Button>
            <Button type="button" onClick={handleSave}>
              <Save className="w-4 h-4" />
              Save Changes
            </Button>
          </div>
        </div>
      </div>

      {/* Sketch Modal */}
      <DrillSketchModal
        isOpen={isSketchModalOpen}
        onClose={() => setIsSketchModalOpen(false)}
        onSave={handleSketchSave}
        initialSketchData={effectiveDrill.sketchData || ''}
      />

      {/* Reset Confirmation Modal */}
      <Modal
        isOpen={showResetConfirm}
        onClose={() => setShowResetConfirm(false)}
        title="Reset to Library Version?"
        size="sm"
      >
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <RotateCcw className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-gray-700 dark:text-gray-300">
                This will reset all practice-specific changes for this drill.
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                The drill will use the original values from your library.
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowResetConfirm(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleResetAll}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              <RotateCcw className="w-4 h-4" />
              Reset to Library
            </Button>
          </div>
        </div>
      </Modal>
    </Modal>
  );
}
