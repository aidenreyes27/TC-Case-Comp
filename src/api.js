// Session = { token, user } saved in the browser after sign-in.
const KEY = 'bb-session';
export const getSession = () => { try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; } };
export const getUser = () => getSession()?.user ?? null;
export const setSession = (s) => (s ? localStorage.setItem(KEY, JSON.stringify(s)) : localStorage.removeItem(KEY));

async function call(method, path, body) {
  const token = getSession()?.token;
  const res = await fetch(`/api${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && token && !path.startsWith('/auth/')) {
    // Token expired or the server restarted: send them back to sign in.
    setSession(null);
    window.location.assign('/?expired=1');
  }
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data;
}
export const api = {
  get: (p) => call('GET', p),
  post: (p, b) => call('POST', p, b ?? {}),
  del: (p) => call('DELETE', p),
};

export async function signOut() {
  try { await api.post('/auth/sign-out'); } catch { /* already signed out */ }
  try { const { supabase } = await import('./lib/supabase.js'); await supabase?.auth.signOut(); } catch { /* not a Google session */ }
  setSession(null);
  window.location.assign('/');
}
