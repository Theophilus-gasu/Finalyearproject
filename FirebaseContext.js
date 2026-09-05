import React, { createContext, useState, useEffect, useRef } from 'react';
import { ref, onValue, set } from 'firebase/database';
import { database } from './firebaseConfig';
import * as Notifications from 'expo-notifications';
import { Linking, Vibration } from 'react-native';

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
    tabBarBg: theme === 'Dark' ? '#0f172a' : '#ffffff',
    headerBg: theme === 'Dark' ? '#0f172a' : '#ffffff',
    chartBg: theme === 'Dark' ? '#0f172a' : '#ffffff',
  };

  const [smokeLevel, setSmokeLevel] = useState(0);
  const [temperature, setTemperature] = useState(0);
  const [fireActive, setFireActive] = useState(false);
  
  // New States
  const [waterLeak, setWaterLeak] = useState(false);
  const [gasLevel, setGasLevel] = useState(0);
  const [exhaustFan, setExhaustFan] = useState(false);
  const [gasActive, setGasActive] = useState(false);
  const [waterLeakActive, setWaterLeakActive] = useState(false);

  const [status, setStatus] = useState('ONLINE');
  const [events, setEvents] = useState([]);
  const [smokeHistory, setSmokeHistory] = useState([50, 40, 60, 45, 65, 55, 75, 45, 60, 0]);
  const [gasHistory, setGasHistory] = useState([20, 25, 22, 28, 30, 24, 35, 28, 30, 0]);
  
  // Settings & Thresholds
  const [vibration, setVibration] = useState(true);
  const [pushNotif, setPushNotif] = useState(true);
  const [thresholdWarning, setThresholdWarning] = useState(300);
  const [thresholdDanger, setThresholdDanger] = useState(500);
  const [thresholdTempDanger, setThresholdTempDanger] = useState(35);

  // New Settings
  const [thresholdGasWarning, setThresholdGasWarning] = useState(30);
  const [thresholdGasDanger, setThresholdGasDanger] = useState(70);
  const [waterLeakAlertEnabled, setWaterLeakAlertEnabled] = useState(true);
  const [gasAlertEnabled, setGasAlertEnabled] = useState(true);

  // Simulation
  const [isSimulating, setIsSimulating] = useState(false);
  const simIntervalRef = useRef(null);

  const callTimerRef = useRef(null);

  useEffect(() => {
    Notifications.requestPermissionsAsync();
    return () => {
      clearTimeout(callTimerRef.current);
      clearInterval(simIntervalRef.current);
    };
  }, []);

  const checkDanger = (smokeVal, gasVal, tempVal) => {
    if (smokeVal >= thresholdDanger && !fireActive) {
      triggerFireAlert(smokeVal);
    } else if (smokeVal < thresholdDanger && tempVal < thresholdTempDanger && fireActive) {
      setFireActive(false);
      if (!waterLeakActive && !gasActive) setStatus('ONLINE');
    }

    if (tempVal >= thresholdTempDanger && !fireActive) {
      triggerTempAlert(tempVal);
    }

    if (gasVal >= thresholdGasDanger && !gasActive && gasAlertEnabled) {
      triggerGasAlert(gasVal);
    } else if (gasVal < thresholdGasDanger && gasActive) {
      setGasActive(false);
    }
  };

  const checkWaterLeak = (waterVal) => {
    if (waterVal === true && !waterLeakActive && waterLeakAlertEnabled) {
      triggerWaterLeakAlert();
    } else if (waterVal === false && waterLeakActive) {
      setWaterLeakActive(false);
      if (!fireActive && !gasActive) setStatus('ONLINE');
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
        content: { title: "🌡️ HIGH TEMPERATURE WARNING!", body: `Temperature reached ${val}°C (Threshold: 32°C)`, sound: true },
        trigger: null,
      });
    }

    setEvents(prev => [{ id: `${Date.now()}_${Math.random().toString(36).substr(2, 6)}`, type: 'HIGH TEMPERATURE DETECTED', smoke: val, time: new Date().toISOString() }, ...prev]);
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

    clearTimeout(callTimerRef.current);
    callTimerRef.current = setTimeout(() => {
      Linking.openURL('tel:911');
    }, 30000);

    setEvents(prev => [{ id: `${Date.now()}_${Math.random().toString(36).substr(2, 6)}`, type: 'HIGH SMOKE DETECTED', smoke: val, time: new Date().toISOString() }, ...prev]);
  };

  const triggerGasAlert = async (val) => {
    setGasActive(true);
    setStatus(prev => prev === 'HIGH SMOKE' ? 'HIGH SMOKE' : 'GAS LEAK');
    
    if (vibration) {
      Vibration.vibrate([500, 1000, 500, 1000], true);
    }
    
    if (pushNotif) {
      await Notifications.scheduleNotificationAsync({
        content: { title: "⚠️ GAS LEAK DETECTED!", body: `Gas level: ${val}/100`, sound: true },
        trigger: null,
      });
    }

    // Automatically trigger exhaust fan
    toggleExhaustFan(true);

    setEvents(prev => [{ id: `${Date.now()}_${Math.random().toString(36).substr(2, 6)}`, type: 'GAS LEAK DETECTED', smoke: val, time: new Date().toISOString() }, ...prev]);
  };

  const triggerWaterLeakAlert = async () => {
    setWaterLeakActive(true);
    setStatus(prev => (prev === 'HIGH SMOKE' || prev === 'GAS LEAK') ? prev : 'WATER LEAK');

    if (vibration) {
      Vibration.vibrate([500, 1000, 500, 1000], true);
    }
    
    if (pushNotif) {
      await Notifications.scheduleNotificationAsync({
        content: { title: "💧 WATER LEAK DETECTED!", body: `Water has been detected in the monitored area.`, sound: true },
        trigger: null,
      });
    }

    setEvents(prev => [{ id: `${Date.now()}_${Math.random().toString(36).substr(2, 6)}`, type: 'WATER LEAK DETECTED', smoke: 0, time: new Date().toISOString() }, ...prev]);
  };

  const toggleExhaustFan = async (newState) => {
    if (!isSimulating) {
      try {
        await set(ref(database, 'control/exhaustFan'), newState);
      } catch (err) {
        console.log("Error updating exhaust fan state in Firebase: ", err);
      }
    }
    setExhaustFan(newState);
  };

  const acknowledgeAlert = async () => {
    setFireActive(false);
    setGasActive(false);
    setWaterLeakActive(false);
    setStatus('ONLINE');
    setSmokeLevel(0);
    clearTimeout(callTimerRef.current);
    Vibration.cancel();
    
    if (!isSimulating) {
      try {
        await set(ref(database, 'sensor_readings'), {
          temperature: 25,
          humidity: 50,
          gas_level: 0,
          water_status: "DRY"
        });
        await set(ref(database, 'control/exhaustFan'), false);
      } catch (err) {
        console.log("Error resetting controls in Firebase: ", err);
      }
    } else {
      setExhaustFan(false);
    }
  };

  const resetSystem = () => {
    setSmokeLevel(0);
    setTemperature(0);
    setGasLevel(0);
    setWaterLeak(false);
    setIsSimulating(false);
    acknowledgeAlert();
  };

  const toggleSimulation = () => {
    if (!isSimulating) {
      setEvents(prev => [{ id: `${Date.now()}_${Math.random().toString(36).substr(2, 6)}`, type: 'SYSTEM NORMAL', smoke: smokeLevel, time: new Date().toISOString() }, ...prev]);
    }
    setIsSimulating(!isSimulating);
  };

  // Helper to parse sensor payload flexibly regardless of ESP32 schema format
  const processPayload = (rawVal) => {
    if (!rawVal) return null;
    const data = rawVal.sensor_readings ? rawVal.sensor_readings : (rawVal.sensors ? rawVal.sensors : rawVal);

    const newSmoke = Number(data.gas_level ?? data.smoke ?? data.smokeLevel ?? data.smoke_level ?? data.Smoke ?? 0);
    const newTemp = Number(data.temperature ?? data.temp ?? data.temp_c ?? data.Temperature ?? 0);
    const newGas = Number(data.gas ?? data.gasLevel ?? data.gas_level ?? data.Gas ?? 0);

    let newWater = false;
    const wVal = data.water_status ?? data.waterLeak ?? data.water ?? data.water_leak ?? data.Water;
    if (typeof wVal === 'boolean') {
      newWater = wVal;
    } else if (typeof wVal === 'number') {
      newWater = wVal === 1 || wVal > 0;
    } else if (typeof wVal === 'string') {
      const lower = wVal.toLowerCase().trim();
      newWater = lower === 'wet' || lower === 'true' || lower === '1' || lower === 'leak' || lower === 'high';
    }

    return { newSmoke, newTemp, newGas, newWater };
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

    // Root reference listener for sensor updates
    const rootRef = ref(database, '/');
    const unsubscribeRoot = onValue(rootRef, (snapshot) => {
      const rawVal = snapshot.val();
      if (rawVal) {
        const parsed = processPayload(rawVal);
        if (parsed) {
          const { newSmoke, newTemp, newGas, newWater } = parsed;
          setSmokeLevel(newSmoke);
          setTemperature(newTemp);
          setGasLevel(newGas);
          setWaterLeak(newWater);
          
          setSmokeHistory(prev => [...prev.slice(1), newSmoke]);
          setGasHistory(prev => [...prev.slice(1), newGas]);
          
          checkDanger(newSmoke, newGas, newTemp);
          checkWaterLeak(newWater);
        }
      }
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
      unsubscribeRoot();
      unsubscribeControl();
    };
  }, [isSimulating, thresholdDanger, thresholdGasDanger, fireActive, gasActive, waterLeakActive, gasAlertEnabled, waterLeakAlertEnabled]);

  // Simulation Loop
  useEffect(() => {
    if (isSimulating) {
      simIntervalRef.current = setInterval(() => {
        const fakeSmoke = Math.floor(Math.random() * 700) + 100; 
        const fakeTemp = Math.floor(Math.random() * 20) + 22; 
        const fakeGas = Math.floor(Math.random() * 80) + 15; 
        const fakeWater = Math.random() > 0.8; 
        
        setSmokeLevel(fakeSmoke);
        setTemperature(fakeTemp);
        setGasLevel(fakeGas);
        setWaterLeak(fakeWater);
        
        setSmokeHistory(prev => [...prev.slice(1), fakeSmoke]);
        setGasHistory(prev => [...prev.slice(1), fakeGas]);
        
        checkDanger(fakeSmoke, fakeGas, fakeTemp);
        checkWaterLeak(fakeWater);
      }, 2000);
    } else {
      clearInterval(simIntervalRef.current);
    }
    return () => clearInterval(simIntervalRef.current);
  }, [isSimulating, fireActive, gasActive, waterLeakActive, thresholdDanger, thresholdGasDanger, gasAlertEnabled, waterLeakAlertEnabled]);

  return (
    <FirebaseContext.Provider value={{
      theme, setTheme, colors, isConnected,
      smokeLevel, temperature, fireActive, status, events, smokeHistory,
      waterLeak, gasLevel, exhaustFan, gasActive, waterLeakActive, gasHistory,
      vibration, setVibration, pushNotif, setPushNotif,
      thresholdWarning, setThresholdWarning, thresholdDanger, setThresholdDanger,
      thresholdTempDanger, setThresholdTempDanger,
      thresholdGasWarning, setThresholdGasWarning, thresholdGasDanger, setThresholdGasDanger,
      waterLeakAlertEnabled, setWaterLeakAlertEnabled, gasAlertEnabled, setGasAlertEnabled,
      acknowledgeAlert, resetSystem, toggleSimulation, isSimulating, toggleExhaustFan
    }}>
      {children}
    </FirebaseContext.Provider>
  );
};
