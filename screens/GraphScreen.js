import React, { useContext, useState, useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions, ScrollView, TouchableOpacity } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { FirebaseContext } from '../FirebaseContext';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

export default function GraphScreen() {
  const { smokeHistory, gasHistory, colors, theme } = useContext(FirebaseContext);
  const [filter, setFilter] = useState('Live');
  const [selectedChart, setSelectedChart] = useState('Smoke');
  
  const activeDataset = selectedChart === 'Smoke' ? smokeHistory : gasHistory;
  const chartColor = selectedChart === 'Smoke' ? colors.danger : colors.warning;

  const { avg, max, min } = useMemo(() => {
     let sum = 0, currentMax = -Infinity, currentMin = Infinity;
     for (let v of activeDataset) {
         sum += v;
         if (v > currentMax) currentMax = v;
         if (v < currentMin) currentMin = v;
     }
     return {
         avg: (sum / activeDataset.length).toFixed(0),
         max: currentMax === -Infinity ? 0 : currentMax,
         min: currentMin === Infinity ? 0 : currentMin
     };
  }, [activeDataset]);

  const maxBound = selectedChart === 'Smoke' ? 1024 : 100;

  const data = {
    labels: ["", "", "", "", "", "", "", "", "", "Now"],
    datasets: [
      {
        data: activeDataset,
        color: (opacity = 1) => selectedChart === 'Smoke' ? `rgba(239, 68, 68, ${opacity})` : `rgba(245, 158, 11, ${opacity})`,
        strokeWidth: 3
      },
      {
        data: [maxBound],
        color: () => 'transparent',
        strokeWidth: 0,
        withDots: false
      }
    ]
  };

  const getFilterStyle = (f) => {
      return filter === f ? [styles.filterBtn, {backgroundColor: colors.danger, shadowColor: colors.danger, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.4, shadowRadius: 4, elevation: 5 }] : styles.filterBtn;
  };
  const getFilterTextStyle = (f) => {
      return filter === f ? styles.activeFilterText : [styles.filterText, {color: colors.textSub}];
  };

  const gradientColors = theme === 'Dark' ? ['#0f172a', '#1e293b'] : ['#ffffff', '#f1f5f9'];

  return (
    <ScrollView style={[styles.container, {backgroundColor: colors.bgMain}]}>
      
      {/* Chart Toggles */}
      <View style={[styles.tabRow, {borderColor: colors.borderColor}]}>
        <TouchableOpacity 
          style={[styles.tabBtn, selectedChart === 'Smoke' && {backgroundColor: 'rgba(239, 68, 68, 0.15)'}]} 
          onPress={() => setSelectedChart('Smoke')}
        >
          <Ionicons name="cloud" size={18} color={selectedChart === 'Smoke' ? colors.danger : colors.textSub} style={{marginRight: 6}} />
          <Text style={[styles.tabText, {color: selectedChart === 'Smoke' ? colors.textMain : colors.textSub, fontWeight: selectedChart === 'Smoke' ? '800' : '600'}]}>Smoke Level</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.tabBtn, selectedChart === 'Gas' && {backgroundColor: 'rgba(245, 158, 11, 0.15)'}]} 
          onPress={() => setSelectedChart('Gas')}
        >
          <Ionicons name="warning" size={18} color={selectedChart === 'Gas' ? colors.warning : colors.textSub} style={{marginRight: 6}} />
          <Text style={[styles.tabText, {color: selectedChart === 'Gas' ? colors.textMain : colors.textSub, fontWeight: selectedChart === 'Gas' ? '800' : '600'}]}>Gas Level</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.filterRow}>
        {['Live', '1H', '6H', '24H', '7D'].map(f => (
            <TouchableOpacity key={f} style={getFilterStyle(f)} onPress={() => setFilter(f)}>
               <Text style={getFilterTextStyle(f)}>{f}</Text>
            </TouchableOpacity>
        ))}
      </View>

      <LinearGradient colors={gradientColors} style={[styles.chartContainer, {borderColor: colors.borderColor}]}>
        <LineChart
          data={data}
          width={Dimensions.get("window").width - 30}
          height={220}
          fromZero={true}
          withDots={true}
          withInnerLines={true}
          withOuterLines={false}
          withVerticalLines={false}
          yAxisSuffix=""
          chartConfig={{
            backgroundColor: 'transparent',
            backgroundGradientFromOpacity: 0,
            backgroundGradientToOpacity: 0,
            decimalPlaces: 0,
            color: (opacity = 1) => theme === 'Dark' ? `rgba(255, 255, 255, 0.15)` : `rgba(0, 0, 0, 0.15)`,
            labelColor: (opacity = 1) => colors.textSub,
            propsForDots: { r: "4", strokeWidth: "2", stroke: chartColor },
            fillShadowGradient: chartColor,
            fillShadowGradientOpacity: 0.3,
          }}
          bezier
          style={styles.chart}
        />
        
        <View style={[styles.liveBadge, {backgroundColor: chartColor}]}>
          <Text style={styles.liveValue}>{activeDataset[activeDataset.length - 1]}</Text>
          <Text style={styles.liveTime}>Now</Text>
        </View>
      </LinearGradient>

      <View style={styles.statsRow}>
        <LinearGradient colors={gradientColors} style={[styles.statBox, {borderColor: colors.borderColor}]}>
          <Text style={[styles.statLabel, {color: colors.textSub}]}>Average</Text>
          <Text style={[styles.statValue, {color: colors.textMain}]}>{avg} <Text style={[styles.statUnit, {color: colors.textSub}]}>{selectedChart === 'Smoke' ? '/1024' : '/100'}</Text></Text>
        </LinearGradient>
        <LinearGradient colors={gradientColors} style={[styles.statBox, {borderColor: colors.borderColor}]}>
          <Text style={[styles.statLabel, {color: colors.textSub}]}>Max</Text>
          <Text style={[styles.statValue, {color: colors.textMain}]}>{max} <Text style={[styles.statUnit, {color: colors.textSub}]}>{selectedChart === 'Smoke' ? '/1024' : '/100'}</Text></Text>
        </LinearGradient>
        <LinearGradient colors={gradientColors} style={[styles.statBox, {borderColor: colors.borderColor}]}>
          <Text style={[styles.statLabel, {color: colors.textSub}]}>Min</Text>
          <Text style={[styles.statValue, {color: colors.textMain}]}>{min} <Text style={[styles.statUnit, {color: colors.textSub}]}>{selectedChart === 'Smoke' ? '/1024' : '/100'}</Text></Text>
        </LinearGradient>
      </View>

      <LinearGradient colors={gradientColors} style={[styles.guideSection, {borderColor: colors.borderColor}]}>
        <Text style={[styles.guideTitle, {color: colors.textMain}]}>{selectedChart} Level Guide</Text>
        <View style={styles.guideBarsRow}>
          <View style={{flex: 1, alignItems: 'center'}}>
            <View style={[styles.colorBar, {backgroundColor: colors.safe, shadowColor: colors.safe, shadowOpacity: 0.4, shadowRadius: 3}]} />
            <Text style={[styles.guideLabel, {color: colors.textMuted}]}>0 - 30</Text>
            <Text style={[styles.guideStatus, {color: colors.safe}]}>SAFE</Text>
          </View>
          <View style={{flex: 1, alignItems: 'center'}}>
            <View style={[styles.colorBar, {backgroundColor: colors.warning, shadowColor: colors.warning, shadowOpacity: 0.4, shadowRadius: 3}]} />
            <Text style={[styles.guideLabel, {color: colors.textMuted}]}>31 - 70</Text>
            <Text style={[styles.guideStatus, {color: colors.warning}]}>WARNING</Text>
          </View>
          <View style={{flex: 1, alignItems: 'center'}}>
            <View style={[styles.colorBar, {backgroundColor: colors.danger, shadowColor: colors.danger, shadowOpacity: 0.4, shadowRadius: 3}]} />
            <Text style={[styles.guideLabel, {color: colors.textMuted}]}>71 - 100</Text>
            <Text style={[styles.guideStatus, {color: colors.danger}]}>DANGER</Text>
          </View>
        </View>
      </LinearGradient>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 15 },
  tabRow: { flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, paddingBottom: 15, marginBottom: 15 },
  tabBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 10, marginHorizontal: 5 },
  tabText: { fontSize: 14, fontWeight: '600' },
  filterRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  filterBtn: { paddingVertical: 8, paddingHorizontal: 15, borderRadius: 20 },
  filterText: { fontWeight: '600' },
  activeFilterText: { color: '#fff', fontWeight: 'bold' },
  chartContainer: { borderRadius: 16, padding: 15, paddingBottom: 5, marginBottom: 20, borderWidth: 1, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 5 },
  chart: { marginVertical: 8, borderRadius: 16 },
  liveBadge: { position: 'absolute', right: 20, top: 40, padding: 6, borderRadius: 8, alignItems: 'center', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.5, shadowRadius: 4, elevation: 5 },
  liveValue: { color: '#fff', fontWeight: '800', fontSize: 18 },
  liveTime: { color: 'rgba(255,255,255,0.9)', fontSize: 10, fontWeight: 'bold' },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  statBox: { borderRadius: 12, padding: 15, width: '31%', alignItems: 'center', borderWidth: 1, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  statLabel: { fontSize: 12, marginBottom: 5, fontWeight: '600' },
  statValue: { fontSize: 26, fontWeight: '800' },
  statUnit: { fontSize: 12, fontWeight: '600' },
  guideSection: { borderRadius: 12, padding: 20, borderWidth: 1, marginBottom: 40, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  guideTitle: { fontSize: 14, fontWeight: '800', marginBottom: 20, letterSpacing: 0.5 },
  guideBarsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  colorBar: { height: 6, width: '90%', borderRadius: 3, marginBottom: 12, elevation: 2 },
  guideLabel: { fontSize: 12, fontWeight: 'bold' },
  guideStatus: { fontSize: 10, marginTop: 4, fontWeight: '800', letterSpacing: 1 }
});
