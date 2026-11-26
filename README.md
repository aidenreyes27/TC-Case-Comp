# Burrito Barrio: crew orders

Group ordering with capacity-limited pickup slots, a shared counter queue, and an AI end-of-day brief.

## Run it
```bash
npm install
cp .env.example .env      # add GROQ_API_KEY (free) for the AI brief
npm run dev               # web: http://localhost:5173  api: http://localhost:3001
npm test
```

## Who signs in how
| Person | How they get in |
| --- | --- |
| Crew lead | **Continue with Google** (Supabase). First sign-in creates their account. Any Google email except the owner's becomes a crew lead. |
| Crew member | No account. Opens the share link, or types the 6-letter code on the front page. |
| Owner (only one) | `aidenreyes27@berkeley.edu`, **Continue with Google** only. Change it in `server/config.js` (`OWNER_EMAIL`). |
| Counter tablet | Password form: `counter@burritobarrio.com` |

The counter password is `barrio-demo-2026` unless you set `STAFF_PASSWORD` in `.env`. Five wrong passwords lock that email for 10 minutes.

## Set up Google sign-in (one time, about 10 minutes)
1. Create a free project at supabase.com. Copy the Project URL and anon public key from Project Settings → API into `.env` as `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
2. In Google Cloud Console → APIs & Services → Credentials, create an OAuth client ID (type: Web application). Add this authorized redirect URI: `https://YOUR-PROJECT.supabase.co/auth/v1/callback`.
3. In Supabase → Authentication → Providers → Google, turn it on and paste the Google client ID and secret.
4. In Supabase → Authentication → URL Configuration, set Site URL to `http://localhost:5173` and add `http://localhost:5173/auth/callback` to Redirect URLs. Add your Vercel URL too if you deploy.
5. Restart `npm run dev`.

How it works: the browser signs in with Google through Supabase, then sends the Supabase access token to our API (`POST /api/auth/google`). The API confirms it with Supabase and returns our own session token, so the rest of the app doesn't care how you signed in.

## Live demo with judges' phones
See **DEMO.md** for setup, the run of show, and troubleshooting. Short version: `npm run demo` in one terminal, `npm run tunnel` in another, open the https link it prints.

## Demo script (about 5 minutes)
1. **Owner dashboard** → set the demo clock to 10:45 and press Jump.
2. **New tab, crew lead**: Continue with Google, start a group order for the 12:00 pickup. Full and too-soon times are greyed out.
3. Click **Join as crew member** on the lead's page: it opens the crew's view in a new tab. Add a burrito there and watch the lead tab pop up "Rosa added 1 × Carnitas". (An incognito window or a phone works too.)
   Click **Alert me when it's ready** on the lead's page so the browser can show a notification later.
4. Back as the lead: Pay (mock card 4242 4242 4242 4242). The order locks and appears under Booked ahead on the counter.
5. **Counter**: ring up a walk-in, then press Simulate a rush → Slammed. Watch a group get turned away by capacity.
6. Turn on Auto-cook and set the clock to 20×. Tickets move left to right; the lead's page counts burritos wrapped live. When the group's order is done, the lead gets a browser notification and a green banner. Turn on **Sound on** at the counter to hear new orders arrive.
7. **Dashboard**: run a simulated day (try seed 2) to compare pen and paper with our app on identical demand.
8. Press Write today's brief for the AI summary, for today or for the simulated day. Uses Groq's free tier (`GROQ_API_KEY`), or Claude if `ANTHROPIC_API_KEY` is set.

## Key rules
- Slot capacity = cooks on shift × 30 prep minutes; 40% is held back for walk-ins.
- Queue order = earliest latest-start time (due time − remaining prep ÷ cooks), ties by who ordered first.
- Group edits close 15 minutes before the latest start time. Unpaid orders are released at that moment, which keeps no-shows from tying up the kitchen.
- Prepaid no-shows keep their revenue; the dashboard reports it.

## Tradeoffs to present
1. **Supabase for sign-in only; orders stay in memory for the MVP.** Zero setup and fully reproducible demos; data resets on restart. `supabase/schema.sql` is the migration path.
2. **Capacity limits turn some groups away or move their time.** The simulator reports how many and by how much, against the gain in on-time rate.
3. **Polling (1.5–3 s) instead of realtime subscriptions.** Simpler and good enough for one counter tablet.
4. **Tap-off per burrito instead of a scale.** Real-time item tracking with zero hardware.

## Known limitations
- Prep minutes per burrito in `server/config.js` are estimates; replace with the 2019 averages.
- Mock payment. Orders are in memory and reset on restart; crew lead accounts are saved to `data/users.json`.
- On very heavy simulated days the kitchen is simply over capacity, and both methods miss targets; the brief recommends staffing changes.
