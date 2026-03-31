import { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet, Vibration, BackHandler, Animated } from 'react-native';
import { Audio } from 'expo-av';
import { transcribeWithWhisper } from '../lib/whisper';
import { similarityScore } from '../lib/matcher';
import { incrementStreak } from '../lib/storage';
import { loadUserPhrases } from '../lib/userPhrases';

interface Props { phrase: string; lang: string; intensity?: number; vibration?: 'off' | 'light' | 'strong'; onDismiss: () => void }
type AlarmState = 'idle' | 'listening' | 'processing' | 'result';

const SOUND_URI = 'https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg';
const CHIME_URI = 'https://actions.google.com/sounds/v1/cartoon/clang_and_wobble.ogg';
const VIB_PATTERNS: Record<string, number[]> = { light: [0, 400, 400], strong: [0, 600, 200, 600], default: [0, 500, 300] };

const VOLUME_MAP = [0, 0.25, 0.5, 0.75, 1.0];

export default function AlarmScreen({ phrase: propPhrase, lang, intensity = 2, vibration = 'light', onDismiss }: Props) {
  const [activePhrase, setActivePhrase] = useState(propPhrase);
  const [currentTime, setCurrentTime] = useState('');
  const [alarmState, setAlarmState] = useState<AlarmState>('idle');
  const [attemptCount, setAttemptCount] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [score, setScore] = useState<number | null>(null);
  const [streak, setStreak] = useState(0);
  const [typingMode, setTypingMode] = useState(false);
  const [typedText, setTypedText] = useState('');
  const soundRef = useRef<Audio.Sound | null>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const startTimeRef = useRef(0);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const clockRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 0. Load random phrase if none provided
  useEffect(() => {
    if (propPhrase) return;
    loadUserPhrases().then(p => { if (p.length) setActivePhrase(p[Math.floor(Math.random() * p.length)]); });
  }, []);

  // 1. Block back button
  useEffect(() => { const s = BackHandler.addEventListener('hardwareBackPress', () => true); return () => s.remove(); }, []);

  // 2. Clock, vibration, sound — mount/unmount
  useEffect(() => {
    const tick = () => setCurrentTime(new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }));
    tick(); clockRef.current = setInterval(tick, 1000);
    // Vibration
    if (vibration !== 'off') Vibration.vibrate(VIB_PATTERNS[vibration] ?? VIB_PATTERNS.default, true);
    // Sound
    (async () => {
      try {
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, staysActiveInBackground: true });
        const vol = VOLUME_MAP[Math.min(intensity, 4)] || 0;
        if (vol === 0) return;
        const { sound } = await Audio.Sound.createAsync({ uri: SOUND_URI }, { isLooping: true, volume: vol, shouldPlay: true });
        soundRef.current = sound;
      } catch {}
    })();
    return () => {
      if (clockRef.current) clearInterval(clockRef.current);
      Vibration.cancel();
      soundRef.current?.stopAsync().then(() => soundRef.current?.unloadAsync()).catch(() => {});
    };
  }, []);

  // 3. Pulse animation while listening
  useEffect(() => {
    if (alarmState !== 'listening') { pulseAnim.setValue(1); return; }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 0.4, duration: 600, useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
    ]));
    loop.start(); return () => loop.stop();
  }, [alarmState]);

  async function startRecording() {
    if (alarmState !== 'idle') return;
    setAlarmState('listening'); setTranscript(''); setScore(null);
    try {
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.LOW_QUALITY);
      recordingRef.current = recording; startTimeRef.current = Date.now();
    } catch { setAlarmState('idle'); }
  }

  async function stopRecording() {
    if (alarmState !== 'listening') return;
    setAlarmState('processing');
    const rec = recordingRef.current;
    if (!rec) { setAlarmState('idle'); return; }
    try {
      await rec.stopAndUnloadAsync();
      recordingRef.current = null;
      const duration = Date.now() - startTimeRef.current;
      if (duration < 1500) { setAlarmState('idle'); return; }
      const uri = rec.getURI();
      if (!uri) { setAlarmState('idle'); return; }
      const text = await transcribeWithWhisper(uri, lang);
      const s = similarityScore(text, activePhrase);
      setTranscript(text); setScore(s); setAlarmState('result');
      if (s >= 0.85) {
        Vibration.cancel(); Vibration.vibrate([0, 100, 50, 100, 50, 200]);
        try { await soundRef.current?.stopAsync(); } catch {}
        try { const { sound: chime } = await Audio.Sound.createAsync({ uri: CHIME_URI }, { volume: 0.6, shouldPlay: true }); setTimeout(() => chime.unloadAsync().catch(() => {}), 3000); } catch {}
        incrementStreak().then(n => { setStreak(n); }).catch(() => {});
        Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
        setTimeout(onDismiss, 2000);
      } else {
        const next = attemptCount + 1;
        setAttemptCount(next);
        const baseVol = VOLUME_MAP[Math.min(intensity, 4)] || 0.25;
        try { await soundRef.current?.setVolumeAsync(Math.min(baseVol + next * 0.15, 1.0)); } catch {}
        setTimeout(() => setAlarmState('idle'), 3000);
      }
    } catch {
      setTranscript(''); setScore(0); setAlarmState('result');
      setAttemptCount(a => a + 1);
      setTimeout(() => setAlarmState('idle'), 3000);
    }
  }

  function submitTyped() {
    const s = similarityScore(typedText, activePhrase);
    setScore(s); setTranscript(typedText); setAlarmState('result');
    if (s >= 0.95) {
      Vibration.cancel(); try { soundRef.current?.stopAsync(); } catch {}
      incrementStreak().then(n => setStreak(n)).catch(() => {});
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
      setTimeout(onDismiss, 2000);
    } else {
      setAttemptCount(a => a + 1);
      setTimeout(() => { setAlarmState('idle'); setTypingMode(false); setTypedText(''); }, 3000);
    }
  }

  // Phrase with first word bold
  const words = activePhrase.split(' ');
  const phraseEl = (
    <Text style={st.phrase}>
      <Text style={{ fontWeight: '900' }}>{words[0]}</Text>
      {words.length > 1 && <Text style={{ fontWeight: '400' }}>{' '}{words.slice(1).join(' ')}</Text>}
    </Text>
  );

  // Result section
  const isSuccess = alarmState === 'result' && score !== null && score >= 0.85;
  const isAlmost = alarmState === 'result' && score !== null && score >= 0.40 && score < 0.85;
  const isFail = alarmState === 'result' && score !== null && score < 0.40;
  const pct = score !== null ? `${Math.round(score * 100)}%` : '';

  if (isSuccess) {
    return (
      <Animated.View style={[st.container, { backgroundColor: '#0D2B1A', opacity: fadeAnim }]}>
        <Text style={{ fontSize: 64 }}>✅</Text>
        <Text style={st.successTitle}>You showed up.</Text>
        {streak > 0 && <Text style={st.streakText}>Day {streak} started. 🌅</Text>}
      </Animated.View>
    );
  }

  const btnStyle = alarmState === 'listening' ? st.btnRec : alarmState === 'processing' ? st.btnProc : st.btn;
  const btnLabel = alarmState === 'listening' ? '🔴 Listening...' : alarmState === 'processing' ? 'Checking...' : 'HOLD TO CONFIRM';
  const attemptLabel = attemptCount > 0 ? `Try ${attemptCount + 1}` : '';

  return (
    <View style={st.container}>
      {attemptLabel ? <Text style={st.attemptBadge}>{attemptLabel}</Text> : null}
      <Text style={st.clock}>{currentTime}</Text>
      <Text style={st.wakeLabel}>WAKE UP.</Text>
      <View style={st.divider} />
      {phraseEl}
      <Text style={st.hint}>Say it to start your day.</Text>
      <View style={st.divider} />
      <TouchableOpacity style={btnStyle} onPressIn={startRecording} onPressOut={stopRecording} activeOpacity={0.8}>
        {alarmState === 'listening'
          ? <Animated.Text style={[st.btnText, { opacity: pulseAnim }]}>{btnLabel}</Animated.Text>
          : <Text style={[st.btnText, alarmState === 'processing' && { color: '#888' }]}>{btnLabel}</Text>}
      </TouchableOpacity>
      {(isAlmost || isFail) && (
        <View style={st.resultArea}>
          <Text style={st.resultLine}>You said: "{transcript || '...'}"</Text>
          <Text style={[st.matchPct, { color: isAlmost ? '#FFB347' : '#EF4444' }]}>Clarity: {pct}</Text>
          <Text style={[st.verdict, { color: isAlmost ? '#FFB347' : '#EF4444' }]}>
            {isFail ? 'Say it like you mean it.' : attemptCount >= 3 ? 'Say it like you mean it.' : 'Not clear enough.'}
          </Text>
        </View>
      )}
      {attemptCount >= 3 && alarmState === 'idle' && !typingMode && (
        <TouchableOpacity onPress={() => setTypingMode(true)} style={st.fallbackBtn}><Text style={st.fallbackText}>I can't speak</Text></TouchableOpacity>
      )}
      {typingMode && (
        <View style={st.typingArea}>
          <Text style={st.typingHint}>Type your phrase exactly:</Text>
          <TextInput style={st.typingInput} value={typedText} onChangeText={setTypedText} autoFocus placeholderTextColor="#444" />
          <TouchableOpacity style={st.typingSubmit} onPress={submitTyped}><Text style={st.typingSubmitText}>Submit</Text></TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0A', alignItems: 'center', justifyContent: 'center', padding: 24 },
  attemptBadge: { position: 'absolute', top: 60, right: 24, color: '#666', fontSize: 13, fontWeight: '600' },
  clock: { color: '#FFFFFF', fontSize: 64, fontWeight: '900', letterSpacing: -2 },
  wakeLabel: { color: '#888', fontSize: 14, fontWeight: '700', letterSpacing: 4, marginTop: 4 },
  divider: { width: 40, height: 1, backgroundColor: '#222', marginVertical: 32 },
  phrase: { color: '#FFFFFF', fontSize: 26, fontWeight: '800', textAlign: 'center', paddingHorizontal: 32, lineHeight: 36 },
  hint: { color: '#888', fontSize: 14, fontWeight: '500', marginTop: 12 },
  btn: { backgroundColor: '#6C63FF', paddingVertical: 22, paddingHorizontal: 44, borderRadius: 50, marginTop: 48 },
  btnRec: { backgroundColor: '#EF4444', paddingVertical: 22, paddingHorizontal: 44, borderRadius: 50, marginTop: 48 },
  btnProc: { backgroundColor: '#333', paddingVertical: 22, paddingHorizontal: 44, borderRadius: 50, marginTop: 48 },
  btnText: { color: '#FFFFFF', fontSize: 20, fontWeight: '800' },
  resultArea: { alignItems: 'center', marginTop: 32, gap: 6 },
  resultLine: { color: '#AAA', fontSize: 16, fontWeight: '600' },
  matchPct: { fontSize: 22, fontWeight: '700' },
  verdict: { fontSize: 16, fontWeight: '600', marginTop: 4 },
  successTitle: { color: '#22C55E', fontSize: 28, fontWeight: '900', marginTop: 16 },
  successSub: { color: '#888', fontSize: 16, fontWeight: '500', marginTop: 8 },
  streakText: { color: '#6C63FF', fontSize: 18, fontWeight: '700', marginTop: 16 },
  fallbackBtn: { marginTop: 24 },
  fallbackText: { color: '#444', fontSize: 13, fontWeight: '500', textDecorationLine: 'underline' },
  typingArea: { marginTop: 24, width: '100%', alignItems: 'center' },
  typingHint: { color: '#888', fontSize: 13, fontWeight: '600', marginBottom: 8 },
  typingInput: { backgroundColor: '#1A1A1A', color: '#FFF', fontSize: 16, fontWeight: '600', borderRadius: 12, padding: 14, width: '100%', borderWidth: 1, borderColor: '#333' },
  typingSubmit: { backgroundColor: '#6C63FF', paddingVertical: 12, paddingHorizontal: 32, borderRadius: 50, marginTop: 12 },
  typingSubmitText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
});
