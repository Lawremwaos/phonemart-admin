-- Track supplier payments (supports partial payments and different payment methods)
CREATE TABLE IF NOT EXISTS supplier_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id uuid NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  supplier_name text NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  payment_method text NOT NULL CHECK (payment_method IN ('mpesa', 'bank', 'cash', 'other')),
  payment_date timestamptz NOT NULL DEFAULT now(),
  notes text,
  recorded_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS supplier_payments_purchase_id_idx ON supplier_payments(purchase_id);
CREATE INDEX IF NOT EXISTS supplier_payments_supplier_name_idx ON supplier_payments(supplier_name);
CREATE INDEX IF NOT EXISTS supplier_payments_payment_date_idx ON supplier_payments(payment_date);
