// Incident analysis: turns a window of sensor readings into a plain-English summary and a triage verdict.
// Deterministic statistics are computed here; the model only interprets them. If the model call fails,
// ruleBasedAnalysis() gives a usable answer so the app never depends on OpenAI being up.
import { generateText, Output } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';

export const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const MAX_READINGS = 400;      // 5 min at 0.5s is 600; the app sends ≤ 5 min so this is generous
const SERIES_POINTS = 40;      // downsampled series shown to the model

export const CAUSES = ['fire', 'cooking_smoke', 'steam', 'incense_or_vape', 'gas_leak', 'sensor_fault', 'unknown'];
export const BENIGN_CAUSES = ['cooking_smoke', 'steam', 'incense_or_vape', 'sensor_fault'];

export const RequestSchema = z.object({
  readings: z.array(z.object({
    ts: z.number(),
    smoke: z.number().min(0).max(1023),
    temp: z.number().min(-40).max(125),
    humidity: z.number().min(0).max(100),
    water: z.boolean().optional().default(false),
  })).min(1).max(MAX_READINGS),
  thresholds: z.object({
    smokeWarning: z.number().default(300),
    smokeDanger: z.number().default(500),
    tempDanger: z.number().default(35),
  }).default({}),
  trigger: z.object({
    type: z.string().default('HIGH SMOKE DETECTED'),
    value: z.number().optional(),
    at: z.number().optional(),
  }).default({}),
  localTime: z.string().optional(), // e.g. "14:32" in the phone's timezone, for "time of day" reasoning
});

// What the model writes. The classification itself comes from classify() below; the model may disagree in
// `model_opinion`, which is recorded for evaluation but never drives the countdown.
export const NarrativeSchema = z.object({
  summary: z.string().describe('2-3 plain-English sentences a homeowner can act on. Mention the actual numbers and durations.'),
  recommended_action: z.string().describe('One sentence. What the person should do right now. Always include physically checking the room.'),
  model_opinion: z.enum(CAUSES).describe('Your own best guess at the cause, which may differ from the rule verdict.'),
  model_confidence: z.number().min(0).max(1),
  reasoning: z.string().describe('One sentence on which signals support or contradict the rule verdict.'),
});

// ---------- deterministic statistics ----------

const round = (n, d = 1) => Math.round(n * 10 ** d) / 10 ** d;

export function computeStats(readings) {
  const sorted = [...readings].sort((a, b) => a.ts - b.ts);
  const first = sorted[0], last = sorted[sorted.length - 1];
  const spanSec = round((last.ts - first.ts) / 1000, 0);

  const pick = (key) => sorted.map(r => r[key]);
  const series = (key) => {
    const v = pick(key);
    return { first: v[0], last: v[v.length - 1], min: Math.min(...v), max: Math.max(...v), avg: round(v.reduce((a, b) => a + b, 0) / v.length) };
  };

  // Slope over the last N seconds (units per second), from the earliest reading inside that window.
  const slope = (key, seconds) => {
    const cutoff = last.ts - seconds * 1000;
    const start = sorted.find(r => r.ts >= cutoff) || first;
    const dt = (last.ts - start.ts) / 1000;
    return dt > 0 ? round((last[key] - start[key]) / dt, 2) : 0;
  };

  // How long smoke has been above the danger line (contiguous, ending now)
  const aboveFor = (key, threshold) => {
    let i = sorted.length - 1;
    while (i > 0 && sorted[i - 1][key] >= threshold) i--;
    return sorted[i][key] >= threshold ? round((last.ts - sorted[i].ts) / 1000, 0) : 0;
  };

  return {
    samples: sorted.length,
    spanSec,
    smoke: { ...series('smoke'), slope30s: slope('smoke', 30), slope60s: slope('smoke', 60) },
    temp: { ...series('temp'), slope60s: slope('temp', 60), slope300s: slope('temp', 300) },
    humidity: { ...series('humidity'), slope60s: slope('humidity', 60) },
    waterWet: sorted.some(r => r.water),
    aboveFor: (threshold) => aboveFor('smoke', threshold),
    onset: (warning, danger) => onset(sorted, warning, danger),
    downsampled: downsample(sorted, SERIES_POINTS).map(r => ({
      t: round((r.ts - last.ts) / 1000, 0), s: Math.round(r.smoke), c: round(r.temp), h: Math.round(r.humidity),
    })),
  };
}

