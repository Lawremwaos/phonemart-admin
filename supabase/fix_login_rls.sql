-- If login always returns "Invalid email or password" but the user exists in the DB,
-- Row Level Security may be blocking the anon key from reading `public.users`.
--
-- Check: Supabase → Table Editor → `users` → RLS enabled?
--
-- Only run the block below if RLS is ON for that table. Do NOT enable RLS here unless
-- you also add policies for INSERT/UPDATE/DELETE that your app needs (this repo uses
-- the anon key for CRUD on shops/users from the browser).

drop policy if exists "anon_select_users" on public.users;
create policy "anon_select_users"
  on public.users for select
  to anon
  using (true);

drop policy if exists "anon_select_shops" on public.shops;
create policy "anon_select_shops"
  on public.shops for select
  to anon
  using (true);
