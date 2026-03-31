import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { saveUserPhrases, setOnboarded } from '../lib/userPhrases';

interface Props { onComplete: () => void }

export default function OnboardingScreen({ onComplete }: Props) {
  const [page, setPage] = useState<1 | 2 | 3>(1);
  const [p1, setP1] = useState('');
  const [p2, setP2] = useState('');
  const [p3, setP3] = useState('');

  async function handleLockIn() {
    const phrases = [p1 || 'I show up every single day.', p2 || 'I keep my word.', p3 || 'I do hard things.'];
    await saveUserPhrases(phrases);
    await setOnboarded();
    onComplete();
  }

  if (page === 1) {
    return (
      <View style={s.container}>
        <View style={s.center}>
          <Text style={s.wakeUp}>WAKE UP.</Text>
          <Text style={s.headline}>You become{'\n'}what you repeat.</Text>
          <Text style={s.body}>This app doesn't let you snooze.{'\n'}You prove who you are.</Text>
          <TouchableOpacity style={s.btn} onPress={() => setPage(2)}><Text style={s.btnText}>Start →</Text></TouchableOpacity>
        </View>
      </View>
    );
  }

  if (page === 2) {
    return (
      <View style={s.container}>
        <View style={s.center}>
          <Text style={s.ruleWhite}>No snooze.</Text>
          <Text style={s.rulePurple}>No escape.</Text>
          <Text style={s.ruleBody}>You must say your phrase{'\n'}to turn off the alarm.</Text>
          <TouchableOpacity style={s.btn} onPress={() => setPage(3)}><Text style={s.btnText}>I'm in →</Text></TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <Text style={s.inputTitle}>Write 3 statements about who you are becoming.</Text>
        <Text style={s.inputSub}>You'll say one of these every morning to prove it.</Text>
        <TextInput style={s.input} value={p1} onChangeText={setP1} placeholder="I am..." placeholderTextColor="#555" />
        <TextInput style={s.input} value={p2} onChangeText={setP2} placeholder="I have..." placeholderTextColor="#555" />
        <TextInput style={s.input} value={p3} onChangeText={setP3} placeholder="I live..." placeholderTextColor="#555" />
        <TouchableOpacity style={s.btn} onPress={handleLockIn}><Text style={s.btnText}>Lock it in →</Text></TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0A' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  wakeUp: { color: '#888', fontSize: 13, fontWeight: '800', letterSpacing: 6 },
  headline: { color: '#FFFFFF', fontSize: 34, fontWeight: '900', marginTop: 12, textAlign: 'center' },
  body: { color: '#AAA', fontSize: 16, fontWeight: '500', marginTop: 24, lineHeight: 26, textAlign: 'center' },
  ruleWhite: { color: '#FFFFFF', fontSize: 28, fontWeight: '900' },
  rulePurple: { color: '#6C63FF', fontSize: 28, fontWeight: '900' },
  ruleBody: { color: '#AAA', fontSize: 16, fontWeight: '500', marginTop: 32, textAlign: 'center', lineHeight: 26 },
  scroll: { paddingHorizontal: 24, paddingTop: 80, alignItems: 'center' },
  inputTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '800', textAlign: 'center' },
  inputSub: { color: '#666', fontSize: 13, fontWeight: '500', marginTop: 8, marginBottom: 32, textAlign: 'center' },
  input: { backgroundColor: '#1A1A1A', color: '#FFFFFF', fontSize: 16, fontWeight: '600', borderRadius: 12, padding: 16, marginBottom: 12, width: '100%', borderWidth: 1, borderColor: '#333' },
  btn: { backgroundColor: '#6C63FF', paddingVertical: 18, paddingHorizontal: 40, borderRadius: 50, alignItems: 'center', marginTop: 60 },
  btnText: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
});
