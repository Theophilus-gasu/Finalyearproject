import React, { useContext, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Animated, Platform, ActivityIndicator, ScrollView } from 'react-native';
import { FirebaseContext } from '../FirebaseContext';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Speech from 'expo-speech';
import * as SMS from 'expo-sms';
import { causeLabel, BENIGN_CAUSES } from '../aiService';

// Full-screen countdown shown over every tab while an automatic emergency call is pending.
export default function EmergencyOverlay() {
  const {
    callCountdown, cancelEmergencyCall, callNow, emergencyNumber, smokeLevel, temperature, humidity,
    incidentAnalysis, countdownExtended, speakReports, aiEnabled,
  } = useContext(FirebaseContext);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const spokenForRef = useRef(null);
  const visible = callCountdown !== null;

  useEffect(() => {
    if (!visible) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.08, duration: 500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 500, useNativeDriver: true })
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [visible]);

  // Read the AI summary aloud once per analysis; stop talking when the overlay closes.
  useEffect(() => {
    if (!visible) { Speech.stop(); spokenForRef.current = null; return; }
    const summary = incidentAnalysis?.status === 'done' ? incidentAnalysis.summary : null;
    if (speakReports && summary && spokenForRef.current !== incidentAnalysis.analysedAt) {
      spokenForRef.current = incidentAnalysis.analysedAt;
      Speech.stop();
      Speech.speak(`${causeLabel(incidentAnalysis.likely_cause)} suspected. ${summary} ${incidentAnalysis.recommended_action}`, { rate: 1.0 });
    }
  }, [visible, incidentAnalysis, speakReports]);

  if (!visible) return null;

  const done = incidentAnalysis?.status === 'done';
  const benign = done && BENIGN_CAUSES.includes(incidentAnalysis.likely_cause);
  const badgeColor = !done ? 'rgba(255,255,255,0.25)' : benign ? '#0e7490' : '#991b1b';

  const reportText = () => {
    const base = `IoT Sentinel ALERT: high smoke detected. Smoke ${smokeLevel}/1023, temp ${temperature}°C, humidity ${Math.round(humidity)}%.`;
    return done ? `${base} Analysis: ${causeLabel(incidentAnalysis.likely_cause)} (${Math.round(incidentAnalysis.confidence * 100)}%). ${incidentAnalysis.summary} ${incidentAnalysis.recommended_action}` : base;
  };

  const sendSms = async () => {
    const ok = await SMS.isAvailableAsync();
    if (!ok) return;
    await SMS.sendSMSAsync([emergencyNumber], reportText());
  };

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={cancelEmergencyCall}>
      <LinearGradient colors={['#7f1d1d', '#450a0a']} style={styles.container}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Animated.View style={{ transform: [{ scale: pulseAnim }], alignItems: 'center' }}>
            <Ionicons name="warning" size={56} color="#fff" />
            <Text style={styles.title}>HIGH SMOKE DETECTED</Text>
          </Animated.View>

          <Text style={styles.subtitle}>Smoke {smokeLevel} · {temperature}°C · {Math.round(humidity)}% RH. Calling emergency services in</Text>

          <View style={styles.countdownCircle}>
            <Text style={styles.countdown}>{callCountdown}</Text>
            <Text style={styles.countdownUnit}>SECONDS</Text>
          </View>
          {countdownExtended && (
            <Text style={styles.extendedText}>Countdown extended once: analysis suggests a benign cause. Still check the room.</Text>
          )}

          <Text style={styles.number}>
            <Ionicons name="call" size={16} color="rgba(255,255,255,0.85)" />  {emergencyNumber}
          </Text>

          {/* AI incident analysis */}
          {aiEnabled && (
            <View style={styles.analysisCard}>
              <View style={styles.analysisHeader}>
                <Ionicons name="sparkles" size={16} color="#fff" />
                <Text style={styles.analysisTitle}>INCIDENT ANALYSIS</Text>
                <View style={[styles.badge, { backgroundColor: badgeColor }]}>
                  {incidentAnalysis?.status === 'pending' ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.badgeText}>
                      {done ? `${causeLabel(incidentAnalysis.likely_cause)} ${Math.round(incidentAnalysis.confidence * 100)}%` : incidentAnalysis?.status === 'error' ? 'UNAVAILABLE' : '—'}
                    </Text>
                  )}
                </View>
              </View>
              <Text style={styles.analysisText}>
                {incidentAnalysis?.status === 'pending' ? 'Analysing the last few minutes of readings…'
                  : done ? incidentAnalysis.summary
                  : incidentAnalysis?.status === 'error' ? `Analysis failed: ${incidentAnalysis.error}`
                  : 'Waiting for readings.'}
              </Text>
              {done && <Text style={styles.analysisAction}>{incidentAnalysis.recommended_action}</Text>}
              {done && incidentAnalysis.source === 'rules' && <Text style={styles.analysisNote}>Model unavailable — rule-based estimate.</Text>}
            </View>
          )}

          <TouchableOpacity style={styles.cancelButton} onPress={cancelEmergencyCall} activeOpacity={0.8}>
            <Ionicons name="close-circle" size={28} color="#7f1d1d" />
            <Text style={styles.cancelText}>I'M SAFE — CANCEL CALL</Text>
          </TouchableOpacity>

          <View style={styles.row}>
            <TouchableOpacity style={[styles.secondaryButton, { flex: 1, marginRight: 8 }]} onPress={callNow} activeOpacity={0.8}>
              <Ionicons name="call" size={20} color="#fff" />
              <Text style={styles.secondaryText}>CALL NOW</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.secondaryButton, { flex: 1, marginLeft: 8 }]} onPress={sendSms} activeOpacity={0.8}>
              <Ionicons name="chatbox-ellipses" size={20} color="#fff" />
              <Text style={styles.secondaryText}>SMS REPORT</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.hint}>
            {Platform.OS === 'ios'
              ? 'Your phone will ask you to confirm the call.'
              : 'If the dialer opens instead of connecting, tap the call button.'}
          </Text>
        </ScrollView>
      </LinearGradient>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 24, paddingTop: 60, paddingBottom: 40 },
  title: { color: '#fff', fontSize: 24, fontWeight: '900', letterSpacing: 1, marginTop: 10, textAlign: 'center' },
  subtitle: { color: 'rgba(255,255,255,0.85)', fontSize: 14, marginTop: 18, textAlign: 'center' },
  countdownCircle: { width: 140, height: 140, borderRadius: 70, borderWidth: 6, borderColor: '#fff', alignItems: 'center', justifyContent: 'center', marginVertical: 18 },
  countdown: { color: '#fff', fontSize: 56, fontWeight: '900', lineHeight: 62 },
  countdownUnit: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '800', letterSpacing: 2 },
  extendedText: { color: '#fde68a', fontSize: 12, fontWeight: '700', textAlign: 'center', marginBottom: 10, paddingHorizontal: 10 },
  number: { color: 'rgba(255,255,255,0.85)', fontSize: 16, fontWeight: '700', marginBottom: 18 },
  analysisCard: { width: '100%', backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 14, padding: 14, marginBottom: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  analysisHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  analysisTitle: { color: '#fff', fontWeight: '800', fontSize: 12, letterSpacing: 1, marginLeft: 6, flex: 1 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, minWidth: 40, alignItems: 'center' },
  badgeText: { color: '#fff', fontWeight: '900', fontSize: 11, letterSpacing: 0.5 },
  analysisText: { color: 'rgba(255,255,255,0.95)', fontSize: 14, lineHeight: 20 },
  analysisAction: { color: '#fde68a', fontSize: 13, fontWeight: '700', marginTop: 8, lineHeight: 18 },
  analysisNote: { color: 'rgba(255,255,255,0.6)', fontSize: 11, marginTop: 6, fontStyle: 'italic' },
  cancelButton: { backgroundColor: '#fff', borderRadius: 14, paddingVertical: 18, paddingHorizontal: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', width: '100%', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8 },
  cancelText: { color: '#7f1d1d', fontSize: 18, fontWeight: '900', marginLeft: 10, letterSpacing: 0.5 },
  row: { flexDirection: 'row', width: '100%', marginTop: 14 },
  secondaryButton: { borderRadius: 14, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.6)' },
  secondaryText: { color: '#fff', fontSize: 14, fontWeight: '800', marginLeft: 8, letterSpacing: 0.5 },
  hint: { color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 20, textAlign: 'center' }
});
