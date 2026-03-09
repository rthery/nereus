import { openDB, type IDBPDatabase } from 'idb';
import { DEFAULT_SETTINGS, type Settings, type Session, type PBRecord, type Competition, type BreathingPreset, type BreathingSession, type FreePreset, type FreeSession } from '../types.js';

const DB_NAME = 'nereus';
const DB_VERSION = 6;

let dbPromise: Promise<IDBPDatabase> | null = null;

export function getDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, _newVersion, transaction) {
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
        if (oldVersion < 3) {
          if (!db.objectStoreNames.contains('breathing-sessions')) {
            const store = db.createObjectStore('breathing-sessions', { keyPath: 'id' });
            store.createIndex('date', 'date');
          }
        }
        if (oldVersion < 4) {
          if (!db.objectStoreNames.contains('free-presets')) {
            db.createObjectStore('free-presets', { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains('free-sessions')) {
            const store = db.createObjectStore('free-sessions', { keyPath: 'id' });
            store.createIndex('date', 'date');
          }
        }
        if (oldVersion < 5 && db.objectStoreNames.contains('sessions')) {
          const store = transaction.objectStore('sessions');
          if (!store.indexNames.contains('type-date')) {
            store.createIndex('type-date', ['type', 'date']);
          }
        }
        if (oldVersion < 6) {
          if (!db.objectStoreNames.contains('breathing-presets')) {
            db.createObjectStore('breathing-presets', { keyPath: 'id' });
          }
        }
      },
    });
  }
  return dbPromise;
}

type DateIndexedStore = 'sessions' | 'competitions' | 'breathing-sessions' | 'free-sessions';

async function getLatestByDate<T>(storeName: DateIndexedStore, limit: number): Promise<T[]> {
  const db = await getDB();
  const tx = db.transaction(storeName);
  const index = tx.store.index('date');
  const items: T[] = [];

  let cursor = await index.openCursor(null, 'prev');
  while (cursor && items.length < limit) {
    items.push(cursor.value as T);
    cursor = await cursor.continue();
  }

  await tx.done;
  return items;
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
  return getLatestByDate<Session>('sessions', limit);
}

export async function getSessionsByType(
  type: string,
  limit = 50,
): Promise<Session[]> {
  const db = await getDB();
  const tx = db.transaction('sessions');
  const index = tx.store.index('type-date');
  const range = IDBKeyRange.bound([type, 0], [type, Number.MAX_SAFE_INTEGER]);
  const items: Session[] = [];

  let cursor = await index.openCursor(range, 'prev');
  while (cursor && items.length < limit) {
    items.push(cursor.value as Session);
    cursor = await cursor.continue();
  }

  await tx.done;
  return items;
}

export async function deleteSession(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('sessions', id);
}

/** Returns all sessions whose date falls within today's calendar day. */
export async function getSessionsToday(): Promise<Session[]> {
  const db = await getDB();
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const end = start + 86400000 - 1;
  return db.getAllFromIndex('sessions', 'date', IDBKeyRange.bound(start, end));
}

/** Returns all sessions whose date falls within yesterday's calendar day. */
export async function getSessionsYesterday(): Promise<Session[]> {
  const db = await getDB();
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const start = todayStart - 86400000;
  const end = todayStart - 1;
  return db.getAllFromIndex('sessions', 'date', IDBKeyRange.bound(start, end));
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
  return getLatestByDate<Competition>('competitions', limit);
}

export async function deleteCompetition(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('competitions', id);
}

// Breathing sessions
export async function saveBreathingSession(session: BreathingSession): Promise<void> {
  const db = await getDB();
  await db.put('breathing-sessions', session);
}

export async function getBreathingSessions(limit = 100): Promise<BreathingSession[]> {
  return getLatestByDate<BreathingSession>('breathing-sessions', limit);
}

export async function deleteBreathingSession(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('breathing-sessions', id);
}

// Breathing presets
export async function getBreathingPresets(): Promise<BreathingPreset[]> {
  try {
    const db = await getDB();
    return await db.getAll('breathing-presets');
  } catch { return []; }
}

export async function saveBreathingPreset(preset: BreathingPreset): Promise<void> {
  try {
    const db = await getDB();
    await db.put('breathing-presets', preset);
  } catch { /* store not available yet */ }
}

export async function deleteBreathingPreset(id: string): Promise<void> {
  try {
    const db = await getDB();
    await db.delete('breathing-presets', id);
  } catch { /* store not available yet */ }
}

// Free presets
export async function getFreePresets(): Promise<FreePreset[]> {
  try {
    const db = await getDB();
    return await db.getAll('free-presets');
  } catch { return []; }
}

export async function saveFreePreset(preset: FreePreset): Promise<void> {
  try {
    const db = await getDB();
    await db.put('free-presets', preset);
  } catch { /* store not available yet */ }
}

export async function deleteFreePreset(id: string): Promise<void> {
  try {
    const db = await getDB();
    await db.delete('free-presets', id);
  } catch { /* store not available yet */ }
}

// Free sessions
export async function saveFreeSession(session: FreeSession): Promise<void> {
  try {
    const db = await getDB();
    await db.put('free-sessions', session);
  } catch { /* store not available yet */ }
}

export async function getFreeSessions(limit = 100): Promise<FreeSession[]> {
  try {
    return await getLatestByDate<FreeSession>('free-sessions', limit);
  } catch { return []; }
}

export async function deleteFreeSession(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('free-sessions', id);
}

// Reset (for testing)
export async function clearAllData(): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(['settings', 'sessions', 'pb-history', 'competitions', 'breathing-sessions', 'breathing-presets', 'free-presets', 'free-sessions'], 'readwrite');
  await Promise.all([
    tx.objectStore('settings').clear(),
    tx.objectStore('sessions').clear(),
    tx.objectStore('pb-history').clear(),
    tx.objectStore('competitions').clear(),
    tx.objectStore('breathing-sessions').clear(),
    tx.objectStore('breathing-presets').clear(),
    tx.objectStore('free-presets').clear(),
    tx.objectStore('free-sessions').clear(),
    tx.done,
  ]);
}

// Allow resetting the db promise (for tests)
export function _resetDB(): void {
  dbPromise = null;
}
