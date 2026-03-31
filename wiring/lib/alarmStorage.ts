import AsyncStorage from '@react-native-async-storage/async-storage';

export type Vibration = 'off' | 'light' | 'strong';

export type RepeatType = 'daily' | 'weekdays' | 'once' | 'custom';

export interface Alarm {
  id: string;
  hour: number;
  minute: number;
  enabled: boolean;
  phrase: string;
  repeatDaily: boolean;
  repeatType?: RepeatType;
  repeatDays?: number[];
  intensity: number;
  vibration: Vibration;
  statementId?: string;
  notifId?: string;
}

const ALARMS_KEY = 'wiring:alarms';

function migrateIntensity(v: any): number {
  if (typeof v === 'number') {
    if (v >= 0 && v <= 4) return v;
    if (v === 5) return 4;
    return Math.max(0, Math.min(4, Math.round(v)));
  }
  if (v === 'low') return 1;
  if (v === 'high') return 4;
  return 2;
}

function timeKey(a: { hour: number; minute: number }) { return `${a.hour}:${a.minute}`; }

function dedupe(alarms: Alarm[]): Alarm[] {
  const seen = new Set<string>();
  return alarms.filter(a => {
    const k = timeKey(a);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export async function loadAlarms(): Promise<Alarm[]> {
  try {
    const raw = await AsyncStorage.getItem(ALARMS_KEY);
    if (!raw) return [];
    const parsed: Alarm[] = (JSON.parse(raw) as any[]).map(a => ({
      ...a,
      intensity: migrateIntensity(a.intensity),
      vibration: a.vibration ?? (a.loudMode ? 'strong' : 'light'),
    }));
    const cleaned = dedupe(parsed);
    if (cleaned.length < parsed.length) await AsyncStorage.setItem(ALARMS_KEY, JSON.stringify(cleaned));
    return cleaned;
  } catch { return []; }
}

export async function saveAlarms(alarms: Alarm[]): Promise<void> {
  try { await AsyncStorage.setItem(ALARMS_KEY, JSON.stringify(dedupe(alarms))); } catch {}
}

export function hasDuplicate(alarms: Alarm[], hour: number, minute: number, excludeId?: string): boolean {
  return alarms.some(a => a.hour === hour && a.minute === minute && a.id !== excludeId);
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

export async function ensureAlarmPhrase(alarm: Alarm): Promise<void> {
  try {
    if (alarm.statementId && !alarm.phrase?.trim()) {
      const { getStatementById } = require('./statementStorage');
      const stmt = await getStatementById(alarm.statementId);
      if (stmt) alarm.phrase = stmt.text;
    }
    if (alarm.phrase?.trim() && !alarm.statementId) {
      const { loadStatements, saveStatement } = require('./statementStorage');
      const all = await loadStatements();
      const norm = (s: string) => s.toLowerCase().trim();
      const match = all.find((s: any) => norm(s.text) === norm(alarm.phrase));
      if (match) { alarm.statementId = match.id; }
      else { const stmt = await saveStatement(alarm.phrase.trim()); alarm.statementId = stmt.id; }
    }
  } catch {}
}

const MIGRATE_FLAG = 'wiring:migrated_statements_v1';

export async function migratePhrasesToStatements(): Promise<void> {
  try {
    const done = await AsyncStorage.getItem(MIGRATE_FLAG);
    if (done === 'true') return;
    const { loadUserPhrases } = require('./userPhrases');
    const { loadStatements, saveStatement } = require('./statementStorage');
    const alarms = await loadAlarms();
    const userPhrases: string[] = await loadUserPhrases();
    const existing = await loadStatements();
    const norm = (s: string) => s.toLowerCase().trim();
    const textToId = new Map<string, string>();
    for (const s of existing) textToId.set(norm(s.text), s.id);
    const allTexts = new Set<string>();
    for (const p of userPhrases) if (p.trim()) allTexts.add(p.trim());
    for (const a of alarms) if (a.phrase?.trim()) allTexts.add(a.phrase.trim());
    for (const text of allTexts) {
      if (!textToId.has(norm(text))) {
        const stmt = await saveStatement(text);
        textToId.set(norm(text), stmt.id);
      }
    }
    let changed = false;
    for (const a of alarms) {
      if (a.phrase?.trim() && !a.statementId) {
        const sid = textToId.get(norm(a.phrase));
        if (sid) { a.statementId = sid; changed = true; }
      }
    }
    if (changed) await saveAlarms(alarms);
    await AsyncStorage.setItem(MIGRATE_FLAG, 'true');
  } catch {}
}

export function getTimezoneAbbr(): string {
  try {
    const short = new Date().toLocaleTimeString('en', { timeZoneName: 'short' }).split(' ').pop();
    return short ?? '';
  } catch { return ''; }
}
