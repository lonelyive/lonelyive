export interface WordItem {
  wordHead: string; 
  usphone: string; 
  sContent: string; 
  sCn: string; 
  tranCn: string; 
  val: string; 
  category: VocabularyCategory;
}

export type VocabularyCategory = 'xiaoxue' | 'chuzhong' | 'gaozhong' | 'CET4' | 'CET6';

export interface UserStats {
  points: number;
  lastLoginDate: string; 
  streakDays: number;
}

// Stored in IndexedDB
export interface WordStatus {
  wordHead: string;
  category: VocabularyCategory;
  status: 'learned' | 'mistake';
  timestamp: number;
  data: WordItem; 
}

// CHANGED: Use relative paths ./ to ensure correct resolution in all environments (Web & Android)
export const CATEGORIES: { id: VocabularyCategory; name: string; file: string }[] = [
  { id: 'xiaoxue', name: '小学', file: './merged_xiaoxue.json' },
  { id: 'chuzhong', name: '初中', file: './merged_chuzhong.json' },
  { id: 'gaozhong', name: '高中', file: './merged_gaozhong.json' },
  { id: 'CET4', name: 'CET-4', file: './merged_CET4.json' },
  { id: 'CET6', name: 'CET-6', file: './merged_CET6.json' },
];

export enum AppTab {
  HOME = 'home',
  LEARN = 'learn',
  SETTINGS = 'settings',
}