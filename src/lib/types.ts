export type DrillCategory = 'Skating' | 'Shooting' | 'Passing' | 'Defensive' | 'Offensive' | 'Other';
export type SkillFocus = 'Skating' | 'Shooting' | 'Passing' | 'Defensive' | 'Offensive' | 'Other';
export type PracticeDuration = '30 minutes' | '45 minutes' | '50 minutes' | '60 minutes' | '75 minutes' | '90 minutes';
export type Coach = 'Coach 1' | 'Coach 2' | 'Coach 3' | 'Coach 4' | 'Coach 5';

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
  customNotes?: string;
  order: number;
}

export interface PracticePlan {
  id?: number;
  name: string;
  description: string;
  date: Date;
  duration: PracticeDuration;
  location: string;
  coach: Coach;
  drills: PracticePlanDrill[];
  notes: string;
  equipment: string; // auto-calculated from drills
  createdAt: Date;
  updatedAt: Date;
}

export const DRILL_CATEGORIES: DrillCategory[] = ['Skating', 'Shooting', 'Passing', 'Defensive', 'Offensive', 'Other'];
export const SKILL_FOCUSES: SkillFocus[] = ['Skating', 'Shooting', 'Passing', 'Defensive', 'Offensive', 'Other'];
export const PRACTICE_DURATIONS: PracticeDuration[] = ['30 minutes', '45 minutes', '50 minutes', '60 minutes', '75 minutes', '90 minutes'];
export const COACHES: Coach[] = ['Coach 1', 'Coach 2', 'Coach 3', 'Coach 4', 'Coach 5'];

// Generate drill duration options from 0:30 to 30:00 in 0:30 increments
export const DRILL_DURATIONS: string[] = Array.from({ length: 60 }, (_, i) => {
  const totalSeconds = (i + 1) * 30;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
});
