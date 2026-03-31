import AsyncStorage from '@react-native-async-storage/async-storage';

const PHRASES_KEY = 'wiring:user_phrases';
const ONBOARDED_KEY = 'wiring:onboarded';

export async function loadUserPhrases(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(PHRASES_KEY);
    if (raw) { const parsed = JSON.parse(raw); if (Array.isArray(parsed) && parsed.length) return parsed; }
  } catch {}
  return [];
}

export async function saveUserPhrases(phrases: string[]): Promise<void> {
  try { await AsyncStorage.setItem(PHRASES_KEY, JSON.stringify(phrases.filter(p => p.trim()))); } catch {}
}

export async function isOnboarded(): Promise<boolean> {
  try { return (await AsyncStorage.getItem(ONBOARDED_KEY)) === 'true'; } catch { return false; }
}

export async function setOnboarded(): Promise<void> {
  try { await AsyncStorage.setItem(ONBOARDED_KEY, 'true'); } catch {}
}
