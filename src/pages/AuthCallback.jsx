import { useEffect, useState } from 'react';
import Mark from '../components/Mark.jsx';
import { api, setSession } from '../api.js';
import { supabase } from '../lib/supabase.js';

// Google sends the crew lead back here. We hand Supabase's token to our API,
// which checks it with Supabase and returns our own session.
export default function AuthCallback() {
  const [error, setError] = useState('');
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const next = params.get('next');
    const fail = (msg) => setError(msg);
    if (params.get('error_description')) { fail(params.get('error_description')); return undefined; }
    if (!supabase) { fail('Google sign-in isn’t set up yet.'); return undefined; }

    let done = false;
    const finish = async (session) => {
      if (done || !session) return;
      done = true;
      try {
        const s = await api.post('/auth/google', { accessToken: session.access_token });
        setSession(s);
        window.location.replace(next && next.startsWith('/') ? next : s.user.role === 'owner' ? '/owner' : '/lead');
      } catch (e) { fail(e.message); }
    };
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => finish(session));
    supabase.auth.getSession().then(({ data }) => finish(data.session));
    const timer = setTimeout(() => { if (!done) fail('Google sign-in didn’t finish. Try again.'); }, 10000);
    return () => { sub.subscription.unsubscribe(); clearTimeout(timer); };
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <Mark size={48} />
      {error ? (
        <>
          <p className="font-display text-2xl font-bold">{error}</p>
          <a href="/" className="btn-primary">Back to sign in</a>
        </>
      ) : <p className="animate-pulse font-display text-2xl font-bold">Signing you in…</p>}
    </div>
  );
}
