---
title: "Far From Fries: Explore"
type: project-doc
stage: explore
status: complete
project: "Far From Fries"
date: 2026-11-08
tags:
  - pdk/explore
  - far-from-fries
aliases:
  - "Far From Fries Explore"
---

# Far From Fries: Explore
*Stage 1 · Explore Session · 2026-11-08*

> [!note] Raw notes from the Explore session, when the project was still called "Furthest From." Several numbers changed later in Define (bonus log rate, streak rules, privacy model). Where they differ, [[Far From Fries - 02 Decisions Log]] wins.

---

## Territory Covered

- [x] Core idea, why it exists, the version you'd use every day
- [x] Who uses it (friend groups; later a global board)
- [x] Workflow: daily ping, open app, log, see friends' distances
- [x] Edges: remote-living players, cheating, international trips, missed pings
- [x] Out of scope: always-on tracking, anti-cheat, sharing locations
- [x] Constraints: iOS first, privacy, straight-line distance

---

## Discovery Research

Not done as a separate pass. The core concept was clear enough that existing apps wouldn't change *what* gets built. BeReal was the reference for the synchronized random ping. The McDonald's data source was researched in a separate thread (see Architect: AllThePlaces).

---

## Raw Output

### Origin
A friend mentioned a spot in a northern Nevada wildlife refuge said to be the furthest point from any McDonald's in the US. The idea: see which friends spend the most time furthest from McDonald's, as a proxy for who is out exploring the most.

### Core Mechanic
- **Daily synchronized ping.** Everyone is notified at the same random time (BeReal style). About 1 hour to open the app, which logs location and scores it.
- **Friend notifications.** When a friend logs: "Benjamin is 63 miles from the nearest McDonald's." Builds excitement and pushes everyone to contribute.
- Always-on tracking was rejected early: location only at a ping or a bonus log.

### Scoring
- 1 mile = 1 point, decimals allowed (0.7 miles = 0.7 points).
- Straight-line distance to the nearest McDonald's.
- **Home dead zone:** each player sets a home location; logs within a 5 to 10 mile radius score zero. Home pin locks for the season. (Settled at 5 miles in Define.)
- Possible future rebrand of points as fries or burgers. Keep 1:1 for now.
- Realistic scores will mostly be low (the lower 48 max is roughly 115 to 120 miles).

### Bonus Logs
- Earned, not bought. First idea: 10 completed pings earns 1. (Changed to 7 in Define.)
- Lets you log at a moment you choose, when you know you're far out.
- Expires 2 weeks after earning (use it or lose it).
- Streaks help earn bonuses faster.

### Streaks
- Consecutive completed pings build a streak.
- Missing a ping breaks the streak but carries no point penalty.

### Seasons and Leaderboards
- Seasonal leaderboards (summer, fall, winter, spring) that reset, plus an all-time board.
- Lets someone have a big winter in the mountains and win that season.

### Privacy
- First idea: friends see a fuzzy, state-level location on a low-detail map. (Replaced later: friends never see location at all, only distance.)

### Anti-Cheat
- Not a priority. Friends play with friends and know where each other lives; social trust handles it.

### Feature Ideas Added After the Session (2026-11-08)
- **Live distance readout:** a big number at the top of the app showing current distance to the nearest McDonald's, updating as you move, like a speedometer.
- **Map as the home view:** centered on you with nearby McDonald's. (Friends' pings were later removed from the map.)
- **Submit a missing McDonald's:** later moved to phase 2.
- **State Extremes tick list:** visit the furthest point from any McDonald's in each state; a big achievement, claimable any time, broadcast to friends, with a tab to navigate to them.

### Naming
- "Furthest From" may not be the best name. Brainstormed McDonald's-adjacent names about exploring. Favorite: **Far From Fries**. Others: As the Crow Fries, Far Fryer, Out of Fry Range, Off the Menu, No Drive-Thru, Golden Distance, Fry-Free Zone.
- Avoid "Mc" names, Happy Meal and other McDonald's trademarks.

---

## Exit Check

**1. In two sentences: what is this thing and why does it exist?**

*→ Far From Fries is a social game where friends are pinged at the same random moment each day and score points for how far they are, as the crow flies, from the nearest McDonald's. It exists to reward exploring: time near home doesn't count, and seasonal leaderboards crown whoever spent the most time exploring that season.*

**2. What are the top 3 to 5 things that were still unclear?**

- [x] Form factor: native app, web app, or other
- [x] McDonald's location data source and how to keep it current
- [x] Streak math and a name for the bonus logs
- [x] Handling Alaska and international trips
- [x] Group mechanics: size, joining, multiple groups

*All resolved in [[Far From Fries - 02 Decisions Log]].*

---

*Stage 1 complete → [[Far From Fries - 02 Decisions Log]]*
