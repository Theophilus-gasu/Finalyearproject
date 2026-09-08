// Verifies OPENAI_API_KEY from .env works. Never prints the key.
// Usage: node scripts/testOpenAIKey.js
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env');
let key = process.env.OPENAI_API_KEY || process.env.OPEN_AI_API_KEY;
if (!key && fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*(?:export\s+)?OPEN_?AI_API_KEY\s*=\s*"?([^"\s#]+)"?/);
    if (m) { key = m[1]; break; }
  }
}

if (!key) {
  console.log('FAIL: OPENAI_API_KEY / OPEN_AI_API_KEY not found in .env or environment');
  process.exit(1);
}
console.log(`Key found (${key.length} chars, starts with "${key.slice(0, 3)}...")`);

(async () => {
  // 1. Free auth check — list models
  const list = await fetch('https://api.openai.com/v1/models', {
    headers: { Authorization: `Bearer ${key}` },
  });
  if (!list.ok) {
    const body = await list.text();
    console.log(`FAIL: /v1/models returned ${list.status}: ${body.slice(0, 200)}`);
    process.exit(1);
  }
  const models = (await list.json()).data.map(m => m.id);
  console.log(`OK: key is valid, ${models.length} models available`);
  console.log('   e.g.', models.filter(m => /^gpt-4o|^gpt-4\.1|^o[0-9]/.test(m)).slice(0, 6).join(', '));

  // 2. Tiny paid call — proves billing/quota works (a few tokens)
  const chat = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      max_tokens: 5,
      messages: [{ role: 'user', content: 'Reply with the single word: OK' }],
    }),
  });
  if (!chat.ok) {
    const body = await chat.text();
    console.log(`FAIL: chat completion returned ${chat.status}: ${body.slice(0, 300)}`);
    process.exit(1);
  }
  const reply = (await chat.json()).choices[0].message.content.trim();
  console.log(`OK: chat completion works, model replied "${reply}"`);
})().catch(err => { console.log('FAIL:', err.message); process.exit(1); });
