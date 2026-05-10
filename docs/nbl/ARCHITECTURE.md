# MIMI Music Player 系统架构文档

> **版本**: v1.0 | **创建日期**: 2026-05-10 | **架构类型**: SPA + Static Export + Electron

---

## 1. 系统分层架构

```
┌──────────────────────────────────────────────────────────────────┐
│                        UI Layer (React 19)                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────────┐  │
│  │  Views   │  │  Panels  │  │  Widgets  │  │  Visualizer    │  │
│  │(Home/    │  │(Queue/   │  │(DNA/     │  │  (V8 28        │  │
│  │ Player/  │  │ Settings/│  │ Stats/   │  │   effects)     │  │
│  │ Emotion) │  │ Search)  │  │ Radar)   │  │                │  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └───────┬────────┘  │
│       └─────────────┴─────────────┴───────────────┘            │
├──────────────────────────────────────────────────────────────────┤
│                    Glass Component Library                        │
│  GlassPanel | GlassDrawer | GlassModal | GlassCard               │
│  GlassButton | GlassSlider | LazyPanel | ErrorBoundary           │
│                        (src/components/shared/)                  │
├──────────────────────────────────────────────────────────────────┤
│                    Coordinator Layer (Phase 1)                    │
│  AudioCoordinator | QueueCoordinator | PlaybackCoordinator        │
│              — 解耦 Store 间接引用，管理跨 Store 事务             │
├──────────────────────────────────────────────────────────────────┤
│                    State Layer (Zustand 44 stores)                │
│  Core Audio: audioStore | playerStore | queueStore | eqStore     │
│  AI/Emotion: emotionStore | aiStore | recommendationStore        │
│  UI: uiStore | visualSettingsStore | visualizationV8Store        │
│  Library: playlistStore | favoritesStore | smartPlaylistStore    │
│  Data: searchStore | lyricsCoverStore | backupRestoreStore ...   │
├──────────────────────────────────────────────────────────────────┤
│                       Logic Layer                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────────┐  │
│  │  Hooks   │  │ Services │  │  Utils   │  │   Workers      │  │
│  │(16 hooks)│  │(7 files) │  │(10 files)│  │  (5 workers)   │  │
│  │useAudio/ │  │metadata/ │  │colorExt/ │  │waveform/dsd/   │  │
│  │useLyric/ │  │lyrics/   │  │format/   │  │fingerprint/    │  │
│  │useGesture│  │localMusic│  │validate/ │  │conversion/     │  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └───────┬────────┘  │
│       └─────────────┴─────────────┴───────────────┘            │
├──────────────────────────────────────────────────────────────────┤
│                      Audio Engine (Singleton)                     │
│  AudioEngine → DSPProcessor → AudioEffectsManager(17 effects)    │
│  → CrossfadeMixer → AudioGraphManager                             │
│  → AnalyserNode → AudioVisualizerManager                          │
├──────────────────────────────────────────────────────────────────┤
│                    Infrastructure Layer                            │
│  Next.js SSG(output:'export') | Electron | IndexedDB              │
│  localStorage | Web Audio API | Canvas/WebGL | Web Workers       │
└──────────────────────────────────────────────────────────────────┘
```

---

## 2. 目录结构与职责

```
src/
├── app/
│   ├── layout.tsx             # 根布局（dark mode, "use client"）
│   ├── page.tsx               # 主页面（lazy-load 各视图）
│   ├── data-manager/          # 数据管理页面
│   └── globals.css            # 全局样式（CSS 变量）
│
├── components/
│   ├── layout/                # 应用壳：Background, HeaderToolbar, PanelOrchestrator, PlayerView, HomeView
│   ├── player/                # 播放器UI：FloatingPlayer, QueuePanel, SearchPanel, MusicCardStack, Player3D
│   ├── visualization-v8/      # V8可视化系统（28 effects + RenderEngineManager + 面板）
│   ├── visualization/         # 旧版V7可视化（待清理）
│   ├── emotion/               # 情感矩阵：EmotionMatrixView, EmotionVisualizer
│   ├── lyrics/                # 歌词系统：FullscreenLyrics, LyricSettingsPanel, 搜索/导入/封面编辑
│   ├── library/               # 音乐库管理：DataManager, SmartPlaylistPanel, BackupRestorePanel, 等
│   ├── settings/              # 设置面板：SettingsPanel, AISettingsPanel, KeyboardShortcutsHelp, VisualSettings
│   ├── features-v7/           # 特性开关面板：ABLoop, AudioEffects, HealthCheck, Recording, ProfessionalTools
│   ├── interaction/           # 手势/语音/视觉：GestureController, FingerprintScanner, SpeechSynthesis
│   ├── audio/                 # 音频控制组件：Equalizer, CrossfadeMixer, SpectrumAnalyzer, TrackCutter
│   ├── widgets/               # 小部件：AI LinerNotes, DNA Journal, SleepTimer, InstantMix, GlassRadar
│   ├── shared/                # 共享组件
│   │   ├── Glass/             # Glass 组件库（GlassPanel, GlassDrawer, GlassModal, GlassCard）
│   │   ├── GlassButton.tsx
│   │   ├── GlassSlider.tsx
│   │   ├── GlobalPlayerBar.tsx
│   │   └── LazyPanel.tsx
│   ├── social/                # 分享面板
│   └── stats/                 # 统计数据可视化
│
├── store/                     # 44 个 Zustand Store（见下节）
├── lib/
│   ├── audio/                 # 核心音频引擎（AudioEngine, DSPProcessor, EffectsManager, CrossfadeMixer, GraphManager）
│   ├── three/                 # Three.js 场景管理器
│   ├── visualization/         # 可视化类型定义
│   ├── bootstrap.ts           # 应用启动编排
│   └── tokens.ts              # 设计系统 Tokens
│
├── hooks/                     # 16 个自定义 Hooks
├── services/                  # 7 个服务文件（元数据/歌词/本地音乐/封面缓存）
├── types/                     # 类型定义（song.ts, emotion.ts, electron.d.ts）
├── utils/                     # 工具函数（colorExtractor, formatTime, songValidation, recommendationLogic）
├── workers/                   # 5 个 Web Workers（conversion, dsd, fingerprint, totemTexture, waveform）
└── context/                   # AudioElementContext（音频元素共享）
```

