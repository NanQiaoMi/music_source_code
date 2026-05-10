# Vibe Music Player Electron 桌面集成指南

> 📅 **创建日期**: 2026-03-29
> 🎯 **目标**: 为 Vibe Music Player 添加桌面功能

---

## 📋 已完成的工作

### 1. Electron 基础框架
- ✅ `electron/main/index.js` - 主进程文件
- ✅ `electron/preload/index.js` - 预加载脚本
- ✅ `src/types/electron.d.ts` - TypeScript 类型定义

### 2. 桌面功能实现
- ✅ **桌面歌词窗口** - 无边框、透明、置顶、可拖动
- ✅ **系统托盘** - 快捷菜单、播放控制、歌词开关
- ✅ **IPC 通信** - 主进程与渲染进程通信机制
- ✅ **窗口管理** - 主窗口、桌面歌词窗口生命周期管理

### 3. 前端集成
- ✅ `src/hooks/useElectron.ts` - Electron Hook
- ✅ `src/components/features-v7/DesktopLyrics.tsx` - 桌面歌词组件
- ✅ `src/components/features-v7/DesktopLyricsToggle.tsx` - 桌面歌词切换按钮

---

## 🚀 安装与运行

### 步骤 1: 安装 Electron 依赖

```bash
npm install --save-dev electron electron-builder concurrently wait-on cross-env
```

### 步骤 2: 更新 package.json

在 `package.json` 中添加以下内容：

```json
{
  "main": "electron/main/index.js",
  "scripts": {
    "dev:electron": "concurrently \"npm run dev\" \"wait-on http://localhost:3025 && cross-env NODE_ENV=development electron .\"",
    "build:electron": "npm run build && electron-builder",
    "build:electron:win": "npm run build && electron-builder --win",
    "build:electron:mac": "npm run build && electron-builder --mac",
    "build:electron:linux": "npm run build && electron-builder --linux"
  },
  "build": {
    "appId": "com.vibe.musicplayer",
    "productName": "Vibe Music Player",
    "directories": {
      "output": "dist-electron"
    },
    "files": [
      ".next/**/*",
      "electron/**/*",
      "public/**/*",
      "package.json"
    ],
    "win": {
      "target": [
        "nsis",
        "portable"
      ],
      "icon": "public/default-cover.ico"
    },
    "mac": {
      "target": [
        "dmg",
        "zip"
      ],
      "icon": "public/default-cover.icns"
    },
    "linux": {
      "target": [
        "AppImage",
        "deb"
      ],
      "icon": "public/default-cover.png"
    }
  }
}
```

### 步骤 3: 开发模式运行

```bash
npm run dev:electron
```

这将同时启动 Next.js 开发服务器和 Electron 应用。

### 步骤 4: 打包生产版本

```bash
# Windows
npm run build:electron:win

# macOS
npm run build:electron:mac

# Linux
npm run build:electron:linux

# 当前平台
npm run build:electron
```

---

## 🎯 功能说明

### 1. 桌面歌词
- 点击播放器界面右下角的绿色按钮（MonitorPlay 图标）
- 或通过系统托盘菜单启用桌面歌词
- 歌词窗口无边框、透明、置顶显示
- 鼠标事件穿透，不影响其他操作

### 2. 系统托盘
- 右键托盘图标打开快捷菜单
- 支持播放/暂停、上一首、下一首
- 支持显示/隐藏主窗口
- 支持启用/禁用桌面歌词

### 3. IPC API

在渲染进程中通过 `window.electronAPI` 访问：

```typescript
// 切换桌面歌词
const isOpen = await window.electronAPI.toggleDesktopLyrics();

// 检查桌面歌词是否打开
const isOpen = await window.electronAPI.isDesktopLyricsOpen();

// 更新歌词
await window.electronAPI.updateLyrics(lyricsData);

// 更新歌曲信息
await window.electronAPI.updateSongInfo({
  title: "歌曲名",
  artist: "艺术家"
});

// 监听播放控制
window.electronAPI.onTogglePlay(() => { /* ... */ });
window.electronAPI.onPrevSong(() => { /* ... */ });
window.electronAPI.onNextSong(() => { /* ... */ });
```

---

## 📂 文件结构

```
vibe-music-player/
├── electron/
│   ├── main/
│   │   └── index.js          # Electron 主进程
│   └── preload/
│       └── index.js          # 预加载脚本
├── src/
│   ├── hooks/
│   │   └── useElectron.ts    # Electron Hook
│   ├── components/
│   │   └── features-v7/
│   │       ├── DesktopLyrics.tsx      # 桌面歌词组件
│   │       └── DesktopLyricsToggle.tsx # 桌面歌词切换按钮
│   └── types/
│       └── electron.d.ts    # TypeScript 类型定义
└── docs/
    └── ELECTRON_SETUP_GUIDE.md  # 本文档
```

---

## ⚠️ 注意事项

### 核心禁令重申
- ❌ **绝对不要**修改现有三个核心界面（资料库、播放器、全屏歌词）
- ✅ 所有新增功能通过独立组件/窗口实现

### 图标准备
打包前需要准备以下图标文件：
- `public/default-cover.ico` - Windows 图标
- `public/default-cover.icns` - macOS 图标
- `public/default-cover.png` - Linux 图标（512x512）

### 开发模式
- 开发模式下，Electron 会加载 `http://localhost:3025`
- 请确保 Next.js 开发服务器正常运行

### 生产模式
- 生产模式下，Electron 会加载构建后的 Next.js 文件
- 需要先运行 `npm run build` 构建 Next.js

---

## 🎉 总结

Electron 桌面集成框架已搭建完成！包含：

1. ✅ Electron 主进程和预加载脚本
2. ✅ 桌面歌词窗口
3. ✅ 系统托盘集成
4. ✅ IPC 通信机制
5. ✅ 前端集成组件和 Hook
6. ✅ TypeScript 类型定义

下一步：安装 Electron 依赖，然后运行 `npm run dev:electron` 开始开发！
