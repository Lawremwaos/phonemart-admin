-- Staff procurement/outsourced items tracking
CREATE TABLE IF NOT EXISTS staff_procurements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_name text NOT NULL,
  category text NOT NULL CHECK (category IN ('shop_use', 'future_stock')),
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  cost numeric NOT NULL DEFAULT 0,
  supplier_name text,
  reason text NOT NULL,
  submitted_by text NOT NULL,
  submitted_by_shop text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'sold')),
  approved_by text,
  approved_date timestamptz,
  reject_reason text,
  submitted_date timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS staff_procurements_status_idx ON staff_procurements(status);
CREATE INDEX IF NOT EXISTS staff_procurements_submitted_by_idx ON staff_procurements(submitted_by);
CREATE INDEX IF NOT EXISTS staff_procurements_submitted_date_idx ON staff_procurements(submitted_date);

-- Payment tracking for staff procurements (same pattern as supplier_payments)
CREATE TABLE IF NOT EXISTS procurement_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  procurement_id uuid NOT NULL REFERENCES staff_procurements(id) ON DELETE CASCADE,
  supplier_name text,
  amount numeric NOT NULL CHECK (amount > 0),
  payment_method text NOT NULL CHECK (payment_method IN ('mpesa', 'bank', 'cash', 'other')),
  payment_date timestamptz NOT NULL DEFAULT now(),
  notes text,
  recorded_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS procurement_payments_procurement_id_idx ON procurement_payments(procurement_id);
CREATE INDEX IF NOT EXISTS procurement_payments_payment_date_idx ON procurement_payments(payment_date);

-- RLS: allow app (anon) to read/write staff_procurements so staff can submit and admin can review
ALTER TABLE staff_procurements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow anon all staff_procurements" ON staff_procurements;
CREATE POLICY "Allow anon all staff_procurements" ON staff_procurements
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- RLS for procurement_payments (admin records payments)
ALTER TABLE procurement_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow anon all procurement_payments" ON procurement_payments;
CREATE POLICY "Allow anon all procurement_payments" ON procurement_payments
  FOR ALL TO anon USING (true) WITH CHECK (true);
