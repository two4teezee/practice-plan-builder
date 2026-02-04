import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';

// Check if we have real credentials (not placeholders)
const hasRealCredentials = 
  process.env.NEXT_PUBLIC_SUPABASE_URL && 
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Create the Supabase client
// Note: Uses placeholder values during build, but API calls will check isSupabaseConfigured()
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Helper to check if Supabase is configured with real credentials
export function isSupabaseConfigured(): boolean {
  return Boolean(hasRealCredentials);
}
