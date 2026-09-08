import React, { useContext, useState, useEffect } from 'react';
import { View, Text, StyleSheet, Switch, ScrollView, TouchableOpacity, Alert, TextInput } from 'react-native';
import { FirebaseContext } from '../FirebaseContext';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { checkHealth, AI_API_URL } from '../aiService';

export default function SettingsScreen() {
  const { 
    vibration, setVibration, 
    pushNotif, setPushNotif,
    thresholdWarning, thresholdDanger,
    waterLeakAlertEnabled, setWaterLeakAlertEnabled,
    emergencyNumber, setEmergencyNumber,
    autoCallEnabled, setAutoCallEnabled,
    callDelaySeconds, setCallDelaySeconds,
    testEmergencyCall, callPlaced,
    aiEnabled, aiTriageEnabled, setAiTriageEnabled, speakReports, setSpeakReports,
    theme, setTheme, colors
  } = useContext(FirebaseContext);

  const [aiHealth, setAiHealth] = useState(null); // null = not checked, {ok, ...} or {ok:false, error}
  const checkAi = async () => {
      setAiHealth({ checking: true });
      try {
          const h = await checkHealth();
          setAiHealth(h);
      } catch (err) {
          setAiHealth({ ok: false, error: String(err?.message || err) });
      }
  };

  const runTest = () => {
      if (!autoCallEnabled) {
          Alert.alert("Auto-Call is off", "Turn on Auto-Call on High Smoke first.");
          return;
      }
      if (callPlaced) {
          Alert.alert("Already called", "Press Acknowledge Alert on the Dashboard to reset before testing again.");
          return;
      }
      Alert.alert(
          "Test Emergency Countdown",
          `This will start the ${callDelaySeconds}s countdown and then dial ${emergencyNumber}. Make sure that is a number you want to call.`,
          [
              { text: "Cancel", style: "cancel" },
              { text: "Start", style: "destructive", onPress: testEmergencyCall }
          ]
      );
  };

  // Local drafts so typing doesn't write half-entered values into context
  const [numberDraft, setNumberDraft] = useState(emergencyNumber);
  const [delayDraft, setDelayDraft] = useState(String(callDelaySeconds));
  useEffect(() => { setNumberDraft(emergencyNumber); }, [emergencyNumber]);
  useEffect(() => { setDelayDraft(String(callDelaySeconds)); }, [callDelaySeconds]);

  const commitNumber = () => {
      const cleaned = numberDraft.trim();
      if (cleaned.replace(/\D/g, '').length === 0) {
          setNumberDraft(emergencyNumber);
          return;
      }
      setEmergencyNumber(cleaned);
  };

  const commitDelay = () => {
      const n = parseInt(delayDraft, 10);
      if (!Number.isFinite(n) || n < 5 || n > 300) {
          Alert.alert("Invalid Delay", "Countdown must be between 5 and 300 seconds.");
          setDelayDraft(String(callDelaySeconds));
          return;
      }
      setCallDelaySeconds(n);
  };

  const toggleTheme = () => {
      setTheme(theme === 'Dark' ? 'Light' : 'Dark');
  };

  const showAbout = () => {
      Alert.alert(
          "About IoT Sentinel",
          "IoT Sentinel is an intelligent, multi-hazard home safety monitoring system. It provides continuous real-time environmental analysis by tracking Smoke Levels, Temperature, Gas Concentration, and Water Leakage.\n\nKey Safety Features:\n• Real-Time Multi-Sensor Telemetry\n• Automatic Exhaust Fan Ventilation\n• Visual & Hazard Notifications\n• Water Spillage Detection\n• 30-Second Emergency Responder Auto-Dialer\n\nDesigned to protect life, property, and ensure quick response times during domestic and industrial safety hazards.\n\nVersion 1.1.0",
          [{ text: "Understood" }]
      );
  };

  const gradientColors = theme === 'Dark' ? ['#0f172a', '#1e293b'] : ['#ffffff', '#f1f5f9'];

  return (
    <ScrollView style={[styles.container, {backgroundColor: colors.bgMain}]}>
      <LinearGradient colors={gradientColors} style={[styles.section, {borderColor: colors.borderColor}]}>
        <Text style={[styles.sectionTitle, {color: colors.textSub}]}>ALERT PREFERENCES</Text>
        

        
        <View style={styles.settingRow}>
          <Text style={[styles.settingLabel, {color: colors.iconColor}]}>Vibration</Text>
          <Switch value={vibration} onValueChange={setVibration} trackColor={{false: colors.borderColor, true: colors.danger}} thumbColor="#fff" />
        </View>
        <View style={[styles.separator, {backgroundColor: colors.borderColor}]} />
        
        <View style={styles.settingRow}>
          <Text style={[styles.settingLabel, {color: colors.iconColor}]}>Push Notifications</Text>
          <Switch value={pushNotif} onValueChange={setPushNotif} trackColor={{false: colors.borderColor, true: colors.danger}} thumbColor="#fff" />
        </View>
        <View style={[styles.separator, {backgroundColor: colors.borderColor}]} />

        <View style={styles.settingRow}>
          <Text style={[styles.settingLabel, {color: colors.iconColor}]}>Water Leak Alerting</Text>
          <Switch value={waterLeakAlertEnabled} onValueChange={setWaterLeakAlertEnabled} trackColor={{false: colors.borderColor, true: colors.waterAlert || '#3b82f6'}} thumbColor="#fff" />
        </View>
      </LinearGradient>

      <LinearGradient colors={gradientColors} style={[styles.section, {borderColor: colors.borderColor}]}>
        <Text style={[styles.sectionTitle, {color: colors.textSub}]}>EMERGENCY CALL</Text>

        <View style={styles.settingRow}>
          <Text style={[styles.settingLabel, {color: colors.iconColor}]}>Auto-Call on High Smoke</Text>
          <Switch value={autoCallEnabled} onValueChange={setAutoCallEnabled} trackColor={{false: colors.borderColor, true: colors.danger}} thumbColor="#fff" />
        </View>
        <View style={[styles.separator, {backgroundColor: colors.borderColor}]} />

        <View style={styles.settingRow}>
          <Text style={[styles.settingLabel, {color: colors.iconColor}]}>Emergency Number</Text>
          <TextInput
            style={[styles.input, {color: colors.textMain, borderColor: colors.borderColor, backgroundColor: colors.bgMain}]}
            value={numberDraft}
            onChangeText={setNumberDraft}
            onBlur={commitNumber}
            onSubmitEditing={commitNumber}
            keyboardType="phone-pad"
            placeholder="911"
            placeholderTextColor={colors.textMuted}
            returnKeyType="done"
          />
        </View>
        <View style={[styles.separator, {backgroundColor: colors.borderColor}]} />

        <View style={styles.settingRow}>
          <Text style={[styles.settingLabel, {color: colors.iconColor}]}>Countdown (seconds)</Text>
          <TextInput
            style={[styles.input, styles.inputSmall, {color: colors.textMain, borderColor: colors.borderColor, backgroundColor: colors.bgMain}]}
            value={delayDraft}
            onChangeText={setDelayDraft}
            onBlur={commitDelay}
            onSubmitEditing={commitDelay}
            keyboardType="number-pad"
            returnKeyType="done"
          />
        </View>
        <Text style={[styles.helpText, {color: colors.textMuted}]}>
          When smoke reaches the danger threshold, the app waits this long for you to cancel, then dials the number above. Use your own number while testing.
        </Text>
        <TouchableOpacity style={[styles.testButton, {backgroundColor: colors.danger}]} onPress={runTest}>
          <Ionicons name="call" size={18} color="#fff" />
          <Text style={styles.testButtonText}>TEST EMERGENCY COUNTDOWN</Text>
        </TouchableOpacity>
      </LinearGradient>

      <LinearGradient colors={gradientColors} style={[styles.section, {borderColor: colors.borderColor}]}>
        <Text style={[styles.sectionTitle, {color: colors.textSub}]}>AI INCIDENT ANALYSIS</Text>

        <View style={styles.settingRow}>
          <View style={{flex: 1, marginRight: 12}}>
            <Text style={[styles.settingLabel, {color: colors.iconColor}]}>Server</Text>
            <Text style={[styles.helpInline, {color: colors.textMuted}]} numberOfLines={1}>{aiEnabled ? AI_API_URL : 'Not configured — set EXPO_PUBLIC_AI_API_URL in .env'}</Text>
          </View>
          <TouchableOpacity style={[styles.smallButton, {borderColor: colors.borderColor}]} onPress={checkAi} disabled={!aiEnabled}>
            <Text style={[styles.smallButtonText, {color: aiEnabled ? colors.textMain : colors.textMuted}]}>
              {aiHealth?.checking ? '…' : 'CHECK'}
            </Text>
          </TouchableOpacity>
        </View>
        {aiHealth && !aiHealth.checking && (
          <Text style={[styles.helpText, {color: aiHealth.ok ? colors.safe : colors.danger}]}>
            {aiHealth.ok ? `Online · ${aiHealth.model} · key ${aiHealth.openaiKeyConfigured ? 'configured' : 'MISSING'}` : `Unreachable: ${aiHealth.error || 'no response'}`}
          </Text>
        )}
        <View style={[styles.separator, {backgroundColor: colors.borderColor}]} />

        <View style={styles.settingRow}>
          <View style={{flex: 1, marginRight: 12}}>
            <Text style={[styles.settingLabel, {color: colors.iconColor}]}>Triage Can Extend Countdown</Text>
            <Text style={[styles.helpInline, {color: colors.textMuted}]}>A confident benign verdict (steam, cooking) doubles the countdown once. It never cancels the call.</Text>
          </View>
          <Switch value={aiTriageEnabled} onValueChange={setAiTriageEnabled} disabled={!aiEnabled} trackColor={{false: colors.borderColor, true: colors.humidity || '#06b6d4'}} thumbColor="#fff" />
        </View>
        <View style={[styles.separator, {backgroundColor: colors.borderColor}]} />

        <View style={styles.settingRow}>
          <Text style={[styles.settingLabel, {color: colors.iconColor}]}>Read Report Aloud</Text>
          <Switch value={speakReports} onValueChange={setSpeakReports} disabled={!aiEnabled} trackColor={{false: colors.borderColor, true: colors.humidity || '#06b6d4'}} thumbColor="#fff" />
        </View>
      </LinearGradient>

      <LinearGradient colors={gradientColors} style={[styles.section, {borderColor: colors.borderColor}]}>
        <Text style={[styles.sectionTitle, {color: colors.textSub}]}>SMOKE THRESHOLDS</Text>
        
        <TouchableOpacity style={styles.settingRowChevron}>
          <Text style={[styles.settingLabel, {color: colors.iconColor}]}>Safe (0 - {thresholdWarning})</Text>
          <View style={{flexDirection: 'row', alignItems: 'center'}}>
             <Text style={[styles.settingValue, {color: colors.safe}]}>{thresholdWarning}</Text>
             <Ionicons name="chevron-forward" size={20} color={colors.textMuted} style={{marginLeft: 10}}/>
          </View>
        </TouchableOpacity>
        <View style={[styles.separator, {backgroundColor: colors.borderColor}]} />
        
        <TouchableOpacity style={styles.settingRowChevron}>
          <Text style={[styles.settingLabel, {color: colors.iconColor}]}>Warning ({thresholdWarning + 1} - {thresholdDanger})</Text>
          <View style={{flexDirection: 'row', alignItems: 'center'}}>
             <Text style={[styles.settingValue, {color: colors.warning}]}>{thresholdDanger}</Text>
             <Ionicons name="chevron-forward" size={20} color={colors.textMuted} style={{marginLeft: 10}}/>
          </View>
        </TouchableOpacity>
        <View style={[styles.separator, {backgroundColor: colors.borderColor}]} />
        
        <TouchableOpacity style={styles.settingRowChevron}>
          <Text style={[styles.settingLabel, {color: colors.iconColor}]}>Danger ({thresholdDanger} - 1024)</Text>
          <View style={{flexDirection: 'row', alignItems: 'center'}}>
             <Text style={[styles.settingValue, {color: colors.danger}]}>500</Text>
             <Ionicons name="chevron-forward" size={20} color={colors.textMuted} style={{marginLeft: 10}}/>
          </View>
        </TouchableOpacity>
      </LinearGradient>

      <LinearGradient colors={gradientColors} style={[styles.section, {borderColor: colors.borderColor}]}>
        <Text style={[styles.sectionTitle, {color: colors.textSub}]}>OTHER SETTINGS</Text>
        
        <TouchableOpacity style={styles.settingRowChevron} onPress={toggleTheme}>
          <Text style={[styles.settingLabel, {color: colors.iconColor}]}>Theme</Text>
          <View style={{flexDirection: 'row', alignItems: 'center'}}>
             <Text style={[styles.settingValueNormal, {color: colors.textSub}]}>{theme}</Text>
             <Ionicons name="color-palette-outline" size={20} color={colors.textMuted} style={{marginLeft: 10}}/>
          </View>
        </TouchableOpacity>
        <View style={[styles.separator, {backgroundColor: colors.borderColor}]} />
        
        <TouchableOpacity style={styles.settingRowChevron}>
          <Text style={[styles.settingLabel, {color: colors.iconColor}]}>Language</Text>
          <View style={{flexDirection: 'row', alignItems: 'center'}}>
             <Text style={[styles.settingValueNormal, {color: colors.textSub}]}>English</Text>
             <Ionicons name="chevron-forward" size={20} color={colors.textMuted} style={{marginLeft: 10}}/>
          </View>
        </TouchableOpacity>
        <View style={[styles.separator, {backgroundColor: colors.borderColor}]} />
        
        <TouchableOpacity style={styles.settingRowChevron} onPress={showAbout}>
          <Text style={[styles.settingLabel, {color: colors.iconColor}]}>About App</Text>
          <Ionicons name="information-circle-outline" size={22} color={colors.textMuted} />
        </TouchableOpacity>
      </LinearGradient>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 15 },
  section: { borderRadius: 16, paddingVertical: 10, borderWidth: 1, marginBottom: 25, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  sectionTitle: { fontSize: 13, fontWeight: '800', marginLeft: 20, marginBottom: 10, marginTop: 10, letterSpacing: 1 },
  settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14 },
  settingRowChevron: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16 },
  settingLabel: { fontSize: 16, fontWeight: '600' },
  separator: { height: 1, marginLeft: 20 },
  settingValue: { fontWeight: '900', fontSize: 16 },
  settingValueNormal: { fontSize: 16, fontWeight: '600' },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, minWidth: 140, fontSize: 16, fontWeight: '700', textAlign: 'right' },
  inputSmall: { minWidth: 80 },
  helpText: { fontSize: 12, lineHeight: 18, paddingHorizontal: 20, paddingBottom: 12, paddingTop: 4 },
  helpInline: { fontSize: 12, lineHeight: 16, marginTop: 2 },
  smallButton: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  smallButtonText: { fontWeight: '800', fontSize: 12, letterSpacing: 0.5 },
  testButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginHorizontal: 20, marginBottom: 12, paddingVertical: 12, borderRadius: 10 },
  testButtonText: { color: '#fff', fontWeight: '800', marginLeft: 8, letterSpacing: 0.5 }
});
