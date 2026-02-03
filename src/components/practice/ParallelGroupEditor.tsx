'use client';

import { useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import type { 
  ParallelSplitItem, 
  TimelineItem, 
  DrillItem,
  PracticeGroup,
} from '@/lib/types';
import { getGroupDuration, secondsToDurationString } from '@/lib/types';
import { SortableTimelineItem } from './SortableTimelineItem';
import { 
  GitBranch, 
  Plus, 
  Trash2, 
  Users, 
  Clock,
  ChevronDown,
  ChevronUp,
  Pencil,
  Check,
  X
} from 'lucide-react';

interface ParallelGroupEditorProps {
  item: ParallelSplitItem;
  onReorderGroup: (parallelId: string, groupId: string, items: TimelineItem[]) => void;
  onRemove: (id: string) => void;
  onUpdateDuration: (id: string, duration: string) => void;
  onUpdateVariations: (id: string, variations: string[]) => void;
  onViewDetails: (item: DrillItem) => void;
  onAddDrillToGroup: (groupPath: string[]) => void;
  onAddNestedSplit: (parallelId: string, groupId: string) => void;
  onAddGroup: (parallelId: string) => void;
  onRemoveGroup: (parallelId: string, groupId: string) => void;
  onRemoveParallelSplit: (id: string) => void;
  onUpdateGroupName: (parallelId: string, groupId: string, name: string) => void;
  depth?: number;
  parentPath?: string[];
}

// Individual group column component
function GroupColumn({
  group,
  parallelId,
  currentPath,
  canRemove,
  editingGroupId,
  editingName,
  onStartEditing,
  onSaveGroupName,
  onCancelEditing,
  onEditingNameChange,
  onReorderGroup,
  onRemove,
  onUpdateDuration,
  onUpdateVariations,
  onViewDetails,
  onAddDrillToGroup,
  onAddNestedSplit,
  onAddGroup,
  onRemoveGroup,
  onRemoveParallelSplit,
  onUpdateGroupName,
  depth,
}: {
  group: PracticeGroup;
  parallelId: string;
  currentPath: string[];
  canRemove: boolean;
  editingGroupId: string | null;
  editingName: string;
  onStartEditing: (groupId: string, name: string) => void;
  onSaveGroupName: () => void;
  onCancelEditing: () => void;
  onEditingNameChange: (name: string) => void;
  onReorderGroup: (parallelId: string, groupId: string, items: TimelineItem[]) => void;
  onRemove: (id: string) => void;
  onUpdateDuration: (id: string, duration: string) => void;
  onUpdateVariations: (id: string, variations: string[]) => void;
  onViewDetails: (item: DrillItem) => void;
  onAddDrillToGroup: (groupPath: string[]) => void;
  onAddNestedSplit: (parallelId: string, groupId: string) => void;
  onAddGroup: (parallelId: string) => void;
  onRemoveGroup: (parallelId: string, groupId: string) => void;
  onRemoveParallelSplit: (id: string) => void;
  onUpdateGroupName: (parallelId: string, groupId: string, name: string) => void;
  depth: number;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = group.items.findIndex(i => i.id === active.id);
    const newIndex = group.items.findIndex(i => i.id === over.id);
    
    if (oldIndex !== -1 && newIndex !== -1) {
      const reordered = arrayMove(group.items, oldIndex, newIndex);
      onReorderGroup(parallelId, group.id, reordered);
    }
  };

  const groupPath = [...currentPath, group.id];

  // Calculate minimum width based on depth
  const minWidth = depth > 0 ? '180px' : '200px';
  const isNested = depth > 0;
  
  return (
    <div 
      className="rounded-lg border-2 overflow-hidden flex-1"
      style={{ borderColor: group.color + '40', minWidth }}
    >
      {/* Group Header - compact for nested */}
      <div 
        className={`flex items-center justify-between ${isNested ? 'px-2 py-1.5' : 'px-3 py-2'}`}
        style={{ backgroundColor: group.color + '15' }}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <div 
            className={`rounded-full flex-shrink-0 ${isNested ? 'w-2 h-2' : 'w-3 h-3'}`}
            style={{ backgroundColor: group.color }}
          />
          {editingGroupId === group.id ? (
            <div className="flex items-center gap-1">
              <input
                type="text"
                value={editingName}
                onChange={(e) => onEditingNameChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onSaveGroupName();
                  if (e.key === 'Escape') onCancelEditing();
                }}
                className={`px-1 py-0.5 border rounded dark:bg-gray-700 dark:border-gray-600 ${isNested ? 'w-16 text-xs' : 'w-20 text-sm'}`}
              />
              <button 
                type="button"
                onClick={onSaveGroupName}
                className="p-0.5 text-green-600 hover:text-green-700"
              >
                <Check className={isNested ? 'w-2.5 h-2.5' : 'w-3 h-3'} />
              </button>
              <button 
                type="button"
                onClick={onCancelEditing}
                className="p-0.5 text-gray-500 hover:text-gray-700"
              >
                <X className={isNested ? 'w-2.5 h-2.5' : 'w-3 h-3'} />
              </button>
            </div>
          ) : (
            <>
              <span className={`font-medium text-gray-800 dark:text-gray-200 truncate ${isNested ? 'text-xs' : 'text-sm'}`}>
                {group.name}
              </span>
              <button
                type="button"
                onClick={() => onStartEditing(group.id, group.name)}
                className="p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 flex-shrink-0"
              >
                <Pencil className={isNested ? 'w-2.5 h-2.5' : 'w-3 h-3'} />
              </button>
            </>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <div className={`flex items-center gap-0.5 text-gray-500 dark:text-gray-400 ${isNested ? 'text-[10px]' : 'text-xs'}`}>
            <Clock className={isNested ? 'w-2.5 h-2.5' : 'w-3 h-3'} />
            <span>{secondsToDurationString(getGroupDuration(group))}</span>
          </div>
          <span className={`text-gray-400 ${isNested ? 'text-[10px]' : 'text-xs'}`}>
            ({group.items.length})
          </span>
          {canRemove && (
            <button
              type="button"
              onClick={() => onRemoveGroup(parallelId, group.id)}
              className="p-0.5 text-red-400 hover:text-red-600"
            >
              <X className={isNested ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
            </button>
          )}
        </div>
      </div>

      {/* Group Content */}
      <div className={`bg-white dark:bg-gray-800 ${isNested ? 'p-1.5 min-h-[80px]' : 'p-2 min-h-[100px]'}`}>
        {group.items.length === 0 ? (
          <div className={`flex flex-col items-center justify-center text-center ${isNested ? 'py-4' : 'py-6'}`}>
            <Users className={`text-gray-300 dark:text-gray-600 ${isNested ? 'w-6 h-6 mb-1' : 'w-8 h-8 mb-2'}`} />
            <p className={`text-gray-500 dark:text-gray-400 mb-2 ${isNested ? 'text-[10px]' : 'text-xs'}`}>
              No drills
            </p>
            <button
              type="button"
              onClick={() => onAddDrillToGroup(groupPath)}
              className={`flex items-center gap-1 text-primary-600 hover:text-primary-700 border border-primary-300 rounded hover:bg-primary-50 dark:border-primary-700 dark:hover:bg-primary-900/30 ${isNested ? 'px-2 py-1 text-[10px]' : 'px-3 py-1.5 text-xs'}`}
            >
              <Plus className={isNested ? 'w-2.5 h-2.5' : 'w-3 h-3'} />
              Add Drill
            </button>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={group.items.map(i => i.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2">
                {group.items.map((groupItem, index) => (
                  <SortableTimelineItem
                    key={groupItem.id}
                    item={groupItem}
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
                    depth={depth + 1}
                    parentPath={groupPath}
                    compact
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
        
        {/* Add buttons at bottom */}
        {group.items.length > 0 && (
          <div className={`flex gap-1 border-t border-gray-100 dark:border-gray-700 ${isNested ? 'mt-1.5 pt-1.5' : 'mt-2 pt-2'}`}>
            <button
              type="button"
              onClick={() => onAddDrillToGroup(groupPath)}
              className={`flex-1 flex items-center justify-center gap-1 text-gray-600 hover:text-gray-800 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700 rounded ${isNested ? 'py-1 text-[10px]' : 'py-1.5 text-xs'}`}
            >
              <Plus className={isNested ? 'w-2.5 h-2.5' : 'w-3 h-3'} />
              Drill
            </button>
            <button
              type="button"
              onClick={() => onAddNestedSplit(parallelId, group.id)}
              className={`flex items-center justify-center text-gray-600 hover:text-gray-800 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700 rounded ${isNested ? 'px-1.5 py-1' : 'px-2 py-1.5'}`}
              title="Add nested split"
            >
              <GitBranch className={isNested ? 'w-2.5 h-2.5' : 'w-3 h-3'} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function ParallelGroupEditor({
  item,
  onReorderGroup,
  onRemove,
  onUpdateDuration,
  onUpdateVariations,
  onViewDetails,
  onAddDrillToGroup,
  onAddNestedSplit,
  onAddGroup,
  onRemoveGroup,
  onRemoveParallelSplit,
  onUpdateGroupName,
  depth = 0,
  parentPath = [],
}: ParallelGroupEditorProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const currentPath = [...parentPath, item.id];

  const startEditing = (groupId: string, currentName: string) => {
    setEditingGroupId(groupId);
    setEditingName(currentName);
  };

  const saveGroupName = () => {
    if (editingGroupId && editingName.trim()) {
      onUpdateGroupName(item.id, editingGroupId, editingName.trim());
    }
    setEditingGroupId(null);
    setEditingName('');
  };

  const cancelEditing = () => {
    setEditingGroupId(null);
    setEditingName('');
  };

  // Calculate max duration across all groups
  const maxDuration = Math.max(...item.groups.map(g => getGroupDuration(g)));
  
  // Determine if this is a nested split (depth > 0)
  const isNested = depth > 0;

  return (
    <div 
      className={`
        rounded-xl border-2 border-dashed border-primary-300 dark:border-primary-700
        bg-primary-50/50 dark:bg-primary-900/20
        ${isNested ? 'rounded-lg' : ''}
      `}
    >
      {/* Header - more compact for nested splits */}
      <div className={`flex items-center justify-between border-b border-primary-200 dark:border-primary-800 ${isNested ? 'p-2' : 'p-3'}`}>
        <div className="flex items-center gap-1.5 min-w-0">
          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-0.5 rounded hover:bg-primary-100 dark:hover:bg-primary-800 flex-shrink-0"
          >
            {isCollapsed ? (
              <ChevronDown className={`text-primary-600 dark:text-primary-400 ${isNested ? 'w-3 h-3' : 'w-4 h-4'}`} />
            ) : (
              <ChevronUp className={`text-primary-600 dark:text-primary-400 ${isNested ? 'w-3 h-3' : 'w-4 h-4'}`} />
            )}
          </button>
          <GitBranch className={`text-primary-600 dark:text-primary-400 flex-shrink-0 ${isNested ? 'w-4 h-4' : 'w-5 h-5'}`} />
          <span className={`font-semibold text-primary-700 dark:text-primary-300 truncate ${isNested ? 'text-xs' : 'text-sm'}`}>
            {isNested ? 'Parallel' : 'Parallel Groups'}
          </span>
          <span className={`text-primary-600 dark:text-primary-400 flex-shrink-0 ${isNested ? 'text-xs' : 'text-sm'}`}>
            ({item.groups.length})
          </span>
          <div className={`flex items-center gap-1 text-gray-500 dark:text-gray-400 flex-shrink-0 ${isNested ? 'text-[10px]' : 'text-xs'}`}>
            <Clock className={isNested ? 'w-2.5 h-2.5' : 'w-3 h-3'} />
            <span>{secondsToDurationString(maxDuration)}</span>
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {item.groups.length < 4 && (
            <button
              type="button"
              onClick={() => onAddGroup(item.id)}
              className={`flex items-center gap-1 text-primary-600 hover:text-primary-700 dark:text-primary-400 hover:bg-primary-100 dark:hover:bg-primary-800 rounded ${isNested ? 'p-1 text-[10px]' : 'px-2 py-1 text-xs'}`}
            >
              <Plus className={isNested ? 'w-3 h-3' : 'w-4 h-4'} />
              {!isNested && <span>Add Group</span>}
            </button>
          )}
          <button
            type="button"
            onClick={() => onRemoveParallelSplit(item.id)}
            className={`text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 rounded ${isNested ? 'p-1' : 'p-1.5'}`}
          >
            <Trash2 className={isNested ? 'w-3 h-3' : 'w-4 h-4'} />
          </button>
        </div>
      </div>

      {/* Side-by-side Groups - fill width equally */}
      {!isCollapsed && (
        <div className={isNested ? 'p-2' : 'p-3'}>
          <div className={`flex ${isNested ? 'gap-2' : 'gap-3'}`}>
            {item.groups.map((group) => (
              <GroupColumn
                key={group.id}
                group={group}
                parallelId={item.id}
                currentPath={currentPath}
                canRemove={item.groups.length > 2}
                editingGroupId={editingGroupId}
                editingName={editingName}
                onStartEditing={startEditing}
                onSaveGroupName={saveGroupName}
                onCancelEditing={cancelEditing}
                onEditingNameChange={setEditingName}
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
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
