-- Add missing ticket_number and collected columns to existing repairs table
-- Run this if you get "column ticket_number does not exist" error

ALTER TABLE repairs 
ADD COLUMN IF NOT EXISTS ticket_number text,
ADD COLUMN IF NOT EXISTS collected boolean NOT NULL DEFAULT false;

-- Create index on ticket_number for faster lookups
CREATE INDEX IF NOT EXISTS repairs_ticket_number_idx ON repairs(ticket_number);

-- Verify columns were added
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'repairs'
AND column_name IN ('ticket_number', 'collected');
