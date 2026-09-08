# IoT Sentinel — New Features for Testing

Build of 7 September 2026.

## 0. Run the AI server first (required for features 3, 4 and 5)

On the laptop, in the project folder:

```bash
cd server && npm run dev
```

- Leave that terminal open the whole time. You should see `key configured: true`.
- The phone must be on the **same Wi-Fi or hotspot** as the laptop.
- If the laptop's IP has changed, run `ipconfig getifaddr en0`, update `EXPO_PUBLIC_AI_API_URL` in `.env`, and restart Expo.
- Check it from the phone: **Settings → AI Incident Analysis → CHECK** must say "Online".
- Features 1 and 2 work without the server.

## 1. Automatic emergency call

- When smoke reaches the danger threshold, a full-screen red countdown appears over every tab.
- At zero it dials the emergency number by itself (Android build) or opens the dialer pre-filled (iPhone / Expo Go).
- Buttons on the overlay: **I'm Safe – Cancel Call**, **Call Now**, **SMS Report**.
- **Settings → Emergency Call**: editable number (default 911), auto-call on/off, countdown seconds. Saved on the phone.
- **Settings → Test Emergency Countdown** runs the whole flow without smoke.
- **Acknowledge Alert** on the Dashboard resets it.

> Put your **own phone number** in Settings before testing. The default really is 911.

## 2. Live data recording

- Humidity now shown on the Dashboard, with a "Last Reading" card and sample count.
- Every reading is saved to Firebase with a timestamp, and every alert or call to the event log.
- History tab now survives app restarts.
- Graph tab: Smoke / Temp / Humidity switch, real clock times on the axis, 1-minute or 5-minute window.
- Status tab: real sensor rows, real Firebase connection state, "no data" warning if the device goes quiet. The fake Wi-Fi/battery/uptime numbers are gone.
- The phantom second gas sensor is removed.

## 3. AI incident report *(needs server)*

- When an alert fires, the last 5 minutes of readings are analysed.
- Overlay shows likely cause, confidence %, a plain-English summary with the real numbers, and a recommended action.
- The report is read aloud (can be turned off in Settings).
- **SMS Report** opens the messages app with the report pre-filled.
- The report is saved on the event and shown in History.

## 4. AI false-alarm triage *(needs server)*

- Verdicts: fire, steam, cooking smoke, incense/vape, gas leak, sensor fault, unknown.
- Decided by a fixed decision table from humidity rise, temperature rise and how fast the smoke jumped.
- A harmless verdict at ≥ 60 % confidence doubles the countdown once. It never cancels the call.
- Toggle in Settings: **Triage can extend countdown**.

## 5. Ask Sentinel chat — new **Ask** tab *(needs server)*

- Ask about the room: current readings, what happened earlier, why an alert fired.
- Answers use live values, recorded history and the event log, and quote times.
- Read-only: it refuses to change settings or controls and tells you where to do it in the app.
- Suggested-question chips, typing indicator, clear error message if the server is unreachable.

## Known behaviour, not bugs

| You see | Why |
|---|---|
| On iPhone the call needs a tap to confirm | iOS never allows an app to dial silently. |
| "Analysis failed" or "couldn't reach the AI server" | The laptop server is off or the phone is on a different network. |
| With no smoke, the analysis says SENSOR FAULT or UNKNOWN | Correct: flat readings that suddenly "alert" (the test button) look like a fault. |
| Graph is empty for the first ~30 seconds | It only shows readings received since the app opened. |
