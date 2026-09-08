// "Ask Sentinel": answers questions about the room using Firebase history + events + the phone's live state.
// Read-only by design: the assistant can describe and explain, never change thresholds or controls.
import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';
import { MODEL } from './analyze.js';

const DB_URL = (process.env.FIREBASE_DB_URL || 'https://smart-iot-workstation-default-rtdb.firebaseio.com').replace(/\/$/, '');
const HISTORY_ROWS = Number(process.env.ASK_HISTORY_ROWS || 2000); // ≈ 1 h of continuous 2 s samples; far longer when the room is quiet
const EVENT_ROWS = 50;
const MAX_TURNS = 10;

export const AskSchema = z.object({
  question: z.string().min(1).max(1000),
  history: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().max(4000) })).max(MAX_TURNS * 2).default([]),
  live: z.object({
    smoke: z.number().optional(), temp: z.number().optional(), humidity: z.number().optional(),
    water: z.boolean().optional(), fan: z.boolean().optional(), status: z.string().optional(),
    thresholds: z.object({ smokeWarning: z.number(), smokeDanger: z.number(), tempDanger: z.number() }).optional(),
    lastReadingAt: z.number().nullable().optional(),
  }).optional(),
  localTime: z.string().optional(),
  timezoneOffsetMin: z.number().optional(), // phone's Date.getTimezoneOffset(), so timestamps are shown in local time
});

// ---------- Firebase REST (no SDK needed server-side; push keys sort chronologically so $key works without an index) ----------

async function fetchLast(node, n) {
  const url = `${DB_URL}/${node}.json?orderBy="$key"&limitToLast=${n}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`Firebase ${node} ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  return data ? Object.entries(data).map(([key, v]) => ({ key, ...v })) : [];
}

const fmt = (ms, offsetMin = 0) => {
  const d = new Date(ms - offsetMin * 60000);
  const p = (x) => String(x).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
};

// Collapse raw 2 s samples into per-minute buckets so a long window fits comfortably in the prompt.
function bucketHistory(rows, offsetMin) {
  const byMinute = new Map();
  for (const r of rows) {
    const ts = Number(r.ts ?? r.client_ts);
    if (!Number.isFinite(ts)) continue;
    const k = Math.floor(ts / 60000);
    const b = byMinute.get(k) || { k, n: 0, smokeMax: -Infinity, smokeSum: 0, tempSum: 0, humSum: 0, wet: false };
    b.n++; b.smokeSum += Number(r.gas_level) || 0; b.smokeMax = Math.max(b.smokeMax, Number(r.gas_level) || 0);
    b.tempSum += Number(r.temperature) || 0; b.humSum += Number(r.humidity) || 0; b.wet = b.wet || r.water === 'WET';
    byMinute.set(k, b);
  }
  return [...byMinute.values()].sort((a, b) => a.k - b.k).map(b => ({
    time: fmt(b.k * 60000, offsetMin), n: b.n,
    smokeAvg: Math.round(b.smokeSum / b.n), smokeMax: Math.round(b.smokeMax),
    temp: Math.round(b.tempSum / b.n * 10) / 10, humidity: Math.round(b.humSum / b.n), wet: b.wet,
  }));
}

