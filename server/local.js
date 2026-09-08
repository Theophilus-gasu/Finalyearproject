// Local stand-in for Vercel: serves the same handlers on http://localhost:3001 so the app can be
// tested without deploying. Loads OPENAI_API_KEY from server/.env or, failing that, the app's root .env
// (which uses the name OPEN_AI_API_KEY).
// Usage: cd server && npm run dev
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*"?([^"\n#]*)"?/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}
loadEnv(path.join(here, '.env'));
loadEnv(path.join(here, '..', '.env'));
if (!process.env.OPENAI_API_KEY && process.env.OPEN_AI_API_KEY) process.env.OPENAI_API_KEY = process.env.OPEN_AI_API_KEY;

const routes = {
  '/api/health': (await import('./api/health.js')).default,
  '/api/analyze-incident': (await import('./api/analyze-incident.js')).default,
  '/api/ask': (await import('./api/ask.js')).default,
};

const port = Number(process.env.PORT || 3001);
http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${port}`);
  const handler = routes[url.pathname];
  if (!handler) {
    res.statusCode = 404;
    return res.end(JSON.stringify({ error: 'Not found', routes: Object.keys(routes) }));
  }
  try {
    await handler(req, res);
  } catch (err) {
    console.error(err);
    res.statusCode = 500;
    res.end(JSON.stringify({ error: String(err?.message || err) }));
  }
}).listen(port, '0.0.0.0', () => {
  console.log(`IoT Sentinel local API on http://localhost:${port}`);
  console.log(`  key configured: ${Boolean(process.env.OPENAI_API_KEY)}   routes: ${Object.keys(routes).join(', ')}`);
  console.log(`  For a phone on the same Wi-Fi use http://<this-mac-ip>:${port}`);
});
