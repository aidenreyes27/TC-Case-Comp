process.env.NODE_ENV = 'test';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as s from './store.js';
import { setClock } from './time.js';
import { simulateDay } from './simulate.js';

const owner = s.USERS[0];
const pay = { cardName: 'Carlos R', cardNumber: '4242 4242 4242 4242', expiry: '08/28', cvc: '123' };
beforeEach(() => { s.resetStore(); setClock({ time: '10:15', speed: 1 }); });

test('slot picker blocks a slot over capacity', () => {
  const slot = s.slotsView().find((x) => x.time === '12:30');
  const fits = Math.floor(slot.groupableMins / 2.96); // California group prep time from 2019
  let added = 0;
  // Several groups book the same slot until it's full
  outer: for (let gi = 0; gi < 5; gi++) {
    const g = s.createGroup(owner, { groupName: `Crew ${gi}`, groupType: 'construction', slot: '12:30' });
    for (let i = 0; i < 10; i++) {
      try { s.addLine(g.code, { personName: `P${i}`, itemId: 'california', qty: 1 }); added++; }
      catch (e) { assert.match(e.message, /full/); break outer; }
    }
  }
  assert.equal(added, fits);
});

test('input validation rejects bad lines', () => {
  const g = s.createGroup(owner, { groupName: 'Crew', groupType: 'office', slot: '12:00' });
  assert.throws(() => s.addLine(g.code, { personName: '', itemId: 'california', qty: 1 }), /name/);
  assert.throws(() => s.addLine(g.code, { personName: 'A', itemId: 'pizza', qty: 1 }), /menu/);
  assert.throws(() => s.addLine(g.code, { personName: 'A', itemId: 'california', qty: 0 }), /Quantity/);
  assert.throws(() => s.addLine(g.code, { personName: 'A', itemId: 'california', qty: 2.5 }), /Quantity/);
});

test('mock payment validates and locks the order', () => {
  const g = s.createGroup(owner, { groupName: 'Crew', groupType: 'military', slot: '12:00' });
  assert.throws(() => s.payAndSubmit(owner, g.code, pay), /at least one/);
  s.addLine(g.code, { personName: 'A', itemId: 'carnitas', qty: 2 });
  assert.throws(() => s.payAndSubmit(owner, g.code, { ...pay, cardNumber: '123' }), /16 digits/);
  s.payAndSubmit(owner, g.code, pay);
  assert.equal(g.status, 'locked');
  assert.equal(g.units.length, 2);
  assert.throws(() => s.addLine(g.code, { personName: 'B', itemId: 'carnitas', qty: 1 }), /locked/);
});

test('unpaid groups are released at lock time and free their slot', () => {
  const g = s.createGroup(owner, { groupName: 'Crew', groupType: 'students', slot: '11:00' });
  s.addLine(g.code, { personName: 'A', itemId: 'california', qty: 1 });
  setClock({ time: '10:59' });
  s.tick();
  assert.equal(g.status, 'released');
  assert.equal(s.slotsView().find((x) => x.time === '11:00').groupBookedMins, 0);
});

test('walk-ins and groups share one queue, tap-off marks ready', () => {
  const w = s.createWalkIn(owner, { lines: [{ itemId: 'california', qty: 2 }] });
  const q = s.queueView();
  assert.equal(q.cookNow[0].id, w.id);
  w.units.forEach((u) => s.toggleUnit(owner, w.id, u.id));
  assert.equal(w.status, 'ready');
  s.closeOrder(owner, w.id, 'picked_up');
  assert.equal(w.status, 'picked_up');
});

test('same seed gives the same simulated day', () => {
  const a = simulateDay({ level: 'high', seed: 42 });
  const b = simulateDay({ level: 'high', seed: 42 });
  assert.deepEqual(a.slotted.metrics.onTime, b.slotted.metrics.onTime);
  assert.deepEqual(a.fcfs.metrics.onTime, b.fcfs.metrics.onTime);
});

test('adding burritos can never push the deadline into the past, so paying always works', () => {
  setClock({ time: '10:55' }); // not exactly 30 min out: the clock keeps ticking during the test
  const g = s.createGroup(owner, { groupName: 'Crew', groupType: 'construction', slot: '11:30' });
  let added = 0;
  for (let i = 0; i < 25; i++) {
    try { s.addLine(g.code, { personName: `P${i}`, itemId: 'carne-asada', qty: 1 }); added++; }
    catch (e) { assert.match(e.message, /too many|full/); break; }
  }
  assert.ok(added > 0);
  s.payAndSubmit(owner, g.code, pay);
  assert.equal(g.status, 'locked');
});

test('a signed-out request to pay gets a sign-in error, not a permissions error', () => {
  const g = s.createGroup(owner, { groupName: 'Crew', groupType: 'office', slot: '12:00' });
  s.addLine(g.code, { personName: 'A', itemId: 'carnitas', qty: 1 });
  assert.throws(() => s.payAndSubmit(undefined, g.code, pay), (e) => e.status === 401);
});

test('"Start now" moves a paid booked order into Cook next, ahead of walk-ins that just arrived', () => {
  setClock({ time: '10:35' });
  const g = s.createGroup(owner, { groupName: 'Judges', groupType: 'other', slot: '12:00' });
  s.addLine(g.code, { personName: 'A', itemId: 'california', qty: 2 });
  s.payAndSubmit(owner, g.code, pay);
  assert.ok(s.queueView().later.some((o) => o.id === g.id));
  s.createWalkIn(owner, { lines: [{ itemId: 'carnitas', qty: 1 }] });
  s.startNow(owner, g.id);
  assert.equal(s.queueView().cookNow[0].id, g.id);
});
