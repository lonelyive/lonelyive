import { WordItem, VocabularyCategory } from '../types';
import { addVocabularyBatch, markCategoryLoaded } from '../services/db';

self.onmessage = async (e: MessageEvent) => {
  const { category, url } = e.data;
  
  console.log(`[Worker] Loading: ${category} from ${url}`);

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP Error ${response.status}`);
    
    // Direct JSON parsing for standard format
    const rawData: any[] = await response.json();

    if (!Array.isArray(rawData)) {
        // Handle single object case
        if (typeof rawData === 'object' && rawData !== null) {
            rawData = [rawData];
        } else {
            throw new Error("Parsed data is not an array");
        }
    }

    // Map Data to WordItem format
    const items: WordItem[] = rawData.map(raw => mapDataToItem(raw, category))
                                    .filter(Boolean) as WordItem[];

    // Batch Insert (Chunks of 2000)
    const CHUNK_SIZE = 2000;
    for (let i = 0; i < items.length; i += CHUNK_SIZE) {
        const chunk = items.slice(i, i + CHUNK_SIZE);
        await addVocabularyBatch(chunk);
        self.postMessage({ type: 'progress', count: Math.min(i + CHUNK_SIZE, items.length) });
    }

    // Complete processing
    await markCategoryLoaded(category);
    self.postMessage({ type: 'complete', count: items.length, success: true });

  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[Worker Error] ${msg}`);
    self.postMessage({ type: 'error', error: msg });
  }
};

// Simplified data mapping for standard JSON structure
const mapDataToItem = (raw: any, category: VocabularyCategory): WordItem | null => {
    if (!raw?.headWord) return null;

    return {
        wordHead: raw.headWord,
        usphone: raw.usphone || '',
        sContent: raw.sentences?.[0]?.sContent || '',
        sCn: raw.sentences?.[0]?.sCn || '',
        tranCn: raw.tranCn || '暂无翻译',
        val: raw.remMethod?.val || '',
        category
    };
};