# Far From Fries: iPhone app

Expo (SDK 58) app with expo-router. Backend is Supabase (see `../supabase`).

## Try it now (demo mode)

No accounts needed. With no Supabase settings the app runs fully on the phone
with three sample friends.

```bash
cd mobile
npm install
npx expo start
```

Scan the QR code with the Camera app and open it in Expo Go. Sign in with
"Try the demo". On the Me tab, "Open a practice ping now" starts a ping so you
can log a distance.

## Connect to Supabase

Copy `.env.example` to `.env.local` and fill in the project URL and anon key.
See `../docs/SETUP.md` for the whole checklist (Supabase, Apple, Google, Expo/EAS).

## Layout

- `src/app`: screens (expo-router). `(tabs)` is the main tab bar: Distance,
  Friends, Leaderboard, Extremes, Me. `onboarding/[step]` is the first-run flow.
- `src/lib`: geometry and game rules (`geo.ts`, `rules.ts`, with tests), the API
  (`api/` has a Supabase version and a demo version with the same interface),
  sign-in, location, notifications, offline queue.
- `src/ui`: theme and small components.
- `assets/data`: bundled store list and spots, written by
  `python3 pipeline/fff_data.py app-data` from the repo's monthly data.

## Checks

```bash
npx tsc --noEmit
npx jest
```

Note: `npx expo install` and docs.expo.dev were unreachable from the build
machine, so packages were added with `npm install` at the versions in
`node_modules/expo/bundledNativeModules.json`. Run `npx expo install --check`
on your Mac to confirm.