// How smoke crossed the line: samples/seconds from the last reading below `warning` to the first at/above `danger`,
// and how much it moved afterwards. A jump in ≤ 2 samples that then stays flat is the signature of a sensor fault.
function onset(sorted, warning, danger) {
  let firstAbove = sorted.findIndex(r => r.smoke >= danger);
  if (firstAbove < 0) return null;
  let lastBelow = firstAbove - 1;
  while (lastBelow >= 0 && sorted[lastBelow].smoke >= warning) lastBelow--;
  const after = sorted.slice(firstAbove).map(r => r.smoke);
  return {
    samples: lastBelow < 0 ? firstAbove + 1 : firstAbove - lastBelow,
    seconds: round((sorted[firstAbove].ts - sorted[Math.max(lastBelow, 0)].ts) / 1000, 0),
    afterRange: Math.round(Math.max(...after) - Math.min(...after)),
    afterSamples: after.length,
  };
}

function downsample(sorted, n) {
  if (sorted.length <= n) return sorted;
  const step = sorted.length / n;
  const out = Array.from({ length: n }, (_, i) => sorted[Math.floor(i * step)]);
  out[n - 1] = sorted[sorted.length - 1];
  return out;
}

// ---------- deterministic classification (the decision table, in code) ----------

export function deriveSignals(stats, thresholds) {
  const on = stats.onset(thresholds.smokeWarning, thresholds.smokeDanger);
  return {
    humidityRise: round(stats.humidity.last - stats.humidity.min),
    tempRise: round(stats.temp.last - stats.temp.min),
    smokeRiseSec: on ? on.seconds : 0,
    onsetSamples: on ? on.samples : null,
    afterRange: on ? on.afterRange : null,
    afterSamples: on ? on.afterSamples : 0,
    aboveDangerSec: stats.aboveFor(thresholds.smokeDanger),
    smokeLast: stats.smoke.last,
    slowRise: stats.smoke.slope60s > 0 && stats.smoke.slope60s < 3 && stats.spanSec >= 120,
  };
}

// Applied in order. Returns { likely_cause, confidence, rule, reasoning }.
export function classify(sig, thresholds, localTime) {
  const hour = localTime ? Number(String(localTime).split(':')[0]) : NaN;
  const mealTime = Number.isFinite(hour) && ((hour >= 6 && hour <= 9) || (hour >= 11 && hour <= 14) || (hour >= 17 && hour <= 21));

  if (sig.smokeLast < thresholds.smokeDanger) {
    return { likely_cause: 'unknown', confidence: 0.3, rule: 0, reasoning: 'Smoke is currently below the danger threshold.' };
  }
  if (sig.onsetSamples !== null && sig.onsetSamples <= 2 && sig.tempRise < 1 && sig.humidityRise < 5) {
    // An instant jump from below warning to above danger is not how smoke builds. Confirmed once it stays flat.
    const confirmed = sig.afterSamples >= 3 && sig.afterRange <= 20;
    if (confirmed || sig.afterSamples < 3) {
      return {
        likely_cause: 'sensor_fault', confidence: confirmed ? 0.8 : 0.6, rule: 1,
        reasoning: confirmed
          ? `Smoke jumped in ${sig.onsetSamples} sample(s) and then stayed flat (moved ${sig.afterRange}) with no temperature or humidity change.`
          : `Smoke jumped from below warning to above danger in ${sig.onsetSamples} sample(s) with no temperature or humidity change; too early to confirm it stays flat.`,
      };
    }
  }
  if (sig.humidityRise >= 12 && sig.tempRise < 2) {
    const conf = sig.humidityRise >= 25 ? 0.85 : 0.7;
    return { likely_cause: 'steam', confidence: conf, rule: 2, reasoning: `Humidity rose ${sig.humidityRise} points while temperature rose only ${sig.tempRise}°C: the signature of steam, not combustion.` };
  }
  if (sig.smokeRiseSec >= 20 && sig.tempRise >= 2) {
    const conf = sig.tempRise >= 5 ? 0.9 : 0.8;
    return { likely_cause: 'fire', confidence: conf, rule: 3, reasoning: `Smoke climbed over ${sig.smokeRiseSec}s and temperature rose ${sig.tempRise}°C together.` };
  }
  if (sig.tempRise >= 2) {
    return { likely_cause: 'fire', confidence: 0.6, rule: 3, reasoning: `Temperature rose ${sig.tempRise}°C with smoke above danger, but the smoke rise was abrupt (${sig.smokeRiseSec}s).` };
  }
  if (sig.slowRise && sig.humidityRise < 5 && sig.tempRise < 1) {
    return { likely_cause: 'gas_leak', confidence: 0.5, rule: 5, reasoning: 'Smoke/gas number rising slowly for minutes with no temperature or humidity change.' };
  }
  if (sig.tempRise < 2 && sig.humidityRise < 12) {
    const cause = mealTime ? 'cooking_smoke' : 'incense_or_vape';
    return { likely_cause: cause, confidence: 0.6, rule: 4, reasoning: `Smoke elevated with flat temperature (+${sig.tempRise}°C) and flat humidity (+${sig.humidityRise}); ${mealTime ? 'meal time' : 'not a meal time'}.` };
  }
  return { likely_cause: 'unknown', confidence: 0.4, rule: 6, reasoning: 'Signals do not match a known pattern.' };
}

