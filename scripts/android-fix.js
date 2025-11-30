import fs from 'fs';
import path from 'path';

// 定义项目根目录下的相对路径
const androidPath = path.join('android');
const gradlePropsPath = path.join(androidPath, 'gradle.properties');
const appBuildGradlePath = path.join(androidPath, 'app', 'build.gradle');

console.log('🔧 运行 Android 配置修复程序...');

if (!fs.existsSync(androidPath)) {
  console.log('⚠️ 找不到 Android 平台文件夹。跳过修复。');
  process.exit(0);
}

// 1. 增加 Gradle 堆内存大小 (解决 OOM 错误)
try {
  if (fs.existsSync(gradlePropsPath)) {
    let propsContent = fs.readFileSync(gradlePropsPath, 'utf8');
    
    // 目标设置：4.5GB 内存，用于处理大型资产
    const targetJvmArgs = 'org.gradle.jvmargs=-Xmx4608m'; 
    
    if (propsContent.includes('org.gradle.jvmargs')) {
      // 更新现有的值
      propsContent = propsContent.replace(/org\.gradle\.jvmargs=.*/g, targetJvmArgs);
      console.log('✅ [1/2] 已更新 Gradle 堆内存至 4GB。');
    } else {
      // 追加新的设置
      propsContent += `\n# 增加内存以处理大型资产和字典文件\n${targetJvmArgs}\n`;
      console.log('✅ [1/2] 已添加 Gradle 堆内存设置 (4GB)。');
    }
    
    fs.writeFileSync(gradlePropsPath, propsContent);
  } else {
    console.log('⚠️ gradle.properties 文件未找到。');
  }
} catch (e) {
  console.error('❌ 更新 gradle.properties 失败:', e);
}

// 2. 禁用 JSON 文件压缩 (解决运行时文件读取错误)
try {
  if (fs.existsSync(appBuildGradlePath)) {
    let buildGradleContent = fs.readFileSync(appBuildGradlePath, 'utf8');
    
    const aaptOptionsBlock = `
    // 关键修复: 禁用 JSON 文件压缩。
    // Android 的 AAPT 默认压缩 Assets 文件夹中的文件。对于大型 JSON 文件，
    // 这可能导致打包时 OOM 或运行时文件读取错误。
    aaptOptions {
        noCompress "json"
    }
    `;

    // 检查配置是否已存在
    if (buildGradleContent.includes('noCompress "json"')) {
      console.log('✅ [2/2] JSON 压缩配置已存在。');
    } else {
      // 找到 'android {' 块的起始位置，并在其后插入 aaptOptions
      // 使用更安全的正则表达式匹配 'android' 块的起始行
      buildGradleContent = buildGradleContent.replace(
        /^\s*android\s*\{/m,
        `android {\n${aaptOptionsBlock}`
      );
      
      fs.writeFileSync(appBuildGradlePath, buildGradleContent);
      console.log('✅ [2/2] 已禁用 JSON 文件压缩 (noCompress "json")。');
    }
  } else {
    console.log('⚠️ app/build.gradle 文件未找到。');
  }
} catch (e) {
  console.error('❌ 更新 app/build.gradle 失败:', e);
}

console.log('🎉 Android 配置补丁完成! 请重新运行构建命令。');