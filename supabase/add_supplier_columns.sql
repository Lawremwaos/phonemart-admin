-- Add supplier_name and source columns to repair_parts
-- And service_type column to repairs
-- Run this in Supabase Dashboard -> SQL Editor
ALTER TABLE repair_parts ADD COLUMN IF NOT EXISTS supplier_name TEXT;
ALTER TABLE repair_parts ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'in-house';
ALTER TABLE repairs ADD COLUMN IF NOT EXISTS service_type TEXT;
