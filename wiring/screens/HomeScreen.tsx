import { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, Switch, Alert } from 'react-native';
import { Alarm, loadAlarms, saveAlarms, deleteAlarm, formatTime, getTimezoneAbbr } from '../lib/alarmStorage';
import { scheduleAlarm, cancelAlarmById } from '../lib/alarmScheduler';
import { loadStreak } from '../lib/storage';
import { UIStrings } from '../lib/i18n';

interface Props {
  u: UIStrings;
  lang: string;
  onAdd: () => void;
  onEdit: (alarm: Alarm) => void;
  refreshKey: number;
}

export default function HomeScreen({ u, lang, onAdd, onEdit, refreshKey }: Props) {
  const [alarms, setAlarms] = useState<Alarm[]>([]);
  const [streak, setStreak] = useState(0);
  const tzAbbr = getTimezoneAbbr();

  const load = useCallback(() => {
    loadAlarms().then(setAlarms);
    loadStreak().then(setStreak);
  }, []);
  useEffect(load, [refreshKey]);

  async function toggleAlarm(id: string) {
    const alarm = alarms.find(a => a.id === id);
    if (!alarm) return;
    const nowEnabled = !alarm.enabled;
    try {
      if (nowEnabled && alarm.phrase) {
        const notifId = await scheduleAlarm(alarm.hour, alarm.minute, alarm.phrase, alarm.id);
        alarm.notifId = notifId;
      } else {
        await cancelAlarmById(alarm.id);
        alarm.notifId = undefined;
      }
    } catch {}
    alarm.enabled = nowEnabled;
    const updated = alarms.map(a => a.id === id ? { ...alarm } : a);
    setAlarms(updated);
    await saveAlarms(updated);
  }

  function handleLongPress(alarm: Alarm) {
    Alert.alert(u.deleteAlarm, formatTime(alarm.hour, alarm.minute), [
      { text: u.cancel, style: 'cancel' },
      { text: u.deleteAlarm, style: 'destructive', onPress: () => { cancelAlarmById(alarm.id).catch(() => {}); deleteAlarm(alarm.id).then(setAlarms); } },
    ]);
  }

  function renderAlarm({ item }: { item: Alarm }) {
    return (
      <TouchableOpacity style={styles.card} onPress={() => onEdit(item)} onLongPress={() => handleLongPress(item)} activeOpacity={0.7}>
        <View style={styles.cardLeft}>
          <Text style={styles.time}>{formatTime(item.hour, item.minute)}</Text>
          <Text style={styles.days}>{item.repeatDaily ? u.everyDay : ''} · {tzAbbr}</Text>
          {item.phrase ? <Text style={styles.phrasePreview} numberOfLines={1} ellipsizeMode="tail">{item.phrase}</Text> : null}
        </View>
        <Switch value={item.enabled} onValueChange={() => toggleAlarm(item.id)} trackColor={{ false: '#333', true: '#6C63FF' }} thumbColor="#fff" />
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>{u.appTitle}</Text>
          {streak > 0 && <Text style={styles.streak}>🔥 {streak} {u.streak}</Text>}
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={onAdd}>
          <Text style={styles.addBtnText}>+</Text>
        </TouchableOpacity>
      </View>
      {alarms.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>🔔</Text>
          <Text style={styles.emptyText}>{u.noAlarms}</Text>
          <Text style={styles.emptySub}>{u.noAlarmsSub}</Text>
        </View>
      ) : (
        <FlatList data={alarms} keyExtractor={a => a.id} renderItem={renderAlarm} contentContainerStyle={styles.list} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0A' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingTop: 60, paddingBottom: 16 },
  title: { color: '#fff', fontSize: 28, fontWeight: 'bold' },
  streak: { color: '#6C63FF', fontSize: 13, marginTop: 4 },
  addBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#6C63FF', alignItems: 'center', justifyContent: 'center' },
  addBtnText: { color: '#fff', fontSize: 28, lineHeight: 30, fontWeight: '300' },
  list: { paddingHorizontal: 24 },
  card: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#141414', borderRadius: 16, padding: 20, marginBottom: 12, borderLeftWidth: 3, borderLeftColor: '#6C63FF' },
  cardLeft: { flex: 1, marginRight: 12 },
  time: { color: '#fff', fontSize: 56, fontWeight: '700', letterSpacing: -1, lineHeight: 62 },
  days: { color: '#888', fontSize: 12, marginTop: 4 },
  phrasePreview: { color: '#6C63FF', fontSize: 12, marginTop: 6, fontStyle: 'italic' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyIcon: { fontSize: 48, marginBottom: 16, opacity: 0.4 },
  emptyText: { color: '#555', fontSize: 16, textAlign: 'center', lineHeight: 24 },
  emptySub: { color: '#444', fontSize: 13, textAlign: 'center', marginTop: 6 },
});
