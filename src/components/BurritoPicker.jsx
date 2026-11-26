import { money } from '../lib/format.js';

// Three big buttons; the menu is short on purpose.
export default function BurritoPicker({ menu, value, onChange }) {
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {menu?.map((m) => (
        <button type="button" key={m.id} onClick={() => onChange(m.id)} aria-pressed={value === m.id}
          className={`rounded-xl border-2 p-3 text-left transition-colors ${value === m.id ? 'border-ink bg-white' : 'border-line bg-white/60 hover:border-ink/40'}`}>
          <span className="flex items-baseline justify-between gap-2">
            <span className="font-display text-lg font-bold">{m.name}</span>
            <span className="font-bold">{money(m.price)}</span>
          </span>
          <span className="mt-1 block text-sm text-ink/60">{m.blurb}</span>
        </button>
      ))}
    </div>
  );
}
