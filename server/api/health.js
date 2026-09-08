// GET /api/health — confirms the deployment is up and whether the OpenAI key is configured (never reveals it).
import { setCors, json } from '../lib/http.js';
import { MODEL } from '../lib/analyze.js';

export default function handler(req, res) {
  setCors(res);
  json(res, 200, {
    ok: true,
    model: MODEL,
    openaiKeyConfigured: Boolean(process.env.OPENAI_API_KEY || process.env.OPEN_AI_API_KEY),
    tokenRequired: Boolean(process.env.SENTINEL_APP_TOKEN),
    time: new Date().toISOString(),
  });
}
