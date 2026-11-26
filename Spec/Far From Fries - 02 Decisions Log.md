---
title: "Far From Fries: Decisions Log"
type: project-doc
stage: decisions-log
status: active
project: "Far From Fries"
date: 2026-11-08
updated: 2026-11-10
tags:
  - pdk/decisions
  - far-from-fries
aliases:
  - "Far From Fries Decisions"
---

# Far From Fries: Decisions Log
*Started 2026-11-08 · Last updated 2026-11-10*

> [!abstract] How to Use
> Every significant decision across all stages. **This is a constraint document:** these things are already decided, don't re-litigate them.

> [!info] Decision Statuses
> `decided` · `deferred` · `open` · `superseded`

---

## Confirmed Decisions Summary

| # | Topic | Decision |
|---|-------|----------|
| 1 | Form factor | iOS first, cross-platform codebase; Android readiness is a standing constraint |
| 2 | Geography | Only lower-48 pings score; elsewhere = Passport stamp with distance |
| 3 | Social model | ~~Friend graph, unlimited mutual friends, no groups~~ deferred by #26 |
| 4 | Ping timing | ~~One national ping daily, random 10 AM to 6 PM Pacific, 1-hour window~~ superseded by #30 |
| 5 | Global leaderboard | ~~Shows overall rank; 3+ friends required to appear~~ superseded by #26 |
| 6 | Home zone | 5-mile radius; home pin locked per season |
| 7 | Extra Fries | 1 per 7 qualifying pings; double at 12+ streak; expire after 2 weeks |
| 8 | Qualifying ping | Outside home zone. Home check-in pauses streak; miss breaks it |
| 9 | Score permanence | Scores lock at log time, never rescored |
| 10 | Data source | AllThePlaces, refreshed monthly |
| 11 | Scoring | 1 mile = 1 point, decimals, straight-line |
| 12 | Seasons | Calendar seasons with reset, plus all-time board |
| 13 | Privacy | Friends see distance only, never location; exact GPS discarded after scoring |
| 14 | Home map | Personal: you plus McDonald's within about 25 miles |
| 15 | Anti-cheat | ~~Social trust; no build effort beyond the 3-friend rule~~ superseded by #26 |
| 16 | State Extremes | Per-state tick list, claim within 150 ft, once per state, reachable public land only |
| 17 | State Extremes updates | Points move with monthly data; earned ticks are permanent |
| 18 | Missing McDonald's submissions | Phase 2 |
| 19 | Name | ~~Far From Fries (working name)~~ superseded by #25 |
| 20 | App stack | React Native with Expo |
| 21 | Backend | Supabase, Vercel, Resend, Expo push, Apple Maps |
| 22 | State Extremes method | Grid method; exact Voronoi only if too slow |
| 23 | Sign-in | Email magic link, Sign in with Apple, Google |
| 24 | Location permission | While Using the App only |
| 25 | Name | McFarthest (replaces Far From Fries) |
| 26 | Launch social scope | Global leaderboard only; friends come later |
| 27 | Visual style | Field Notes meets a summit register: bold uppercase, ruled lines, sharp corners, #EED202 background |
| 28 | Friend suggestions | Optional verified phone, nudged, for contact matching; sign-in unchanged |
| 29 | Onboarding permissions | Location required to play; notifications pushed hard but skippable; iOS look-alike primer before each prompt; name only, no username until friends |
| 30 | Ping timing | 1:20 PM in each player's phone time zone, 1-hour window (supersedes #4) |
| 31 | Season boundaries | Mar 1, Jun 1, Sep 1, Dec 1, Pacific |
| 32 | Top 100 Spots | 100 furthest lower-48 spots, 50 mi apart, public land, claim within 150 ft |
| 33 | Late uploads | In-window logs can upload up to 24 hours later |
| 34 | Supabase project | Shared project, schemas fff / fff_private only |
| 35 | Test pings | Testers can open a ping 5 s out in dev builds; no streak effect |
| 36 | Typefaces | DIN Condensed (headings, buttons, labels) and DIN Alternate (body, numbers), all caps everywhere; typed text stays as typed |
| 37 | Player-facing name | "Check-in" everywhere players read it; code keeps ping/log |
| 38 | Friend alerts | When friends ship: push when a friend passes you, and when a friend has an exceptional check-in for them |
| 42 | Tester feedback | Shake to report (testers): screenshot, draw, note, upload to Supabase; Claude pulls them each session |

---

