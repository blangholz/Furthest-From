# Furthest-From repo

Two things live here:

1. **The original test page and data** (root `index.html`, `data/`, `points/`,
   `scripts/`, `.github/workflows/monthly-data.yml`). GitHub Pages serves
   `index.html`. A monthly job refreshes the McDonald's list and furthest points.
2. **McFarthest, the app** (`mobile/`, `supabase/`, `pipeline/`, `web/`, `docs/`).

## App pieces
- `supabase/migrations`: Postgres + PostGIS schema, game logic as SQL functions,
  RLS. Everything lives in schemas `fff` and `fff_private` because the Supabase
  project is shared with other apps: never touch `public` or add triggers on `auth.users`. Clients only call the RPCs granted in `20261112000005_security.sql`.
  Exact coordinates go into `public.submit_log` and are never stored.
- `supabase/tests`: pgTAP tests. Run with a local Postgres 16 + PostGIS + pg_cron + pgTAP:
  `su postgres -c "bash supabase/tests/run_local.sh"`.
- `supabase/functions/push-dispatch`: sends the push outbox via Expo.
- `mobile/`: Expo SDK 58 app. `npx tsc --noEmit` and `npx jest` in `mobile/`.
  With no `EXPO_PUBLIC_SUPABASE_URL` it runs in demo mode.
- `pipeline/fff_data.py`: builds the app's bundled data and the Supabase data load
  from `data/atp` and `points/public`.
- `web/`: static site for invite links and the privacy page.

Rules: `docs/GAME_RULES.md`. Accounts and keys: `docs/SETUP.md`.
Never commit keys. Keep root `index.html` working.

Visual style (Decision #27 in `Spec/`): Field Notes meets a summit register. Bold uppercase sans
(except the lowercase "c" in McFarthest), thin ruled lines, boxed form fields, #EED202
background with dark ink, flat print look. Sharp corners, never rounded.
Sections are thin-stroked outline boxes with a margin, never a background fill. No gradients or soft shadows.
Reference: direction A on the design canvas https://claude.ai/artifact/PBTz9CKozTxYmiiYRwKmn8.
Shared pieces live in `mobile/src/ui/kit.tsx` (Card with label, Rows, Button, IconButton) and
`mobile/src/ui/TickGrid.tsx`. One screen (Home) plus Me behind a person icon (#40).

Bug reports from the phone (Decision #42): testers shake to report (DEV on Me). Reports land in
`fff.bug_reports` + bucket `fff-bug-reports`. A SessionStart hook runs `node scripts/bug-reports.mjs --hook`;
when it lists reports, Read each screenshot, ask Ben your questions, then `--mark seen <ids>` (later `--mark fixed`).
Keep a live watcher running during sessions: Monitor `node scripts/bug-reports.mjs --watch` (30 min, re-arm).
The script needs `SUPABASE_SERVICE_ROLE_KEY` in the gitignored `.env.local`.
