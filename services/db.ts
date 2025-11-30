import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { WordStatus, UserStats, WordItem, VocabularyCategory } from '../types';

interface VocabDB extends DBSchema {
  progress: {
    key: string; // wordHead
    value: WordStatus;
    indexes: { 'by-status': string; 'by-category': string };
  };
  stats: {
    key: string;
    value: any;
  };
  vocabulary: {
    key: number; // Auto-increment ID
    value: WordItem;
    indexes: { 'by-category': string; 'by-word': string };
  };
  meta: {
    key: string;
    value: boolean;
  };
}

export const DB_NAME = 'vocab_master_db';
export const DB_VERSION = 2;

let dbPromise: Promise<IDBPDatabase<VocabDB>> | null = null;

const getDB = () => {
  if (!dbPromise) {
    dbPromise = openDB<VocabDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, newVersion) {
        if (oldVersion < 1) {
            const progressStore = db.createObjectStore('progress', { keyPath: 'wordHead' });
            progressStore.createIndex('by-status', 'status');
            progressStore.createIndex('by-category', 'category');
            db.createObjectStore('stats');
        }
        if (oldVersion < 2) {
            const vocabStore = db.createObjectStore('vocabulary', { autoIncrement: true });
            vocabStore.createIndex('by-category', 'category');
            vocabStore.createIndex('by-word', 'wordHead');
            db.createObjectStore('meta');
        }
      },
    });
  }
  return dbPromise;
};

// --- Vocabulary Operations ---

export const isVocabularyLoaded = async (category: string): Promise<boolean> => {
    const db = await getDB();
    const loaded = await db.get('meta', `loaded_${category}`);
    return !!loaded;
};

export const markCategoryLoaded = async (category: string) => {
    const db = await getDB();
    await db.put('meta', true, `loaded_${category}`);
};

export const clearVocabularyByCategory = async (category: string) => {
    const db = await getDB();
    const tx = db.transaction('vocabulary', 'readwrite');
    const index = tx.store.index('by-category');
    // Get all primary keys (IDs) for this category
    const keys = await index.getAllKeys(category);
    // Delete them all
    await Promise.all(keys.map(key => tx.store.delete(key)));
    await tx.done;
};

export const addVocabularyBatch = async (items: WordItem[]) => {
    const db = await getDB();
    const tx = db.transaction('vocabulary', 'readwrite');
    // Promise.all is faster for batches in idb
    await Promise.all(items.map(item => tx.store.add(item)));
    await tx.done;
};

export const getVocabularyCount = async (category?: VocabularyCategory): Promise<number> => {
    const db = await getDB();
    if (category) {
        return db.countFromIndex('vocabulary', 'by-category', category);
    }
    return db.count('vocabulary');
};

export const getRandomWordsByCategory = async (category: VocabularyCategory, count: number): Promise<WordItem[]> => {
    const db = await getDB();
    // Getting all keys is lightweight compared to getting all objects
    const keys = await db.getAllKeysFromIndex('vocabulary', 'by-category', category);
    if (keys.length === 0) return [];

    const selectedWords: WordItem[] = [];
    const usedIndices = new Set<number>();

    while (selectedWords.length < count && usedIndices.size < keys.length) {
        const idx = Math.floor(Math.random() * keys.length);
        if (!usedIndices.has(idx)) {
            usedIndices.add(idx);
            const key = keys[idx];
            const word = await db.get('vocabulary', key);
            if (word) selectedWords.push(word);
        }
    }
    return selectedWords;
};

export const getRandomDistractors = async (excludeWord: string, count: number): Promise<string[]> => {
    const db = await getDB();
    // We limit to a range to avoid scanning the whole huge DB, just pick a random offset
    // This is an optimization: just grab a chunk of keys
    const total = await db.count('vocabulary');
    
    // Robust approach: Get random items using random keys
    const distractors: string[] = [];
    let attempts = 0;
    
    // Safety break
    while(distractors.length < count && attempts < 50) {
        // Correct implementation for speed:
        // For distractors specifically:
        const cat = 'CET4'; // Default pool
        const poolKeys = await db.getAllKeysFromIndex('vocabulary', 'by-category', cat, 100);
        
        if (poolKeys.length > 0) {
             const k = poolKeys[Math.floor(Math.random() * poolKeys.length)];
             const item = await db.get('vocabulary', k);
             if (item && item.tranCn && item.wordHead !== excludeWord && !distractors.includes(item.tranCn)) {
                distractors.push(item.tranCn);
             }
        }
        attempts++;
    }
    
    // Fallback if still empty (e.g. DB empty)
    if (distractors.length < count) {
        distractors.push("错误选项 A", "错误选项 B", "错误选项 C");
    }

    return distractors.slice(0, count);
}

