-- Manager approval queue for sensitive inventory actions
create table if not exists inventory_manager_approvals (
  id uuid primary key default gen_random_uuid(),
  action text not null check (action in ('inventory_update','inventory_delete','stock_allocation_create')),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  requested_by text,
  approved_by text,
  requested_at timestamptz not null default now(),
  approved_at timestamptz,
  payload jsonb not null default '{}'::jsonb,
  notes text
);

create index if not exists inventory_manager_approvals_status_idx on inventory_manager_approvals(status);
create index if not exists inventory_manager_approvals_requested_at_idx on inventory_manager_approvals(requested_at desc);

-- Stock movement ledger
create table if not exists inventory_stock_movements (
  id uuid primary key default gen_random_uuid(),
  item_id bigint not null,
  item_name text not null,
  shop_id text,
  delta int not null,
  reason text not null check (reason in ('initial_stock','manual_edit','manual_delete','sale','allocation_out','allocation_in','purchase_in','adjustment')),
  actor text,
  reference_id text,
  created_at timestamptz not null default now()
);

create index if not exists inventory_stock_movements_item_id_idx on inventory_stock_movements(item_id);
create index if not exists inventory_stock_movements_created_at_idx on inventory_stock_movements(created_at desc);

-- Staff account history
create table if not exists staff_audit_logs (
  id uuid primary key default gen_random_uuid(),
  action text not null check (action in ('staff_add','staff_update','staff_delete')),
  actor text,
  target_user_id uuid,
  target_name text,
  details text,
  created_at timestamptz not null default now()
);

create index if not exists staff_audit_logs_created_at_idx on staff_audit_logs(created_at desc);
