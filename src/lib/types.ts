export type DrillCategory = 'Admin' | 'Skating' | 'Shooting' | 'Passing' | 'Defensive' | 'Offensive' | 'Other';
export type SkillFocus = 'Skating' | 'Shooting' | 'Passing' | 'Defensive' | 'Offensive' | 'Other';
export type PracticeDuration = '30 minutes' | '45 minutes' | '50 minutes' | '60 minutes' | '75 minutes' | '90 minutes';

export interface Drill {
  id?: number;
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
  createdAt: Date;
  updatedAt: Date;
}

export interface PracticePlanDrill {
  id: string; // unique id for drag-drop
  drillId: number;
  drill: Drill;
  customDuration?: string; // override the drill's default duration for this practice
  customNotes?: string;
  order: number;
}

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

export interface PracticePlan {
  id?: number;
  name: string;
  description: string;
  date: Date;
  duration: PracticeDuration;
  location: string;
  drills: PracticePlanDrill[];
  notes: string;
  equipment: string; // auto-calculated from drills
  createdAt: Date;
  updatedAt: Date;
}

export const DRILL_CATEGORIES: DrillCategory[] = ['Admin', 'Skating', 'Shooting', 'Passing', 'Defensive', 'Offensive', 'Other'];

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
