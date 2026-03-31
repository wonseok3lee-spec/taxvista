import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const REMINDER_KEY = 'wiring:reminder_notif_id';
const CH = 'wiring-alarm';

export async function initNotifications(): Promise<boolean> {
  try {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') return false;
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CH, {
        name: 'Wiring Alarm', importance: Notifications.AndroidImportance.MAX,
        sound: 'default', vibrationPattern: [0, 500, 200, 500],
        enableVibrate: true, lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC, bypassDnd: true,
      });
    }
    return true;
  } catch { return false; }
}

export async function scheduleAlarm(
  hour: number, minute: number, phrase: string, alarmId: string,
  statementId?: string, repeatDaily: boolean = true,
): Promise<string> {
  // Input validation
  if (hour === undefined || hour === null) throw new Error('Alarm hour is missing');
  if (minute === undefined || minute === null) throw new Error('Alarm minute is missing');

  try {
    let text = phrase;
    if (!text && statementId) {
      try { const { getStatementById } = require('./statementStorage'); const s = await getStatementById(statementId); if (s) text = s.text; } catch {}
    }
    if (!text) throw new Error('Alarm phrase is missing');

    // Cancel existing notifications for this alarm
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const n of scheduled) { if (n.content.data?.alarmId === alarmId) await Notifications.cancelScheduledNotificationAsync(n.identifier); }

    return await Notifications.scheduleNotificationAsync({
      content: {
        title: 'WAKE UP.', body: 'You said you would show up.', sound: 'default',
        data: { type: 'wiring-alarm', alarmId, phrase: text },
        sticky: true, priority: 'max', categoryIdentifier: 'alarm',
        ...(Platform.OS === 'android' ? { channelId: CH } : {}),
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.CALENDAR, hour, minute, second: 0, repeats: repeatDaily },
    });
  } catch { return ''; }
}

export async function cancelAlarmById(alarmId: string): Promise<void> {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const n of scheduled) { if (n.content.data?.alarmId === alarmId) await Notifications.cancelScheduledNotificationAsync(n.identifier); }
  } catch {}
}

export async function cancelAlarm(notifId: string): Promise<void> {
  try { if (notifId) await Notifications.cancelScheduledNotificationAsync(notifId); } catch {}
}

export async function scheduleDailyReminder(): Promise<void> {
  try {
    const existing = await AsyncStorage.getItem(REMINDER_KEY);
    if (existing) { try { await Notifications.cancelScheduledNotificationAsync(existing); } catch {} }
    const id = await Notifications.scheduleNotificationAsync({
      content: { title: 'Tomorrow starts now.', body: 'Set your intention for the morning.', sound: 'default', data: { type: 'wiring-reminder' }, ...(Platform.OS === 'android' ? { channelId: CH } : {}) },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.CALENDAR, hour: 21, minute: 0, second: 0, repeats: true },
    });
    await AsyncStorage.setItem(REMINDER_KEY, id);
  } catch {}
}

export async function cancelDailyReminder(): Promise<void> {
  try {
    const id = await AsyncStorage.getItem(REMINDER_KEY);
    if (id) { await Notifications.cancelScheduledNotificationAsync(id); await AsyncStorage.removeItem(REMINDER_KEY); }
  } catch {}
}
