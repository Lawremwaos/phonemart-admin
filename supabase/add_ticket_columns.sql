-- Add ticket_number and collected columns to repairs table
ALTER TABLE repairs 
ADD COLUMN IF NOT EXISTS ticket_number text,
ADD COLUMN IF NOT EXISTS collected boolean NOT NULL DEFAULT false;

-- Create index on ticket_number for faster lookups
CREATE INDEX IF NOT EXISTS repairs_ticket_number_idx ON repairs(ticket_number);
