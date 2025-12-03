
import { WordItem, VocabularyCategory } from '../types';
import { addVocabularyBatch, markCategoryLoaded } from '../services/db';

self.onmessage = async (e: MessageEvent) => {
  const { category, url } = e.data;
  
  console.log(`[Worker] Loading: ${category}`);

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP Error ${response.status}`);
    
    // 1. 获取文本内容
    const text = await response.text();
    let rawData: any[];

    // 2. 尝试解析 (带自动修复逻辑)
    try {
      rawData = JSON.parse(text);
    } catch (e) {
      console.warn(`[Worker] JSON parse failed. Auto-fixing ${category}...`);
      // 修复: 将 "} {" 替换为 "}, {" 以处理缺失的逗号
      let fixedText = text.replace(/}\s*[\r\n]*\s*{/g, '},{');
      // 修复: 如果首尾缺少数组括号
      const trimmed = fixedText.trim();
      if (trimmed.startsWith('{') && !trimmed.startsWith('[')) {
          fixedText = `[${fixedText}]`;
      }
      try {
         rawData = JSON.parse(fixedText);
      } catch (e2) {
         throw new Error("JSON parse failed: " + (e2 as Error).message);
      }
    }

    if (!Array.isArray(rawData)) {
        rawData = [rawData];
    }

    // 3. 映射数据
    const items: WordItem[] = rawData.map(raw => mapDataToItem(raw, category))
                                    .filter(Boolean) as WordItem[];

    // 4. 批量写入 (分块写入避免卡顿)
    const CHUNK_SIZE = 2000;
    for (let i = 0; i < items.length; i += CHUNK_SIZE) {
        const chunk = items.slice(i, i + CHUNK_SIZE);
        await addVocabularyBatch(chunk);
        self.postMessage({ type: 'progress', count: Math.min(i + CHUNK_SIZE, items.length) });
    }

    // 5. 完成
    await markCategoryLoaded(category);
    self.postMessage({ type: 'complete', count: items.length, success: true });

  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[Worker Error] ${msg}`);
    self.postMessage({ type: 'error', error: msg });
  }
};

const mapDataToItem = (raw: any, category: VocabularyCategory): WordItem | null => {
    if (!raw?.headWord) return null;

    // 兼容多种 JSON 结构
    let dataRoot = raw;
    if (raw.content?.word?.content) dataRoot = raw.content.word.content;
    else if (raw.content && (raw.content.usphone || raw.content.trans)) dataRoot = raw.content;

    // 提取例句
    let sContent = '', sCn = '';
    if (Array.isArray(dataRoot.sentences) && dataRoot.sentences.length > 0) {
        sContent = dataRoot.sentences[0].sContent || '';
        sCn = dataRoot.sentences[0].sCn || '';
    } else if (dataRoot.sentence?.sentences?.[0]) {
        sContent = dataRoot.sentence.sentences[0].sContent || '';
        sCn = dataRoot.sentence.sentences[0].sCn || '';
    }

    return {
        wordHead: raw.headWord,
        usphone: dataRoot.usphone || '',
        sContent,
        sCn,
        tranCn: Array.isArray(dataRoot.trans) ? dataRoot.trans[0]?.tranCn : (dataRoot.trans?.tranCn || '暂无翻译'),
        val: dataRoot.remMethod?.val || '',
        category
    };
};
