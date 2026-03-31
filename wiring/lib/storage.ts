import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = { PHRASE: 'wiring:phrase', STREAK: 'wiring:streak', LAST_SUCCESS: 'wiring:last_success' };

export async function savePhrase(phrase: string): Promise<void> { try { await AsyncStorage.setItem(KEYS.PHRASE, phrase); } catch {} }
export async function loadPhrase(): Promise<string | null> { try { return AsyncStorage.getItem(KEYS.PHRASE); } catch { return null; } }

export async function loadStreak(): Promise<number> {
  try { const val = await AsyncStorage.getItem(KEYS.STREAK); return val ? parseInt(val, 10) : 0; } catch { return 0; }
}

export async function incrementStreak(): Promise<number> {
  try {
    const current = await loadStreak();
    const next = current + 1;
    await AsyncStorage.setItem(KEYS.STREAK, String(next));
    await AsyncStorage.setItem(KEYS.LAST_SUCCESS, new Date().toDateString());
    return next;
  } catch { return 0; }
}

export async function resetStreak(): Promise<void> {
  try { await AsyncStorage.setItem(KEYS.STREAK, '0'); } catch {}
}

export async function checkStreakBroken(): Promise<boolean> {
  try {
    const last = await AsyncStorage.getItem(KEYS.LAST_SUCCESS);
    if (!last) return false;
    const lastDate = new Date(last);
    const now = new Date();
    const diff = Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
    return diff >= 2;
  } catch { return false; }
}
