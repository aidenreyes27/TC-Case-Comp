// AI end-of-day summary. Claude gets only the computed metrics (never raw
// customer names) and writes a short brief for the owners and investors.
import { MENU, SETTINGS } from './config.js';
import { HttpError } from './store.js';

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5';

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

export async function summarize(payload) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new HttpError(503, 'Add ANTHROPIC_API_KEY to your .env file to turn on the AI summary.');
  if (!payload.metrics?.orders) throw new HttpError(400, 'There are no orders yet. Run a rush or a simulated day first.');

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 900,
      system: SYSTEM,
      messages: [{ role: 'user', content: `Today's data:\n${JSON.stringify(payload)}` }],
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new HttpError(502, `The AI service returned ${res.status}. ${body.slice(0, 160)}`);
  }
  const data = await res.json();
  const text = data.content?.filter((b) => b.type === 'text').map((b) => b.text).join('') ?? '';
  try {
    const parsed = JSON.parse(text.replace(/```json|```/g, '').trim());
    for (const k of ['headline', 'wins', 'problems', 'tomorrow', 'investorNote']) {
      if (!(k in parsed)) throw new Error(`missing ${k}`);
    }
    return { ...parsed, model: MODEL, generatedAt: Date.now() };
  } catch {
    throw new HttpError(502, 'The AI summary came back in an unexpected format. Try again.');
  }
}
