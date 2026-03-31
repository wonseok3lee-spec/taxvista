import * as Notifications from 'expo-notifications';
import { Audio } from 'expo-av';

type Status = 'granted' | 'denied' | 'undetermined';

function normalize(status: string): Status {
  return status === 'provisional' ? 'granted' : status as Status;
}

export async function checkNotificationPermission(): Promise<Status> {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    return normalize(status);
  } catch { return 'denied'; }
}

export async function requestNotificationPermission(): Promise<boolean> {
  try {
    const { status } = await Notifications.requestPermissionsAsync();
    return normalize(status) === 'granted';
  } catch { return false; }
}

export async function checkMicrophonePermission(): Promise<Status> {
  try {
    const { status } = await Audio.getPermissionsAsync();
    return status as Status;
  } catch { return 'denied'; }
}

export async function requestMicrophonePermission(): Promise<boolean> {
  try {
    const { status } = await Audio.requestPermissionsAsync();
    return status === 'granted';
  } catch { return false; }
}

export async function checkAllPermissions(): Promise<{ notifications: Status; microphone: Status }> {
  const [notifications, microphone] = await Promise.all([
    checkNotificationPermission(),
    checkMicrophonePermission(),
  ]);
  return { notifications, microphone };
}

export async function areAllPermissionsGranted(): Promise<boolean> {
  const { notifications, microphone } = await checkAllPermissions();
  return notifications === 'granted' && microphone === 'granted';
}
