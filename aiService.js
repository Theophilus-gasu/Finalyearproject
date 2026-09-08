// Client for the IoT Sentinel server (server/ folder, deployed on Vercel or run locally).
// The OpenAI key never lives in the app; the app only talks to this server.
//
// Configure in the app root .env (public values, safe to ship):
//   EXPO_PUBLIC_AI_API_URL=https://<your-vercel-project>.vercel.app   (or http://<mac-ip>:3001 for local dev)
//   EXPO_PUBLIC_AI_APP_TOKEN=...   only if the server sets SENTINEL_APP_TOKEN

export const AI_API_URL = (process.env.EXPO_PUBLIC_AI_API_URL || '').replace(/\/$/, '');
const APP_TOKEN = process.env.EXPO_PUBLIC_AI_APP_TOKEN || '';
const TIMEOUT_MS = 15000;

export const aiConfigured = () => AI_API_URL.length > 0;

async function post(path, body) {
  if (!aiConfigured()) throw new Error('EXPO_PUBLIC_AI_API_URL is not set');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${AI_API_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(APP_TOKEN ? { 'X-App-Token': APP_TOKEN } : {}) },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Server returned ${res.status}`);
    return data;
  } finally {
    clearTimeout(timer);
  }
}

export const checkHealth = async () => {
  if (!aiConfigured()) return { ok: false, error: 'not configured' };
  const res = await fetch(`${AI_API_URL}/api/health`);
  return res.json();
};

/**
 * Ask the server to analyse an incident.
 * @param readings  the in-memory buffer: [{ts, smoke, temp, humidity, water}]
 * @param thresholds { smokeWarning, smokeDanger, tempDanger }
 * @param trigger { type, value }
 * @returns { summary, likely_cause, confidence, recommended_action, reasoning, source, model, stats }
 */
export const analyzeIncident = (readings, thresholds, trigger) => {
  const now = new Date();
  return post('/api/analyze-incident', {
    readings: readings.map(r => ({ ts: r.ts, smoke: r.smoke, temp: r.temp, humidity: r.humidity, water: !!r.water })),
    thresholds,
    trigger,
    localTime: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  });
};

/**
 * Ask Sentinel a question about the room. Read-only.
 * @param question  the user's text
 * @param history   prior turns [{role: 'user'|'assistant', content}]
 * @param live      current values from the context (smoke, temp, humidity, water, fan, status, thresholds, lastReadingAt)
 * @returns { answer, context: { historyRows, eventRows, from, to }, model, latencyMs }
 */
export const askSentinel = (question, history, live) => {
  const now = new Date();
  return post('/api/ask', {
    question,
    history: history.slice(-20).map(m => ({ role: m.role, content: m.content })),
    live,
    localTime: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    timezoneOffsetMin: now.getTimezoneOffset(),
  });
};

// Causes the server may return that justify giving the user more time before auto-dialling.
export const BENIGN_CAUSES = ['cooking_smoke', 'steam', 'incense_or_vape', 'sensor_fault'];

export const causeLabel = (cause) => ({
  fire: 'FIRE', cooking_smoke: 'COOKING SMOKE', steam: 'STEAM', incense_or_vape: 'INCENSE / VAPE',
  gas_leak: 'GAS LEAK', sensor_fault: 'SENSOR FAULT', unknown: 'UNKNOWN',
}[cause] || String(cause || '').toUpperCase());
