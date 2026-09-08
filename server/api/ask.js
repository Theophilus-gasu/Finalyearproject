// POST /api/ask
// Body: { question, history?: [{role, content}], live?: {...}, localTime?, timezoneOffsetMin? }
// Returns: { answer, context: { historyRows, eventRows, from, to }, model, latencyMs }
import { askSentinel } from '../lib/ask.js';
import { setCors, json, checkToken, readJson } from '../lib/http.js';

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return json(res, 204, {});
  if (req.method !== 'POST') return json(res, 405, { error: 'Use POST' });
  if (!checkToken(req, res)) return;

  let body;
  try {
    body = await readJson(req);
  } catch {
    return json(res, 400, { error: 'Invalid JSON body' });
  }

  try {
    return json(res, 200, await askSentinel(body));
  } catch (err) {
    const msg = String(err?.message || err);
    const status = /ZodError|Invalid|expected/i.test(msg) ? 400 : 502;
    return json(res, status, { error: status === 400 ? 'Invalid request' : 'Assistant unavailable', detail: msg.slice(0, 500) });
  }
}
