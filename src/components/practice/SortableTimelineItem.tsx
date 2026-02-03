'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { TimelineItem, DrillItem } from '@/lib/types';
import { DRILL_DURATIONS } from '@/lib/types';
import { GripVertical, X, ChevronDown, ChevronUp, Clock } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useState } from 'react';
import { ParallelGroupEditor } from './ParallelGroupEditor';

interface SortableTimelineItemProps {
  item: TimelineItem;
  index: number;
  onRemove: (id: string) => void;
  onUpdateDuration: (id: string, duration: string) => void;
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

export function SortableTimelineItem({ 
  item, 
  index,
  onRemove, 
  onUpdateDuration, 
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
