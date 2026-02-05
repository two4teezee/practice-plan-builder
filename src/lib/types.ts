export type DrillCategory = 'Admin' | 'Conditioning' | 'Skating' | 'Shooting' | 'Passing' | 'Defensive' | 'Offensive' | 'Goalie' | 'Small Game' | 'Scrimmage' | 'Other';
export type SkillFocus = 'Skating' | 'Shooting' | 'Passing' | 'Defensive' | 'Offensive' | 'Other';
export type PracticeDuration = '30 minutes' | '45 minutes' | '50 minutes' | '60 minutes' | '75 minutes' | '90 minutes';

// User reference for audit trail (lightweight profile info)
export interface UserReference {
  id: string;
  fullName?: string;
  email?: string;
}

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
  tags: string[]; // Array of tag names
  createdAt: Date;
  updatedAt: Date;
  createdBy?: UserReference | null;  // Who created the drill
  updatedBy?: UserReference | null;  // Who last modified the drill
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

export const DRILL_CATEGORIES: DrillCategory[] = ['Admin', 'Conditioning', 'Skating', 'Shooting', 'Passing', 'Defensive', 'Offensive', 'Goalie', 'Small Game', 'Scrimmage', 'Other'];

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

// Drill tags organized by category
export const DRILL_TAG_CATEGORIES = {
  'Practice Structure': ['Warmup', 'Cooldown', 'Admin'],
  'Skating': ['Skating', 'Edges', 'Speed', 'Agility', 'Acceleration', 'Balance', 'Crossover', 'Stops', 'Starts', 'Lateral'],
  'Puck Skills': ['Puckhandling', 'Passing', 'Receiving', 'Shooting', 'Scoring', 'Finishing'],
  'Shooting Details': ['Rebounds', 'Deflections', 'Screens', 'Tips'],
  'Game Situations': ['Battles', 'Small Area', 'Small Game', 'Contact', 'Compete', 'Possession'],
  'Team Systems': ['Breakouts', 'Regroups', 'Transitions', 'Entries', 'Forecheck', 'Backcheck', 'Coverage'],
  'Offensive Play': ['Offensive Play', 'Offense', 'Cycling', 'Netfront', 'Spacing', 'Rush', 'Cycle', 'Cornerplay', 'Wallplay', 'Support', 'Quickstrike'],
  'Defensive Play': ['Defensive Play', 'Defense', 'Angling', 'Containment', 'Gap Control', 'Transition Defense', 'Pressure', 'Counterattack'],
  'Special Teams': ['Special Teams', 'Powerplay', 'Penalty Kill'],
  'Conditioning': ['Conditioning', 'Endurance', 'Sprint'],
  'Goalie': ['Rebound Control', 'Goalie Puckhandling', 'Post Play', 'Puck Tracking','Recovery'],
  'Tactical': ['Deception', 'Vision', 'Timing', 'Awareness', 'Communication', 'Decision Making'],
  'Ice Layout': ['Full Ice', 'Half Ice', 'Station Based', 'Neutralzone', 'Offensive Zone', 'Defensive Zone', 'Dzone'],
  'Player Numbers': ['1v0', '1v1', '2v1', '2v2', '3v2', '3v3', '4v4', '5v5'],
  'Positions': ['Forwards', 'Defensemen', 'Centers', 'Wingers'],
  'Equipment': ['Pucks', 'Cones', 'Tires', 'Pads', 'Gates', 'Obstacle'],
  'Skill Level': ['Beginner', 'Intermediate', 'Advanced', 'Expert'],
  'Age Group': ['U8', 'U10', 'U12', 'U14', 'U16', 'U18', 'Adult'],
  'Tempo': ['Low Tempo', 'Medium Tempo', 'High Tempo'],
  'Constraints': ['No Sticks', 'One Touch', 'Time Limit', 'Shot Limit', 'Pass Limit'],
} as const;

// Flat list of all tags (derived from categories for backwards compatibility)
export const DRILL_TAGS = Object.values(DRILL_TAG_CATEGORIES).flat();

// Category names for iteration
export const DRILL_TAG_CATEGORY_NAMES = Object.keys(DRILL_TAG_CATEGORIES) as (keyof typeof DRILL_TAG_CATEGORIES)[];

export type DrillTagCategory = keyof typeof DRILL_TAG_CATEGORIES;
export type DrillTag = (typeof DRILL_TAG_CATEGORIES)[DrillTagCategory][number];

// Color classes for tag categories (matching the category pill styling pattern)
export const TAG_CATEGORY_COLORS: Record<DrillTagCategory, string> = {
  'Practice Structure': 'bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-400',
  'Skating': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  'Puck Skills': 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  'Shooting Details': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  'Game Situations': 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  'Team Systems': 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
  'Offensive Play': 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  'Defensive Play': 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  'Special Teams': 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
  'Conditioning': 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
  'Goalie': 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  'Tactical': 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
  'Ice Layout': 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
  'Player Numbers': 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
  'Positions': 'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/30 dark:text-fuchsia-400',
  'Equipment': 'bg-stone-100 text-stone-700 dark:bg-stone-900/30 dark:text-stone-400',
  'Skill Level': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  'Age Group': 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
  'Tempo': 'bg-lime-100 text-lime-700 dark:bg-lime-900/30 dark:text-lime-400',
  'Constraints': 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
};

// Helper to get color classes for a tag based on its category
export function getTagColor(tag: string): string {
  for (const [category, tags] of Object.entries(DRILL_TAG_CATEGORIES)) {
    if ((tags as readonly string[]).includes(tag)) {
      return TAG_CATEGORY_COLORS[category as DrillTagCategory];
    }
  }
  // Default fallback color
  return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400';
}
