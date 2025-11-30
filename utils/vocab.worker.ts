import { WordItem, VocabularyCategory } from '../types';
import { addVocabularyBatch, markCategoryLoaded } from '../services/db';

// Worker Logic
self.onmessage = async (e: MessageEvent) => {
  const { category, url } = e.data; 

  console.log(`[Worker] 开始加载: ${category} via ${url}`);

  try {
    // 在 Capacitor Android 中，应用运行在 https://localhost/
    // 所以直接 fetch('/merged_xiaoxue.json') 是最稳定可行的方法。
    // 只要文件在 public 文件夹中，且运行了 npx cap sync，这里就能访问到。
    
    // 确保 url 是字符串
    const targetUrl = typeof url === 'string' ? url : String(url);

    // 尝试直接 fetch。Capacitor 会拦截这个请求并从 assets 中读取。
    const response = await fetch(targetUrl);

    if (!response.ok) {
       // 如果 404，说明文件没有被打包进去
       throw new Error(`HTTP Error ${response.status}: 文件未找到 (${targetUrl})。请检查文件是否在 public 文件夹且已执行 npx cap sync`);
    }

    console.log(`[Worker] 成功连接到文件，开始读取...`);

    // 使用流式读取 (Stream) 以节省内存
    const reader = response.body?.getReader();
    if (!reader) throw new Error("无法获取读取流");

    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let items: WordItem[] = [];
    let totalCount = 0;
    const BATCH_SIZE = 2000;

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        
        // 处理完整的行
        const lines = buffer.split('\n');
        // 保留最后一个可能不完整的片段到下一次循环
        buffer = lines.pop() || '';

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            
            const item = parseLine(trimmed, category);
            if (item) {
                items.push(item);
                totalCount++;
            }

            // 批量写入数据库，防止内存暴涨
            if (items.length >= BATCH_SIZE) {
                await addVocabularyBatch(items);
                self.postMessage({ type: 'progress', count: totalCount });
                items = []; // 清空缓冲区
            }
        }
    }

    // 处理剩余的 buffer
    if (buffer.trim()) {
        const item = parseLine(buffer.trim(), category);
        if (item) items.push(item);
    }

    // 写入剩余数据
    if (items.length > 0) {
        await addVocabularyBatch(items);
        totalCount += items.length;
    }

    await markCategoryLoaded(category);
    self.postMessage({ type: 'complete', count: totalCount, success: true });

  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[Worker Error] ${msg}`);
    self.postMessage({ type: 'error', error: msg });
  }
};

// Helper: 解析单行 JSON 数据 (保持不变，增强容错)
const parseLine = (trimmed: string, category: VocabularyCategory): WordItem | null => {
  try {
    // 快速跳过无效行
    if (trimmed === '[' || trimmed === ']') return null;

    let raw;
    try {
      raw = JSON.parse(trimmed);
    } catch (e) {
      // 简单的容错处理：移除行尾逗号
      if (trimmed.endsWith(',')) {
          try {
              raw = JSON.parse(trimmed.slice(0, -1));
          } catch (e2) { return null; }
      } else {
          return null;
      }
    }

    // 如果是数组，说明可能是文件的开头或结尾包含的整体结构，跳过
    if (Array.isArray(raw)) return null;

    const contentCore = raw.content?.word?.content;
    const wordHead = raw.headWord || raw.content?.word?.wordHead;

    if (!wordHead) return null;

    return {
      wordHead: wordHead,
      usphone: contentCore?.usphone || raw.content?.word?.usphone || '',
      sContent: contentCore?.sentence?.sentences?.[0]?.sContent || '',
      sCn: contentCore?.sentence?.sentences?.[0]?.sCn || '',
      tranCn: contentCore?.trans?.[0]?.tranCn || raw.content?.word?.trans?.[0]?.tranCn || '暂无翻译',
      val: contentCore?.remMethod?.val || '',
      category: category
    };
  } catch (e) {
    return null;
  }
};