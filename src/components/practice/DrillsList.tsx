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
import { PracticePlanDrill } from '@/lib/types';
import { SortableDrillItem } from './SortableDrillItem';
import { ListOrdered } from 'lucide-react';

interface DrillsListProps {
  drills: PracticePlanDrill[];
  onReorder: (drills: PracticePlanDrill[]) => void;
  onRemove: (id: string) => void;
  onUpdateDuration: (id: string, duration: string) => void;
  onViewDetails: (item: PracticePlanDrill) => void;
}

export function DrillsList({ drills, onReorder, onRemove, onUpdateDuration, onViewDetails }: DrillsListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = drills.findIndex((d) => d.id === active.id);
      const newIndex = drills.findIndex((d) => d.id === over.id);
      
      const reordered = arrayMove(drills, oldIndex, newIndex).map((d, i) => ({
        ...d,
        order: i + 1,
      }));
      
      onReorder(reordered);
    }
  }

  if (drills.length === 0) {
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
        items={drills.map((d) => d.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-3">
          {drills.map((drill) => (
            <SortableDrillItem
              key={drill.id}
              item={drill}
              onRemove={onRemove}
              onUpdateDuration={onUpdateDuration}
              onViewDetails={onViewDetails}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
