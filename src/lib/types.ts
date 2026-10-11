export type DrillCategory = 'Admin' | 'Conditioning' | 'Skating' | 'Shooting' | 'Passing' | 'Defensive' | 'Offensive' | 'Goalie' | 'Small Game' | 'Systems' | 'Scrimmage' | 'Other';
export type SkillFocus = 'Skating' | 'Shooting' | 'Passing' | 'Defensive' | 'Offensive' | 'Other';
export type PracticeDuration = '30 minutes' | '45 minutes' | '50 minutes' | '60 minutes' | '75 minutes' | '90 minutes';

// User reference for audit trail (lightweight profile info)
export interface UserReference {
  id: string;
  fullName?: string;
  email?: string;
}

// Location data from Google Places API
export interface Location {
  placeId: string;          // Google Place ID for future lookups
  name: string;             // Place name (e.g., "Hylo Park Arena")
  formattedAddress: string; // Full address
  lat: number;              // Latitude for proximity filtering
  lng: number;              // Longitude for proximity filtering
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
  overrides?: Partial<Drill>; // Practice-specific overrides (merged with drill at render time)
}

// Get the effective drill with overrides applied
export function getEffectiveDrill(item: DrillItem): Drill {
  if (!item.overrides) {
    return item.drill;
  }
  return { ...item.drill, ...item.overrides };
}

// Check if a drill item has any overrides
export function hasDrillOverrides(item: DrillItem): boolean {
  return !!item.overrides && Object.keys(item.overrides).length > 0;
}

// Get list of overridden field names
export function getOverriddenFields(item: DrillItem): (keyof Drill)[] {
  if (!item.overrides) return [];
  return Object.keys(item.overrides) as (keyof Drill)[];
}

// Clear a specific override field
export function clearDrillOverride(item: DrillItem, field: keyof Drill): DrillItem {
  if (!item.overrides) return item;
  const newOverrides = { ...item.overrides };
  delete newOverrides[field];
  return {
    ...item,
    overrides: Object.keys(newOverrides).length > 0 ? newOverrides : undefined,
  };
}

// Clear all overrides (reset to library version)
export function clearAllDrillOverrides(item: DrillItem): DrillItem {
  const { overrides, ...rest } = item;
  return rest as DrillItem;
}

