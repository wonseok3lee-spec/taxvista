import { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Vibration as VibType, RepeatType } from '../../lib/alarmStorage';
import IntensityPicker from '../../components/IntensityPicker';
import VibrationPicker from '../../components/VibrationPicker';
import { UIStrings } from '../../lib/i18n';

const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const WEEKDAY_IDXS = [1, 2, 3, 4, 5];
const REPEAT_OPTS: { key: RepeatType; label: string }[] = [
  { key: 'daily', label: 'Every day' }, { key: 'weekdays', label: 'Weekdays' }, { key: 'custom', label: 'Custom' },
];

interface Props {
  intensity: number; vibration: VibType; repeatType: RepeatType; repeatDays: number[];
  onIntensity: (v: number) => void; onVibration: (v: VibType) => void;
  onRepeatType: (v: RepeatType) => void; onRepeatDays: (d: number[]) => void;
  u: UIStrings;
}

export default function StepPressure({ intensity, vibration, repeatType, repeatDays, onIntensity, onVibration, onRepeatType, onRepeatDays, u }: Props) {
  const [warn, setWarn] = useState('');

  function handleIntensity(v: number) {
    onIntensity(v);
    if (v >= 4) { setWarn('This will not stop easily.'); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {}); }
    else if (v >= 3) { setWarn('Harder to ignore.'); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}); }
    else setWarn('');
  }

  function toggleDay(d: number) {
    onRepeatDays(repeatDays.includes(d) ? repeatDays.filter(x => x !== d) : [...repeatDays, d]);
  }

  function handleRepeatType(t: RepeatType) {
    onRepeatType(t);
    if (t === 'weekdays') onRepeatDays(WEEKDAY_IDXS);
    else if (t === 'daily') onRepeatDays([0, 1, 2, 3, 4, 5, 6]);
  }

  return (
    <ScrollView contentContainerStyle={st.container} keyboardShouldPersistTaps="handled">
      <Text style={st.title}>Set the pressure</Text>
      <Text style={st.sub}>Make it harder to ignore.</Text>

      <Text style={st.label}>REPEAT</Text>
      <View style={st.segRow}>
        {REPEAT_OPTS.map(o => (
          <TouchableOpacity key={o.key} style={[st.seg, repeatType === o.key && st.segActive]} onPress={() => handleRepeatType(o.key)}>
            <Text style={[st.segText, repeatType === o.key && st.segTextActive]}>{o.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {repeatType === 'custom' && (
        <View style={st.dayRow}>
          {DAYS.map((label, i) => {
            const active = repeatDays.includes(i);
            return (
              <TouchableOpacity key={i} style={[st.day, active && st.dayActive]} onPress={() => toggleDay(i)}>
                <Text style={[st.dayText, active && st.dayTextActive]}>{label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      <Text style={st.label}>{u.intensity}</Text>
      <IntensityPicker value={intensity} onChange={handleIntensity} />
      {warn ? <Text style={[st.warn, intensity >= 4 && st.warnRed]}>{warn}</Text> : null}

      <Text style={st.label}>{u.vibration}</Text>
      <VibrationPicker value={vibration} onChange={onVibration} labels={[u.vibOff, u.vibLight, u.vibStrong]} />
    </ScrollView>
  );
}

const st = StyleSheet.create({
  container: { padding: 24, paddingTop: 0 },
  title: { color: '#FFFFFF', fontSize: 24, fontWeight: '900', marginBottom: 8 },
  sub: { color: '#666', fontSize: 14, fontWeight: '500', marginBottom: 24 },
  label: { color: '#888', fontSize: 11, fontWeight: '700', letterSpacing: 1.5, marginTop: 20, marginBottom: 8 },
  segRow: { flexDirection: 'row', borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: '#333' },
  seg: { flex: 1, paddingVertical: 10, alignItems: 'center', backgroundColor: 'transparent' },
  segActive: { backgroundColor: '#6C63FF' },
  segText: { color: '#888', fontSize: 13, fontWeight: '500' },
  segTextActive: { color: '#fff', fontWeight: '700' },
  dayRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  day: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: '#444', alignItems: 'center', justifyContent: 'center' },
  dayActive: { backgroundColor: '#6C63FF', borderColor: '#6C63FF' },
  dayText: { color: '#888', fontSize: 13, fontWeight: '600' },
  dayTextActive: { color: '#fff' },
  warn: { color: '#FFB347', fontSize: 12, fontWeight: '600', marginTop: 6 },
  warnRed: { color: '#EF4444' },
});