const ACTIONS = {
  fire: 'Leave the area and let the emergency call go through; only cancel if you can see there is no fire.',
  steam: 'Check the kitchen or bathroom for a kettle, pot or shower; if the room is clear and smoke-free, cancel the call.',
  cooking_smoke: 'Check the cooker and ventilate; only cancel the call once you have seen the source and it is under control.',
  incense_or_vape: 'Check the room for incense, a vape or an aerosol; cancel the call only if you can see the source.',
  gas_leak: 'Open windows, do not switch anything on or off, check for a gas smell and treat as an emergency if present.',
  sensor_fault: 'Physically check the room now; if there is no smoke at all, cancel the call and inspect the sensor wiring.',
  unknown: 'Physically check the room now; let the call proceed unless you can confirm it is safe.',
};

// Used when the model is unavailable: same verdict, templated words.
export function ruleBasedAnalysis(stats, thresholds, localTime) {
  const sig = deriveSignals(stats, thresholds);
  const v = classify(sig, thresholds, localTime);
  const { smoke, temp, humidity } = stats;
  const r0 = (n) => Math.round(n);
  const summary = `Smoke went from ${r0(smoke.first)} to ${r0(smoke.last)} over ${stats.spanSec}s (peak ${r0(smoke.max)}, threshold ${thresholds.smokeDanger}). ` +
    `Temperature ${round(temp.first)}→${round(temp.last)}°C, humidity ${r0(humidity.first)}→${r0(humidity.last)}%. ` +
    (stats.waterWet ? 'Water probe is WET. ' : '') + v.reasoning;
  return { ...v, summary, recommended_action: ACTIONS[v.likely_cause], source: 'rules', signals: sig };
}

// ---------- model call ----------

// System prompt: role, sensors, and the decision table (so the model can explain the verdict it is given).
export function buildSystemPrompt(thresholds) {
  return `You write the incident report inside a home safety monitor. One ESP32 in a room reports, every ~2 seconds:
- an analog MQ-series smoke/gas sensor (0-1023; warning ≥ ${thresholds.smokeWarning}, danger ≥ ${thresholds.smokeDanger}). It reacts to smoke, cooking fumes, incense, aerosols, alcohol vapour AND water vapour (steam). A high reading alone does not tell you which.
- a DHT22 temperature (°C, danger ≥ ${thresholds.tempDanger}) and relative humidity (%),
- a water-leak probe (WET/DRY).
There is NO separate gas sensor and NO camera.

The classification has ALREADY been made by a fixed decision table that runs before you:
1. sensor_fault — instant jump (≤ 2 samples) then flat, no temperature or humidity change.
2. steam — humidity rise ≥ 12 points with temperature rise < 2°C.
3. fire — smoke climbing ≥ 20 s AND temperature rise ≥ 2°C.
4. cooking_smoke / incense_or_vape — gradual smoke rise, temperature rise < 2°C, humidity rise < 12.
5. gas_leak — slow steady rise over minutes, nothing else changing.
6. unknown — anything else.

Your job: write the summary and recommended action for the homeowner, consistent with the rule verdict, quoting the real numbers and durations and naming the signal that decided it (humidity, temperature, shape of the smoke curve). Then give your own opinion in model_opinion: agree with the rule verdict unless the data clearly contradicts it, and explain in reasoning. Never say the alarm is definitely false; the recommended action must always include physically checking the room.`;
}

