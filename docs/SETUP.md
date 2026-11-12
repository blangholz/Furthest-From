# Far From Fries: setup checklist

Everything here needs an account or a decision from Benjamin. The code is ready
for each step. Nothing secret goes in the repo: keys live in Supabase, EAS or
your local `.env.local`.

## 1. Supabase (backend)

Far From Fries goes into the existing project "blangholz's project", next to
your other apps. It keeps to its own two schemas, `fff` (tables and the
functions the app calls) and `fff_private` (internals), and never changes
anything in `public`. What it does share is the sign-in list: someone who
already signed in to another of your apps there can sign in to this one with
the same account. A player's Far From Fries profile is only made when they
open this app, and "Delete account" removes their game data but leaves the
shared sign-in.

1. Take a backup first (Database > Backups), since other apps live here.
2. Settings > API > Exposed schemas: add `fff`.
3. Run the migrations. From the repo root on your Mac, with the project's
   database connection string (Settings > Database, "Session pooler"):
   ```bash
   for f in supabase/migrations/*.sql; do psql "<connection string>" -v ON_ERROR_STOP=1 -f "$f" || break; done
   ```
   This skips `supabase db push`, which would trip over your other apps'
   migration history in the same project.
4. In the SQL editor, add the two secrets the minute job uses to send pushes:
   ```sql
   select vault.create_secret('https://<project-ref>.supabase.co', 'fff_project_url');
   select vault.create_secret('<service role key>', 'fff_service_role_key');
   ```
   Then check Database > Extensions shows `pg_cron` and `pg_net` on. If they
   weren't on when step 3 ran, run `supabase/migrations/20261112000006_cron.sql` again.
5. Deploy the push sender (`brew install supabase/tap/supabase`, `supabase login`,
   `supabase link --project-ref <project-ref>`):
   `supabase functions deploy push-dispatch --no-verify-jwt`.
6. Load the stores, spots and state/country shapes (first time with `--regions`):
   ```bash
   python3 pipeline/fff_data.py sql --regions > /tmp/load.sql
   psql "<connection string>" -v ON_ERROR_STOP=1 -f /tmp/load.sql
   ```
   Re-run without `--regions` after each monthly data refresh.
7. Copy the project URL and anon (publishable) key into `mobile/.env.local`
   (see `mobile/.env.example`).

Shared settings to check: Authentication > URL configuration and the email
templates are shared with your other apps. Add `farfromfries://auth-callback`
to the redirect list rather than replacing what's there.

## 2. Email sign-in (magic link / code)

Supabase's built-in email is rate limited to a few per hour. Your shared
project may already send through Resend (Authentication > SMTP settings); if
not, add it there. The app also accepts the 6-digit code from the email, which
needs `{{ .Token }}` in the Magic Link template. That template is shared with
your other apps, so add the code line without removing anything they rely on.

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
