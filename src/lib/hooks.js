import { useEffect, useRef, useState, useCallback } from 'react';
import { api } from '../api.js';

// Poll an endpoint. The TRD says 10s; the demo uses 2s so changes feel live.
export function usePoll(path, ms = 2000, enabled = true) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const alive = useRef(true);
  const load = useCallback(async () => {
    try { const d = await api.get(path); if (alive.current) { setData(d); setError(null); } }
    catch (e) { if (alive.current) setError(e.message); }
  }, [path]);
  useEffect(() => {
    alive.current = true;
    if (!enabled) return undefined;
    load();
    const id = setInterval(load, ms);
    return () => { alive.current = false; clearInterval(id); };
  }, [load, ms, enabled]);
  return { data, error, reload: load, setData };
}

// Demo clock that ticks locally between server syncs.
let clockCache = { now: Date.now(), speed: 1, at: Date.now() };
export async function syncClock() {
  const c = await api.get('/clock');
  clockCache = { ...c, at: Date.now() };
  return clockCache;
}
export const demoNow = () => clockCache.now + (Date.now() - clockCache.at) * clockCache.speed;

export function useDemoNow() {
  const [t, setT] = useState(demoNow());
  useEffect(() => {
    syncClock().then(() => setT(demoNow())).catch(() => {});
    const tick = setInterval(() => setT(demoNow()), 1000);
    const sync = setInterval(() => syncClock().catch(() => {}), 10000);
    return () => { clearInterval(tick); clearInterval(sync); };
  }, []);
  return t;
}
