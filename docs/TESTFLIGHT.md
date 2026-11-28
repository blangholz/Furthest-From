# TestFlight: public beta

Run from `mobile/` once the Apple Developer membership is active.

## 1. First build (you, about 5 minutes of input)
```bash
npx eas-cli@latest build --profile production --platform ios
```
Sign in with your Apple ID when asked (two-factor). Answer **yes** to every
"generate a new ..." question: distribution certificate, provisioning profile,
push notifications key. The build then runs on Expo's servers (~15 min).

## 2. Upload
```bash
npx eas-cli@latest submit --platform ios --latest
```
It creates the app in App Store Connect (name McFarthest, bundle id
`app.farfromfries`, SKU anything, e.g. `mcfarthest`). When it offers to create an
App Store Connect API key, say **yes**: after that, builds and uploads run without you.
Apple then processes the build (5-30 min, you get an email).

## 3. App Store Connect > your app > TestFlight
**Test Information** (left sidebar), paste these:

- Beta App Description:
  > Once a day at 1:20 PM you get a ping. Check in within the hour and score one point for every mile, as the crow flies, between you and the nearest McDonald's. Climb the season leaderboard, keep a streak and tick off the furthest points in each state. McFarthest is not affiliated with McDonald's.
- Feedback Email: blangholz@gmail.com
- Marketing URL: https://mcfarthest.vercel.app
- Privacy Policy URL: https://mcfarthest.vercel.app/privacy
- Beta App Review Information:
  - Contact: Ben Langholz, blangholz@gmail.com, your phone number
  - Sign-in required: yes. Email and password are in `docs/review-account.local.txt` (not in git).
  - Review notes:
    > Sign in with the review account above: type the email and a password field appears (regular players sign in with an emailed code). Check-ins open only once a day at 1:20 PM local time. To try one at any time: tap the person icon (top right) > scroll to DEV > "Ping me in 5 seconds", allow notifications, then tap Check in on Home. Location is used only while the app is open; exact coordinates are scored and discarded, never stored.

**External Testing**: + next to External Testing > group name `Public beta` >
add the build > answer "What to Test" (e.g. "Everything: sign-in, onboarding,
the daily check-in, the leaderboard") > Submit for Review.

## 4. After approval (usually under a day)
Open the `Public beta` group > **Public Link** > Enable. Share that link. Testers
install TestFlight from the App Store and tap it. Later builds: run steps 1-2
again (no prompts) and add the build to the group; they're often approved
automatically.

## Known gaps for the beta
- Sign-in email comes from "PackUp" (shared Supabase project, see SETUP.md).
- Apple / Google sign-in are hidden (`features.socialSignIn`), email only.
- Name check (Decision #25) still pending: review may flag "Mc".
