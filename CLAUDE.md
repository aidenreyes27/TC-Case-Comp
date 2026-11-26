# Burrito Barrio crew ordering (PBL TC case, Sprint 3)

## What this is
A web app that lets crew leads (construction crews, Camp Pendleton units, offices, MiraCosta students) book a group burrito order for a pickup time the kitchen has capacity for. Members add their own burrito via a share link. The counter tablet shows one queue (group + walk-in) sorted by the latest time each order can start and still be on time. Owners see on-time rates, kitchen load, a pen-and-paper vs. app simulator, and an AI end-of-day brief.

Success metric: group on-time rate from 43% (2019) to 85%+. Lunch on-time 82% to 90%+.

## Layout
- `server/config.js` – menu, prices, prep minutes, staff per slot, business settings. Change numbers here, not in logic.
- `server/capacity.js` – slot capacity and latest-start math (pure functions).
- `server/engine.js` – kitchen queue ordering + cook simulation (shared by live auto-cook and offline simulator).
- `server/store.js` – in-memory data and every business rule (validation, capacity, locks, mock payment). Rules live here, never only in the UI.
- `server/simulate.js` – seeded demand generator, live rush, pen-and-paper vs. app comparison.
- `server/metrics.js` – the one definition of "on time" and all dashboard numbers.
- `server/ai.js` – end-of-day brief (metrics only, no customer names). Groq free tier by default (GROQ_API_KEY, model openai/gpt-oss-120b); Claude instead if ANTHROPIC_API_KEY is set.
- `server/auth.js` – crew leads: Google via Supabase (token checked server-side); staff: email + password (scrypt). Bearer-token sessions.
- `server/index.js` – Express routes.
- `src/lib/supabase.js` – Supabase client (Google OAuth only).
- `src/pages/*` – SignIn (join by code, Google, staff), AuthCallback, LeadHome, NewGroup, GroupOrder (lead + guest + tracker), Counter, Dashboard.
- `supabase/schema.sql` – the same tables for moving off in-memory storage.
- `docs/` – PRD/TRD live in the team Google Doc; keep a copy here.

## Rules for generated code
- Keep it simple: plain React function components + Tailwind, no new state libraries.
- Server-side validation for every input; return `{ error: "plain sentence telling the user what to do" }` with a 4xx code.
- No hardcoded demo data in the UI. Demo data comes from the simulator endpoints.
- Colors and fonts come from `tailwind.config.js` tokens (ink, paper, ticket, marigold, chile, nopal, pacific).
- Sentence case copy, active verbs, no emojis.
- Add a test in `server/*.test.js` for any new business rule.

## Commands
- `npm install`
- `npm run dev` – API on :3001 and web on :5173 (Vite proxies /api)
- `npm test` – backend rule tests
- `npm run demo` – build and serve everything from :3001 (no auto-restart); `npm run tunnel` – public https link for phones (see DEMO.md)
- `npm run build` – production build of the frontend
