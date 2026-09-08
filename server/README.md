# IoT Sentinel server

Serverless functions that call OpenAI on behalf of the app. The OpenAI key lives here (Vercel env var or
`server/.env`), never in the mobile app.

| Route | Method | Purpose |
|---|---|---|
| `/api/health` | GET | Is the deployment up, is the key configured |
| `/api/analyze-incident` | POST | Sensor window → `{ summary, likely_cause, confidence, recommended_action, reasoning, stats }` |
| `/api/ask` | POST | Question + chat history + live state → `{ answer, context }`. Reads the last 2000 `/history` rows (bucketed per minute) and last 50 `/events` over Firebase REST. Read-only. |

`lib/analyze.js` works in two stages:
1. **Classification is deterministic.** `computeStats()` derives slopes, humidity rise, temperature rise and the
   smoke *onset* (how many samples the jump from below-warning to above-danger took). `classify()` applies the
   decision table in code — sensor fault → steam → fire → cooking/incense → gas leak → unknown — and returns
   `likely_cause`, `confidence` and the rule number. This is what drives the countdown extension.
2. **The model narrates.** `gpt-4o-mini` gets the statistics plus the rule verdict and writes `summary` and
   `recommended_action`. It also records its own `model_opinion`; a disagreement is shown in History but never
   changes the verdict. If the model call fails or the key is missing, `ruleBasedAnalysis()` produces a
   templated summary from the same verdict, so the app never blocks on OpenAI.

### Why the classification is not done by the model
Measured with `test-analyze.mjs` (synthetic fire / kettle / toast / sensor-fault windows, 3 runs each):

| Classifier | fire | kettle→steam | toast→cooking | fault | total |
|---|---|---|---|---|---|
| `gpt-4o-mini` following the decision table in the prompt | 3/3 | 0/3 | 0/3 | 0/3 | 3/12 |
| `gpt-4o`, same prompt | 2/2 | 2/2 | 2/2 | 2/2 | 8/8 |
| Decision table in code (any model narrating) | 3/3 | 3/3 | 3/3 | 3/3 | 12/12 |

The small model would call everything "fire" while writing "temperature rose only 0.3 °C"; the large one
followed the table but costs ~15× more per call. Putting the table in code makes the verdict correct,
free, instant and testable, and keeps the model for what it is good at — the explanation.
These are synthetic curves; phase 4 repeats this with real sensor runs.

## Local development (no deploy needed)
```bash
cd server && npm install && npm run dev        # http://localhost:3001, reads ../.env (OPEN_AI_API_KEY)
node test-analyze.mjs                          # fire / kettle / toast / fault scenarios against the real key
```
Point the app at your Mac: in the root `.env` set `EXPO_PUBLIC_AI_API_URL=http://<mac-lan-ip>:3001`
(phone and Mac on the same Wi-Fi), then restart `expo start` so the env var is picked up.

## Deploy to Vercel
```bash
cd server
vercel login                                    # once
vercel                                          # creates the project; accept defaults
vercel env add OPENAI_API_KEY production        # paste the key when prompted
vercel env add SENTINEL_APP_TOKEN production    # optional shared secret (then set EXPO_PUBLIC_AI_APP_TOKEN in the app)
vercel --prod
```
Then set `EXPO_PUBLIC_AI_API_URL=https://<project>.vercel.app` in the root `.env` and rebuild the app.

## Ask Sentinel context window
`/api/ask` pulls the last 2000 `/history` rows by push key (no index needed). At 2 s per sample that is about
an hour of continuous data; when the room is quiet the ESP32 writes only on change, so it can span far longer.
Raise `ASK_HISTORY_ROWS` for a longer window at the cost of a slower, more expensive call. Events cover a
much longer period since there are few of them.

## Known limits
- A sensor fault is called at 0.6 the instant it jumps (only two samples of evidence) and 0.8 once three
  flat samples confirm it. A genuine fire that crosses the danger line within two samples would look the same
  for a few seconds; the countdown still runs, so the cost is one extension, not a missed alarm.
- Triage is a demo of the mechanism. Its accuracy has not been measured on real incidents yet — that is
  the phase-4 experiment (log labelled toast / incense / kettle / lighter runs and compare).
