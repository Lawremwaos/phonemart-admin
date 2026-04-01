-- Optional customer and notes on accessory / phone sales (run once on your Supabase project)
ALTER TABLE sales ADD COLUMN IF NOT EXISTS customer_name text;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS customer_phone text;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS sale_notes text;

COMMENT ON COLUMN sales.customer_name IS 'Walk-in customer for retail/wholesale accessory sales';
COMMENT ON COLUMN sales.customer_phone IS 'Customer phone for accessory sales receipt / tracking';
COMMENT ON COLUMN sales.sale_notes IS 'Optional notes e.g. accessories sold summary';
