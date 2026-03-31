import { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, Switch, Alert } from 'react-native';
import { Alarm, loadAlarms, saveAlarms, deleteAlarm, formatTime } from '../lib/alarmStorage';
import { scheduleAlarm, cancelAlarmById, scheduleDailyReminder, cancelDailyReminder } from '../lib/alarmScheduler';
import { UIStrings } from '../lib/i18n';

interface Props { u: UIStrings; onAdd: () => void; onEdit: (alarm: Alarm) => void; onSettings: () => void; refreshKey: number }

function getCountdown(alarms: Alarm[]): string | null {
  const enabled = alarms.filter(a => a.enabled);
  if (!enabled.length) return null;
  const now = new Date();
  let minMs = Infinity;
  for (const a of enabled) {
    const t = new Date(); t.setHours(a.hour, a.minute, 0, 0);
    if (t <= now) t.setDate(t.getDate() + 1);
    const diff = t.getTime() - now.getTime();
    if (diff < minMs) minMs = diff;
  }
  const h = Math.floor(minMs / 3600000);
  const m = Math.floor((minMs % 3600000) / 60000);
  if (h === 0 && m === 0) return 'You have less than a minute.';
  if (h === 0) return `You have ${m}m.`;
  return `You have ${h}h ${m}m.`;
}

export default function HomeScreen({ u, onAdd, onEdit, onSettings, refreshKey }: Props) {
  const [alarms, setAlarms] = useState<Alarm[]>([]);

  const load = useCallback(async () => {
    const a = await loadAlarms(); setAlarms(a);
    if (a.some(x => x.enabled)) scheduleDailyReminder(); else cancelDailyReminder();
  }, []);
  useEffect(() => { load(); }, [refreshKey]);

  async function toggleAlarm(id: string) {
    const alarm = alarms.find(a => a.id === id); if (!alarm) return;
    const on = !alarm.enabled;
    try { if (on && alarm.phrase) { alarm.notifId = await scheduleAlarm(alarm.hour, alarm.minute, alarm.phrase, alarm.id, alarm.statementId, alarm.repeatDaily); } else { await cancelAlarmById(alarm.id); alarm.notifId = undefined; } } catch {}
    alarm.enabled = on;
    const updated = alarms.map(a => a.id === id ? { ...alarm } : a);
    setAlarms(updated); await saveAlarms(updated);
    if (updated.some(x => x.enabled)) scheduleDailyReminder(); else cancelDailyReminder();
  }

  function handleLongPress(alarm: Alarm) {
    Alert.alert(u.deleteAlarm, formatTime(alarm.hour, alarm.minute), [
      { text: u.cancel, style: 'cancel' },
      { text: u.deleteAlarm, style: 'destructive', onPress: () => { cancelAlarmById(alarm.id).catch(() => {}); deleteAlarm(alarm.id).then(setAlarms); } },
    ]);
  }

  const countdown = getCountdown(alarms);

  function renderAlarm({ item }: { item: Alarm }) {
    return (
      <TouchableOpacity style={[st.card, !item.enabled && st.cardOff]} onPress={() => onEdit(item)} onLongPress={() => handleLongPress(item)} activeOpacity={0.7}>
        <View style={st.cardLeft}>
          <Text style={[st.time, !item.enabled && st.off]}>{formatTime(item.hour, item.minute)}</Text>
          <Text style={[st.repeat, !item.enabled && st.off]}>{item.repeatDaily ? u.everyDay : 'Once'}</Text>
          {item.phrase ? <Text style={[st.stmt, !item.enabled && st.off]} numberOfLines={1} ellipsizeMode="tail">{item.phrase}</Text> : null}
          <Text style={st.ownership}>You chose this.</Text>
        </View>
        <Switch value={item.enabled} onValueChange={() => toggleAlarm(item.id)} trackColor={{ false: '#333', true: '#6C63FF' }} thumbColor="#fff" />
      </TouchableOpacity>
    );
  }

  return (
    <View style={st.container}>
      <View style={st.header}>
        <Text style={st.title}>Wiring</Text>
        <TouchableOpacity onPress={onSettings} style={st.gear}><Text style={st.gearText}>⚙</Text></TouchableOpacity>
      </View>
      {countdown && <Text style={st.countdown}>{countdown}</Text>}
      {alarms.length === 0 ? (
        <View style={st.empty}>
          <Text style={st.emptyTitle}>Nothing set.</Text>
          <Text style={st.emptySub}>Set one. Show up.</Text>
          <TouchableOpacity style={st.startBtn} onPress={onAdd}><Text style={st.startBtnText}>Start</Text></TouchableOpacity>
        </View>
      ) : (
        <FlatList data={alarms} keyExtractor={a => a.id} renderItem={renderAlarm} contentContainerStyle={st.list} />
      )}
      <TouchableOpacity style={st.fab} onPress={onAdd}><Text style={st.fabText}>+</Text></TouchableOpacity>
    </View>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0A' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingTop: 60, paddingBottom: 8 },
  title: { color: '#FFFFFF', fontSize: 22, fontWeight: '800' },
  gear: { padding: 8 },
  gearText: { fontSize: 20, color: '#888' },
  countdown: { color: '#888', fontSize: 14, fontWeight: '600', textAlign: 'center', marginBottom: 16 },
  list: { paddingHorizontal: 24, paddingBottom: 100 },
  card: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#141414', borderRadius: 12, padding: 16, marginBottom: 10, borderLeftWidth: 3, borderLeftColor: '#6C63FF' },
  cardOff: { opacity: 0.4, borderLeftColor: '#333' },
  off: { opacity: 0.5 },
  cardLeft: { flex: 1, marginRight: 12 },
  time: { color: '#FFFFFF', fontSize: 32, fontWeight: '800' },
  repeat: { color: '#888', fontSize: 12, fontWeight: '500', marginTop: 2 },
  stmt: { color: '#888', fontSize: 13, fontWeight: '500', marginTop: 4 },
  ownership: { color: '#666', fontSize: 11, fontWeight: '500', marginTop: 2 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '800' },
  emptySub: { color: '#888', fontSize: 14, fontWeight: '500', marginTop: 8 },
  startBtn: { backgroundColor: '#6C63FF', borderRadius: 28, height: 52, paddingHorizontal: 48, alignItems: 'center', justifyContent: 'center', marginTop: 24 },
  startBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  fab: { position: 'absolute', bottom: 32, right: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: '#6C63FF', alignItems: 'center', justifyContent: 'center' },
  fabText: { color: '#fff', fontSize: 32, lineHeight: 34, fontWeight: '300' },
});
