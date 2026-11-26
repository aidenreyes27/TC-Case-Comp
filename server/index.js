import express from 'express';
import cors from 'cors';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import * as store from './store.js';
import { MENU, SETTINGS } from './config.js';
import { computeMetrics } from './metrics.js';
import { simulateDay, liveRush, LEVELS } from './simulate.js';
import { buildPayload, summarize } from './ai.js';
import { now, setClock, clockState } from './time.js';
import { initAuth, signInWithSupabase, signIn, signOut, userFromToken, tokenFrom, publicUser } from './auth.js';

// Load .env without an extra dependency.
if (existsSync('.env')) {
  for (const line of readFileSync('.env', 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

export const app = express();
app.use(cors());
app.use(express.json({ limit: '100kb' }));

initAuth();
// Every request carries "Authorization: Bearer <token>" once signed in.
app.use((req, _res, next) => { req.user = userFromToken(tokenFrom(req)); next(); });
const ownerOnly = (req) => { if (req.user?.role !== 'owner') throw new store.HttpError(403, 'Owners only.'); };
const staffOnly = (req) => { if (!['owner', 'staff'].includes(req.user?.role)) throw new store.HttpError(403, 'Staff only.'); };

const h = (fn) => async (req, res) => {
  try { res.json(await fn(req, res)); }
  catch (e) { res.status(e.status ?? 500).json({ error: e.status ? e.message : 'Something went wrong on the server.' }); if (!e.status) console.error(e); }
};
const groupPublic = (o, user) => {
  const v = store.orderView(o);
  const isLead = user && (user.id === o.leadId || user.role === 'owner');
  return { ...v, payRef: isLead ? v.payRef : null, isLead };
};

// Orders that exist as of the demo clock (simulated walk-ins arrive later).
const liveOrders = () => store.db.orders.filter((o) => o.source === 'live' && o.visibleAt <= now());

app.get('/api/health', h(() => ({ ok: true })));
app.get('/api/clock', h(() => clockState()));
app.post('/api/clock', h((req) => { ownerOnly(req); setClock(req.body ?? {}); return clockState(); }));

app.post('/api/auth/google', h((req) => signInWithSupabase(req.body ?? {})));
app.get('/api/auth/config', h(() => ({ google: !!((process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL) && (process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY)) })));
app.post('/api/auth/sign-in', h((req) => signIn(req.body ?? {})));
app.post('/api/auth/sign-out', h((req) => signOut(tokenFrom(req))));
app.get('/api/auth/me', h((req) => { if (!req.user) throw new store.HttpError(401, 'Your session ended. Sign in again.'); return publicUser(req.user); }));
app.get('/api/menu', h(() => ({ menu: MENU, settings: SETTINGS })));
app.get('/api/slots', h(() => ({ now: now(), slots: store.slotsView() })));

app.post('/api/groups', h((req) => store.orderView(store.createGroup(req.user, req.body ?? {}))));
app.get('/api/groups/mine', h((req) => {
  if (!req.user) throw new store.HttpError(401, 'Sign in first.');
  return store.db.orders.filter((o) => o.kind === 'group' && o.leadId === req.user.id && !o.simulated)
    .sort((a, b) => b.createdAt - a.createdAt).map((o) => groupPublic(o, req.user));
}));
app.get('/api/groups/:code', h((req) => {
  const o = store.findByCode(req.params.code);
  if (!o) throw new store.HttpError(404, 'That group order link is not valid.');
  return groupPublic(o, req.user);
}));
app.post('/api/groups/:code/lines', h((req) => groupPublic(store.addLine(req.params.code, req.body ?? {}), req.user)));
app.delete('/api/groups/:code/lines/:lineId', h((req) => groupPublic(store.removeLine(req.params.code, req.params.lineId), req.user)));
app.post('/api/groups/:code/move', h((req) => groupPublic(store.moveGroup(req.user, req.params.code, req.body?.slot), req.user)));
app.post('/api/groups/:code/pay', h((req) => groupPublic(store.payAndSubmit(req.user, req.params.code, req.body ?? {}), req.user)));

app.post('/api/walkins', h((req) => store.orderView(store.createWalkIn(req.user, req.body ?? {}))));
app.get('/api/queue', h((req) => { staffOnly(req); return store.queueView(); }));
app.post('/api/orders/:id/units/:unitId', h((req) => store.orderView(store.toggleUnit(req.user, req.params.id, req.params.unitId))));
app.post('/api/orders/:id/start-now', h((req) => store.orderView(store.startNow(req.user, req.params.id))));
app.post('/api/orders/:id/close', h((req) => store.orderView(store.closeOrder(req.user, req.params.id, req.body?.outcome))));

app.post('/api/kitchen/auto-cook', h((req) => { staffOnly(req); store.db.autoCook = !!req.body?.on; return { autoCook: store.db.autoCook }; }));
app.post('/api/kitchen/staff', h((req) => {
  ownerOnly(req);
  const { slot, staff } = req.body ?? {};
  const n = Number(staff);
  if (!(slot in store.db.staffBySlot)) throw new store.HttpError(400, 'Unknown slot.');
  if (!Number.isInteger(n) || n < 1 || n > 5) throw new store.HttpError(400, 'Staff per slot must be 1–5.');
  store.db.staffBySlot[slot] = n;
  return { staffBySlot: store.db.staffBySlot };
}));

app.get('/api/orders/today', h((req) => {
  ownerOnly(req);
  const t = now();
  return liveOrders().filter((o) => o.status !== 'cancelled')
    .sort((a, b) => b.createdAt - a.createdAt)
    .map((o) => {
      const v = store.orderView(o, t);
      return { id: v.id, ticket: v.ticket, kind: v.kind, name: v.kind === 'group' ? v.groupName : (v.customerName || 'Walk-in'),
        leadName: v.leadName ?? null, groupType: v.groupType ?? null, code: v.code ?? null,
        burritos: v.burritos, total: v.total, paid: v.paid, status: v.status,
        createdAt: v.createdAt, dueAt: v.dueAt, readyAt: v.readyAt, late: v.late };
    });
}));
app.get('/api/metrics', h((req) => {
  ownerOnly(req);
  return { live: computeMetrics(liveOrders(), now(), store.db.staffBySlot),
    simulation: store.db.lastSimulation, levels: LEVELS, staffBySlot: store.db.staffBySlot };
}));
app.post('/api/sim/day', h((req) => { ownerOnly(req); return simulateDay(req.body ?? {}); }));
app.post('/api/sim/rush', h((req) => { staffOnly(req); return liveRush(req.body ?? {}); }));
app.post('/api/sim/reset', h((req) => { ownerOnly(req); store.resetStore(); return { ok: true }; }));

app.post('/api/ai/summary', h(async (req) => {
  ownerOnly(req);
  const source = req.body?.source === 'simulation' ? 'simulation' : 'live';
  if (source === 'simulation') {
    const s = store.db.lastSimulation;
    if (!s) throw new store.HttpError(400, 'Run a simulated day first.');
    return summarize(buildPayload('simulated day (our app)', s.slotted.metrics, {
      comparison: { penAndPaperGroupOnTimePct: s.fcfs.metrics.onTime.group.pct, penAndPaperLunchOnTimePct: s.fcfs.metrics.onTime.lunch.pct,
        groupsTurnedAwayByCapacity: s.slotted.turnedAway, avgPickupShiftMins: s.slotted.avgShiftMins },
      demandLevel: s.label, staffBySlot: s.staffBySlot,
    }));
  }
  return summarize(buildPayload('live day', computeMetrics(liveOrders(), now(), store.db.staffBySlot), { staffBySlot: store.db.staffBySlot }));
}));

// `npm run demo` serves the built site from this same server, so one public
// https link (the tunnel) covers both the pages and the API.
if (process.argv.includes('--serve-web')) {
  const dist = path.resolve('dist');
  if (!existsSync(path.join(dist, 'index.html'))) {
    console.error('No dist/ folder. Run `npm run demo` (it builds first).');
  } else {
    app.use(express.static(dist, { index: false }));
    app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
    console.log('Serving the web app from dist/');
  }
}
app.use('/api', (_req, res) => res.status(404).json({ error: 'Unknown API route.' }));

if (process.env.NODE_ENV !== "test") setInterval(store.tick, 1000);
const PORT = process.env.PORT || 3001;
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => console.log(process.argv.includes('--serve-web')
    ? `Demo running on http://localhost:${PORT}. For phones, run \`npm run tunnel\` in a second terminal.`
    : `API on http://localhost:${PORT}`));
}
