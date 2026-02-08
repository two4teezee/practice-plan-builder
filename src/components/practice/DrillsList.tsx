'use client';

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import type { TimelineItem, DrillItem, Drill } from '@/lib/types';
import { SortableTimelineItem } from './SortableTimelineItem';
import { ListOrdered } from 'lucide-react';

interface DrillsListProps {
  timeline: TimelineItem[];
  onReorder: (items: TimelineItem[]) => void;
  onReorderGroup: (parallelId: string, groupId: string, items: TimelineItem[]) => void;
  onRemove: (id: string) => void;
  onUpdateDuration: (id: string, duration: string) => void;
  onUpdateVariations: (id: string, variations: string[]) => void;
  onViewDetails: (item: DrillItem) => void;
  onAddDrillToGroup: (groupPath: string[] | null) => void;
  onAddParallelSplit: () => void;
  onAddNestedSplit: (parallelId: string, groupId: string) => void;
  onAddGroup: (parallelId: string) => void;
  onRemoveGroup: (parallelId: string, groupId: string) => void;
  onRemoveParallelSplit: (id: string) => void;
  onUpdateGroupName: (parallelId: string, groupId: string, name: string) => void;
  onUpdateOverrides?: (id: string, overrides: Partial<Drill> | undefined) => void;
}

export function DrillsList({ 
  timeline, 
  onReorder, 
  onReorderGroup,
  onRemove, 
  onUpdateDuration,
  onUpdateVariations,
  onViewDetails,
  onAddDrillToGroup,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onAddParallelSplit,
  onAddNestedSplit,
  onAddGroup,
  onRemoveGroup,
  onRemoveParallelSplit,
  onUpdateGroupName,
  onUpdateOverrides,
}: DrillsListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = timeline.findIndex((item) => item.id === active.id);
      const newIndex = timeline.findIndex((item) => item.id === over.id);
      
      if (oldIndex !== -1 && newIndex !== -1) {
        const reordered = arrayMove(timeline, oldIndex, newIndex);
        onReorder(reordered);
      }
    }
  }

  if (timeline.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <ListOrdered className="w-12 h-12 text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
          No drills added yet
        </h3>
        <p className="text-gray-500 dark:text-gray-400">
          Add drills from the library to build your practice plan
        </p>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={timeline.map((item) => item.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-3">
          {timeline.map((item, index) => (
            <SortableTimelineItem
              key={item.id}
              item={item}
              index={index}
              onRemove={onRemove}
              onUpdateDuration={onUpdateDuration}
              onUpdateVariations={onUpdateVariations}
              onViewDetails={onViewDetails}
              onReorderGroup={onReorderGroup}
              onAddDrillToGroup={onAddDrillToGroup}
              onAddNestedSplit={onAddNestedSplit}
              onAddGroup={onAddGroup}
              onRemoveGroup={onRemoveGroup}
              onRemoveParallelSplit={onRemoveParallelSplit}
              onUpdateGroupName={onUpdateGroupName}
              onUpdateOverrides={onUpdateOverrides}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
