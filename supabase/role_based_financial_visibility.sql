-- Role-based financial visibility: supplier type, actual_cost (admin-only), sold_by for staff breakdown
-- Run in Supabase SQL Editor.

-- 1. Suppliers: add type (local = staff can see, wholesale = admin only)
ALTER TABLE suppliers
  ADD COLUMN IF NOT EXISTS supplier_type text NOT NULL DEFAULT 'local'
  CHECK (supplier_type IN ('local', 'wholesale'));
COMMENT ON COLUMN suppliers.supplier_type IS 'local = visible to staff; wholesale = admin only';

-- 2. Inventory: real buying price (admin only, never expose to staff)
ALTER TABLE inventory_items
  ADD COLUMN IF NOT EXISTS actual_cost numeric;
COMMENT ON COLUMN inventory_items.actual_cost IS 'Real buying price from supplier; admin only, used for profit calculation';

-- 3. Purchase items: store actual cost at purchase time
ALTER TABLE purchase_items
  ADD COLUMN IF NOT EXISTS actual_cost numeric;
COMMENT ON COLUMN purchase_items.actual_cost IS 'Real buying price paid; admin only';

-- 4. Purchases: link to supplier type (optional, can derive from supplier)
ALTER TABLE purchases
  ADD COLUMN IF NOT EXISTS supplier_type text DEFAULT 'local' CHECK (supplier_type IN ('local', 'wholesale'));

-- 5. Sales: who made the sale (for daily report breakdown per staff)
ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS sold_by text;
COMMENT ON COLUMN sales.sold_by IS 'Staff name who made the sale; for admin daily report';
