import { View, Text, StyleSheet } from 'react-native';
import { getCalendars } from 'expo-localization';
import PickerColumn, { ITEM_H } from '../../components/PickerColumn';

const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));
const AMPMS = ['AM', 'PM'];

interface Props {
  hour12: number; minute: number; isPM: boolean;
  onChange: (h: number, m: number, pm: boolean) => void;
}

const TZ_MAP: Record<string, string> = {
  'America/New_York': 'ET', 'America/Chicago': 'CT', 'America/Denver': 'MT', 'America/Los_Angeles': 'PT',
  'America/Anchorage': 'AKT', 'Pacific/Honolulu': 'HT', 'Asia/Seoul': 'KST', 'Asia/Tokyo': 'JST',
  'Europe/London': 'GMT', 'Europe/Paris': 'CET', 'Europe/Berlin': 'CET',
};
function formatTimezone(tz: string): string {
  try {
    const city = tz.split('/').pop()?.replace(/_/g, ' ') || 'Local';
    const abbr = TZ_MAP[tz];
    return abbr ? `${city} (${abbr})` : city;
  } catch { return 'Local time'; }
}

export default function StepTime({ hour12, minute, isPM, onChange }: Props) {
  const tz = getCalendars()[0]?.timeZone || '';
  return (
    <View style={st.container}>
      <Text style={st.title}>Set the time</Text>
      <Text style={st.sub}>When do you show up?</Text>
      <View style={st.row}>
        <PickerColumn values={HOURS} selectedIndex={hour12 - 1} onChange={i => onChange(i + 1, minute, isPM)} />
        <Text style={st.colon}>:</Text>
        <PickerColumn values={MINUTES} selectedIndex={minute} onChange={i => onChange(hour12, i, isPM)} />
        <View style={{ width: 12 }} />
        <PickerColumn values={AMPMS} selectedIndex={isPM ? 1 : 0} onChange={i => onChange(hour12, minute, i === 1)} loop={false} />
      </View>
      <Text style={st.tz}>{tz ? formatTimezone(tz) : 'Local time'}</Text>
    </View>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { color: '#FFFFFF', fontSize: 24, fontWeight: '900', marginBottom: 8 },
  sub: { color: '#666', fontSize: 14, fontWeight: '500', marginBottom: 32 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: ITEM_H * 5 },
  colon: { color: '#fff', fontSize: 34, fontWeight: '900', width: 16, textAlign: 'center' },
  tz: { color: '#666', fontSize: 12, fontWeight: '500', textAlign: 'center', marginTop: 16 },
});
