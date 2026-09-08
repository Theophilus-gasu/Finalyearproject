import React, { createContext, useState, useEffect, useRef } from 'react';
import { ref, onValue, set, push, update, query, limitToLast, serverTimestamp } from 'firebase/database';
import { database } from './firebaseConfig';
import * as Notifications from 'expo-notifications';
import { Vibration } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { placeEmergencyCall } from './emergencyCall';
import { analyzeIncident, aiConfigured, BENIGN_CAUSES } from './aiService';

const TRIAGE_MIN_CONFIDENCE = 0.6; // benign verdicts below this never extend the countdown

const SETTINGS_KEY = '@sentinel/emergency_settings';
const BUFFER_MS = 5 * 60 * 1000;   // in-memory reading window
const EVENTS_TO_LOAD = 50;         // how many past events to pull from Firebase on startup
const newEventId = () => `${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export const FirebaseContext = createContext();

export const FirebaseProvider = ({ children }) => {
  // Theme State
  const [theme, setTheme] = useState('Dark');

  // Theme Colors
  const colors = {
    bgMain: theme === 'Dark' ? '#020617' : '#f8fafc',
    bgCard: theme === 'Dark' ? '#0f172a' : '#ffffff',
    borderColor: theme === 'Dark' ? '#1e293b' : '#e2e8f0',
    textMain: theme === 'Dark' ? '#ffffff' : '#0f172a',
    textSub: theme === 'Dark' ? '#94a3b8' : '#64748b',
    textMuted: theme === 'Dark' ? '#64748b' : '#94a3b8',
    iconColor: theme === 'Dark' ? '#cbd5e1' : '#475569',
    safe: '#10b981',
    warning: '#f59e0b',
    danger: '#ef4444',
    waterAlert: '#3b82f6',
    humidity: '#06b6d4',
    tabBarBg: theme === 'Dark' ? '#0f172a' : '#ffffff',
    headerBg: theme === 'Dark' ? '#0f172a' : '#ffffff',
    chartBg: theme === 'Dark' ? '#0f172a' : '#ffffff',
  };

  // Live sensor values. The ESP32 has ONE smoke/gas sensor (analog, 0-1023, sent as `gas_level`),
  // a DHT22 (temperature + humidity) and a water probe.
  const [smokeLevel, setSmokeLevel] = useState(0);
  const [temperature, setTemperature] = useState(0);
  const [humidity, setHumidity] = useState(0);
  const [waterLeak, setWaterLeak] = useState(false);
  const [exhaustFan, setExhaustFan] = useState(false);
  const [lastReadingAt, setLastReadingAt] = useState(null);

  // Alert state
  const [fireActive, setFireActive] = useState(false);
  const [waterLeakActive, setWaterLeakActive] = useState(false);
  const [status, setStatus] = useState('ONLINE');

  // Timestamped ring buffer of the last BUFFER_MS of readings: { ts, smoke, temp, humidity, water }
  const [readings, setReadings] = useState([]);
  // Event log (persisted in Firebase /events when not simulating)
  const [events, setEvents] = useState([]);

  // Settings & Thresholds
  const [vibration, setVibration] = useState(true);
  const [pushNotif, setPushNotif] = useState(true);
  const [thresholdWarning, setThresholdWarning] = useState(300);
  const [thresholdDanger, setThresholdDanger] = useState(500);
  const [thresholdTempDanger, setThresholdTempDanger] = useState(35);
  const [waterLeakAlertEnabled, setWaterLeakAlertEnabled] = useState(true);

  // Simulation
  const [isSimulating, setIsSimulating] = useState(false);
  const simIntervalRef = useRef(null);
  const isSimulatingRef = useRef(false);
  isSimulatingRef.current = isSimulating;

  // Emergency Call Settings (persisted)
  const [emergencyNumber, setEmergencyNumber] = useState('911');
  const [autoCallEnabled, setAutoCallEnabled] = useState(true);
  const [callDelaySeconds, setCallDelaySeconds] = useState(30);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  // AI settings (persisted). aiEnabled is true only when the server URL is configured in .env.
  const aiEnabled = aiConfigured();
  const [aiTriageEnabled, setAiTriageEnabled] = useState(true);   // benign verdict may extend the countdown
  const [speakReports, setSpeakReports] = useState(true);         // overlay reads the summary aloud

  // AI incident analysis for the current alert: null | { status: 'pending'|'done'|'error', ...verdict }
  const [incidentAnalysis, setIncidentAnalysis] = useState(null);
  const [countdownExtended, setCountdownExtended] = useState(false);

  // Emergency Call State
  const [callCountdown, setCallCountdown] = useState(null); // seconds remaining, null when idle
  const [callPlaced, setCallPlaced] = useState(false);
  const callTimerRef = useRef(null);
  const remainingRef = useRef(0);
  // Refs so timer callbacks and Firebase listeners always see the latest settings/data
  const callSettingsRef = useRef({});
  callSettingsRef.current = { emergencyNumber, autoCallEnabled, callDelaySeconds, aiTriageEnabled, thresholdWarning, thresholdDanger, thresholdTempDanger };
  const callStateRef = useRef({ counting: false, placed: false, extended: false });
  const readingsRef = useRef([]);
  readingsRef.current = readings;

  // Mirroring guards
  const lastMirroredRef = useRef(null);   // JSON of the last payload written to /history (dedupe re-subscribes)
  const skipNextMirrorRef = useRef(false); // set when we reset sensor_readings ourselves in acknowledgeAlert

  useEffect(() => {
    Notifications.requestPermissionsAsync();
    AsyncStorage.getItem(SETTINGS_KEY)
      .then(raw => {
        if (raw) {
          const saved = JSON.parse(raw);
          if (typeof saved.emergencyNumber === 'string') setEmergencyNumber(saved.emergencyNumber);
          if (typeof saved.autoCallEnabled === 'boolean') setAutoCallEnabled(saved.autoCallEnabled);
          if (Number.isFinite(saved.callDelaySeconds)) setCallDelaySeconds(saved.callDelaySeconds);
          if (typeof saved.aiTriageEnabled === 'boolean') setAiTriageEnabled(saved.aiTriageEnabled);
          if (typeof saved.speakReports === 'boolean') setSpeakReports(saved.speakReports);
        }
      })
      .catch(err => console.log("Error loading emergency settings: ", err))
      .finally(() => setSettingsLoaded(true));
    return () => {
      clearInterval(callTimerRef.current);
      clearInterval(simIntervalRef.current);
    };
  }, []);

  useEffect(() => {
    if (!settingsLoaded) return;
    AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify({ emergencyNumber, autoCallEnabled, callDelaySeconds, aiTriageEnabled, speakReports }))
      .catch(err => console.log("Error saving emergency settings: ", err));
  }, [settingsLoaded, emergencyNumber, autoCallEnabled, callDelaySeconds, aiTriageEnabled, speakReports]);

  // ---------- Data foundation: buffer + mirroring ----------

  // Append one reading to the in-memory window and (when live) to Firebase /history.
  const recordReading = ({ smoke, temp, humidity: hum, water }, { mirror }) => {
    const now = Date.now();
    setLastReadingAt(now);
    setReadings(prev => [...prev.filter(r => now - r.ts <= BUFFER_MS), { ts: now, smoke, temp, humidity: hum, water }]);

    if (!mirror) return;
    if (skipNextMirrorRef.current) { skipNextMirrorRef.current = false; return; }
    const key = JSON.stringify([smoke, temp, hum, water]);
    if (key === lastMirroredRef.current) return; // same values as last write (listener re-subscribed)
    lastMirroredRef.current = key;
    push(ref(database, 'history'), {
      ts: serverTimestamp(), client_ts: now,
      gas_level: smoke, temperature: temp, humidity: hum, water: water ? 'WET' : 'DRY'
    }).catch(err => console.log("Error mirroring reading to /history: ", err));
  };

  // Add an event. Live: written to Firebase /events (the listener updates state). Simulating: local only.
  // Returns a handle so the AI verdict can be attached to the same event later.
  const addEvent = (type, extra = {}) => {
    const event = { type, smoke: 0, ...extra, time: new Date().toISOString() };
    if (isSimulatingRef.current) {
      const id = newEventId();
      setEvents(prev => [{ id, ...event }, ...prev]);
      return { id, dbRef: null };
    }
    const dbRef = push(ref(database, 'events'));
    set(dbRef, { ...event, ts: serverTimestamp() })
      .catch(err => {
        console.log("Error writing event to /events, keeping it locally: ", err);
        setEvents(prev => [{ id: dbRef.key, ...event }, ...prev]);
      });
    return { id: dbRef.key, dbRef };
  };

  // Attach an AI verdict to an existing event (Firebase when live, local state otherwise).
  const attachAnalysis = (handle, ai) => {
    if (!handle) return;
    if (handle.dbRef) {
      update(handle.dbRef, { ai }).catch(err => console.log("Error attaching analysis to event: ", err));
    } else {
      setEvents(prev => prev.map(e => (e.id === handle.id ? { ...e, ai } : e)));
    }
  };

  // Ask the server to analyse the current buffer. Never blocks the alert; the countdown runs regardless.
  const runIncidentAnalysis = async (trigger, eventHandle) => {
    if (!aiEnabled) return;
    const readingsNow = readingsRef.current;
    if (readingsNow.length < 2) return;
    const { thresholdWarning: smokeWarning, thresholdDanger: smokeDanger, thresholdTempDanger: tempDanger, aiTriageEnabled: triage } = callSettingsRef.current;
    setIncidentAnalysis({ status: 'pending', startedAt: Date.now() });
    try {
      const verdict = await analyzeIncident(readingsNow, { smokeWarning, smokeDanger, tempDanger }, trigger);
      const ai = { ...verdict, analysedAt: new Date().toISOString() };
      setIncidentAnalysis({ status: 'done', ...ai });
      attachAnalysis(eventHandle, ai);

      // Triage: a confident benign verdict buys the user more time. It never cancels the call.
      const benign = BENIGN_CAUSES.includes(verdict.likely_cause) && verdict.confidence >= TRIAGE_MIN_CONFIDENCE;
      if (triage && benign && callStateRef.current.counting && !callStateRef.current.extended) {
        extendCallCountdown(callSettingsRef.current.callDelaySeconds);
      }
    } catch (err) {
      console.log("Incident analysis failed: ", err);
      setIncidentAnalysis({ status: 'error', error: String(err?.message || err) });
    }
  };

  // Load the last EVENTS_TO_LOAD events from Firebase and keep them in sync.
  useEffect(() => {
    const eventsQuery = query(ref(database, 'events'), limitToLast(EVENTS_TO_LOAD));
    const unsubscribe = onValue(eventsQuery, (snapshot) => {
      const list = [];
      snapshot.forEach(child => {
        const v = child.val() || {};
        list.push({ id: child.key, ...v, time: v.time || (v.ts ? new Date(v.ts).toISOString() : new Date().toISOString()) });
      });
      list.sort((a, b) => new Date(b.time) - new Date(a.time));
      setEvents(list);
    }, err => console.log("Error loading /events: ", err));
    return unsubscribe;
  }, []);

  // ---------- Alerts ----------

  const checkDanger = (smokeVal, tempVal) => {
    if (smokeVal >= thresholdDanger && !fireActive) {
      triggerFireAlert(smokeVal);
    } else if (smokeVal < thresholdDanger && tempVal < thresholdTempDanger && fireActive) {
      setFireActive(false);
      if (!waterLeakActive) setStatus('ONLINE');
    }

    if (tempVal >= thresholdTempDanger && !fireActive) {
      triggerTempAlert(tempVal);
    }
  };

  const checkWaterLeak = (waterVal) => {
    if (waterVal === true && !waterLeakActive && waterLeakAlertEnabled) {
      triggerWaterLeakAlert();
    } else if (waterVal === false && waterLeakActive) {
      setWaterLeakActive(false);
      if (!fireActive) setStatus('ONLINE');
    }
  };

  const triggerTempAlert = async (val) => {
    setFireActive(true);
    setStatus('HIGH TEMP');

    if (vibration) {
      Vibration.vibrate([500, 1000, 500, 1000], true);
    }

    if (pushNotif) {
      await Notifications.scheduleNotificationAsync({
        content: { title: "🌡️ HIGH TEMPERATURE WARNING!", body: `Temperature reached ${val}°C (Threshold: ${thresholdTempDanger}°C)`, sound: true },
        trigger: null,
      });
    }

    addEvent('HIGH TEMPERATURE DETECTED', { smoke: val });
  };

  const triggerFireAlert = async (val) => {
    setFireActive(true);
    setStatus('HIGH SMOKE');

    if (vibration) {
      Vibration.vibrate([500, 1000, 500, 1000], true);
    }

    if (pushNotif) {
      await Notifications.scheduleNotificationAsync({
        content: { title: "⚠️ HIGH SMOKE DETECTED!", body: `Smoke intensity: ${val}`, sound: true },
        trigger: null,
      });
    }

    // Automatically trigger exhaust fan
    toggleExhaustFan(true);

    // Start the emergency call countdown (cancelled by Acknowledge / Cancel)
    startCallCountdown();

    const handle = addEvent('HIGH SMOKE DETECTED', { smoke: val });
    runIncidentAnalysis({ type: 'HIGH SMOKE DETECTED', value: val }, handle);
  };

  const triggerWaterLeakAlert = async () => {
    setWaterLeakActive(true);
    setStatus(prev => prev === 'HIGH SMOKE' ? prev : 'WATER LEAK');

    if (vibration) {
      Vibration.vibrate([500, 1000, 500, 1000], true);
    }

    if (pushNotif) {
      await Notifications.scheduleNotificationAsync({
        content: { title: "💧 WATER LEAK DETECTED!", body: `Water has been detected in the monitored area.`, sound: true },
        trigger: null,
      });
    }

    addEvent('WATER LEAK DETECTED');
  };

  const toggleExhaustFan = async (newState) => {
    if (!isSimulatingRef.current) {
      try {
        await set(ref(database, 'control/exhaustFan'), newState);
      } catch (err) {
        console.log("Error updating exhaust fan state in Firebase: ", err);
      }
    }
    setExhaustFan(newState);
  };

  // ---------- Emergency call ----------

  const clearCallCountdown = () => {
    clearInterval(callTimerRef.current);
    callTimerRef.current = null;
    callStateRef.current.counting = false;
    callStateRef.current.extended = false;
    remainingRef.current = 0;
    setCallCountdown(null);
    setCountdownExtended(false);
  };

  // Add time to a running countdown (used once per incident by AI triage).
  const extendCallCountdown = (extraSeconds) => {
    if (!callStateRef.current.counting) return;
    callStateRef.current.extended = true;
    remainingRef.current += Math.max(0, Math.round(extraSeconds));
    setCallCountdown(remainingRef.current);
    setCountdownExtended(true);
    addEvent('COUNTDOWN EXTENDED', { seconds: extraSeconds });
  };

  const callNow = async () => {
    clearCallCountdown();
    if (callStateRef.current.placed) return;
    callStateRef.current.placed = true;
    setCallPlaced(true);
    const number = callSettingsRef.current.emergencyNumber;
    try {
      const result = await placeEmergencyCall(number);
      addEvent('EMERGENCY CALL PLACED', { number, result });
    } catch (err) {
      console.log("Error placing emergency call: ", err);
      callStateRef.current.placed = false;
      setCallPlaced(false);
      addEvent('EMERGENCY CALL FAILED', { number });
    }
  };

  const cancelEmergencyCall = () => {
    if (!callStateRef.current.counting) return;
    clearCallCountdown();
    addEvent('EMERGENCY CALL CANCELLED');
  };

  // Starts the countdown to an automatic call. No-op if disabled, already counting, or already called for this incident.
  const startCallCountdown = () => {
    const { autoCallEnabled: enabled, callDelaySeconds: delay } = callSettingsRef.current;
    if (!enabled || callStateRef.current.counting || callStateRef.current.placed) return;

    callStateRef.current.counting = true;
    callStateRef.current.extended = false;
    remainingRef.current = Math.max(0, Math.round(delay));
    setCallCountdown(remainingRef.current);
    setCountdownExtended(false);

    clearInterval(callTimerRef.current);
    callTimerRef.current = setInterval(() => {
      remainingRef.current -= 1;
      if (remainingRef.current <= 0) {
        callNow();
      } else {
        setCallCountdown(remainingRef.current);
      }
    }, 1000);
  };

  // Settings "Test" button: same path as a real alert, using whatever is in the buffer right now.
  const testEmergencyCall = () => {
    startCallCountdown();
    runIncidentAnalysis({ type: 'TEST ALERT', value: smokeLevel }, addEvent('TEST ALERT', { smoke: smokeLevel }));
  };

  // ---------- Acknowledge / reset / simulation ----------

  const acknowledgeAlert = async () => {
    setFireActive(false);
    setWaterLeakActive(false);
    setStatus('ONLINE');
    setSmokeLevel(0);
    clearCallCountdown();
    callStateRef.current.placed = false;
    setCallPlaced(false);
    setIncidentAnalysis(null);
    Vibration.cancel();

    if (!isSimulatingRef.current) {
      try {
        // Reset the live node so the listener doesn't immediately re-trigger. The ESP32 overwrites
        // it within ~2s. This synthetic reading must not be mirrored into /history.
        skipNextMirrorRef.current = true;
        await set(ref(database, 'sensor_readings'), {
          temperature: 25,
          humidity: 50,
          gas_level: 0,
          water_status: "DRY"
        });
        await set(ref(database, 'control/exhaustFan'), false);
      } catch (err) {
        skipNextMirrorRef.current = false;
        console.log("Error resetting controls in Firebase: ", err);
      }
    } else {
      setExhaustFan(false);
    }
  };

  const resetSystem = () => {
    setSmokeLevel(0);
    setTemperature(0);
    setHumidity(0);
    setWaterLeak(false);
    setIsSimulating(false);
    acknowledgeAlert();
  };

  const toggleSimulation = () => {
    if (!isSimulating) {
      addEvent('SYSTEM NORMAL', { smoke: smokeLevel });
    }
    setIsSimulating(!isSimulating);
  };

  // Parse the ESP32 payload: { temperature, humidity, gas_level, water_status } (older key spellings tolerated).
  const processPayload = (data) => {
    if (!data) return null;
    const smoke = Number(data.gas_level ?? data.smoke ?? data.smokeLevel ?? data.smoke_level ?? 0);
    const temp = Number(data.temperature ?? data.temp ?? 0);
    const hum = Number(data.humidity ?? data.hum ?? 0);

    let water = false;
    const wVal = data.water_status ?? data.waterLeak ?? data.water ?? data.water_leak;
    if (typeof wVal === 'boolean') {
      water = wVal;
    } else if (typeof wVal === 'number') {
      water = wVal > 0;
    } else if (typeof wVal === 'string') {
      const lower = wVal.toLowerCase().trim();
      water = lower === 'wet' || lower === 'true' || lower === '1' || lower === 'leak' || lower === 'high';
    }

    return { smoke, temp, humidity: hum, water };
  };

  const applyReading = (parsed, { mirror }) => {
    setSmokeLevel(parsed.smoke);
    setTemperature(parsed.temp);
    setHumidity(parsed.humidity);
    setWaterLeak(parsed.water);
    recordReading(parsed, { mirror });
    checkDanger(parsed.smoke, parsed.temp);
    checkWaterLeak(parsed.water);
  };

  const [isConnected, setIsConnected] = useState(false);

  // Firebase Listeners
  useEffect(() => {
    if (isSimulating) return;

    // Official Firebase SDK connection state listener
    const connectedRef = ref(database, '.info/connected');
    const unsubscribeConnected = onValue(connectedRef, (snap) => {
      if (snap.val() === true) {
        setIsConnected(true);
        setStatus(prev => (prev === 'OFFLINE' ? 'ONLINE' : prev));
      } else {
        setIsConnected(false);
        setStatus('OFFLINE');
      }
    });

    // Live sensor node only (NOT the root: our own /history and /events writes must not feed back in)
    const sensorRef = ref(database, 'sensor_readings');
    const unsubscribeSensor = onValue(sensorRef, (snapshot) => {
      const parsed = processPayload(snapshot.val());
      if (parsed) applyReading(parsed, { mirror: true });
    });

    const controlRef = ref(database, 'control');
    const unsubscribeControl = onValue(controlRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setExhaustFan(data.exhaustFan || false);
      }
    });

    return () => {
      unsubscribeConnected();
      unsubscribeSensor();
      unsubscribeControl();
    };
  }, [isSimulating, thresholdDanger, thresholdTempDanger, fireActive, waterLeakActive, waterLeakAlertEnabled]);

  // Simulation Loop (never mirrored to Firebase)
  useEffect(() => {
    if (isSimulating) {
      simIntervalRef.current = setInterval(() => {
        const fake = {
          smoke: Math.floor(Math.random() * 700) + 100,
          temp: Math.floor(Math.random() * 20) + 22,
          humidity: Math.floor(Math.random() * 40) + 40,
          water: Math.random() > 0.8,
        };
        applyReading(fake, { mirror: false });
      }, 2000);
    } else {
      clearInterval(simIntervalRef.current);
    }
    return () => clearInterval(simIntervalRef.current);
  }, [isSimulating, fireActive, waterLeakActive, thresholdDanger, thresholdTempDanger, waterLeakAlertEnabled]);

  return (
    <FirebaseContext.Provider value={{
      theme, setTheme, colors, isConnected,
      smokeLevel, temperature, humidity, waterLeak, exhaustFan, lastReadingAt,
      fireActive, waterLeakActive, status, events, readings,
      vibration, setVibration, pushNotif, setPushNotif,
      thresholdWarning, setThresholdWarning, thresholdDanger, setThresholdDanger,
      thresholdTempDanger, setThresholdTempDanger,
      waterLeakAlertEnabled, setWaterLeakAlertEnabled,
      acknowledgeAlert, resetSystem, toggleSimulation, isSimulating, toggleExhaustFan,
      emergencyNumber, setEmergencyNumber, autoCallEnabled, setAutoCallEnabled,
      callDelaySeconds, setCallDelaySeconds, callCountdown, callPlaced, countdownExtended,
      cancelEmergencyCall, callNow, testEmergencyCall,
      aiEnabled, aiTriageEnabled, setAiTriageEnabled, speakReports, setSpeakReports,
      incidentAnalysis, runIncidentAnalysis
    }}>
      {children}
    </FirebaseContext.Provider>
  );
};
