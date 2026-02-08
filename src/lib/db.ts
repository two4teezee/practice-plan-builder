import { supabase, isSupabaseConfigured } from './supabase';
import type { Drill, PracticePlan, PracticePlanDrill, TimelineItem, Location } from './types';

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
  tags: string[] | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

interface PracticePlanRow {
  id: string;
  name: string;
  description: string;
  team_name: string;
  date: string;
  duration: string;
  location: Location | null;  // JSONB from database
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
    tags: row.tags || [],
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    createdBy: row.created_by ? { id: row.created_by } : null,
    updatedBy: row.updated_by ? { id: row.updated_by } : null,
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
    tags: drill.tags || [],
    // Audit fields are set separately in createDrill/updateDrill
    created_by: null,
    updated_by: null,
  };
}

function practicePlanRowToApp(row: PracticePlanRow): PracticePlan {
  // Parse location - handle both JSONB object and legacy string format
  let location: Location | null = null;
  if (row.location) {
    if (typeof row.location === 'object') {
      // Ensure backward compatibility - older records may not have 'name' field
      location = {
        ...row.location,
        name: row.location.name || row.location.formattedAddress,
      };
    }
    // Legacy string locations are ignored (migrated to null)
  }

  return {
    id: row.id,
    name: row.name,
    description: row.description || '',
    teamName: row.team_name || '',
    date: new Date(row.date),
    duration: row.duration as PracticePlan['duration'],
    location,
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
    team_name: plan.teamName || '',
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

// Fetch a drill with full audit info (creator and modifier profile details)
// This function is resilient - it falls back gracefully if audit columns don't exist
export async function getDrillWithAuditInfo(id: string): Promise<Drill | null> {
  // First, fetch the basic drill
  const drill = await getDrill(id);
  if (!drill) return null;
  
  // If the drill has creator/updater IDs, try to fetch their profile info
  const userIds = new Set<string>();
  if (drill.createdBy?.id) userIds.add(drill.createdBy.id);
  if (drill.updatedBy?.id) userIds.add(drill.updatedBy.id);
  
  if (userIds.size === 0) {
    // No audit info to fetch
    return drill;
  }
  
  // Fetch profiles for the user IDs
  try {
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .in('id', Array.from(userIds));
    
    if (error || !profiles) {
      // If we can't fetch profiles, return drill with just the IDs
      return drill;
    }
    
    // Build a map of profiles
    const profileMap = new Map(profiles.map(p => [p.id, p]));
    
    // Enrich drill with profile info
    if (drill.createdBy?.id) {
      const profile = profileMap.get(drill.createdBy.id);
      if (profile) {
        drill.createdBy = {
          id: profile.id,
          fullName: profile.full_name || undefined,
          email: profile.email,
        };
      }
    }
    
    if (drill.updatedBy?.id) {
      const profile = profileMap.get(drill.updatedBy.id);
      if (profile) {
        drill.updatedBy = {
          id: profile.id,
          fullName: profile.full_name || undefined,
          email: profile.email,
        };
      }
    }
    
    return drill;
  } catch (err) {
    // If anything fails, just return the drill with basic audit info
    console.warn('Could not fetch audit profile info:', err);
    return drill;
  }
}

export async function getDrillByName(name: string): Promise<Drill | null> {
  if (!name || !name.trim()) {
    return null;
  }
  
  const { data, error } = await supabase
    .from('drills')
    .select('*')
    .eq('name', name.trim())
    .maybeSingle();
  
  if (error) {
    // Log full error details for debugging
    console.error('Error fetching drill by name:', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
      name: name
    });
    // Don't throw on permission errors - just return null to allow save to proceed
    // The actual save operation will properly handle permission issues
    if (error.code === 'PGRST116' || error.code === '42501') {
      return null;
    }
    throw error;
  }
  
  return data ? drillRowToApp(data) : null;
}

export async function createDrill(
  drill: Omit<Drill, 'id' | 'createdAt' | 'updatedAt'>,
  userId?: string
): Promise<Drill> {
  const row = drillAppToRow(drill);
  
  // Add audit fields if userId is provided
  const rowWithAudit = userId 
    ? { ...row, created_by: userId, updated_by: userId }
    : row;
  
  const { data, error } = await supabase
    .from('drills')
    .insert(rowWithAudit)
    .select()
    .single();
  
  if (error) {
    console.error('Error creating drill:', error);
    throw error;
  }
  
  return drillRowToApp(data);
}

export async function updateDrill(
  id: string,
  drill: Partial<Omit<Drill, 'id' | 'createdAt' | 'updatedAt'>>,
  userId?: string
): Promise<Drill> {
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
  if (drill.tags !== undefined) updates.tags = drill.tags;
  
  // Set updated_by if userId is provided
  if (userId) {
    updates.updated_by = userId;
  }
  
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
// Feedback Operations
// ============================================

export async function createFeedback(
  message: string,
  options?: { fullName?: string; userId?: string }
): Promise<void> {
  if (!isSupabaseConfigured()) {
    console.warn('Supabase not configured, skipping feedback insert');
    return;
  }

  const { error } = await supabase
    .from('feedback')
    .insert({
      message,
      full_name: options?.fullName || '',
      user_id: options?.userId || null,
    });

  if (error) {
    console.error('Error creating feedback:', error);
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
    tags: ['Warmup'],
  },
  {
    name: 'Water Break',
    category: 'Admin',
    duration: '2:00',
    skillFocus: 'Other',
    objective: 'Set up next drill while players take a water break',
    setup: 'Players take a water break',
    execution: 'Players take a water break',
    coachingPoints: 'Use this time efficiently to set up for the next drill',
    variations: '',
    equipment: '',
    description: 'Administrative time for water break',
    videoLink: '',
    pdfLink: '',
    tags: [],
  },
  {
    name: 'Scrimmage',
    category: 'Scrimmage',
    duration: '10:00',
    skillFocus: 'Other',
    objective: 'Players scrimmage',
    setup: 'Players scrimmage',
    execution: 'Players scrimmage',
    coachingPoints: 'Use this time efficiently to scrimmage',
    variations: '',
    equipment: '',
    description: 'Scrimmage time',
    videoLink: '',
    pdfLink: '',
    tags: ['Small Game', 'Compete'],
  },
];

// Initialize database - no longer seeds automatically
// Seed data is now added via SQL schema to bypass RLS
export async function initializeDatabase(): Promise<void> {
  if (!isSupabaseConfigured()) {
    console.warn('Supabase not configured, skipping database initialization');
    return;
  }
  
  // Database initialization is now handled by the SQL schema
  // Seeding via client would fail due to RLS requiring authenticated users
  console.log('Database initialized');
}
