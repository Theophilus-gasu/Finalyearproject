import React, { useContext } from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { FirebaseContext } from '../FirebaseContext';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

export default function HistoryScreen() {
  const { events, colors, theme } = useContext(FirebaseContext);

  const gradientColors = theme === 'Dark' ? ['#0f172a', '#1e293b'] : ['#ffffff', '#f1f5f9'];

  const renderItem = ({ item }) => {
    let iconName, iconColor, bgStyle, detailText;
    
    if (item.type === 'HIGH SMOKE DETECTED' || item.type === 'FIRE DETECTED') {
      iconName = 'warning';
      iconColor = colors.danger;
      bgStyle = { backgroundColor: 'rgba(239, 68, 68, 0.2)' };
      detailText = `Smoke Level: ${item.smoke}/100`;
    } else if (item.type === 'GAS LEAK DETECTED') {
      iconName = 'warning';
      iconColor = colors.warning;
      bgStyle = { backgroundColor: 'rgba(245, 158, 11, 0.2)' };
      detailText = `Gas Concentration: ${item.smoke}/100`;
    } else if (item.type === 'WATER LEAK DETECTED') {
      iconName = 'water';
      iconColor = colors.waterAlert || '#3b82f6';
      bgStyle = { backgroundColor: 'rgba(59, 130, 246, 0.2)' };
      detailText = `Liquids detected on probe`;
    } else if (item.type === 'HIGH SMOKE' || item.type === 'WARNING') {
      iconName = 'warning';
      iconColor = colors.warning;
      bgStyle = { backgroundColor: 'rgba(245, 158, 11, 0.2)' };
      detailText = `Smoke Level: ${item.smoke}/100`;
    } else {
      iconName = 'shield-checkmark';
      iconColor = colors.safe;
      bgStyle = { backgroundColor: 'rgba(16, 185, 129, 0.2)' };
      detailText = `System status normalized`;
    }

    const eventDate = new Date(item.time);
    const timeString = eventDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    const isToday = new Date().toDateString() === eventDate.toDateString();
    const dateString = isToday ? 'Today' : eventDate.toLocaleDateString([], {month: 'short', day: 'numeric'});

    return (
      <LinearGradient colors={gradientColors} style={[styles.eventItem, {borderColor: colors.borderColor}]}>
        <View style={[styles.iconContainer, bgStyle]}>
          <Ionicons name={iconName} size={22} color={iconColor} />
        </View>
        <View style={styles.eventInfo}>
          <Text style={[styles.eventTitle, {color: iconColor}]}>{item.type}</Text>
          <Text style={[styles.eventSmoke, {color: colors.textSub}]}>{detailText}</Text>
        </View>
        <View style={styles.eventTimeInfo}>
          <Text style={[styles.eventDate, {color: colors.iconColor}]}>{dateString}</Text>
          <Text style={[styles.eventTime, {color: colors.textMuted}]}>{timeString}</Text>
        </View>
      </LinearGradient>
    );
  };

  return (
    <View style={[styles.container, {backgroundColor: colors.bgMain}]}>
      <View style={styles.header}>
        <Ionicons name="filter" size={20} color={colors.textSub} />
      </View>
      <FlatList
        data={events}
        keyExtractor={(item, index) => (item.id ? `${item.id}-${index}` : index.toString())}
        renderItem={renderItem}
        contentContainerStyle={{paddingBottom: 20}}
        ListEmptyComponent={<Text style={{color: colors.textSub, textAlign: 'center', marginTop: 20, fontWeight: '500'}}>No recent events.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 15 },
  header: { alignItems: 'flex-end', marginBottom: 10 },
  eventItem: { borderRadius: 16, padding: 18, flexDirection: 'row', alignItems: 'center', marginBottom: 15, borderWidth: 1, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  iconContainer: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  eventInfo: { flex: 1 },
  eventTitle: { fontSize: 16, fontWeight: '800', marginBottom: 5, letterSpacing: 0.5 },
  eventSmoke: { fontSize: 14, fontWeight: '600' },
  eventTimeInfo: { alignItems: 'flex-end' },
  eventDate: { fontSize: 14, marginBottom: 5, fontWeight: '600' },
  eventTime: { fontSize: 12, fontWeight: 'bold' }
});
