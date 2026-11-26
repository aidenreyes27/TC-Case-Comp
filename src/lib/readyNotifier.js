import { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { chime, unlockAudio } from './chime.js';

export const notificationsSupported = () => typeof window !== 'undefined' && 'Notification' in window && window.isSecureContext;

let swReg = null;
export async function registerAlertWorker() {
  if (!('serviceWorker' in navigator) || !window.isSecureContext) return null;
  try { swReg = await navigator.serviceWorker.register('/sw.js'); } catch { swReg = null; }
  return swReg;
}

// Called from a click, so the browser allows the permission prompt and audio.
export async function enableReadyAlerts() {
  unlockAudio();
  localStorage.setItem('bb-ready-sound', 'on');
  if (!notificationsSupported()) return 'unsupported';
  const perm = await Notification.requestPermission();
  if (perm === 'granted') await registerAlertWorker();
  return perm;
}

// Watches the signed-in crew lead's group orders. When one turns "ready": a system
// notification (if allowed), an in-app banner, a chime, a buzz on phones, and a
// flashing tab title. The page has to stay open; there is no push server.
export function useReadyNotifier(enabled) {
  const prev = useRef(null);
  const [banner, setBanner] = useState(null);

  useEffect(() => {
    if (!enabled) return undefined;
    if (notificationsSupported() && Notification.permission === 'granted') registerAlertWorker();
    if (localStorage.getItem('bb-ready-sound') === 'on') {
      const u = () => unlockAudio();
      window.addEventListener('pointerdown', u, { once: true });
    }
    const tick = async () => {
      let list;
      try { list = await api.get('/groups/mine'); } catch { return; }
      if (prev.current) {
        for (const o of list) {
          const before = prev.current.get(o.id);
          if (o.status === 'ready' && before && before !== 'ready') announce(o, setBanner);
        }
      }
      prev.current = new Map(list.map((o) => [o.id, o.status]));
    };
    tick();
    const id = setInterval(tick, 3000);
    return () => clearInterval(id);
  }, [enabled]);

  return { banner, dismiss: () => setBanner(null) };
}

async function announce(o, setBanner) {
  const title = `${o.groupName} is ready`;
  const body = `${o.burritos} burritos are ready for pickup at Burrito Barrio.`;
  const url = `/g/${o.code}`;
  if (notificationsSupported() && Notification.permission === 'granted') {
    try {
      const reg = swReg ?? (await navigator.serviceWorker?.getRegistration());
      if (reg) await reg.showNotification(title, { body, tag: o.id, data: { url }, icon: '/favicon.svg', vibrate: [200, 100, 200] });
      else {
        const n = new Notification(title, { body, tag: o.id });
        n.onclick = () => { window.focus(); window.location.assign(url); n.close(); };
      }
    } catch { /* fall back to the banner below */ }
  }
  if (localStorage.getItem('bb-ready-sound') === 'on') chime('group');
  try { navigator.vibrate?.([200, 100, 200]); } catch { /* not supported */ }
  setBanner({ title, body, code: o.code, key: Date.now() });
  flashTitle(title);
}

let flashing = null;
function flashTitle(text) {
  const original = document.title.startsWith('Ready:') ? 'Burrito Barrio · Crew orders' : document.title;
  clearInterval(flashing);
  let on = false;
  flashing = setInterval(() => { on = !on; document.title = on ? `Ready: ${text}` : original; }, 1000);
  const stop = () => { clearInterval(flashing); document.title = original; window.removeEventListener('focus', stop); };
  if (document.hasFocus()) setTimeout(stop, 6000); else window.addEventListener('focus', stop);
}
