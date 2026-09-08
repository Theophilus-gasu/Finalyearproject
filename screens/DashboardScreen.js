import React, { useContext, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Animated, Switch } from 'react-native';
import { FirebaseContext } from '../FirebaseContext';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path, Circle, Line, G } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';

const AnimatedG = Animated.createAnimatedComponent(G);

const Gauge = ({ value, colors }) => {
  const radius = 80;
  const strokeWidth = 15;
  const circumference = Math.PI * radius;
  const safeEnd = circumference * 0.3;
  const warnEnd = circumference * 0.5;
  
  const [angle, setAngle] = React.useState(0);
  const animatedValue = useRef(new Animated.Value(value)).current;

  useEffect(() => {
    Animated.spring(animatedValue, {
      toValue: value,
      friction: 6,
      tension: 40,
      useNativeDriver: false
    }).start();

    const listener = animatedValue.addListener(({ value: val }) => {
      const clamped = Math.min(Math.max(val, 0), 1000);
      setAngle((clamped / 1000) * 180);
    });

    return () => {
      animatedValue.removeListener(listener);
    };
  }, [value]);

  const x2 = -65 * Math.cos((angle * Math.PI) / 180);
  const y2 = -65 * Math.sin((angle * Math.PI) / 180);

  return (
    <View style={styles.gaugeContainer}>
      <Svg height="120" width="200" viewBox="-100 -100 200 100">
        <Path d="M -80 0 A 80 80 0 0 1 80 0" fill="none" stroke={colors.danger} strokeWidth={strokeWidth + 4} opacity={0.2} />
        
        <Path d="M -80 0 A 80 80 0 0 1 80 0" fill="none" stroke={colors.danger} strokeWidth={strokeWidth} />
        <Path d="M -80 0 A 80 80 0 0 1 80 0" fill="none" stroke={colors.warning} strokeWidth={strokeWidth} strokeDasharray={`${warnEnd} ${circumference}`} />
        <Path d="M -80 0 A 80 80 0 0 1 80 0" fill="none" stroke={colors.safe} strokeWidth={strokeWidth} strokeDasharray={`${safeEnd} ${circumference}`} />
        
        <Line x1="0" y1="0" x2={x2} y2={y2} stroke={colors.textMain} strokeWidth="6" strokeLinecap="round" />
        
        <Circle cx="0" cy="0" r="15" fill={colors.borderColor} />
        <Circle cx="0" cy="0" r="5" fill={colors.textMain} />
      </Svg>
      <Text style={[styles.gaugeValue, {color: colors.textMain}]}>{value}<Text style={{fontSize: 14, color: colors.textSub}}>/1024</Text></Text>
    </View>
  );
};

