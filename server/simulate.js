// Demand simulator. Two jobs:
// 1) simulateDay: replay one random lunch day twice, pen-and-paper vs. our app,
//    on identical demand, so the "43% -> 85%" claim is a test anyone can rerun.
// 2) liveRush: drop random walk-ins and group orders into the live queue.
import { MENU, SETTINGS } from './config.js';
import { slotTimes, slotCapacity, prepMinsFor } from './capacity.js';
import { makeUnits, cookStep } from './engine.js';
import { computeMetrics } from './metrics.js';
import { rng } from './random.js';
import { todayAt, now, MIN } from './time.js';
import { db, createGroup, addLine, payAndSubmit, HttpError, USERS } from './store.js';

export const LEVELS = {
  // "2019-like" is calibrated so pen and paper reproduces the 2019 records
  // (about 82% of lunch orders and 43% of group orders on time, at 2019 staffing).
  // "More groups" is the growth plan: same walk-ins, twice the group orders.
  low: { walkIns: 42, groups: 2, label: '2019-like day' },
  normal: { walkIns: 42, groups: 4, label: 'More groups' },
  high: { walkIns: 60, groups: 5, label: 'Slammed' },
};
const MIX = [['california', 171], ['carne-asada', 160], ['carnitas', 78]]; // 2019 sales mix
const TYPES = ['construction', 'construction', 'military', 'office', 'students'];
const CREWS = {
  construction: ['Mission Ave site crew', 'Coast Hwy framing crew', 'Pacific Electric crew', 'Harbor roofing crew'],
  military: ['Pendleton 1st Bn logistics', 'Pendleton motor pool', 'Camp Pendleton supply'],
  office: ['Tri-City dental office', 'Oceanside city planning', 'Seaside realty team'],
  students: ['MiraCosta robotics club', 'MiraCosta soccer team', 'MiraCosta nursing cohort'],
};
const NAMES = ['Carlos', 'Maria', 'Jose', 'Ana', 'Luis', 'Sofia', 'Diego', 'Lucia', 'Mike', 'Jess', 'Tony', 'Priya', 'Sam', 'Kenji', 'Rosa', 'Dante', 'Jamal', 'Elena', 'Marcus', 'Tina'];

function lunchTime(r, day, peak = '12:00', spread = 100) {
  const z = r.next() + r.next() + r.next() - 1.5;
  const t = todayAt(peak, day) + z * spread * MIN;
  return Math.min(Math.max(t, todayAt('10:20', day)), todayAt('13:55', day));
}

export function generateDemand(seed, level, day = new Date(now())) {
  const r = rng(seed);
  const p = LEVELS[level] ?? LEVELS.normal;
  const walkIns = Array.from({ length: p.walkIns }, () => ({
    arrival: Math.round(lunchTime(r, day) / MIN) * MIN,
    lines: Array.from({ length: r.weighted([[1, 58], [2, 32], [3, 6], [4, 4]]) }, () => ({ itemId: r.weighted(MIX), qty: 1 })), // 2019 order sizes
  }));
  const groups = Array.from({ length: p.groups }, () => {
    const groupType = r.pick(TYPES);
    const people = r.int(5, 15);
    const desired = Math.round(lunchTime(r, day, '12:05', 45) / (5 * MIN)) * 5 * MIN;
    return {
      groupType, groupName: r.pick(CREWS[groupType]), desired,
      bookedAheadMins: r.int(60, 180),
      lines: Array.from({ length: people }, () => ({
        personName: r.pick(NAMES), itemId: r.weighted(MIX), qty: r.next() < 0.1 ? 2 : 1,
      })),
    };
  });
  return { walkIns, groups };
}

let seq = 0;
function simOrder(kind, fields) {
  const o = { id: `s${seq++}`, kind, status: 'locked', paid: true, readyAt: null, source: 'sim', ...fields };
  o.lines = o.lines.map((l, i) => ({ id: `${o.id}l${i}`, ...l }));
  o.units = makeUnits(o);
  o.amount = o.lines.reduce((s, l) => s + MENU.find((m) => m.id === l.itemId).price * l.qty, 0);
  return o;
}

