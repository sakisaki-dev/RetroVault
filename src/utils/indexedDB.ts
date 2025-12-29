// IndexedDB persistence layer for Retro Vault
// Provides better storage capacity than localStorage and sync across tabs

const DB_NAME = 'RetroVaultDB';
const DB_VERSION = 1;

// Store names
export const STORES = {
  careerBaseCsv: 'careerBaseCsv',
  seasonSnapshots: 'seasonSnapshots',
  seasonHistory: 'seasonHistory',
  playerEdits: 'playerEdits',
  settings: 'settings',
} as const;

type StoreName = (typeof STORES)[keyof typeof STORES];

let dbInstance: IDBDatabase | null = null;
let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbInstance) return Promise.resolve(dbInstance);
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('IndexedDB error:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Create object stores
      if (!db.objectStoreNames.contains(STORES.careerBaseCsv)) {
        db.createObjectStore(STORES.careerBaseCsv);
      }
      if (!db.objectStoreNames.contains(STORES.seasonSnapshots)) {
        db.createObjectStore(STORES.seasonSnapshots);
      }
      if (!db.objectStoreNames.contains(STORES.seasonHistory)) {
        db.createObjectStore(STORES.seasonHistory);
      }
      if (!db.objectStoreNames.contains(STORES.playerEdits)) {
        db.createObjectStore(STORES.playerEdits);
      }
      if (!db.objectStoreNames.contains(STORES.settings)) {
        db.createObjectStore(STORES.settings);
      }
    };
  });

  return dbPromise;
}

export async function getValue<T>(store: StoreName, key: string): Promise<T | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(store, 'readonly');
      const objectStore = transaction.objectStore(store);
      const request = objectStore.get(key);

      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('IndexedDB getValue error:', error);
    return null;
  }
}

export async function setValue<T>(store: StoreName, key: string, value: T): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(store, 'readwrite');
      const objectStore = transaction.objectStore(store);
      const request = objectStore.put(value, key);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('IndexedDB setValue error:', error);
  }
}

export async function deleteValue(store: StoreName, key: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(store, 'readwrite');
      const objectStore = transaction.objectStore(store);
      const request = objectStore.delete(key);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('IndexedDB deleteValue error:', error);
  }
}

export async function getAllKeys(store: StoreName): Promise<string[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(store, 'readonly');
      const objectStore = transaction.objectStore(store);
      const request = objectStore.getAllKeys();

      request.onsuccess = () => resolve(request.result as string[]);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('IndexedDB getAllKeys error:', error);
    return [];
  }
}

export async function getAllValues<T>(store: StoreName): Promise<Record<string, T>> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(store, 'readonly');
      const objectStore = transaction.objectStore(store);
      const keysRequest = objectStore.getAllKeys();
      const valuesRequest = objectStore.getAll();

      let keys: string[] = [];
      let values: T[] = [];

      keysRequest.onsuccess = () => {
        keys = keysRequest.result as string[];
      };

      valuesRequest.onsuccess = () => {
        values = valuesRequest.result;
        const result: Record<string, T> = {};
        keys.forEach((key, i) => {
          result[key] = values[i];
        });
        resolve(result);
      };

      valuesRequest.onerror = () => reject(valuesRequest.error);
    });
  } catch (error) {
    console.error('IndexedDB getAllValues error:', error);
    return {};
  }
}

export async function clearStore(store: StoreName): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(store, 'readwrite');
      const objectStore = transaction.objectStore(store);
      const request = objectStore.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('IndexedDB clearStore error:', error);
  }
}

// Player edit types
export interface PlayerEdit {
  playerKey: string; // position:name
  position: string;
  name: string;
  team?: string;
  nickname?: string;
  status: 'Active' | 'Retired';
  trueTalent: number;
  dominance: number;
  careerLegacy: number;
  tpg: number;
  games: number;
  rings: number;
  mvp: number;
  opoy: number;
  sbmvp: number;
  roty: number;
  // Position-specific stats
  positionStats: Record<string, number>;
  // Manual season history entries
  manualSeasons?: Array<{
    season: string;
    stats: Record<string, number>;
  }>;
  // Metadata
  createdAt: number;
  updatedAt: number;
  isManuallyAdded: boolean;
}

