import React, { useContext, useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView } from 'react-native';
import { FirebaseContext } from '../FirebaseContext';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { askSentinel, aiConfigured } from '../aiService';

const SUGGESTIONS = [
  'What is the room like right now?',
  'What happened in the last hour?',
  'Were there any alerts today?',
  'Why did the fan turn on?',
  'Is the smoke reading normal?',
];

const WELCOME = {
  id: 'welcome', role: 'assistant',
  content: "I'm Sentinel. Ask me about the room: current readings, what happened earlier, why an alert fired. I can only read the data, not change settings.",
};

export default function ChatScreen() {
  const {
    colors, theme, smokeLevel, temperature, humidity, waterLeak, exhaustFan, status, lastReadingAt,
    thresholdWarning, thresholdDanger, thresholdTempDanger,
  } = useContext(FirebaseContext);
  const [messages, setMessages] = useState([WELCOME]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const listRef = useRef(null);
  const enabled = aiConfigured();

  useEffect(() => {
    const t = setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    return () => clearTimeout(t);
  }, [messages, busy]);

  const send = async (text) => {
    const question = (text ?? input).trim();
    if (!question || busy) return;
    setInput('');
    const userMsg = { id: `u_${Date.now()}`, role: 'user', content: question };
    const priorTurns = messages.filter(m => m.id !== 'welcome' && !m.error);
    setMessages(prev => [...prev, userMsg]);
    setBusy(true);
    try {
      const live = {
        smoke: smokeLevel, temp: temperature, humidity, water: !!waterLeak, fan: !!exhaustFan, status,
        thresholds: { smokeWarning: thresholdWarning, smokeDanger: thresholdDanger, tempDanger: thresholdTempDanger },
        lastReadingAt: lastReadingAt ?? null,
      };
      const res = await askSentinel(question, priorTurns, live);
      const ctx = res.context ? `${res.context.historyRows} readings · ${res.context.eventRows} events${res.context.from ? ` · ${res.context.from.slice(11)}–${res.context.to.slice(11)}` : ''}` : null;
      setMessages(prev => [...prev, { id: `a_${Date.now()}`, role: 'assistant', content: res.answer, meta: ctx }]);
    } catch (err) {
      setMessages(prev => [...prev, { id: `e_${Date.now()}`, role: 'assistant', content: `I couldn't reach the AI server: ${err.message}`, error: true }]);
    } finally {
      setBusy(false);
    }
  };

  const gradientColors = theme === 'Dark' ? ['#0f172a', '#1e293b'] : ['#ffffff', '#f1f5f9'];

  const renderItem = ({ item }) => {
    const mine = item.role === 'user';
    return (
      <View style={[styles.bubbleRow, { justifyContent: mine ? 'flex-end' : 'flex-start' }]}>
        {!mine && (
          <View style={[styles.avatar, { backgroundColor: item.error ? 'rgba(239,68,68,0.2)' : 'rgba(6,182,212,0.2)' }]}>
            <Ionicons name={item.error ? 'alert-circle' : 'sparkles'} size={16} color={item.error ? colors.danger : colors.humidity} />
          </View>
        )}
        <View style={[styles.bubble, mine ? { backgroundColor: colors.danger } : { backgroundColor: colors.bgCard, borderColor: colors.borderColor, borderWidth: 1 }]}>
          <Text style={[styles.bubbleText, { color: mine ? '#fff' : colors.textMain }]}>{item.content}</Text>
          {item.meta ? <Text style={[styles.metaText, { color: colors.textMuted }]}>{item.meta}</Text> : null}
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView style={[styles.container, { backgroundColor: colors.bgMain }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      {!enabled && (
        <LinearGradient colors={gradientColors} style={[styles.notice, { borderColor: colors.borderColor }]}>
          <Ionicons name="cloud-offline-outline" size={18} color={colors.warning} />
          <Text style={[styles.noticeText, { color: colors.textSub }]}>AI server not configured. Set EXPO_PUBLIC_AI_API_URL in .env and restart Expo.</Text>
        </LinearGradient>
      )}

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={m => m.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ListFooterComponent={busy ? (
          <View style={[styles.bubbleRow, { justifyContent: 'flex-start' }]}>
            <View style={[styles.avatar, { backgroundColor: 'rgba(6,182,212,0.2)' }]}><Ionicons name="sparkles" size={16} color={colors.humidity} /></View>
            <View style={[styles.bubble, { backgroundColor: colors.bgCard, borderColor: colors.borderColor, borderWidth: 1 }]}>
              <ActivityIndicator size="small" color={colors.humidity} />
            </View>
          </View>
        ) : null}
      />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips} contentContainerStyle={{ paddingHorizontal: 12 }} keyboardShouldPersistTaps="handled">
        {SUGGESTIONS.map(s => (
          <TouchableOpacity key={s} style={[styles.chip, { borderColor: colors.borderColor, backgroundColor: colors.bgCard }]} onPress={() => send(s)} disabled={busy || !enabled}>
            <Text style={[styles.chipText, { color: colors.textSub }]}>{s}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={[styles.inputRow, { borderColor: colors.borderColor, backgroundColor: colors.bgCard }]}>
        <TextInput
          style={[styles.input, { color: colors.textMain }]}
          value={input}
          onChangeText={setInput}
          placeholder={enabled ? 'Ask about the room…' : 'AI server not configured'}
          placeholderTextColor={colors.textMuted}
          editable={enabled && !busy}
          onSubmitEditing={() => send()}
          returnKeyType="send"
          multiline
        />
        <TouchableOpacity style={[styles.sendBtn, { backgroundColor: input.trim() && !busy && enabled ? colors.danger : colors.borderColor }]} onPress={() => send()} disabled={!input.trim() || busy || !enabled}>
          <Ionicons name="send" size={18} color="#fff" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  notice: { flexDirection: 'row', alignItems: 'center', margin: 12, padding: 12, borderRadius: 10, borderWidth: 1 },
  noticeText: { marginLeft: 8, fontSize: 12, flex: 1, fontWeight: '600' },
  list: { padding: 12, paddingBottom: 6 },
  bubbleRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 10 },
  avatar: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  bubble: { maxWidth: '82%', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleText: { fontSize: 14, lineHeight: 20 },
  metaText: { fontSize: 10, marginTop: 6, fontWeight: '600' },
  chips: { maxHeight: 44, marginBottom: 6 },
  chip: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 7, marginRight: 8 },
  chipText: { fontSize: 12, fontWeight: '600' },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', margin: 12, marginTop: 0, borderWidth: 1, borderRadius: 14, paddingLeft: 14, paddingRight: 6, paddingVertical: 6 },
  input: { flex: 1, fontSize: 14, maxHeight: 100, paddingVertical: 6 },
  sendBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginLeft: 6 },
});
