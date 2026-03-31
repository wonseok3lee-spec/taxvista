import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Linking } from 'react-native';
import * as Notifications from 'expo-notifications';
import { Audio } from 'expo-av';

interface Props { onDone: () => void }

type Step = 'notif' | 'mic' | 'battery' | 'done';
const STEPS: Step[] = Platform.OS === 'android' ? ['notif', 'mic', 'battery'] : ['notif', 'mic'];

const INFO: Record<string, { icon: string; title: string; body: string; btn: string }> = {
  notif: { icon: '🔔', title: 'Allow notifications', body: 'Your alarm needs to reach you.', btn: 'Allow' },
  mic: { icon: '🎤', title: 'Allow microphone', body: "You'll say it out loud to stop the alarm.", btn: 'Allow' },
  battery: { icon: '🔋', title: 'Keep alarms reliable', body: 'Keep your alarm reliable.', btn: 'Go to settings' },
};

export default function PermissionsScreen({ onDone }: Props) {
  const [idx, setIdx] = useState(0);
  const [skipped, setSkipped] = useState('');

  const current = STEPS[idx];

  useEffect(() => { if (!current) onDone(); }, [idx]);

  async function handleAllow() {
    try {
      if (current === 'notif') {
        const { status } = await Notifications.requestPermissionsAsync();
        if (status !== 'granted') setSkipped('You can enable this later in Settings');
      } else if (current === 'mic') {
        const { status } = await Audio.requestPermissionsAsync();
        if (status !== 'granted') setSkipped('You can enable this later in Settings');
      } else if (current === 'battery') {
        try { await Linking.openSettings(); } catch {}
      }
    } catch {}
    setSkipped('');
    setIdx(i => i + 1);
  }

  if (!current) return null;
  const info = INFO[current];
  const stepNum = idx + 1;
  const total = STEPS.length;

  return (
    <View style={st.container}>
      <View style={st.progress}>{STEPS.map((_, i) => <View key={i} style={[st.bar, i < stepNum && st.barFill]} />)}</View>
      <Text style={st.stepLabel}>{stepNum}/{total}</Text>
      <View style={st.center}>
        <Text style={st.icon}>{info.icon}</Text>
        <Text style={st.title}>{info.title}</Text>
        <Text style={st.body}>{info.body}</Text>
        {skipped ? <Text style={st.skip}>{skipped}</Text> : null}
        <TouchableOpacity style={st.btn} onPress={handleAllow}><Text style={st.btnText}>{info.btn}</Text></TouchableOpacity>
        <TouchableOpacity onPress={() => { setSkipped(''); setIdx(i => i + 1); }} style={st.skipBtn}><Text style={st.skipText}>Skip</Text></TouchableOpacity>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0A', paddingTop: 60 },
  progress: { flexDirection: 'row', paddingHorizontal: 24, gap: 4 },
  bar: { flex: 1, height: 3, backgroundColor: '#222', borderRadius: 2 },
  barFill: { backgroundColor: '#FFFFFF' },
  stepLabel: { color: '#555', fontSize: 12, fontWeight: '700', textAlign: 'right', paddingHorizontal: 24, marginTop: 8 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  icon: { fontSize: 64, marginBottom: 24 },
  title: { color: '#FFFFFF', fontSize: 24, fontWeight: '900', marginBottom: 12 },
  body: { color: '#888', fontSize: 16, fontWeight: '500', textAlign: 'center', lineHeight: 24 },
  skip: { color: '#666', fontSize: 13, marginTop: 12 },
  btn: { backgroundColor: '#6C63FF', paddingVertical: 16, paddingHorizontal: 48, borderRadius: 50, marginTop: 40 },
  btnText: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
  skipBtn: { marginTop: 16, paddingVertical: 8 },
  skipText: { color: '#555', fontSize: 14, fontWeight: '500' },
});
