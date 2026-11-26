import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Shell from '../components/Shell.jsx';
import SlotPicker from '../components/SlotPicker.jsx';
import { api } from '../api.js';
import { usePoll } from '../lib/hooks.js';
import { GROUP_TYPES } from '../lib/format.js';

export default function NewGroup() {
  const nav = useNavigate();
  const { data } = usePoll('/slots', 5000);
  const [groupName, setGroupName] = useState('');
  const [groupType, setGroupType] = useState('construction');
  const [slot, setSlot] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!slot) { setError('Pick a pickup time.'); return; }
    setBusy(true); setError('');
    try { const o = await api.post('/groups', { groupName, groupType, slot }); nav(`/g/${o.code}`); }
    catch (err) { setError(err.message); setBusy(false); }
  }

  return (
    <Shell>
      <h1 className="text-4xl font-extrabold">New group order</h1>
      <form onSubmit={submit} className="mt-6 grid gap-8 lg:grid-cols-[1fr_1.2fr]">
        <div className="space-y-5">
          <div>
            <label className="label" htmlFor="gn">Group name</label>
            <input id="gn" className="field" value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="Mission Ave site crew" maxLength={50} />
          </div>
          <fieldset>
            <legend className="label">Who is it for?</legend>
            <div className="flex flex-wrap gap-2">
              {Object.entries(GROUP_TYPES).map(([k, v]) => (
                <button type="button" key={k} onClick={() => setGroupType(k)} aria-pressed={groupType === k}
                  className={`rounded-full border-2 px-3.5 py-1.5 text-sm font-bold ${groupType === k ? 'border-ink bg-ink text-paper' : 'border-line bg-white'}`}>{v}</button>
              ))}
            </div>
          </fieldset>
          <div className="rounded-2xl bg-ink p-5 text-paper">
            <p className="font-display text-lg font-bold">How it works</p>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-paper/80">
              <li>Pick a pickup time with room in the kitchen.</li>
              <li>Share the link. Each person adds their own burrito.</li>
              <li>Pay before changes close to hold the slot.</li>
            </ol>
          </div>
          {error && <p role="alert" className="rounded-lg bg-chile/10 px-3 py-2 text-sm font-bold text-chile">{error}</p>}
          <button className="btn-primary w-full py-3 text-lg" disabled={busy}>Create order and get link</button>
        </div>
        <div>
          <p className="label">Pickup time</p>
          <SlotPicker slots={data?.slots} value={slot} onChange={setSlot} />
        </div>
      </form>
    </Shell>
  );
}
