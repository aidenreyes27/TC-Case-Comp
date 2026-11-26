// Kitchen engine: decides which order to cook next and simulates cooks working.
// Used by the live auto-cook toggle and by the offline day simulator, so the
// demo and the "before vs after" numbers run on the same rules.
import { latestStart, slotTimes, rateFor } from './capacity.js';
import { todayAt, MIN } from './time.js';

export const EARLY_START_MINS = 20; // never start a booked group more than this early

export function staffAt(t, staffBySlot) {
  const slots = slotTimes();
  for (let i = slots.length - 1; i >= 0; i--) {
    if (t >= todayAt(slots[i], new Date(t))) return staffBySlot[slots[i]] ?? 2;
  }
  return staffBySlot[slots[0]] ?? 2;
}

export function makeUnits(order) {
  let n = 0;
  return order.lines.flatMap((l) =>
    Array.from({ length: l.qty }, () => ({
      id: `${order.id}-${n++}`,
      itemId: l.itemId,
      person: l.personName || null,
      workLeft: rateFor(l.itemId, order.kind),
      doneAt: null,
    })),
  );
}

export const remainingWork = (o) => o.units.reduce((s, u) => s + (u.doneAt ? 0 : u.workLeft), 0);

export function priorityOf(order, staffBySlot) {
  const ls = latestStart(order.dueAt, remainingWork(order), staffAt(order.dueAt, staffBySlot));
  // "Start now" treats the order as if it had to start the moment staff pressed it.
  return order.startNowAt ? Math.min(ls, order.startNowAt) : ls;
}

// policy 'fcfs' = pen-and-paper (first ticket in, first cooked)
// policy 'slotted' = our app (earliest latest-start-time first, ties by who ordered first)
export function cookable(order, t, policy, staffBySlot) {
  if (order.visibleAt > t || order.readyAt || !order.units?.length) return false;
  if (order.kind === 'group' && order.status === 'open') return false;
  if (policy === 'fcfs' || order.kind === 'walkin' || order.startNow) return true;
  return t >= priorityOf(order, staffBySlot) - EARLY_START_MINS * MIN;
}

export function sortQueue(orders, policy, staffBySlot) {
  const key = (o) => (policy === 'fcfs' ? o.visibleAt : priorityOf(o, staffBySlot));
  return [...orders].sort((a, b) => key(a) - key(b) || a.createdAt - b.createdAt);
}

// Advance the kitchen by dtMins. Each cook works one burrito at a time.
export function cookStep(orders, t, dtMins, policy, staffBySlot) {
  const staff = staffAt(t, staffBySlot);
  let cooksFree = staff;
  const queue = sortQueue(orders.filter((o) => cookable(o, t, policy, staffBySlot)), policy, staffBySlot);
  for (const o of queue) {
    for (const u of o.units) {
      if (cooksFree <= 0) break;
      if (u.doneAt) continue;
      u.workLeft -= dtMins;
      cooksFree -= 1;
      if (u.workLeft <= 1e-9) { u.workLeft = 0; u.doneAt = t + dtMins * MIN; }
    }
    if (o.units.every((u) => u.doneAt)) o.readyAt = Math.max(...o.units.map((u) => u.doneAt));
    if (cooksFree <= 0) break;
  }
  return staff - cooksFree; // cooks busy
}
