# Far From Fries: rules as built

Numbers live in one row, `public.game_settings`, so they can change without code.
The app mirrors them in `mobile/src/lib/rules.ts`.

- **Distance**: straight-line miles from where you stand to the nearest McDonald's.
- **Daily ping**: 1:20 PM in each player's current phone time zone (travelers follow
  their phone). Open for 1 hour. A log taken in the window can upload up to 24 hours later.
- **Scoring zone**: the lower 48 and DC. Points = miles, to one decimal.
- **Home zone**: within 5 miles of your home pin. Scores 0, keeps your streak alive,
  not shown to friends. Home pin set at onboarding, can move once per season.
- **Passport**: anywhere outside the lower 48 (Alaska, Hawaii, abroad, at sea).
  Keeps the streak and earns Extra Fries, no leaderboard points.
- **Streak**: consecutive days with a ping log. Missing a day resets it.
- **Extra Fries**: one per 7 non-home ping logs (twice as fast at a 12-day streak).
  Lets you log once outside the ping window. Lasts 14 days, warning 48 hours before.
- **Leaderboards**: Friends and Everyone, by season or all time. Everyone shows once you have 3 friends.
- **Seasons**: Mar 1, Jun 1, Sep 1, Dec 1, Pacific time.
- **State Extremes**: the furthest point from any McDonald's in each state on
  accessible public land (PAD-US open access). Claim by standing within 150 ft.
  Once per state, permanent even if the point moves.
- **Top 100 Spots**: the 100 furthest points in the lower 48, at least 50 miles
  apart, on accessible public land. Same 150 ft claim, once each, permanent.
- **Monthly refresh**: spots that move less than 2 miles keep their identity.
- **Privacy**: logs store distance, region and time only. Exact positions are
  used once on the server and discarded. Friends never see locations or home.
