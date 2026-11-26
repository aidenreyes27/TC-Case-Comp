import { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import Shell from '../components/Shell.jsx';
import BurritoPicker from '../components/BurritoPicker.jsx';
import SlotPicker from '../components/SlotPicker.jsx';
import PayModal from '../components/PayModal.jsx';
import { api, getUser } from '../api.js';
import { usePoll, useDemoNow } from '../lib/hooks.js';
import { money, slotLabel, time, until, GROUP_TYPES } from '../lib/format.js';
import { STATUS } from './LeadHome.jsx';

const mine = (code) => JSON.parse(localStorage.getItem(`bb-lines-${code}`) ?? '[]');
const rememberLine = (code, id) => localStorage.setItem(`bb-lines-${code}`, JSON.stringify([...mine(code), id]));

export default function GroupOrder() {
  const { code } = useParams();
  const { data: o, error, setData } = usePoll(`/groups/${code}`, 2000);
  const [menu, setMenu] = useState(null);
  const now = useDemoNow();
  useEffect(() => { api.get('/menu').then((d) => setMenu(d.menu)); }, []);

  if (error && !o) {
    return <Shell><div className="panel mt-10 text-center"><p className="font-display text-2xl font-bold">{error}</p><p className="mt-2 text-ink/60">Ask your crew lead to send the link again.</p></div></Shell>;
  }
  if (!o || !menu) return <Shell><div className="h-96 animate-pulse rounded-2xl bg-white" /></Shell>;

  const [label, cls] = STATUS[o.status];
  return (
    <Shell>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-ink/60">{GROUP_TYPES[o.groupType]} · led by {o.leadName}</p>
          <h1 className="text-4xl font-extrabold sm:text-5xl">{o.groupName}</h1>
          <p className="mt-2 text-lg">Pickup at <b>{slotLabel(o.slot)}</b> · {o.burritos} burritos · {money(o.total)}</p>
        </div>
        <span className={`rounded-full px-4 py-1.5 font-bold ${cls}`}>{label}</span>
      </div>

      {o.status === 'open' ? <OpenOrder o={o} menu={menu} now={now} onChange={setData} code={code} />
        : <Tracker o={o} menu={menu} now={now} />}
    </Shell>
  );
}

function OpenOrder({ o, menu, now, onChange, code }) {
  const [paying, setPaying] = useState(false);
  const [moving, setMoving] = useState(false);
  const [slots, setSlots] = useState(null);
  const [copied, setCopied] = useState(false);
  const link = `${window.location.origin}/g/${o.code}`;
  const minsLeft = Math.round((o.lockAt - now) / 60000);
  const urgent = minsLeft <= 10;

  const byPerson = useMemo(() => {
    const m = new Map();
    o.lines.forEach((l) => m.set(l.personName, [...(m.get(l.personName) ?? []), l]));
    return [...m.entries()];
  }, [o.lines]);

  async function remove(lineId) {
    try { onChange(await api.del(`/groups/${code}/lines/${lineId}`)); } catch (e) { alert(e.message); }
  }
  async function openMove() { setMoving(true); setSlots((await api.get('/slots')).slots); }
  async function move(slot) {
    try { onChange(await api.post(`/groups/${code}/move`, { slot })); setMoving(false); } catch (e) { alert(e.message); }
  }

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_1fr]">
      <div className="space-y-6">
        <div className={`rounded-2xl p-4 ${urgent ? 'bg-chile text-white' : 'bg-ink text-paper'}`} aria-live="polite">
          <p className="font-display text-xl font-bold">Changes close {until(o.lockAt, now)} ({time(o.lockAt)})</p>
          <p className="opacity-80">{o.isLead ? 'Pay before then to hold the slot. Unpaid orders are released so the kitchen can plan.' : 'Add your burrito before then. After that your crew lead sends the order to the kitchen.'}</p>
        </div>

        {o.isLead && (
          <div className="panel">
            <p className="font-display text-lg font-bold">Share with your crew</p>
            <p className="text-sm text-ink/60">Anyone with the link can add a burrito. No sign-in needed.</p>
            <div className="mt-3 flex gap-2">
              <input readOnly value={link} className="field font-mono text-sm" onFocus={(e) => e.target.select()} aria-label="Share link" />
              <button className="btn-dark whitespace-nowrap" onClick={() => { navigator.clipboard?.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>{copied ? 'Copied' : 'Copy link'}</button>
            </div>
            <p className="mt-2 text-sm text-ink/60">Code <b className="tracking-widest">{o.code}</b></p>
          </div>
        )}

        <AddLine code={code} menu={menu} onAdded={onChange} />

      </div>

      <aside className="space-y-4">
        <div className="ticket px-5 pt-5">
          <div className="flex items-baseline justify-between">
            <p className="font-display text-xl font-bold">The order</p>
            <p className="text-sm text-ink/60">#{o.ticket}</p>
          </div>
          {byPerson.length === 0 && <p className="py-8 text-center text-ink/50">No burritos yet. Add yours first, then share the link.</p>}
          <ul className="mt-3 divide-y divide-dashed divide-line">
            {byPerson.map(([person, lines]) => (
              <li key={person} className="py-2.5">
                <p className="font-bold">{person}</p>
                {lines.map((l) => (
                  <div key={l.id} className="flex items-center justify-between text-sm">
                    <span>{l.qty} × {menu.find((m) => m.id === l.itemId).name}{l.note && <span className="text-ink/50"> · {l.note}</span>}</span>
                    {(o.isLead || mine(code).includes(l.id)) && (
                      <button onClick={() => remove(l.id)} className="font-bold text-chile hover:underline" aria-label={`Remove ${person}'s burrito`}>Remove</button>
                    )}
                  </div>
                ))}
              </li>
            ))}
          </ul>
          <div className="mt-2 flex justify-between border-t-2 border-ink pt-2 font-bold"><span>{o.burritos} burritos</span><span>{money(o.total)}</span></div>
        </div>

        {o.isLead && (
          <>
            <button className="btn-primary w-full py-3.5 text-lg" disabled={!o.lines.length} onClick={() => setPaying(true)}>Pay {money(o.total)} and send to kitchen</button>
            {!moving ? <button className="btn-ghost w-full" onClick={openMove}>Change pickup time</button>
              : <div className="panel"><SlotPicker slots={slots} value={o.slot} currentSlot={o.slot} needMins={o.prepMins} onChange={move} /><button className="btn-ghost mt-3 w-full" onClick={() => setMoving(false)}>Keep {slotLabel(o.slot)}</button></div>}
          </>
        )}
        {!o.isLead && !getUser() && <p className="text-center text-sm text-ink/50">Running a crew? <Link to="/" className="font-bold underline">Start your own group order</Link></p>}
      </aside>

      {paying && <PayModal total={o.total} burritos={o.burritos} onClose={() => setPaying(false)}
        onPay={async (card) => { onChange(await api.post(`/groups/${code}/pay`, card)); setPaying(false); }} />}
    </div>
  );
}

function AddLine({ code, menu, onAdded }) {
  const [personName, setPerson] = useState(localStorage.getItem('bb-name') ?? '');
  const [itemId, setItem] = useState(menu[0].id);
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState('');
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  async function add(e) {
    e.preventDefault(); setBusy(true); setMsg(null);
    try {
      const o = await api.post(`/groups/${code}/lines`, { personName, itemId, qty, note });
      localStorage.setItem('bb-name', personName);
      rememberLine(code, o.lines[o.lines.length - 1].id);
      onAdded(o); setQty(1); setNote('');
      setMsg({ ok: true, text: `Added ${qty} ${menu.find((m) => m.id === itemId).name} for ${personName}.` });
    } catch (err) { setMsg({ ok: false, text: err.message }); }
    finally { setBusy(false); }
  }

  return (
    <form onSubmit={add} className="panel space-y-4">
      <p className="font-display text-xl font-bold">Add a burrito</p>
      <div><label className="label" htmlFor="pn">Your name</label><input id="pn" className="field" value={personName} onChange={(e) => setPerson(e.target.value)} maxLength={30} placeholder="Maria" /></div>
      <BurritoPicker menu={menu} value={itemId} onChange={setItem} />
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <span className="label">How many</span>
          <div className="flex items-center gap-1 rounded-xl border-2 border-line bg-white p-1">
            <button type="button" className="h-9 w-9 rounded-lg text-xl font-bold hover:bg-paper" onClick={() => setQty(Math.max(1, qty - 1))} aria-label="One fewer">−</button>
            <span className="w-8 text-center text-lg font-bold" aria-live="polite">{qty}</span>
            <button type="button" className="h-9 w-9 rounded-lg text-xl font-bold hover:bg-paper" onClick={() => setQty(Math.min(5, qty + 1))} aria-label="One more">+</button>
          </div>
        </div>
        <div className="min-w-[12rem] flex-1"><label className="label" htmlFor="nt">Note (optional)</label><input id="nt" className="field" value={note} onChange={(e) => setNote(e.target.value)} maxLength={80} placeholder="No onions" /></div>
      </div>
      {msg && <p role="status" className={`rounded-lg px-3 py-2 text-sm font-bold ${msg.ok ? 'bg-nopal/10 text-nopal' : 'bg-chile/10 text-chile'}`}>{msg.text}</p>}
      <button className="btn-dark w-full py-3" disabled={busy}>Add to order</button>
    </form>
  );
}

const STEPS = [['locked', 'Sent to kitchen'], ['cooking', 'Cooking'], ['ready', 'Ready for pickup'], ['picked_up', 'Picked up']];

function Tracker({ o, menu, now }) {
  if (o.status === 'released') {
    return <div className="panel mt-6"><p className="font-display text-2xl font-bold">This order was released</p><p className="mt-1 text-ink/60">It wasn’t paid before changes closed, so the slot went back to the kitchen. Start a new order for a later time.</p></div>;
  }
  const order = ['locked', 'cooking', 'ready', 'picked_up'];
  const at = o.status === 'no_show' ? 2 : order.indexOf(o.status);
  const pct = o.burritos ? Math.round((o.done / o.burritos) * 100) : 0;
  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_1fr]">
      <div className="panel">
        <p className="font-display text-lg font-bold text-ink/60">Live from the kitchen</p>
        <p className="mt-1 font-display text-6xl font-extrabold">{o.done}<span className="text-ink/30"> / {o.burritos}</span></p>
        <p className="text-ink/60">burritos wrapped</p>
        <div className="mt-4 h-4 overflow-hidden rounded-full bg-paper"><div className="h-full rounded-full bg-nopal transition-all duration-700" style={{ width: `${pct}%` }} /></div>
        <ol className="mt-6 grid grid-cols-4 gap-2 text-sm">
          {STEPS.map(([k, l], i) => (
            <li key={k} className={`border-t-4 pt-2 font-bold ${i <= at ? 'border-nopal text-ink' : 'border-line text-ink/40'}`}>{l}</li>
          ))}
        </ol>
        <p className="mt-6 text-ink/70">
          {o.readyAt ? <>Ready at <b>{time(o.readyAt)}</b>{o.readyAt <= o.dueAt ? ', on time.' : `, ${Math.round((o.readyAt - o.dueAt) / 60000)} min after pickup time.`}</>
            : <>Kitchen starts by <b>{time(o.startBy)}</b> to have it ready at <b>{time(o.dueAt)}</b> ({until(o.dueAt, now)}).</>}
        </p>
      </div>
      <div className="ticket self-start px-5 pt-5">
        <div className="flex justify-between"><p className="font-display text-xl font-bold">Receipt</p><p className="text-sm text-ink/60">#{o.ticket}</p></div>
        <ul className="mt-3 space-y-1 text-sm">
          {menu.map((m) => {
            const n = o.lines.filter((l) => l.itemId === m.id).reduce((s, l) => s + l.qty, 0);
            return n ? <li key={m.id} className="flex justify-between"><span>{n} × {m.name}</span><span>{money(n * m.price)}</span></li> : null;
          })}
        </ul>
        <div className="mt-3 flex justify-between border-t-2 border-ink pt-2 font-bold"><span>{o.paid ? 'Paid' : 'Due at pickup'}</span><span>{money(o.total)}</span></div>
        {o.payRef && <p className="mt-2 text-xs text-ink/50">Ref {o.payRef} (demo, not charged)</p>}
      </div>
    </div>
  );
}
