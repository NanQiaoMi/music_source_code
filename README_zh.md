# MIMI Music Player (Vibe Player) v0.2.1

> 基于 Next.js 16、React 19、Web Audio API 与 Three.js 构建的高性能音乐播放器与视听工作台。  
> 包含硬件级实时声学可视化引擎、3D 空间交互唱片架、30 段图示均衡器、17 节点创意 DSP 音效链、多源/本地全格式播放支持，以及纯本地隔空手势体感控制。

[English](README.md) | [简体中文](README_zh.md)

[![Next.js](https://img.shields.io/badge/Next.js-16.2-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.2-blue?style=flat-square&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4_Strict-3178C6?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Three.js](https://img.shields.io/badge/Three.js-0.183-black?style=flat-square&logo=three.js)](https://threejs.org/)
[![Framer Motion](https://img.shields.io/badge/Framer_Motion-12.38-black?style=flat-square&logo=framer)](https://www.framer.com/motion/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4_OKLCH-06B6D4?style=flat-square&logo=tailwindcss)](https://tailwindcss.com/)
[![Zustand](https://img.shields.io/badge/Zustand-5.0-orange?style=flat-square)](https://github.com/pmndrs/zustand)
[![Electron](https://img.shields.io/badge/Electron-41.1-47848F?style=flat-square&logo=electron)](https://www.electronjs.org/)
[![Tests](https://img.shields.io/badge/Vitest-1319%20passed-brightgreen?style=flat-square&logo=vitest)](https://vitest.dev/)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)

---

## 项目概述

MIMI Music Player 是一款面向高要求的桌面与 Web 音频工作台，核心围绕三大工程目标构建：**发烧级音频管线**、**真实声学驱动的可视化引擎** 与 **低摩擦的流体微交互**。

区别于常规网页播放器采用的随机循环动画或呆板固定底栏，MIMI 直接将单例 Web Audio 硬件管道接驳至 WebGL/Canvas 着色器与自适应灵动岛组件，实现声学与视觉的毫秒级硬同步。

---

## 核心功能矩阵

### 1. 音频管线与 DSP 处理系统

- **单例 AudioContext 架构与看门狗机制**：全局维持单一 `AudioContext` 实例，零内存碎片分配。内置 `AudioContextWatchdog`，当系统睡眠唤醒或硬件音频输出设备切换导致上下文处于 `suspended` 时，0ms 自动静默自愈恢复。
- **30 段高精图示均衡器 (30-Band Graphic EQ)**：覆盖 $20\text{Hz}\sim20\text{kHz}$，30 个独立 Biquad 滤波器节点，每段支持 $\pm12\text{dB}$ 连续增益调节。提供监听平直、人声增强、重低音、摇滚、古典、爵士等多套专业预设。
- **17 节点创意 DSP 音效链**：
  - 包含母带卷积混响 (Master Reverb)、黑胶/磁带饱和失真、立体声拓宽 (Stereo Widener)、合唱 (Chorus)、法兰 (Flanger)、移相 (Phaser)、颤音 (Tremolo)、自动声相 (Auto-Pan)、超重低音 (MegaBass)、动态激励器、压限器、3D 空间化与 8D 环绕；
  - 配套 **2D XY 触控垫**，可实时在二维空间内平滑调制声场宽度与房间混响比例。
- **智能交叉混音 (Crossfade) 与 AB 循环**：支持 $0\sim15\text{秒}$ 任意可调的切歌无缝淡入淡出；支持毫秒级 AB 点时间轴标记与片段无限循环。
- **DSD 与高解析音频原生解码**：纯客户端解析 DSF/DFF (DSD64/128/256) 源码流与 24-bit/96kHz+ 高采样率 FLAC、APE、WAV、OGG、M4A。

### 2. 真实声学驱动的可视化套件 (Visual Suite V7)

全套 14+ 款可视化引擎均基于底层音频 FFT 实时数据（2048 采样点，60 FPS）硬运算，杜绝任何假动画与静态视频贴图：

| 引擎名称                               | 核心技术与视觉逻辑                                                                                                      |
| :------------------------------------- | :---------------------------------------------------------------------------------------------------------------------- |
| **动漫手书 MV (Anime Handwritten MV)** | AE 风格 3D 摄像机连续推镜与多平面景深分层，暖光掠影与电影胶片暗角；歌词随节奏动态呼吸逐字对齐、毛笔飞白与水墨溅射粒子。 |
| **温光浮字 (Cinematic Lyric Drift)**   | 电影级温润流光字体漂浮穿行，微弱次表面散射与景深虚化。                                                                  |
| **青绿千里 (Oriental Landscape)**      | 多层重峦叠嶂山脊线随低频起伏沉降，云雾在山脊间随中频流动飘逸。                                                          |
| **千里江山 (Cinematic Oriental Ink)**  | 宣纸水墨渗化质感，重低音落笔泼墨，高音提笔游丝。                                                                        |
| **流金丝绸 (Silk Aurora)**             | 纳维-斯托克斯流体物理速度场模拟，金色丝绸在空间中受声波冲击波拂动。                                                     |
| **流光幻境 (Spatial Mesh 3D)**         | WebGL 三维拓扑网格动态形变，法线随音频泛音颤动产生实时菲涅尔高光。                                                      |
| **神经之网 (Cyberpunk Particles)**     | 3,000+ 带电点粒子在力场突触节点间产生动态静电放电震颤。                                                                 |
| **生命流体 (Organic Fluid)**           | 水银液态金属球物理表面张力解算，随瞬态节奏产生有机形变与镜面反射。                                                      |
| **极光幻影 (Aurora Wave)**             | 多层高斯流光波纹交织起伏，模拟真实极光的大气等离子体波动。                                                              |
| **频谱奇点 (Spectrum Ring)**           | 环形引力场奇点，圆周多频段雷达波束在空间极坐标系中发散激荡。                                                            |
| **星海漫游 (Nebula Field)**            | 3D 星际跃迁穿越视效，飞行速度与视角随重低音瞬态动态拉伸缩放。                                                           |
| **量子空间 (Vinyl Groove)**            | 3D 旋转黑胶唱盘与微距音轨纹路微观模拟，光轨在唱针与沟槽间流淌。                                                         |
| **赛博矩阵 (Cyber Matrix)**            | 赛博数码雨代码流，受高频瞬态冲击触发字符雨爆冲。                                                                        |
| **棱镜脉冲 (Prism Pulse)**             | 多棱镜光学折射几何分形，白光束穿透晶体产生光谱色散脉冲。                                                                |

### 3. Mineradio 3D 空间唱片架 (v0.2 SPATIAL)

- **舞台展开 (Stage) 与 侧栏透视 (Side) 双模态**：通过按键快速切换半包围剧场陈列与 $55^\circ$ 透视层叠陈列；
- **液态玻璃双层内发光边缘**：彻底剔除直角多边形线框，改用卡片内部贴合 $36\text{px}$ 倒角的双层微透光线条（外层微透光边 + 内层香槟金光晕）；
- **跨端无痕横向滚动**：内嵌 `no-scrollbar` 规则彻底隐藏系统原生灰白水平条，支持普通鼠标滚轮直接横向平移（`onWheel` 映射）；
- **二级曲目详情看板 (Tracklist Billboard)**：点击任意唱片即可平滑升起曲目列表瀑布流，支持一键整单播放、快速插队与单曲筛选。

### 4. 灵动岛多形态流体播放器

自适应四级渐进式披露交互：

```
[Level 1] 极简灵动岛 (动态跳频微胶囊)
   ↓ (点击 / 悬停)
[Level 2] 舒展控制胶囊 (396px–440px，常驻双语微歌词，0ms 响应按键组)
   ↓ (展开)
[Level 3] 悬浮大卡片 (波形/频谱切换，NowPlayingHalo 氛围光晕皮肤)
   ↓ (全屏)
[Level 4] 沉浸式全屏舞台 (双栏大唱片，唱针起落，动态歌词瀑布墙)
```

- **内切圆安全边距**：严格校准胶囊内边距（`pl-3.5 pr-4.5`）与统一的 `w-7 h-7` 按钮规范，杜绝圆角边缘对操作按钮的任何裁切挤压；
- **全局自由物理拖拽**：支持平滑惯性阻尼拖拽，松手后智能贴合视口安全边界。

### 5. 纯本地隔空手势控制 (MediaPipe)

- **21 关节点三维骨骼解算**：基于 `@mediapipe/tasks-vision` 模型驱动；
- **直觉交互指令**：
  - 🖐️ 向左 / 向右轻挥：切至上一首 / 下一首；
  - ✊ 握拳：瞬时静音并暂停播放；
  - ✋ 张开手掌：恢复播放；
  - ☝️ 空中垂直捏合滑动：连续调节音量与时间轴拖动。
- **零上云隐私安全**：视频帧完全在设备本地内存与 WebAssembly/WebGL 管线中实时处理，绝不保存、上传或回传任何图像与生物特征数据。

### 6. 2D 情感矩阵与音乐分析

- **情绪象限映射 (Valence × Energy)**：将曲目投射在愉悦度（悲伤 ↔ 欢快）与能量值（轻柔 ↔ 激烈）的二维声学空间；
- **矩形圈选播放**：在坐标系中框选任意区间，即刻生成契合当前心境的智能播放列表；
- **AI 随身乐评 (AI Liner Notes)**：自动结合歌词语义、调式旋律与背景信息生成文学化解读；
- **听觉基因图谱 (Auditory Gene)**：长期追踪与解构您在节奏偏好、音色冷暖与旋律复杂度上的偏好演进。

### 7. 多源聚合网络与本地曲库资产

- **多平台聚合音源调度**：聚合主流音源检索通道，支持流式解密与自动主备源降级重试；
- **全格式本地高保真导入**：基于后台 Web Worker 异步高吞吐解析 FLAC, APE, WAV, MP3, OGG, M4A, DSF, DFF 等格式的 ID3/Vorbis 元数据与高清内嵌封面；
- **IndexedDB 持久化引擎 (`VibeMusicDB` v3)**：结构化离线存储音频二进制流与曲目元数据，离线断网亦可全功能回放；
- **智能歌单引擎**：支持以声明式条件组合过滤曲目（如 `playCount > 10 && genre == "Jazz"`），内容随曲库变动实时自动更新；
- **曲库健康度诊断**：自动扫描死链、乱码元数据与缺失封面的曲目，支持一键批量清理与修复。

### 8. 歌词渲染与社交海报工坊

- **三语融合高精度 LRC 解析**：毫秒级时间轴同步，原生合并 原文、中文翻译 与 罗马音/拼音音译；
- **逐字卡拉 OK 炫彩流动**：随音频播放时钟精确推进字符渐变上色；
- **社交海报工坊**：内置 12+ 套印刷级版式（黑胶封套、复古拍立得、磁带卡带、CD 水晶盒、画报排版），支持一键导出 2x/3x 无损高清长图。

---

## 系统分层拓扑架构

```text
┌────────────────────────────────────────────────────────────────────────────┐
│                         Presentation Layer (React 19)                      │
│  ┌───────────────┐  ┌──────────────────┐  ┌─────────────────────────────┐  │
│  │ Primary Views │  │ Feature Panels   │  │ Visualizers (V7 Engine)     │  │
│  │ (Home/Player/ │  │ (Queue/Search/   │  │ 14+ Canvas/WebGL Effects    │  │
│  │  Emotion3D)   │  │  Settings/EQ...) │  │ + Handwritten MV + Folia    │  │
│  └───────┬───────┘  └────────┬─────────┘  └──────────────┬──────────────┘  │
│          └───────────────────┼───────────────────────────┘                 │
├──────────────────────────────┴─────────────────────────────────────────────┤
│                     Apple Glass Component Design System                    │
│     GlassPanel | GlassDrawer | GlassModal | GlassCard | GlassSlider        │
│     LiquidGlassFilter | VirtualList | PanelErrorBoundary | LazyPanel       │
├────────────────────────────────────────────────────────────────────────────┤
│                       State Layer (Zustand 60 Stores)                      │
│  • Playback: playerStore, audioStore, queueStore, playbackRuntimeStore     │
│  • Audio/DSP: eqStore, audioEffectsStore, crossfadeStore, dsdProcessing    │
│  • AI/Emotion: emotionStore, aiStore, useAIAgentStore, linerNotesStore     │
│  • Library/Data: libraryManagerStore, playlistStore, backupRestoreStore    │
│  • UI/Shell: uiStore, visualSettingsStore, gestureSettingsStore            │
├────────────────────────────────────────────────────────────────────────────┤
│                       Logic, Services & Worker Layer                       │
│  ┌───────────────────┐  ┌───────────────────┐  ┌────────────────────────┐  │
│  │ Custom Hooks (19) │  │ Domain Services   │  │ Dedicated Web Workers  │  │
│  │ • useAudioPlayer  │  │ • MultiResolver   │  │ • conversion.worker.ts │  │
│  │ • useLyric        │  │ • BeatMapAnalyzer │  │ • dsd.worker.ts        │  │
│  │ • useGesture      │  │ • WorkerPool      │  │ • waveform.worker.ts   │  │
│  └───────────────────┘  └───────────────────┘  └────────────────────────┘  │
├────────────────────────────────────────────────────────────────────────────┤
│                       Core Audio Engine (Singleton)                        │
│   HTML5 Audio / Decoded Buffer → AudioContext Singleton                    │
│   → 30-Band EQ → 17 Effects Manager → Crossfade Mixer → Master Gain        │
│   → AnalyserNode (Fast Fourier Transform 2048-sample) → Destination        │
├────────────────────────────────────────────────────────────────────────────┤
│                       Infrastructure & Cross-Platform                      │
│   Next.js 16 (App Router) │ Electron 41 │ IndexedDB (VibeMusicDB)          │
│   LocalStorage │ Web Audio API │ WebRTC (MediaPipe) │ FastAPI Python 后端  │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 常用键盘快捷键

| 快捷键                                      | 功能描述                                     |
| :------------------------------------------ | :------------------------------------------- |
| <kbd>Space</kbd>                            | 播放 / 暂停                                  |
| <kbd>→</kbd> / <kbd>←</kbd>                 | 快进 5 秒 / 快退 5 秒                        |
| <kbd>↑</kbd> / <kbd>↓</kbd>                 | 音量增加 5% / 音量减小 5%                    |
| <kbd>Shift</kbd> + <kbd>→</kbd>             | 下一首                                       |
| <kbd>Shift</kbd> + <kbd>←</kbd>             | 上一首                                       |
| <kbd>M</kbd>                                | 切换 3D 空间唱片架模式 (舞台展开 ↔ 侧栏透视) |
| <kbd>Q</kbd> 或 <kbd>⌘</kbd> + <kbd>L</kbd> | 呼出 / 隐藏 3D 空间唱片架抽屉                |
| <kbd>F</kbd>                                | 切换全屏播放器视图                           |
| <kbd>V</kbd>                                | 进入 / 退出可视化视听剧场                    |
| <kbd>E</kbd>                                | 打开 2D 情感矩阵                             |
| <kbd>L</kbd>                                | 切换歌词悬浮面板                             |
| <kbd>S</kbd>                                | 呼出全局搜索窗口                             |
| <kbd>Esc</kbd>                              | 关闭当前弹窗、抽屉或退回主视图               |

---

## 环境准备与快速启动

### 系统要求

- **Node.js**：`>= 20.11.0`（推荐 Node 20 LTS 或 Node 22）
- **npm**：`>= 10.0.0`
- **Python（可选）**：`>= 3.10`（若需运行本地 FastAPI + ModelScope 乐理特征分析后端）

### 1. 克隆代码库

```bash
git clone https://github.com/NanQiaoMi/music_source_code.git
cd music_source_code
```

### 2. 安装项目依赖

```bash
npm install --legacy-peer-deps
```

### 3. 环境配置 (可选)

```bash
cp .env.example .env.local
```

若需使用 AI 随身乐评与笔记功能，可在 `.env.local` 中填入兼容的 API Key。核心播放、3D 唱片架与全部可视化功能无需任何 Key 即可完整运行。

### 4. 启动开发服务器

```bash
# 启动 Web 前端服务 (默认监听 http://localhost:3025)
npm run dev
```

如需同时联调 Python 后端：

```bash
npm run dev:full
```

---

## 桌面端打包构建

通过 Electron 将 MIMI Music Player 打包为原生桌面应用：

```powershell
# Windows 环境 (PowerShell) - 一键打包 Portable 版与 NSIS 安装包
./scripts/build-desktop-win.ps1 -Clean
```

或使用标准 npm 脚本跨平台构建：

```bash
# Windows
npm run build:electron:win

# macOS
npm run build:electron:mac

# Linux
npm run build:electron:linux
```

打包产物输出至 `dist-electron/` 目录。

---

## 代码质量与测试规范

所有代码合并与发布均严格遵循零回归标准：

- **Strict TypeScript**：`tsconfig.json` 全局开启 `strict: true`，构建时 `ignoreBuildErrors: false`；
- **ESLint 零警告**：全工程源码维持 `0 errors / 0 warnings`；
- **自动化测试矩阵**：内置 206 个测试套件，**1319+ 个单元测试全部通过** (Vitest + jsdom)。

```bash
# 运行单元测试
npm run test -- --run

# 执行代码风格与规范检查
npm run lint

# 执行 TypeScript 严格类型检查
npx tsc --noEmit --incremental false
```

---

## 开源协议与版权

本项目采用 [MIT 许可证](LICENSE) 开源。

---

<div align="center">

**MIMI Music Player (Vibe Player)**  
_Developed with precision by 大咪小咪组_

</div>
