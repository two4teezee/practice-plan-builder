'use client';

import { useMemo } from 'react';
import type { 
  TimelineItem, 
  DrillItem,
  ParallelSplitItem,
  PracticeDuration,
  PracticeGroup,
} from '@/lib/types';
import { 
  getTimelineDuration,
  getTimelineItemDuration,
  getGroupDuration,
  parsePracticeDurationToSeconds,
  secondsToDurationString,
  flattenTimelineDrills,
} from '@/lib/types';
import { Clock, GitBranch } from 'lucide-react';

interface PracticeTimelineProps {
  timeline: TimelineItem[];
  practiceDuration: PracticeDuration;
}

const categoryColors: Record<string, string> = {
  Admin: 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-400 dark:border-slate-600',
  Skating: 'bg-blue-200 text-blue-700 dark:bg-blue-900 dark:text-blue-300 border-blue-400 dark:border-blue-600',
  Shooting: 'bg-red-200 text-red-700 dark:bg-red-900 dark:text-red-300 border-red-400 dark:border-red-600',
  Passing: 'bg-green-200 text-green-700 dark:bg-green-900 dark:text-green-300 border-green-400 dark:border-green-600',
  Defensive: 'bg-purple-200 text-purple-700 dark:bg-purple-900 dark:text-purple-300 border-purple-400 dark:border-purple-600',
  Offensive: 'bg-orange-200 text-orange-700 dark:bg-orange-900 dark:text-orange-300 border-orange-400 dark:border-orange-600',
  Scrimmage: 'bg-cyan-200 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300 border-cyan-400 dark:border-cyan-600',
  Other: 'bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border-gray-400 dark:border-gray-600',
};

interface TimelineBlock {
  id: string;
  type: 'drill' | 'parallel';
  startPercent: number;
  widthPercent: number;
  item: TimelineItem;
  drillItem?: DrillItem;
  parallelItem?: ParallelSplitItem;
}

// Render a single drill block
function DrillBlock({ 
  block, 
  totalPracticeSeconds 
}: { 
  block: TimelineBlock;
  totalPracticeSeconds: number;
}) {
  if (!block.drillItem) return null;
  const drill = block.drillItem;
  const duration = drill.customDuration || drill.drill.duration;
  
  return (
    <div
      className={`
        absolute top-1 bottom-1 rounded border
        flex items-center justify-center overflow-hidden
        transition-all duration-200 hover:z-10 hover:shadow-lg cursor-default
        ${categoryColors[drill.drill.category]}
        ${block.startPercent + block.widthPercent > 100 ? 'opacity-75' : ''}
      `}
      style={{
        left: `${Math.min(block.startPercent, 100)}%`,
        width: `${Math.max(Math.min(block.widthPercent, 100 - block.startPercent), 0.5)}%`,
        minWidth: '2px',
      }}
      title={`${drill.drill.name} (${duration})`}
    >
      {block.widthPercent >= 8 && (
        <span className="text-[10px] font-medium truncate px-1">
          {drill.drill.name}
        </span>
      )}
    </div>
  );
}

