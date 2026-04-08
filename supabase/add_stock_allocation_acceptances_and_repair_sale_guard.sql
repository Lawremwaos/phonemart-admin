-- Track per-shop allocation acceptance and block duplicate repair accessory sales

create table if not exists stock_allocation_acceptances (
  id uuid primary key default gen_random_uuid(),
  allocation_id uuid not null references stock_allocations(id) on delete cascade,
  shop_id text not null,
  accepted_by text,
  accepted_at timestamptz not null default now()
);

create unique index if not exists stock_allocation_acceptances_alloc_shop_uidx
  on stock_allocation_acceptances(allocation_id, shop_id);

create index if not exists stock_allocation_acceptances_alloc_id_idx
  on stock_allocation_acceptances(allocation_id);

-- A repair should only create one repair-type sale row.
create unique index if not exists sales_repair_unique_idx on sales(repair_id) where sale_type = 'repair';
