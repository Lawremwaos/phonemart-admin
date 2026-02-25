-- POS Accessory Sales: unified table + repair link + profit columns
-- Run this in Supabase SQL Editor after complete_setup.sql / schema.sql

-- 1. Sales: link to repair when sale is from repair invoice
ALTER TABLE sales ADD COLUMN IF NOT EXISTS repair_id uuid REFERENCES repairs(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS sales_repair_id_idx ON sales(repair_id);

-- 2. Sale type: allow 'repair' for accessory sales recorded from repair invoice
ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_sale_type_check;
ALTER TABLE sales ADD CONSTRAINT sales_sale_type_check
  CHECK (sale_type IN ('in-shop','wholesale','retail','repair'));

-- 3. Sale items: item reference + staff profit base (admin_base_price) + real cost (actual_cost, admin only)
ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS item_id bigint REFERENCES inventory_items(id) ON DELETE SET NULL;
ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS admin_base_price numeric;
ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS actual_cost numeric;
COMMENT ON COLUMN sale_items.admin_base_price IS 'Price set by admin for staff selling reference; staff_profit = price - admin_base_price';
COMMENT ON COLUMN sale_items.actual_cost IS 'Real wholesale cost; real_profit = price - actual_cost; ADMIN ONLY, never expose to staff';
