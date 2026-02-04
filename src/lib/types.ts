export type DrillCategory = 'Admin' | 'Skating' | 'Shooting' | 'Passing' | 'Defensive' | 'Offensive' | 'Goalie' | 'Scrimmage' | 'Other';
export type SkillFocus = 'Skating' | 'Shooting' | 'Passing' | 'Defensive' | 'Offensive' | 'Other';
export type PracticeDuration = '30 minutes' | '45 minutes' | '50 minutes' | '60 minutes' | '75 minutes' | '90 minutes';

export interface Drill {
  id?: string; // UUID from Supabase
  name: string;
  category: DrillCategory;
  duration: string; // "0:30" to "30:00"
  skillFocus: SkillFocus;
  objective: string;
  setup: string;
  execution: string;
  coachingPoints: string;
  variations: string;
  equipment: string;
  description: string;
  videoLink: string;
  pdfLink: string;
  sketchData?: string; // JSON string containing sketch strokes and rink view
  createdAt: Date;
  updatedAt: Date;
}

export interface PracticePlanDrill {
  id: string; // unique id for drag-drop
  drillId: string; // UUID reference to drill
  drill: Drill;
  customDuration?: string; // override the drill's default duration for this practice
  customNotes?: string;
  order: number;
}

// ============================================
// Timeline Types for Branching/Merging Support
// ============================================

// A timeline item can be either a single drill or a parallel split
export type TimelineItem = DrillItem | ParallelSplitItem;

// A single drill in the timeline
export interface DrillItem {
  type: 'drill';
  id: string;
  drillId: string; // UUID reference to drill
  drill: Drill;
  customDuration?: string;
  customNotes?: string;
  selectedVariations?: string[]; // Selected variation names for this practice
}

// Parse variations string into array of variation names
export function parseVariations(variations: string): string[] {
  if (!variations || !variations.trim()) return [];
  
  // Split by common delimiters: newlines, semicolons, or numbered lists
  const lines = variations
    .split(/[\n;]|(?:\d+\.\s*)/)
    .map(v => v.trim())
    .filter(v => v.length > 0);
  
  return lines;
}

// A parallel split containing multiple concurrent groups
export interface ParallelSplitItem {
  type: 'parallel';
  id: string;
  groups: PracticeGroup[];
}

// A group within a parallel split (can contain nested splits)
export interface PracticeGroup {
  id: string;
  name: string;           // "Group A", "Group B", etc.
  color: string;          // Visual differentiation
  items: TimelineItem[];  // Recursive - allows nested splits
}

// Default colors for practice groups
export const GROUP_COLORS = [
  '#3B82F6', // Blue
  '#10B981', // Green
  '#F59E0B', // Amber
  '#EF4444', // Red
] as const;

// Default group names
export const GROUP_NAMES = ['Group A', 'Group B', 'Group C', 'Group D'] as const;

// Helper to get the effective duration for a practice plan drill
export function getEffectiveDuration(item: PracticePlanDrill): string {
  return item.customDuration || item.drill.duration;
}

// Parse duration string to seconds
export function parseDurationToSeconds(duration: string): number {
  const [min, sec] = duration.split(':').map(Number);
  return min * 60 + sec;
}

// Parse practice duration to seconds
export function parsePracticeDurationToSeconds(duration: PracticeDuration): number {
  const minutes = parseInt(duration.split(' ')[0], 10);
  return minutes * 60;
}

// Get duration for a single drill item
export function getDrillItemDuration(item: DrillItem): number {
  return parseDurationToSeconds(item.customDuration || item.drill.duration);
}

// Get duration for a timeline item (recursive for parallel blocks)
export function getTimelineItemDuration(item: TimelineItem): number {
  if (item.type === 'drill') {
    return getDrillItemDuration(item);
  }
  // For parallel: use longest group (wait for all to finish)
  if (item.groups.length === 0) return 0;
  return Math.max(...item.groups.map(g => getGroupDuration(g)));
}

// Get total duration for a practice group
export function getGroupDuration(group: PracticeGroup): number {
  return group.items.reduce((sum, item) => sum + getTimelineItemDuration(item), 0);
}

// Get total duration for a timeline
export function getTimelineDuration(timeline: TimelineItem[]): number {
  return timeline.reduce((sum, item) => sum + getTimelineItemDuration(item), 0);
}

