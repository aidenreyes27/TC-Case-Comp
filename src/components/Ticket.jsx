import { time, until } from '../lib/format.js';

const SHORT = { california: 'CALI', 'carne-asada': 'ASADA', carnitas: 'CARN' };

export default function Ticket({ o, menu, now, onUnit, onClose, compact = false }) {
  const tone = o.readyAt ? 'bg-nopal' : o.atRisk || o.late ? 'bg-chile' : o.kind === 'group' ? 'bg-pacific' : 'bg-marigold';
  const name = o.kind === 'group' ? o.groupName : o.customerName || 'Walk-in';
  return (
    <article className={`ticket clip-in w-full ${compact ? '' : 'sm:w-[17.5rem]'} shrink-0`} aria-label={`Ticket ${o.ticket}, ${name}`}>
      <div className={`h-2 ${tone}`} />
      <div className="px-4 pt-3">
        <div className="flex items-start justify-between gap-2">
          <p className="font-display text-4xl font-extrabold leading-none">{o.ticket}</p>
          <div className="text-right">
            <span className={`inline-block rounded-md px-2 py-0.5 text-xs font-bold ${o.kind === 'group' ? 'bg-pacific/15 text-pacific' : 'bg-marigold/25'}`}>{o.kind === 'group' ? `Group · ${o.burritos}` : 'Walk-in'}</span>
            {o.kind === 'group' && <p className={`mt-1 text-xs font-bold ${o.paid ? 'text-nopal' : 'text-chile'}`}>{o.paid ? 'Paid' : 'Not paid'}</p>}
          </div>
        </div>
        <p className="mt-1 truncate font-bold">{name}</p>
        <p className="text-sm">
          {o.readyAt ? <span className="font-bold text-nopal">Ready {time(o.readyAt)}</span>
            : o.status === 'open' ? <span className="text-ink/60">Collecting · pickup {time(o.dueAt)}</span>
            : <><span className={o.atRisk ? 'font-bold text-chile' : 'text-ink/70'}>{o.atRisk ? 'Behind, start now' : o.kind === 'walkin' || o.startBy <= now ? 'Cook now' : `Start ${until(o.startBy, now)}`}</span><span className="text-ink/50"> · due {time(o.dueAt)}</span></>}
        </p>
      </div>

      {!compact && o.units?.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5 px-4">
          {o.units.map((u) => (
            <button key={u.id} onClick={() => onUnit?.(o, u)} disabled={!onUnit || ['picked_up', 'no_show'].includes(o.status)}
              title={`${menu?.find((m) => m.id === u.itemId)?.name}${u.person ? ` for ${u.person}` : ''}`}
              aria-pressed={!!u.doneAt}
              className={`rounded-md border-2 px-1.5 py-1 text-left text-[11px] font-bold leading-tight transition-colors
                ${u.doneAt ? 'border-nopal bg-nopal text-white line-through decoration-2' : 'border-ink/20 bg-white hover:border-ink'}`}>
              {SHORT[u.itemId]}{u.person && <span className="block font-normal opacity-75">{u.person}</span>}
            </button>
          ))}
        </div>
      )}
      {compact && <p className="px-4 pt-1 text-sm text-ink/60">{o.burritos} burritos · {o.prepMins} prep min</p>}

      {!compact && o.units?.length > 0 && (
        <div className="mt-3 px-4">
          <div className="flex justify-between text-xs font-bold text-ink/60"><span>{o.done} of {o.burritos} wrapped</span></div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-paper"><div className="h-full bg-nopal transition-all" style={{ width: `${(o.done / o.burritos) * 100}%` }} /></div>
        </div>
      )}
      {onClose && o.status === 'ready' && (
        <div className="mt-3 grid grid-cols-2 gap-2 px-4">
          <button className="btn-dark py-2 text-sm" onClick={() => onClose(o, 'picked_up')}>Picked up</button>
          <button className="btn-ghost py-2 text-sm" onClick={() => onClose(o, 'no_show')}>No-show</button>
        </div>
      )}
    </article>
  );
}
