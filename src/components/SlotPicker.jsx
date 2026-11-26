import { slotLabel } from '../lib/format.js';

// Each pickup time shows how much of the kitchen's group capacity is already
// booked. Full or too-soon times can't be picked, which is the whole point.
export default function SlotPicker({ slots, value, onChange, needMins = 0, currentSlot }) {
  if (!slots) return <div className="h-64 animate-pulse rounded-2xl bg-white" />;
  return (
    <div role="radiogroup" aria-label="Pickup time" className="space-y-2">
      {slots.map((s) => {
        const ownMins = s.time === currentSlot ? needMins : 0;
        const free = s.availableMins + ownMins;
        const fits = free >= Math.max(needMins, 3);
        const disabled = !s.bookable || !fits;
        const used = Math.min(1, (s.groupBookedMins - ownMins) / s.groupableMins);
        const room = Math.floor(free / 3);
        const selected = value === s.time;
        return (
          <button type="button" role="radio" aria-checked={selected} key={s.time} disabled={disabled}
            onClick={() => onChange(s.time)}
            className={`flex w-full items-center gap-4 rounded-xl border-2 px-4 py-3 text-left transition-colors
              ${selected ? 'border-ink bg-white' : 'border-transparent bg-white/70 hover:border-ink/30'}
              disabled:cursor-not-allowed disabled:opacity-45`}>
            <span className="w-20 font-display text-lg font-bold">{slotLabel(s.time)}</span>
            <span className="relative h-3 flex-1 overflow-hidden rounded-full bg-paper">
              <span className={`absolute inset-y-0 left-0 rounded-full ${used > 0.85 ? 'bg-chile' : used > 0.6 ? 'bg-marigold' : 'bg-nopal'}`}
                style={{ width: `${Math.max(used * 100, used > 0 ? 4 : 0)}%` }} />
            </span>
            <span className="w-36 text-right text-sm">
              {!s.bookable ? <span className="text-ink/50">Too soon</span>
                : !fits ? <span className="font-bold text-chile">Full</span>
                : <span><b>{room}</b> <span className="text-ink/60">burritos of room</span></span>}
            </span>
          </button>
        );
      })}
      <p className="pt-1 text-xs text-ink/50">Room is based on cooks on shift. Part of every half hour is held for walk-in customers.</p>
    </div>
  );
}
