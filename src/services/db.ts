import { openDB, type IDBPDatabase } from 'idb';
import { DEFAULT_SETTINGS, type Settings, type Session, type PBRecord, type Competition } from '../types.js';

const DB_NAME = 'nereus';
const DB_VERSION = 2;

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          if (!db.objectStoreNames.contains('settings')) {
            db.createObjectStore('settings');
          }
          if (!db.objectStoreNames.contains('sessions')) {
            const store = db.createObjectStore('sessions', { keyPath: 'id' });
            store.createIndex('date', 'date');
            store.createIndex('type', 'type');
          }
          if (!db.objectStoreNames.contains('pb-history')) {
            const store = db.createObjectStore('pb-history', {
              keyPath: 'date',
            });
            store.createIndex('date', 'date');
          }
        }
        if (oldVersion < 2) {
          if (!db.objectStoreNames.contains('competitions')) {
            const store = db.createObjectStore('competitions', { keyPath: 'id' });
            store.createIndex('date', 'date');
          }
        }
      },
    });
  }
  return dbPromise;
}

// Settings
export async function getSettings(): Promise<Settings> {
  const db = await getDB();
  const stored = await db.get('settings', 'main');
  return { ...DEFAULT_SETTINGS, ...stored };
}

export async function saveSettings(settings: Partial<Settings>): Promise<void> {
  const db = await getDB();
  const current = await getSettings();
  await db.put('settings', { ...current, ...settings }, 'main');
}

// Sessions
export async function saveSession(session: Session): Promise<void> {
  const db = await getDB();
  await db.put('sessions', session);
}

export async function getSessions(limit = 50): Promise<Session[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex('sessions', 'date');
  return all.reverse().slice(0, limit);
}

export async function getSessionsByType(
  type: string,
  limit = 50,
): Promise<Session[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex('sessions', 'type', type);
  return all.reverse().slice(0, limit);
}

export async function deleteSession(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('sessions', id);
}

// PB History
export async function savePB(record: PBRecord): Promise<void> {
  const db = await getDB();
  await db.put('pb-history', record);
}

export async function getPBHistory(): Promise<PBRecord[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex('pb-history', 'date');
  return all;
}

export async function deletePBRecord(date: number): Promise<void> {
  const db = await getDB();
  await db.delete('pb-history', date);
}

// Competitions
export async function saveCompetition(competition: Competition): Promise<void> {
  const db = await getDB();
  await db.put('competitions', competition);
}

export async function getCompetitions(limit = 100): Promise<Competition[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex('competitions', 'date');
  return all.reverse().slice(0, limit);
}

export async function deleteCompetition(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('competitions', id);
}

// Reset (for testing)
export async function clearAllData(): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(['settings', 'sessions', 'pb-history', 'competitions'], 'readwrite');
  await Promise.all([
    tx.objectStore('settings').clear(),
    tx.objectStore('sessions').clear(),
    tx.objectStore('pb-history').clear(),
    tx.objectStore('competitions').clear(),
    tx.done,
  ]);
}

// Allow resetting the db promise (for tests)
export function _resetDB(): void {
  dbPromise = null;
}
