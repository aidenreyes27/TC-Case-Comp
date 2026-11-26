import { MENU, SLOT_MINUTES, OPEN, CLOSE, SETTINGS } from './config.js';
import { todayAt, MIN } from './time.js';

export const menuById = Object.fromEntries(MENU.map((m) => [m.id, m]));

// Per-burrito prep time depends on the order type: group orders batch faster.
export const rateFor = (itemId, kind = 'walkin') => {
  const m = menuById[itemId];
  if (!m) return 0;
  return kind === 'group' ? m.groupPrepMins : m.prepMins;
};
export function prepMinsFor(lines, kind = 'walkin') {
  return lines.reduce((s, l) => s + rateFor(l.itemId, kind) * l.qty, 0);
}
export function burritoCount(lines) { return lines.reduce((s, l) => s + l.qty, 0); }

export function slotTimes() {
  const out = [];
  for (let t = todayAt(OPEN); t < todayAt(CLOSE); t += SLOT_MINUTES * MIN) {
    const d = new Date(t);
    out.push(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
  }
  return out;
}

// Prep minutes a slot offers group orders, after the walk-in reserve.
export function slotCapacity(staff) {
  const total = staff * SLOT_MINUTES;
  return { total, groupable: Math.floor(total * (1 - SETTINGS.walkInReserve)) };
}

// Latest time the kitchen can start an order and still hit its due time,
// assuming the cooks on shift can split the burritos between them.
export function latestStart(dueAt, remainingPrepMins, staff) {
  return dueAt - (remainingPrepMins / Math.max(1, staff)) * MIN;
}

export function lockTime(dueAt, prepMins, staff) {
  return latestStart(dueAt, prepMins, staff) - SETTINGS.lockBufferMins * MIN;
}
