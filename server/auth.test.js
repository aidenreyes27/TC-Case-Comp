import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { initAuth, signIn, signInWithSupabase, userFromToken, signOut } from './auth.js';

before(() => {
  process.env.DEMO_PASSWORD = 'test-password-1';
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_ANON_KEY = 'anon-key';
  initAuth();
});

const fakeSupabase = (user, ok = true) => async (url, opts) => {
  assert.equal(url, 'https://example.supabase.co/auth/v1/user');
  assert.match(opts.headers.authorization, /^Bearer /);
  return { ok, json: async () => user };
};
const TOKEN = 'x'.repeat(40);

test('staff sign in with password and get a working session', () => {
  const s = signIn({ email: 'AidenReyes27@Berkeley.edu', password: 'test-password-1' });
  assert.equal(s.user.role, 'owner');
  assert.equal(s.user.passwordHash, undefined);
  assert.equal(userFromToken(s.token).email, 'aidenreyes27@berkeley.edu');
  signOut(s.token);
  assert.equal(userFromToken(s.token), null);
});

test('wrong password gets one generic message, then a lockout', () => {
  for (let i = 0; i < 5; i++) {
    assert.throws(() => signIn({ email: 'counter@burritobarrio.com', password: 'nope' }), /incorrect/);
  }
  assert.throws(() => signIn({ email: 'counter@burritobarrio.com', password: 'test-password-1' }), /Too many attempts/);
});

test('Google sign-in through Supabase creates a crew lead', async () => {
  const s = await signInWithSupabase({ accessToken: TOKEN },
    fakeSupabase({ id: 'sb-1', email: 'carlos@coast.com', user_metadata: { full_name: 'Carlos Reyes' } }));
  assert.equal(s.user.role, 'lead');
  assert.equal(s.user.name, 'Carlos Reyes');
  const again = await signInWithSupabase({ accessToken: TOKEN }, fakeSupabase({ id: 'sb-1', email: 'carlos@coast.com', user_metadata: {} }));
  assert.equal(again.user.id, s.user.id);
});

test('crew leads cannot use the staff password form', () => {
  assert.throws(() => signIn({ email: 'carlos@coast.com', password: 'anything-1' }), /incorrect/);
});

test('bad Supabase token or staff email is rejected', async () => {
  await assert.rejects(signInWithSupabase({ accessToken: TOKEN }, fakeSupabase({}, false)), /expired/);
  await assert.rejects(signInWithSupabase({ accessToken: TOKEN }, fakeSupabase({ id: 'x', email: 'counter@burritobarrio.com' })), /counter account/);
});

test('only aidenreyes27@berkeley.edu is an owner, and can use Google', async () => {
  const s = await signInWithSupabase({ accessToken: TOKEN }, fakeSupabase({ id: 'sb-o', email: 'aidenreyes27@berkeley.edu', user_metadata: { full_name: 'Aiden Reyes' } }));
  assert.equal(s.user.role, 'owner');
  const other = await signInWithSupabase({ accessToken: TOKEN }, fakeSupabase({ id: 'sb-2', email: 'someone@berkeley.edu', user_metadata: {} }));
  assert.equal(other.user.role, 'lead');
});
