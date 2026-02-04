-- Supabase Schema for Hockey Practice Planner
-- Run this SQL in your Supabase SQL Editor to create the tables

-- Enable UUID extension (usually already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

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

-- Row Level Security (RLS) - Enable but allow all operations for now
-- You can add more restrictive policies later when you add authentication

ALTER TABLE drills ENABLE ROW LEVEL SECURITY;
ALTER TABLE practice_plans ENABLE ROW LEVEL SECURITY;

-- Allow all operations for now (public access)
-- Replace these with more restrictive policies when you add auth
DROP POLICY IF EXISTS "Allow all operations on drills" ON drills;
CREATE POLICY "Allow all operations on drills" ON drills
  FOR ALL
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all operations on practice_plans" ON practice_plans;
CREATE POLICY "Allow all operations on practice_plans" ON practice_plans
  FOR ALL
  USING (true)
  WITH CHECK (true);
