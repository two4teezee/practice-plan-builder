-- Supabase Schema for Hockey Practice Planner
-- Run this SQL in your Supabase SQL Editor to create the tables

-- Enable UUID extension (usually already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- Profiles table (for user approval workflow)
-- ============================================

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT DEFAULT '',
  is_approved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for quick approval status lookups
CREATE INDEX IF NOT EXISTS idx_profiles_is_approved ON profiles(is_approved);

-- Trigger to auto-update updated_at on profiles
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to create a profile when a new user signs up
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, is_approved)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    FALSE
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to call handle_new_user on auth.users insert
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- RLS for profiles table
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own profile (but not is_approved)
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ============================================
-- Drills table
-- ============================================

-- Drills table
CREATE TABLE IF NOT EXISTS drills (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  duration TEXT NOT NULL,
  skill_focus TEXT NOT NULL,
  objective TEXT DEFAULT '',
  setup TEXT DEFAULT '',
  execution TEXT DEFAULT '',
  coaching_points TEXT DEFAULT '',
  variations TEXT DEFAULT '',
  equipment TEXT DEFAULT '',
  description TEXT DEFAULT '',
  video_link TEXT DEFAULT '',
  pdf_link TEXT DEFAULT '',
  sketch_data TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Practice Plans table
CREATE TABLE IF NOT EXISTS practice_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  date DATE NOT NULL,
  duration TEXT NOT NULL,
  location TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  equipment TEXT DEFAULT '',
  timeline JSONB DEFAULT '[]'::jsonb,
  drills JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_drills_name ON drills(name);
CREATE INDEX IF NOT EXISTS idx_drills_category ON drills(category);
CREATE INDEX IF NOT EXISTS idx_drills_created_at ON drills(created_at);
CREATE INDEX IF NOT EXISTS idx_practice_plans_name ON practice_plans(name);
CREATE INDEX IF NOT EXISTS idx_practice_plans_date ON practice_plans(date);
CREATE INDEX IF NOT EXISTS idx_practice_plans_created_at ON practice_plans(created_at);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers to auto-update updated_at
DROP TRIGGER IF EXISTS update_drills_updated_at ON drills;
CREATE TRIGGER update_drills_updated_at
  BEFORE UPDATE ON drills
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_practice_plans_updated_at ON practice_plans;
CREATE TRIGGER update_practice_plans_updated_at
  BEFORE UPDATE ON practice_plans
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Row Level Security (RLS)
-- Requires authenticated user with approved profile
-- ============================================

ALTER TABLE drills ENABLE ROW LEVEL SECURITY;
ALTER TABLE practice_plans ENABLE ROW LEVEL SECURITY;

-- Helper function to check if current user is approved
CREATE OR REPLACE FUNCTION is_approved_user()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND is_approved = TRUE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drills policies: only approved users can read/write
DROP POLICY IF EXISTS "Allow all operations on drills" ON drills;

DROP POLICY IF EXISTS "Approved users can select drills" ON drills;
CREATE POLICY "Approved users can select drills" ON drills
  FOR SELECT
  USING (is_approved_user());

DROP POLICY IF EXISTS "Approved users can insert drills" ON drills;
CREATE POLICY "Approved users can insert drills" ON drills
  FOR INSERT
  WITH CHECK (is_approved_user());

DROP POLICY IF EXISTS "Approved users can update drills" ON drills;
CREATE POLICY "Approved users can update drills" ON drills
  FOR UPDATE
  USING (is_approved_user())
  WITH CHECK (is_approved_user());

DROP POLICY IF EXISTS "Approved users can delete drills" ON drills;
CREATE POLICY "Approved users can delete drills" ON drills
  FOR DELETE
  USING (is_approved_user());

-- Practice Plans policies: only approved users can read/write
DROP POLICY IF EXISTS "Allow all operations on practice_plans" ON practice_plans;

DROP POLICY IF EXISTS "Approved users can select practice_plans" ON practice_plans;
CREATE POLICY "Approved users can select practice_plans" ON practice_plans
  FOR SELECT
  USING (is_approved_user());

DROP POLICY IF EXISTS "Approved users can insert practice_plans" ON practice_plans;
CREATE POLICY "Approved users can insert practice_plans" ON practice_plans
  FOR INSERT
  WITH CHECK (is_approved_user());

DROP POLICY IF EXISTS "Approved users can update practice_plans" ON practice_plans;
CREATE POLICY "Approved users can update practice_plans" ON practice_plans
  FOR UPDATE
  USING (is_approved_user())
  WITH CHECK (is_approved_user());

DROP POLICY IF EXISTS "Approved users can delete practice_plans" ON practice_plans;
CREATE POLICY "Approved users can delete practice_plans" ON practice_plans
  FOR DELETE
  USING (is_approved_user());
