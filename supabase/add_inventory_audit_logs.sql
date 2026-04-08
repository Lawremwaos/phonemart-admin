-- Add inventory audit logs table for stock edits/deletes/transfers
create table if not exists inventory_audit_logs (
  id uuid primary key default gen_random_uuid(),
  action text not null check (action in ('edit','delete','allocation_requested','allocation_approved','allocation_rejected')),
  item_id bigint,
  item_name text,
  qty int,
  source_shop_id text,
  source_shop_name text,
  target_shop_id text,
  target_shop_name text,
  actor text,
  details text,
  created_at timestamptz not null default now()
);

create index if not exists inventory_audit_logs_created_at_idx on inventory_audit_logs(created_at desc);
create index if not exists inventory_audit_logs_action_idx on inventory_audit_logs(action);
