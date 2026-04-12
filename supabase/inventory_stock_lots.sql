-- Purchase batch tracking: merge inbound stock onto one inventory row while keeping per-purchase lots.
-- Run in Supabase SQL Editor after schema.sql / complete_setup.

create table if not exists public.inventory_stock_lots (
  id uuid primary key default gen_random_uuid(),
  item_id bigint not null references public.inventory_items(id) on delete cascade,
  purchase_id uuid references public.purchases(id) on delete set null,
  qty_initial int not null check (qty_initial >= 0),
  qty_remaining int not null check (qty_remaining >= 0),
  created_at timestamptz not null default now()
);

create index if not exists inventory_stock_lots_item_id_idx
  on public.inventory_stock_lots(item_id);

create index if not exists inventory_stock_lots_purchase_id_idx
  on public.inventory_stock_lots(purchase_id);

-- Optional: tie sale movements back to the purchase batch (FIFO) when stock was sold from a tracked lot
alter table if exists public.inventory_stock_movements
  add column if not exists source_purchase_id uuid references public.purchases(id) on delete set null;

comment on table public.inventory_stock_lots is 'Per-purchase inbound quantities remaining on an inventory row (FIFO consumption on sale).';