// Get all player edits
export async function getPlayerEdits(): Promise<Record<string, PlayerEdit>> {
  return getAllValues<PlayerEdit>(STORES.playerEdits);
}

// Save a player edit
export async function savePlayerEdit(edit: PlayerEdit): Promise<void> {
  await setValue(STORES.playerEdits, edit.playerKey, edit);
}

// Delete a player edit
export async function deletePlayerEdit(playerKey: string): Promise<void> {
  await deleteValue(STORES.playerEdits, playerKey);
}

// Get season snapshots from IndexedDB
export async function getSeasonSnapshotsFromDB(): Promise<Record<string, string>> {
  const value = await getValue<Record<string, string>>(STORES.seasonSnapshots, 'all');
  return value || {};
}

// Save season snapshots to IndexedDB
export async function saveSeasonSnapshotsToDB(snapshots: Record<string, string>): Promise<void> {
  await setValue(STORES.seasonSnapshots, 'all', snapshots);
}

// Get season history from IndexedDB
export async function getSeasonHistoryFromDB(): Promise<Record<string, any[]>> {
  const value = await getValue<Record<string, any[]>>(STORES.seasonHistory, 'all');
  return value || {};
}

// Save season history to IndexedDB
export async function saveSeasonHistoryToDB(history: Record<string, any[]>): Promise<void> {
  await setValue(STORES.seasonHistory, 'all', history);
}

// Get career base CSV
export async function getCareerBaseCsvFromDB(): Promise<string | null> {
  return getValue<string>(STORES.careerBaseCsv, 'base');
}

// Save career base CSV
export async function saveCareerBaseCsvToDB(csv: string): Promise<void> {
  await setValue(STORES.careerBaseCsv, 'base', csv);
}

// Settings helpers
export async function getSetting<T>(key: string): Promise<T | null> {
  return getValue<T>(STORES.settings, key);
}

export async function setSetting<T>(key: string, value: T): Promise<void> {
  await setValue(STORES.settings, key, value);
}

// Migration from localStorage to IndexedDB
export async function migrateFromLocalStorage(): Promise<boolean> {
  try {
    const migrated = await getSetting<boolean>('migratedFromLocalStorage');
    if (migrated) return true;

    // Migrate season snapshots
    const lsSnapshots = localStorage.getItem('retroVault:seasonSnapshots');
    if (lsSnapshots) {
      await saveSeasonSnapshotsToDB(JSON.parse(lsSnapshots));
    }

    // Migrate season history
    const lsHistory = localStorage.getItem('retroVault:seasonHistory');
    if (lsHistory) {
      await saveSeasonHistoryToDB(JSON.parse(lsHistory));
    }

    // Migrate career base CSV
    const lsBaseCsv = localStorage.getItem('retroVault:careerBaseCsv');
    if (lsBaseCsv) {
      await saveCareerBaseCsvToDB(lsBaseCsv);
    }

    // Migrate current season
    const lsCurrentSeason = localStorage.getItem('retroVault:currentSeason');
    if (lsCurrentSeason) {
      await setSetting('currentSeason', lsCurrentSeason);
    }

    // Migrate career CSV
    const lsCareerCsv = localStorage.getItem('retroVault:careerCsv');
    if (lsCareerCsv) {
      await setSetting('careerCsv', lsCareerCsv);
    }

    // Migrate prev career CSV
    const lsPrevCareerCsv = localStorage.getItem('retroVault:prevCareerCsv');
    if (lsPrevCareerCsv) {
      await setSetting('prevCareerCsv', lsPrevCareerCsv);
    }

    await setSetting('migratedFromLocalStorage', true);
    console.log('Successfully migrated from localStorage to IndexedDB');
    return true;
  } catch (error) {
    console.error('Migration from localStorage failed:', error);
    return false;
  }
}
