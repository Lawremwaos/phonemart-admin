-- If Row Level Security is enabled on public.users but only SELECT was granted (see fix_login_rls.sql),
-- INSERT/UPDATE/DELETE from the app (anon key) will fail silently or with policy errors.
-- Run this in Supabase SQL Editor when staff cannot be saved or admin role changes do not persist.

drop policy if exists "anon_insert_users" on public.users;
create policy "anon_insert_users"
  on public.users for insert
  to anon
  with check (true);

drop policy if exists "anon_update_users" on public.users;
create policy "anon_update_users"
  on public.users for update
  to anon
  using (true)
  with check (true);

drop policy if exists "anon_delete_users" on public.users;
create policy "anon_delete_users"
  on public.users for delete
  to anon
  using (true);
