import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

export async function initNotifications(): Promise<boolean> {
  try {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') return false;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('wiring-alarm', {
        name: 'Wiring Alarm',
        importance: Notifications.AndroidImportance.MAX,
        sound: 'default',
        vibrationPattern: [0, 500, 200, 500],
        enableVibrate: true,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        bypassDnd: true,
      });
    }
    return true;
  } catch { return false; }
}

export async function scheduleAlarm(
  hour: number, minute: number, phrase: string, alarmId: string,
): Promise<string> {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const n of scheduled) {
      if (n.content.data?.alarmId === alarmId) {
        await Notifications.cancelScheduledNotificationAsync(n.identifier);
      }
    }

    const notifId = await Notifications.scheduleNotificationAsync({
      content: {
        title: '⏰ Wiring',
        body: `"${phrase}" — Say it to start your day`,
        sound: 'default',
        data: { type: 'wiring-alarm', alarmId, phrase },
        sticky: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
        hour,
        minute,
        second: 0,
        repeats: true,
      },
    });
    return notifId;
  } catch { return ''; }
}

export async function cancelAlarm(notifId: string): Promise<void> {
  try { if (notifId) await Notifications.cancelScheduledNotificationAsync(notifId); } catch {}
}

export async function cancelAlarmById(alarmId: string): Promise<void> {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const n of scheduled) {
      if (n.content.data?.alarmId === alarmId) {
        await Notifications.cancelScheduledNotificationAsync(n.identifier);
      }
    }
  } catch {}
}
