// AI end-of-day summary. The model gets only the computed metrics (never raw
// customer names) and writes a short brief for the owners and investors.
// Provider: Claude if ANTHROPIC_API_KEY is set, otherwise Groq's free tier
// if GROQ_API_KEY is set. Both get the same prompt and the same checks.
import { MENU, SETTINGS } from './config.js';
import { HttpError } from './store.js';

const SYSTEM = `You write the end-of-day brief for Burrito Barrio, a small, authentic taqueria in Oceanside, CA.
Readers: owners Alden (cares about food quality and identity) and Andrew (cares about operations and growth), and investors Ayush and Krish (care about sales and profitability).
The shop uses a group-ordering app with capacity-limited pickup slots. The core goal is group orders ready on time (target 85%+) and lunch on time (target 90%+).

Rules:
- Use ONLY numbers present in the JSON. Never invent figures. If a number is null, say there isn't enough data.
- Be concrete and short. Plain English, no hype, no emojis.
- Recommendations must be operational and specific to the data: staffing per slot, the walk-in reserve, pickup-slot capacity, no-shows, or the menu.
- Output strictly as JSON with this shape and nothing else:
{"headline": string (max 14 words),
 "verdict": "good" | "mixed" | "rough",
 "wins": [string, ...] (2-3 items),
 "problems": [string, ...] (1-3 items),
 "tomorrow": [string, ...] (2-3 concrete actions, each naming a time slot or setting when relevant),
 "investorNote": string (1-2 sentences on revenue, margin, and what the numbers mean for growth)}`;

export function buildPayload(source, metrics, extra = {}) {
  return {
    source,
    targets: { groupOnTimePct: 85, lunchOnTimePct: 90 },
    settings: { walkInReservePct: SETTINGS.walkInReserve * 100, walkInPromiseMins: SETTINGS.walkInPromiseMins },
    menu: MENU.map(({ name, price, cost, prepMins }) => ({ name, price, cost, prepMins })),
    metrics,
    ...extra,
  };
}

function pickProvider() {
  if (process.env.ANTHROPIC_API_KEY) {
    return { name: 'anthropic', key: process.env.ANTHROPIC_API_KEY, model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5' };
  }
  if (process.env.GROQ_API_KEY) {
    return { name: 'groq', key: process.env.GROQ_API_KEY, model: process.env.GROQ_MODEL || 'openai/gpt-oss-120b' }; // Groq's recommended replacement for the retired Llama 3.3 70B
  }
  throw new HttpError(503, 'Add GROQ_API_KEY (free at console.groq.com) or ANTHROPIC_API_KEY to your .env file, then restart, to turn on the AI brief.');
}

async function callModel(p, user, fetchImpl) {
  const req = p.name === 'anthropic'
    ? {
      url: 'https://api.anthropic.com/v1/messages',
      headers: { 'content-type': 'application/json', 'x-api-key': p.key, 'anthropic-version': '2023-06-01' },
      body: { model: p.model, max_tokens: 900, system: SYSTEM, messages: [{ role: 'user', content: user }] },
    }
    : {
      url: 'https://api.groq.com/openai/v1/chat/completions',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${p.key}` },
      // gpt-oss thinks before answering; keep thinking short and leave room for the JSON.
      body: { model: p.model, max_tokens: 2500, temperature: 0.3, reasoning_effort: 'low',
        messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: user }] },
    };
  let res;
  try {
    res = await fetchImpl(req.url, { method: 'POST', headers: req.headers, body: JSON.stringify(req.body) });
  } catch {
    throw new HttpError(502, 'Couldn’t reach the AI service. Check your internet connection.');
  }
  if (res.status === 401) throw new HttpError(502, 'The AI key was rejected. Check the key in .env and restart.');
  if (res.status === 429) throw new HttpError(429, 'The free AI tier is busy or at its limit. Wait a minute and try again.');
  if (!res.ok) {
    const body = await res.text();
    throw new HttpError(502, `The AI service returned ${res.status}. ${body.slice(0, 160)}`);
  }
  const data = await res.json();
  return p.name === 'anthropic'
    ? data.content?.filter((b) => b.type === 'text').map((b) => b.text).join('') ?? ''
    : data.choices?.[0]?.message?.content ?? '';
}

// Models sometimes wrap JSON in prose or code fences; keep only the object.
export function parseBrief(text) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('no JSON object');
  const parsed = JSON.parse(text.slice(start, end + 1));
  for (const k of ['headline', 'wins', 'problems', 'tomorrow', 'investorNote']) {
    if (!(k in parsed)) throw new Error(`missing ${k}`);
  }
  for (const k of ['wins', 'problems', 'tomorrow']) {
    if (!Array.isArray(parsed[k])) parsed[k] = [String(parsed[k])];
  }
  if (!['good', 'mixed', 'rough'].includes(parsed.verdict)) parsed.verdict = 'mixed';
  return parsed;
}

export async function summarize(payload, fetchImpl = fetch) {
  const p = pickProvider();
  if (!payload.metrics?.orders) throw new HttpError(400, 'There are no orders yet. Run a rush or a simulated day first.');
  const text = await callModel(p, `Today's data:\n${JSON.stringify(payload)}\n\nRespond with the JSON object only.`, fetchImpl);
  try {
    return { ...parseBrief(text), model: p.name === 'groq' ? `${p.model} (Groq)` : p.model, generatedAt: Date.now() };
  } catch {
    throw new HttpError(502, 'The AI summary came back in an unexpected format. Press Rewrite to try again.');
  }
}
