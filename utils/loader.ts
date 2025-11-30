
import { VocabularyCategory } from '../types';

export const fetchAndParseVocabulary = (
  category: VocabularyCategory, 
  url: string,
  onProgress: (count: number) => void
): Promise<boolean> => {
  return new Promise((resolve) => {
    // Resolve absolute URL to ensure Worker can fetch it relative to the app root
    // This fixes issues where worker might be at a different path in built assets
    const absoluteUrl = new URL(url, window.location.href).href;

    const worker = new Worker(new URL('./vocab.worker.ts', import.meta.url), {
      type: 'module',
    });

    worker.onmessage = (e) => {
      const { type, count, success, error } = e.data;

      if (type === 'progress') {
        onProgress(count);
      } else if (type === 'complete') {
        onProgress(count); 
        worker.terminate();
        resolve(true);
      } else if (type === 'error') {
        console.error(`Worker error for ${category}:`, error);
        worker.terminate();
        resolve(false);
      }
    };

    worker.onerror = (err) => {
      console.error(`Worker execution error for ${category}:`, err);
      worker.terminate();
      resolve(false);
    };

    worker.postMessage({ category, url: absoluteUrl });
  });
};
