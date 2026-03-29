import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, Switch, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import Slider from '@react-native-community/slider';
import { Alarm, Vibration as VibType, generateId, loadAlarms, saveAlarms } from '../lib/alarmStorage';
import { scheduleAlarm, cancelAlarmById } from '../lib/alarmScheduler';
import { UIStrings } from '../lib/i18n';
import PickerColumn, { ITEM_H } from '../components/PickerColumn';
import VibrationPicker from '../components/VibrationPicker';

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);
const AMPMS = ['AM', 'PM'];

interface Props { u: UIStrings; existing: Alarm | null; onDone: () => void; onTryPhrase: (phrase: string) => void }

export default function AddAlarmScreen({ u, existing, onDone, onTryPhrase }: Props) {
  const is24 = existing ? existing.hour : 7;
  const [hour12, setHour12] = useState(is24 % 12 || 12);
  const [minute, setMinute] = useState(existing?.minute ?? 0);
  const [isPM, setIsPM] = useState(is24 >= 12);
  const [repeatDaily, setRepeatDaily] = useState(existing?.repeatDaily ?? true);
  const [phrase, setPhrase] = useState(existing?.phrase ?? '');
  const [intensity, setIntensity] = useState(existing?.intensity ?? 3);
  const [vibration, setVibration] = useState<VibType>(existing?.vibration ?? 'light');

  function to24(h12: number, pm: boolean): number { return h12 === 12 ? (pm ? 12 : 0) : pm ? h12 + 12 : h12; }

  async function handleSave() {
    const id = existing?.id ?? generateId();
    const alarm: Alarm = { id, hour: to24(hour12, isPM), minute, enabled: existing?.enabled ?? true, phrase: phrase.trim(), repeatDaily, intensity, vibration };
    try {
      await cancelAlarmById(id);
      if (alarm.enabled && alarm.phrase) {
        alarm.notifId = await scheduleAlarm(alarm.hour, alarm.minute, alarm.phrase, alarm.id);
      }
      const all = await loadAlarms();
      const idx = all.findIndex(a => a.id === alarm.id);
      if (idx >= 0) all[idx] = alarm; else all.push(alarm);
      await saveAlarms(all);
    } catch {}
    onDone();
  }

  const chips = [u.chip1, u.chip2, u.chip3];
  const showChips = !phrase.trim();

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onDone} style={styles.backRow}><Text style={styles.backArrow}>←</Text><Text style={styles.cancelText}>{u.cancel}</Text></TouchableOpacity>
        <Text style={styles.headerTitle}>{existing ? u.editAlarm : u.addAlarm}</Text>
        <View style={{ width: 80 }} />
      </View>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.pickerRow}>
          <PickerColumn data={HOURS} initial={hour12 - 1} onChange={i => setHour12(HOURS[i])} />
          <Text style={styles.colon}>:</Text>
          <PickerColumn data={MINUTES} initial={minute} onChange={i => setMinute(MINUTES[i])} />
          <PickerColumn data={AMPMS} initial={isPM ? 1 : 0} onChange={i => setIsPM(i === 1)} />
        </View>
        <View style={styles.rows}>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>{u.repeat}</Text>
            <View style={styles.rowRight}>
              <Text style={styles.rowValue}>{u.daily}</Text>
              <Switch value={repeatDaily} onValueChange={setRepeatDaily} trackColor={{ false: '#333', true: '#6C63FF' }} thumbColor="#fff" />
            </View>
          </View>
          <Text style={styles.sectionLabel}>{u.wakePhrase}</Text>
          <TextInput style={styles.phraseInput} value={phrase} onChangeText={setPhrase} placeholder={u.phrasePlaceholder} placeholderTextColor="#444" multiline />
          <Text style={styles.helper}>{u.phraseHelper}</Text>
          {showChips && (
            <View style={styles.chipRow}>
              {chips.map(c => <TouchableOpacity key={c} style={styles.chip} onPress={() => setPhrase(c)}><Text style={styles.chipText}>{c}</Text></TouchableOpacity>)}
            </View>
          )}
          {phrase.trim() ? (
            <TouchableOpacity style={styles.tryBtn} onPress={() => onTryPhrase(phrase.trim())}><Text style={styles.tryBtnText}>{u.tryNow}</Text></TouchableOpacity>
          ) : null}
          <View style={styles.row}>
            <Text style={styles.rowLabel}>{u.alarmSound}</Text>
            <Text style={styles.rowValue}>{u.soundDefault}</Text>
          </View>
          <Text style={styles.sectionLabel}>{u.intensity}</Text>
          <View style={styles.sliderRow}>
            <Text style={styles.sliderEdge}>{u.intGentle}</Text>
            <Text style={styles.sliderCenter}>{u.intLevel} {intensity}</Text>
            <Text style={styles.sliderEdge}>{u.intBrutal}</Text>
          </View>
          <Slider style={styles.slider} minimumValue={1} maximumValue={5} step={1} value={intensity} onValueChange={v => setIntensity(v)} minimumTrackTintColor="#6C63FF" maximumTrackTintColor="#333" thumbTintColor="#6C63FF" />
          <Text style={styles.sectionLabel}>{u.vibration}</Text>
          <VibrationPicker value={vibration} onChange={setVibration} labels={[u.vibOff, u.vibLight, u.vibStrong]} />
        </View>
        <View style={{ height: 100 }} />
      </ScrollView>
      <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
        <Text style={styles.saveBtnText}>{u.save}</Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0A' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingTop: 60, paddingBottom: 12 },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  backArrow: { color: '#fff', fontSize: 24 },
  cancelText: { color: '#6C63FF', fontSize: 16 },
  headerTitle: { color: '#fff', fontSize: 17, fontWeight: '600' },
  scroll: { paddingHorizontal: 24 },
  pickerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: ITEM_H * 5, marginVertical: 16 },
  colon: { color: '#fff', fontSize: 28, fontWeight: '300', marginHorizontal: 4 },
  rows: {},
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#1A1A1A' },
  rowLabel: { color: '#fff', fontSize: 16 }, rowRight: { flexDirection: 'row', alignItems: 'center', gap: 12 }, rowValue: { color: '#888', fontSize: 15 },
  sectionLabel: { color: '#555', fontSize: 11, marginTop: 20, marginBottom: 8, letterSpacing: 1.2 },
  phraseInput: { backgroundColor: '#141414', color: '#fff', fontSize: 15, borderRadius: 12, padding: 14 },
  helper: { color: '#555', fontSize: 12, marginTop: 6, marginBottom: 4 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8, marginBottom: 8 },
  chip: { borderWidth: 1, borderColor: '#6C63FF', borderRadius: 20, paddingVertical: 8, paddingHorizontal: 14 },
  chipText: { color: '#6C63FF', fontSize: 13 },
  tryBtn: { borderWidth: 1, borderColor: '#6C63FF', borderRadius: 50, paddingVertical: 10, alignItems: 'center', marginTop: 12, marginBottom: 8 },
  tryBtnText: { color: '#6C63FF', fontSize: 14 },
  sliderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  sliderEdge: { color: '#555', fontSize: 11 },
  sliderCenter: { color: '#fff', fontSize: 14, fontWeight: '600' },
  slider: { width: '100%', height: 40 },
  saveBtn: { position: 'absolute', bottom: 40, left: 24, right: 24, backgroundColor: '#6C63FF', paddingVertical: 16, borderRadius: 50, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
});
