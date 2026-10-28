# MIMI Music Player 系统架构文档

> **版本**: v1.0 | **创建日期**: 2026-05-10 | **架构类型**: SPA + Next server（Web）/ Electron 本地 Next 运行时（冻结，D2/S7-4）

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
│         Coordinator Layer (Phase 1 — NOT LANDED)                  │
│  src/store/coordinator: 4 files / 0 imports (dead shim)          │
│  target: domain use-cases + typed events (see execution S6)       │
├──────────────────────────────────────────────────────────────────┤
│                    State Layer (Zustand 59 stores)                │
│  Core Audio: audioStore | playerStore | queueStore | eqStore     │
│  AI/Emotion: emotionStore | aiStore | recommendationStore        │
│  UI: uiStore | visualSettingsStore | visualizationV8Store        │
│  Library: playlistStore | favoritesStore | smartPlaylistStore    │
│  Data: searchStore | lyricsCoverStore | backupRestoreStore ...   │
├──────────────────────────────────────────────────────────────────┤
│                       Logic Layer                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────────┐  │
│  │  Hooks   │  │ Services │  │  Utils   │  │   Workers      │  │
│  │(19 hooks)│  │(18 files)│  │(10 files)│  │  (4 workers)   │  │
│  │useAudio/ │  │metadata/ │  │colorExt/ │  │waveform/dsd/   │  │
│  │useLyric/ │  │lyrics/   │  │format/   │  │fingerprint/    │  │
│  │useGesture│  │localMusic│  │validate/ │  │conversion/     │  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └───────┬────────┘  │
│       └─────────────┴─────────────┴───────────────┘            │
├──────────────────────────────────────────────────────────────────┤
│                      Audio Engine (Singleton)                     │
│  AudioEngine(EQ/master/analyser) → AudioEffectsManager(17 effects)│
│  → CrossfadeMixer → AnalyserNode → Visualization (V7)             │
│  DSPProcessor / AudioGraphManager: dead (未接主链, ~750 行)        │
├──────────────────────────────────────────────────────────────────┤
│                    Infrastructure Layer                            │
│  Next.js App Router (server build default) | Electron | IndexedDB │
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
│   ├── visualization-v8/      # V8 组件树未接线（dead code，待 S4 处置）
│   ├── visualization/         # 当前挂载的 V7 可视化（14 effects）
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
├── store/                     # 59 个 Zustand Store（见下节）
├── lib/
│   ├── audio/                 # 音频引擎（AudioEngine/EffectsManager/CrossfadeMixer/PlaybackClock；DSP/GraphManager 未接线）
│   ├── three/                 # Three.js 场景管理器
│   ├── visualization/         # 可视化类型定义
│   ├── bootstrap.ts           # 应用启动编排
│   └── tokens.ts              # 设计系统 Tokens
│
├── hooks/                     # 19 个生产 Hooks（useAudioPlayer 1,823 行）
├── services/                  # 18 个生产服务文件（resolver/缓存/元数据/歌词/worker pool 等）
├── types/                     # 类型定义（song.ts, emotion.ts, electron.d.ts）
├── utils/                     # 工具函数（colorExtractor, formatTime, songValidation, recommendationLogic）
├── workers/                   # 4 个 Web Workers（conversion, dsd, fingerprint, waveform）
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
                          → [MasterGain] → [AnalyserNode]
                          → [Effects Chain] → Destination
                          → V7 Visualization (Canvas 2D)
                                └─→ Screen