---

## 3. 音频数据流

```
用户操作（点击播放）
  └─→ useAudioPlayer hook
        └─→ audioStore.play(track)
              └─→ AudioEngine.createMediaSource(track.url)
                    └─→ Audio Graph: [Source] → [30-band EQ]
                          → [DSP Chain] → [Effects Chain]
                          → [MasterGain] → [AnalyserNode] → Destination
                          → AudioVisualizerManager
                                └─→ V8 Effects (Canvas/WebGL)
                                      └─→ Screen
```

### 关键组件交互

| 组件 | 职责 | 依赖 |
|------|------|------|
| `AudioEngine` | AudioContext 单例，管理主音频图 | 无 |
| `DSPProcessor` | 模块化 DSP 链（EQ/压缩/混响/延迟/失真等） | AudioEngine |
| `AudioEffectsManager` | 17 种创意效果，动态重连音频图 | AudioEngine |
| `CrossfadeMixer` | 情感感知交叉淡入淡出 | AudioEngine |
| `AudioGraphManager` | 编程式音频节点图构建 | AudioEngine |
| `useAudioPlayer` | React hook 封装，事件监听 | audioStore, AudioEngine |
| `AudioVisualizerManager` | 桥接 AnalyserNode → 可视化 | AudioEngine |

---

## 4. Store 架构

### 4.1 Store 分类

| 类别 | Store 列表 | 数量 |
|------|-----------|------|
| 核心播放 | `audioStore`, `playerStore`, `queueStore`, `eqStore` | 4 |
| 音频效果 | `audioEffectsStore`, `audioProcessingStore`, `crossfadeStore` | 3 |
| 音频扩展 | `dsdProcessingStore`, `formatConversionStore`, `recordingStore`, `trackCuttingStore`, `waveformStore`, `hiresStore` | 6 |
| 播放控制 | `abLoopStore`, `sleepTimerStore`, `spectrumStore` | 3 |
| AI/情感 | `emotionStore`, `aiStore`, `linerNotesStore`, `knowledgeStore`, `recommendationStore` | 5 |
| 可视化 | `visualizationStore`, `visualizationV8Store`, `visualSettingsStore`, `totemStore`, `performanceV8Store` | 5 |
| UI | `uiStore`, `animationStore`, `gestureStore` | 3 |
| 库 | `playlistStore`, `playlistGroupStore`, `smartPlaylistStore`, `libraryManagerStore`, `libraryHealthStore` | 5 |
| 数据 | `favoritesStore`, `lyricsCoverStore`, `lyricsSearchStore`, `lyricSettingsStore`, `metadataEditorStore`, `searchStore`, `backupRestoreStore` | 7 |
| 其他 | `statsAchievementsStore`, `professionalModeStore`, `healthCheckStore`, `fingerprintStore`, `presetStore` | 5 |
| **总计** | | **46** |

### 4.2 当前耦合问题（需 Phase 1 解决）

```
严重耦合链:
  emotionStore ─→ aiStore (直接 import)
  emotionStore ─→ smartPlaylistStore (直接 import)
  smartPlaylistStore ─→ playlistStore (直接 import)
  audioStore ─→ 多个 store (动态 require())
  smartPlaylistStore ─→ emotionStore (循环引用风险)

目标模式（Phase 1 后）:
  Component → Coordinator → StoreA / StoreB
  Coordinator 作为单向依赖管理器，消除循环引用
```

---

## 5. 技术决策记录

| 决策 | 选择 | 理由 |
|------|------|------|
| 构建模式 | Static Export | 适配 Electron，不需要 Node.js 服务器 |
| 状态管理 | Zustand | 轻量、TypeScript 友好、无需 Provider |
| 样式方案 | Tailwind + OKLCH | 设计系统一致性、Apple 风格玻璃拟态 |
| 动画引擎 | Framer Motion | React 集成度最高、Spring Physics 支持 |
| 音频引擎 | Web Audio API | 浏览器原生、低延迟、无需外部依赖 |
| 可视化渲染 | Canvas 2D + WebGL | 28 个效果覆盖 2D/3D 全场景 |
| 持久化 | localStorage (Zustand persist) | 简单、无服务器依赖 |

---

## 6. 外部依赖

### 前端运行时
- `next`: 16.2.4 | `react`: 19.2.5 | `typescript`: 5.4.3
- `zustand`: 5.x | `framer-motion`: 12.x | `three`: 0.183
- `tailwindcss`: 3.4.x | `lucide-react`: 1.9
- `@ffmpeg/ffmpeg`: 0.12 | `@xenova/transformers`: 2.17

### 后端
- `fastapi` | `uvicorn` | `modelscope` | `torch`
- 12 个 AI 模型（情感分析、语音识别、TTS 等）