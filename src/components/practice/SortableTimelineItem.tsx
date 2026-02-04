'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { TimelineItem, DrillItem } from '@/lib/types';
import { DRILL_DURATIONS, parseVariations } from '@/lib/types';
import { GripVertical, X, ChevronDown, ChevronUp, Clock, Layers } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ParallelGroupEditor } from './ParallelGroupEditor';

interface SortableTimelineItemProps {
  item: TimelineItem;
  index: number;
  onRemove: (id: string) => void;
  onUpdateDuration: (id: string, duration: string) => void;
  onUpdateVariations: (id: string, variations: string[]) => void;
  onViewDetails: (item: DrillItem) => void;
  onReorderGroup: (parallelId: string, groupId: string, items: TimelineItem[]) => void;
  onAddDrillToGroup: (groupPath: string[]) => void;
  onAddNestedSplit: (parallelId: string, groupId: string) => void;
  onAddGroup: (parallelId: string) => void;
  onRemoveGroup: (parallelId: string, groupId: string) => void;
  onRemoveParallelSplit: (id: string) => void;
  onUpdateGroupName: (parallelId: string, groupId: string, name: string) => void;
  depth?: number;
  parentPath?: string[];
  compact?: boolean;
}

// Variations dropdown component - uses portal to avoid clipping
function VariationsDropdown({
  variations,
  selectedVariations,
  onUpdate,
  compact = false,
}: {
  variations: string[];
  selectedVariations: string[];
  onUpdate: (selected: string[]) => void;
  compact?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (
        buttonRef.current && !buttonRef.current.contains(target) &&
        dropdownRef.current && !dropdownRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Update position when opening
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const dropdownWidth = 250;
      
      // Position dropdown below button, aligned to right edge
      let left = rect.right - dropdownWidth;
      // Ensure it doesn't go off screen left
      if (left < 10) left = 10;
      // Ensure it doesn't go off screen right
      if (left + dropdownWidth > window.innerWidth - 10) {
        left = window.innerWidth - dropdownWidth - 10;
      }
      
      setDropdownPosition({
        top: rect.bottom + 4,
        left: left,
      });
    }
  }, [isOpen]);

  const toggleVariation = (variation: string) => {
    if (selectedVariations.includes(variation)) {
      onUpdate(selectedVariations.filter(v => v !== variation));
    } else {
      onUpdate([...selectedVariations, variation]);
    }
  };

  const selectedCount = selectedVariations.length;
  const hasSelections = selectedCount > 0;

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`
          flex items-center gap-1 rounded-lg border cursor-pointer
          bg-white dark:bg-gray-700 
          border-gray-200 dark:border-gray-600
          text-gray-900 dark:text-white
          hover:bg-gray-50 dark:hover:bg-gray-600
          focus:ring-2 focus:ring-primary-500 focus:border-primary-500
          ${compact ? 'px-1.5 py-0.5 text-xs' : 'px-2 py-1 text-sm'}
          ${hasSelections ? 'ring-2 ring-primary-500/50' : ''}
        `}
      >
        <Layers className={compact ? 'w-3 h-3' : 'w-4 h-4'} />
        <span className="whitespace-nowrap">
          {hasSelections ? `${selectedCount} var${selectedCount > 1 ? 's' : ''}` : 'Variations'}
        </span>
        <ChevronDown className={`${compact ? 'w-3 h-3' : 'w-4 h-4'} ${isOpen ? 'rotate-180' : ''} transition-transform`} />
      </button>

      {isOpen && typeof document !== 'undefined' && createPortal(
        <div 
          ref={dropdownRef}
          className="fixed z-[9999] min-w-[200px] max-w-[300px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-xl"
          style={{ 
            top: dropdownPosition.top,
            left: dropdownPosition.left,
          }}
        >
          <div className="p-2 border-b border-gray-100 dark:border-gray-700">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
              Select variations to run
            </span>
          </div>
          <div className="max-h-48 overflow-y-auto p-1">
            {variations.map((variation) => (
              <label
                key={variation}
                className="flex items-start gap-2 p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selectedVariations.includes(variation)}
                  onChange={() => toggleVariation(variation)}
                  className="mt-0.5 rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300 break-words">
                  {variation}
                </span>
              </label>
            ))}
          </div>
          {hasSelections && (
            <div className="p-2 border-t border-gray-100 dark:border-gray-700">
              <button
                type="button"
                onClick={() => onUpdate([])}
                className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                Clear all
              </button>
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}

export function SortableTimelineItem({ 
  item, 
  index,
  onRemove, 
  onUpdateDuration,
  onUpdateVariations,
  onViewDetails,
  onReorderGroup,
  onAddDrillToGroup,
  onAddNestedSplit,
  onAddGroup,
  onRemoveGroup,
  onRemoveParallelSplit,
  onUpdateGroupName,
  depth = 0,
  parentPath = [],
  compact = false,
}: SortableTimelineItemProps) {
  const [expanded, setExpanded] = useState(false);
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  // If it's a parallel split, render the parallel group editor
  if (item.type === 'parallel') {
    return (
      <div ref={setNodeRef} style={style} className={isDragging ? 'opacity-50' : ''}>
        <div className="flex items-start gap-2">
          <button
            {...attributes}
            {...listeners}
            className="drag-handle p-1 mt-3 rounded hover:bg-gray-100 dark:hover:bg-gray-700 flex-shrink-0"
          >
            <GripVertical className="w-5 h-5 text-gray-400" />
          </button>
          <div className="flex-1">
            <ParallelGroupEditor
              item={item}
              onReorderGroup={onReorderGroup}
              onRemove={onRemove}
              onUpdateDuration={onUpdateDuration}
              onUpdateVariations={onUpdateVariations}
              onViewDetails={onViewDetails}
              onAddDrillToGroup={onAddDrillToGroup}
              onAddNestedSplit={onAddNestedSplit}
              onAddGroup={onAddGroup}
              onRemoveGroup={onRemoveGroup}
              onRemoveParallelSplit={onRemoveParallelSplit}
              onUpdateGroupName={onUpdateGroupName}
              depth={depth}
              parentPath={parentPath}
            />
          </div>
        </div>
      </div>
    );
  }

  // It's a drill item
  const drillItem = item as DrillItem;
  const categoryColors: Record<string, string> = {
    Admin: 'border-l-slate-500',
    Skating: 'border-l-blue-500',
    Shooting: 'border-l-red-500',
    Passing: 'border-l-green-500',
    Defensive: 'border-l-purple-500',
    Offensive: 'border-l-orange-500',
    Goalie: 'border-l-yellow-500',
    Scrimmage: 'border-l-cyan-500',
    Other: 'border-l-gray-500',
  };

  const effectiveDuration = drillItem.customDuration || drillItem.drill.duration;
  const isCustomDuration = drillItem.customDuration && drillItem.customDuration !== drillItem.drill.duration;
  
  // Parse variations from the drill
  const availableVariations = parseVariations(drillItem.drill.variations);
  const hasVariations = availableVariations.length > 0;
  const selectedVariations = drillItem.selectedVariations || [];

  // Compact version for side-by-side group display
  if (compact) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className={`
          bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600
          border-l-4 ${categoryColors[drillItem.drill.category]}
          ${isDragging ? 'opacity-50 shadow-lg' : ''}
        `}
      >
        <div className="flex items-center p-2 gap-2">
          {/* Drag Handle */}
          <button
            {...attributes}
            {...listeners}
            className="drag-handle p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
          >
            <GripVertical className="w-4 h-4 text-gray-400" />
          </button>

          {/* Drill Info */}
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-medium text-gray-900 dark:text-white truncate">
              {drillItem.drill.name}
            </h4>
          </div>

          {/* Duration */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <select
              value={effectiveDuration}
              onChange={(e) => onUpdateDuration(drillItem.id, e.target.value)}
              className={`
                px-1.5 py-0.5 text-xs rounded border
                bg-white dark:bg-gray-600 
                border-gray-200 dark:border-gray-500
                text-gray-900 dark:text-white
                focus:ring-1 focus:ring-primary-500
                cursor-pointer
                ${isCustomDuration ? 'ring-1 ring-primary-500/50' : ''}
              `}
            >
              {DRILL_DURATIONS.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          {/* Variations Dropdown (only if drill has variations) */}
          {hasVariations && (
            <VariationsDropdown
              variations={availableVariations}
              selectedVariations={selectedVariations}
              onUpdate={(vars) => onUpdateVariations(drillItem.id, vars)}
              compact
            />
          )}

          {/* Remove */}
          <button
            type="button"
            onClick={() => onRemove(drillItem.id)}
            className="p-0.5 text-red-500 hover:text-red-700 dark:text-red-400"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  // Full version for main timeline
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700
        border-l-4 ${categoryColors[drillItem.drill.category]}
        ${isDragging ? 'opacity-50 shadow-2xl' : 'shadow-sm'}
      `}
    >
      <div className="flex items-center p-3 gap-3">
        {/* Drag Handle */}
        <button
          {...attributes}
          {...listeners}
          className="drag-handle p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          <GripVertical className="w-5 h-5 text-gray-400" />
        </button>

        {/* Order Number */}
        <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
          <span className="text-sm font-bold text-primary-700 dark:text-primary-300">
            {index + 1}
          </span>
        </div>

        {/* Drill Info */}
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-gray-900 dark:text-white truncate">
            {drillItem.drill.name}
          </h4>
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <span>{drillItem.drill.category}</span>
          </div>
        </div>

        {/* Duration Selector */}
        <div className="flex items-center gap-1.5">
          <Clock className="w-4 h-4 text-gray-400" />
          <select
            value={effectiveDuration}
            onChange={(e) => onUpdateDuration(drillItem.id, e.target.value)}
            className={`
              px-2 py-1 text-sm rounded-lg border
              bg-white dark:bg-gray-700 
              border-gray-200 dark:border-gray-600
              text-gray-900 dark:text-white
              focus:ring-2 focus:ring-primary-500 focus:border-primary-500
              cursor-pointer
              ${isCustomDuration ? 'ring-2 ring-primary-500/50' : ''}
            `}
          >
            {DRILL_DURATIONS.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
          {isCustomDuration && (
            <span className="text-xs text-primary-600 dark:text-primary-400" title={`Default: ${drillItem.drill.duration}`}>
              *
            </span>
          )}
        </div>

        {/* Variations Dropdown (only if drill has variations) */}
        {hasVariations && (
          <VariationsDropdown
            variations={availableVariations}
            selectedVariations={selectedVariations}
            onUpdate={(vars) => onUpdateVariations(drillItem.id, vars)}
          />
        )}

        {/* Actions */}
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onRemove(drillItem.id)}
          className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div className="px-4 pb-4 pt-0 border-t border-gray-100 dark:border-gray-700 mt-2">
          <div className="pt-3 space-y-2 text-sm">
            {isCustomDuration && (
              <div className="text-xs text-primary-600 dark:text-primary-400 mb-2">
                Duration modified from default ({drillItem.drill.duration})
              </div>
            )}
            {drillItem.drill.objective && (
              <div>
                <span className="font-medium text-gray-700 dark:text-gray-300">Objective: </span>
                <span className="text-gray-600 dark:text-gray-400">{drillItem.drill.objective}</span>
              </div>
            )}
            {drillItem.drill.execution && (
              <div>
                <span className="font-medium text-gray-700 dark:text-gray-300">Execution: </span>
                <span className="text-gray-600 dark:text-gray-400">{drillItem.drill.execution}</span>
              </div>
            )}
            {drillItem.drill.coachingPoints && (
              <div>
                <span className="font-medium text-gray-700 dark:text-gray-300">Coaching Points: </span>
                <span className="text-gray-600 dark:text-gray-400">{drillItem.drill.coachingPoints}</span>
              </div>
            )}
            {selectedVariations.length > 0 && (
              <div>
                <span className="font-medium text-gray-700 dark:text-gray-300">Selected Variations: </span>
                <span className="text-gray-600 dark:text-gray-400">{selectedVariations.join(', ')}</span>
              </div>
            )}
            {drillItem.drill.equipment && (
              <div>
                <span className="font-medium text-gray-700 dark:text-gray-300">Equipment: </span>
                <span className="text-gray-600 dark:text-gray-400">{drillItem.drill.equipment}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