function buildSystem({ minutes, events, live, localTime, offsetMin, rawCount }) {
  const t = live?.thresholds || { smokeWarning: 300, smokeDanger: 500, tempDanger: 35 };
  const liveText = live
    ? `smoke ${live.smoke ?? '?'}/1023, temperature ${live.temp ?? '?'}°C, humidity ${live.humidity ?? '?'}%, water probe ${live.water ? 'WET' : 'DRY'}, exhaust fan ${live.fan ? 'RUNNING' : 'off'}, app status ${live.status || '?'}` +
      (live.lastReadingAt ? `, last reading received ${fmt(live.lastReadingAt, offsetMin)}` : ', no reading received yet this session')
    : 'not provided';

  const minutesText = minutes.length
    ? minutes.map(m => `${m.time}  smoke avg ${m.smokeAvg} max ${m.smokeMax}  temp ${m.temp}°C  hum ${m.humidity}%${m.wet ? '  WET' : ''}  (${m.n} samples)`).join('\n')
    : '(no readings logged yet — the app mirrors readings to Firebase only while it is open)';

  const eventsText = events.length
    ? events.map(e => {
        const when = e.ts ? fmt(Number(e.ts), offsetMin) : (e.time || '?');
        const ai = e.ai ? ` → AI: ${e.ai.likely_cause} (${Math.round((e.ai.confidence || 0) * 100)}%): ${e.ai.summary}` : '';
        const extra = e.number ? ` number ${e.number}` : e.seconds ? ` +${e.seconds}s` : e.smoke ? ` value ${e.smoke}` : '';
        return `${when}  ${e.type}${extra}${ai}`;
      }).join('\n')
    : '(no events logged yet)';

  return `You are "Sentinel", the assistant inside a home safety monitor app. One ESP32 in a room reports every ~2 s: an analog MQ smoke/gas sensor (0-1023; warning ≥ ${t.smokeWarning}, danger ≥ ${t.smokeDanger}), a DHT22 temperature (danger ≥ ${t.tempDanger}°C) and humidity, and a water-leak probe. There is one smoke/gas sensor only, no camera. The app can auto-dial an emergency number after a countdown when smoke crosses the danger line.

You are READ-ONLY. You cannot change thresholds, control the fan, cancel calls or dial anyone; if asked, say the user can do that in the app and where (Settings tab for thresholds and the emergency number, Dashboard for the fan and Acknowledge).

Answer from the data below. Quote times (HH:MM) and numbers. If the data does not cover what is asked, say exactly that (e.g. "nothing was logged between 02:00 and 06:00") rather than guessing. Keep answers short: two to five sentences unless the user asks for detail. Local time now: ${localTime || 'unknown'}.

LIVE STATE (right now, from the phone): ${liveText}

READINGS, per minute, oldest first (${rawCount} raw samples in this window):
${minutesText}

EVENT LOG, oldest first (last ${EVENT_ROWS}):
${eventsText}`;
}

export async function askSentinel(input) {
  const { question, history, live, localTime, timezoneOffsetMin = 0 } = AskSchema.parse(input);

  const [historyRows, eventRows] = await Promise.all([
    fetchLast('history', HISTORY_ROWS).catch(err => { console.error('history fetch failed:', err.message); return []; }),
    fetchLast('events', EVENT_ROWS).catch(err => { console.error('events fetch failed:', err.message); return []; }),
  ]);
  const minutes = bucketHistory(historyRows, timezoneOffsetMin);
  const events = eventRows.sort((a, b) => Number(a.ts || 0) - Number(b.ts || 0));
  const context = {
    historyRows: historyRows.length, eventRows: events.length,
    from: minutes[0]?.time || null, to: minutes[minutes.length - 1]?.time || null,
  };

  const apiKey = process.env.OPENAI_API_KEY || process.env.OPEN_AI_API_KEY;
  if (!apiKey) return { answer: 'The AI server has no OpenAI key configured.', context, error: 'OPENAI_API_KEY not configured' };

  const openai = createOpenAI({ apiKey });
  const started = Date.now();
  const result = await generateText({
    model: openai(MODEL),
    system: buildSystem({ minutes, events, live, localTime, offsetMin: timezoneOffsetMin, rawCount: historyRows.length }),
    messages: [...history.slice(-MAX_TURNS * 2), { role: 'user', content: question }],
    abortSignal: AbortSignal.timeout(Number(process.env.ANALYSIS_TIMEOUT_MS || 12000)),
    temperature: 0.3,
  });
  return { answer: result.text.trim(), context, model: MODEL, latencyMs: Date.now() - started };
}
