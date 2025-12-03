import fs from 'fs';
import path from 'path';

// Path to the Android strings.xml file
// This path assumes the script is run from the project root
const androidStringsPath = path.join('android', 'app', 'src', 'main', 'res', 'values', 'strings.xml');

console.log('🔧 正在更新 Android 应用名称...');

if (fs.existsSync(androidStringsPath)) {
  try {
    let content = fs.readFileSync(androidStringsPath, 'utf8');
    
    // Regex to find <string name="app_name">...</string> and replace content
    // This handles the XML structure safely
    const newContent = content.replace(
      /<string name="app_name">.*?<\/string>/,
      '<string name="app_name">单词大师</string>'
    );
    
    if (content !== newContent) {
        fs.writeFileSync(androidStringsPath, newContent);
        console.log('✅ 应用名称已更新为 "单词大师"');
    } else {
        console.log('✨ 应用名称已经是 "单词大师"，无需更改');
    }
  } catch (e) {
    console.error('❌ 更新 strings.xml 失败:', e);
  }
} else {
  console.log('⚠️ 未找到 Android strings.xml，跳过名称更新 (可能还未添加 Android 平台)');
}