import { useEffect, useState } from 'react';
import Shell from '../components/Shell.jsx';
import Ticket from '../components/Ticket.jsx';
import { api } from '../api.js';
import { usePoll, useDemoNow } from '../lib/hooks.js';
import { money, time } from '../lib/format.js';

export default function Counter() {
  const { data: q, error, reload } = usePoll('/queue', 1500);
  const [menu, setMenu] = useState(null);
  const [toast, setToast] = useState(null);
  const now = useDemoNow();
  useEffect(() => { api.get('/menu').then((d) => setMenu(d.menu)); }, []);

  const flash = (text, bad = false) => { setToast({ text, bad }); setTimeout(() => setToast(null), 3500); };
  const act = async (fn) => { try { await fn(); reload(); } catch (e) { flash(e.message, true); } };

  async function rush(level) {
    try {
      const r = await api.post('/sim/rush', { level });
      const ok = r.groups.filter((g) => g.ok).length;
      const no = r.groups.length - ok;
      flash(`${r.walkIns} walk-ins arriving over the next 45 min, ${ok} group orders booked${no ? `, ${no} turned away by capacity` : ''}.`);
      reload();
    } catch (e) { flash(e.message, true); }
  }

  return (
    <Shell wide>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="mr-auto text-4xl font-extrabold">Counter</h1>
        {q && (
          <div className="flex items-center gap-4 rounded-xl bg-white px-4 py-2 text-sm">
            <span><b className="text-lg">{q.staff}</b> cooks on</span>
            <span className={q.backlogMins > 15 ? 'font-bold text-chile' : ''}><b className="text-lg">{Math.ceil(q.backlogMins)}</b> min of work queued</span>
            <span><b className="text-lg">{q.ready.length}</b> waiting for pickup</span>
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border-2 border-dashed border-line p-3 text-sm">
        <span className="font-bold text-ink/60">Demo tools</span>
        <span className="text-ink/40">Simulate a rush:</span>
        {[['low', 'Slow'], ['normal', 'Typical'], ['high', 'Slammed']].map(([k, l]) => (
          <button key={k} className="btn-ghost px-3 py-1.5 text-sm" onClick={() => rush(k)}>{l}</button>
        ))}
        <label className="ml-auto flex cursor-pointer items-center gap-2 font-bold">
          <input type="checkbox" className="h-5 w-5 accent-[#3F8F4E]" checked={!!q?.autoCook} onChange={(e) => act(() => api.post('/kitchen/auto-cook', { on: e.target.checked }))} />
          Auto-cook (simulate the cooks)
        </label>
      </div>

      {error && <p className="mt-4 text-chile">{error}</p>}

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_22rem]">
        <section aria-label="Cook next">
          <div className="flex items-baseline gap-3">
            <h2 className="text-2xl font-extrabold">Cook next</h2>
            <p className="text-sm text-ink/60">Left to right. Sorted by the latest time each order can start and still be on time.</p>
          </div>
          <div className="rail mt-3 h-3 rounded-full" />
          <div className="-mt-1 flex flex-wrap gap-4 px-2">
            {q?.cookNow.length === 0 && <p className="py-10 text-ink/50">Nothing to cook right now. Ring up a walk-in or simulate a rush.</p>}
            {q?.cookNow.map((o) => (
              <Ticket key={o.id} o={o} menu={menu} now={now}
                onUnit={(ord, u) => act(() => api.post(`/orders/${ord.id}/units/${u.id}`))} />
            ))}
          </div>

          <h2 className="mt-10 text-2xl font-extrabold">Booked ahead</h2>
          <p className="text-sm text-ink/60">Group orders that move to Cook next when it’s time to start them.</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {q?.later.length === 0 && <p className="text-ink/50">No upcoming group orders.</p>}
            {q?.later.map((o) => <Ticket key={o.id} o={o} menu={menu} now={now} compact />)}
          </div>
        </section>

        <aside className="space-y-6">
          <WalkIn menu={menu} onDone={(o) => { flash(`Ticket ${o.ticket} added · ${money(o.total)}`); reload(); }} onError={(m) => flash(m, true)} />
          <section aria-label="Ready for pickup">
            <h2 className="text-2xl font-extrabold">Ready for pickup</h2>
            <div className="mt-3 space-y-3">
              {q?.ready.length === 0 && <p className="text-ink/50">Nothing waiting.</p>}
              {q?.ready.map((o) => (
                <ReadyRow key={o.id} o={o} onClose={(outcome) => act(() => api.post(`/orders/${o.id}/close`, { outcome }))} />
              ))}
            </div>
          </section>
        </aside>
      </div>

      {toast && <div role="status" className={`fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-xl px-5 py-3 font-bold shadow-xl ${toast.bad ? 'bg-chile text-white' : 'bg-ink text-paper'}`}>{toast.text}</div>}
    </Shell>
  );
}

function ReadyRow({ o, onClose }) {
  const name = o.kind === 'group' ? o.groupName : o.customerName || 'Walk-in';
  return (
    <div className="clip-in flex items-center gap-3 rounded-xl border-l-8 border-nopal bg-ticket p-3 shadow-sm">
      <p className="w-14 font-display text-2xl font-extrabold">{o.ticket}</p>
      <div className="min-w-0 flex-1">
        <p className="truncate font-bold">{name}</p>
        <p className="text-xs text-ink/60">{o.burritos} burrito{o.burritos > 1 ? 's' : ''} · ready {time(o.readyAt)}{o.kind === 'group' && (o.paid ? ' · paid' : ' · not paid')}</p>
      </div>
      <button className="btn-dark px-3 py-1.5 text-sm" onClick={() => onClose('picked_up')}>Picked up</button>
      {o.kind === 'group' && <button className="btn-ghost px-2.5 py-1.5 text-sm" onClick={() => onClose('no_show')}>No-show</button>}
    </div>
  );
}

function WalkIn({ menu, onDone, onError }) {
  const [counts, setCounts] = useState({});
  const [name, setName] = useState('');
  const total = menu?.reduce((s, m) => s + (counts[m.id] ?? 0) * m.price, 0) ?? 0;
  const n = Object.values(counts).reduce((a, b) => a + b, 0);
  const bump = (id, d) => setCounts({ ...counts, [id]: Math.max(0, Math.min(10, (counts[id] ?? 0) + d)) });

  async function send() {
    try {
      const o = await api.post('/walkins', { customerName: name, lines: Object.entries(counts).map(([itemId, qty]) => ({ itemId, qty })) });
      setCounts({}); setName(''); onDone(o);
    } catch (e) { onError(e.message); }
  }

  return (
    <section className="rounded-2xl bg-ink p-5 text-paper" aria-label="New walk-in order">
      <h2 className="text-2xl font-extrabold">Walk-in order</h2>
      <div className="mt-4 space-y-2">
        {menu?.map((m) => (
          <div key={m.id} className="flex items-center gap-3 rounded-xl bg-white/5 p-2 pl-3">
            <div className="flex-1"><p className="font-bold">{m.name}</p><p className="text-sm text-paper/60">${m.price.toFixed(2)}</p></div>
            <button className="h-11 w-11 rounded-lg bg-white/10 text-2xl font-bold hover:bg-white/20" onClick={() => bump(m.id, -1)} aria-label={`One fewer ${m.name}`}>−</button>
            <span className="w-7 text-center font-display text-2xl font-bold">{counts[m.id] ?? 0}</span>
            <button className="h-11 w-11 rounded-lg bg-marigold text-2xl font-bold text-ink hover:bg-[#d8920c]" onClick={() => bump(m.id, 1)} aria-label={`One more ${m.name}`}>+</button>
          </div>
        ))}
      </div>
      <input className="mt-3 w-full rounded-xl border-2 border-white/15 bg-transparent px-3 py-2 text-paper placeholder:text-paper/40 focus:border-marigold focus:outline-none"
        value={name} onChange={(e) => setName(e.target.value)} placeholder="Name for the ticket (optional)" maxLength={30} aria-label="Customer name" />
      <button className="btn-primary mt-3 w-full py-3 text-lg" disabled={!n} onClick={send}>Add {n || ''} to queue · ${total.toFixed(2)}</button>
    </section>
  );
}
