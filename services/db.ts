import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { WordStatus, UserStats, WordItem, VocabularyCategory } from '../types';

interface VocabDB extends DBSchema {
  progress: {
    key: string;
    value: WordStatus;
    indexes: { 'by-status': string; 'by-category': string };
  };
  stats: {
    key: string;
    value: any;
  };
  vocabulary: {
    key: number; 
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
    const keys = await index.getAllKeys(category);
    await Promise.all(keys.map(key => tx.store.delete(key)));
    await tx.done;
};

// Optimized Batch Insert using a single transaction for speed
export const addVocabularyBatch = async (items: WordItem[]) => {
    const db = await getDB();
    const tx = db.transaction('vocabulary', 'readwrite');
    const store = tx.store;
    
    // Parallel execution within one transaction
    await Promise.all([
        ...items.map(item => store.add(item)),
        tx.done
    ]);
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
    const keys = await db.getAllKeysFromIndex('vocabulary', 'by-category', category);
    if (keys.length === 0) return [];

    const selectedWords: WordItem[] = [];
    const usedIndices = new Set<number>();

    let attempts = 0;
    // Safety limit to prevent infinite loops
    while (selectedWords.length < count && usedIndices.size < keys.length && attempts < 50) {
        const idx = Math.floor(Math.random() * keys.length);
        if (!usedIndices.has(idx)) {
            usedIndices.add(idx);
            const key = keys[idx];
            const word = await db.get('vocabulary', key);
            if (word) selectedWords.push(word);
        }
        attempts++;
    }
    return selectedWords;
};

export const getRandomDistractors = async (excludeWord: string, count: number): Promise<string[]> => {
    const db = await getDB();
    const distractors: string[] = [];
    let attempts = 0;
    
    // Try to get distractors from CET4 as a generic pool if possible, or any loaded category
    const cat = 'CET4'; 
    const poolKeys = await db.getAllKeysFromIndex('vocabulary', 'by-category', cat, 200);
    
    // If CET4 is empty, try to grab from the whole store (slower but safer fallback)
    const effectiveKeys = poolKeys.length > 0 ? poolKeys : await db.getAllKeys('vocabulary', 200);

    while(distractors.length < count && attempts < 50 && effectiveKeys.length > 0) {
         const k = effectiveKeys[Math.floor(Math.random() * effectiveKeys.length)];
         const item = await db.get('vocabulary', k);
         if (item && item.tranCn && item.wordHead !== excludeWord && !distractors.includes(item.tranCn)) {
            distractors.push(item.tranCn);
         }
        attempts++;
    }
    
    // Fallback if DB is empty
    if (distractors.length < count) {
        const fallbacks = ["错误选项 A", "错误选项 B", "错误选项 C", "错误选项 D", "错误选项 E"];
        for (const fb of fallbacks) {
            if (distractors.length < count) distractors.push(fb);
        }
    }

    return distractors.slice(0, count);
}

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

export const getProgressIdsByCategory = async (category: VocabularyCategory): Promise<string[]> => {
    const db = await getDB();
    return db.getAllKeysFromIndex('progress', 'by-category', category) as Promise<string[]>;
};

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
      const tx1 = db.transaction('progress', 'readwrite');
      await tx1.store.clear();
      await tx1.done;
      
      const tx2 = db.transaction('stats', 'readwrite');
      await tx2.store.clear();
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