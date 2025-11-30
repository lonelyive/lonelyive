
# English Master - Android Build Guide

这是一个英语单词学习应用。以下是将其打包为 Android APK 的完整步骤。

## ⚠️ 常见问题自动修复

本项目包含一个自动修复脚本 (`scripts/android-fix.js`)，它会自动解决因为大文件导致的 **"Java heap space"** 内存溢出错误。

该脚本会在运行 `npm run build:android` 时自动执行，为您配置：
1.  **Gradle 内存**：增加到 4GB。
2.  **Asset 压缩**：跳过 JSON 文件的压缩（极大提高构建速度并防止崩溃）。

---

## 🛠️ 环境准备 (Prerequisites)

1.  **Node.js**: 请访问 [nodejs.org](https://nodejs.org/) 下载并安装 (建议版本 v18 或更高)。
2.  **Android Studio**: 请访问 [developer.android.com](https://developer.android.com/studio) 下载并安装。
    *   安装时确保勾选 "Android SDK" 和 "Android SDK Command-line Tools"。

## 🚀 从头开始打包 (Step-by-Step)

请在项目文件夹内的终端中依次运行以下命令：

### 第一步：安装依赖

```bash
npm install
```

### 第二步：初始化 Android 环境

**首次打包必须运行此命令**。它会生成 `android` 文件夹并应用自动修复补丁。

```bash
npm run init:android
```

### 第三步：构建并打开打包工具

确保您的 Android 手机已连接电脑（开启 USB 调试），或者您准备使用 Android Studio 里的模拟器。

```bash
npm run build:android
```

这个命令会自动：
1.  重新编译 React 代码。
2.  同步最新代码到 Android 项目。
3.  **自动修复 Gradle 内存配置**。
4.  自动打开 Android Studio。

### 第四步：生成 APK 文件 (在 Android Studio 中)

Android Studio 自动打开后：

1.  等待底部的 "Gradle Sync" 进度条跑完。
2.  在顶部菜单栏，点击 **Build** > **Build Bundle(s) / APK(s)** > **Build APK(s)**。
3.  编译完成后，右下角会出现提示弹窗，点击 **locate**。
4.  文件夹中的 `app-debug.apk` 就是安装包！

## 📁 常见命令

*   `npm run dev`: 在浏览器中启动开发预览。
*   `npm run build:android`: **推荐**。每次修改代码后运行此命令更新并打开 Android Studio。
