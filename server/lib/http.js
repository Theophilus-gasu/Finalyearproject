// Small helpers shared by the Vercel handlers and the local dev server.

export function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-App-Token');
}

export function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

// Optional shared secret. If SENTINEL_APP_TOKEN is set on the server, requests must send it in X-App-Token.
// It stops strangers who find the URL from burning your OpenAI credit; it is not a substitute for auth.
export function checkToken(req, res) {
  const expected = process.env.SENTINEL_APP_TOKEN;
  if (!expected) return true;
  const got = req.headers['x-app-token'];
  if (got === expected) return true;
  json(res, 401, { error: 'Unauthorized' });
  return false;
}

// Vercel parses JSON bodies for Node functions; the local server passes a raw string. Handle both.
export async function readJson(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return JSON.parse(req.body);
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}
