export const time = (t) => new Date(t).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
export const money = (n) => `$${Number(n ?? 0).toFixed(2)}`;
export const slotLabel = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
};
export function until(target, now) {
  const mins = Math.round((target - now) / 60000);
  if (mins <= 0) return mins === 0 ? 'now' : `${-mins} min ago`;
  if (mins < 60) return `in ${mins} min`;
  return `in ${Math.floor(mins / 60)} h ${mins % 60} min`;
}
export const GROUP_TYPES = {
  construction: 'Construction crew', military: 'Military unit', office: 'Office team', students: 'Students', other: 'Other group',
};
export const pct = (v) => (v == null ? '—' : `${Math.round(v)}%`);
