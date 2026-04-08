-- Add manager scope assignment to users
alter table if exists users
  add column if not exists manager_scope text;

alter table if exists users
  drop constraint if exists users_manager_scope_check;

alter table if exists users
  add constraint users_manager_scope_check
  check (manager_scope in ('accessories','repair','both'));
