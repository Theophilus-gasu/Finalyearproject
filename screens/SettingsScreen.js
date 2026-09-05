import React, { useContext } from 'react';
import { View, Text, StyleSheet, Switch, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { FirebaseContext } from '../FirebaseContext';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

export default function SettingsScreen() {
  const { 
    vibration, setVibration, 
    pushNotif, setPushNotif,
    thresholdWarning, thresholdDanger,
    thresholdGasWarning, thresholdGasDanger,
    waterLeakAlertEnabled, setWaterLeakAlertEnabled,
    gasAlertEnabled, setGasAlertEnabled,
    theme, setTheme, colors
  } = useContext(FirebaseContext);

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
          <Text style={[styles.settingLabel, {color: colors.iconColor}]}>Gas Level Alerting</Text>
          <Switch value={gasAlertEnabled} onValueChange={setGasAlertEnabled} trackColor={{false: colors.borderColor, true: colors.warning}} thumbColor="#fff" />
        </View>
        <View style={[styles.separator, {backgroundColor: colors.borderColor}]} />

        <View style={styles.settingRow}>
          <Text style={[styles.settingLabel, {color: colors.iconColor}]}>Water Leak Alerting</Text>
          <Switch value={waterLeakAlertEnabled} onValueChange={setWaterLeakAlertEnabled} trackColor={{false: colors.borderColor, true: colors.waterAlert || '#3b82f6'}} thumbColor="#fff" />
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
        <Text style={[styles.sectionTitle, {color: colors.textSub}]}>GAS THRESHOLDS</Text>
        
        <TouchableOpacity style={styles.settingRowChevron}>
          <Text style={[styles.settingLabel, {color: colors.iconColor}]}>Safe (0 - {thresholdGasWarning})</Text>
          <View style={{flexDirection: 'row', alignItems: 'center'}}>
             <Text style={[styles.settingValue, {color: colors.safe}]}>{thresholdGasWarning}</Text>
             <Ionicons name="chevron-forward" size={20} color={colors.textMuted} style={{marginLeft: 10}}/>
          </View>
        </TouchableOpacity>
        <View style={[styles.separator, {backgroundColor: colors.borderColor}]} />
        
        <TouchableOpacity style={styles.settingRowChevron}>
          <Text style={[styles.settingLabel, {color: colors.iconColor}]}>Warning ({thresholdGasWarning + 1} - {thresholdGasDanger})</Text>
          <View style={{flexDirection: 'row', alignItems: 'center'}}>
             <Text style={[styles.settingValue, {color: colors.warning}]}>{thresholdGasDanger}</Text>
             <Ionicons name="chevron-forward" size={20} color={colors.textMuted} style={{marginLeft: 10}}/>
          </View>
        </TouchableOpacity>
        <View style={[styles.separator, {backgroundColor: colors.borderColor}]} />
        
        <TouchableOpacity style={styles.settingRowChevron}>
          <Text style={[styles.settingLabel, {color: colors.iconColor}]}>Danger ({thresholdGasDanger + 1} - 100)</Text>
          <View style={{flexDirection: 'row', alignItems: 'center'}}>
             <Text style={[styles.settingValue, {color: colors.danger}]}>100</Text>
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
  settingValueNormal: { fontSize: 16, fontWeight: '600' }
});