## Full Decision Log

**Decision #1**
Topic: Form factor
Question: Native app, web app, or other?
Decision: Native iOS app first, built cross-platform so Android is cheap to add later.
Rationale: The core loop (push at a random time, read location on open) is best native. Friends are mostly on iPhone. Android readiness must be held throughout development.
Status: `decided`
Phase decided: Define

**Decision #2**
Topic: Geography
Question: US only, or anywhere?
Decision: Only lower-48 pings score on leaderboards. Pings elsewhere (Alaska, Hawaii, abroad) become Passport stamps that still show distance (e.g. "Iceland, 512 miles"), count toward streaks, and earn Extra Fries progress.
Rationale: International McDonald's coverage is uneven; one trip would win a season. Still worth celebrating as exploring.
Status: `decided`
Phase decided: Define

**Decision #3**
Topic: Social model
Question: Group size, joining, multiple groups?
Decision: A friend graph, not groups. Unlimited mutual friends; each player's leaderboard compares them with their friends.
Rationale: Simpler; no groups to create or manage.
Status: `superseded` by #26 (deferred to after launch, still the plan for friends)
Phase decided: Define

**Decision #4**
Topic: Ping timing
Question: Per-group or global ping, and when?
Decision: One national ping for all users at a random time between about 10 AM and 6 PM Pacific, with a 1-hour window.
Rationale: Keeps the shared moment without groups. Lower 48 spans 3 hours, so nobody is pinged at night.
Status: `decided`
Phase decided: Define

**Decision #5**
Topic: Global leaderboard
Question: Should there be one, and how to limit cheating?
Decision: Yes, showing overall rank. Players need at least 3 friends to appear. Cheating otherwise accepted as a risk.
Rationale: Light self-policing without building anti-cheat.
Status: `superseded` by #26
Phase decided: Define

**Decision #6**
Topic: Home zone
Question: How to stop remote-living players from winning by staying home?
Decision: Each player sets a home pin; logs within 5 miles score zero. The pin locks for the season.
Rationale: The game rewards exploring, not where you live.
Status: `decided`
Phase decided: Define

**Decision #7**
Topic: Extra Fries (bonus logs)
Question: How are bonus logs earned, named and limited?
Decision: Named Extra Fries. Earn 1 per 7 qualifying pings; at a 12-day streak, each ping counts double toward the next. Each expires 2 weeks after earning. Nothing scales beyond that.
Rationale: Rewards consistency; use-it-or-lose-it fits a season.
Status: `decided`
Phase decided: Define
Note: supersedes the Explore-stage "10 pings per bonus."