// Set a drill override
export function setDrillOverride<K extends keyof Drill>(
  item: DrillItem,
  field: K,
  value: Drill[K]
): DrillItem {
  return {
    ...item,
    overrides: {
      ...item.overrides,
      [field]: value,
    },
  };
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
  const effectiveDrill = getEffectiveDrill(item);
  return parseDurationToSeconds(item.customDuration || effectiveDrill.duration);
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

// ============================================
// Timeline tree helpers (for drag & drop between the top level and groups)
// A "container" is either the top-level timeline (TIMELINE_ROOT_ID) or a group id.
// ============================================

export const TIMELINE_ROOT_ID = '__timeline-root__';

// Items held directly by a container, or null if no such container exists
export function getContainerItems(timeline: TimelineItem[], containerId: string): TimelineItem[] | null {
  if (containerId === TIMELINE_ROOT_ID) return timeline;
  for (const item of timeline) {
    if (item.type !== 'parallel') continue;
    for (const group of item.groups) {
      if (group.id === containerId) return group.items;
      const found = getContainerItems(group.items, containerId);
      if (found) return found;
    }
  }
  return null;
}

// Id of the container directly holding an item, or null if the item isn't in the timeline
export function findItemContainer(
  timeline: TimelineItem[],
  itemId: string,
  containerId: string = TIMELINE_ROOT_ID
): string | null {
  for (const item of timeline) {
    if (item.id === itemId) return containerId;
    if (item.type !== 'parallel') continue;
    for (const group of item.groups) {
      const found = findItemContainer(group.items, itemId, group.id);
      if (found) return found;
    }
  }
  return null;
}

// Find any item (drill or split) anywhere in the timeline
export function findTimelineItem(timeline: TimelineItem[], itemId: string): TimelineItem | null {
  for (const item of timeline) {
    if (item.id === itemId) return item;
    if (item.type !== 'parallel') continue;
    for (const group of item.groups) {
      const found = findTimelineItem(group.items, itemId);
      if (found) return found;
    }
  }
  return null;
}

// Id of the split that owns a group
export function findGroupSplitId(timeline: TimelineItem[], groupId: string): string | null {
  for (const item of timeline) {
    if (item.type !== 'parallel') continue;
    for (const group of item.groups) {
      if (group.id === groupId) return item.id;
      const found = findGroupSplitId(group.items, groupId);
      if (found) return found;
    }
  }
  return null;
}

// Replace the items of one container
function setContainerItems(
  timeline: TimelineItem[],
  containerId: string,
  updater: (items: TimelineItem[]) => TimelineItem[]
): TimelineItem[] {
  if (containerId === TIMELINE_ROOT_ID) return updater(timeline);
  return timeline.map(item => {
    if (item.type !== 'parallel') return item;
    return {
      ...item,
      groups: item.groups.map(group =>
        group.id === containerId
          ? { ...group, items: updater(group.items) }
          : { ...group, items: setContainerItems(group.items, containerId, updater) }
      ),
    };
  });
}

// Move an item to a position in any container (index is clamped to the container's length)
export function moveTimelineItem(
  timeline: TimelineItem[],
  itemId: string,
  toContainerId: string,
  toIndex: number
): TimelineItem[] {
  const fromContainerId = findItemContainer(timeline, itemId);
  const item = findTimelineItem(timeline, itemId);
  if (!fromContainerId || !item) return timeline;
  const removed = setContainerItems(timeline, fromContainerId, items => items.filter(i => i.id !== itemId));
  return setContainerItems(removed, toContainerId, items => {
    const index = Math.max(0, Math.min(toIndex, items.length));
    return [...items.slice(0, index), item, ...items.slice(index)];
  });
}

// Replace a split holding at most one item (across all its groups) with that item, or remove it
export function dissolveSplitIfSparse(timeline: TimelineItem[], splitId: string): TimelineItem[] {
  return timeline.flatMap(item => {
    if (item.type !== 'parallel') return [item];
    if (item.id === splitId) {
      const remaining = item.groups.flatMap(g => g.items);
      return remaining.length <= 1 ? remaining : [item];
    }
    return [{
      ...item,
      groups: item.groups.map(group => ({ ...group, items: dissolveSplitIfSparse(group.items, splitId) })),
    }];
  });
}

// "Run alongside": wrap an existing drill in a split, with a second drill in its own group.
// Groups are named after each drill's category, falling back to the default names on a tie.
export function createSplitAlongside(existing: DrillItem, alongside: DrillItem): ParallelSplitItem {
  const split = createParallelSplit(2);
  const existingCategory = getEffectiveDrill(existing).category;
  const alongsideCategory = getEffectiveDrill(alongside).category;
  const useCategoryNames = existingCategory !== alongsideCategory;
  const [first, second] = split.groups;
  return {
    ...split,
    groups: [
      { ...first, name: useCategoryNames ? existingCategory : first.name, items: [existing] },
      { ...second, name: useCategoryNames ? alongsideCategory : second.name, items: [alongside] },
    ],
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
  teamName: string;
  date: Date;
  duration: PracticeDuration;
  location: Location | null;  // Google Places location data for filtering
  drills: PracticePlanDrill[]; // Legacy: kept for backward compatibility
  timeline: TimelineItem[];    // New: branching timeline structure
  notes: string;
  equipment: string; // auto-calculated from drills
  createdAt: Date;
  updatedAt: Date;
}

export const DRILL_CATEGORIES: DrillCategory[] = ['Admin', 'Conditioning', 'Skating', 'Shooting', 'Passing', 'Defensive', 'Offensive', 'Goalie', 'Small Game', 'Systems', 'Scrimmage', 'Other'];

// Order drills by category (in DRILL_CATEGORIES order, which follows a practice's flow), then name
export function compareDrillsByCategory(a: Drill, b: Drill): number {
  const rank = (drill: Drill) => {
    const index = DRILL_CATEGORIES.indexOf(drill.category);
    return index === -1 ? DRILL_CATEGORIES.length : index;
  };
  const categoryDiff = rank(a) - rank(b);
  if (categoryDiff !== 0) return categoryDiff;
  return (a.name ?? '').toLowerCase().localeCompare((b.name ?? '').toLowerCase());
}

// Split an already-sorted drill list into consecutive runs of the same category
export function groupDrillsByCategory(drills: Drill[]): { category: DrillCategory; drills: Drill[] }[] {
  const sections: { category: DrillCategory; drills: Drill[] }[] = [];
  for (const drill of drills) {
    const last = sections[sections.length - 1];
    if (last && last.category === drill.category) {
      last.drills.push(drill);
    } else {
      sections.push({ category: drill.category, drills: [drill] });
    }
  }
  return sections;
}

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
  'Skating': ['Skating', 'Edges', 'Speed', 'Agility', 'Acceleration', 'Balance', 'Crossover', 'Stops', 'Starts', 'Lateral'],
  'Puck Skills': ['Puckhandling', 'Passing', 'Receiving', 'Shooting', 'Scoring', 'Finishing'],
  'Shooting Details': ['Rebounds', 'Deflections', 'Screens', 'Tips'],
  'Game Situations': ['Battles', 'Small Area', 'Contact', 'Compete', 'Possession'],
  'Team Systems': ['Breakouts', 'Regroups', 'Transitions', 'Entries', 'Forecheck', 'Backcheck', 'Coverage'],
  'Offensive Play': ['Offensive Play', 'Cycling', 'Netfront', 'Spacing', 'Rush', 'Cycle', 'Corner Play', 'Wall Play', 'Support', 'Quickstrike'],
  'Defensive Play': ['Defensive Play', 'Angling', 'Containment', 'Gap Control', 'Transition Defense', 'Pressure', 'Counter Attack'],
  'Special Teams': ['Special Teams', 'Powerplay', 'Penalty Kill'],
  'Conditioning': ['Conditioning', 'Endurance', 'Sprint'],
  'Goalie': ['Rebound Control', 'Goalie Puckhandling', 'Post Play', 'Puck Tracking', 'Recovery'],
  'Tactical': ['Deception', 'Vision', 'Timing', 'Awareness', 'Communication', 'Decision Making'],
  'Ice Layout': ['Full Ice', 'Half Ice', 'Station Based', 'Neutral Zone', 'Offensive Zone', 'Defensive Zone'],
  'Player Numbers': ['1v0', '1v1', '2v1', '2v2', '3v2', '3v3', '4v4', '5v5'],
  'Positions': ['Forwards', 'Defensemen', 'Centers', 'Wingers', 'Goalie'],
  'Equipment': ['Pucks', 'Cones', 'Tires', 'Pads', 'Gates', 'Obstacle'],
  'Skill Level': ['Beginner', 'Intermediate', 'Advanced', 'Expert'],
  'Age Group': ['U8', 'U10', 'U12', 'U14', 'U16', 'U18', 'Adult'],
  'Tempo': ['Low Tempo', 'Medium Tempo', 'High Tempo'],
  'Constraints': ['No Sticks', 'One Touch', 'Time Limit', 'Shot Limit', 'Pass Limit'],
  'Practice Structure': ['Warmup', 'Cooldown', 'Admin'],
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
