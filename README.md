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

## Features Included:
- **Realtime Fire Alert**: Listens for `INSERT` on `events`. Triggers a red screen, siren sound, and "Acknowledge" button.
- **Twilio Integration**: Automatically sends an SMS to the designated number when fire is detected.
- **Live Graphing**: Visualizes the last 7 smoke readings using `react-native-chart-kit`.
- **Heartbeat Monitor**: Automatically checks if the IoT device is still sending data every 5 seconds. Shows **OFFLINE** if no data is received for 3 minutes.
- **Event Log**: A list of the last 10 system events at the bottom.
