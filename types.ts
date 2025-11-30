export interface WordItem {
  wordHead: string; // The word
  usphone: string; // Phonetic symbol
  sContent: string; // Example sentence
  sCn: string; // Example sentence translation
  tranCn: string; // Word translation
  val: string; // Association/Mnemonic
  category: VocabularyCategory;
}

export type VocabularyCategory = 'xiaoxue' | 'chuzhong' | 'gaozhong' | 'CET4' | 'CET6';

export interface UserStats {
  points: number;
  lastLoginDate: string; // YYYY-MM-DD
  streakDays: number;
}

// Stored in IndexedDB
export interface WordStatus {
  wordHead: string;
  category: VocabularyCategory;
  status: 'learned' | 'mistake';
  timestamp: number;
  data: WordItem; // Cache the full item for display in lists
}

export const CATEGORIES: { id: VocabularyCategory; name: string; file: string }[] = [
  { id: 'xiaoxue', name: '小学', file: '/merged_xiaoxue.json' },
  { id: 'chuzhong', name: '初中', file: '/merged_chuzhong.json' },
  { id: 'gaozhong', name: '高中', file: '/merged_gaozhong.json' },
  { id: 'CET4', name: 'CET-4', file: '/merged_CET4.json' },
  { id: 'CET6', name: 'CET-6', file: '/merged_CET6.json' },
];

export enum AppTab {
  HOME = 'home',
  LEARN = 'learn',
  SETTINGS = 'settings',
}

