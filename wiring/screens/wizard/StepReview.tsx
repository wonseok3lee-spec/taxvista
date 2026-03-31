import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { formatTime, Vibration as VibType } from '../../lib/alarmStorage';
import HoldToConfirmButton from '../../components/wizard/HoldToConfirmButton';

const VIB_LABELS: Record<VibType, string> = { off: 'Off', light: 'Light', strong: 'Strong' };
const INT_LABELS = ['Off', '1', '2', '3', '4'];

interface Props {
  hour12: number; minute: number; isPM: boolean;
  phrase: string; intensity: number; vibration: VibType; repeatDaily: boolean;
  onSave: () => void;
  isEditing: boolean;
  onDelete?: () => void;
}

function to24(h: number, pm: boolean) { return h === 12 ? (pm ? 12 : 0) : pm ? h + 12 : h; }

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={st.item}>
      <Text style={st.label}>{label}</Text>
      <Text style={st.value}>{value}</Text>
    </View>
  );
}

export default function StepReview({ hour12, minute, isPM, phrase, intensity, vibration, repeatDaily, onSave, isEditing, onDelete }: Props) {
  const time = formatTime(to24(hour12, isPM), minute);
  return (
    <ScrollView contentContainerStyle={st.container} keyboardShouldPersistTaps="handled">
      <Text style={st.title}>Read it once.</Text>
      <Text style={st.sub}>This alarm stops only when you prove it.</Text>
      <View style={st.card}>
        <Row label="TIME" value={time} />
        <Row label="REPEAT" value={repeatDaily ? 'Every day' : 'Once'} />
        <View style={st.divider} />
        <View style={st.item}>
          <Text style={st.label}>STATEMENT</Text>
          <Text style={st.statement}>{phrase || 'No statement selected'}</Text>
        </View>
        <View style={st.divider} />
        <Row label="INTENSITY" value={`${INT_LABELS[intensity] ?? '2'} / 4`} />
        <Row label="VIBRATION" value={VIB_LABELS[vibration]} />
      </View>
      <View style={st.holdArea}>
        <HoldToConfirmButton onConfirm={onSave} />
      </View>
      {isEditing && onDelete && (
        <TouchableOpacity style={st.deleteBtn} onPress={onDelete}>
          <Text style={st.deleteText}>Delete alarm</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const st = StyleSheet.create({
  container: { padding: 24, paddingTop: 0 },
  title: { color: '#FFFFFF', fontSize: 24, fontWeight: '900', marginBottom: 8 },
  sub: { color: '#888', fontSize: 14, fontWeight: '500', marginBottom: 24 },
  card: { backgroundColor: '#141414', borderRadius: 12, padding: 16 },
  item: { marginBottom: 12 },
  label: { color: '#888', fontSize: 11, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 4 },
  value: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  statement: { color: '#FFFFFF', fontSize: 16, fontWeight: '600', lineHeight: 22 },
  divider: { height: 1, backgroundColor: '#222', marginVertical: 8 },
  holdArea: { marginTop: 24 },
  deleteBtn: { alignItems: 'center', marginTop: 24, paddingVertical: 12 },
  deleteText: { color: '#EF4444', fontSize: 13, fontWeight: '500', opacity: 0.7 },
});
