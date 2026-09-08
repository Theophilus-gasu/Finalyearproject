import React, { useContext, useState, useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions, ScrollView, TouchableOpacity } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { FirebaseContext } from '../FirebaseContext';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

const MAX_POINTS = 30; // chart-kit gets slow/cluttered beyond this; we downsample to it
const WINDOWS = { '1M': 60 * 1000, '5M': 5 * 60 * 1000 };

const METRICS = {
  Smoke:    { key: 'smoke',    icon: 'cloud',       unit: '',   max: 1023, rgb: '239, 68, 68' },
  Temp:     { key: 'temp',     icon: 'thermometer', unit: '°C', max: 60,   rgb: '245, 158, 11' },
  Humidity: { key: 'humidity', icon: 'water',       unit: '%',  max: 100,  rgb: '6, 182, 212' },
};

const fmtTime = (ts) => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

export default function GraphScreen() {
  const { readings, colors, theme, thresholdWarning, thresholdDanger, thresholdTempDanger } = useContext(FirebaseContext);
  const [windowKey, setWindowKey] = useState('5M');
  const [metricKey, setMetricKey] = useState('Smoke');

  const metric = METRICS[metricKey];
  const chartColor = `rgb(${metric.rgb})`;

  // Slice the buffer to the chosen window, then downsample evenly to MAX_POINTS.
  const { points, values, labels, avg, max, min, first, last } = useMemo(() => {
    const cutoff = Date.now() - WINDOWS[windowKey];
    const inWindow = readings.filter(r => r.ts >= cutoff);
    let sampled = inWindow;
    if (inWindow.length > MAX_POINTS) {
      const step = inWindow.length / MAX_POINTS;
      sampled = Array.from({ length: MAX_POINTS }, (_, i) => inWindow[Math.floor(i * step)]);
      sampled[MAX_POINTS - 1] = inWindow[inWindow.length - 1];
    }
    const vals = sampled.map(r => Number(r[metric.key]) || 0);
    const all = inWindow.map(r => Number(r[metric.key]) || 0);
    const sum = all.reduce((a, b) => a + b, 0);
    const lbls = sampled.map((r, i) => {
      const n = sampled.length;
      return (i === 0 || i === n - 1 || i === Math.floor(n / 2)) ? fmtTime(r.ts) : '';
    });
    return {
      points: sampled,
      values: vals,
      labels: lbls,
      avg: all.length ? (sum / all.length).toFixed(metric.key === 'smoke' ? 0 : 1) : '–',
      max: all.length ? Math.max(...all) : '–',
      min: all.length ? Math.min(...all) : '–',
      first: inWindow[0],
      last: inWindow[inWindow.length - 1],
    };
  }, [readings, windowKey, metricKey]);

  const hasData = values.length >= 2;

  const data = {
    labels: hasData ? labels : ['', ''],
    datasets: [
      { data: hasData ? values : [0, 0], color: (opacity = 1) => `rgba(${metric.rgb}, ${opacity})`, strokeWidth: 3 },
      { data: [metric.max], color: () => 'transparent', strokeWidth: 0, withDots: false },
    ]
  };

  const guide = metricKey === 'Smoke'
    ? [{ label: `0 - ${thresholdWarning}`, status: 'SAFE', color: colors.safe }, { label: `${thresholdWarning + 1} - ${thresholdDanger - 1}`, status: 'WARNING', color: colors.warning }, { label: `${thresholdDanger}+`, status: 'DANGER', color: colors.danger }]
    : metricKey === 'Temp'
    ? [{ label: `< ${thresholdTempDanger - 5}°C`, status: 'NORMAL', color: colors.safe }, { label: `${thresholdTempDanger - 5} - ${thresholdTempDanger - 1}°C`, status: 'WARM', color: colors.warning }, { label: `${thresholdTempDanger}°C+`, status: 'DANGER', color: colors.danger }]
    : [{ label: '30 - 60%', status: 'NORMAL', color: colors.safe }, { label: '60 - 80%', status: 'HUMID', color: colors.warning }, { label: '80%+ / spike', status: 'STEAM?', color: colors.humidity }];

  const gradientColors = theme === 'Dark' ? ['#0f172a', '#1e293b'] : ['#ffffff', '#f1f5f9'];

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.bgMain }]}>

      {/* Metric Toggles */}
      <View style={[styles.tabRow, { borderColor: colors.borderColor }]}>
        {Object.keys(METRICS).map(k => {
          const m = METRICS[k];
          const active = metricKey === k;
          return (
            <TouchableOpacity key={k} style={[styles.tabBtn, active && { backgroundColor: `rgba(${m.rgb}, 0.15)` }]} onPress={() => setMetricKey(k)}>
              <Ionicons name={m.icon} size={18} color={active ? `rgb(${m.rgb})` : colors.textSub} style={{ marginRight: 6 }} />
              <Text style={[styles.tabText, { color: active ? colors.textMain : colors.textSub, fontWeight: active ? '800' : '600' }]}>{k}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Window filter: in-memory buffer holds 5 minutes; longer windows come from /history later */}
      <View style={styles.filterRow}>
        {Object.keys(WINDOWS).map(w => (
          <TouchableOpacity
            key={w}
            style={windowKey === w ? [styles.filterBtn, { backgroundColor: chartColor }] : styles.filterBtn}
            onPress={() => setWindowKey(w)}
          >
            <Text style={windowKey === w ? styles.activeFilterText : [styles.filterText, { color: colors.textSub }]}>{w}</Text>
          </TouchableOpacity>
        ))}
        <Text style={[styles.sampleCount, { color: colors.textMuted }]}>{points.length} pts</Text>
      </View>

      <LinearGradient colors={gradientColors} style={[styles.chartContainer, { borderColor: colors.borderColor }]}>
        <LineChart
          data={data}
          width={Dimensions.get("window").width - 30}
          height={220}
          fromZero={true}
          withDots={values.length <= 15}
          withInnerLines={true}
          withOuterLines={false}
          withVerticalLines={false}
          yAxisSuffix={metric.unit}
          chartConfig={{
            backgroundColor: 'transparent',
            backgroundGradientFromOpacity: 0,
            backgroundGradientToOpacity: 0,
            decimalPlaces: 0,
            color: () => theme === 'Dark' ? `rgba(255, 255, 255, 0.15)` : `rgba(0, 0, 0, 0.15)`,
            labelColor: () => colors.textSub,
            propsForDots: { r: "3", strokeWidth: "2", stroke: chartColor },
            fillShadowGradient: chartColor,
            fillShadowGradientOpacity: 0.3,
          }}
          bezier
          style={styles.chart}
        />

        {last ? (
          <View style={[styles.liveBadge, { backgroundColor: chartColor }]}>
            <Text style={styles.liveValue}>{last[metric.key]}{metric.unit}</Text>
            <Text style={styles.liveTime}>{fmtTime(last.ts)}</Text>
          </View>
        ) : (
          <Text style={[styles.emptyText, { color: colors.textSub }]}>Waiting for sensor data…</Text>
        )}
      </LinearGradient>

      <View style={styles.statsRow}>
        {[['Average', avg], ['Max', max], ['Min', min]].map(([label, val]) => (
          <LinearGradient key={label} colors={gradientColors} style={[styles.statBox, { borderColor: colors.borderColor }]}>
            <Text style={[styles.statLabel, { color: colors.textSub }]}>{label}</Text>
            <Text style={[styles.statValue, { color: colors.textMain }]}>{val}<Text style={[styles.statUnit, { color: colors.textSub }]}>{metric.unit}</Text></Text>
          </LinearGradient>
        ))}
      </View>

      {first && last && (
        <Text style={[styles.rangeText, { color: colors.textMuted }]}>
          {fmtTime(first.ts)} → {fmtTime(last.ts)}
        </Text>
      )}

      <LinearGradient colors={gradientColors} style={[styles.guideSection, { borderColor: colors.borderColor }]}>
        <Text style={[styles.guideTitle, { color: colors.textMain }]}>{metricKey} Level Guide</Text>
        <View style={styles.guideBarsRow}>
          {guide.map(g => (
            <View key={g.status} style={{ flex: 1, alignItems: 'center' }}>
              <View style={[styles.colorBar, { backgroundColor: g.color, shadowColor: g.color, shadowOpacity: 0.4, shadowRadius: 3 }]} />
              <Text style={[styles.guideLabel, { color: colors.textMuted }]}>{g.label}</Text>
              <Text style={[styles.guideStatus, { color: g.color }]}>{g.status}</Text>
            </View>
          ))}
        </View>
      </LinearGradient>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 15 },
  tabRow: { flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, paddingBottom: 15, marginBottom: 15 },
  tabBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 10, marginHorizontal: 4 },
  tabText: { fontSize: 14, fontWeight: '600' },
  filterRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  filterBtn: { paddingVertical: 8, paddingHorizontal: 18, borderRadius: 20, marginRight: 10 },
  filterText: { fontWeight: '600' },
  activeFilterText: { color: '#fff', fontWeight: 'bold' },
  sampleCount: { marginLeft: 'auto', fontSize: 12, fontWeight: '600' },
  chartContainer: { borderRadius: 16, padding: 15, paddingBottom: 5, marginBottom: 20, borderWidth: 1, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 5 },
  chart: { marginVertical: 8, borderRadius: 16 },
  liveBadge: { position: 'absolute', right: 20, top: 40, padding: 6, borderRadius: 8, alignItems: 'center', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.5, shadowRadius: 4, elevation: 5 },
  liveValue: { color: '#fff', fontWeight: '800', fontSize: 18 },
  liveTime: { color: 'rgba(255,255,255,0.9)', fontSize: 10, fontWeight: 'bold' },
  emptyText: { position: 'absolute', top: 100, alignSelf: 'center', fontWeight: '600' },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  statBox: { borderRadius: 12, padding: 15, width: '31%', alignItems: 'center', borderWidth: 1, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  statLabel: { fontSize: 12, marginBottom: 5, fontWeight: '600' },
  statValue: { fontSize: 24, fontWeight: '800' },
  statUnit: { fontSize: 12, fontWeight: '600' },
  rangeText: { textAlign: 'center', fontSize: 12, fontWeight: '600', marginBottom: 20 },
  guideSection: { borderRadius: 12, padding: 20, borderWidth: 1, marginBottom: 40, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  guideTitle: { fontSize: 14, fontWeight: '800', marginBottom: 20, letterSpacing: 0.5 },
  guideBarsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  colorBar: { height: 6, width: '90%', borderRadius: 3, marginBottom: 12, elevation: 2 },
  guideLabel: { fontSize: 12, fontWeight: 'bold' },
  guideStatus: { fontSize: 10, marginTop: 4, fontWeight: '800', letterSpacing: 1 }
});
