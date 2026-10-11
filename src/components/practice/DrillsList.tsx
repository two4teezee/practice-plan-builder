'use client';

import { useCallback, useRef, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  pointerWithin,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import type { TimelineItem, DrillItem, Drill } from '@/lib/types';
import {
  TIMELINE_ROOT_ID,
  getContainerItems,
  findItemContainer,
  findTimelineItem,
  findGroupSplitId,
  moveTimelineItem,
  dissolveSplitIfSparse,
  getEffectiveDrill,
} from '@/lib/types';
import { SortableTimelineItem } from './SortableTimelineItem';
import { GripVertical, ListOrdered } from 'lucide-react';

interface DrillsListProps {
  timeline: TimelineItem[];
  onReorder: (items: TimelineItem[]) => void;
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
  onRunAlongside?: (id: string) => void;
}

// Resolve a droppable id to the container it represents: group drop zones and the
// root list are containers themselves, anything else is an item inside one.
function resolveContainer(timeline: TimelineItem[], id: UniqueIdentifier): string | null {
  const key = String(id);
  if (key === TIMELINE_ROOT_ID || getContainerItems(timeline, key)) return key;
  return findItemContainer(timeline, key);
}

export function DrillsList({
  timeline,
  onReorder,
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
  onRunAlongside,
}: DrillsListProps) {
  // While dragging, drills move between containers in this local copy so the list
  // previews the drop; it's committed (or discarded) when the drag ends.
  const [dragTimeline, setDragTimeline] = useState<TimelineItem[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const dragStartContainer = useRef<string | null>(null);
  const lastOverId = useRef<UniqueIdentifier | null>(null);
  const recentlyMovedContainer = useRef(false);
  const items = dragTimeline ?? timeline;

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const activeItem = activeId ? findTimelineItem(items, activeId) : null;

  // Prefer the innermost droppable under the pointer (a drill inside a group beats the
  // group, which beats the split around it). Splits only reorder within their own container.
  // Inside a group, a pointer within the span of its drills targets the nearest drill (so the
  // order can be set); anywhere else in the group box targets the group itself (= the bottom).
  const collisionDetection: CollisionDetection = useCallback((args) => {
    const activeKey = String(args.active.id);
    const current = dragTimeline ?? timeline;
    const dragged = findTimelineItem(current, activeKey);

    if (dragged?.type === 'parallel') {
      const container = findItemContainer(current, activeKey);
      const siblingIds = new Set((container && getContainerItems(current, container)?.map(i => i.id)) || []);
      return closestCenter({
        ...args,
        droppableContainers: args.droppableContainers.filter(c => siblingIds.has(String(c.id))),
      });
    }

    // Right after a drill jumps containers, layouts shift; hold the last target for a frame
    // so the drill doesn't bounce back and forth.
    if (recentlyMovedContainer.current && lastOverId.current) {
      return [{ id: lastOverId.current }];
    }

    const hits = pointerWithin(args);
    if (hits.length > 0) {
      const area = (id: UniqueIdentifier) => {
        const rect = args.droppableRects.get(id);
        return rect ? rect.width * rect.height : Infinity;
      };
      let target = [...hits].sort((a, b) => area(a.id) - area(b.id))[0];
      const groupKey = String(target.id);
      const groupItems = groupKey !== TIMELINE_ROOT_ID ? getContainerItems(current, groupKey) : null;
      const pointerY = args.pointerCoordinates?.y;
      if (groupItems && groupItems.length > 0 && pointerY !== undefined) {
        const itemRects = groupItems
          .map(i => ({ id: i.id, rect: args.droppableRects.get(i.id) }))
          .filter((r): r is { id: string; rect: NonNullable<typeof r.rect> } => !!r.rect);
        const spanTop = Math.min(...itemRects.map(r => r.rect.top));
        const spanBottom = Math.max(...itemRects.map(r => r.rect.top + r.rect.height));
        if (itemRects.length > 0 && pointerY >= spanTop && pointerY <= spanBottom) {
          const distance = (r: (typeof itemRects)[number]) =>
            Math.abs(r.rect.top + r.rect.height / 2 - pointerY);
          const nearest = itemRects.reduce((best, r) => (distance(r) < distance(best) ? r : best));
          target = { id: nearest.id };
        }
      }
      lastOverId.current = target.id;
      return [target];
    }
    const fallback = closestCenter(args);
    if (fallback[0]) lastOverId.current = fallback[0].id;
    return fallback;
  }, [dragTimeline, timeline]);

  function handleDragStart({ active }: DragStartEvent) {
    setActiveId(String(active.id));
    setDragTimeline(timeline);
    dragStartContainer.current = findItemContainer(timeline, String(active.id));
  }

  // Live-move a drill into another container as it's dragged over it
  function handleDragOver({ active, over }: DragOverEvent) {
    if (!over) return;
    const activeKey = String(active.id);
    const activeTop = active.rect.current.translated?.top ?? 0;

    setDragTimeline(prev => {
      if (!prev || findTimelineItem(prev, activeKey)?.type !== 'drill') return prev;

      const fromContainer = findItemContainer(prev, activeKey);
      const toContainer = resolveContainer(prev, over.id);
      if (!fromContainer || !toContainer) return prev;

      const targetItems = getContainerItems(prev, toContainer) ?? [];
      // Hovering the group box rather than one of its drills is ambiguous: go to the bottom
      const isOverGroupBox = String(over.id) === toContainer && toContainer !== TIMELINE_ROOT_ID;
      if (fromContainer === toContainer) {
        const isLast = targetItems[targetItems.length - 1]?.id === activeKey;
        if (!isOverGroupBox || isLast) return prev;
      }

      const overIndex = targetItems.findIndex(i => i.id === String(over.id));
      let index = targetItems.length;
      if (overIndex !== -1 && !isOverGroupBox) {
        const isBelowOver = activeTop > over.rect.top + over.rect.height / 2;
        index = overIndex + (isBelowOver ? 1 : 0);
      }

      recentlyMovedContainer.current = true;
      requestAnimationFrame(() => {
        recentlyMovedContainer.current = false;
      });
      return moveTimelineItem(prev, activeKey, toContainer, index);
    });
  }

  function resetDrag() {
    setActiveId(null);
    setDragTimeline(null);
    dragStartContainer.current = null;
    lastOverId.current = null;
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    let result = dragTimeline ?? timeline;
    const activeKey = String(active.id);
    const container = findItemContainer(result, activeKey);

    // Reorder within the container the drill ended up in
    if (over && container && String(over.id) !== activeKey) {
      const containerItems = getContainerItems(result, container) ?? [];
      const oldIndex = containerItems.findIndex(i => i.id === activeKey);
      const newIndex = containerItems.findIndex(i => i.id === String(over.id));
      if (oldIndex !== -1 && newIndex !== -1) {
        const reordered = arrayMove(containerItems, oldIndex, newIndex);
        result = moveTimelineItem(result, activeKey, container, reordered.findIndex(i => i.id === activeKey));
      }
    }

    // A split the drill was dragged out of collapses once it's down to one drill or none
    const startContainer = dragStartContainer.current;
    if (startContainer && startContainer !== container && startContainer !== TIMELINE_ROOT_ID) {
      const sourceSplitId = findGroupSplitId(result, startContainer);
      if (sourceSplitId) result = dissolveSplitIfSparse(result, sourceSplitId);
    }

    resetDrag();
    if (result !== timeline) onReorder(result);
  }

  if (items.length === 0) {
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
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={resetDrag}
    >
      <SortableContext
        id={TIMELINE_ROOT_ID}
        items={items.map((item) => item.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-3">
          {items.map((item, index) => (
            <SortableTimelineItem
              key={item.id}
              item={item}
              index={index}
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
              onUpdateOverrides={onUpdateOverrides}
              onRunAlongside={onRunAlongside}
            />
          ))}
        </div>
      </SortableContext>

      <DragOverlay>
        {activeItem?.type === 'drill' && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg shadow-lg bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 cursor-grabbing">
            <GripVertical className="w-4 h-4 text-gray-400" />
            <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
              {activeItem.drill.name}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {activeItem.customDuration || getEffectiveDrill(activeItem).duration}
            </span>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
