import { openDB, type IDBPDatabase } from 'idb';
import { DEFAULT_SETTINGS, type Settings, type Session, type PBRecord, type Competition, type BreathingSession, type FreePreset, type FreeSession } from '../types.js';

const DB_NAME = 'nereus';
const DB_VERSION = 4;

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
  const db = await getDB();
  const all = await db.getAllFromIndex('competitions', 'date');
  return all.reverse().slice(0, limit);
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
  const db = await getDB();
  const all = await db.getAllFromIndex('breathing-sessions', 'date');
  return all.reverse().slice(0, limit);
}

export async function deleteBreathingSession(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('breathing-sessions', id);
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
    const db = await getDB();
    const all = await db.getAllFromIndex('free-sessions', 'date');
    return all.reverse().slice(0, limit);
  } catch { return []; }
}

export async function deleteFreeSession(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('free-sessions', id);
}

// Reset (for testing)
export async function clearAllData(): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(['settings', 'sessions', 'pb-history', 'competitions', 'breathing-sessions', 'free-presets', 'free-sessions'], 'readwrite');
  await Promise.all([
    tx.objectStore('settings').clear(),
    tx.objectStore('sessions').clear(),
    tx.objectStore('pb-history').clear(),
    tx.objectStore('competitions').clear(),
    tx.objectStore('breathing-sessions').clear(),
    tx.objectStore('free-presets').clear(),
    tx.objectStore('free-sessions').clear(),
    tx.done,
  ]);
}

// Allow resetting the db promise (for tests)
export function _resetDB(): void {
  dbPromise = null;
}
