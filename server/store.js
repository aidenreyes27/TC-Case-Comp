// In-memory data store + all business rules for orders.
// Every rule that protects the kitchen (capacity, locks, payment) lives here,
// on the server, so the UI can't bypass it. supabase/schema.sql mirrors these tables.
import { MENU, DEFAULT_STAFF, SETTINGS, OWNER_EMAIL } from './config.js';
import { menuById, prepMinsFor, rateFor, burritoCount, slotTimes, slotCapacity, lockTime, latestStart } from './capacity.js';
import { makeUnits, cookStep, sortQueue, cookable, priorityOf, staffAt, remainingWork } from './engine.js';
import { now, todayAt, MIN } from './time.js';

export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const fail = (status, msg) => { throw new HttpError(status, msg); };

export const USERS = [
  { id: 'u-owner', name: 'Aiden Reyes', role: 'owner', email: OWNER_EMAIL },
  { id: 'u-counter', name: 'Counter tablet', role: 'staff', email: 'counter@burritobarrio.com' },
];

export const db = {
  orders: [],
  staffBySlot: { ...DEFAULT_STAFF },
  autoCook: false,
  lastTick: now(),
  ticket: 100,
  lastSimulation: null,
};

let idSeq = 1;
const newId = (p) => `${p}${(idSeq++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const shareCode = () => Array.from({ length: 6 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');

export function resetStore() {
  db.orders = []; db.staffBySlot = { ...DEFAULT_STAFF }; db.autoCook = false; db.ticket = 100; db.lastTick = now();
}

// ---------- users (accounts and sessions live in auth.js) ----------
export const userById = (id) => USERS.find((u) => u.id === id);

// ---------- slots ----------
const active = (o) => !['released', 'cancelled'].includes(o.status);

export function slotsView(t = now()) {
  return slotTimes().map((time) => {
    const startAt = todayAt(time, new Date(t));
    const staff = db.staffBySlot[time] ?? 2;
    const cap = slotCapacity(staff);
    const groupBooked = db.orders
      .filter((o) => o.kind === 'group' && o.slot === time && active(o))
      .reduce((s, o) => s + prepMinsFor(o.lines, 'group'), 0);
    const windowStart = startAt - 30 * MIN;
    const walkInUsed = db.orders
      .filter((o) => o.kind === 'walkin' && o.dueAt > windowStart && o.dueAt <= startAt)
      .reduce((s, o) => s + prepMinsFor(o.lines, 'walkin'), 0);
    return {
      time, startAt, staff,
      capacityMins: cap.total, groupableMins: cap.groupable,
      groupBookedMins: round1(groupBooked), walkInMins: round1(walkInUsed),
      availableMins: round1(Math.max(0, cap.groupable - groupBooked)),
      bookable: startAt - SETTINGS.minLeadMins * MIN >= t,
    };
  });
}
const round1 = (n) => Math.round(n * 10) / 10;

function assertCapacity(slot, extraPrep) {
  const s = slotsView().find((x) => x.time === slot);
  if (!s) fail(400, 'Pick one of the listed pickup times.');
  const after = s.groupBookedMins + extraPrep;
  if (after > s.groupableMins + 1e-9) {
    const next = slotsView().find((x) => x.bookable && x.startAt > s.startAt && x.availableMins >= extraPrep);
    fail(409, `The ${fmt(s.startAt)} pickup is full.` + (next ? ` ${fmt(next.startAt)} still has room.` : ' Try an earlier time.'));
  }
}
const fmt = (t) => new Date(t).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

// ---------- group orders ----------
function lockFor(dueAt, lines) {
  return lockTime(dueAt, Math.max(prepMinsFor(lines, 'group'), 3), staffAt(dueAt, db.staffBySlot));
}
function groupMeta(o) { return { lockAt: lockFor(o.dueAt, o.lines) }; }

// Adding burritos means more prep, which pulls the "changes close" time earlier.
// Refuse any change that would pull it into the past, instead of accepting the
// burrito and then blocking payment.
function assertStillTime(o, lines, dueAt = o.dueAt) {
  const lockAt = lockFor(dueAt, lines);
  if (now() >= lockAt) {
    const n = burritoCount(lines);
    fail(409, `${n} burritos is too many for the kitchen to make by ${fmt(dueAt)} from now. Ask ${o.leadName} to move the pickup later, or pay for what’s already in.`);
  }
}

export function createGroup(user, { groupName, groupType, slot }) {
  if (!user) fail(401, 'Your session ended. Sign in again.');
  if (user.role === 'staff') fail(403, 'Sign in as a crew lead or owner to start a group order.');
  const name = String(groupName ?? '').trim();
  if (name.length < 2 || name.length > 50) fail(400, 'Give the group a name (2–50 characters).');
  const types = ['construction', 'military', 'office', 'students', 'other'];
  if (!types.includes(groupType)) fail(400, 'Choose who the order is for.');
  const s = slotsView().find((x) => x.time === slot);
  if (!s) fail(400, 'Pick one of the listed pickup times.');
  if (!s.bookable) fail(400, `Orders for ${fmt(s.startAt)} need at least ${SETTINGS.minLeadMins} minutes of notice.`);
  if (s.availableMins < 3) fail(409, `The ${fmt(s.startAt)} pickup is full.`);
  const t = now();
  const o = {
    id: newId('g'), kind: 'group', code: shareCode(), ticket: ++db.ticket,
    groupName: name, groupType, leadId: user.id, leadName: user.name,
    slot, dueAt: s.startAt, createdAt: t, visibleAt: t,
    status: 'open', paid: false, payRef: null, lines: [], units: [],
    readyAt: null, closedAt: null, source: 'live',
  };
  db.orders.push(o);
  return o;
}

export const findByCode = (code) => db.orders.find((o) => o.kind === 'group' && o.code === String(code).toUpperCase());
const mustOpen = (o) => {
  if (!o) fail(404, 'That group order link is not valid.');
  if (o.status === 'released') fail(409, 'This order was released because it wasn’t paid in time.');
  if (o.status !== 'open') fail(409, 'This order is locked and already headed to the kitchen.');
  if (now() >= groupMeta(o).lockAt) fail(409, 'Changes are closed for this order so the kitchen can start on time.');
};

export function addLine(code, { personName, itemId, qty, note }) {
  const o = findByCode(code); mustOpen(o);
  const person = String(personName ?? '').trim();
  if (person.length < 1 || person.length > 30) fail(400, 'Add your name so your crew lead knows whose burrito it is.');
  if (!menuById[itemId]) fail(400, 'Pick a burrito from the menu.');
  const q = Number(qty);
  if (!Number.isInteger(q) || q < 1 || q > SETTINGS.maxQtyPerLine) fail(400, `Quantity must be 1–${SETTINGS.maxQtyPerLine}.`);
  if (burritoCount(o.lines) + q > SETTINGS.maxGroupSize) fail(400, `Group orders max out at ${SETTINGS.maxGroupSize} burritos. Start a second order for the rest.`);
  const n = String(note ?? '').trim().slice(0, 80);
  assertCapacity(o.slot, q * rateFor(itemId, 'group'));
  assertStillTime(o, [...o.lines, { itemId, qty: q }]);
  const line = { id: newId('l'), personName: person, itemId, qty: q, note: n, addedAt: now() };
  o.lines.push(line);
  return o;
}

export function removeLine(code, lineId) {
  const o = findByCode(code); mustOpen(o);
  const i = o.lines.findIndex((l) => l.id === lineId);
  if (i < 0) fail(404, 'That burrito was already removed.');
  o.lines.splice(i, 1);
  return o;
}

export function moveGroup(user, code, slot) {
  const o = findByCode(code); mustOpen(o);
  if (!user) fail(401, 'Your session ended. Sign in again.');
  if (o.leadId !== user.id && user.role !== 'owner') fail(403, 'Only the crew lead can change the pickup time.');
  const s = slotsView().find((x) => x.time === slot);
  if (!s || !s.bookable) fail(400, 'That pickup time isn’t available.');
  if (slot === o.slot) return o;
  if (s.availableMins < prepMinsFor(o.lines, 'group')) fail(409, `${fmt(s.startAt)} doesn’t have room for ${burritoCount(o.lines)} burritos.`);
  assertStillTime(o, o.lines, s.startAt);
  o.slot = slot; o.dueAt = s.startAt;
  return o;
}

// Mock payment: validates the form like a real checkout, never charges anything.
export function payAndSubmit(user, code, { cardName, cardNumber, expiry, cvc }) {
  const o = findByCode(code); mustOpen(o);
  if (!user) fail(401, 'Your session ended. Sign in again, then pay.');
  if (o.leadId !== user.id && user.role !== 'owner') fail(403, 'Only the crew lead can pay for this order.');
  if (!o.lines.length) fail(400, 'Add at least one burrito before paying.');
  const digits = String(cardNumber ?? '').replace(/\s+/g, '');
  if (String(cardName ?? '').trim().length < 2) fail(400, 'Enter the name on the card.');
  if (!/^\d{16}$/.test(digits)) fail(400, 'Card number must be 16 digits. Use 4242 4242 4242 4242 for the demo.');
  if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(String(expiry ?? ''))) fail(400, 'Expiry must look like 08/28.');
  if (!/^\d{3,4}$/.test(String(cvc ?? ''))) fail(400, 'CVC must be 3 or 4 digits.');
  o.paid = true;
  o.payRef = `MOCK-${digits.slice(-4)}-${Date.now().toString(36).toUpperCase()}`;
  o.amount = orderTotal(o);
  lock(o);
  return o;
}

function lock(o) {
  o.status = 'locked';
  o.units = makeUnits(o);
}

export const orderTotal = (o) => Math.round(o.lines.reduce((s, l) => s + menuById[l.itemId].price * l.qty, 0) * 100) / 100;

// ---------- walk-ins (counter tablet) ----------
export function createWalkIn(user, { customerName, lines }) {
  if (!['owner', 'staff'].includes(user?.role)) fail(403, 'Only staff can ring up walk-ins.');
  if (!Array.isArray(lines) || !lines.length) fail(400, 'Add at least one burrito.');
  const clean = lines.map((l) => ({ itemId: l.itemId, qty: Number(l.qty) })).filter((l) => l.qty > 0);
  if (!clean.length) fail(400, 'Add at least one burrito.');
  for (const l of clean) {
    if (!menuById[l.itemId]) fail(400, 'Unknown menu item.');
    if (!Number.isInteger(l.qty) || l.qty > 10) fail(400, 'Walk-in quantities must be whole numbers up to 10.');
  }
  const t = now();
  const o = {
    id: newId('w'), kind: 'walkin', ticket: ++db.ticket,
    customerName: String(customerName ?? '').trim().slice(0, 30) || null,
    lines: clean.map((l) => ({ id: newId('l'), personName: null, note: '', ...l })),
    dueAt: t + SETTINGS.walkInPromiseMins * MIN, createdAt: t, visibleAt: t,
    status: 'locked', paid: true, readyAt: null, closedAt: null, source: 'live',
  };
  o.units = makeUnits(o);
  o.amount = orderTotal(o);
  db.orders.push(o);
  return o;
}

// ---------- kitchen actions ----------
const byId = (id) => db.orders.find((o) => o.id === id) ?? fail(404, 'Order not found.');

export function toggleUnit(user, orderId, unitId) {
  if (!['owner', 'staff'].includes(user?.role)) fail(403, 'Staff only.');
  const o = byId(orderId);
  if (o.status === 'open') fail(409, 'This group is still collecting burritos.');
  if (['picked_up', 'no_show', 'released'].includes(o.status)) fail(409, 'This order is already closed.');
  const u = o.units.find((x) => x.id === unitId) ?? fail(404, 'Burrito not found.');
  if (u.doneAt) { u.doneAt = null; u.workLeft = rateFor(u.itemId, o.kind); o.readyAt = null; o.status = 'locked'; }
  else { u.doneAt = now(); u.workLeft = 0; }
  refreshStatus(o);
  return o;
}

// Kitchen has slack: pull a booked group order forward and start it early.
export function startNow(user, orderId) {
  if (!['owner', 'staff'].includes(user?.role)) fail(403, 'Staff only.');
  const o = byId(orderId);
  if (o.kind !== 'group') fail(400, 'Walk-ins are already in the queue.');
  if (o.status === 'open') fail(409, 'This group hasn’t paid yet, so it can’t be cooked.');
  if (!['locked', 'cooking'].includes(o.status)) fail(409, 'This order is already done.');
  o.startNow = true;
  o.startNowAt = now();
  return o;
}

export function closeOrder(user, orderId, outcome) {
  if (!['owner', 'staff'].includes(user?.role)) fail(403, 'Staff only.');
  if (!['picked_up', 'no_show'].includes(outcome)) fail(400, 'Unknown outcome.');
  const o = byId(orderId);
  if (outcome === 'picked_up' && !o.readyAt) fail(409, 'Finish every burrito before marking it picked up.');
  o.status = outcome; o.closedAt = now();
  return o;
}

function refreshStatus(o) {
  if (o.units.length && o.units.every((u) => u.doneAt)) {
    o.readyAt = o.readyAt ?? Math.max(...o.units.map((u) => u.doneAt));
    if (['locked', 'cooking'].includes(o.status)) o.status = 'ready';
  } else if (o.units.some((u) => u.doneAt) && o.status === 'locked') o.status = 'cooking';
}

// Runs every second: releases unpaid groups at their lock time, and lets the
// auto-cook toggle stand in for the cooks during a demo rush.
export function tick() {
  const t = now();
  const dt = (t - db.lastTick) / MIN;
  db.lastTick = t;
  for (const o of db.orders) {
    if (o.kind === 'group' && o.status === 'open' && t >= groupMeta(o).lockAt) {
      o.status = 'released'; o.closedAt = t;
    }
  }
  if (db.autoCook && dt > 0) {
    const live = db.orders.filter((o) => ['locked', 'cooking'].includes(o.status));
    let step = 0;
    while (step < dt) {
      const d = Math.min(0.25, dt - step);
      cookStep(live, t - (dt - step) * MIN, d, 'slotted', db.staffBySlot);
      step += d;
    }
    live.forEach(refreshStatus);
    // Simulated customers collect walk-ins a few minutes after they're ready.
    // Group orders stay so the presenter can mark picked up or no-show.
    for (const o of db.orders) {
      if (o.kind === 'walkin' && o.status === 'ready' && t - o.readyAt > 3 * MIN) { o.status = 'picked_up'; o.closedAt = t; }
    }
  }
}

// ---------- views ----------
export function orderView(o, t = now()) {
  const staff = staffAt(o.dueAt, db.staffBySlot);
  const units = o.units ?? [];
  const startBy = units.length ? priorityOf(o, db.staffBySlot) : latestStart(o.dueAt, prepMinsFor(o.lines, o.kind), staff);
  const done = units.filter((u) => u.doneAt).length;
  return {
    ...o,
    total: orderTotal(o),
    burritos: burritoCount(o.lines),
    prepMins: round1(prepMinsFor(o.lines, o.kind)),
    done,
    startBy,
    lockAt: o.kind === 'group' ? groupMeta(o).lockAt : null,
    atRisk: !o.readyAt && units.length > 0 && t > startBy,
    late: !o.readyAt ? t > o.dueAt : o.readyAt > o.dueAt,
    cookableNow: cookable(o, t, 'slotted', db.staffBySlot),
  };
}

export function queueView(t = now()) {
  const visible = db.orders.filter((o) => o.visibleAt <= t && o.dueAt >= todayAt('00:00', new Date(t)));
  const cooking = visible.filter((o) => ['locked', 'cooking'].includes(o.status));
  const cookNow = sortQueue(cooking.filter((o) => cookable(o, t, 'slotted', db.staffBySlot)), 'slotted', db.staffBySlot);
  const later = cooking.filter((o) => !cookNow.includes(o)).concat(visible.filter((o) => o.status === 'open'))
    .sort((a, b) => a.dueAt - b.dueAt);
  const ready = visible.filter((o) => o.status === 'ready').sort((a, b) => a.readyAt - b.readyAt);
  const closed = visible.filter((o) => ['picked_up', 'no_show', 'released'].includes(o.status));
  const staff = staffAt(t, db.staffBySlot);
  const workAhead = cookNow.reduce((s, o) => s + remainingWork(o), 0);
  return {
    now: t, staff, autoCook: db.autoCook,
    cookNow: cookNow.map((o) => orderView(o, t)),
    later: later.map((o) => orderView(o, t)),
    ready: ready.map((o) => orderView(o, t)),
    closedCount: closed.length,
    backlogMins: round1(workAhead / Math.max(1, staff)),
    upcomingWalkIns: db.orders.filter((o) => o.visibleAt > t).length,
  };
}

export { MENU };
