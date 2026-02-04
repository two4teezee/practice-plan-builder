import { supabase, isSupabaseConfigured } from './supabase';
import type { Drill, PracticePlan, PracticePlanDrill, TimelineItem } from './types';

// ============================================
// Database Row Types (snake_case from Supabase)
// ============================================

interface DrillRow {
  id: string;
  name: string;
  category: string;
  duration: string;
  skill_focus: string;
  objective: string;
  setup: string;
  execution: string;
  coaching_points: string;
  variations: string;
  equipment: string;
  description: string;
  video_link: string;
  pdf_link: string;
  sketch_data: string | null;
  created_at: string;
  updated_at: string;
}

interface PracticePlanRow {
  id: string;
  name: string;
  description: string;
  date: string;
  duration: string;
  location: string;
  notes: string;
  equipment: string;
  timeline: TimelineItem[];
  drills: PracticePlanDrill[];
  created_at: string;
  updated_at: string;
}

// ============================================
// Conversion Functions (Row <-> App Types)
// ============================================

function drillRowToApp(row: DrillRow): Drill {
  return {
    id: row.id,
    name: row.name,
    category: row.category as Drill['category'],
    duration: row.duration,
    skillFocus: row.skill_focus as Drill['skillFocus'],
    objective: row.objective || '',
    setup: row.setup || '',
    execution: row.execution || '',
    coachingPoints: row.coaching_points || '',
    variations: row.variations || '',
    equipment: row.equipment || '',
    description: row.description || '',
    videoLink: row.video_link || '',
    pdfLink: row.pdf_link || '',
    sketchData: row.sketch_data || undefined,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function drillAppToRow(drill: Omit<Drill, 'id' | 'createdAt' | 'updatedAt'>): Omit<DrillRow, 'id' | 'created_at' | 'updated_at'> {
  return {
    name: drill.name,
    category: drill.category,
    duration: drill.duration,
    skill_focus: drill.skillFocus,
    objective: drill.objective,
    setup: drill.setup,
    execution: drill.execution,
    coaching_points: drill.coachingPoints,
    variations: drill.variations,
    equipment: drill.equipment,
    description: drill.description,
    video_link: drill.videoLink,
    pdf_link: drill.pdfLink,
    sketch_data: drill.sketchData || null,
  };
}

function practicePlanRowToApp(row: PracticePlanRow): PracticePlan {
  return {
    id: row.id,
    name: row.name,
    description: row.description || '',
    date: new Date(row.date),
    duration: row.duration as PracticePlan['duration'],
    location: row.location || '',
    notes: row.notes || '',
    equipment: row.equipment || '',
    timeline: row.timeline || [],
    drills: row.drills || [],
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function practicePlanAppToRow(plan: Omit<PracticePlan, 'id' | 'createdAt' | 'updatedAt'>): Omit<PracticePlanRow, 'id' | 'created_at' | 'updated_at'> {
  // Format date as YYYY-MM-DD for Supabase
  const dateStr = plan.date instanceof Date 
    ? plan.date.toISOString().split('T')[0]
    : new Date(plan.date).toISOString().split('T')[0];
  
  return {
    name: plan.name,
    description: plan.description,
    date: dateStr,
    duration: plan.duration,
    location: plan.location,
    notes: plan.notes,
    equipment: plan.equipment,
    timeline: plan.timeline,
    drills: plan.drills,
  };
}

// ============================================
// Drill CRUD Operations
// ============================================

export async function getDrills(): Promise<Drill[]> {
  if (!isSupabaseConfigured()) {
    console.warn('Supabase not configured, returning empty drills');
    return [];
  }
  
  const { data, error } = await supabase
    .from('drills')
    .select('*')
    .order('name');
  
  if (error) {
    console.error('Error fetching drills:', error);
    throw error;
  }
  
  return (data || []).map(drillRowToApp);
}

export async function getDrill(id: string): Promise<Drill | null> {
  const { data, error } = await supabase
    .from('drills')
    .select('*')
    .eq('id', id)
    .single();
  
  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    console.error('Error fetching drill:', error);
    throw error;
  }
  
  return data ? drillRowToApp(data) : null;
}

export async function getDrillByName(name: string): Promise<Drill | null> {
  const { data, error } = await supabase
    .from('drills')
    .select('*')
    .eq('name', name)
    .maybeSingle();
  
  if (error) {
    console.error('Error fetching drill by name:', error);
    throw error;
  }
  
  return data ? drillRowToApp(data) : null;
}

export async function createDrill(drill: Omit<Drill, 'id' | 'createdAt' | 'updatedAt'>): Promise<Drill> {
  const row = drillAppToRow(drill);
  
  const { data, error } = await supabase
    .from('drills')
    .insert(row)
    .select()
    .single();
  
  if (error) {
    console.error('Error creating drill:', error);
    throw error;
  }
  
  return drillRowToApp(data);
}

export async function updateDrill(id: string, drill: Partial<Omit<Drill, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Drill> {
  // Convert partial app fields to partial row fields
  const updates: Record<string, unknown> = {};
  if (drill.name !== undefined) updates.name = drill.name;
  if (drill.category !== undefined) updates.category = drill.category;
  if (drill.duration !== undefined) updates.duration = drill.duration;
  if (drill.skillFocus !== undefined) updates.skill_focus = drill.skillFocus;
  if (drill.objective !== undefined) updates.objective = drill.objective;
  if (drill.setup !== undefined) updates.setup = drill.setup;
  if (drill.execution !== undefined) updates.execution = drill.execution;
  if (drill.coachingPoints !== undefined) updates.coaching_points = drill.coachingPoints;
  if (drill.variations !== undefined) updates.variations = drill.variations;
  if (drill.equipment !== undefined) updates.equipment = drill.equipment;
  if (drill.description !== undefined) updates.description = drill.description;
  if (drill.videoLink !== undefined) updates.video_link = drill.videoLink;
  if (drill.pdfLink !== undefined) updates.pdf_link = drill.pdfLink;
  if (drill.sketchData !== undefined) updates.sketch_data = drill.sketchData;
  
  const { data, error } = await supabase
    .from('drills')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  
  if (error) {
    console.error('Error updating drill:', error);
    throw error;
  }
  
  return drillRowToApp(data);
}

export async function deleteDrill(id: string): Promise<void> {
  const { error } = await supabase
    .from('drills')
    .delete()
    .eq('id', id);
  
  if (error) {
    console.error('Error deleting drill:', error);
    throw error;
  }
}

export async function getDrillsCount(): Promise<number> {
  if (!isSupabaseConfigured()) {
    return 0;
  }
  
  const { count, error } = await supabase
    .from('drills')
    .select('*', { count: 'exact', head: true });
  
  if (error) {
    console.error('Error counting drills:', error);
    throw error;
  }
  
  return count || 0;
}

export async function getDrillsByIds(ids: string[]): Promise<Drill[]> {
  if (ids.length === 0) return [];
  if (!isSupabaseConfigured()) return [];
  
  const { data, error } = await supabase
    .from('drills')
    .select('*')
    .in('id', ids);
  
  if (error) {
    console.error('Error fetching drills by IDs:', error);
    throw error;
  }
  
  return (data || []).map(drillRowToApp);
}

// ============================================
// Practice Plan CRUD Operations
// ============================================

export async function getPracticePlans(): Promise<PracticePlan[]> {
  if (!isSupabaseConfigured()) {
    console.warn('Supabase not configured, returning empty practice plans');
    return [];
  }
  
  const { data, error } = await supabase
    .from('practice_plans')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('Error fetching practice plans:', error);
    throw error;
  }
  
  return (data || []).map(practicePlanRowToApp);
}

export async function getPracticePlan(id: string): Promise<PracticePlan | null> {
  const { data, error } = await supabase
    .from('practice_plans')
    .select('*')
    .eq('id', id)
    .single();
  
  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    console.error('Error fetching practice plan:', error);
    throw error;
  }
  
  return data ? practicePlanRowToApp(data) : null;
}

export async function getPracticePlanByName(name: string): Promise<PracticePlan | null> {
  const { data, error } = await supabase
    .from('practice_plans')
    .select('*')
    .eq('name', name)
    .maybeSingle();
  
  if (error) {
    console.error('Error fetching practice plan by name:', error);
    throw error;
  }
  
  return data ? practicePlanRowToApp(data) : null;
}

export async function createPracticePlan(plan: Omit<PracticePlan, 'id' | 'createdAt' | 'updatedAt'>): Promise<PracticePlan> {
  const row = practicePlanAppToRow(plan);
  
  const { data, error } = await supabase
    .from('practice_plans')
    .insert(row)
    .select()
    .single();
  
  if (error) {
    console.error('Error creating practice plan:', error);
    throw error;
  }
  
  return practicePlanRowToApp(data);
}

export async function updatePracticePlan(id: string, plan: Partial<Omit<PracticePlan, 'id' | 'createdAt' | 'updatedAt'>>): Promise<PracticePlan> {
  // Convert partial app fields to partial row fields
  const updates: Record<string, unknown> = {};
  if (plan.name !== undefined) updates.name = plan.name;
  if (plan.description !== undefined) updates.description = plan.description;
  if (plan.date !== undefined) {
    updates.date = plan.date instanceof Date 
      ? plan.date.toISOString().split('T')[0]
      : new Date(plan.date).toISOString().split('T')[0];
  }
  if (plan.duration !== undefined) updates.duration = plan.duration;
  if (plan.location !== undefined) updates.location = plan.location;
  if (plan.notes !== undefined) updates.notes = plan.notes;
  if (plan.equipment !== undefined) updates.equipment = plan.equipment;
  if (plan.timeline !== undefined) updates.timeline = plan.timeline;
  if (plan.drills !== undefined) updates.drills = plan.drills;
  
  const { data, error } = await supabase
    .from('practice_plans')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  
  if (error) {
    console.error('Error updating practice plan:', error);
    throw error;
  }
  
  return practicePlanRowToApp(data);
}

export async function deletePracticePlan(id: string): Promise<void> {
  const { error } = await supabase
    .from('practice_plans')
    .delete()
    .eq('id', id);
  
  if (error) {
    console.error('Error deleting practice plan:', error);
    throw error;
  }
}

// ============================================
// Helper Functions
// ============================================

// Migration helper: convert legacy PracticePlanDrill[] to TimelineItem[]
function migrateDrillsToTimeline(drills: PracticePlanDrill[]): TimelineItem[] {
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

// Ensure a practice plan has a timeline (for data loaded from DB)
export function ensurePlanHasTimeline(plan: PracticePlan): PracticePlan {
  if (!plan.timeline || plan.timeline.length === 0) {
    if (plan.drills && plan.drills.length > 0) {
      return {
        ...plan,
        timeline: migrateDrillsToTimeline(plan.drills),
      };
    }
    return {
      ...plan,
      timeline: [],
    };
  }
  return plan;
}

// Helper to recursively refresh drill data in timeline items
async function refreshTimelineItems(items: TimelineItem[], drillsMap: Map<string, Drill>): Promise<TimelineItem[]> {
  return Promise.all(items.map(async (item) => {
    if (item.type === 'drill') {
      const freshDrill = drillsMap.get(item.drillId);
      if (freshDrill) {
        return {
          ...item,
          drill: freshDrill,
        };
      }
      return item;
    } else {
      // Parallel split - recursively refresh groups
      return {
        ...item,
        groups: await Promise.all(item.groups.map(async (group) => ({
          ...group,
          items: await refreshTimelineItems(group.items, drillsMap),
        }))),
      };
    }
  }));
}

// Refresh a practice plan's drill data with latest from database
// This ensures sketches and other drill updates are reflected
export async function refreshPlanDrillData(plan: PracticePlan): Promise<PracticePlan> {
  const normalizedPlan = ensurePlanHasTimeline(plan);
  
  if (!normalizedPlan.timeline || normalizedPlan.timeline.length === 0) {
    return normalizedPlan;
  }
  
  // Collect all drill IDs from the timeline
  const collectDrillIds = (items: TimelineItem[]): string[] => {
    const ids: string[] = [];
    for (const item of items) {
      if (item.type === 'drill') {
        ids.push(item.drillId);
      } else {
        for (const group of item.groups) {
          ids.push(...collectDrillIds(group.items));
        }
      }
    }
    return ids;
  };
  
  const drillIds = [...new Set(collectDrillIds(normalizedPlan.timeline))];
  
  // Fetch all drills at once
  const drills = await getDrillsByIds(drillIds);
  const drillsMap = new Map(drills.map(d => [d.id!, d]));
  
  // Refresh the timeline with fresh drill data
  const refreshedTimeline = await refreshTimelineItems(normalizedPlan.timeline, drillsMap);
  
  // Also refresh legacy drills array if present
  const refreshedDrills = normalizedPlan.drills?.map(d => {
    const freshDrill = drillsMap.get(d.drillId);
    if (freshDrill) {
      return { ...d, drill: freshDrill };
    }
    return d;
  });
  
  return {
    ...normalizedPlan,
    timeline: refreshedTimeline,
    drills: refreshedDrills || [],
  };
}

// ============================================
// Seed Data
// ============================================

export const seedDrills: Omit<Drill, 'id' | 'createdAt' | 'updatedAt'>[] = [
  {
    name: 'Setup Ice and Warm Ups',
    category: 'Admin',
    duration: '2:00',
    skillFocus: 'Other',
    objective: 'Set up equipment on ice while players warm up',
    setup: 'Coaches set up cones, nets, and other equipment',
    execution: 'Players do light skating and stretching while coaches prepare the ice',
    coachingPoints: 'Use this time efficiently to set up for the first drill',
    variations: '',
    equipment: '',
    description: 'Administrative time for ice setup and player warm-ups',
    videoLink: '',
    pdfLink: '',
  },
  {
    name: 'Warm-up Skating',
    category: 'Skating',
    duration: '5:00',
    skillFocus: 'Skating',
    objective: 'Get players warmed up and ready for practice',
    setup: 'Players line up on the goal line',
    execution: 'Skate around the rink with various skating techniques: forward, backward, crossovers',
    coachingPoints: 'Focus on proper skating form, knee bend, and arm movement',
    variations: 'Add puck handling, increase speed, add stops and starts',
    equipment: '',
    description: 'Basic warm-up skating drill to get blood flowing',
    videoLink: '',
    pdfLink: '',
  },
  {
    name: 'Two-Line Passing',
    category: 'Passing',
    duration: '10:00',
    skillFocus: 'Passing',
    objective: 'Improve passing accuracy and receiving skills',
    setup: 'Two lines facing each other at center ice, 20 feet apart',
    execution: 'Pass back and forth, focusing on tape-to-tape passes',
    coachingPoints: 'Cup the puck on reception, follow through on passes, eyes up',
    variations: 'Increase distance, add movement, use saucer passes',
    equipment: '',
    description: 'Classic passing drill for all skill levels',
    videoLink: '',
    pdfLink: '',
  },
  {
    name: 'Shooting Stations',
    category: 'Shooting',
    duration: '15:00',
    skillFocus: 'Shooting',
    objective: 'Practice various shot types from different positions',
    setup: 'Set up 4 stations around the offensive zone with puck piles',
    execution: 'Rotate through stations taking wrist shots, slap shots, snap shots, and one-timers',
    coachingPoints: 'Quick release, pick corners, follow through toward target',
    variations: 'Add defenders, time limit per station, competition between groups',
    equipment: '4 Cones, 2 Nets, Shooter Tutor',
    description: 'Multi-station shooting drill for comprehensive shooting practice',
    videoLink: '',
    pdfLink: '',
  },
  {
    name: 'Box Drill',
    category: 'Defensive',
    duration: '8:00',
    skillFocus: 'Defensive',
    objective: 'Practice defensive positioning and gap control',
    setup: 'Create a box with 4 cones in the neutral zone',
    execution: 'Defender skates backward maintaining proper gap while attacker tries to enter the box',
    coachingPoints: 'Stay between attacker and net, stick on ice, active feet',
    variations: 'Add second attacker, allow breakouts, add puck',
    equipment: '4 Cones',
    description: 'Defensive positioning drill emphasizing gap control',
    videoLink: '',
    pdfLink: '',
  },
  {
    name: '2-on-1 Rush',
    category: 'Offensive',
    duration: '12:00',
    skillFocus: 'Offensive',
    objective: 'Practice 2-on-1 situations with quick decision making',
    setup: 'Two lines at center ice, one defender at blue line',
    execution: 'Two forwards attack against one defender, focus on give-and-go or shot',
    coachingPoints: 'Read the defender, make quick decisions, shoot if lane is open',
    variations: '3-on-2, add backchecker, start from different positions',
    equipment: 'Nets',
    description: 'Classic odd-man rush drill for offensive creativity',
    videoLink: '',
    pdfLink: '',
  },
  {
    name: 'Figure 8 Skating',
    category: 'Skating',
    duration: '6:00',
    skillFocus: 'Skating',
    objective: 'Improve edge work and crossovers',
    setup: 'Place two cones 30 feet apart at center ice',
    execution: 'Skate figure 8 patterns around the cones using crossovers',
    coachingPoints: 'Deep knee bend on crossovers, push with both edges, keep head up',
    variations: 'Add puck, change direction, increase speed',
    equipment: '2 Cones',
    description: 'Edge work and crossover development drill',
    videoLink: '',
    pdfLink: '',
  },
  {
    name: 'Tire Agility Course',
    category: 'Skating',
    duration: '8:00',
    skillFocus: 'Skating',
    objective: 'Improve agility, balance, and quick feet',
    setup: 'Set up tires in a zigzag pattern across the ice',
    execution: 'Players skate through the tires, stepping over and around them',
    coachingPoints: 'Keep knees bent, quick feet, stay low',
    variations: 'Add puck, race format, backwards skating',
    equipment: '6 Tires, 4 Cones',
    description: 'Agility drill using tires for footwork development',
    videoLink: '',
    pdfLink: '',
  },
  {
    name: 'Border Patrol Passing',
    category: 'Passing',
    duration: '10:00',
    skillFocus: 'Passing',
    objective: 'Improve passing accuracy under pressure',
    setup: 'Set up border patrol barriers creating passing lanes',
    execution: 'Players must pass through the barriers to teammates',
    coachingPoints: 'Accurate passes, read the lanes, quick decisions',
    variations: 'Add defenders, time pressure, moving targets',
    equipment: '2 Border Patrol, 4 Cones',
    description: 'Passing drill using barriers to create realistic lanes',
    videoLink: '',
    pdfLink: '',
  },
];

// Initialize database with seed data if empty
export async function initializeDatabase(): Promise<void> {
  if (!isSupabaseConfigured()) {
    console.warn('Supabase not configured, skipping database initialization');
    return;
  }
  
  try {
    const count = await getDrillsCount();
    if (count === 0) {
      console.log('Seeding database with initial drills...');
      for (const drill of seedDrills) {
        await createDrill(drill);
      }
      console.log('Database seeded successfully!');
    }
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
}
