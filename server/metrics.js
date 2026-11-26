import { menuById, prepMinsFor, burritoCount, slotTimes } from './capacity.js';
import { todayAt, MIN } from './time.js';

const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : null);
const r2 = (n) => Math.round(n * 100) / 100;

// One definition of "on time" for live days and simulated days.
export function computeMetrics(orders, t, staffBySlot) {
  const day = new Date(t);
  const submitted = orders.filter((o) => o.units?.length && !['released', 'cancelled'].includes(o.status));
  const judged = submitted.filter((o) => o.readyAt || t > o.dueAt);
  const onTime = (o) => o.readyAt && o.readyAt <= o.dueAt;
  const rate = (list) => ({ onTime: list.filter(onTime).length, total: list.length, pct: pct(list.filter(onTime).length, list.length) });

  const groups = judged.filter((o) => o.kind === 'group');
  const walkins = judged.filter((o) => o.kind === 'walkin');
  const lunch = judged.filter((o) => o.dueAt >= todayAt('11:00', day) && o.dueAt <= todayAt('13:30', day));

  const paid = submitted.filter((o) => o.paid);
  const revenue = paid.reduce((s, o) => s + o.lines.reduce((x, l) => x + menuById[l.itemId].price * l.qty, 0), 0);
  const cost = paid.reduce((s, o) => s + o.lines.reduce((x, l) => x + menuById[l.itemId].cost * l.qty, 0), 0);

  const byItem = Object.fromEntries(Object.keys(menuById).map((id) => [id, 0]));
  submitted.forEach((o) => o.lines.forEach((l) => { byItem[l.itemId] += l.qty; }));

  const slots = slotTimes().map((time) => {
    const end = todayAt(time, day);
    const inWindow = submitted.filter((o) => o.dueAt > end - 30 * MIN && o.dueAt <= end);
    const staff = staffBySlot[time] ?? 2;
    const booked = inWindow.reduce((s, o) => s + prepMinsFor(o.lines, o.kind), 0);
    const g = inWindow.filter((o) => o.kind === 'group');
    const late = inWindow.filter((o) => (o.readyAt ? o.readyAt > o.dueAt : t > o.dueAt)).length;
    return { time, staff, bookedMins: r2(booked), capacityMins: staff * 30, utilization: pct(booked, staff * 30),
      orders: inWindow.length, groupOrders: g.length, late };
  });

  const waits = submitted.filter((o) => o.kind === 'walkin' && o.readyAt).map((o) => (o.readyAt - o.createdAt) / MIN);
  const groupLate = groups.filter((o) => !onTime(o)).map((o) => ((o.readyAt ?? t) - o.dueAt) / MIN);
  const allBurritos = burritoCount(submitted.flatMap((o) => o.lines));
  const groupBurritos = burritoCount(submitted.filter((o) => o.kind === 'group').flatMap((o) => o.lines));

  return {
    asOf: t,
    orders: submitted.length,
    burritos: allBurritos,
    groupOrders: submitted.filter((o) => o.kind === 'group').length,
    groupBurritoShare: pct(groupBurritos, allBurritos),
    onTime: { group: rate(groups), walkin: rate(walkins), lunch: rate(lunch), overall: rate(judged) },
    revenue: r2(revenue), ingredientCost: r2(cost), grossMarginPct: pct(revenue - cost, revenue),
    byItem,
    slots,
    avgWalkInWaitMins: waits.length ? r2(waits.reduce((a, b) => a + b, 0) / waits.length) : null,
    avgGroupLateMins: groupLate.length ? r2(groupLate.reduce((a, b) => a + b, 0) / groupLate.length) : 0,
    noShows: orders.filter((o) => o.status === 'no_show').length,
    noShowRevenueKept: r2(orders.filter((o) => o.status === 'no_show' && o.paid).reduce((s, o) => s + (o.amount ?? 0), 0)),
    released: orders.filter((o) => o.status === 'released').length,
    stillCooking: submitted.filter((o) => !o.readyAt).length,
  };
}
