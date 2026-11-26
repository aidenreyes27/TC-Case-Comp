import { useState } from 'react';
import { money } from '../lib/format.js';

// Mock checkout. Validates like a real form, charges nothing.
export default function PayModal({ total, burritos, onPay, onClose, name = '' }) {
  const [f, setF] = useState({ cardName: name, cardNumber: '4242 4242 4242 4242', expiry: '08/28', cvc: '123' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault(); setBusy(true); setError('');
    await new Promise((r) => setTimeout(r, 700));
    try { await onPay(f); } catch (err) { setError(err.message); setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 p-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="pay-title">
      <form onSubmit={submit} className="w-full max-w-md rounded-2xl bg-paper p-6 shadow-2xl">
        <div className="flex items-start justify-between">
          <div>
            <h2 id="pay-title" className="text-2xl font-extrabold">Pay and send to kitchen</h2>
            <p className="text-ink/60">{burritos} burritos · {money(total)}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg px-2 text-2xl leading-none text-ink/50 hover:text-ink" aria-label="Close">×</button>
        </div>
        <p className="mt-3 rounded-lg bg-pacific/10 px-3 py-2 text-sm text-pacific">Demo checkout. No card is charged. Paying holds your pickup slot, so an unpaid order can’t tie up the kitchen.</p>
        <div className="mt-4 space-y-3">
          <div><label className="label" htmlFor="cn">Name on card</label><input id="cn" className="field" value={f.cardName} onChange={set('cardName')} placeholder="Carlos Reyes" /></div>
          <div><label className="label" htmlFor="cc">Card number</label><input id="cc" className="field" inputMode="numeric" value={f.cardNumber} onChange={set('cardNumber')} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label" htmlFor="ex">Expiry</label><input id="ex" className="field" value={f.expiry} onChange={set('expiry')} placeholder="MM/YY" /></div>
            <div><label className="label" htmlFor="cv">CVC</label><input id="cv" className="field" inputMode="numeric" value={f.cvc} onChange={set('cvc')} /></div>
          </div>
        </div>
        {error && <p role="alert" className="mt-3 rounded-lg bg-chile/10 px-3 py-2 text-sm font-bold text-chile">{error}</p>}
        <button className="btn-primary mt-5 w-full py-3 text-lg" disabled={busy}>{busy ? 'Processing…' : `Pay ${money(total)}`}</button>
      </form>
    </div>
  );
}
