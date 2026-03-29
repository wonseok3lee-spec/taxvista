import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  PHRASE: 'wiring:phrase',
  STREAK: 'wiring:streak',
};

export async function savePhrase(phrase: string): Promise<void> {
  await AsyncStorage.setItem(KEYS.PHRASE, phrase);
}

export async function loadPhrase(): Promise<string | null> {
  return AsyncStorage.getItem(KEYS.PHRASE);
}

export async function loadStreak(): Promise<number> {
  const val = await AsyncStorage.getItem(KEYS.STREAK);
  return val ? parseInt(val, 10) : 0;
}

export async function incrementStreak(): Promise<number> {
  const current = await loadStreak();
  const next = current + 1;
  await AsyncStorage.setItem(KEYS.STREAK, String(next));
  return next;
}

export async function resetStreak(): Promise<void> {
  await AsyncStorage.setItem(KEYS.STREAK, '0');
}