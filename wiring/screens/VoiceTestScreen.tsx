import { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, TextInput, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Audio } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { transcribeWithWhisper } from '../lib/whisper';
import { similarityScore } from '../lib/matcher';
import { UIStrings } from '../lib/i18n';

const PHRASE_KEY = 'wiring:test_phrase';
let activeRecording: Audio.Recording | null = null;

interface Props { u: UIStrings; lang: string; initialPhrase?: string; onBack: () => void }

export default function VoiceTestScreen({ u, lang, initialPhrase, onBack }: Props) {
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('');
  const [transcript, setTranscript] = useState<string | null>(null);
  const [score, setScore] = useState<number | null>(null);
  const [hasResult, setHasResult] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const isRecordingRef = useRef(false);
  const [phrase, setPhrase] = useState(initialPhrase ?? '');
  const [phraseInput, setPhraseInput] = useState(initialPhrase ?? '');
  const [phraseSaved, setPhraseSaved] = useState(!!initialPhrase);

  useEffect(() => {
    if (initialPhrase) return;
    AsyncStorage.getItem(PHRASE_KEY).then(val => { if (val) { setPhrase(val); setPhraseInput(val); } }).catch(() => {});
  }, []);
  useEffect(() => { if (!isLoading) return; setLoadingText(u.transcribing); const t = setTimeout(() => setLoadingText(u.almostThere), 2000); return () => clearTimeout(t); }, [isLoading]);

  async function savePhrase() { try { const t = phraseInput.trim(); if (!t) return; await AsyncStorage.setItem(PHRASE_KEY, t); setPhrase(t); setPhraseSaved(true); } catch {} }
  function onPhraseChange(text: string) { setPhraseInput(text); setPhraseSaved(false); }

  async function startRecording() {
    if (!phrase.trim()) { setTranscript(null); setScore(null); setHasResult(false); return; }
    if (isRecordingRef.current) return;
    isRecordingRef.current = true;
    try {
      if (activeRecording) { try { await activeRecording.stopAndUnloadAsync(); } catch {} activeRecording = null; }
      if (recording) { try { await recording.stopAndUnloadAsync(); } catch {} setRecording(null); }
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording: rec } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.LOW_QUALITY);
      activeRecording = rec; setRecording(rec); setIsRecording(true); setHasResult(false); setTranscript(null); setScore(null);
    } catch { isRecordingRef.current = false; }
  }

  async function stopRecording() {
    if (!recording) return;
    isRecordingRef.current = false; setIsRecording(false);
    try {
      const status = await recording.getStatusAsync();
      if ((status.durationMillis ?? 0) < 1500) { try { await recording.stopAndUnloadAsync(); } catch {} activeRecording = null; setRecording(null); return; }
      setIsLoading(true);
      await recording.stopAndUnloadAsync(); activeRecording = null;
      const uri = recording.getURI()!; setRecording(null);
      const text = await transcribeWithWhisper(uri, lang);
      const s = text.length >= 2 ? similarityScore(text, phrase) : 0;
      setTranscript(text); setScore(s); setHasResult(true);
    } catch {
      setTranscript(''); setScore(0); setHasResult(true);
    } finally { setIsLoading(false); }
  }

  const matched = score !== null && score >= 0.7;

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}><Text style={styles.backText}>←</Text></TouchableOpacity>
        <Text style={styles.headerTitle}>{u.tryNow.split(' →')[0]}</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>{u.phraseLabel}</Text>
        <TextInput style={styles.phraseInput} value={phraseInput} onChangeText={onPhraseChange} placeholder={u.phrasePlaceholder} placeholderTextColor="#444" multiline />
        <TouchableOpacity style={styles.saveBtn} onPress={savePhrase}>
          <Text style={styles.saveBtnText}>{phraseSaved ? u.saved : u.save}</Text>
        </TouchableOpacity>
        <View style={styles.divider} />
        <Text style={styles.phrase}>{phrase}</Text>
        <TouchableOpacity style={[styles.btn, isRecording && styles.btnRec]} onPressIn={startRecording} onPressOut={stopRecording}>
          <Text style={styles.btnText}>{isRecording ? u.btnRec : isLoading ? u.btnListening : u.btn}</Text>
        </TouchableOpacity>
        {isLoading && <View style={styles.loadWrap}><ActivityIndicator size="large" color="#6C63FF" /><Text style={styles.loadLabel}>{loadingText}</Text></View>}
        {hasResult && !isLoading && (
          <View style={styles.result}>
            <Text style={styles.rLabel}>{u.recognized}: <Text style={styles.rValue}>"{transcript || '...'}"</Text></Text>
            <Text style={styles.rLabel}>{u.similarity}: <Text style={styles.rValue}>{score !== null ? `${(score * 100).toFixed(0)}%` : '0%'}</Text></Text>
            <View style={[styles.badge, { backgroundColor: matched ? '#22C55E22' : '#EF444422' }]}>
              <Text style={{ color: matched ? '#22C55E' : '#EF4444', fontWeight: '700', fontSize: 16 }}>{matched ? `✅ ${u.match}` : `❌ ${u.noMatch}`}</Text>
            </View>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0A' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingTop: 60, paddingBottom: 12 },
  backText: { color: '#6C63FF', fontSize: 24 }, headerTitle: { color: '#fff', fontSize: 17, fontWeight: '600' },
  content: { alignItems: 'center', padding: 24, paddingTop: 12 },
  label: { color: '#555', fontSize: 11, marginBottom: 8, alignSelf: 'flex-start', letterSpacing: 1.2 },
  phraseInput: { backgroundColor: '#1A1A1A', color: '#fff', fontSize: 16, width: '100%', borderRadius: 12, padding: 14, marginBottom: 8 },
  saveBtn: { backgroundColor: '#333', paddingVertical: 10, paddingHorizontal: 28, borderRadius: 50, alignSelf: 'flex-end' },
  saveBtnText: { color: '#fff', fontSize: 14 },
  divider: { width: '80%', height: 1, backgroundColor: '#222', marginVertical: 24 },
  phrase: { color: '#fff', fontSize: 20, fontWeight: 'bold', textAlign: 'center', marginBottom: 24 },
  btn: { backgroundColor: '#6C63FF', paddingVertical: 20, paddingHorizontal: 40, borderRadius: 50 },
  btnRec: { backgroundColor: '#EF4444' }, btnText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  loadWrap: { alignItems: 'center', marginTop: 24 }, loadLabel: { color: '#888', fontSize: 14, marginTop: 8 },
  result: { marginTop: 32, alignItems: 'flex-start', width: '100%', gap: 10 },
  rLabel: { color: '#888', fontSize: 14 }, rValue: { color: '#fff' },
  badge: { alignSelf: 'center', paddingVertical: 10, paddingHorizontal: 24, borderRadius: 50, marginTop: 8 },
});
