# Far From Fries: setup checklist

Everything here needs an account or a decision from Benjamin. The code is ready
for each step. Nothing secret goes in the repo: keys live in Supabase, EAS or
your local `.env.local`.

## 1. Supabase (backend)

1. Create a project at supabase.com (free tier is fine to start).
2. On your Mac, from the repo root:
   ```bash
   brew install supabase/tap/supabase
   supabase login
   supabase link --project-ref <your-project-ref>
   supabase db push            # runs supabase/migrations
   ```
3. In the dashboard SQL editor, add the two secrets the minute job uses to send pushes:
   ```sql
   select vault.create_secret('https://<project-ref>.supabase.co', 'project_url');
   select vault.create_secret('<service role key>', 'service_role_key');
   ```
   Then confirm Database > Extensions shows `pg_cron` and `pg_net` on. If the cron
   migration ran before they were on, run `supabase/migrations/20261112000006_cron.sql` again.
4. Deploy the push sender: `supabase functions deploy push-dispatch --no-verify-jwt`.
5. Load the stores, spots and state/country shapes (first time with `--regions`):
   ```bash
   python3 pipeline/fff_data.py sql --regions > /tmp/load.sql
   psql "<database connection string>" -v ON_ERROR_STOP=1 -f /tmp/load.sql
   ```
   Re-run without `--regions` after each monthly data refresh (or add it to the
   monthly workflow with a `SUPABASE_DB_URL` repository secret).
6. Copy the project URL and anon key into `mobile/.env.local` (see `mobile/.env.example`).

## 2. Email sign-in (magic link / code)

Supabase's built-in email is rate limited to a few per hour. Add a sender
(Resend is simplest): Authentication > SMTP settings. In Authentication > Email
templates, include `{{ .Token }}` so people can type the 6-digit code.
Add `farfromfries://auth-callback` to Authentication > URL configuration > Redirect URLs.

## 3. Apple (needed for TestFlight and the App Store)

1. Apple Developer Program ($99/year).
2. Register the bundle id `app.farfromfries` (or pick another and change `mobile/app.json`)
   with Sign in with Apple, Push Notifications and Associated Domains.
3. Supabase > Authentication > Providers > Apple: turn on and add the bundle id as a client id.
4. Put your Team ID into `web/.well-known/apple-app-site-association` (replace `TEAMID`).

## 4. Google sign-in (optional)

Create an OAuth "Web application" client in Google Cloud and add it in Supabase >
Authentication > Providers > Google, with the redirect URL Supabase shows.
Skip it for launch if you like: Apple and email cover iPhone users.

## 5. Expo / EAS (builds)

```bash
npm install -g eas-cli
cd mobile
eas login
eas init                    # adds the project id that push notifications need
eas build --profile development --platform ios   # dev build on your phone
eas build --platform ios && eas submit --platform ios   # TestFlight
```
EAS handles the push key with Apple for you during the first build.

## 6. Website (invite links, privacy page)

`web/` is a static site. Deploy it on Vercel (or any static host) at your
domain. `farfromfries.app` is a placeholder used in `mobile/app.json`
(associated domains), `mobile/src/lib/config.ts` (EXPO_PUBLIC_WEB_URL) and
`web/`. Change all three if you pick another domain.

## Decisions still open

- Name and domain: "Far From Fries" and farfromfries.app are placeholders.
- Seasons: built as meteorological seasons (Mar 1, Jun 1, Sep 1, Dec 1) on Pacific time.
- Passport distances outside the US, Canada and Mexico need worldwide store data;
  today they measure to the nearest North American store, which is wrong abroad.
- Privacy page draft in `web/privacy.html` needs a contact address and a read-through.
