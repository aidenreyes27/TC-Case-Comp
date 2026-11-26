// Demo clock. The demo can run at "11:05 AM" at any real time of day,
// optionally sped up, so every promised feature can be shown on demand.
let anchorReal = Date.now();
let anchorDemo = todayAt('10:15');
let speed = 1;

export function todayAt(hhmm, base = new Date()) {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date(base);
  d.setHours(h, m, 0, 0);
  return d.getTime();
}
export function now() { return anchorDemo + (Date.now() - anchorReal) * speed; }
export function setClock({ time, speed: s }) {
  const current = now();
  anchorReal = Date.now();
  anchorDemo = time ? todayAt(time, new Date(current)) : current;
  if (s) speed = Math.max(1, Math.min(60, Number(s)));
}
export function clockState() { return { now: now(), speed }; }
export const MIN = 60_000;
