import AsyncStorage from '@react-native-async-storage/async-storage';

export type Vibration = 'off' | 'light' | 'strong';

export interface Alarm {
  id: string;
  hour: number;
  minute: number;
  enabled: boolean;
  phrase: string;
  repeatDaily: boolean;
  intensity: number;
  vibration: Vibration;
  notifId?: string;
}

const ALARMS_KEY = 'wiring:alarms';

function migrateIntensity(v: any): number {
  if (typeof v === 'number') return Math.max(1, Math.min(5, v));
  if (v === 'low') return 1;
  if (v === 'high') return 5;
  return 3;
}

export async function loadAlarms(): Promise<Alarm[]> {
  try {
    const raw = await AsyncStorage.getItem(ALARMS_KEY);
    if (!raw) return [];
    return (JSON.parse(raw) as any[]).map(a => ({
      ...a,
      intensity: migrateIntensity(a.intensity),
      vibration: a.vibration ?? (a.loudMode ? 'strong' : 'light'),
    }));
  } catch { return []; }
}

export async function saveAlarms(alarms: Alarm[]): Promise<void> {
  try { await AsyncStorage.setItem(ALARMS_KEY, JSON.stringify(alarms)); } catch {}
}

export async function deleteAlarm(id: string): Promise<Alarm[]> {
  const all = await loadAlarms();
  const filtered = all.filter(a => a.id !== id);
  await saveAlarms(filtered);
  return filtered;
}

export function formatTime(hour: number, minute: number): string {
  const h = hour % 12 || 12;
  const m = minute.toString().padStart(2, '0');
  return `${h}:${m} ${hour < 12 ? 'AM' : 'PM'}`;
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export function getTimezoneAbbr(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const short = new Date().toLocaleTimeString('en', { timeZoneName: 'short' }).split(' ').pop();
    return short ?? tz.split('/').pop()?.replace(/_/g, ' ') ?? '';
  } catch { return ''; }
}
