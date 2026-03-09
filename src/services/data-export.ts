import { getDB, _resetDB } from './db.js';
import type { Settings } from '../types.js';

export interface AppDataExport {
  formatVersion: number;
  dbSchemaVersion: number;
  timestamp: number;
  database: Record<string, any[]>;
  settings: Settings;
}

export async function exportAppData(): Promise<AppDataExport> {
  const db = await getDB();
  // Get the current DB schema version from the database name/version
  const dbSchemaVersion = db.version;
  
  const exportData: AppDataExport = {
    formatVersion: 1,
    dbSchemaVersion: dbSchemaVersion,
    timestamp: Date.now(),
    database: {},
    settings: (await db.get('settings', 'main')) ?? {},
  };

  // Dynamically export all object stores
  const storeNames = Array.from(db.objectStoreNames) as string[];
  const transaction = db.transaction(storeNames, 'readonly');
  
  await Promise.all(storeNames.map(async (storeName) => {
    if (storeName === 'settings') return; // Skip settings, handled separately
    
    try {
      const store = transaction.objectStore(storeName);
      const allItems = await store.getAll();
      exportData.database[storeName] = allItems;
    } catch (error) {
      console.warn(`Failed to export store ${storeName}:`, error);
      exportData.database[storeName] = [];
    }
  }));

  await transaction.done;
  return exportData;
}

export function downloadAppData(exportData: AppDataExport, filename: string = 'nereus-backup.json'): void {
  // Add timestamp to filename if not provided
  const timestamp = new Date(exportData.timestamp);
  const formattedDate = timestamp.toISOString().replace(/[:.]/g, '-');
  const finalFilename = filename.replace('.json', `-${formattedDate}.json`);
  
  const jsonStr = JSON.stringify(exportData, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = finalFilename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function importAppData(file: File): Promise<void> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = async (event) => {
      try {
        const content = event.target?.result;
        if (!content || typeof content !== 'string') {
          throw new Error('Invalid file content');
        }

        const data = JSON.parse(content) as AppDataExport;
        
        // Validate the structure
        if (!data || !data.database) {
          throw new Error('Invalid backup file structure');
        }
        
        // Check format version compatibility
        if (data.formatVersion !== 1) {
          throw new Error(`Unsupported backup format version ${data.formatVersion}. Expected version 1.`);
        }
        
        // Check DB schema version compatibility
        const currentDb = await getDB();
        if (data.dbSchemaVersion > currentDb.version) {
          throw new Error(`Backup was created with newer DB schema (v${data.dbSchemaVersion}). Current app supports v${currentDb.version}.`);
        }

        // Clear existing data
        await clearAllData();
        // Reset DB promise to get fresh connection after clear
        _resetDB();
        
        // Get fresh DB connection after clear
        const freshDb = await getDB();

        // Import settings first
        if (data.settings) {
          await freshDb.put('settings', data.settings, 'main');
        }

        // Dynamically import all database stores
        const storeNames = Array.from(freshDb.objectStoreNames).filter(name => name !== 'settings') as string[];
        const transaction = freshDb.transaction(storeNames, 'readwrite');

        // Import data for each store
        for (const [storeName, items] of Object.entries(data.database)) {
          if (!Array.isArray(items) || !storeNames.includes(storeName)) continue;
          
          try {
            const store = transaction.objectStore(storeName);
            for (const item of items) {
              await store.put(item);
            }
          } catch (error) {
            console.warn(`Failed to import data for store ${storeName}:`, error);
          }
        }

        await transaction.done;
        resolve();
        
        // Reload the app to ensure UI is in sync with imported data
        setTimeout(() => {
          window.location.reload();
        }, 1000);

      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsText(file);
  });
}

async function clearAllData(): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(db.objectStoreNames, 'readwrite');
  
  await Promise.all(
    Array.from(db.objectStoreNames).map(storeName => {
      return tx.objectStore(storeName).clear();
    })
  );
  
  await tx.done;
}