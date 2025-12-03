import fs from 'fs';
import path from 'path';

// 定义项目根目录下的相对路径
const androidPath = path.join('android');
const gradlePropsPath = path.join(androidPath, 'gradle.properties');
const appBuildGradlePath = path.join(androidPath, 'app', 'build.gradle');
const stylesXmlPath = path.join(androidPath, 'app', 'src', 'main', 'res', 'values', 'styles.xml');

console.log('🔧 运行 Android 配置修复程序...');

if (!fs.existsSync(androidPath)) {
  console.log('⚠️ 找不到 Android 平台文件夹。跳过修复。');
  process.exit(0);
}

// 1. 增加 Gradle 堆内存大小
try {
  if (fs.existsSync(gradlePropsPath)) {
    let propsContent = fs.readFileSync(gradlePropsPath, 'utf8');
    const targetJvmArgs = 'org.gradle.jvmargs=-Xmx4608m'; 
    if (propsContent.includes('org.gradle.jvmargs')) {
      propsContent = propsContent.replace(/org\.gradle\.jvmargs=.*/g, targetJvmArgs);
      console.log('✅ [1/3] 已更新 Gradle 堆内存至 4GB。');
    } else {
      propsContent += `\n# 增加内存以处理大型资产和字典文件\n${targetJvmArgs}\n`;
      console.log('✅ [1/3] 已添加 Gradle 堆内存设置 (4GB)。');
    }
    fs.writeFileSync(gradlePropsPath, propsContent);
  }
} catch (e) {
  console.error('❌ 更新 gradle.properties 失败:', e);
}

// 2. 禁用 JSON 文件压缩
try {
  if (fs.existsSync(appBuildGradlePath)) {
    let buildGradleContent = fs.readFileSync(appBuildGradlePath, 'utf8');
    const aaptOptionsBlock = `
    aaptOptions {
        noCompress "json"
    }
    `;
    if (buildGradleContent.includes('noCompress "json"')) {
      console.log('✅ [2/3] JSON 压缩配置已存在。');
    } else {
      buildGradleContent = buildGradleContent.replace(
        /^\s*android\s*\{/m,
        `android {\n${aaptOptionsBlock}`
      );
      fs.writeFileSync(appBuildGradlePath, buildGradleContent);
      console.log('✅ [2/3] 已禁用 JSON 文件压缩。');
    }
  }
} catch (e) {
  console.error('❌ 更新 app/build.gradle 失败:', e);
}

console.log('🎉 Android 配置补丁完成! 请重新运行构建命令。');