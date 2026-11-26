---
title: "Far From Fries"
type: project
stage: build
status: active
version: "1.0"
spec_version: "0.1"
started: 2026-11-08
updated: 2026-11-10
description: "Social iOS game: friends get pinged at the same random moment daily and score miles from the nearest McDonald's."
repo: ""
tags:
  - project
  - far-from-fries
aliases:
  - "Far From Fries"
  - "Furthest From"
---

# Far From Fries

> [!abstract] Brief
> Far From Fries (working name, formerly "Furthest From") is a social game where friends are pinged at the same random moment each day and score points for how far they are, as the crow flies, from the nearest McDonald's. It exists to reward getting out and exploring: time near home doesn't count, and seasonal leaderboards crown whoever spent the most time exploring that season.
>
> Inspiration: a spot in a northern Nevada wildlife refuge said to be the furthest point from any McDonald's in the US.

---

## Key Constraints

*Curated from [[Far From Fries - 02 Decisions Log]]. Claude must never violate these.*

- **Exploration is the rewarded action.** Being home earns nothing; being out earns points.
- **Distance, never location.** Friends never see where you are, only your distance. No friends on any map.
- **Exact ping coordinates are never stored.** One database function scores the point, then it is discarded.
- **No always-on tracking.** "While Using the App" location permission only.
- **No penalties.** A missed ping scores zero. Scores lock at log time and are never recalculated.
- **Straight-line distance only**, never driving distance.
- **Android-ready.** iOS ships first, but the codebase must stay cross-platform.
- **No McDonald's trademarks in branding**, plus a clear "not affiliated" note.

---

## Current Focus

→ Planning complete (Explore, Define, Specify, Architect). Next: Build handoff (create repo, seed `docs/`, add `CLAUDE.md`), then an onboarding wireframe and design pass.

---

## Open Questions

- [ ] Confirm "Far From Fries" as the final name; check the App Store and trademarks before branding work. Other options: As the Crow Fries, Far Fryer, Out of Fry Range, Off the Menu, No Drive-Thru.
- [ ] State Extremes bonus leaderboard points (deferred to game balancing).

---

## Handoff Notes

- Repo: not yet created.
- `CLAUDE.md` draft: [[CLAUDE]] in this folder (copy to repo root).
- Copy Explore, Decisions Log, Functional Spec and Architect into the repo's `docs/`.
- **Onboarding design process:** onboarding (sign-in, home pin, permissions, adding friends) gets its own design pass during Build. Wireframe it using Benjamin's previously defined wireframe process, then refine in small iterations. Build sessions keep onboarding screens easy to rearrange and do not lock in the flow early.

### Handoff checklist
- [ ] Create the repo
- [ ] Copy stage docs into `docs/`
- [ ] Add `CLAUDE.md`
- [ ] Update this index: `repo` URL in frontmatter

---

## Document Registry

![[Far From Fries - Docs.base]]
