'use client';

import { useMemo } from 'react';
import type { 
  TimelineItem, 
  DrillItem,
  ParallelSplitItem,
  PracticeDuration,
} from '@/lib/types';
import { 
  getTimelineDuration,
  getTimelineItemDuration,
  parsePracticeDurationToSeconds,
  secondsToDurationString,
  flattenTimelineDrills,
  getEffectiveDrill,
} from '@/lib/types';
import { Clock, GitBranch } from 'lucide-react';

interface PracticeTimelineProps {
  timeline: TimelineItem[];
  practiceDuration: PracticeDuration;
}

const categoryColors: Record<string, string> = {
  Admin: 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-400 dark:border-slate-600',
  Conditioning: 'bg-rose-200 text-rose-700 dark:bg-rose-900 dark:text-rose-300 border-rose-400 dark:border-rose-600',
  Skating: 'bg-blue-200 text-blue-700 dark:bg-blue-900 dark:text-blue-300 border-blue-400 dark:border-blue-600',
  Shooting: 'bg-red-200 text-red-700 dark:bg-red-900 dark:text-red-300 border-red-400 dark:border-red-600',
  Passing: 'bg-green-200 text-green-700 dark:bg-green-900 dark:text-green-300 border-green-400 dark:border-green-600',
  Defensive: 'bg-purple-200 text-purple-700 dark:bg-purple-900 dark:text-purple-300 border-purple-400 dark:border-purple-600',
  Offensive: 'bg-orange-200 text-orange-700 dark:bg-orange-900 dark:text-orange-300 border-orange-400 dark:border-orange-600',
  Goalie: 'bg-yellow-200 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300 border-yellow-400 dark:border-yellow-600',
  'Small Game': 'bg-teal-200 text-teal-700 dark:bg-teal-900 dark:text-teal-300 border-teal-400 dark:border-teal-600',
  Systems: 'bg-indigo-200 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300 border-indigo-400 dark:border-indigo-600',
  Scrimmage: 'bg-cyan-200 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300 border-cyan-400 dark:border-cyan-600',
  Other: 'bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border-gray-400 dark:border-gray-600',
};

// Track geometry (px)
const SINGLE_TRACK_HEIGHT = 40;
const LANE_HEIGHT = 30;
const LANE_GAP = 4;
const TRACK_PADDING = 4;
const LANE_STRIPE_WIDTH = 6;
const LANE_STRIPE_GAP = 3; // Between a lane's group marker and its drills
// A bar shows its name once it spans this much of the whole practice
const MIN_LABEL_PERCENT = 4;

interface TimelineBlock {
  id: string;
  startPercent: number; // Relative to the block's container (the practice, or the split)
  widthPercent: number;
  item: TimelineItem;
}

// Lay items end to end, as percentages of totalSeconds
function layoutBlocks(items: TimelineItem[], totalSeconds: number): TimelineBlock[] {
  let currentTime = 0;
  return items.map(item => {
    const duration = getTimelineItemDuration(item);
    const block = {
      id: item.id,
      startPercent: totalSeconds > 0 ? (currentTime / totalSeconds) * 100 : 0,
      widthPercent: totalSeconds > 0 ? (duration / totalSeconds) * 100 : 0,
      item,
    };
    currentTime += duration;
    return block;
  });
}

// One drill bar. absoluteWidthPercent is its share of the whole practice, which decides
// whether its name fits, so bars inside a split label the same way as top-level ones.
function DrillBar({
  drill,
  startPercent,
  widthPercent,
  absoluteWidthPercent,
  inset,
}: {
  drill: DrillItem;
  startPercent: number;
  widthPercent: number;
  absoluteWidthPercent: number;
  inset: number;
}) {
  const effective = getEffectiveDrill(drill);
  const duration = drill.customDuration || effective.duration;
  const colors = categoryColors[effective.category] || categoryColors.Other;
  const overflows = startPercent + widthPercent > 100;

  return (
    <div
      className={`absolute rounded border flex items-center justify-center overflow-hidden transition-shadow hover:z-10 hover:shadow-lg cursor-default ${colors} ${overflows ? 'opacity-75' : ''}`}
      style={{
        left: `${Math.min(startPercent, 100)}%`,
        width: `${Math.max(Math.min(widthPercent, 100 - startPercent), 0.5)}%`,
        top: inset,
        bottom: inset,
        minWidth: '2px',
      }}
      title={`${effective.name} (${duration})`}
    >
      {absoluteWidthPercent >= MIN_LABEL_PERCENT && (
        <span className="text-[11px] font-medium truncate px-1.5">{effective.name}</span>
      )}
    </div>
  );
}

