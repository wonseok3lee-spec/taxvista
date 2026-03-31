import { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Linking, Alert } from 'react-native';
import { requestNotificationPermission, requestMicrophonePermission, checkAllPermissions } from '../lib/permissions';

interface Props { onDone: () => void }

const MAX_STEP = Platform.OS === 'android' ? 3 : 2;

const STEPS = [
  { icon: '🔔', title: 'Your alarm needs to reach you.', sub: 'Allow notifications so your alarm can wake you up.', btn: 'Allow' },
  { icon: '🎤', title: "You'll say it out loud to stop the alarm.", sub: 'Wiring needs your microphone to hear your voice.', btn: 'Allow' },
  { icon: '🔋', title: 'Keep your alarm reliable.', sub: 'Disable battery optimization so your alarm always fires.', btn: 'Open Settings' },
];

export default function PermissionSetupScreen({ onDone }: Props) {
  const [step, setStep] = useState(0);
  const [denied, setDenied] = useState(false);
  const doneRef = useRef(false);

  function safeDone() { if (doneRef.current) return; doneRef.current = true; onDone(); }

  useEffect(() => {
    checkAllPermissions().then(s => {
      if (s.notifications === 'granted' && s.microphone === 'granted') safeDone();
      else setStep(1);
    }).catch(() => setStep(1));
  }, []);

  function advance() {
    setDenied(false);
    if (step >= MAX_STEP) { safeDone(); return; }
    setStep(s => s + 1);
  }

  function showDeniedAlert() {
    Alert.alert('Permission needed', 'You can enable this in your device Settings.', [
      { text: 'Open Settings', onPress: () => { try { Linking.openSettings(); } catch {} } },
      { text: 'Not now', style: 'cancel' },
    ]);
  }

  async function handleAllow() {
    if (step === 3) { try { await Linking.openSettings(); } catch {} advance(); return; }
    let granted = false;
    try {
      if (step === 1) granted = await requestNotificationPermission();
      else if (step === 2) granted = await requestMicrophonePermission();
    } catch {}
    if (!granted) {
      // FIX 2: Permanent denial handling
      showDeniedAlert();
      setDenied(true);
      setTimeout(advance, 2000);
    } else { advance(); }
  }

  if (step === 0) return <View style={st.container} />;

  const info = STEPS[step - 1];

  return (
    <View style={st.container}>
      <View style={st.center}>
        <Text style={st.icon}>{info.icon}</Text>
        <Text style={st.title}>{info.title}</Text>
        <Text style={st.sub}>{info.sub}</Text>
        {denied && <Text style={st.deniedText}>You can enable this later in Settings.</Text>}
      </View>
      <View style={st.footer}>
        <TouchableOpacity style={st.btn} onPress={handleAllow}>
          <Text style={st.btnText}>{info.btn}</Text>
        </TouchableOpacity>
        {step === 3 && (
          <TouchableOpacity style={st.skipBtn} onPress={advance}>
            <Text style={st.skipText}>Skip</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0A', paddingHorizontal: 24 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  icon: { fontSize: 48, marginBottom: 24 },
  title: { color: '#FFFFFF', fontSize: 22, fontWeight: '800', textAlign: 'center', marginBottom: 12 },
  sub: { color: '#888', fontSize: 14, fontWeight: '500', textAlign: 'center', maxWidth: 280, lineHeight: 20 },
  deniedText: { color: '#666', fontSize: 12, fontWeight: '500', marginTop: 16 },
  footer: { paddingBottom: 40 },
  btn: { height: 56, borderRadius: 28, backgroundColor: '#6C63FF', alignItems: 'center', justifyContent: 'center' },
  btnText: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
  skipBtn: { alignItems: 'center', marginTop: 16, paddingVertical: 8 },
  skipText: { color: '#888', fontSize: 14, fontWeight: '500' },
});
