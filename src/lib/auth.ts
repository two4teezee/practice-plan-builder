import { supabase, isSupabaseConfigured } from './supabase';
import type { User, Session, AuthChangeEvent } from '@supabase/supabase-js';

// ============================================
// Types
// ============================================

export interface Profile {
  id: string;
  email: string;
  fullName: string;
  isApproved: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface ProfileRow {
  id: string;
  email: string;
  full_name: string;
  is_approved: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================
// Conversion Functions
// ============================================

function profileRowToApp(row: ProfileRow): Profile {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name || '',
    isApproved: row.is_approved,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

// ============================================
// Auth Functions
// ============================================

/**
 * Sign up a new user with email and password
 */
export async function signUp(
  email: string,
  password: string,
  fullName: string
): Promise<{ user: User | null; error: Error | null }> {
  if (!isSupabaseConfigured()) {
    return { user: null, error: new Error('Supabase not configured') };
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
      },
    },
  });

  if (error) {
    return { user: null, error };
  }

  return { user: data.user, error: null };
}

/**
 * Sign in with email and password
 */
export async function signIn(
  email: string,
  password: string
): Promise<{ user: User | null; session: Session | null; error: Error | null }> {
  if (!isSupabaseConfigured()) {
    return { user: null, session: null, error: new Error('Supabase not configured') };
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { user: null, session: null, error };
  }

  return { user: data.user, session: data.session, error: null };
}

/**
 * Sign out the current user
 */
export async function signOut(): Promise<{ error: Error | null }> {
  if (!isSupabaseConfigured()) {
    return { error: new Error('Supabase not configured') };
  }

  const { error } = await supabase.auth.signOut();
  return { error: error || null };
}

/**
 * Get the current session
 */
export async function getSession(): Promise<Session | null> {
  if (!isSupabaseConfigured()) {
    return null;
  }

  const { data } = await supabase.auth.getSession();
  return data.session;
}

/**
 * Get the current user
 */
export async function getCurrentUser(): Promise<User | null> {
  if (!isSupabaseConfigured()) {
    return null;
  }

  const { data } = await supabase.auth.getUser();
  return data.user;
}

/**
 * Get the profile for a user by ID
 */
export async function getProfile(userId: string): Promise<Profile | null> {
  if (!isSupabaseConfigured()) {
    return null;
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('Error fetching profile:', error);
    return null;
  }

  return data ? profileRowToApp(data) : null;
}

/**
 * Subscribe to auth state changes
 */
export function onAuthStateChange(
  callback: (event: AuthChangeEvent, session: Session | null) => void
): { unsubscribe: () => void } {
  const { data } = supabase.auth.onAuthStateChange(callback);
  return { unsubscribe: () => data.subscription.unsubscribe() };
}

/**
 * Update user's own profile (not approval status)
 */
export async function updateProfile(
  userId: string,
  updates: { fullName?: string }
): Promise<{ profile: Profile | null; error: Error | null }> {
  if (!isSupabaseConfigured()) {
    return { profile: null, error: new Error('Supabase not configured') };
  }

  const updateData: Record<string, unknown> = {};
  if (updates.fullName !== undefined) {
    updateData.full_name = updates.fullName;
  }

  const { data, error } = await supabase
    .from('profiles')
    .update(updateData)
    .eq('id', userId)
    .select()
    .single();

  if (error) {
    return { profile: null, error };
  }

  return { profile: data ? profileRowToApp(data) : null, error: null };
}
