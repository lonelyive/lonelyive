import { VocabularyCategory, WordItem } from '../types';
import { addVocabularyBatch, markCategoryLoaded } from '../services/db';

export const fetchAndParseVocabulary = async (
  category: VocabularyCategory, 
  url: string,
  onProgress: (count: number) => void
): Promise<boolean> => {
  try {
    console.log(`[Loader] 📥 Fetching ${category} from ${url}...`);
    
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`HTTP Error ${response.status}: ${response.statusText}`);
    }

    const text = await response.text();
    let rawData: any[];

    try {
      rawData = JSON.parse(text);
    } catch (e) {
      console.warn(`[Loader] JSON parse failed for ${category}. Attempting auto-fix...`);
      // Fix missing commas between objects (common in some datasets)
      // Replace "} {" or "}\n{" with "}, {"
      let fixedText = text.replace(/}\s*[\r\n]*\s*{/g, '},{');
      
      // Wrap in array brackets if missing
      const trimmed = fixedText.trim();
      if (trimmed.startsWith('{') && !trimmed.startsWith('[')) {
          fixedText = `[${fixedText}]`;
      }

      try {
         rawData = JSON.parse(fixedText);
      } catch (e2) {
         console.error(`[Loader] Auto-fix failed:`, e2);
         return false;
      }
    }

    if (!Array.isArray(rawData)) {
        // Handle single object case
        if (rawData && typeof rawData === 'object') {
             rawData = [rawData];
        } else {
             console.error(`[Loader] Data is not an array`);
             return false;
        }
    }

    // Map data to standard format
    const items: WordItem[] = rawData.map((raw: any) => {
        if (!raw || !raw.headWord) return null;

        // Robust field extraction
        let dataRoot = raw;
        // Structure A: nested content
        if (raw.content?.word?.content) dataRoot = raw.content.word.content;
        // Structure B: intermediate content
        else if (raw.content && (raw.content.usphone || raw.content.trans)) dataRoot = raw.content;

        const usphone = dataRoot.usphone || '';
        
        let tranCn = '暂无翻译';
        if (Array.isArray(dataRoot.trans) && dataRoot.trans.length > 0) tranCn = dataRoot.trans[0].tranCn;
        else if (dataRoot.trans?.tranCn) tranCn = dataRoot.trans.tranCn;
        else if (typeof dataRoot.trans === 'string') tranCn = dataRoot.trans;

        let sContent = '';
        let sCn = '';
        // Try sentences array
        if (Array.isArray(dataRoot.sentences) && dataRoot.sentences.length > 0) {
             sContent = dataRoot.sentences[0].sContent || '';
             sCn = dataRoot.sentences[0].sCn || '';
        } 
        // Try nested sentence object
        else if (dataRoot.sentence?.sentences?.[0]) {
             sContent = dataRoot.sentence.sentences[0].sContent || '';
             sCn = dataRoot.sentence.sentences[0].sCn || '';
        }

        return {
            wordHead: raw.headWord,
            usphone,
            sContent,
            sCn,
            tranCn,
            val: dataRoot.remMethod?.val || '',
            category
        };
    }).filter((item): item is WordItem => item !== null);

    console.log(`[Loader] 💾 Saving ${items.length} items to DB...`);

    // Write to DB in chunks to avoid blocking UI
    const CHUNK_SIZE = 500;
    for (let i = 0; i < items.length; i += CHUNK_SIZE) {
        const chunk = items.slice(i, i + CHUNK_SIZE);
        await addVocabularyBatch(chunk);
        onProgress(Math.min(i + CHUNK_SIZE, items.length));
        // Yield to main thread briefly
        await new Promise(resolve => setTimeout(resolve, 5));
    }

    await markCategoryLoaded(category);
    console.log(`[Loader] ✅ ${category} loaded successfully.`);
    return true;

  } catch (e) {
    console.error(`[Loader] ❌ Failed to load ${category}:`, e);
    return false;
  }
};