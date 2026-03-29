import { Audio } from 'expo-av';

let sound: Audio.Sound | null = null;

const ALARM_URI = 'https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg';

export async function playAlarmSound(volume: number): Promise<void> {
  try {
    await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, staysActiveInBackground: true });
    if (sound) {
      await sound.setVolumeAsync(volume);
      return;
    }
    const { sound: s } = await Audio.Sound.createAsync(
      { uri: ALARM_URI },
      { isLooping: true, volume, shouldPlay: true },
    );
    sound = s;
  } catch {}
}

export async function stopAlarmSound(): Promise<void> {
  try {
    if (sound) {
      await sound.stopAsync();
      await sound.unloadAsync();
      sound = null;
    }
  } catch {}
}

export function getVolume(attempts: number): number {
  return Math.min(0.4 + attempts * 0.2, 1.0);
}
