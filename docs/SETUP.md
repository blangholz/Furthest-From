# McFarthest: setup checklist

Everything here needs an account or a decision from Benjamin. The code is ready
for each step. Nothing secret goes in the repo: keys live in Supabase, EAS or
your local `.env.local`.

## 1. Supabase (backend)

McFarthest goes into the existing project "blangholz's project", next to
your other apps. It keeps to its own two schemas, `fff` (tables and the
functions the app calls) and `fff_private` (internals), and never changes
anything in `public`. What it does share is the sign-in list: someone who
already signed in to another of your apps there can sign in to this one with
the same account. A player's McFarthest profile is only made when they
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

Done (Nov 2026): the shared Magic Link template and subject now branch on the
redirect. `{{ if eq .RedirectTo "farfromfries://auth-callback" }}` sends the
McFarthest email (`supabase/templates/mcfarthest_magic_link.html`: the 6-digit
code plus a `{{ .ConfirmationURL }}` button that goes through Supabase and back
into the app with `?code=`), and `{{ else }}` sends PackUpGear's original email
unchanged. To edit it, PATCH `mailer_templates_magic_link_content` and
`mailer_subjects_magic_link` through the Management API (`/v1/projects/<ref>/config/auth`)
and keep both branches. Changes can take up to 10 minutes to show up, because
the auth server caches templates. The sender name and address (PackUp,
auth@packupgear.com) are set once for the whole project, so they can't
change per app.

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

Build settings are in `mobile/eas.json` (development, preview, production).

1. Done: the expo.dev project `far-from-fries` (owner `blangholzs-team`) is set
   in `mobile/app.json`.
2. Project settings > GitHub: link `blangholz/Furthest-From` with base directory
   `mobile`, so builds can run from the repo without your Mac.
3. Project > Environment variables: add `EXPO_PUBLIC_SUPABASE_URL` and
   `EXPO_PUBLIC_SUPABASE_ANON_KEY` (plain text is fine; both are public values).
   Builds without them run in demo mode.
4. iOS builds need the Apple Developer membership (step 3). The first build
   asks to sign in to Apple once and sets up the certificates and push key.
5. Build a development build for your phone (`eas build --profile development --platform ios`
   or from the expo.dev site), then later `production` and `eas submit` for TestFlight.

## 6. Website (invite links, privacy page)

`web/` is a static site. Deploy it on Vercel (or any static host) at your
domain. `farfromfries.app` is a placeholder used in `mobile/app.json`
(associated domains), `mobile/src/lib/config.ts` (EXPO_PUBLIC_WEB_URL) and
`web/`. Change all three if you pick another domain.

## Decisions still open

- Name: McFarthest (Decision #25), pending an App Store and trademark check.
- Domain: farfromfries.app is a placeholder; bundle id `app.farfromfries` and scheme `farfromfries` still use the old name.
- Seasons: built as meteorological seasons (Mar 1, Jun 1, Sep 1, Dec 1) on Pacific time.
- Passport distances outside the US, Canada and Mexico need worldwide store data;
  today they measure to the nearest North American store, which is wrong abroad.
- Privacy page draft in `web/privacy.html` needs a contact address and a read-through.
- TODO: sign-in email sender and template. Emails still come from
  "PackUp <auth@packupgear.com>", because the shared Supabase project allows one
  sender. Before launch, either move McFarthest to its own Supabase project (own
  sender on a verified McFarthest domain in Resend, own site_url, own template)
  or pick a sender name that suits both apps. Then redo the McFarthest template
  (`supabase/templates/mcfarthest_magic_link.html`) with final branding and
  domain, and drop the `{{ if .RedirectTo }}` branch if it moves projects.
