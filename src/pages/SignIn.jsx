import { useState } from 'react';
import Mark from '../components/Mark.jsx';
import GoogleButton from '../components/GoogleButton.jsx';
import { api, setSession } from '../api.js';
import { supabase, signInWithGoogle } from '../lib/supabase.js';

const HOME = { owner: '/owner', staff: '/counter', lead: '/lead' };
export default function SignIn() {
  const params = new URLSearchParams(window.location.search);
  const next = params.get('next');
  const [error, setError] = useState(params.has('expired') ? 'Your session ended. Sign in again.' : params.get('error') ?? '');
  const [googleBusy, setGoogleBusy] = useState(false);

  async function google() {
    setGoogleBusy(true); setError('');
    try { await signInWithGoogle(next); } catch (e) { setError(e.message); setGoogleBusy(false); }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <section className="relative flex flex-col justify-between overflow-hidden bg-ink p-8 text-paper lg:p-14">
        <div className="flex items-center gap-3"><Mark size={42} /><span className="font-display text-2xl font-extrabold">Burrito Barrio</span></div>
        <div className="max-w-xl py-16">
          <h1 className="font-display text-5xl font-extrabold leading-[0.95] sm:text-7xl">Lunch for the whole crew, ready when you pull up.</h1>
          <p className="mt-6 max-w-md text-lg text-paper/75">Book a pickup time the kitchen can actually hit, send one link to your crew, and everyone picks their own burrito.</p>
        </div>
        <p className="text-sm text-paper/50">Oceanside, CA · California, Carne Asada, Carnitas</p>
        <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full border-[28px] border-marigold/25" />
      </section>

      <section className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md space-y-8">
          <JoinByCode />

          <div>
            <h2 className="text-2xl font-extrabold">Ordering for a crew?</h2>
            <p className="mb-4 mt-1 text-ink/60">Crew leads sign in to book a pickup time and get a link to share. The owner can use Google too.</p>
            <GoogleButton onClick={google} busy={googleBusy} disabled={!supabase} />
            {!supabase && <p className="mt-2 text-sm text-ink/50">Google sign-in turns on once VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are in .env.</p>}
            {error && <p role="alert" className="mt-3 rounded-lg bg-chile/10 px-3 py-2 text-sm font-bold text-chile">{error}</p>}
          </div>

          <StaffSignIn next={next} />
        </div>
      </section>
    </div>
  );
}

function JoinByCode() {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  async function join(e) {
    e.preventDefault();
    const c = code.trim().toUpperCase();
    if (!/^[A-Z0-9]{6}$/.test(c)) { setError('Codes are 6 letters and numbers, like P843KG.'); return; }
    try { await api.get(`/groups/${c}`); window.location.assign(`/g/${c}`); }
    catch (err) { setError(err.message); }
  }
  return (
    <form onSubmit={join} className="rounded-2xl bg-marigold/15 p-5">
      <h2 className="text-2xl font-extrabold">Joining your crew’s order?</h2>
      <p className="mt-1 text-ink/70">Tap the link your crew lead sent, or enter the code. No account needed.</p>
      <div className="mt-3 flex gap-2">
        <input className="field text-center font-display text-xl font-bold uppercase tracking-[0.3em]" value={code} maxLength={6}
          onChange={(e) => { setCode(e.target.value.replace(/[^a-z0-9]/gi, '')); setError(''); }} placeholder="CODE" aria-label="Group order code" />
        <button className="btn-dark whitespace-nowrap px-5">Join order</button>
      </div>
      {error && <p role="alert" className="mt-2 text-sm font-bold text-chile">{error}</p>}
    </form>
  );
}

function StaffSignIn({ next }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault(); setBusy(true); setError('');
    try {
      const s = await api.post('/auth/sign-in', { email, password });
      setSession(s);
      window.location.assign(next && next.startsWith('/') ? next : HOME[s.user.role]);
    } catch (err) { setError(err.message); setBusy(false); }
  }

  return (
    <div className="border-t border-line pt-6">
      <button className="text-sm font-bold text-ink/60 hover:text-ink" aria-expanded={open} onClick={() => setOpen(!open)}>
        Owner or counter sign in with password {open ? '−' : '+'}
      </button>
      {open && (
        <form className="mt-4 space-y-3" onSubmit={submit} noValidate>
          <div><label className="label" htmlFor="se">Email</label><input id="se" className="field" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" placeholder="you@berkeley.edu" /></div>
          <div>
            <label className="label" htmlFor="sp">Password</label>
            <div className="relative">
              <input id="sp" className="field pr-20" type={show ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" maxLength={128} />
              <button type="button" onClick={() => setShow(!show)} className="absolute inset-y-0 right-2 my-auto h-8 rounded-lg px-2 text-sm font-bold text-ink/60 hover:text-ink">{show ? 'Hide' : 'Show'}</button>
            </div>
          </div>
          {error && <p role="alert" className="rounded-lg bg-chile/10 px-3 py-2 text-sm font-bold text-chile">{error}</p>}
          <button className="btn-dark w-full py-2.5" disabled={busy}>{busy ? 'One moment…' : 'Sign in'}</button>
        </form>
      )}
    </div>
  );
}
