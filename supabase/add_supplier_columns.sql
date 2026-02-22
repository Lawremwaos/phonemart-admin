-- Add supplier_name and source columns to repair_parts
-- Run this in Supabase Dashboard -> SQL Editor
ALTER TABLE repair_parts ADD COLUMN IF NOT EXISTS supplier_name TEXT;
ALTER TABLE repair_parts ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'in-house';