function runPolicy(demand, policy, staffBySlot, day) {
  const orders = demand.walkIns.map((w) => simOrder('walkin', {
    lines: w.lines, createdAt: w.arrival, visibleAt: w.arrival, dueAt: w.arrival + SETTINGS.walkInPromiseMins * MIN,
  }));
  let turnedAway = 0; let shiftMins = 0;
  const slots = slotTimes();
  const booked = Object.fromEntries(slots.map((s) => [s, 0]));

  const groups = [...demand.groups].sort((a, b) => (a.desired - a.bookedAheadMins * MIN) - (b.desired - b.bookedAheadMins * MIN));
  for (const g of groups) {
    if (policy === 'fcfs') {
      // Pen and paper: the crew calls ~15 minutes out, the kitchen learns about it then.
      orders.push(simOrder('group', { groupName: g.groupName, groupType: g.groupType, lines: g.lines,
        createdAt: g.desired - 15 * MIN, visibleAt: g.desired - 15 * MIN, dueAt: g.desired }));
      continue;
    }
    const need = prepMinsFor(g.lines, 'group');
    const ranked = slots
      .map((s) => ({ s, at: todayAt(s, day) }))
      .sort((a, b) => Math.abs(a.at - g.desired) - Math.abs(b.at - g.desired));
    const pick = ranked.find(({ s }) => booked[s] + need <= slotCapacity(staffBySlot[s] ?? 2).groupable);
    if (!pick) { turnedAway++; continue; }
    booked[pick.s] += need;
    shiftMins += Math.abs(pick.at - g.desired) / MIN;
    const bookedAt = g.desired - g.bookedAheadMins * MIN;
    orders.push(simOrder('group', { groupName: g.groupName, groupType: g.groupType, lines: g.lines, slot: pick.s,
      createdAt: bookedAt, visibleAt: bookedAt, dueAt: pick.at }));
  }

  const timeline = [];
  const start = todayAt('10:00', day); const end = todayAt('15:30', day); const chartEnd = todayAt('14:30', day);
  for (let t = start; t < end; t += 0.5 * MIN) {
    cookStep(orders, t, 0.5, policy, staffBySlot);
    if ((t - start) % (10 * MIN) === 0 && t <= chartEnd) {
      timeline.push({ t, waiting: orders.filter((o) => o.visibleAt <= t && !o.readyAt).length });
    }
  }
  const metrics = computeMetrics(orders, end, staffBySlot);
  return { metrics, timeline, turnedAway, avgShiftMins: Math.round((shiftMins / Math.max(1, demand.groups.length - turnedAway)) * 10) / 10 };
}

export function simulateDay({ level = 'normal', seed } = {}) {
  if (!LEVELS[level]) throw new HttpError(400, 'Demand must be low, normal, or high.');
  const s = Number.isInteger(Number(seed)) && seed !== '' && seed != null ? Number(seed) : Math.floor(Math.random() * 1e6);
  const day = new Date(now());
  const demand = generateDemand(s, level, day);
  const staff = { ...db.staffBySlot };
  const result = {
    seed: s, level, label: LEVELS[level].label, staffBySlot: staff, ranAt: now(),
    demand: { walkIns: demand.walkIns.length, groups: demand.groups.length,
      groupBurritos: demand.groups.reduce((a, g) => a + g.lines.reduce((x, l) => x + l.qty, 0), 0) },
    fcfs: runPolicy(demand, 'fcfs', staff, day),
    slotted: runPolicy(demand, 'slotted', staff, day),
  };
  db.lastSimulation = result;
  return result;
}

// Live rush: real orders go through the same API rules as a human would.
export function liveRush({ level = 'normal', seed } = {}) {
  if (!LEVELS[level]) throw new HttpError(400, 'Demand must be low, normal, or high.');
  const r = rng(Number.isInteger(Number(seed)) ? Number(seed) : Math.floor(Math.random() * 1e6));
  const t = now();
  const counts = { low: [8, 1], normal: [14, 2], high: [22, 4] }[level]; // [walk-ins over 45 min, groups]
  let walkIns = 0;
  for (let i = 0; i < counts[0]; i++) {
    const at = t + r.int(0, 45) * MIN;
    const lines = Array.from({ length: r.weighted([[1, 55], [2, 30], [3, 15]]) }, (_, k) => ({ id: `rl${i}${k}`, itemId: r.weighted(MIX), qty: 1, personName: null, note: '' }));
    const o = { id: `rw${t}${i}`, kind: 'walkin', ticket: ++db.ticket, customerName: r.pick(NAMES), lines,
      createdAt: at, visibleAt: at, dueAt: at + SETTINGS.walkInPromiseMins * MIN, status: 'locked', paid: true,
      readyAt: null, closedAt: null, source: 'live' };
    o.units = makeUnits(o);
    o.amount = lines.reduce((s, l) => s + MENU.find((m) => m.id === l.itemId).price, 0);
    db.orders.push(o); walkIns++;
  }
  const bot = USERS.find((u) => u.role === 'owner'); // simulated orders are placed under the owner account
  const results = [];
  for (let i = 0; i < counts[1]; i++) {
    const groupType = r.pick(TYPES);
    const name = r.pick(CREWS[groupType]);
    const open = db.staffBySlot && Object.keys(db.staffBySlot);
    const candidates = open.filter((s) => todayAt(s, new Date(t)) - SETTINGS.minLeadMins * MIN >= t);
    if (!candidates.length) { results.push({ name, ok: false, reason: 'No pickup times left today.' }); continue; }
    const slot = r.pick(candidates.slice(0, 3));
    try {
      const g = createGroup(bot, { groupName: name, groupType, slot });
      g.leadName = r.pick(NAMES) + ' (crew lead)';
      g.simulated = true;
      const people = r.int(5, 14);
      for (let k = 0; k < people; k++) {
        try { addLine(g.code, { personName: r.pick(NAMES), itemId: r.weighted(MIX), qty: 1 }); }
        catch (e) { if (!g.lines.length) throw e; break; }
      }
      payAndSubmit(bot, g.code, { cardName: g.leadName, cardNumber: '4242424242424242', expiry: '08/28', cvc: '123' });
      results.push({ name, ok: true, slot, burritos: g.lines.length });
    } catch (e) {
      db.orders = db.orders.filter((o) => !(o.status === 'open' && o.lines.length === 0 && o.groupName === name));
      results.push({ name, ok: false, slot, reason: e.message });
    }
  }
  return { walkIns, groups: results };
}
