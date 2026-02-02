'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { PracticePlanDrill, DRILL_DURATIONS, getEffectiveDuration } from '@/lib/types';
import { GripVertical, X, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useState } from 'react';

interface SortableDrillItemProps {
  item: PracticePlanDrill;
  onRemove: (id: string) => void;
  onUpdateDuration: (id: string, duration: string) => void;
  onViewDetails: (item: PracticePlanDrill) => void;
}

export function SortableDrillItem({ item, onRemove, onUpdateDuration, onViewDetails }: SortableDrillItemProps) {
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

  const categoryColors: Record<string, string> = {
    Admin: 'border-l-slate-500',
    Skating: 'border-l-blue-500',
    Shooting: 'border-l-red-500',
    Passing: 'border-l-green-500',
    Defensive: 'border-l-purple-500',
    Offensive: 'border-l-orange-500',
    Other: 'border-l-gray-500',
  };

  const effectiveDuration = getEffectiveDuration(item);
  const isCustomDuration = item.customDuration && item.customDuration !== item.drill.duration;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700
        border-l-4 ${categoryColors[item.drill.category]}
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
            {item.order}
          </span>
        </div>

        {/* Drill Info */}
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-gray-900 dark:text-white truncate">
            {item.drill.name}
          </h4>
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <span>{item.drill.category}</span>
          </div>
        </div>

        {/* Duration Selector */}
        <div className="flex items-center gap-1.5">
          <Clock className="w-4 h-4 text-gray-400" />
          <select
            value={effectiveDuration}
            onChange={(e) => onUpdateDuration(item.id, e.target.value)}
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
            <span className="text-xs text-primary-600 dark:text-primary-400" title={`Default: ${item.drill.duration}`}>
              *
            </span>
          )}
        </div>

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
          onClick={() => onRemove(item.id)}
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
                Duration modified from default ({item.drill.duration})
              </div>
            )}
            {item.drill.objective && (
              <div>
                <span className="font-medium text-gray-700 dark:text-gray-300">Objective: </span>
                <span className="text-gray-600 dark:text-gray-400">{item.drill.objective}</span>
              </div>
            )}
            {item.drill.execution && (
              <div>
                <span className="font-medium text-gray-700 dark:text-gray-300">Execution: </span>
                <span className="text-gray-600 dark:text-gray-400">{item.drill.execution}</span>
              </div>
            )}
            {item.drill.coachingPoints && (
              <div>
                <span className="font-medium text-gray-700 dark:text-gray-300">Coaching Points: </span>
                <span className="text-gray-600 dark:text-gray-400">{item.drill.coachingPoints}</span>
              </div>
            )}
            {item.drill.equipment && (
              <div>
                <span className="font-medium text-gray-700 dark:text-gray-300">Equipment: </span>
                <span className="text-gray-600 dark:text-gray-400">{item.drill.equipment}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
