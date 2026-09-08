// Runs synthetic scenarios through analyzeIncident against the real OpenAI key. Usage: node test-analyze.mjs
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
for (const f of [path.join(here, '.env'), path.join(here, '..', '.env')]) {
  if (!fs.existsSync(f)) continue;
  for (const line of fs.readFileSync(f, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*"?([^"\n#]*)"?/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}
if (!process.env.OPENAI_API_KEY && process.env.OPEN_AI_API_KEY) process.env.OPENAI_API_KEY = process.env.OPEN_AI_API_KEY;
const { analyzeIncident } = await import('./lib/analyze.js');

// 120 samples at 2s = 4 minutes ending now
const series = (fn) => { const now = Date.now(); return Array.from({ length: 120 }, (_, i) => { const t = i * 2; return { ts: now - (238 - t) * 1000, ...fn(t) }; }); };
const scenarios = {
  fire:   series(t => ({ smoke: t < 150 ? 40 + Math.random() * 10 : Math.min(1023, 40 + (t - 150) * 7), temp: t < 150 ? 27 : 27 + (t - 150) * 0.16, humidity: 60 - (t > 150 ? (t - 150) * 0.05 : 0), water: false })),
  kettle: series(t => ({ smoke: t < 180 ? 30 + Math.random() * 10 : Math.min(1023, 30 + (t - 180) * 10), temp: 26 + (t > 180 ? 0.3 : 0), humidity: t < 180 ? 55 : Math.min(98, 55 + (t - 180) * 0.8), water: false })),
  toast:  series(t => ({ smoke: t < 160 ? 35 + Math.random() * 8 : Math.min(1023, 35 + (t - 160) * 8), temp: 27 + Math.random() * 0.4, humidity: 58 + Math.random() * 2, water: false })),
  fault:  series(t => ({ smoke: t < 236 ? 45 : 900, temp: 27.1, humidity: 61, water: false })),
};
const RUNS = Number(process.env.RUNS || 3);
const expected = { fire: 'fire', kettle: 'steam', toast: 'cooking_smoke', fault: 'sensor_fault' };
const table = [];
for (const [name, readings] of Object.entries(scenarios)) {
  const last = readings[readings.length - 1];
  const verdicts = [];
  for (let i = 0; i < RUNS; i++) {
    const v = await analyzeIncident({ readings, thresholds: { smokeWarning: 300, smokeDanger: 500, tempDanger: 35 }, trigger: { type: 'HIGH SMOKE DETECTED', value: Math.round(last.smoke) }, localTime: '18:40' });
    verdicts.push(v);
    if (i === 0) { console.log(`\n=== ${name.toUpperCase()} === (${v.source}, ${v.latencyMs ?? '-'}ms)${v.error ? ' ERROR=' + v.error : ''}`); console.log('summary:', v.summary); console.log('why    :', v.reasoning); }
  }
  const hits = verdicts.filter(v => v.likely_cause === expected[name]).length;
  table.push({ scenario: name, expected: expected[name], rule_verdict: verdicts.map(v => `${v.likely_cause}@${v.confidence}`).join(' '), model_opinion: verdicts.map(v => `${v.model_opinion ?? '-'}@${v.model_confidence ?? '-'}`).join(' '), hits: `${hits}/${RUNS}` });
}
console.log('\n' + '='.repeat(70)); console.table(table);
