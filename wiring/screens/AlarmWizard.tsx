import { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, BackHandler, Alert } from 'react-native';
import { Alarm, Vibration as VibType, generateId, formatTime, loadAlarms, saveAlarms, deleteAlarm, hasDuplicate } from '../lib/alarmStorage';
import { scheduleAlarm, cancelAlarmById } from '../lib/alarmScheduler';
import { UIStrings } from '../lib/i18n';
import StepTime from './wizard/StepTime';
import StepStatement from './wizard/StepStatement';
import StepPressure from './wizard/StepPressure';
import StepReview from './wizard/StepReview';

const LABELS = ['TIME', 'PROOF', 'PRESSURE', 'LOCK'];

interface Props { u: UIStrings; existing: Alarm | null; prefillPhrase?: string; onDone: () => void; onTryPhrase: (phrase: string) => void }

export default function AlarmWizard({ u, existing, prefillPhrase, onDone, onTryPhrase }: Props) {
  const is24 = existing ? existing.hour : 7;
  const [step, setStep] = useState(1);
  const [hour12, setHour12] = useState(is24 % 12 || 12);
  const [minute, setMinute] = useState(existing?.minute ?? 0);
  const [isPM, setIsPM] = useState(is24 >= 12);
  const [phrase, setPhrase] = useState(existing?.phrase ?? prefillPhrase ?? '');
  const [statementId, setStatementId] = useState<string | null>(existing?.statementId ?? null);
  const [intensity, setIntensity] = useState(existing?.intensity ?? 2);
  const [vibration, setVibration] = useState<VibType>(existing?.vibration ?? 'light');
  const [repeatDaily, setRepeatDaily] = useState(existing?.repeatDaily ?? true);
  const [showConfirm, setShowConfirm] = useState(false);
  const savingRef = useRef(false);

  useEffect(() => { const s = BackHandler.addEventListener('hardwareBackPress', () => { goBack(); return true; }); return () => s.remove(); }, [step]);

  function goBack() { step > 1 ? setStep(s => s - 1 as any) : onDone(); }
  function to24(h: number, pm: boolean) { return h === 12 ? (pm ? 12 : 0) : pm ? h + 12 : h; }
  function timeLabel() { return formatTime(to24(hour12, isPM), minute); }

  function handleNext() {
    if (step === 2 && phrase) { setShowConfirm(true); return; }
    setStep(s => Math.min(s + 1, 4) as any);
  }

  async function handleSave() {
    if (savingRef.current) return;
    savingRef.current = true;
    let savedId: string | null = null;
    try {
      const id = existing?.id ?? generateId();
      const h = to24(hour12, isPM);
      const all = await loadAlarms();
      if (hasDuplicate(all, h, minute, id)) { Alert.alert('Already scheduled.', 'Show up tomorrow.'); return; }
      // FIX 2: Resolve + null guard
      let resolvedPhrase = phrase;
      if (statementId) {
        const { getStatementById } = require('../lib/statementStorage');
        const stmt = await getStatementById(statementId);
        if (!stmt || !stmt.text) { Alert.alert('Statement missing. Go back and select one.'); return; }
        resolvedPhrase = stmt.text;
      }
      if (!resolvedPhrase?.trim()) { Alert.alert('No statement selected.'); return; }
      const alarm: Alarm = { id, hour: h, minute, enabled: existing?.enabled ?? true, phrase: resolvedPhrase, statementId: statementId ?? undefined, repeatDaily, intensity, vibration };
      // Save to storage first
      await cancelAlarmById(id);
      const idx = all.findIndex(a => a.id === alarm.id);
      if (idx >= 0) all[idx] = alarm; else all.push(alarm);
      await saveAlarms(all);
      savedId = alarm.id;
      // Schedule with OS second
      if (alarm.enabled && alarm.phrase) {
        alarm.notifId = await scheduleAlarm(alarm.hour, alarm.minute, alarm.phrase, alarm.id, alarm.statementId, alarm.repeatDaily);
        await saveAlarms(all);
      }
      onDone();
    } catch {
      // FIX 1: Rollback on schedule failure
      if (savedId) { try { await deleteAlarm(savedId); } catch {} }
      Alert.alert('Could not save alarm. Try again.');
    } finally { savingRef.current = false; }
  }

  function handleDelete() {
    if (!existing) return;
    Alert.alert('Delete this alarm?', "This can't be undone.", [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => { cancelAlarmById(existing.id).catch(() => {}); deleteAlarm(existing.id).then(() => onDone()); } },
    ]);
  }

  const ctaLabels: Record<number, string> = { 1: `I'll show up at ${timeLabel()}`, 2: "This is what I'll prove", 3: 'Make it unavoidable' };

  // Confirmation overlay after step 2
  if (showConfirm) {
    return (
      <View style={st.overlay}>
        <Text style={st.overlayPhrase}>{phrase}</Text>
        <Text style={st.overlayHint}>You will be required to say this out loud.</Text>
        <TouchableOpacity style={st.cta} onPress={() => { setShowConfirm(false); setStep(3); }}><Text style={st.ctaText}>I commit</Text></TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={st.container}>
      <View style={st.header}>
        <TouchableOpacity onPress={goBack} style={st.backBtn}><Text style={st.backText}>Back</Text></TouchableOpacity>
        <Text style={st.stepLabel}>{step}/4 {LABELS[step - 1]}</Text>
      </View>
      <View style={st.progress}>{LABELS.map((_, i) => <View key={i} style={[st.bar, i < step && st.barFill]} />)}</View>
      <View style={st.body}>
        {step === 1 && <StepTime hour12={hour12} minute={minute} isPM={isPM} onChange={(h, m, pm) => { setHour12(h); setMinute(m); setIsPM(pm); }} />}
        {step === 2 && <StepStatement selectedId={statementId} onSelect={(id, text) => { setStatementId(id); setPhrase(text); }} onTryPhrase={onTryPhrase} />}
        {step === 3 && <StepPressure intensity={intensity} vibration={vibration} repeatDaily={repeatDaily} onIntensity={setIntensity} onVibration={setVibration} onRepeat={setRepeatDaily} u={u} />}
        {step === 4 && <StepReview hour12={hour12} minute={minute} isPM={isPM} phrase={phrase} intensity={intensity} vibration={vibration} repeatDaily={repeatDaily} onSave={handleSave} isEditing={!!existing} onDelete={handleDelete} />}
      </View>
      {step < 4 && (
        <View style={st.footer}>
          <TouchableOpacity style={st.cta} onPress={handleNext}><Text style={st.ctaText}>{ctaLabels[step]}</Text></TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0A' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingTop: 60, paddingBottom: 8 },
  backBtn: { paddingVertical: 12, paddingHorizontal: 4 },
  backText: { color: '#6C63FF', fontSize: 16, fontWeight: '600' },
  stepLabel: { color: '#555', fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  progress: { flexDirection: 'row', paddingHorizontal: 24, gap: 4, marginBottom: 24 },
  bar: { flex: 1, height: 3, backgroundColor: '#222', borderRadius: 2 },
  barFill: { backgroundColor: '#FFFFFF' },
  body: { flex: 1 },
  footer: { paddingHorizontal: 24, paddingBottom: 40 },
  cta: { backgroundColor: '#6C63FF', paddingVertical: 16, borderRadius: 50, alignItems: 'center' },
  ctaText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  overlay: { flex: 1, backgroundColor: '#0A0A0A', alignItems: 'center', justifyContent: 'center', padding: 32 },
  overlayPhrase: { color: '#FFFFFF', fontSize: 26, fontWeight: '900', textAlign: 'center', marginBottom: 16 },
  overlayHint: { color: '#888', fontSize: 14, fontWeight: '500', fontStyle: 'italic', textAlign: 'center', marginBottom: 40 },
});
