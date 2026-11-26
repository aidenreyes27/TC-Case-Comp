// Business settings in one place. Change these, not the logic.
// Prep minutes per burrito (one cook) come from the 2019 operating records
// (estimated_prep_minutes ÷ quantity, 300 orders):
//   prepMins      = small orders of 2–4 burritos (used for walk-ins)
//   groupPrepMins = group orders, which batch about 13% faster per burrito
export const MENU = [
  { id: 'california', name: 'California', price: 9.49, cost: 3.91, prepMins: 3.4, groupPrepMins: 2.96,
    blurb: 'Carne asada, fries, cheese, guac, sour cream' },
  { id: 'carne-asada', name: 'Carne Asada', price: 10.49, cost: 4.85, prepMins: 4.1, groupPrepMins: 3.59,
    blurb: 'Grilled steak, guac, pico, salsa' },
  { id: 'carnitas', name: 'Carnitas', price: 8.99, cost: 4.30, prepMins: 3.7, groupPrepMins: 3.25,
    blurb: 'Slow-cooked pork, onion, cilantro, salsa verde' },
];

// The only owner account. Owners see the dashboard, sales, simulator, and AI brief.
export const OWNER_EMAIL = 'aidenreyes27@berkeley.edu';

export const SLOT_MINUTES = 30;
export const OPEN = '10:30';   // first pickup slot
export const CLOSE = '14:00';  // last slot ends here

// Cooks on the line for each slot start time. Capacity = staff x 30 prep minutes.
// Matches 2019: lunch ran with 3–4 on shift (average 3.45).
export const DEFAULT_STAFF = {
  '10:30': 3, '11:00': 3, '11:30': 3, '12:00': 4, '12:30': 4, '13:00': 3, '13:30': 3,
};

export const SETTINGS = {
  walkInReserve: 0.4,      // share of each slot's prep minutes held back for walk-ins
  walkInPromiseMins: 15,   // walk-in counts as on time if ready within this (2019 promise for walk-ins)
  lockBufferMins: 15,      // group edits lock this long before the latest start time
  minLeadMins: 30,         // a new group order needs at least this much notice (leaves time to collect and pay)
  maxGroupSize: 40,        // burritos per group order
  maxQtyPerLine: 5,
};
