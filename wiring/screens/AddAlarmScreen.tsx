import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, Switch, ScrollView, KeyboardAvoidingView, Platform, BackHandler, Alert } from 'react-native';
import { Alarm, Vibration as VibType, generateId, loadAlarms, saveAlarms, deleteAlarm, hasDuplicate } from '../lib/alarmStorage';
import { scheduleAlarm, cancelAlarmById } from '../lib/alarmScheduler';
import { loadUserPhrases } from '../lib/userPhrases';
import { UIStrings } from '../lib/i18n';
import PickerColumn, { ITEM_H } from '../components/PickerColumn';
import IntensityPicker from '../components/IntensityPicker';
import VibrationPicker from '../components/VibrationPicker';

const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));
const AMPMS = ['AM', 'PM'];

interface Props { u: UIStrings; existing: Alarm | null; prefillPhrase?: string; onDone: () => void; onTryPhrase: (phrase: string) => void }

export default function AddAlarmScreen({ u, existing, prefillPhrase, onDone, onTryPhrase }: Props) {
  const is24 = existing ? existing.hour : 7;
  const [hour12, setHour12] = useState(is24 % 12 || 12);
  const [minute, setMinute] = useState(existing?.minute ?? 0);
  const [isPM, setIsPM] = useState(is24 >= 12);
  const [repeatDaily, setRepeatDaily] = useState(existing?.repeatDaily ?? true);
  const [phrase, setPhrase] = useState(existing?.phrase ?? prefillPhrase ?? '');
  const [intensity, setIntensity] = useState(existing?.intensity ?? 3);
  const [vibration, setVibration] = useState<VibType>(existing?.vibration ?? 'light');
  const [chips, setChips] = useState<string[]>([]);

  useEffect(() => {
    loadUserPhrases().then(setChips);
  }, []);
  useEffect(() => { const s = BackHandler.addEventListener('hardwareBackPress', () => { onDone(); return true; }); return () => s.remove(); }, []);

  function to24(h12: number, pm: boolean): number { return h12 === 12 ? (pm ? 12 : 0) : pm ? h12 + 12 : h12; }

  async function handleSave() {
    const id = existing?.id ?? generateId();
    const h = to24(hour12, isPM);
    const all = await loadAlarms();
    if (hasDuplicate(all, h, minute, id)) { Alert.alert('Already scheduled.', 'Show up tomorrow.'); return; }
    const alarm: Alarm = { id, hour: h, minute, enabled: existing?.enabled ?? true, phrase: phrase.trim(), repeatDaily, intensity, vibration };
    try {
      await cancelAlarmById(id);
      if (alarm.enabled && alarm.phrase) { alarm.notifId = await scheduleAlarm(alarm.hour, alarm.minute, alarm.phrase, alarm.id, alarm.statementId, alarm.repeatDaily); }
      const idx = all.findIndex(a => a.id === alarm.id);
      if (idx >= 0) all[idx] = alarm; else all.push(alarm);
      await saveAlarms(all);
    } catch {}
    onDone();
  }

  const showChips = !phrase.trim() && chips.length > 0;

  function handleDelete() {
    if (!existing) return;
    Alert.alert('Delete this alarm?', 'This can\'t be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => { cancelAlarmById(existing.id).catch(() => {}); deleteAlarm(existing.id).then(() => onDone()); } },
    ]);
  }

  return (
    <KeyboardAvoidingView style={st.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={st.header}>
        <TouchableOpacity onPress={onDone} style={st.cancelBtn}><Text style={st.cancelText}>{u.cancel}</Text></TouchableOpacity>
        <Text style={st.headerTitle}>{existing ? u.editAlarm : u.addAlarm}</Text>
        <View style={{ width: 80 }} />
      </View>
      <ScrollView contentContainerStyle={st.scroll} keyboardShouldPersistTaps="handled">
        <View style={st.pickerRow}>
          <PickerColumn values={HOURS} selectedIndex={hour12 - 1} onChange={i => setHour12(i + 1)} width={85} />
          <Text style={st.colon}>:</Text>
          <PickerColumn values={MINUTES} selectedIndex={minute} onChange={i => setMinute(i)} width={85} />
          <View style={{ width: 12 }} />
          <PickerColumn values={AMPMS} selectedIndex={isPM ? 1 : 0} onChange={i => setIsPM(i === 1)} width={85} loop={false} />
        </View>
        <View style={st.rows}>
          <View style={st.row}>
            <Text style={st.rowLabel}>{u.repeat}</Text>
            <View style={st.rowRight}><Text style={st.rowValue}>{u.daily}</Text>
              <Switch value={repeatDaily} onValueChange={setRepeatDaily} trackColor={{ false: '#333', true: '#6C63FF' }} thumbColor="#fff" /></View>
          </View>
          <Text style={st.sectionLabel}>{u.wakePhrase}</Text>
          <TextInput style={st.phraseInput} value={phrase} onChangeText={setPhrase} placeholder={u.phrasePlaceholder} placeholderTextColor="#444" multiline />
          <Text style={st.helper}>{u.phraseHelper}</Text>
          {showChips && (
            <View style={st.chipRow}>
              {chips.map(c => <TouchableOpacity key={c} style={st.chip} onPress={() => setPhrase(c)}><Text style={st.chipText}>{c}</Text></TouchableOpacity>)}
            </View>
          )}
          {phrase.trim() ? (
            <TouchableOpacity style={st.tryBtn} onPress={() => onTryPhrase(phrase.trim())}><Text style={st.tryBtnText}>{u.tryNow}</Text></TouchableOpacity>
          ) : null}
          <View style={st.row}><Text style={st.rowLabel}>{u.alarmSound}</Text><Text style={st.rowValue}>{u.soundDefault}</Text></View>
          <Text style={st.sectionLabel}>{u.intensity}</Text>
          <IntensityPicker value={intensity} onChange={setIntensity} />
          <Text style={st.sectionLabel}>{u.vibration}</Text>
          <VibrationPicker value={vibration} onChange={setVibration} labels={[u.vibOff, u.vibLight, u.vibStrong]} />
        </View>
        {existing && (
          <TouchableOpacity style={st.deleteBtn} onPress={handleDelete}><Text style={st.deleteBtnText}>Delete alarm</Text></TouchableOpacity>
        )}
        <View style={{ height: 100 }} />
      </ScrollView>
      <TouchableOpacity style={st.saveBtn} onPress={handleSave}><Text style={st.saveBtnText}>{u.save}</Text></TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0A' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingTop: 60, paddingBottom: 12 },
  cancelBtn: { paddingVertical: 12, paddingHorizontal: 4 },
  cancelText: { color: '#6C63FF', fontSize: 16, fontWeight: '600' },
  headerTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  scroll: { paddingHorizontal: 24 },
  pickerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: ITEM_H * 5, marginVertical: 16 },
  colon: { color: '#fff', fontSize: 34, fontWeight: '900', width: 16, textAlign: 'center' },
  rows: {},
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#1A1A1A' },
  rowLabel: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' }, rowRight: { flexDirection: 'row', alignItems: 'center', gap: 12 }, rowValue: { color: '#888', fontSize: 15, fontWeight: '500' },
  sectionLabel: { color: '#888', fontSize: 11, fontWeight: '700', marginTop: 20, marginBottom: 8, letterSpacing: 1.5 },
  phraseInput: { backgroundColor: '#141414', color: '#FFFFFF', fontSize: 16, fontWeight: '500', borderRadius: 12, padding: 14 },
  helper: { color: '#888', fontSize: 13, fontWeight: '500', marginTop: 6, marginBottom: 4 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8, marginBottom: 8 },
  chip: { borderWidth: 1, borderColor: '#6C63FF', borderRadius: 20, paddingVertical: 8, paddingHorizontal: 14 },
  chipText: { color: '#6C63FF', fontSize: 14, fontWeight: '600' },
  tryBtn: { borderWidth: 1, borderColor: '#6C63FF', borderRadius: 50, paddingVertical: 10, alignItems: 'center', marginTop: 12, marginBottom: 8 },
  tryBtnText: { color: '#6C63FF', fontSize: 14, fontWeight: '600' },
  deleteBtn: { alignItems: 'center', marginTop: 32, paddingVertical: 12 },
  deleteBtnText: { color: '#EF4444', fontSize: 13, fontWeight: '500', opacity: 0.7 },
  saveBtn: { position: 'absolute', bottom: 40, left: 24, right: 24, backgroundColor: '#6C63FF', paddingVertical: 16, borderRadius: 50, alignItems: 'center' },
  saveBtnText: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
});
