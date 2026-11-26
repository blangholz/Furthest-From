# McFarthest

A social iOS game (Android later): players get a daily ping and score miles, as the crow flies, from the nearest McDonald's. It rewards exploring.

## Stack
- Expo (React Native), Expo Router, react-native-maps (Apple Maps)
- Supabase: Auth, Postgres + PostGIS, pg_cron, Edge Functions
- Resend for email, Expo push for notifications, Vercel for web and invite links
- Python `pipeline/` for store import and State Extremes

## Key constraints (never violate)
- Never store or expose exact ping coordinates. Score via one DB function, then discard.
- Friends never see location, only distance. No friends on any map.
- Location permission: While Using the App only. No background tracking.
- Keep the code Android-ready: no iOS-only APIs without a cross-platform path.
- Missed pings score zero, never a penalty. Scores lock at log time.
- Distances are straight-line only.
- Display name is McFarthest (#25, App Store and trademark check pending before launch). Always show the "not affiliated with McDonald's" note.
- Visual style: Field Notes meets a summit register. Bold uppercase sans (except the lowercase "c" in McFarthest), thin ruled lines, boxed form fields, sharp corners (no rounding), sections as thin-stroked outline boxes with a margin (no background fills), #EED202 background with dark ink, flat print look (Decision #27).

## Game rules
- Daily ping at 1:20 PM in each player's phone time zone, 1-hour window (#30). Testers can open test pings in dev builds (#35).
- 1 mile = 1 point. Lower 48 only scores; elsewhere = Passport stamp.
- Home zone 5 miles: scores zero, pauses streak, earns no Extra Fries.
- Extra Fries: 1 per 7 qualifying pings, double at 12+ streak, expire after 2 weeks.
- Seasons start Mar 1, Jun 1, Sep 1, Dec 1 Pacific (#31). First release: one global board, no friends (#26).
- State Extremes and Top 100 Spots (#32): claim within 150 ft, once each, points move with monthly data.
- Sign-in: email magic link, Apple, Google.

## Onboarding
Onboarding (sign-in, home pin, permissions, adding friends) gets a dedicated wireframe and iteration pass using Benjamin's wireframe process. Keep these screens easy to rearrange; don't lock in the flow early.

## Decided, do not re-litigate
See `Spec/Far From Fries - 02 Decisions Log.md`. Rules as built: `docs/GAME_RULES.md`. Data: AllThePlaces, monthly refresh. State Extremes: grid method.
