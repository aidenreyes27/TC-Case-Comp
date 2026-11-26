import { useState } from 'react';
import { notificationsSupported, enableReadyAlerts } from '../lib/readyNotifier.js';

// Turns on "order ready" alerts. Browsers only allow the permission prompt and
// sound after a tap, so this has to be a button.
export default function ReadyAlerts() {
  const supported = notificationsSupported();
  const [perm, setPerm] = useState(supported ? Notification.permission : 'unsupported');
  const [soundOn, setSoundOn] = useState(localStorage.getItem('bb-ready-sound') === 'on');

  if (perm === 'granted' || (perm === 'unsupported' && soundOn)) {
    return <span className="rounded-full bg-nopal/15 px-3 py-1 text-sm font-bold text-nopal">{perm === 'granted' ? 'Ready alerts on' : 'Sound alert on · keep this page open'}</span>;
  }
  if (perm === 'denied') {
    return <span className="text-xs text-ink/50" title="Allow notifications for this site in your browser settings">Alerts blocked in browser settings</span>;
  }
  return (
    <button className="btn-ghost px-3 py-1.5 text-sm"
      onClick={async () => { const p = await enableReadyAlerts(); setPerm(p); setSoundOn(true); }}>
      {perm === 'unsupported' ? 'Play a sound when it’s ready' : 'Alert me when it’s ready'}
    </button>
  );
}
