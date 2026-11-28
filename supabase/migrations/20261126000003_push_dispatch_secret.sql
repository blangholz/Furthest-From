-- push-dispatch rejected every call with 403: it compared the bearer token with the
-- service role key the platform injects, which no longer matches the legacy key in Vault.
-- The cron job now sends a dedicated shared secret instead. Set it up once (not in git):
--   select vault.create_secret('<random>', 'fff_dispatch_secret');
--   supabase secrets set FFF_DISPATCH_SECRET=<same random>
do $outer$
begin
  if not exists (select 1 from cron.job where jobname = 'ff-push-dispatch') then
    raise notice 'ff-push-dispatch job not scheduled, nothing to change';
    return;
  end if;
  perform cron.schedule('ff-push-dispatch', '* * * * *', $job$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'fff_project_url')
             || '/functions/v1/push-dispatch',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-dispatch-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'fff_dispatch_secret')),
      body := '{}'::jsonb,
      timeout_milliseconds := 20000)
    where exists (select 1 from fff.outbox where sent_at is null)
  $job$);
end
$outer$;
