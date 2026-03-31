import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import * as Notifications from 'expo-notifications';
import { getLang, getStrings } from './lib/i18n';
import { Alarm, loadAlarms, saveAlarms, migratePhrasesToStatements } from './lib/alarmStorage';
import { initNotifications, scheduleAlarm } from './lib/alarmScheduler';
import { isOnboarded } from './lib/userPhrases';
import OnboardingScreen from './screens/OnboardingScreen';
import HomeScreen from './screens/HomeScreen';
import AlarmWizard from './screens/AlarmWizard';
// import AddAlarmScreen from './screens/AddAlarmScreen'; // backup
import VoiceTestScreen from './screens/VoiceTestScreen';
import EditPhrasesScreen from './screens/EditPhrasesScreen';
import PermissionsScreen from './screens/PermissionsScreen';
import AlarmScreen from './app/alarm';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: false, shouldShowBanner: true, shouldShowList: true }),
});

type Screen =
  | { name: 'home' }
  | { name: 'onboarding' }
  | { name: 'permissions' }
  | { name: 'add'; alarm: Alarm | null; prefillPhrase?: string }
  | { name: 'voiceTest'; phrase?: string }
  | { name: 'editPhrases' }
  | { name: 'alarm'; alarm: Alarm };

async function reRegisterAlarms() {
  try {
    const alarms = await loadAlarms();
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    let changed = false;
    for (const alarm of alarms) {
      if (!alarm.enabled) continue;
      const exists = alarm.notifId && scheduled.some(n => n.identifier === alarm.notifId);
      if (!exists) { alarm.notifId = await scheduleAlarm(alarm.hour, alarm.minute, alarm.phrase, alarm.id, alarm.statementId, alarm.repeatDaily); changed = true; }
    }
    if (changed) await saveAlarms(alarms);
  } catch {}
}

export default function App() {
  const lang = getLang();
  const u = getStrings(lang);
  const [screen, setScreen] = useState<Screen>({ name: 'home' });
  const [refreshKey, setRefreshKey] = useState(0);
  const [ready, setReady] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [showAlarm, setShowAlarm] = useState(false);
  const [activeAlarmPhrase, setActiveAlarmPhrase] = useState('');

  function handleNotifTap(d: any) {
    if (d?.type === 'wiring-alarm') { setActiveAlarmPhrase((d.phrase as string) || ''); setShowAlarm(true); }
  }

  useEffect(() => {
    // Check if app was cold-launched from a notification tap
    Notifications.getLastNotificationResponseAsync().then(r => {
      if (r) { try { handleNotifTap(r.notification.request.content.data); } catch {} }
    }).catch(() => {});

    (async () => {
      try { await initNotifications(); } catch {}
      try { await migratePhrasesToStatements(); } catch {}
      try { await reRegisterAlarms(); } catch {}
      const onboarded = await isOnboarded();
      if (!onboarded) setNeedsOnboarding(true);
      setReady(true);
    })();
    // Foreground: alarm fires while app is open → go directly to AlarmScreen
    const fgSub = Notifications.addNotificationReceivedListener((n) => {
      try { const d = n.request.content.data; if (d?.type === 'wiring-alarm') handleNotifTap(d); } catch {}
    });
    // Background/killed: user taps notification → go to AlarmScreen
    const tapSub = Notifications.addNotificationResponseReceivedListener((r) => {
      try { handleNotifTap(r.notification.request.content.data); } catch {}
    });
    return () => { fgSub.remove(); tapSub.remove(); };
  }, []);

  function goHome() { setRefreshKey(k => k + 1); setScreen({ name: 'home' }); setShowAlarm(false); setNeedsOnboarding(false); }

  // Notification tap → alarm screen immediately, skip everything else
  if (showAlarm && activeAlarmPhrase) {
    return <AlarmScreen phrase={activeAlarmPhrase} lang={lang} onDismiss={goHome} />;
  }
  if (!ready) {
    return (<View style={st.splash}><Text style={st.splashTitle}>Wiring</Text><ActivityIndicator size="small" color="#6C63FF" style={{ marginTop: 16 }} /></View>);
  }
  if (needsOnboarding) {
    return <OnboardingScreen onComplete={() => { setNeedsOnboarding(false); setScreen({ name: 'permissions' }); }} />;
  }
  if (screen.name === 'permissions') {
    return <PermissionsScreen onDone={goHome} />;
  }
  if (screen.name === 'alarm') {
    return <AlarmScreen phrase={screen.alarm.phrase} lang={lang} intensity={screen.alarm.intensity} vibration={screen.alarm.vibration} onDismiss={goHome} />;
  }
  if (screen.name === 'add') {
    return <AlarmWizard u={u} existing={screen.alarm} prefillPhrase={screen.prefillPhrase} onDone={goHome} onTryPhrase={(p: string) => setScreen({ name: 'voiceTest', phrase: p })} />;
  }
  if (screen.name === 'voiceTest') {
    return <VoiceTestScreen u={u} lang={lang} initialPhrase={screen.phrase} onBack={goHome} />;
  }
  if (screen.name === 'editPhrases') {
    return <EditPhrasesScreen onDone={goHome} />;
  }
  return (
    <HomeScreen u={u} refreshKey={refreshKey} onAdd={() => setScreen({ name: 'add', alarm: null })} onEdit={(a) => setScreen({ name: 'add', alarm: a })} onSettings={() => setScreen({ name: 'editPhrases' })} />
  );
}

const st = StyleSheet.create({
  splash: { flex: 1, backgroundColor: '#0A0A0A', alignItems: 'center', justifyContent: 'center' },
  splashTitle: { color: '#fff', fontSize: 32, fontWeight: 'bold' },
});
