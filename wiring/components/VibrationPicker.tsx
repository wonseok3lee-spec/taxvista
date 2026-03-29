import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Vibration as VibType } from '../lib/alarmStorage';

const LEVELS: VibType[] = ['off', 'light', 'strong'];

interface Props {
  value: VibType;
  onChange: (v: VibType) => void;
  labels: [string, string, string];
}

export default function VibrationPicker({ value, onChange, labels }: Props) {
  return (
    <View style={styles.row}>
      {LEVELS.map((level, i) => {
        const active = value === level;
        return (
          <TouchableOpacity
            key={level}
            style={[styles.seg, active && styles.segActive, i === 0 && styles.segLeft, i === 2 && styles.segRight]}
            onPress={() => onChange(level)}
          >
            <Text style={[styles.segText, active && styles.segTextActive]}>{labels[i]}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: '#333' },
  seg: { flex: 1, paddingVertical: 10, alignItems: 'center', backgroundColor: '#141414' },
  segActive: { backgroundColor: '#6C63FF' },
  segLeft: { borderTopLeftRadius: 10, borderBottomLeftRadius: 10 },
  segRight: { borderTopRightRadius: 10, borderBottomRightRadius: 10 },
  segText: { color: '#888', fontSize: 14, fontWeight: '500' },
  segTextActive: { color: '#fff', fontWeight: '700' },
});
