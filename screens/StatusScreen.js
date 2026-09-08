import React, { useContext } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { FirebaseContext } from '../FirebaseContext';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';

export default function StatusScreen() {
  const { 
    status, colors, theme,
    waterLeak, exhaustFan, fireActive, waterLeakActive,
    temperature, humidity, lastReadingAt, readings, isConnected,
    emergencyNumber, autoCallEnabled, callDelaySeconds
  } = useContext(FirebaseContext);

  const isOnline = status !== 'OFFLINE';
  const gradientColors = theme === 'Dark' ? ['#0f172a', '#1e293b'] : ['#ffffff', '#f1f5f9'];

  // A reading older than 30s means the ESP32 (which uploads every 2s) has gone quiet
  const secondsSinceReading = lastReadingAt ? Math.round((Date.now() - lastReadingAt) / 1000) : null;
  const deviceStale = secondsSinceReading === null || secondsSinceReading > 30;
  const lastSyncText = secondsSinceReading === null ? 'No data yet'
    : secondsSinceReading < 5 ? 'Just now'
    : secondsSinceReading < 60 ? `${secondsSinceReading}s ago`
    : `${Math.round(secondsSinceReading / 60)} min ago`;

  // Dynamic System Health calculation
  let healthPercent = 100;
  let healthDescText = "All systems are operating normally. Maintenance not required.";
  let healthColor = colors.safe;

  if (fireActive && waterLeak) {
    healthPercent = 20;
    healthDescText = "CRITICAL: Multiple hazards detected! High smoke level and water leak active.";
    healthColor = colors.danger;
  } else if (fireActive) {
    healthPercent = 40;
    healthDescText = "CRITICAL: High smoke level detected! Exhaust fan is activated automatically.";
    healthColor = colors.danger;
  } else if (deviceStale && !isConnected) {
    healthPercent = 50;
    healthDescText = "OFFLINE: No connection to Firebase. Check the phone's network.";
    healthColor = colors.danger;
  } else if (deviceStale) {
    healthPercent = 60;
    healthDescText = "WARNING: No readings from the ESP32 recently. Check device power and Wi-Fi.";
    healthColor = colors.warning;
  } else if (waterLeak) {
    healthPercent = 70;
    healthDescText = "WARNING: Water leak detected on probe sensor. Check plumbing.";
    healthColor = colors.waterAlert || '#3b82f6';
  }

  const strokeDashoffset = 251.2 * (1 - healthPercent / 100);

  return (
    <ScrollView style={[styles.container, {backgroundColor: colors.bgMain}]}>
      
      <LinearGradient colors={gradientColors} style={[styles.deviceCard, {borderColor: colors.borderColor}]}>
        <View style={styles.deviceHeader}>
          <View style={[styles.deviceIcon, {backgroundColor: colors.borderColor}]}>
            <Ionicons name="hardware-chip" size={32} color={colors.iconColor} />
          </View>
          <View style={{flex: 1, marginLeft: 15}}>
            <Text style={[styles.deviceLabel, {color: colors.textSub}]}>Device ID</Text>
            <Text style={[styles.deviceId, {color: colors.textMain}]}>SENTINEL-ESP32-01</Text>
          </View>
          <View style={[styles.statusBadge, {backgroundColor: isOnline ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}]}>
            <Text style={[styles.statusBadgeText, {color: isOnline ? colors.safe : colors.danger}]}>
              {isOnline ? 'ONLINE' : 'OFFLINE'}
            </Text>
          </View>
        </View>

        <View style={[styles.separator, {backgroundColor: colors.borderColor}]} />

        <View style={styles.infoRow}>
          <Text style={[styles.infoLabel, {color: colors.textSub}]}>Smoke / Gas Sensor (MQ, analog)</Text>
          <Text style={[styles.infoValue, {color: fireActive ? colors.danger : (deviceStale ? colors.textSub : colors.safe)}]}>
            {fireActive ? 'DANGER' : (deviceStale ? 'NO DATA' : 'ONLINE')}
          </Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={[styles.infoLabel, {color: colors.textSub}]}>Temp / Humidity (DHT22)</Text>
          <Text style={[styles.infoValue, {color: deviceStale ? colors.textSub : colors.safe}]}>
            {deviceStale ? 'NO DATA' : `${temperature}°C · ${Math.round(humidity)}%`}
          </Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={[styles.infoLabel, {color: colors.textSub}]}>Water Leak Probe</Text>
          <Text style={[styles.infoValue, {color: waterLeak ? colors.danger : colors.safe}]}>
            {waterLeak ? 'LEAK DETECTED' : 'ONLINE'}
          </Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={[styles.infoLabel, {color: colors.textSub}]}>Exhaust Fan Actuator</Text>
          <Text style={[styles.infoValue, {color: exhaustFan ? colors.safe : colors.textSub}]}>
            {exhaustFan ? 'RUNNING' : 'STANDBY'}
          </Text>
        </View>

        <View style={[styles.separator, {backgroundColor: colors.borderColor}]} />

        <View style={styles.infoRow}>
          <Text style={[styles.infoLabel, {color: colors.textSub}]}>Firebase Connection</Text>
          <View style={{flexDirection: 'row', alignItems: 'center'}}>
            <Ionicons name="wifi" size={18} color={isConnected ? colors.safe : colors.danger} style={{marginRight: 6}}/>
            <Text style={[styles.infoValue, {color: isConnected ? colors.safe : colors.danger}]}>{isConnected ? 'CONNECTED' : 'DISCONNECTED'}</Text>
          </View>
        </View>
        <View style={styles.infoRow}>
          <Text style={[styles.infoLabel, {color: colors.textSub}]}>Last Reading</Text>
          <Text style={[styles.infoValueNormal, {color: deviceStale ? colors.warning : colors.iconColor}]}>{lastSyncText}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={[styles.infoLabel, {color: colors.textSub}]}>Readings Buffered (5 min)</Text>
          <Text style={[styles.infoValueNormal, {color: colors.iconColor}]}>{readings.length}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={[styles.infoLabel, {color: colors.textSub}]}>Upload Interval</Text>
          <Text style={[styles.infoValueNormal, {color: colors.iconColor}]}>2s (0.5s on change)</Text>
        </View>
      </LinearGradient>

      <LinearGradient colors={gradientColors} style={[styles.healthCard, {borderColor: colors.borderColor}]}>
        <Text style={[styles.healthTitle, {color: colors.textMain}]}>System Health</Text>
        <View style={styles.healthContent}>
          <View style={styles.healthCircle}>
            <Svg height="80" width="80" viewBox="0 0 100 100">
              <Circle cx="50" cy="50" r="40" stroke={colors.borderColor} strokeWidth="10" fill="none" />
              <Circle 
                cx="50" 
                cy="50" 
                r="40" 
                stroke={healthColor} 
                strokeWidth="10" 
                fill="none" 
                strokeDasharray="251.2" 
                strokeDashoffset={strokeDashoffset} 
              />
            </Svg>
            <Text style={[styles.healthPercent, {color: colors.textMain}]}>{healthPercent}%</Text>
          </View>
          <View style={{flex: 1, marginLeft: 20}}>
            <Text style={[styles.healthDesc, {color: colors.textSub}]}>{healthDescText}</Text>
          </View>
        </View>
      </LinearGradient>
      
      <LinearGradient colors={gradientColors} style={[styles.healthCard, {marginTop: 20, marginBottom: 40, borderColor: colors.borderColor}]}>
        <Text style={[styles.healthTitle, {color: colors.textMain}]}>Emergency Contacts</Text>
        <View style={styles.infoRow}>
          <View style={{flexDirection: 'row', alignItems: 'center'}}>
            <Ionicons name="call" size={22} color={colors.iconColor} style={{marginRight: 15}}/>
            <View>
               <Text style={[styles.infoValueNormal, {color: colors.iconColor}]}>Emergency Number</Text>
               <Text style={[styles.deviceId, {color: colors.textMain, marginTop: 2}]}>{emergencyNumber}</Text>
            </View>
          </View>
          <View style={[styles.statusBadge, {backgroundColor: autoCallEnabled ? 'rgba(59, 130, 246, 0.2)' : colors.borderColor, justifyContent: 'center'}]}>
             <Text style={[styles.statusBadgeText, {color: autoCallEnabled ? '#3b82f6' : colors.textSub}]}>
               {autoCallEnabled ? `AUTO-DIAL ${callDelaySeconds}s` : 'MANUAL'}
             </Text>
          </View>
        </View>
      </LinearGradient>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 15 },
  deviceCard: { borderRadius: 16, padding: 20, borderWidth: 1, marginBottom: 20, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  deviceHeader: { flexDirection: 'row', alignItems: 'center' },
  deviceIcon: { width: 54, height: 54, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  deviceLabel: { fontSize: 13, marginBottom: 5, fontWeight: '600' },
  deviceId: { fontSize: 20, fontWeight: '800', letterSpacing: 0.5 },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20 },
  statusBadgeText: { fontWeight: 'bold', fontSize: 12, letterSpacing: 1 },
  separator: { height: 1, marginVertical: 15 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12, alignItems: 'center' },
  infoLabel: { fontSize: 14, fontWeight: '600' },
  infoValue: { fontSize: 14, fontWeight: '800', letterSpacing: 0.5 },
  infoValueNormal: { fontSize: 14, fontWeight: '600' },
  healthCard: { borderRadius: 16, padding: 20, borderWidth: 1, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  healthTitle: { fontSize: 16, fontWeight: '800', marginBottom: 20, letterSpacing: 0.5 },
  healthContent: { flexDirection: 'row', alignItems: 'center' },
  healthCircle: { width: 80, height: 80, justifyContent: 'center', alignItems: 'center', shadowColor: "#10b981", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  healthPercent: { fontSize: 18, fontWeight: '900', position: 'absolute' },
  healthDesc: { fontSize: 14, lineHeight: 22, fontWeight: '500' }
});