export const searchLocalVocabulary = async (query: string, limit: number = 10): Promise<WordItem[]> => {
    if (!query) return [];
    const db = await getDB();
    // IndexedDB doesn't support full-text search natively. 
    // We use a range bound on the index for "startsWith" logic.
    // Prefix search: "app" -> range("app", "app" + "\uffff")
    const range = IDBKeyRange.bound(query, query + '\uffff');
    let results: WordItem[] = [];
    
    try {
        results = await db.getAllFromIndex('vocabulary', 'by-word', range, limit);
    } catch (e) {
        // Fallback
    }
    return results;
};

// --- Stats Operations ---

export const getUserStats = async (): Promise<UserStats> => {
  const db = await getDB();
  const points = (await db.get('stats', 'points')) || 0;
  const lastLoginDate = (await db.get('stats', 'lastLoginDate')) || '';
  const streakDays = (await db.get('stats', 'streakDays')) || 0;
  return { points, lastLoginDate, streakDays };
};

export const updatePoints = async (amount: number) => {
  const db = await getDB();
  const current = (await db.get('stats', 'points')) || 0;
  let newPoints = current + amount;
  if (newPoints > 999999) newPoints = 999999;
  if (newPoints < 0) newPoints = 0;
  await db.put('stats', newPoints, 'points');
  return newPoints;
};

export const checkInStreak = async () => {
  const db = await getDB();
  const today = new Date().toISOString().split('T')[0];
  const lastDate = (await db.get('stats', 'lastLoginDate')) || '';
  let streak = (await db.get('stats', 'streakDays')) || 0;

  if (lastDate !== today) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    if (lastDate === yesterdayStr) {
      streak += 1;
    } else {
      streak = 1;
    }
    await db.put('stats', today, 'lastLoginDate');
    await db.put('stats', streak, 'streakDays');
  }
  return streak;
};

// --- Progress Operations ---

export const saveWordProgress = async (item: WordItem, status: 'learned' | 'mistake') => {
  const db = await getDB();
  const record: WordStatus = {
    wordHead: item.wordHead,
    category: item.category,
    status,
    timestamp: Date.now(),
    data: item,
  };
  await db.put('progress', record);
};

export const removeWordProgress = async (wordHead: string) => {
  const db = await getDB();
  await db.delete('progress', wordHead);
};

export const getMistakes = async (): Promise<WordStatus[]> => {
  const db = await getDB();
  return db.getAllFromIndex('progress', 'by-status', 'mistake');
};

export const getAchievements = async (): Promise<WordStatus[]> => {
  const db = await getDB();
  return db.getAllFromIndex('progress', 'by-status', 'learned');
};

export const getAllProgress = async (): Promise<WordStatus[]> => {
    const db = await getDB();
    return db.getAll('progress');
};

// Retrieve just the word IDs (wordHead) for a specific category that have ANY progress (learned or mistake)
export const getProgressIdsByCategory = async (category: VocabularyCategory): Promise<string[]> => {
    const db = await getDB();
    // Returns array of keys (wordHeads)
    return db.getAllKeysFromIndex('progress', 'by-category', category) as Promise<string[]>;
};

// Get detailed stats for a category
export const getCategoryStats = async (category: VocabularyCategory): Promise<{ learned: number, mistake: number }> => {
    const db = await getDB();
    const items = await db.getAllFromIndex('progress', 'by-category', category);
    let learned = 0;
    let mistake = 0;
    items.forEach(item => {
        if (item.status === 'learned') learned++;
        else if (item.status === 'mistake') mistake++;
    });
    return { learned, mistake };
};

export const resetGlobalData = async () => {
  const db = await getDB();
  
  try {
      // 1. Clear Mistakes & Achievements
      const tx1 = db.transaction('progress', 'readwrite');
      await tx1.store.clear();
      await tx1.done;
      
      // 2. Clear User Stats (Points, Streak, Login)
      const tx2 = db.transaction('stats', 'readwrite');
      await tx2.store.clear();
      
      // Immediately initialize default values to prevent undefined errors in UI
      await Promise.all([
          tx2.store.put(0, 'points'),
          tx2.store.put('', 'lastLoginDate'),
          tx2.store.put(0, 'streakDays')
      ]);
      
      await tx2.done;
  } catch (e) {
      console.error("Error during reset:", e);
      throw e;
  }
};