# IoT Sentinel App Setup Guide

This guide will walk you through setting up the complete Fire & Vitals monitoring system.

## 1. Database Setup (Supabase)
1. Go to your [Supabase Dashboard](https://app.supabase.com/).
2. Open the **SQL Editor**.
3. Copy and run the contents of `setup.sql`.
   - This creates the `events` table.
   - It enables **Realtime** so the app can listen for live fire alerts.

## 2. Environment Configuration
1. Create a `.env` file in the root directory (based on `.env.example`).
2. Fill in your credentials:
   - `EXPO_PUBLIC_SUPABASE_URL`: Your project URL from Supabase Settings.
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY`: Your anon/public key from Supabase Settings.
   - `EXPO_PUBLIC_TWILIO_SID` & `EXPO_PUBLIC_TWILIO_TOKEN`: From your Twilio Console.

## 3. Installation
Run the following command in your terminal to install all dependencies:
```bash
npm install
```

## 4. Running the App
Start the Expo development server:
```bash
npx expo start
```
You can then open the app on your phone via the **Expo Go** app (scan the QR code).

### Building a native Android app (for silent auto-dial)
```bash
npx expo run:android
```
This generates the `android/` folder (gitignored) with the `CALL_PHONE` permission and builds the APK.
`plugins/withNdkVersion.js` (registered in `app.json`) pins the Android NDK to a version installed on this
machine (28.2), because Expo's default 27.1 failed to download. It runs on every prebuild, so nothing needs
re-adding by hand. If you move to another machine, either install NDK 28.2.13676358 from Android Studio's
SDK Manager or change the version in `app.json`.

## Data Model (Firebase Realtime Database)
```
sensor_readings          live node, overwritten by the ESP32 every 2s (0.5s on change)
  { temperature, humidity, gas_level (0-1023), water_status: "WET"|"DRY" }
control                  { exhaustFan, alarm, soundAlert }
history/{pushId}         one row per reading, mirrored by the app while it is open
  { ts (server), client_ts, gas_level, temperature, humidity, water }
events/{pushId}          alert / call log, persisted (History tab loads the last 50)
  { ts (server), time (ISO), type, smoke, number?, result? }
```
The app also keeps a 5-minute in-memory buffer of timestamped readings (`readings` in the context) which
drives the Graph tab and will feed the AI incident analysis. Simulation mode never writes to Firebase.

## AI Incident Analysis (server/)
When a smoke alert fires, the app sends the last 5 minutes of readings to a small server (`server/`,
Vercel functions) which asks OpenAI for a plain-English summary and a triage verdict
(`fire`, `steam`, `cooking_smoke`, `incense_or_vape`, `gas_leak`, `sensor_fault`, `unknown` + confidence).
- The verdict is shown on the emergency overlay, read aloud (expo-speech), attachable to an SMS, and saved
  on the event in `/events` so it appears in History.
- **Triage never cancels the call.** A confident benign verdict (≥ 0.6) extends the countdown once; that is all.
- The OpenAI key stays on the server. The app only needs `EXPO_PUBLIC_AI_API_URL` (see `.env.example`).
- **Ask Sentinel** (Ask tab): chat with the system about the room — current readings, what happened earlier,
  why an alert fired. Answers come from `/history`, `/events` and the phone's live state, with times quoted.
  Read-only: it cannot change settings or controls.
See `server/README.md` for running it locally and deploying.

## Features Included:
- **Realtime Fire Alert**: Listens for `INSERT` on `events`. Triggers a red screen, siren sound, and "Acknowledge" button.
- **Automatic Emergency Call**: When smoke reaches the danger threshold, a full-screen countdown appears (default 30s) with a cancel button. When it reaches zero the app dials the configured emergency number (default `911`, editable in Settings).
  - **Android dev/EAS build** (has `CALL_PHONE` permission from `app.json`): the call connects automatically.
  - **Expo Go / iOS**: the dialer opens pre-filled with the number; one tap to connect. (iOS never allows a silent dial; Expo Go does not carry the permission.)
  - **Test with your own number** in Settings before demoing — the default really is 911.
- **Live Graphing**: Visualizes the last 7 smoke readings using `react-native-chart-kit`.
- **Heartbeat Monitor**: Automatically checks if the IoT device is still sending data every 5 seconds. Shows **OFFLINE** if no data is received for 3 minutes.
- **Event Log**: A list of the last 10 system events at the bottom.