```

### 关键组件交互

| 组件                     | 职责                                      | 依赖                    |
| ------------------------ | ----------------------------------------- | ----------------------- |
| `AudioEngine`            | AudioContext 单例，管理主音频图           | 无                      |
| `DSPProcessor`           | 模块化 DSP 链（**未接线，dead code ~452 行**） | — |
| `AudioEffectsManager`    | 17 种创意效果，动态重连音频图             | AudioEngine             |
| `CrossfadeMixer`         | 情感感知交叉淡入淡出                      | AudioEngine             |
| `AudioGraphManager`      | 编程式节点图（**未接线，dead code ~300 行**） | — |
| `useAudioPlayer`         | React hook 封装，事件监听                 | audioStore, AudioEngine |
| `AudioVisualizerManager` | Analyser→可视化转发（lib 反向依赖 hooks，待 S2/S6 收敛） | AudioEngine |

---

## 4. Store 架构

### 4.1 Store 分类

当前实际 **59 个 store**（43 处 persist）。数量、persist key 与依赖边以 `scripts/perf/report-store-stats.mjs` 输出为准；分类与目标所有权见总计划 §4.2。

代表域：核心播放（playerStore/queueStore/audioStore/playbackRuntimeStore）、音频设置与效果、AI/情感、可视化、UI 壳、库/播放列表、数据与备份、账号/音源、统计/健康/预设等。迁移目标：playerStore（播放意图单一 owner）、queueStore（队列单一 owner）、playbackRuntimeStore（生命周期权威）、audioSettingsStore（原 audioStore 收缩）、uiShell/panel/toast/theme 拆分（S6）。

### 4.2 当前耦合现状（2026-10-21 实测）

- store 间静态 import 边 **25 条**（含 type-only；审计 A 的严格口径为 21 条，差异见 perf/README.md）；唯一强连通分量 **audioStore ↔ playlistStore**（audioStore.ts:6 ↔ playlistStore.ts:5）。
- **audioStore 是最大耦合源**：运行时依赖 queue/recommendation/player/playlist/eq/playbackRuntime 6 个 store；非测试导入者 86 文件、selector 189 处。
- **audioStore ↔ playerStore 双向 subscribe + 双持久化**（audio-store-v4 / player-store），播放期约 8 次/秒 localStorage 写。
- **src/store/coordinator/ 是 0 引用空壳**（4 文件，audioCoordinator/queueCoordinator 从未接线），不作为目标架构；目标是用例层 + 类型化事件（S6-9）与单一 owner 收敛。
- 完整清单、依赖图与迁移方案：`docs/nbl/plans/2026-10-21-arch-perf-execution/S6-state-architecture.md`。

---

## 5. 技术决策记录

| 决策       | 选择                           | 理由                                  |
| ---------- | ------------------------------ | ------------------------------------- |
| 构建模式   | App Router 默认 server build；STATIC_EXPORT 条件导出（桌面链路待 S7） | 浏览器由 Next 服务承载；Windows 桌面计划捆绑本地 Next 运行时 |
| 状态管理   | Zustand                        | 轻量、TypeScript 友好、无需 Provider  |
| 样式方案   | Tailwind + OKLCH               | 设计系统一致性、Apple 风格玻璃拟态    |
| 动画引擎   | Framer Motion                  | React 集成度最高、Spring Physics 支持 |
| 音频引擎   | Web Audio API                  | 浏览器原生、低延迟、无需外部依赖      |
| 可视化渲染 | Canvas 2D（V7 当前挂载）/ WebGL（Shelf3D） | 当前 14 个 V7 效果；V8 组件树未接线 |
| 持久化     | localStorage (Zustand persist) | 简单、无服务器依赖                    |

---

## 6. 外部依赖

### 前端运行时

- `next`: 16.2.4 | `react`: 19.2.5 | `typescript`: 5.4.3
- `zustand`: 5.x | `framer-motion`: 12.x | `three`: 0.183
- `tailwindcss`: 3.4.x | `lucide-react`: 1.9
- `@ffmpeg/ffmpeg`: 0.12 | `@xenova/transformers`: 2.17（src 0 引用，待移除）

### 后端

- `fastapi` | `uvicorn` | `modelscope` | `torch`
- 当前 backend 仅 health/capabilities 桩 + 3 个占位模型；capabilities 全为 available:false（12 模型为历史规划）