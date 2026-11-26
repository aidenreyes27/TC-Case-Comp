// Business settings in one place. Change these, not the logic.
// Prep minutes are per burrito (one cook). Replace with the averages from the
// 2019 operating records if your team computed different ones.
export const MENU = [
  { id: 'california', name: 'California', price: 9.49, cost: 3.91, prepMins: 3.0,
    blurb: 'Carne asada, fries, cheese, guac, sour cream' },
  { id: 'carne-asada', name: 'Carne Asada', price: 10.49, cost: 4.85, prepMins: 3.5,
    blurb: 'Grilled steak, guac, pico, salsa' },
  { id: 'carnitas', name: 'Carnitas', price: 8.99, cost: 4.30, prepMins: 3.0,
    blurb: 'Slow-cooked pork, onion, cilantro, salsa verde' },
];

// The only owner account. Owners see the dashboard, sales, simulator, and AI brief.
export const OWNER_EMAIL = 'aidenreyes27@berkeley.edu';

export const SLOT_MINUTES = 30;
export const OPEN = '10:30';   // first pickup slot
export const CLOSE = '14:00';  // last slot ends here

// Cooks on the line for each slot start time. Capacity = staff x 30 prep minutes.
export const DEFAULT_STAFF = {
  '10:30': 2, '11:00': 3, '11:30': 3, '12:00': 3, '12:30': 3, '13:00': 2, '13:30': 2,
};

export const SETTINGS = {
  walkInReserve: 0.4,      // share of each slot's prep minutes held back for walk-ins
  walkInPromiseMins: 15,   // walk-in counts as on time if ready within this
  lockBufferMins: 15,      // group edits lock this long before the latest start time
  minLeadMins: 30,         // a new group order needs at least this much notice (leaves time to collect and pay)
  maxGroupSize: 40,        // burritos per group order
  maxQtyPerLine: 5,
};
