-- Local test shim: just enough of Supabase (auth schema, roles, extensions schema)
-- to run the migrations and tests on a plain Postgres + PostGIS. Never run on Supabase.
create schema if not exists extensions;
create extension if not exists postgis with schema extensions;
create extension if not exists pgtap with schema extensions;
create extension if not exists pgcrypto with schema extensions;
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;
create schema if not exists auth;
create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant usage on schema auth, extensions to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;
alter database current_db_placeholder set search_path = fff, extensions, public;
-- Stand-in for another app sharing the project: the migrations must leave it alone.
create table public.other_app_notes (id int primary key, body text);
grant select, insert on public.other_app_notes to authenticated;
create function public.other_app_hello() returns text language sql as $$ select 'hi' $$;
grant execute on function public.other_app_hello() to authenticated;
