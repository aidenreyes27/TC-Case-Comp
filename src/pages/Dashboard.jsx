import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, Legend, CartesianGrid } from 'recharts';
import Shell from '../components/Shell.jsx';
import { api } from '../api.js';
import { usePoll, syncClock } from '../lib/hooks.js';
import { money, pct, slotLabel, time } from '../lib/format.js';

const C = { ink: '#16302B', marigold: '#E9A21B', chile: '#C23B22', nopal: '#3F8F4E', pacific: '#2D6A8A', line: '#D3DAD2' };

export default function Dashboard() {
  const { data, reload } = usePoll('/metrics', 3000);
  const live = data?.live;
  return (
    <Shell wide>
      <div className="flex flex-wrap items-end gap-4">
        <div className="mr-auto">
          <h1 className="text-4xl font-extrabold">Today at Burrito Barrio</h1>
          <p className="text-ink/60">Live numbers update every few seconds{live ? `, as of ${time(live.asOf)}` : ''}.</p>
        </div>
        <ClockControls onChange={reload} />
      </div>

      {live && (
        <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Target label="Group orders on time" r={live.onTime.group} target={85} />
          <Target label="Lunch orders on time" r={live.onTime.lunch} target={90} />
          <div className="panel">
            <p className="text-sm font-bold text-ink/60">Sales today</p>
            <p className="font-display text-4xl font-extrabold">{money(live.revenue)}</p>
            <p className="text-sm text-ink/60">{live.burritos} burritos · {pct(live.grossMarginPct)} margin after ingredients</p>
          </div>
          <div className="panel">
            <p className="text-sm font-bold text-ink/60">Group orders</p>
            <p className="font-display text-4xl font-extrabold">{live.groupOrders}</p>
            <p className="text-sm text-ink/60">{pct(live.groupBurritoShare)} of burritos · {live.noShows} no-shows ({money(live.noShowRevenueKept)} kept, prepaid) · {live.released} released unpaid</p>
          </div>
        </section>
      )}

      <section className="mt-6 grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <LoadChart live={live} staff={data?.staffBySlot} onStaff={reload} />
        <AiBrief hasSim={!!data?.simulation} />
      </section>

      <Simulator sim={data?.simulation} levels={data?.levels} onRun={reload} />
    </Shell>
  );
}

function Target({ label, r, target }) {
  const v = r?.pct;
  const hit = v != null && v >= target;
  return (
    <div className="panel">
      <p className="text-sm font-bold text-ink/60">{label}</p>
      <p className={`font-display text-4xl font-extrabold ${v == null ? 'text-ink/30' : hit ? 'text-nopal' : 'text-chile'}`}>{pct(v)}</p>
      <div className="relative mt-2 h-2 rounded-full bg-paper">
        <div className={`absolute inset-y-0 left-0 rounded-full ${hit ? 'bg-nopal' : 'bg-chile'}`} style={{ width: `${v ?? 0}%` }} />
        <div className="absolute -top-1 h-4 w-0.5 bg-ink" style={{ left: `${target}%` }} title={`Target ${target}%`} />
      </div>
      <p className="mt-1 text-sm text-ink/60">{r?.total ? `${r.onTime} of ${r.total} · target ${target}%` : 'No finished orders yet'}</p>
    </div>
  );
}

function ClockControls({ onChange }) {
  const [t, setT] = useState('11:00');
  const [busy, setBusy] = useState(false);
  const set = async (body) => { setBusy(true); try { await api.post('/clock', body); await syncClock(); onChange(); } finally { setBusy(false); } };
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border-2 border-dashed border-line p-2 text-sm">
      <span className="pl-1 font-bold text-ink/60">Demo clock</span>
      <input type="time" value={t} onChange={(e) => setT(e.target.value)} className="rounded-lg border-2 border-line bg-white px-2 py-1" aria-label="Set demo time" />
      <button className="btn-ghost px-3 py-1 text-sm" disabled={busy} onClick={() => set({ time: t })}>Jump</button>
      {[1, 5, 20].map((s) => <button key={s} className="btn-ghost px-3 py-1 text-sm" disabled={busy} onClick={() => set({ speed: s })}>{s}×</button>)}
      <button className="btn-ghost px-3 py-1 text-sm text-chile" disabled={busy}
        onClick={async () => { if (confirm('Clear every order and start the day over?')) { await api.post('/sim/reset'); onChange(); } }}>Reset day</button>
    </div>
  );
}