// Convert seconds to duration string (mm:ss)
export function secondsToDurationString(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Flatten timeline to get all drills (for equipment calculation, etc.)
export function flattenTimelineDrills(timeline: TimelineItem[]): DrillItem[] {
  const drills: DrillItem[] = [];
  for (const item of timeline) {
    if (item.type === 'drill') {
      drills.push(item);
    } else {
      for (const group of item.groups) {
        drills.push(...flattenTimelineDrills(group.items));
      }
    }
  }
  return drills;
}

// Convert legacy PracticePlanDrill[] to TimelineItem[]
export function convertDrillsToTimeline(drills: PracticePlanDrill[]): TimelineItem[] {
  return drills
    .sort((a, b) => a.order - b.order)
    .map(drill => ({
      type: 'drill' as const,
      id: drill.id,
      drillId: drill.drillId,
      drill: drill.drill,
      customDuration: drill.customDuration,
      customNotes: drill.customNotes,
    }));
}

// Convert TimelineItem[] back to legacy PracticePlanDrill[] (flattened)
export function convertTimelineToDrills(timeline: TimelineItem[]): PracticePlanDrill[] {
  const drillItems = flattenTimelineDrills(timeline);
  return drillItems.map((item, index) => ({
    id: item.id,
    drillId: item.drillId,
    drill: item.drill,
    customDuration: item.customDuration,
    customNotes: item.customNotes,
    order: index + 1,
  }));
}

// Create a new parallel split with default groups
export function createParallelSplit(groupCount: number = 2): ParallelSplitItem {
  const groups: PracticeGroup[] = [];
  for (let i = 0; i < Math.min(groupCount, 4); i++) {
    groups.push({
      id: `group-${Date.now()}-${Math.random().toString(36).slice(2, 9)}-${i}`,
      name: GROUP_NAMES[i],
      color: GROUP_COLORS[i],
      items: [],
    });
  }
  return {
    type: 'parallel',
    id: `parallel-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    groups,
  };
}

// Create a new drill item
export function createDrillItem(drill: Drill): DrillItem {
  return {
    type: 'drill',
    id: `drill-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    drillId: drill.id!,
    drill,
    selectedVariations: [],
  };
}

// Add a group to a parallel split (max 4)
export function addGroupToSplit(split: ParallelSplitItem): ParallelSplitItem {
  if (split.groups.length >= 4) return split;
  const newIndex = split.groups.length;
  return {
    ...split,
    groups: [
      ...split.groups,
      {
        id: `group-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        name: GROUP_NAMES[newIndex],
        color: GROUP_COLORS[newIndex],
        items: [],
      },
    ],
  };
}

// Remove a group from a parallel split (min 2)
export function removeGroupFromSplit(split: ParallelSplitItem, groupId: string): ParallelSplitItem {
  if (split.groups.length <= 2) return split;
  return {
    ...split,
    groups: split.groups.filter(g => g.id !== groupId),
  };
}

export interface PracticePlan {
  id?: string; // UUID from Supabase
  name: string;
  description: string;
  date: Date;
  duration: PracticeDuration;
  location: string;
  drills: PracticePlanDrill[]; // Legacy: kept for backward compatibility
  timeline: TimelineItem[];    // New: branching timeline structure
  notes: string;
  equipment: string; // auto-calculated from drills
  createdAt: Date;
  updatedAt: Date;
}

export const DRILL_CATEGORIES: DrillCategory[] = ['Admin', 'Skating', 'Shooting', 'Passing', 'Defensive', 'Offensive', 'Goalie', 'Scrimmage', 'Other'];

// Equipment options for drills
export const EQUIPMENT_OPTIONS = [
  'Nets',
  'Small Nets', 
  'Shooter Tutor',
  'Cones',
  'Tires',
  'Border Patrol',
] as const;

export type EquipmentOption = typeof EQUIPMENT_OPTIONS[number];

export interface EquipmentSelection {
  item: EquipmentOption;
  quantity: number;
}

// Convert equipment selections to display string
export function equipmentSelectionsToString(selections: EquipmentSelection[]): string {
  return selections
    .filter(s => s.quantity > 0)
    .map(s => s.quantity > 1 ? `${s.quantity} ${s.item}` : s.item)
    .join(', ');
}

// Parse equipment string back to selections (for backwards compatibility)
export function parseEquipmentString(equipment: string): EquipmentSelection[] {
  if (!equipment) return [];
  
  const selections: EquipmentSelection[] = [];
  const parts = equipment.split(/,\s*/);
  
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    
    // Try to match "N item" pattern
    const match = trimmed.match(/^(\d+)\s+(.+)$/);
    if (match) {
      const quantity = parseInt(match[1], 10);
      const item = match[2] as EquipmentOption;
      if (EQUIPMENT_OPTIONS.includes(item as EquipmentOption)) {
        selections.push({ item: item as EquipmentOption, quantity });
      }
    } else {
      // Single item without quantity
      if (EQUIPMENT_OPTIONS.includes(trimmed as EquipmentOption)) {
        selections.push({ item: trimmed as EquipmentOption, quantity: 1 });
      }
    }
  }
  
  return selections;
}
export const SKILL_FOCUSES: SkillFocus[] = ['Skating', 'Shooting', 'Passing', 'Defensive', 'Offensive', 'Other'];
export const PRACTICE_DURATIONS: PracticeDuration[] = ['30 minutes', '45 minutes', '50 minutes', '60 minutes', '75 minutes', '90 minutes'];

// Generate drill duration options from 0:30 to 30:00 in 0:30 increments
export const DRILL_DURATIONS: string[] = Array.from({ length: 60 }, (_, i) => {
  const totalSeconds = (i + 1) * 30;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
});
