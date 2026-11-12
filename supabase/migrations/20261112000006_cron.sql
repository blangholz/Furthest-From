-- Far From Fries: scheduled jobs.
-- Every minute: close finished ping windows, open 1:20 PM pings for players
-- whose local clock just reached it, warn about expiring Extra Fries, then call
-- the push-dispatch Edge Function to send whatever is waiting.
--
-- The push call reads two Vault secrets that you add once in the Supabase
-- dashboard (SQL editor):
--   select vault.create_secret('https://<project-ref>.supabase.co', 'project_url');
--   select vault.create_secret('<service role key>', 'service_role_key');
-- Skipped automatically where pg_cron / pg_net are not available (local tests).

do $outer$
begin
  begin
    create extension if not exists pg_cron;
  exception when others then
    raise notice 'pg_cron not available, skipping scheduled jobs: %', sqlerrm;
    return;
  end;

  perform cron.schedule('ff-minutely', '* * * * *', 'select private.run_minutely()');

  begin
    create extension if not exists pg_net with schema extensions;
  exception when others then
    raise notice 'pg_net not available, skipping push dispatch job: %', sqlerrm;
    return;
  end;

  perform cron.schedule('ff-push-dispatch', '* * * * *', $job$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
             || '/functions/v1/push-dispatch',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')),
      body := '{}'::jsonb,
      timeout_milliseconds := 20000)
    where exists (select 1 from public.outbox where sent_at is null)
  $job$);
end
$outer$;