function LoadChart({ live, staff, onStaff }) {
  const rows = live?.slots.map((s) => ({ ...s, label: slotLabel(s.time), free: Math.max(0, s.capacityMins - s.bookedMins) })) ?? [];
  const change = async (slot, d) => { try { await api.post('/kitchen/staff', { slot, staff: (staff[slot] ?? 2) + d }); onStaff(); } catch (e) { alert(e.message); } };
  return (
    <div className="panel">
      <h2 className="text-2xl font-extrabold">Kitchen load by half hour</h2>
      <p className="text-sm text-ink/60">Prep minutes due in each half hour against what the cooks on shift can make. Change cooks to see capacity move.</p>
      <div className="mt-4 h-64">
        <ResponsiveContainer>
          <BarChart data={rows} margin={{ left: -18 }}>
            <CartesianGrid vertical={false} stroke={C.line} />
            <XAxis dataKey="label" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip formatter={(v, n) => [`${v} min`, n]} />
            <Bar dataKey="bookedMins" name="Booked prep" stackId="a" fill={C.pacific} />
            <Bar dataKey="free" name="Spare capacity" stackId="a" fill={C.line} radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 grid grid-cols-7 gap-1 text-center text-xs">
        {rows.map((s) => (
          <div key={s.time} className="rounded-lg bg-paper p-1.5">
            <p className="font-bold">{s.utilization == null ? '—' : `${Math.round(s.utilization)}%`}</p>
            <div className="mt-1 flex items-center justify-center gap-1">
              <button className="h-6 w-6 rounded bg-white font-bold" onClick={() => change(s.time, -1)} aria-label={`Fewer cooks at ${s.label}`}>−</button>
              <span className="font-bold">{s.staff}</span>
              <button className="h-6 w-6 rounded bg-white font-bold" onClick={() => change(s.time, 1)} aria-label={`More cooks at ${s.label}`}>+</button>
            </div>
            <p className="mt-0.5 text-ink/50">cooks</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function Simulator({ sim, levels, onRun }) {
  const [level, setLevel] = useState('normal');
  const [seed, setSeed] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  async function run() {
    setBusy(true); setErr('');
    try { await api.post('/sim/day', { level, seed: seed === '' ? undefined : Number(seed) }); onRun(); }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  }
  const rows = sim ? sim.fcfs.timeline.map((p, i) => ({ t: time(p.t), pen: p.waiting, app: sim.slotted.timeline[i]?.waiting })) : [];
  const pairs = sim ? [
    ['Group orders on time', sim.fcfs.metrics.onTime.group.pct, sim.slotted.metrics.onTime.group.pct, 85],
    ['Lunch orders on time', sim.fcfs.metrics.onTime.lunch.pct, sim.slotted.metrics.onTime.lunch.pct, 90],
    ['Walk-ins on time', sim.fcfs.metrics.onTime.walkin.pct, sim.slotted.metrics.onTime.walkin.pct, null],
  ] : [];

  return (
    <section className="panel mt-6">
      <div className="flex flex-wrap items-end gap-4">
        <div className="mr-auto max-w-2xl">
          <h2 className="text-2xl font-extrabold">Pen and paper vs. our app</h2>
          <p className="text-sm text-ink/60">Generates one random lunch day, then runs it twice through the same kitchen: first-come-first-served tickets, and our booked slots with start-time ordering. Same customers, same cooks. Enter a seed to replay a day exactly.</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex rounded-xl border-2 border-line p-1">
            {Object.entries(levels ?? {}).map(([k, v]) => (
              <button key={k} onClick={() => setLevel(k)} aria-pressed={level === k}
                className={`rounded-lg px-3 py-1.5 text-sm font-bold ${level === k ? 'bg-ink text-paper' : ''}`}>{v.label}</button>
            ))}
          </div>
          <input className="field w-28 py-2" placeholder="Seed" inputMode="numeric" value={seed} onChange={(e) => setSeed(e.target.value.replace(/\D/g, ''))} aria-label="Seed" />
          <button className="btn-primary" onClick={run} disabled={busy}>{busy ? 'Running…' : 'Run simulated day'}</button>
        </div>
      </div>
      {err && <p className="mt-3 text-chile">{err}</p>}
      {!sim && <p className="mt-8 rounded-xl border-2 border-dashed border-line p-8 text-center text-ink/60">Run a day to see the comparison.</p>}
      {sim && (
        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.2fr]">
          <div>
            <p className="text-sm text-ink/60">{sim.label} · seed <b>{sim.seed}</b> · {sim.demand.walkIns} walk-ins, {sim.demand.groups} groups ({sim.demand.groupBurritos} group burritos)</p>
            <div className="mt-3 space-y-3">
              {pairs.map(([label, a, b, target]) => (
                <div key={label} className="rounded-xl bg-paper p-3">
                  <p className="text-sm font-bold">{label}{target && <span className="font-normal text-ink/50"> · target {target}%</span>}</p>
                  <div className="mt-1 grid grid-cols-2 gap-3">
                    <div><p className="text-xs text-ink/50">Pen and paper</p><p className="font-display text-3xl font-extrabold text-ink/50">{pct(a)}</p></div>
                    <div><p className="text-xs text-ink/50">Our app</p><p className={`font-display text-3xl font-extrabold ${b != null && a != null && b >= a ? 'text-nopal' : 'text-chile'}`}>{pct(b)}</p></div>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-3 text-sm text-ink/60">
              Tradeoff: {sim.slotted.turnedAway} group{sim.slotted.turnedAway === 1 ? ' was' : 's were'} turned away for lack of capacity, and booked groups moved {sim.slotted.avgShiftMins} min from their first-choice time on average.
            </p>
          </div>
          <div>
            <p className="text-sm font-bold">Orders waiting in the kitchen</p>
            <div className="mt-2 h-72">
              <ResponsiveContainer>
                <LineChart data={rows} margin={{ left: -18 }}>
                  <CartesianGrid vertical={false} stroke={C.line} />
                  <XAxis dataKey="t" tick={{ fontSize: 12 }} interval={2} />
                  <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="pen" name="Pen and paper" stroke={C.chile} strokeWidth={2.5} dot={false} />
                  <Line type="monotone" dataKey="app" name="Our app" stroke={C.nopal} strokeWidth={2.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

const VERDICT = { good: ['Good day', 'bg-nopal text-white'], mixed: ['Mixed day', 'bg-marigold text-ink'], rough: ['Rough day', 'bg-chile text-white'] };

function AiBrief({ hasSim }) {
  const [source, setSource] = useState('live');
  const [brief, setBrief] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  async function gen() {
    setBusy(true); setErr('');
    try { setBrief(await api.post('/ai/summary', { source })); } catch (e) { setErr(e.message); } finally { setBusy(false); }
  }
  const v = brief && (VERDICT[brief.verdict] ?? VERDICT.mixed);
  return (
    <div className="flex flex-col rounded-2xl bg-ink p-5 text-paper">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="mr-auto text-2xl font-extrabold">End-of-day brief</h2>
        <div className="flex rounded-lg bg-white/10 p-0.5 text-sm">
          {[['live', 'Today'], ['simulation', 'Simulated day']].map(([k, l]) => (
            <button key={k} onClick={() => setSource(k)} disabled={k === 'simulation' && !hasSim} aria-pressed={source === k}
              className={`rounded-md px-3 py-1 font-bold disabled:opacity-30 ${source === k ? 'bg-paper text-ink' : ''}`}>{l}</button>
          ))}
        </div>
      </div>
      <p className="mt-1 text-sm text-paper/60">AI reads the day’s numbers and writes a short brief for the owners and investors, with fixes for tomorrow.</p>
      {!brief && !busy && <button className="btn-primary mt-6 self-start" onClick={gen}>Write today’s brief</button>}
      {busy && <p className="mt-6 animate-pulse text-paper/70">Reading today’s orders…</p>}
      {err && <p className="mt-4 rounded-lg bg-chile/90 px-3 py-2 text-sm font-bold">{err}</p>}
      {brief && !busy && (
        <div className="mt-5 space-y-4">
          <div className="flex items-start gap-3">
            <span className={`rounded-md px-2 py-0.5 text-xs font-bold ${v[1]}`}>{v[0]}</span>
            <p className="font-display text-2xl font-bold leading-tight">{brief.headline}</p>
          </div>
          <BriefList title="What went well" items={brief.wins} dot="bg-nopal" />
          <BriefList title="What hurt" items={brief.problems} dot="bg-chile" />
          <BriefList title="Try tomorrow" items={brief.tomorrow} dot="bg-marigold" />
          <p className="rounded-xl bg-white/10 p-3 text-sm"><b>For investors.</b> {brief.investorNote}</p>
          <div className="flex items-center justify-between text-xs text-paper/40">
            <span>Written by {brief.model} from computed metrics only</span>
            <button className="font-bold text-paper/70 hover:text-paper" onClick={gen}>Rewrite</button>
          </div>
        </div>
      )}
    </div>
  );
}

function BriefList({ title, items, dot }) {
  return (
    <div>
      <p className="text-sm font-bold text-paper/60">{title}</p>
      <ul className="mt-1 space-y-1.5">
        {items?.map((t, i) => <li key={i} className="flex gap-2.5"><span className={`mt-2 h-2 w-2 shrink-0 rounded-full ${dot}`} /><span>{t}</span></li>)}
      </ul>
    </div>
  );
}