// Render a parallel split with multiple tracks
function ParallelBlockVisualization({ 
  block,
  totalPracticeSeconds,
  depth = 0,
}: { 
  block: TimelineBlock;
  totalPracticeSeconds: number;
  depth?: number;
}) {
  if (!block.parallelItem) return null;
  const parallel = block.parallelItem;
  const blockDuration = getTimelineItemDuration(parallel);
  
  // Calculate blocks for each group
  const groupsWithBlocks = useMemo(() => {
    return parallel.groups.map(group => {
      let currentTime = 0;
      const blocks: TimelineBlock[] = [];
      
      for (const item of group.items) {
        const itemDuration = getTimelineItemDuration(item);
        const relativeStart = (currentTime / blockDuration) * 100;
        const relativeWidth = (itemDuration / blockDuration) * 100;
        
        blocks.push({
          id: item.id,
          type: item.type,
          startPercent: relativeStart,
          widthPercent: relativeWidth,
          item,
          drillItem: item.type === 'drill' ? item : undefined,
          parallelItem: item.type === 'parallel' ? item : undefined,
        });
        
        currentTime += itemDuration;
      }
      
      return { group, blocks };
    });
  }, [parallel.groups, blockDuration]);

  const trackHeight = 28;
  const splitConnectorWidth = 8;
  
  return (
    <div
      className="absolute flex flex-col"
      style={{
        left: `${block.startPercent}%`,
        width: `${block.widthPercent}%`,
        top: 0,
        bottom: 0,
      }}
    >
      {/* Split connector on left */}
      <div 
        className="absolute left-0 top-0 bottom-0 flex flex-col justify-center"
        style={{ width: splitConnectorWidth }}
      >
        <div className="w-full h-full flex flex-col justify-around">
          {parallel.groups.map((group, i) => (
            <div 
              key={group.id}
              className="h-0.5 rounded-full"
              style={{ 
                backgroundColor: group.color,
                marginLeft: i === 0 || i === parallel.groups.length - 1 ? 0 : 2,
              }}
            />
          ))}
        </div>
      </div>

      {/* Parallel tracks */}
      <div 
        className="flex flex-col gap-0.5"
        style={{ 
          marginLeft: splitConnectorWidth,
          marginRight: splitConnectorWidth,
        }}
      >
        {groupsWithBlocks.map(({ group, blocks }) => (
          <div 
            key={group.id}
            className="relative rounded-sm overflow-hidden"
            style={{ 
              height: trackHeight,
              backgroundColor: `${group.color}15`,
              borderLeft: `2px solid ${group.color}`,
            }}
          >
            {/* Group label */}
            <div 
              className="absolute left-1 top-0.5 text-[8px] font-medium z-10 px-0.5 rounded"
              style={{ 
                color: group.color,
                backgroundColor: `${group.color}20`,
              }}
            >
              {group.name}
            </div>
            
            {/* Render items in this track */}
            {blocks.map(itemBlock => {
              if (itemBlock.type === 'drill' && itemBlock.drillItem) {
                return (
                  <div
                    key={itemBlock.id}
                    className={`
                      absolute rounded border
                      flex items-center justify-center overflow-hidden
                      transition-all duration-200 hover:z-10 cursor-default
                      ${categoryColors[itemBlock.drillItem.drill.category]}
                    `}
                    style={{
                      left: `${itemBlock.startPercent}%`,
                      width: `${Math.max(itemBlock.widthPercent, 1)}%`,
                      top: 8,
                      bottom: 2,
                      minWidth: '2px',
                    }}
                    title={`${itemBlock.drillItem.drill.name} (${itemBlock.drillItem.customDuration || itemBlock.drillItem.drill.duration})`}
                  >
                    {itemBlock.widthPercent >= 15 && (
                      <span className="text-[8px] font-medium truncate px-0.5">
                        {itemBlock.drillItem.drill.name}
                      </span>
                    )}
                  </div>
                );
              }
              
              // Nested parallel - show indicator
              if (itemBlock.type === 'parallel') {
                return (
                  <div
                    key={itemBlock.id}
                    className="absolute flex items-center justify-center bg-primary-100 dark:bg-primary-900/50 border border-dashed border-primary-400 rounded"
                    style={{
                      left: `${itemBlock.startPercent}%`,
                      width: `${Math.max(itemBlock.widthPercent, 2)}%`,
                      top: 8,
                      bottom: 2,
                    }}
                    title="Nested parallel groups"
                  >
                    <GitBranch className="w-3 h-3 text-primary-500" />
                  </div>
                );
              }
              
              return null;
            })}
          </div>
        ))}
      </div>

      {/* Merge connector on right */}
      <div 
        className="absolute right-0 top-0 bottom-0 flex flex-col justify-center"
        style={{ width: splitConnectorWidth }}
      >
        <div className="w-full h-full flex flex-col justify-around">
          {parallel.groups.map((group, i) => (
            <div 
              key={group.id}
              className="h-0.5 rounded-full"
              style={{ 
                backgroundColor: group.color,
                marginRight: i === 0 || i === parallel.groups.length - 1 ? 0 : 2,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export function PracticeTimeline({ timeline, practiceDuration }: PracticeTimelineProps) {
  const totalPracticeSeconds = parsePracticeDurationToSeconds(practiceDuration);
  const totalTimelineSeconds = getTimelineDuration(timeline);
  
  // Check if we have any parallel blocks
  const hasParallelBlocks = timeline.some(item => item.type === 'parallel');
  
  // Calculate max number of parallel tracks for height calculation
  const maxParallelTracks = useMemo(() => {
    let max = 1;
    for (const item of timeline) {
      if (item.type === 'parallel') {
        max = Math.max(max, item.groups.length);
      }
    }
    return max;
  }, [timeline]);
  
  // Calculate positions and widths for each timeline block
  const timelineBlocks = useMemo(() => {
    let currentTime = 0;
    const blocks: TimelineBlock[] = [];
    
    for (const item of timeline) {
      const itemDuration = getTimelineItemDuration(item);
      const startPercent = (currentTime / totalPracticeSeconds) * 100;
      const widthPercent = (itemDuration / totalPracticeSeconds) * 100;
      
      blocks.push({
        id: item.id,
        type: item.type,
        startPercent,
        widthPercent,
        item,
        drillItem: item.type === 'drill' ? item : undefined,
        parallelItem: item.type === 'parallel' ? item : undefined,
      });
      
      currentTime += itemDuration;
    }
    
    return blocks;
  }, [timeline, totalPracticeSeconds]);

  // Generate time markers
  const timeMarkers = useMemo(() => {
    const totalMinutes = totalPracticeSeconds / 60;
    const interval = totalMinutes <= 45 ? 5 : 10;
    const markers: number[] = [];
    
    for (let i = 0; i <= totalMinutes; i += interval) {
      markers.push(i);
    }
    
    if (markers[markers.length - 1] !== totalMinutes) {
      markers.push(totalMinutes);
    }
    
    return markers;
  }, [totalPracticeSeconds]);

  const formatMinutes = (minutes: number) => `${minutes}:00`;
  const overTime = totalTimelineSeconds > totalPracticeSeconds;

  // Get all unique categories for legend
  const allDrills = flattenTimelineDrills(timeline);
  const categories = Array.from(new Set(allDrills.map(d => d.drill.category)));

  if (timeline.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3">
        <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-2">
          <Clock className="w-3.5 h-3.5" />
          <span className="text-xs font-medium">Practice Timeline</span>
        </div>
        <div className="h-10 bg-gray-50 dark:bg-gray-900 rounded-lg flex items-center justify-center text-xs text-gray-400 dark:text-gray-500">
          Add drills to see the timeline
        </div>
      </div>
    );
  }

  // Calculate track height based on whether we have parallel blocks
  const trackHeight = hasParallelBlocks ? Math.max(40, maxParallelTracks * 30 + 10) : 40;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
          <Clock className="w-3.5 h-3.5" />
          <span className="text-xs font-medium">Timeline</span>
          {hasParallelBlocks && (
            <span className="flex items-center gap-1 text-primary-600 dark:text-primary-400">
              <GitBranch className="w-3 h-3" />
              <span className="text-[10px]">Groups</span>
            </span>
          )}
        </div>
        <span className={`text-xs font-medium ${overTime ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'}`}>
          {secondsToDurationString(totalTimelineSeconds)} / {practiceDuration}
        </span>
      </div>

      {/* Time markers row - aligned with grid lines */}
      <div className="relative h-4 mb-0.5">
        {timeMarkers.map((minutes) => {
          const totalMinutes = totalPracticeSeconds / 60;
          const leftPercent = (minutes / totalMinutes) * 100;
          return (
            <span
              key={minutes}
              className="absolute text-[10px] tabular-nums text-gray-400 dark:text-gray-500"
              style={{ 
                left: `${leftPercent}%`,
                transform: minutes === 0 ? 'translateX(0)' : minutes === totalMinutes ? 'translateX(-100%)' : 'translateX(-50%)',
              }}
            >
              {formatMinutes(minutes)}
            </span>
          );
        })}
      </div>

      {/* Timeline track */}
      <div 
        className="relative bg-gray-100 dark:bg-gray-900 rounded-lg overflow-hidden"
        style={{ height: trackHeight }}
      >
        {/* Grid lines */}
        {timeMarkers.map((minutes) => {
          const totalMinutes = totalPracticeSeconds / 60;
          return (
            <div
              key={minutes}
              className="absolute top-0 bottom-0 w-px bg-gray-200 dark:bg-gray-700"
              style={{ left: `${(minutes / totalMinutes) * 100}%` }}
            />
          );
        })}

        {/* Timeline blocks */}
        {timelineBlocks.map((block) => {
          if (block.type === 'drill') {
            return (
              <DrillBlock
                key={block.id}
                block={block}
                totalPracticeSeconds={totalPracticeSeconds}
              />
            );
          }
          
          return (
            <ParallelBlockVisualization
              key={block.id}
              block={block}
              totalPracticeSeconds={totalPracticeSeconds}
            />
          );
        })}

        {/* Overtime indicator */}
        {overTime && (
          <div
            className="absolute top-0 bottom-0 bg-red-500/20 dark:bg-red-500/30 border-l-2 border-red-500"
            style={{ 
              left: '100%', 
              width: `${((totalTimelineSeconds - totalPracticeSeconds) / totalPracticeSeconds) * 100}%` 
            }}
          />
        )}
      </div>

      {/* Legend */}
      {categories.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 pt-2 border-t border-gray-100 dark:border-gray-700">
          {categories.map((category) => (
            <div key={category} className="flex items-center gap-1">
              <div className={`w-2.5 h-2.5 rounded-sm ${categoryColors[category].split(' ').slice(0, 2).join(' ')}`} />
              <span className="text-[10px] text-gray-500 dark:text-gray-400">{category}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
