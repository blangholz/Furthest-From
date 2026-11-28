-- Shake to report (Decision #42): testers shake the phone, mark up a screenshot, add a
-- note and send it. The image goes to the private storage bucket fff-bug-reports under
-- <user id>/, then submit_bug_report records the note, the path and some app context.
-- Only testers can upload or submit. Nobody reads reports through the API: Claude pulls
-- them with the service role (scripts/bug-reports.mjs).
set search_path = fff, extensions, public;

create table if not exists fff.bug_reports (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  note text not null default '' check (length(note) <= 4000),
  screenshot_path text,
  context jsonb not null default '{}'::jsonb,
  status text not null default 'new' check (status in ('new', 'seen', 'fixed', 'wontfix')),
  created_at timestamptz not null default now(),
  seen_at timestamptz
);
create index if not exists bug_reports_status_idx on fff.bug_reports (status, created_at);

alter table fff.bug_reports enable row level security;
revoke all on fff.bug_reports from anon, authenticated;
grant all on fff.bug_reports to service_role;

-- Used by the storage policy below, so it must be callable by players.
create or replace function fff.is_tester()
returns boolean language sql stable security definer set search_path = fff, extensions, public as $$
  select coalesce((select is_tester from fff.profiles where id = auth.uid()), false)
$$;

create or replace function fff.submit_bug_report(p_note text, p_screenshot_path text, p_context jsonb default '{}'::jsonb)
returns bigint language plpgsql security definer set search_path = fff, extensions, public as $$
declare new_id bigint;
begin
  if auth.uid() is null then raise exception 'not_signed_in' using errcode = '28000'; end if;
  if not fff.is_tester() then raise exception 'not_tester' using errcode = '42501'; end if;
  if p_screenshot_path is not null and p_screenshot_path not like auth.uid()::text || '/%' then
    raise exception 'bad_path' using errcode = '22023';
  end if;
  insert into fff.bug_reports (user_id, note, screenshot_path, context)
  values (auth.uid(), left(coalesce(p_note, ''), 4000), p_screenshot_path, coalesce(p_context, '{}'::jsonb))
  returning id into new_id;
  return new_id;
end $$;

revoke all on function fff.is_tester(), fff.submit_bug_report(text, text, jsonb) from public, anon;
grant execute on function fff.is_tester(), fff.submit_bug_report(text, text, jsonb) to authenticated;

-- Private bucket: 5 MB images only. Testers may add files to their own folder; there is
-- no select/update/delete policy, so nothing can be read back through the API.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fff-bug-reports', 'fff-bug-reports', false, 5242880, array['image/jpeg', 'image/png'])
on conflict (id) do nothing;

drop policy if exists fff_bug_reports_tester_upload on storage.objects;
create policy fff_bug_reports_tester_upload on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'fff-bug-reports'
    and (storage.foldername(name))[1] = auth.uid()::text
    and fff.is_tester()
  );

-- The pull script shows who sent each report.
grant select (id, display_name, username, is_tester) on fff.profiles to service_role;