export default function DashboardScreen() {
  const {
    smokeLevel, temperature, humidity, fireActive, status,
    waterLeak, exhaustFan, waterLeakActive, lastReadingAt, readings,
    toggleExhaustFan, acknowledgeAlert, resetSystem,
    thresholdWarning, thresholdDanger, thresholdTempDanger,
    colors, theme
  } = useContext(FirebaseContext);

  const pulseAnim = useRef(new Animated.Value(1)).current;

  const isSmokeDanger = smokeLevel >= (thresholdDanger || 500);
  const isSmokeWarning = smokeLevel >= (thresholdWarning || 300);
  const isTempDanger = temperature >= (thresholdTempDanger || 35);
  const humidityColor = humidity >= 80 ? colors.warning : colors.humidity;
  const lastReadingText = lastReadingAt ? new Date(lastReadingAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—';

  useEffect(() => {
    if (fireActive || waterLeakActive || isSmokeDanger || isTempDanger) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.05, duration: 500, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 500, useNativeDriver: true })
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [fireActive, waterLeakActive, isSmokeDanger, isTempDanger]);

  const gradientColors = theme === 'Dark' 
    ? ['#0f172a', '#1e293b'] 
    : ['#ffffff', '#f1f5f9'];

  return (
    <ScrollView style={[styles.container, {backgroundColor: colors.bgMain}]}>
      {/* High Smoke Alert Banner */}
      {isSmokeDanger && (
        <Animated.View style={[styles.alertBannerContainer, { transform: [{ scale: pulseAnim }] }]}>
          <LinearGradient colors={['#ef4444', '#b91c1c']} style={styles.alertBanner} start={{x: 0, y: 0}} end={{x: 1, y: 1}}>
            <Ionicons name="warning" size={32} color="#fff" />
            <View style={{marginLeft: 15, flex: 1}}>
              <Text style={styles.alertTitle}>HIGH SMOKE DETECTED</Text>
              <Text style={styles.alertSubtitle}>Smoke Level: {smokeLevel} (Threshold: {thresholdDanger || 500}). Hazard alert!</Text>
            </View>
          </LinearGradient>
        </Animated.View>
      )}

      {/* High Temperature Banner */}
      {isTempDanger && !isSmokeDanger && (
        <Animated.View style={[styles.alertBannerContainer, { transform: [{ scale: pulseAnim }] }]}>
          <LinearGradient colors={['#ef4444', '#dc2626']} style={styles.alertBanner} start={{x: 0, y: 0}} end={{x: 1, y: 1}}>
            <Ionicons name="thermometer" size={32} color="#fff" />
            <View style={{marginLeft: 15, flex: 1}}>
              <Text style={styles.alertTitle}>HIGH TEMPERATURE WARNING</Text>
              <Text style={styles.alertSubtitle}>Temperature: {temperature}°C (Threshold: {thresholdTempDanger || 35}°C). High heat!</Text>
            </View>
          </LinearGradient>
        </Animated.View>
      )}

      {waterLeakActive && (
        <Animated.View style={[styles.alertBannerContainer, { transform: [{ scale: pulseAnim }] }]}>
          <LinearGradient colors={['#3b82f6', '#2563eb']} style={styles.alertBanner} start={{x: 0, y: 0}} end={{x: 1, y: 1}}>
            <Ionicons name="water" size={32} color="#fff" />
            <View style={{marginLeft: 15, flex: 1}}>
              <Text style={styles.alertTitle}>WATER LEAK DETECTED (WET)</Text>
              <Text style={styles.alertSubtitle}>Probe sensor is WET! Check plumbing immediately.</Text>
            </View>
          </LinearGradient>
        </Animated.View>
      )}

      {/* Primary Sensor Cards: Water, Smoke, and Temperature */}
      <Text style={[styles.sectionHeading, {color: colors.textSub}]}>REAL-TIME SENSORS</Text>

      <View style={styles.cardsRow}>
        <LinearGradient colors={gradientColors} style={[styles.card, {borderColor: isSmokeDanger ? colors.danger : colors.borderColor}]}>
          <View style={styles.cardHeader}>
            <Ionicons name="cloud-outline" size={20} color={isSmokeDanger ? colors.danger : (isSmokeWarning ? colors.warning : colors.safe)} />
            <Text style={[styles.cardTitle, {color: colors.textSub}]}>SMOKE / GAS</Text>
          </View>
          <View style={{flexDirection: 'row', alignItems: 'baseline', marginTop: 10}}>
            <Text style={[styles.cardValue, {color: colors.textMain}]}>{smokeLevel}</Text>
            <Text style={[styles.cardUnit, {color: colors.textSub}]}>/1023</Text>
          </View>
          <Text style={[styles.cardStatus, {color: isSmokeDanger ? colors.danger : (isSmokeWarning ? colors.warning : colors.safe)}]}>
            {isSmokeDanger ? `HIGH (>=${thresholdDanger || 500})` : (isSmokeWarning ? `WARNING (>=${thresholdWarning || 300})` : `NORMAL (<${thresholdWarning || 300})`)}
          </Text>
        </LinearGradient>
        
        <LinearGradient colors={gradientColors} style={[styles.card, {borderColor: isTempDanger ? colors.danger : colors.borderColor}]}>
          <View style={styles.cardHeader}>
            <Ionicons name="thermometer-outline" size={20} color={isTempDanger ? colors.danger : colors.safe} />
            <Text style={[styles.cardTitle, {color: colors.textSub}]}>TEMPERATURE</Text>
          </View>
          <View style={{flexDirection: 'row', alignItems: 'baseline', marginTop: 10}}>
            <Text style={[styles.cardValue, {color: colors.textMain}]}>{temperature}</Text>
            <Text style={[styles.cardUnit, {color: colors.textSub}]}>°C</Text>
          </View>
          <Text style={[styles.cardStatus, {color: isTempDanger ? colors.danger : colors.safe}]}>
            {isTempDanger ? `HIGH (>=${thresholdTempDanger || 35}°C)` : `NORMAL (<${thresholdTempDanger || 35}°C)`}
          </Text>
        </LinearGradient>
      </View>

      {/* Humidity (DHT22) + last reading time */}
      <View style={styles.cardsRow}>
        <LinearGradient colors={gradientColors} style={[styles.card, {borderColor: colors.borderColor}]}>
          <View style={styles.cardHeader}>
            <Ionicons name="water-outline" size={20} color={humidityColor} />
            <Text style={[styles.cardTitle, {color: colors.textSub}]}>HUMIDITY</Text>
          </View>
          <View style={{flexDirection: 'row', alignItems: 'baseline', marginTop: 10}}>
            <Text style={[styles.cardValue, {color: colors.textMain}]}>{Math.round(humidity)}</Text>
            <Text style={[styles.cardUnit, {color: colors.textSub}]}>%</Text>
          </View>
          <Text style={[styles.cardStatus, {color: humidityColor}]}>
            {humidity >= 80 ? 'VERY HUMID (STEAM?)' : humidity >= 60 ? 'HUMID' : 'NORMAL'}
          </Text>
        </LinearGradient>

        <LinearGradient colors={gradientColors} style={[styles.card, {borderColor: colors.borderColor}]}>
          <View style={styles.cardHeader}>
            <Ionicons name="time-outline" size={20} color={colors.textSub} />
            <Text style={[styles.cardTitle, {color: colors.textSub}]}>LAST READING</Text>
          </View>
          <Text style={[styles.cardValueSmall, {color: colors.textMain}]}>{lastReadingText}</Text>
          <Text style={[styles.cardStatus, {color: colors.textSub}]}>
            {readings.length} SAMPLES BUFFERED
          </Text>
        </LinearGradient>
      </View>

      {/* Featured Full-Width Water Sensor Card (WET / DRY) */}
      <LinearGradient colors={gradientColors} style={[styles.fullWidthCard, {borderColor: waterLeak ? colors.danger : colors.borderColor}]}>
        <View style={styles.waterCardHeader}>
          <View style={[styles.waterIconBg, {backgroundColor: waterLeak ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)'}]}>
            <Ionicons name="water" size={26} color={waterLeak ? colors.danger : colors.safe} />
          </View>
          <View style={{flex: 1, marginLeft: 15}}>
            <Text style={[styles.cardTitle, {color: colors.textSub}]}>WATER LEAK SENSOR (PROBE)</Text>
            <Text style={[styles.waterValueText, {color: waterLeak ? colors.danger : colors.safe}]}>
              {waterLeak ? 'WET (LEAK DETECTED)' : 'DRY (SAFE)'}
            </Text>
          </View>
          <View style={[styles.waterBadge, {backgroundColor: waterLeak ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)'}]}>
            <Text style={[styles.waterBadgeText, {color: waterLeak ? colors.danger : colors.safe}]}>
              {waterLeak ? 'WET' : 'DRY'}
            </Text>
          </View>
        </View>
      </LinearGradient>

      {/* Exhaust Fan Manual Control Card */}
      <LinearGradient colors={gradientColors} style={[styles.fanCard, {borderColor: colors.borderColor}]}>
        <View style={styles.fanHeader}>
          <View style={[styles.fanIconContainer, {backgroundColor: exhaustFan ? 'rgba(16, 185, 129, 0.15)' : colors.borderColor}]}>
            <Ionicons name="nuclear-outline" size={24} color={exhaustFan ? colors.safe : colors.textSub} />
          </View>
          <View style={{flex: 1, marginLeft: 15}}>
            <Text style={[styles.fanTitle, {color: colors.textMain}]}>Exhaust Fan Actuator</Text>
            <Text style={[styles.fanStatusText, {color: colors.textSub}]}>
              Mode: {fireActive || isSmokeDanger ? 'AUTO (ACTIVE)' : 'MANUAL CONTROL'}
            </Text>
          </View>
          <View style={{flexDirection: 'row', alignItems: 'center'}}>
            <Text style={{marginRight: 10, fontWeight: '700', fontSize: 13, color: exhaustFan ? colors.safe : colors.textSub}}>
              {exhaustFan ? 'RUNNING' : 'OFF'}
            </Text>
            <Switch 
              value={exhaustFan} 
              onValueChange={toggleExhaustFan}
              disabled={fireActive || isSmokeDanger}
              trackColor={{false: colors.borderColor, true: 'rgba(16, 185, 129, 0.4)'}} 
              thumbColor={exhaustFan ? colors.safe : '#94a3b8'} 
            />
          </View>
        </View>
      </LinearGradient>

      <LinearGradient colors={gradientColors} style={[styles.statusSection, {borderColor: colors.borderColor}]}>
        <Text style={[styles.sectionTitle, {color: colors.textMain}]}>System Status</Text>
        <View style={styles.statusRow}>
          <Text style={[styles.statusLabel, {color: colors.textSub}]}>System Condition</Text>
          <Text style={[styles.statusValueOnline, {color: status === 'OFFLINE' ? colors.danger : (isSmokeDanger || isTempDanger || waterLeak ? colors.danger : colors.safe)}]}>
            {isSmokeDanger ? 'HIGH SMOKE' : (isTempDanger ? 'HIGH TEMP' : (waterLeak ? 'WATER LEAK' : status))}
          </Text>
        </View>
        <View style={styles.statusRow}>
          <Text style={[styles.statusLabel, {color: colors.textSub}]}>Smoke Threshold</Text>
          <Text style={[styles.statusValue, {color: colors.textSub}]}>{thresholdDanger} / 1023</Text>
        </View>
        <View style={styles.statusRow}>
          <Text style={[styles.statusLabel, {color: colors.textSub}]}>Temp Threshold</Text>
          <Text style={[styles.statusValue, {color: colors.textSub}]}>{thresholdTempDanger}°C</Text>
        </View>
        <View style={styles.statusRow}>
          <Text style={[styles.statusLabel, {color: colors.textSub}]}>Water Sensor State</Text>
          <Text style={[styles.statusValue, {color: waterLeak ? colors.danger : colors.safe}]}>{waterLeak ? 'WET' : 'DRY'}</Text>
        </View>
      </LinearGradient>

      {(fireActive || waterLeakActive || isSmokeDanger || isTempDanger) && (
        <View style={styles.actionButtons}>
          <TouchableOpacity style={[styles.ackButton, {backgroundColor: colors.danger}]} onPress={acknowledgeAlert}>
            <Ionicons name="checkmark-circle" size={24} color="#fff" />
            <Text style={styles.ackText}>Acknowledge Alert</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.resetButton, {borderColor: colors.borderColor}]} onPress={resetSystem}>
            <Ionicons name="refresh" size={24} color={colors.textMain} />
            <Text style={[styles.resetText, {color: colors.textMain}]}>Reset</Text>
          </TouchableOpacity>
        </View>
      )}

      <LinearGradient colors={gradientColors} style={[styles.gaugeSection, {borderColor: colors.borderColor}]}>
        <Text style={[styles.sectionTitleCenter, {color: colors.textMain}]}>Smoke Sensor Gauge (Threshold: {thresholdDanger})</Text>
        <Gauge value={smokeLevel} colors={colors} />
      </LinearGradient>
      
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 15 },
  sectionHeading: { fontSize: 12, fontWeight: '800', letterSpacing: 1, marginBottom: 10, marginTop: 5 },
  alertBannerContainer: { marginBottom: 15, shadowColor: "#ef4444", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 8 },
  alertBanner: { borderRadius: 12, padding: 15, flexDirection: 'row', alignItems: 'center' },
  alertTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  alertSubtitle: { color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 2 },
  cardsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  card: { borderRadius: 12, padding: 18, width: '48%', borderWidth: 1, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  cardTitle: { fontSize: 12, fontWeight: '800', letterSpacing: 0.5, marginLeft: 6 },
  cardValue: { fontSize: 36, fontWeight: '800' },
  cardValueSmall: { fontSize: 22, fontWeight: '800', marginTop: 14, marginBottom: 4 },
  cardUnit: { fontSize: 13, marginLeft: 4, fontWeight: '600' },
  cardStatus: { fontSize: 11, marginTop: 4, fontWeight: '800', letterSpacing: 0.5 },
  fullWidthCard: { borderRadius: 12, padding: 16, borderWidth: 1, marginBottom: 15, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  waterCardHeader: { flexDirection: 'row', alignItems: 'center' },
  waterIconBg: { width: 48, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  waterValueText: { fontSize: 16, fontWeight: '800', marginTop: 3 },
  waterBadge: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 15 },
  waterBadgeText: { fontWeight: 'bold', fontSize: 13, letterSpacing: 0.5 },
  fanCard: { borderRadius: 12, padding: 16, borderWidth: 1, marginBottom: 15, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  fanHeader: { flexDirection: 'row', alignItems: 'center' },
  fanIconContainer: { width: 44, height: 44, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  fanTitle: { fontSize: 15, fontWeight: '800', letterSpacing: 0.5 },
  fanStatusText: { fontSize: 12, fontWeight: '500', marginTop: 2 },
  statusSection: { borderRadius: 12, padding: 20, marginBottom: 15, borderWidth: 1, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  sectionTitle: { fontSize: 15, fontWeight: '800', marginBottom: 15, letterSpacing: 0.5 },
  sectionTitleCenter: { fontSize: 15, fontWeight: '800', marginBottom: 20, textAlign: 'center', letterSpacing: 0.5 },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  statusLabel: { fontSize: 14, fontWeight: '500' },
  statusValueOnline: { fontSize: 14, fontWeight: 'bold', letterSpacing: 1 },
  statusValue: { fontSize: 14, fontWeight: '500' },
  actionButtons: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
  ackButton: { borderRadius: 8, padding: 15, width: '68%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', shadowColor: "#ef4444", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 5 },
  ackText: { color: '#fff', fontWeight: 'bold', marginLeft: 5, letterSpacing: 0.5 },
  resetButton: { backgroundColor: 'transparent', borderWidth: 1, borderRadius: 8, padding: 15, width: '28%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  resetText: { fontWeight: 'bold', marginLeft: 5 },
  gaugeSection: { borderRadius: 12, padding: 20, alignItems: 'center', borderWidth: 1, marginBottom: 30, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  gaugeContainer: { alignItems: 'center', marginTop: 10 },
  gaugeValue: { fontSize: 36, fontWeight: '800', position: 'absolute', bottom: 10 }
});