**Decision #8**
Topic: Qualifying ping
Question: Does a home-zone check-in count?
Decision: A qualifying ping is outside the home zone. A home-zone check-in pauses the streak (doesn't break it), earns no Extra Fries, and goes into a Home log. Missing a ping scores zero and breaks the streak.
Rationale: Pings test whether you're out exploring; pausing keeps a normal workweek from killing every streak.
Status: `decided`
Phase decided: Define

**Decision #9**
Topic: Score permanence
Question: Rescore old pings when McDonald's open or close?
Decision: No. Each score locks at the moment it was logged.
Status: `decided`
Phase decided: Define

**Decision #10**
Topic: McDonald's location data
Question: Where does the data come from and how is it kept current?
Decision: AllThePlaces, refreshed monthly (not weekly). Import US, Canada and Mexico so border distances are correct.
Rationale: Decided in a separate research thread.
Status: `decided`
Phase decided: Architect

**Decision #11**
Topic: Scoring
Decision: 1 mile = 1 point, decimals allowed, straight-line distance. Possible fries or burgers rebrand later.
Status: `decided`
Phase decided: Explore

**Decision #12**
Topic: Seasons
Decision: Calendar seasons (summer, fall, winter, spring), each resetting at its boundary, plus an all-time leaderboard.
Status: `decided`
Phase decided: Specify

**Decision #13**
Topic: Privacy
Decision: Friends never see location, only distance. Exact GPS is used once to compute the score and region (state or country), then discarded.
Rationale: The game is about the distance novelty; people who won't share location can still play. Location sharing is left to apps like Find My.
Status: `decided`
Phase decided: Define
Note: supersedes the Explore-stage fuzzy map and the interim 5-mile blur.

**Decision #14**
Topic: Home map
Decision: The map is personal: your exact position plus McDonald's within about 25 miles. Friends appear only as distances in the feed and leaderboards. A big live distance readout leads the home screen.
Status: `decided`
Phase decided: Define

**Decision #15**
Topic: Anti-cheat
Decision: Social trust among friends; the home pin is locked per season; no further anti-cheat.
Status: `superseded` by #26
Phase decided: Explore

**Decision #16**
Topic: State Extremes
Decision: A tick list of the furthest reachable point from any McDonald's in each state, plus a national point. Claim within 150 ft, any time, without a ping or Extra Fries. Once per player per state. Awards a profile tick and achievement plus that spot's distance as a normal log; broadcast to all friends. Points are computed in-house over legally accessible public land only.
Status: `decided`
Phase decided: Specify

**Decision #17**
Topic: State Extremes updates
Decision: Points move with the monthly data refresh. Earned ticks stay permanently; anyone who hasn't claimed a state chases its current point.
Status: `decided`
Phase decided: Architect

**Decision #18**
Topic: User-submitted McDonald's
Decision: Removed from MVP; phase 2.
Status: `deferred`
Phase decided: Define

**Decision #19**
Topic: Name
Decision: Far From Fries is the working name, replacing "Furthest From." Final confirmation and an App Store and trademark check come before branding work.
Status: `superseded` by #25
Phase decided: Specify

**Decision #20**
Topic: App stack
Decision: React Native with Expo. One codebase, iOS first.
Status: `decided`
Phase decided: Architect

**Decision #21**
Topic: Backend and services
Decision: Supabase (Auth, Postgres with PostGIS, pg_cron, Edge Functions), Vercel (landing page, invite links), Resend (email), Expo push, react-native-maps with Apple Maps.
Rationale: Matches Benjamin's standard stack from past projects.
Status: `decided`
Phase decided: Architect

**Decision #22**
Topic: State Extremes computation
Decision: Grid method (about 100 m, then local refinement). Switch to the exact Voronoi method only if the grid is too slow.
Status: `decided`
Phase decided: Architect

**Decision #23**
Topic: Sign-in
Decision: Email magic link, Sign in with Apple, and Google from day one.
Rationale: Apple sign-in is expected on iOS; Google prepares for Android.
Status: `decided`
Phase decided: Architect

**Decision #24**
Topic: Location permission
Decision: "While Using the App" only. No background tracking.
Status: `decided`
Phase decided: Architect

**Decision #25**
Topic: Name
Decision: McFarthest replaces Far From Fries as the app's display name (2026-11-25). Bundle id, URL scheme, Expo slug, domain and the `fff` schemas keep their old identifiers for now. App Store and trademark check still pending (deferred item C).
Status: `decided`
Phase decided: Build

**Decision #26**
Topic: Launch social scope
Question: Ship friends in the first build?
Decision: No. The first release has one global leaderboard (season and all time) and no friend list, feed, friend requests or friend invites (2026-11-25). Every player who has scored in the period appears; there is no friend minimum. The share button shares a plain link to the app. Friend-log and State Extreme notifications are not sent, since nobody has friends. Players see each other's name, points and log count on the board, never locations.
Rationale: Smaller first build; friends are added later. Cheating on the global board is accepted as a risk until then (the home pin lock is the only guard).
Implementation: `features.friends` in `mobile/src/lib/config.ts` hides every friends surface. Friendship tables, RPCs, invite links and screens stay in place. Migration `20261125000001_global_board_only.sql` sets `global_min_friends` to 0 and limits the global board to players who have scored. To bring friends back: flip the flag, set `global_min_friends` back to 3 if wanted, and restore the friend copy on the web pages.
Status: `decided`
Phase decided: Build

**Decision #27**
Topic: Visual style
Question: What should the app look like?
Decision: Field Notes memo book meets a summit register (2026-11-25). Bold, condensed, all-uppercase sans headings and labels (the one exception: the lowercase "c" in McFarthest). Thin rules and boxed fields like a printed log form: dotted or hairline lines for entries, labeled blanks ("PERTINENT COORDINATES", "DISTANCE"). Background color #EED202 (a bold yellow, like a field-book cover) with dark ink, flat and printed, not glossy: sharp square corners everywhere (no rounded corners), sections (leaderboard, cards) are thin ink-stroked rectangles with a margin around them, never a different fill color; the page stays one flat #EED202 (reference: a thin white box framing "HOOD RIVER, OREGON / 45.7067° N, 121.5220° W" over a photo), no gradients or soft shadows. Logs read like signing a summit register: name, date, distance in a ruled row.
References: (1) Field Notes memo books: kraft cover, bold condensed caps, ruled form fields. (2) A thin white outline box framing "HOOD RIVER, OREGON / 45.7067° N, 121.5220° W" in monospace over a photo. (3) A clean fintech screen (2026-11-26): monospace throughout, lots of white space, one bold headline, a short bold lead line, muted gray body text, label-and-value rows split by hairline dividers, one solid black primary button, one graphic as the only decoration. Take its restraint, monospace and label/value rows; keep our uppercase and sharp corners over its lowercase and pill-shaped button.
Direction (2026-11-26): Ben compared three directions on the Claude Design canvas "McFarthest Field Notes" (https://claude.ai/artifact/PBTz9CKozTxYmiiYRwKmn8) and chose **A · Field Notes**: condensed caps, solid hairlines, every section a 1pt ink box with a small caps label, label/value rows split by thin rules, one solid ink button per screen, the coordinates box from reference (2). Rows B (all monospace) and C (mixed) were not chosen. Stamped ticks (#39) are the one other filled shape. On satellite maps, pins and circles use the #EED202 yellow, since ink disappears there.
Rationale: Fits the outdoorsy, go-explore spirit of the game and gives it a distinct, printed look.
Status: `decided`
Phase decided: Build

---

**Decision #28**
Topic: Friend suggestions
Question: Do we need phone-number sign-in to suggest friends once the friend graph ships?
Decision: No (2026-11-26). Sign-in stays as #23. When friends ship, onboarding asks for an optional, verified phone number with a strong "let friends find you" nudge (skippable). Store a hashed E.164 number; match it against hashed contacts the user chooses to share. Also suggest friends-of-friends and invite-tree connections. Invite links and username search remain the primary way to add friends.
Rationale: Contact matching is the only way to suggest friends before someone has any, and it needs phone numbers, since Apple sign-in often hides real emails. Collecting the number separately from sign-in gets that without switching auth on the shared Supabase project or forcing SMS on everyone. Requiring it was rejected because of the signup drop-off and SMS compliance load.
Status: `decided`
Phase decided: Build

**Decision #29**
Topic: Onboarding permissions and profile
Question: How hard does onboarding push location and notifications, and what does it ask for?
Decision: (2026-11-26) Location is presented as required: without it there's no score, so onboarding can't continue until it's granted (denied players get an Open Settings button and the step advances when they return with it on). Notifications are framed as needed to play, with a small grey "Not now" escape. Before each iOS prompt, a look-alike of the system alert appears in the same spot with the right button highlighted ("Allow While Using App" / "Allow"); one tap opens the real prompt on top of it. The preview carries an "iOS will ask next" caption and the primer buttons say "Continue", to stay clear of App Review's rule against primers that impersonate or pre-empt the system prompt. Onboarding asks for a display name only; the username field returns when friends ship (#26). The home step adds address search, so players signing up away from home can set it.
Rationale: The game can't run without location, and a missed ping scores zero, so both permissions decide whether the app works at all. The primer gets players onto the right button in the iOS alert. Usernames only exist so friends can find each other.
Status: `decided`
Phase decided: Build

**Decision #30**
Topic: Ping timing (as built)
Question: When does the daily ping fire?
Decision: (recorded 2026-11-26) 1:20 PM in each player's current phone time zone, open for 1 hour. Travelers follow their phone's time zone. Stored as `fff.game_settings.ping_local_time`, so it can change without code.
Rationale: Built this way during the first build (Nov 12) and never logged. A fixed local time is predictable and never lands at night in any time zone; the shared "everyone at once" moment of #4 is traded for simplicity.
Status: `decided`
Phase decided: Build
Note: supersedes #4 (random national time 10 AM to 6 PM Pacific). Revisit if the synchronized moment turns out to matter.

**Decision #31**
Topic: Season boundaries (as built)
Decision: (recorded 2026-11-26) Meteorological seasons starting Mar 1, Jun 1, Sep 1 and Dec 1 at midnight Pacific. Rows are created ahead of time by an hourly job.
Rationale: Clarifies #12's "calendar seasons" with exact, simple boundaries.
Status: `decided`
Phase decided: Build

**Decision #32**
Topic: Top 100 Spots
Decision: (recorded 2026-11-26) Alongside State Extremes, a list of the 100 furthest points in the lower 48 from any McDonald's, at least 50 miles apart, on open-access public land. Same 150 ft claim, once each, permanent. On the monthly refresh, spots that move less than 2 miles keep their identity.
Rationale: Added in the first build; gives more reachable goals than one point per state.
Status: `decided`
Phase decided: Build
Note: extends #16 and #17.

**Decision #33**
Topic: Late uploads
Decision: (recorded 2026-11-26) A log taken inside the ping window can upload up to 24 hours later (offline queue). Scores still lock at the moment the log was taken.
Rationale: Exploring often means no signal; the Functional Spec (10.1) says an in-window log must never be lost.
Status: `decided`
Phase decided: Build

**Decision #34**
Topic: Supabase project
Decision: (recorded 2026-11-26) The app lives in the existing shared Supabase project ("blangholz's Project", also used by pack), confined to schemas `fff` and `fff_private`. It never touches `public` and never adds triggers on `auth.users`. Sign-in accounts, auth email templates and SMTP settings are shared with the other apps. Migrations are applied with `supabase db query --linked`, never `db push` or `config push`.
Rationale: Reuses the existing project and Resend setup. The cost is a shared sign-in list and shared auth email branding (see SETUP open items).
Status: `decided`
Phase decided: Build
Note: refines #21.

**Decision #35**
Topic: Test pings
Decision: (2026-11-26) Testers (`fff.profiles.is_tester`) can open a ping 5 seconds out from a Testing card on the Me tab, shown only in development builds. Test pings score like normal logs but never count toward streaks and don't block the day's real ping.
Rationale: Lets the check-in flow be tested any time without waiting for 1:20 PM.
Status: `decided`
Phase decided: Build

**Decision #36**
Topic: Typefaces
Question: Which fonts carry the #27 look?
Decision: (2026-11-26) DIN Condensed for titles, headings, buttons, tab labels and nav headers; DIN Alternate for body text and numbers, including the big distance readout. All app-written text is uppercase, body included (this extends #27, which only required caps for headings and labels). The lowercase "c" stays in McFarthest and McDonald's (McFARTHEST, McDONALD'S). Text people type in fields is not forced to caps. Both faces ship with iOS, so nothing is bundled or licensed; Android falls back to Roboto Condensed / Roboto medium. The look-alike iOS permission alert (#29) keeps the system font so it matches the real alert.
Rationale: Road-sign DIN fits the field-book, summit-register look and comes free on iOS.
Status: `decided`
Phase decided: Build

---

**Decision #37**
Topic: Player-facing name for the daily moment
Question: The app mixed "ping", "log" and "check-in" for the same thing. Which word do players see?
Decision: (2026-11-26) **Check-in**, everywhere players read it: app, push notifications, web pages, docs. "Check in" is the verb ("You have an hour to check in"), "check-in" the noun. Home check-ins and Passport stamps stay as the names for those zones. Code and database keep `ping` (the daily window) and `log` (a submission); renaming tables and RPCs isn't worth the migration risk. Home also shows a live countdown in big clock digits: "Next check-in in HH:MM:SS" while closed, "You have MM:SS to check in" while open.
Rationale: One word is easier to learn. "Check-in" already fit the summit-register theme and was in use for home check-ins.
Status: `decided`
Phase decided: Build

---

**Decision #38**
Topic: Friend alerts (ships with friends, #3 / #26)
Question: Beyond "Benjamin is 63.2 miles from the nearest McDonald's", which friend events earn a push?
Decision: (2026-11-26) Two more alerts once the friend graph exists:
1. **Passed you.** When a friend's check-in moves them above you on your friends season board, you get a push naming them: "SAM JUST PASSED YOU. YOU'RE NOW IN 4TH PLACE." Only the passed player is notified. At most one passed alert per friend per day. If several friends pass you around the same time, they batch into one push ("SAM AND JO PASSED YOU").
2. **Exceptional check-in.** When a friend scores far above their own normal, all their friends get a push: "SAM IS 20.4 MILES OUT." The baseline is the median of their last 20 scored check-ins, and needs at least 7 to exist. A check-in is exceptional when it is at least 3× that median and at least 10 miles above it. Example: median 2.5 mi, so the bar is 12.5 mi and a 20 mi check-in qualifies. Home check-ins and test pings (#35) never count toward the baseline or trigger it. An exceptional alert replaces the plain friend-log notification for that check-in, so friends get one push, not two.
Both multipliers live in `fff.game_settings` so they can be tuned from real data without a migration. Both alerts go through the existing push outbox (`push-dispatch`) and each gets its own toggle in notification settings.
Rationale: Rank changes and personal outliers are the moments that make friends react. Comparing a player against their own history means a homebody's big day counts as much as a road-tripper's.
Status: `decided` (builds with friends, after launch)
Phase decided: Build

**Decision #39**
Topic: Ticks
Question: What do players call State Extremes and Top 100 Spots, and where do they live?
Decision: (2026-11-26) **Ticks**, as in a climber's tick list. A state's furthest point is a tick; the Top 100 are "Top 100" ticks. "Claim" becomes "tick it". Ticks live inside Me (#40): a grid of the 50 states plus DC (7 across, ticked squares stamped solid ink, tap one to open it), the nearest unticked state, a Top 100 count, and a full list screen. Code and database keep `extreme`, `spots` and `kind: 'state' | 'top100'`.
Rationale: Shorter, and matches the outdoors and summit-register feel. Ben's call on the design canvas.
Status: `decided`
Phase decided: Build
Note: renames #16 and #32 for players; their rules don't change. #16's "national point" never shipped; the data has 51 state points.

**Decision #40**
Topic: Navigation
Question: Keep the bottom tab bar (Distance, Extremes, Me)?
Decision: (2026-11-26) No. The app is one screen, Home, with a person icon top right that opens Me. Ticks (#39), Extra Fries, Passport, home check-ins, home pin and account all live in Me. The Friends feed, when friends return (#26), is a row in Me. Home, top to bottom: wordmark and person icon; miles from the nearest McDonald's with that store's town and coordinates (#41); the radar; "You are here · only you see this" with your own coordinates; today's check-in as label/value rows with the Check in button; the result as a register entry (Signed, date, time, place, distance, points, streak); the season leaderboard.
Rationale: Players do one thing daily, so it belongs on one screen. Ben's call on the design canvas.
Status: `decided`
Phase decided: Build
Note: supersedes the tab labels mentioned in #36. The leaderboard stays season-only for now (the canvas's All-time toggle wasn't built).

**Decision #41**
Topic: Naming the nearest McDonald's
Question: Home shows the nearest store's town ("Nearest: Hines, OR"). Where does the name come from?
Decision: (2026-11-26) From the bundled store list: `pipeline/fff_data.py app-data` now writes a `places` array ("Town, ST") next to `points` in `mobile/assets/data/stores.json` (about 590 KB). The player's own spot shows coordinates only, with no place name, because naming it would mean sending the location to Apple's geocoder.
Rationale: Keeps the promise that watching your distance never sends your location anywhere (#13).
Status: `decided`
Phase decided: Build

**Decision #42**
Topic: Tester feedback
Question: How do testers send bugs and feedback from the phone to Claude?
Decision: (2026-11-26) Shake to report. A DEV setting on Me (testers only, off by default) turns it on; "Report a bug now" does the same by hand. A shake grabs the screen and opens a sheet: draw on the screenshot (in-app pen with three colors, undo, clear), write a note, send. The image goes to the private bucket `fff-bug-reports` under the user's id; `fff.submit_bug_report` records the note, the path and app context (screen, device, OS, app version, runtime) in `fff.bug_reports`. Claude pulls new reports with `scripts/bug-reports.mjs` from a SessionStart hook and a live watcher, then marks them seen or fixed.
Rationale: Ben wants to report bugs while using the app away from the computer and have them waiting when he's back. Apple's own Markup needs native code, which Expo Go can't run, so the pen is in-app for now; swap in PencilKit once there's a development build.
Status: `decided`
Phase decided: Build

---

## Deferred Items

| # | Topic | Deferred Until | Reason |
|---|-------|----------------|--------|
| 18 | User-submitted McDonald's | Phase 2 | Needs verification design; not core |
| A | State Extremes bonus leaderboard points | Game balancing | Needs real play data |
| B | Points rebrand (fries or burgers) | Phase 2 | Branding polish |
| 3 | Friends (friend graph, feed, invites, friends board, friend alerts #38) | After launch | First build ships the global board only (#26) |
| C | Final name confirmation | Before branding work | Needs App Store and trademark check |
| D | Check-in Live Activity (lock screen / Dynamic Island) | Phase 2 | Needs a native widget extension; live mileage conflicts with no background location |

---

## Open Items

- [ ] None blocking the spec.

---

*This document travels with the project. Keep it current as decisions evolve.*
*→ [[Far From Fries - 03 Functional Spec]]*
