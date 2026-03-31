import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

const LEVELS = [0, 1, 2, 3, 4] as const;
const LABELS = ['Off', 'Level 1', 'Level 2', 'Level 3', 'Level 4'];

interface Props { value: number; onChange: (v: number) => void }

export default function IntensityPicker({ value, onChange }: Props) {
  return (
    <View style={st.row}>
      {LEVELS.map((level, i) => {
        const active = value === level;
        return (
          <TouchableOpacity
            key={level}
            style={[st.seg, active && st.segActive, i === 0 && st.segLeft, i === 4 && st.segRight]}
            onPress={() => onChange(level)}
          >
            <Text style={[st.segText, active && st.segTextActive]}>{LABELS[i]}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const st = StyleSheet.create({
  row: { flexDirection: 'row', borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: '#333' },
  seg: { flex: 1, paddingVertical: 10, alignItems: 'center', backgroundColor: 'transparent' },
  segActive: { backgroundColor: '#6C63FF' },
  segLeft: { borderTopLeftRadius: 8, borderBottomLeftRadius: 8 },
  segRight: { borderTopRightRadius: 8, borderBottomRightRadius: 8 },
  segText: { color: '#888', fontSize: 12, fontWeight: '500' },
  segTextActive: { color: '#fff', fontWeight: '700' },
});
