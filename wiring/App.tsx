import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import * as Notifications from 'expo-notifications';
import { getLang, getStrings } from './lib/i18n';
import { Alarm, loadAlarms, saveAlarms } from './lib/alarmStorage';
import { initNotifications, scheduleAlarm } from './lib/alarmScheduler';
import HomeScreen from './screens/HomeScreen';
import AddAlarmScreen from './screens/AddAlarmScreen';
import VoiceTestScreen from './screens/VoiceTestScreen';
import AlarmScreen from './app/alarm';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

type Screen =
  | { name: 'home' }
  | { name: 'add'; alarm: Alarm | null }
  | { name: 'voiceTest'; phrase?: string }
  | { name: 'alarm'; alarm: Alarm };

async function reRegisterAlarms() {
  try {
    const alarms = await loadAlarms();
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    let changed = false;
    for (const alarm of alarms) {
      if (!alarm.enabled) continue;
      const exists = alarm.notifId && scheduled.some(n => n.identifier === alarm.notifId);
      if (!exists) {
        alarm.notifId = await scheduleAlarm(alarm.hour, alarm.minute, alarm.phrase, alarm.id);
        changed = true;
      }
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
  const [showAlarm, setShowAlarm] = useState(false);
  const [activeAlarmPhrase, setActiveAlarmPhrase] = useState('');

  useEffect(() => {
    (async () => {
      try { await initNotifications(); } catch {}
      try { await reRegisterAlarms(); } catch {}
      setReady(true);
    })();

    const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
      try {
        const data = response.notification.request.content.data;
        if (data?.type === 'wiring-alarm') {
          setActiveAlarmPhrase((data.phrase as string) || '');
          setShowAlarm(true);
        }
      } catch {}
    });

    return () => responseSub.remove();
  }, []);

  function goHome() { setRefreshKey(k => k + 1); setScreen({ name: 'home' }); setShowAlarm(false); }

  if (!ready) {
    return (
      <View style={styles.splash}>
        <Text style={styles.splashTitle}>Wiring</Text>
        <ActivityIndicator size="small" color="#6C63FF" style={{ marginTop: 16 }} />
      </View>
    );
  }

  if (showAlarm && activeAlarmPhrase) {
    return <AlarmScreen phrase={activeAlarmPhrase} lang={lang} onDismiss={goHome} />;
  }

  if (screen.name === 'alarm') {
    return <AlarmScreen phrase={screen.alarm.phrase} lang={lang} intensity={screen.alarm.intensity} vibration={screen.alarm.vibration} onDismiss={goHome} />;
  }
  if (screen.name === 'add') {
    return <AddAlarmScreen u={u} existing={screen.alarm} onDone={goHome} onTryPhrase={(phrase) => setScreen({ name: 'voiceTest', phrase })} />;
  }
  if (screen.name === 'voiceTest') {
    return <VoiceTestScreen u={u} lang={lang} initialPhrase={screen.phrase} onBack={goHome} />;
  }
  return (
    <HomeScreen u={u} lang={lang} refreshKey={refreshKey} onAdd={() => setScreen({ name: 'add', alarm: null })} onEdit={(alarm) => setScreen({ name: 'add', alarm })} />
  );
}

const styles = StyleSheet.create({
  splash: { flex: 1, backgroundColor: '#0A0A0A', alignItems: 'center', justifyContent: 'center' },
  splashTitle: { color: '#fff', fontSize: 32, fontWeight: 'bold' },
});
