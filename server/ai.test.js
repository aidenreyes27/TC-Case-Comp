import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { summarize, parseBrief } from './ai.js';

const brief = { headline: 'Lunch held up', verdict: 'good', wins: ['a', 'b'], problems: ['c'], tomorrow: ['d', 'e'], investorNote: 'f' };
const payload = { metrics: { orders: 10 } };
beforeEach(() => { delete process.env.ANTHROPIC_API_KEY; delete process.env.GROQ_API_KEY; });

test('uses Groq when only GROQ_API_KEY is set', async () => {
  process.env.GROQ_API_KEY = 'gsk_test';
  let called;
  const fake = async (url, opts) => {
    called = { url, body: JSON.parse(opts.body), auth: opts.headers.authorization };
    return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: `Sure!\n\`\`\`json\n${JSON.stringify(brief)}\n\`\`\`` } }] }) };
  };
  const out = await summarize(payload, fake);
  assert.equal(called.url, 'https://api.groq.com/openai/v1/chat/completions');
  assert.equal(called.auth, 'Bearer gsk_test');
  assert.equal(called.body.messages[0].role, 'system');
  assert.equal(out.headline, 'Lunch held up');
  assert.match(out.model, /Groq/);
});

test('prefers Claude when ANTHROPIC_API_KEY is set', async () => {
  process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
  process.env.GROQ_API_KEY = 'gsk_test';
  let url;
  const fake = async (u) => { url = u; return { ok: true, status: 200, json: async () => ({ content: [{ type: 'text', text: JSON.stringify(brief) }] }) }; };
  await summarize(payload, fake);
  assert.equal(url, 'https://api.anthropic.com/v1/messages');
});

test('clear errors: no key, no orders, rate limit', async () => {
  await assert.rejects(summarize(payload), /GROQ_API_KEY/);
  process.env.GROQ_API_KEY = 'gsk_test';
  await assert.rejects(summarize({ metrics: { orders: 0 } }), /no orders/);
  await assert.rejects(summarize(payload, async () => ({ ok: false, status: 429 })), /Wait a minute/);
});

test('parseBrief repairs small format slips', () => {
  const p = parseBrief(JSON.stringify({ ...brief, verdict: 'great', wins: 'one win' }));
  assert.equal(p.verdict, 'mixed');
  assert.deepEqual(p.wins, ['one win']);
});