// User message: this incident's data plus the rule verdict.
export function buildUserPrompt(stats, thresholds, trigger, localTime, sig, verdict) {
  const on = stats.onset(thresholds.smokeWarning, thresholds.smokeDanger);
  return `Alert that fired: ${trigger.type}${trigger.value != null ? ` at ${trigger.value}` : ''}. Local time: ${localTime || 'unknown'}.

RULE VERDICT: ${verdict.likely_cause} (confidence ${verdict.confidence}, rule ${verdict.rule}). Basis: ${verdict.reasoning}

Derived: humidity rise within window = ${sig.humidityRise} points; temperature rise within window = ${sig.tempRise}°C.
Smoke onset: ${on ? `went from below warning to above danger in ${on.samples} sample(s) (${on.seconds}s); in the ${on.afterSamples} sample(s) since, smoke moved by ${on.afterRange}` : 'smoke has not crossed the danger threshold in this window'}.

Window statistics (${stats.samples} samples over ${stats.spanSec}s):
- smoke: first ${stats.smoke.first}, last ${stats.smoke.last}, min ${stats.smoke.min}, max ${stats.smoke.max}, slope last 30s ${stats.smoke.slope30s}/s, last 60s ${stats.smoke.slope60s}/s, above danger for ${stats.aboveFor(thresholds.smokeDanger)}s
- temperature: first ${stats.temp.first}, last ${stats.temp.last}°C, min ${stats.temp.min}, max ${stats.temp.max}, slope last 60s ${stats.temp.slope60s}°C/s, last 5min ${stats.temp.slope300s}°C/s
- humidity: first ${stats.humidity.first}, last ${stats.humidity.last}%, min ${stats.humidity.min}, max ${stats.humidity.max}, slope last 60s ${stats.humidity.slope60s}%/s
- water probe wet at any point: ${stats.waterWet}

Downsampled series, t = seconds before now, s = smoke, c = °C, h = humidity%:
${stats.downsampled.map(p => `t${p.t}: s${p.s} c${p.c} h${p.h}`).join('\n')}`;
}

export async function analyzeIncident(input) {
  const { readings, thresholds, trigger, localTime } = RequestSchema.parse(input);
  const stats = computeStats(readings);
  const sig = deriveSignals(stats, thresholds);
  const verdict = classify(sig, thresholds, localTime);
  const statsOut = {
    samples: stats.samples, spanSec: stats.spanSec,
    smoke: stats.smoke, temp: stats.temp, humidity: stats.humidity, waterWet: stats.waterWet,
    aboveDangerSec: sig.aboveDangerSec,
  };
  const base = { ...verdict, signals: sig, stats: statsOut };

  const apiKey = process.env.OPENAI_API_KEY || process.env.OPEN_AI_API_KEY;
  if (!apiKey) {
    return { ...ruleBasedAnalysis(stats, thresholds, localTime), stats: statsOut, model: null, error: 'OPENAI_API_KEY not configured' };
  }

  try {
    const openai = createOpenAI({ apiKey });
    const started = Date.now();
    const result = await generateText({
      model: openai(MODEL),
      output: Output.object({ schema: NarrativeSchema, name: 'incident_report' }),
      system: buildSystemPrompt(thresholds),
      prompt: buildUserPrompt(stats, thresholds, trigger, localTime, sig, verdict),
      abortSignal: AbortSignal.timeout(Number(process.env.ANALYSIS_TIMEOUT_MS || 9000)),
      temperature: 0.2,
    });
    const n = result.output;
    return {
      ...base,
      summary: n.summary,
      recommended_action: n.recommended_action,
      reasoning: n.reasoning,
      model_opinion: n.model_opinion,
      model_confidence: n.model_confidence,
      source: 'model', model: MODEL, latencyMs: Date.now() - started,
    };
  } catch (err) {
    console.error('analyzeIncident model call failed, using rules:', err?.message || err);
    return { ...ruleBasedAnalysis(stats, thresholds, localTime), stats: statsOut, model: MODEL, error: String(err?.message || err) };
  }
}
