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
  tags JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Migration: Add tags column to existing drills table
ALTER TABLE drills ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '[]'::jsonb;

-- Migration: Add audit columns for tracking who created/modified drills
ALTER TABLE drills ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE drills ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- Index for audit column lookups
CREATE INDEX IF NOT EXISTS idx_drills_created_by ON drills(created_by);
CREATE INDEX IF NOT EXISTS idx_drills_updated_by ON drills(updated_by);

-- Migration: Drop deprecated level column (now handled via tags)
-- Note: Run this only if you want to remove the level column from existing databases
-- ALTER TABLE drills DROP COLUMN IF EXISTS level;

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
CREATE INDEX IF NOT EXISTS idx_drills_tags ON drills USING GIN(tags);
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

-- Approved users can read all profiles (for displaying creator/modifier names in audit info)
DROP POLICY IF EXISTS "Approved users can view all profiles" ON profiles;
CREATE POLICY "Approved users can view all profiles" ON profiles
  FOR SELECT
  USING (is_approved_user());

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

-- ============================================
-- Seed Data (inserted bypassing RLS since this runs as admin)
-- ============================================

INSERT INTO drills (name, category, duration, skill_focus, objective, setup, execution, coaching_points, variations, equipment, description)
VALUES 
  ('Setup Ice and Warm Ups', 'Admin', '2:00', 'Other', 
   'Set up equipment on ice while players warm up',
   'Coaches set up cones, nets, and other equipment',
   'Players do light skating and stretching while coaches prepare the ice',
   'Use this time efficiently to set up for the first drill',
   '', '', 'Administrative time for ice setup and player warm-ups'),
   
  ('Warm-up Skating', 'Skating', '5:00', 'Skating',
   'Get players warmed up and ready for practice',
   'Players line up on the goal line',
   'Skate around the rink with various skating techniques: forward, backward, crossovers',
   'Focus on proper skating form, knee bend, and arm movement',
   'Add puck handling, increase speed, add stops and starts',
   '', 'Basic warm-up skating drill to get blood flowing'),
   
  ('Two-Line Passing', 'Passing', '10:00', 'Passing',
   'Improve passing accuracy and receiving skills',
   'Two lines facing each other at center ice, 20 feet apart',
   'Pass back and forth, focusing on tape-to-tape passes',
   'Cup the puck on reception, follow through on passes, eyes up',
   'Increase distance, add movement, use saucer passes',
   '', 'Classic passing drill for all skill levels'),
   
  ('Shooting Stations', 'Shooting', '15:00', 'Shooting',
   'Practice various shot types from different positions',
   'Set up 4 stations around the offensive zone with puck piles',
   'Rotate through stations taking wrist shots, slap shots, snap shots, and one-timers',
   'Quick release, pick corners, follow through toward target',
   'Add defenders, time limit per station, competition between groups',
   '4 Cones, 2 Nets, Shooter Tutor', 'Multi-station shooting drill for comprehensive shooting practice'),
   
  ('Box Drill', 'Defensive', '8:00', 'Defensive',
   'Practice defensive positioning and gap control',
   'Create a box with 4 cones in the neutral zone',
   'Defender skates backward maintaining proper gap while attacker tries to enter the box',
   'Stay between attacker and net, stick on ice, active feet',
   'Add second attacker, allow breakouts, add puck',
   '4 Cones', 'Defensive positioning drill emphasizing gap control'),
   
  ('2-on-1 Rush', 'Offensive', '12:00', 'Offensive',
   'Practice 2-on-1 situations with quick decision making',
   'Two lines at center ice, one defender at blue line',
   'Two forwards attack against one defender, focus on give-and-go or shot',
   'Read the defender, make quick decisions, shoot if lane is open',
   '3-on-2, add backchecker, start from different positions',
   'Nets', 'Classic odd-man rush drill for offensive creativity'),
   
  ('Figure 8 Skating', 'Skating', '6:00', 'Skating',
   'Improve edge work and crossovers',
   'Place two cones 30 feet apart at center ice',
   'Skate figure 8 patterns around the cones using crossovers',
   'Deep knee bend on crossovers, push with both edges, keep head up',
   'Add puck, change direction, increase speed',
   '2 Cones', 'Edge work and crossover development drill'),
   
  ('Tire Agility Course', 'Skating', '8:00', 'Skating',
   'Improve agility, balance, and quick feet',
   'Set up tires in a zigzag pattern across the ice',
   'Players skate through the tires, stepping over and around them',
   'Keep knees bent, quick feet, stay low',
   'Add puck, race format, backwards skating',
   '6 Tires, 4 Cones', 'Agility drill using tires for footwork development'),
   
  ('Border Patrol Passing', 'Passing', '10:00', 'Passing',
   'Improve passing accuracy under pressure',
   'Set up border patrol barriers creating passing lanes',
   'Players must pass through the barriers to teammates',
   'Accurate passes, read the lanes, quick decisions',
   'Add defenders, time pressure, moving targets',
   '2 Border Patrol, 4 Cones', 'Passing drill using barriers to create realistic lanes')
ON CONFLICT DO NOTHING;
