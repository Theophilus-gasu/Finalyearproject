// POST /api/analyze-incident
// Body: { readings: [{ts, smoke, temp, humidity, water}], thresholds?, trigger?, localTime? }
// Returns: { summary, likely_cause, confidence, recommended_action, reasoning, source, model, stats }
import { analyzeIncident } from '../lib/analyze.js';
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
    const verdict = await analyzeIncident(body);
    return json(res, 200, verdict);
  } catch (err) {
    // Zod validation errors land here
    return json(res, 400, { error: 'Invalid request', detail: String(err?.message || err).slice(0, 500) });
  }
}
