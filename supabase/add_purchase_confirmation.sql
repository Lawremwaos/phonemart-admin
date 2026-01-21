-- Add confirmation fields to purchases table
ALTER TABLE purchases 
ADD COLUMN IF NOT EXISTS confirmed BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS confirmed_by TEXT,
ADD COLUMN IF NOT EXISTS confirmed_date TIMESTAMPTZ;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS purchases_confirmed_idx ON purchases(confirmed);
