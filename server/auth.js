// Two ways in:
//  - Crew leads: Google sign-in through Supabase. The browser gets a Supabase
//    access token; we confirm it with Supabase and give back our own session.
//  - The owner (one fixed email in config.js): Google only.
//  - The shared counter tablet: email + password (scrypt hashes, Node built-in).
// Sessions are random bearer tokens that expire. Crew lead accounts are saved
// to data/users.json so they survive a server restart; orders do not.
import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { USERS, HttpError } from './store.js';

const FILE = process.env.USERS_FILE || 'data/users.json';
const SESSION_HOURS = 12;
const MAX_FAILS = 5;
const LOCK_MINS = 10;
const sessions = new Map(); // token -> { userId, expiresAt }
const fails = new Map();    // email -> { count, until }

const fail = (status, msg) => { throw new HttpError(status, msg); };
const normEmail = (e) => String(e ?? '').trim().toLowerCase();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `scrypt:${salt.toString('hex')}:${hash.toString('hex')}`;
}
export function verifyPassword(password, stored) {
  const [, saltHex, hashHex] = String(stored ?? '').split(':');
  if (!saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = scryptSync(String(password ?? ''), Buffer.from(saltHex, 'hex'), expected.length);
  return timingSafeEqual(actual, expected);
}

export const publicUser = ({ passwordHash, supabaseId, ...u }) => u;

function save() {
  if (process.env.NODE_ENV === 'test') return;
  mkdirSync(FILE.split('/').slice(0, -1).join('/') || '.', { recursive: true });
  writeFileSync(FILE, JSON.stringify(USERS.filter((u) => u.role === 'lead'), null, 2));
}

// Staff accounts come from env (or demo defaults); crew leads load from disk.
export function initAuth() {
  const demo = process.env.DEMO_PASSWORD || 'barrio-demo-2026';
  // Only the counter account has a password. The owner signs in with Google.
  for (const u of USERS) if (u.role === 'staff' && !u.passwordHash) u.passwordHash = hashPassword(process.env.STAFF_PASSWORD || demo);
  if (process.env.NODE_ENV !== 'test' && existsSync(FILE)) {
    try {
      for (const u of JSON.parse(readFileSync(FILE, 'utf8'))) {
        if (!USERS.some((x) => x.email === u.email)) USERS.push({ ...u, role: 'lead' });
      }
    } catch { console.warn(`Could not read ${FILE}; starting with no crew lead accounts.`); }
  }
}

function startSession(user) {
  const token = randomBytes(32).toString('hex');
  sessions.set(token, { userId: user.id, expiresAt: Date.now() + SESSION_HOURS * 3600_000 });
  return { token, user: publicUser(user) };
}

const supabaseUrl = () => (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
const supabaseKey = () => process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

// fetchImpl is injectable so tests don't call Supabase.
export async function signInWithSupabase({ accessToken }, fetchImpl = fetch) {
  if (!supabaseUrl() || !supabaseKey()) fail(503, 'Google sign-in isn’t set up yet. Add the Supabase URL and anon key to .env.');
  if (typeof accessToken !== 'string' || accessToken.length < 20) fail(400, 'Missing Google sign-in token. Try signing in again.');
  let res;
  try {
    res = await fetchImpl(`${supabaseUrl()}/auth/v1/user`, { headers: { apikey: supabaseKey(), authorization: `Bearer ${accessToken}` } });
  } catch { fail(502, 'Couldn’t reach Supabase to confirm your Google sign-in. Check your connection.'); }
  if (!res.ok) fail(401, 'Your Google sign-in expired. Try again.');
  const sb = await res.json();
  const mail = normEmail(sb.email);
  if (!EMAIL_RE.test(mail)) fail(400, 'Your Google account has no email address we can use.');
  let user = USERS.find((u) => u.email === mail);
  // The owner may use Google too; the shared counter account may not.
  if (user && user.role === 'staff') fail(403, 'The counter account signs in with email and password below.');
  const name = String(sb.user_metadata?.full_name || sb.user_metadata?.name || mail.split('@')[0]).slice(0, 40);
  if (!user) {
    user = { id: `u-${randomBytes(6).toString('hex')}`, name, email: mail, role: 'lead', supabaseId: sb.id, avatarUrl: sb.user_metadata?.avatar_url ?? null };
    USERS.push(user);
  } else {
    Object.assign(user, { name: user.role === 'owner' ? name : user.name, supabaseId: sb.id, avatarUrl: sb.user_metadata?.avatar_url ?? user.avatarUrl ?? null });
  }
  save();
  return startSession(user);
}

export function signIn({ email, password }) {
  const mail = normEmail(email);
  if (!mail || !password) fail(400, 'Enter your email and password.');
  const f = fails.get(mail);
  if (f && f.until > Date.now()) fail(429, `Too many attempts. Try again in ${Math.ceil((f.until - Date.now()) / 60000)} min.`);
  if (USERS.some((u) => u.email === mail && u.role === 'owner')) fail(400, 'The owner signs in with Google. Use Continue with Google above.');
  const user = USERS.find((u) => u.email === mail && u.role === 'staff');
  // Same message whether the email or the password is wrong.
  if (!user || !verifyPassword(password, user.passwordHash)) {
    const expired = f?.until && f.until <= Date.now();
    const count = (f && !expired ? f.count : 0) + 1;
    fails.set(mail, { count, until: count >= MAX_FAILS ? Date.now() + LOCK_MINS * 60000 : 0 });
    fail(401, 'Email or password is incorrect.');
  }
  fails.delete(mail);
  return startSession(user);
}

export function signOut(token) { sessions.delete(token); return { ok: true }; }

export function userFromToken(token) {
  const s = token && sessions.get(token);
  if (!s) return null;
  if (s.expiresAt < Date.now()) { sessions.delete(token); return null; }
  return USERS.find((u) => u.id === s.userId) ?? null;
}

export const tokenFrom = (req) => (req.get('authorization') ?? '').replace(/^Bearer\s+/i, '') || null;
