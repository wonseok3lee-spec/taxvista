import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, ScrollView, KeyboardAvoidingView, Platform, BackHandler } from 'react-native';
import { loadUserPhrases, saveUserPhrases } from '../lib/userPhrases';

interface Props { onDone: () => void }

export default function EditPhrasesScreen({ onDone }: Props) {
  const [p1, setP1] = useState('');
  const [p2, setP2] = useState('');
  const [p3, setP3] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    loadUserPhrases().then(p => { setP1(p[0] ?? ''); setP2(p[1] ?? ''); setP3(p[2] ?? ''); });
  }, []);
  useEffect(() => { const s = BackHandler.addEventListener('hardwareBackPress', () => { onDone(); return true; }); return () => s.remove(); }, []);

  async function handleSave() {
    await saveUserPhrases([p1 || '', p2 || '', p3 || '']);
    setSaved(true);
    setTimeout(onDone, 600);
  }

  return (
    <KeyboardAvoidingView style={st.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={st.header}>
        <TouchableOpacity onPress={onDone} style={st.backBtn}><Text style={st.backText}>Back</Text></TouchableOpacity>
        <Text style={st.headerTitle}>Edit Your Identity</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView contentContainerStyle={st.scroll} keyboardShouldPersistTaps="handled">
        <Text style={st.label}>Your statement</Text>
        <TextInput style={st.input} value={p1} onChangeText={t => { setP1(t); setSaved(false); }} placeholder="I am..." placeholderTextColor="#555" />
        <Text style={st.label}>Your statement</Text>
        <TextInput style={st.input} value={p2} onChangeText={t => { setP2(t); setSaved(false); }} placeholder="I have..." placeholderTextColor="#555" />
        <Text style={st.label}>Your statement</Text>
        <TextInput style={st.input} value={p3} onChangeText={t => { setP3(t); setSaved(false); }} placeholder="I live..." placeholderTextColor="#555" />
        <TouchableOpacity style={st.saveBtn} onPress={handleSave}>
          <Text style={st.saveBtnText}>{saved ? '✅ Saved' : 'Lock it in'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0A' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingTop: 60, paddingBottom: 12 },
  backBtn: { paddingVertical: 12, paddingHorizontal: 4 },
  backText: { color: '#6C63FF', fontSize: 16, fontWeight: '600' },
  headerTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: '900' },
  scroll: { paddingHorizontal: 24, paddingTop: 16 },
  label: { color: '#888', fontSize: 14, fontWeight: '700', letterSpacing: 1, marginTop: 20, marginBottom: 8 },
  input: { backgroundColor: '#1A1A1A', color: '#FFFFFF', fontSize: 16, fontWeight: '600', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#333' },
  saveBtn: { backgroundColor: '#6C63FF', paddingVertical: 16, borderRadius: 50, alignItems: 'center', marginTop: 40 },
  saveBtnText: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
});
