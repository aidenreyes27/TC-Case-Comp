# Live demo: judges order on their own phones

Rehearsed end to end: 3 judges each sign in, start an order, add burritos, pay, and get a
"ready" alert, alongside fake rush orders, with a crew member joining by code.

## The day before (one time, about 15 minutes)

1. **Let anyone sign in with Google.** Google Cloud Console → Google Auth Platform → Audience →
   **Publish app** (move it from Testing to In production). The app only asks for name and email,
   so Google doesn't require a review. If you skip this, only your listed test users can sign in,
   and judges will see "access blocked".
2. **Allow the public demo link in Supabase.** Authentication → URL Configuration → Redirect URLs →
   add `https://*.trycloudflare.com/**`. Without this, Google sends judges back to `localhost` and
   sign-in fails on their phones.
3. Run `npm install` (it installs the tunnel tool).
4. **Practice once with your own phone**, following "Demo day" below: scan the QR, sign in with
   Google, start an order, pay, start it on the counter, see the green banner.

## Demo day: start up (5 minutes before)

1. Plug in the laptop and turn off sleep.
2. Terminal 1: `npm run demo` (builds the site and runs it at http://localhost:3001; it does not
   auto-restart, so orders stay put).
3. Terminal 2: `npm run tunnel`. After a few seconds it prints a link like
   `https://some-words.trycloudflare.com`. That's the public link for this session. It changes every
   time you run the command.
4. On the laptop, open **the https link** (not localhost) and sign in as the owner with Google.
5. Dashboard → demo clock **11:00** → Jump → **1×** (3 cooks are on at 11:00).
6. Counter → Simulate a rush → **Typical** (the fake orders). Turn **Sound on**.
7. Dashboard → **Show join QR**. Put it on the projector.

## Run of show

1. **Judges scan the QR.** Tell them: open it in Safari or Chrome, not inside Instagram, Gmail, or
   another app (Google blocks sign-in in those built-in browsers).
2. Each judge: **Continue with Google → Start a group order** → pick a pickup time → add a burrito.
3. Optional: a judge reads their 6-letter code to a neighbor, who types it on the front page and
   adds a burrito with no account. The first judge sees the pop-up when it lands.
4. Each judge taps **Alert me when it's ready** (on iPhone: **Play a sound when it's ready**),
   then **Pay** (the test card is filled in; nothing is charged). Keep the page open.
5. **Counter:** each paid order chimes and flashes in. In *Booked ahead*, press **Start now** on
   the judges' orders only. Then either:
   - **Tap their burritos** on the ticket as you "wrap" them (fastest and fully in your control), or
   - turn on **Auto-cook** and set the clock to **20×** for 30–60 seconds, then back to **1×**.
6. Judges' phones count up "2 / 3 wrapped", then show a green **"… is ready"** banner (plus a system
   notification on Android and laptops, and a chime if they turned sound on).
7. Counter → **Picked up**. Their tracker moves to Picked up.
8. Dashboard → **Today's orders** shows the judges' orders next to the fake ones → **Simulator** tab
   → **2019-like day**, seed **21** → **Run simulated day** → back to Today → **Write today's brief**.

## Don't break it mid-demo

- Don't copy in new files or edit code while it's running. A restart clears every order and signs
  everyone out.
- Only use **20×** after everyone has paid. Unpaid orders are released when their deadline passes,
  and at 20× that comes fast. (That's the no-show rule working, not a bug.)
- Lots of judges and a Slammed rush can fill the early pickup times. They'll see "Full" and can pick
  a later time, or add a cook on the Dashboard's kitchen load chart.

## What judges' phones can and can't do

| | Android Chrome | iPhone Safari | Laptop |
| --- | --- | --- | --- |
| Start, join, add, pay, track | Yes | Yes | Yes |
| Green "ready" banner | Yes | Yes | Yes |
| System notification | Yes | No (Apple only allows it for home-screen apps) | Yes |
| Sound when ready | Yes, after tapping the alert button | Yes, after tapping the sound button | Yes |
| Alert with the page closed | No | No | No |

The last row is a known limitation for the slides: real push alerts need a push server.

## If something goes wrong

| Problem | Fix |
| --- | --- |
| "Access blocked" at Google | Publish the app (step 1 of the day before), or add their email as a test user. |
| Google sends them to localhost | Add the trycloudflare Redirect URL in Supabase (step 2). |
| Tunnel won't connect | Venue Wi-Fi may block it. Switch the laptop to your phone's hotspot and rerun `npm run tunnel`. |
| QR shows a red warning | You opened the dashboard on localhost. Open the https tunnel link instead. |
| Judge's order is "Full" | Pick a later time, or add a cook for that half hour on the Dashboard. |
| Google sign-in fails for someone | They can still join any judge's order with the code, no account needed. |