// A split: one lane per group, sharing the track's height
function SplitLanes({ block }: { block: TimelineBlock }) {
  const split = block.item as ParallelSplitItem;
  const splitSeconds = getTimelineItemDuration(split);

  return (
    <div
      className="absolute flex flex-col"
      style={{
        left: `${block.startPercent}%`,
        width: `${block.widthPercent}%`,
        top: TRACK_PADDING,
        bottom: TRACK_PADDING,
        gap: LANE_GAP,
        paddingLeft: 2,
        paddingRight: 2,
      }}
    >
      {split.groups.map(group => (
        <div
          key={group.id}
          className="flex-1 flex min-h-0 rounded"
          style={{ backgroundColor: `${group.color}1F`, gap: LANE_STRIPE_GAP }}
          title={group.name}
        >
          {/* Group marker, kept apart from the drills so it reads on its own */}
          <div
            className="flex-shrink-0 rounded-full my-0.5"
            style={{ width: LANE_STRIPE_WIDTH, backgroundColor: group.color }}
          />
          <div className="relative flex-1 min-w-0">
            {layoutBlocks(group.items, splitSeconds).map(itemBlock => {
              const absoluteWidthPercent = (itemBlock.widthPercent * block.widthPercent) / 100;
              if (itemBlock.item.type === 'drill') {
                return (
                  <DrillBar
                    key={itemBlock.id}
                    drill={itemBlock.item}
                    startPercent={itemBlock.startPercent}
                    widthPercent={itemBlock.widthPercent}
                    absoluteWidthPercent={absoluteWidthPercent}
                    inset={2}
                  />
                );
              }
              // Nested split: a marker, since there's no room for its own lanes
              return (
                <div
                  key={itemBlock.id}
                  className="absolute flex items-center justify-center bg-primary-100 dark:bg-primary-900/50 border border-dashed border-primary-400 rounded"
                  style={{
                    left: `${itemBlock.startPercent}%`,
                    width: `${Math.max(itemBlock.widthPercent, 2)}%`,
                    top: 2,
                    bottom: 2,
                  }}
                  title="Nested split"
                >
                  <GitBranch className="w-3 h-3 text-primary-500" />
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// Group names for each split, in lane order, placed above the split
function SplitLabels({ blocks }: { blocks: TimelineBlock[] }) {
  return (
    <div className="relative h-4 mb-1">
      {blocks.map(block => {
        if (block.item.type !== 'parallel') return null;
        return (
          <div
            key={block.id}
            className="absolute top-0 flex items-center gap-2.5 overflow-hidden whitespace-nowrap"
            style={{ left: `${block.startPercent}%`, width: `${Math.min(block.widthPercent, 100 - block.startPercent)}%` }}
          >
            {block.item.groups.map(group => (
              <span key={group.id} className="flex items-center gap-1 min-w-0 text-[11px] font-medium" style={{ color: group.color }}>
                <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ backgroundColor: group.color }} />
                <span className="truncate">{group.name}</span>
              </span>
            ))}
          </div>
        );
      })}
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
  
  const timelineBlocks = useMemo(
    () => layoutBlocks(timeline, totalPracticeSeconds),
    [timeline, totalPracticeSeconds]
  );

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
  const categories = Array.from(new Set(allDrills.map(d => getEffectiveDrill(d).category)));

  if (timeline.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-3">
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

  const trackHeight = hasParallelBlocks
    ? maxParallelTracks * LANE_HEIGHT + (maxParallelTracks - 1) * LANE_GAP + TRACK_PADDING * 2
    : SINGLE_TRACK_HEIGHT;

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-3">
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

      {hasParallelBlocks && <SplitLabels blocks={timelineBlocks} />}

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
        {timelineBlocks.map((block) =>
          block.item.type === 'drill' ? (
            <DrillBar
              key={block.id}
              drill={block.item}
              startPercent={block.startPercent}
              widthPercent={block.widthPercent}
              absoluteWidthPercent={block.widthPercent}
              inset={TRACK_PADDING}
            />
          ) : (
            <SplitLanes key={block.id} block={block} />
          )
        )}

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
          {categories.map((category) => {
            const colors = categoryColors[category] || categoryColors.Other;
            return (
              <div key={category} className="flex items-center gap-1">
                <div className={`w-2.5 h-2.5 rounded-sm ${colors.split(' ').slice(0, 2).join(' ')}`} />
                <span className="text-[10px] text-gray-500 dark:text-gray-400">{category}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
