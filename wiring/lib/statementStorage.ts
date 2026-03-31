import AsyncStorage from '@react-native-async-storage/async-storage';
import { loadUserPhrases } from './userPhrases';

export interface Statement {
  id: string;
  text: string;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

const KEY = 'wiring:statements';
const MIGRATED_KEY = 'wiring:statements_migrated';

function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function now(): string { return new Date().toISOString(); }

async function loadAll(): Promise<Statement[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) { const parsed = JSON.parse(raw); if (Array.isArray(parsed) && parsed.length) return parsed; }
  } catch {}
  return [];
}

async function saveAll(statements: Statement[]): Promise<void> {
  try { await AsyncStorage.setItem(KEY, JSON.stringify(statements)); } catch {}
}

async function migrate(): Promise<void> {
  try {
    const done = await AsyncStorage.getItem(MIGRATED_KEY);
    if (done === 'true') return;
    const phrases = await loadUserPhrases();
    if (phrases.length) {
      const existing = await loadAll();
      const seen = new Set(existing.map(s => s.text.toLowerCase().trim()));
      const newStmts = phrases.filter(p => p.trim() && !seen.has(p.toLowerCase().trim())).map(text => ({ id: genId(), text, isArchived: false, createdAt: now(), updatedAt: now() }));
      if (newStmts.length) await saveAll([...existing, ...newStmts]);
    }
    await AsyncStorage.setItem(MIGRATED_KEY, 'true');
  } catch {}
}

export async function loadStatements(): Promise<Statement[]> {
  await migrate();
  const all = await loadAll();
  return all.filter(s => !s.isArchived);
}

export async function loadAllStatements(): Promise<Statement[]> {
  await migrate();
  return await loadAll();
}

export async function saveStatement(text: string): Promise<Statement> {
  const stmt: Statement = { id: genId(), text: text.trim(), isArchived: false, createdAt: now(), updatedAt: now() };
  const all = await loadAll();
  all.push(stmt);
  await saveAll(all);
  return stmt;
}

export async function updateStatement(id: string, text: string): Promise<void> {
  const all = await loadAll();
  const s = all.find(x => x.id === id);
  if (s) { s.text = text.trim(); s.updatedAt = now(); await saveAll(all); }
}

export async function archiveStatement(id: string): Promise<void> {
  const all = await loadAll();
  const s = all.find(x => x.id === id);
  if (s) { s.isArchived = true; s.updatedAt = now(); await saveAll(all); }
}

export async function deleteStatement(id: string): Promise<void> {
  const all = await loadAll();
  await saveAll(all.filter(x => x.id !== id));
}

export async function getStatementById(id: string): Promise<Statement | null> {
  const all = await loadAll();
  return all.find(x => x.id === id) ?? null;
}
