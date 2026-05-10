
# Vibe Music Player 项目描述文档

## 1. 项目概述

**Vibe Music Player** 是一款高端沉浸式音频可视化音乐播放器，将音乐聆听体验提升为多感官的视觉盛宴。项目采用现代化的玻璃拟态（Glassmorphism）UI设计，配合先进的 Canvas/WebGL 双引擎渲染技术，提供 25 种专业级音频可视化效果。

### 1.1 项目定位

- **目标用户**：音响发烧友、视觉艺术爱好者、数字内容创作者
- **核心价值**：将音乐转化为可视化的艺术表达
- **设计理念**：视觉优先、数据驱动、高品质工艺

### 1.2 版本信息

| 属性 | 值 |
|------|-----|
| 当前版本 | V8.0 |
| 项目名称 | Vibe Music Player |
| 许可证 | MIT License |
| 开发状态 | 活跃开发中 |

---

## 2. 技术栈

### 2.1 前端技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| **Next.js** | ^16.2.4 | React 全栈框架 |
| **React** | ^19.2.5 | UI 组件库 |
| **TypeScript** | ^5.4.3 | 类型安全 |
| **Tailwind CSS** | ^3.4.1 | 原子化 CSS 框架 |
| **Framer Motion** | ^12.38.0 | 动画库 |
| **Zustand** | ^5.0.12 | 状态管理 |
| **Three.js** | ^0.183.2 | WebGL 3D 渲染 |
| **Lucide React** | ^1.9.0 | 图标库 |

### 2.2 可视化技术

| 技术 | 用途 |
|------|------|
| **Canvas 2D** | 2D 渲染引擎（频谱、粒子、波形等） |
| **Three.js (WebGL)** | 3D 渲染引擎（星场、隧道、雕塑等） |
| **Web Audio API** | 实时音频分析与处理 |

### 2.3 后端技术栈（可选）

| 技术 | 版本 | 用途 |
|------|------|------|
| **FastAPI** | ≥0.109.0 | Python Web API 框架 |
| **Uvicorn** | ≥0.27.0 | ASGI 服务器 |
| **PyTorch** | ≥2.1.0 | AI 模型推理 |
| **ModelScope** | ≥1.14.0 | AI 模型管理 |
| **Transformers** | ≥4.36.0 | NLP 模型支持 |

### 2.4 桌面应用技术

| 技术 | 版本 | 用途 |
|------|------|------|
| **Electron** | ^41.1.0 | 跨平台桌面应用框架 |
| **electron-builder** | ^26.8.1 | 应用打包工具 |

### 2.5 开发工具

| 工具 | 用途 |
|------|------|
| **ESLint** | 代码规范检查 |
| **Prettier** | 代码格式化 |
| **PostCSS** | CSS 后处理 |
| **Autoprefixer** | CSS 兼容性处理 |

---

## 3. 项目架构

### 3.1 目录结构

```
vibe-music-player/
├── src/                              # 源代码目录
│   ├── app/                          # Next.js App Router
│   │   ├── layout.tsx               # 根布局组件
│   │   ├── page.tsx                 # 主页面
│   │   ├── globals.css              # 全局样式
│   │   └── data-manager/            # 数据管理页面
│   │
│   ├── components/                   # React 组件库
│   │   ├── visualization/           # 旧版可视化系统
│   │   │   ├── effects/             # 可视化效果实现
│   │   │   ├── VisualizationView.tsx
│   │   │   ├── VisualizationProgressBar.tsx
│   │   │   └── VisualizationSettingsPanel.tsx
│   │   │
│   │   ├── visualization-v8/        # V8.0 可视化系统
│   │   │   ├── effects/             # 25种可视化效果
│   │   │   ├── engines/             # 渲染引擎管理
│   │   │   ├── panels/              # 控制面板
│   │   │   ├── shared/              # 共享组件
│   │   │   └── VisualizationViewV8.tsx
│   │   │
│   │   ├── features-v7/             # V7 功能组件
│   │   ├── shared/                  # 共享组件
│   │   └── [其他UI组件].tsx
│   │
│   ├── hooks/                        # 自定义 Hooks
│   │   ├── useVisualizationV8.ts    # V8 可视化 Hook
│   │   ├── useAudioPlayer.ts        # 音频播放器 Hook
│   │   ├── useHandGesture.ts        # 手势识别 Hook
│   │   ├── useLyricParser.ts        # 歌词解析 Hook
│   │   └── useDynamicTheme.ts       # 动态主题 Hook
│   │
│   ├── store/                        # Zustand 状态管理
│   │   ├── audioStore.ts            # 音频状态
│   │   ├── visualizationV8Store.ts  # 可视化状态
│   │   ├── animationStore.ts        # 动画状态
│   │   ├── presetStore.ts           # 预设状态
│   │   ├── performanceV8Store.ts    # 性能监控状态
│   │   └── [其他Store].ts
│   │
│   ├── lib/                          # 核心库
│   │   ├── audio/                   # 音频处理库
│   │   │   ├── AudioGraphManager.ts # 音频图管理器
│   │   │   ├── AudioEffectsManager.ts # 音频效果管理器
│   │   │   ├── AudioVisualizerManager.ts # 可视化管理器
│   │   │   └── DSPProcessor.ts      # 数字信号处理
│   │   ├── three/                   # Three.js 场景
│   │   │   └── ThreeJSScene.ts      # 3D 场景管理
│   │   └── visualization/           # 可视化类型定义
│   │       ├── types.ts             # 类型定义
│   │       └── animationTypes.ts    # 动画类型
│   │
│   ├── services/                     # 服务层
│   │   ├── localMusicService.ts     # 本地音乐服务
│   │   ├── lyricsService.ts         # 歌词服务
│   │   ├── lyricsSearchService.ts   # 歌词搜索服务
│   │   ├── audioMetadata.ts         # 音频元数据服务
│   │   ├── coverCache.ts            # 封面缓存服务
│   │   └── metadataStorage.ts       # 元数据存储
│   │
│   ├── utils/                        # 工具函数
│   │   ├── formatTime.ts            # 时间格式化
│   │   ├── colorExtractor.ts        # 颜色提取
│   │   ├── dataIO.ts                # 数据导入导出
│   │   └── folderImport.ts          # 文件夹导入
│   │
│   ├── workers/                      # Web Workers
│   │   ├── waveform.worker.ts       # 波形处理
│   │   ├── fingerprint.worker.ts    # 音频指纹
│   │   ├── dsd.worker.ts            # DSD 处理
│   │   └── conversion.worker.ts     # 格式转换
│   │
│   ├── context/                      # React Context
│   │   └── AudioElementContext.tsx   # 音频元素上下文
│   │
│   ├── data/                         # 静态数据
│   │   └── songsData.ts             # 示例歌曲数据
│   │
│   └── types/                        # 类型定义
│       └── electron.d.ts            # Electron 类型
│
├── backend/                          # 后端服务（可选）
│   ├── main.py                      # FastAPI 主入口
│   ├── api/                         # API 路由
│   │   ├── health.py                # 健康检查
│   │   └── [其他API].py
│   ├── core/                        # 核心配置
│   │   ├── config.py                # 配置管理
│   │   └── model_manager.py         # 模型管理
│   ├── models/                      # AI 模型
│   │   ├── audio_processing.py      # 音频处理模型
│   │   ├── speech_recognition.py    # 语音识别模型
│   │   ├── speech_synthesis.py      # 语音合成模型
│   │   ├── text_understanding.py    # 文本理解模型
│   │   ├── translation.py           # 翻译模型
│   │   └── vision_processing.py     # 视觉处理模型
│   ├── requirements.txt             # Python 依赖
│   └── setup.py                     # 安装脚本
│
├── electron/                         # Electron 桌面应用
│   ├── main/
│   │   └── index.js                 # 主进程入口
│   └── preload/
│       └── index.js                 # 预加载脚本
│
├── public/                           # 静态资源
│   ├── default-cover.svg            # 默认封面
│   ├── default-cover.png
│   ├── default-cover.ico
│   └── default-cover.icns
│
├── scripts/                          # 构建脚本
│   ├── clean-port.js                # 端口清理
│   ├── start-full.js                # 完整启动脚本
│   └── local/                       # 本地开发脚本
│
├── musicapi/                         # 音源 API（第三方）
├── docs/                             # 项目文档
├── skills/                           # 设计技能库
├── package.json                      # 项目配置
├── next.config.js                    # Next.js 配置
├── tailwind.config.ts                # Tailwind 配置
├── tsconfig.json                     # TypeScript 配置
├── .eslintrc.json                    # ESLint 配置
├── .prettierrc                       # Prettier 配置
└── README.md                         # 项目说明
```

### 3.2 架构设计原则

1. **组件化设计**：所有 UI 元素均封装为独立的 React 组件
2. **状态集中管理**：使用 Zustand 进行全局状态管理
3. **插件化效果系统**：可视化效果采用插件架构，易于扩展
4. **双渲染引擎**：Canvas 2D 和 WebGL 双引擎，自动降级
5. **响应式设计**：适配不同屏幕尺寸

---

## 4. 核心功能模块

### 4.1 音频播放系统

#### 4.1.1 音频状态管理 (`audioStore.ts`)

音频播放系统是项目的核心，使用 Zustand 管理所有音频相关状态：

```typescript
interface AudioState {
  // 基础播放状态
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  playbackRate: number;
  loopMode: LoopMode;  // "none" | "single" | "all" | "shuffle"
  
  // 当前歌曲信息
  currentSong: Song | null;
  queue: Song[];
  currentIndex: number;
  
  // 均衡器设置
  eqBands: number[];  // 30段均衡器
  currentEQPreset: EQPreset;
  isEQEnabled: boolean;
  
  // 音频增强
  stereoEnhance: number;
  surroundSound: number;
  bassBoost: number;
  trebleBoost: number;
  vocalEnhance: number;
  loudnessNormalization: boolean;
  
  // 高级功能
  gaplessPlayback: boolean;  // 无缝播放
  fadeInDuration: number;
  fadeOutDuration: number;
}
```

#### 4.1.2 音频图管理器 (`AudioGraphManager.ts`)

负责 Web Audio API 的音频节点管理和连接：

```typescript
class AudioGraphManager {
  private context: AudioContext;
  private nodes: Map&lt;string, AudioNodeInfo&gt;;
  private masterGain: GainNode;
  private analyser: AnalyserNode;
  private compressor: DynamicsCompressorNode;
  
  // 创建各种音频节点
  createSourceNode(id, audioElement): MediaElementAudioSourceNode;
  createGainNode(id, gain): GainNode;
  createFilterNode(id, type, frequency, Q): BiquadFilterNode;
  createCompressorNode(id, threshold, knee, ratio): DynamicsCompressorNode;
}
```

#### 4.1.3 音频数据接口

```typescript
interface AudioData {
  frequencyData: Uint8Array;   // 频率数据
  waveformData: Uint8Array;    // 波形数据
  bass: number;                // 低频能量 (0-1)
  mid: number;                 // 中频能量 (0-1)
  treble: number;              // 高频能量 (0-1)
  full: number;                // 全频能量 (0-1)
  isBeat: boolean;             // 是否检测到节拍
  bpm: number;                 // 节拍速度
}
```

### 4.2 可视化系统

#### 4.2.1 效果插件接口 (`EffectPlugin`)

所有可视化效果都实现统一的插件接口：

```typescript
interface EffectPlugin {
  id: string;                    // 唯一标识
  name: string;                  // 显示名称
  category: EffectCategory;      // 效果分类
  description: string;           // 效果描述
  preferredEngine: RenderEngine; // 首选渲染引擎
  parameters: EffectParameterDefinition[];  // 参数定义
  
  // 生命周期方法
  init: (ctx: RenderContext) =&gt; void;
  render: (ctx: RenderContext, audioData: AudioData, params: Record&lt;string, any&gt;) =&gt; void;
  resize: (width: number, height: number) =&gt; void;
  destroy: (ctx?: RenderContext) =&gt; void;
}
```

#### 4.2.2 效果分类

| 分类 | ID | 数量 | 代表效果 |
|------|-----|------|----------|
| **频谱类** | `spectrum` | 4 | 镜像频谱、环形频谱、频谱瀑布、频谱螺旋 |
| **粒子类** | `particles` | 8 | 粒子爆发、粒子网格、粒子流场、粒子轨迹、粒子星云、粒子引力、粒子旋涡、音频爆炸 |
| **形状类** | `shapes` | 5 | 波形、音频形状、音频绘画、振动几何、音频水晶 |
| **几何类** | `geometry` | 2 | 分形几何、万花筒 |
| **物理类** | `physics` | 1 | 弹簧系统 |
| **空间类** | `space` | 5 | 星场穿越、隧道飞行、3D网格、音频雕塑、音频液体 |

#### 4.2.3 25种可视化效果清单

| 序号 | 效果ID | 名称 | 渲染引擎 | 描述 |
|------|--------|------|----------|------|
| 1 | spectrum-modern | 镜像频谱 | Canvas | 现代胶囊状频谱柱，支持镜像显示 |
| 2 | ring-spectrum-v8 | 环形频谱 | Canvas | 环形排列的频谱显示 |
| 3 | spectrum-waterfall-v8 | 频谱瀑布 | Canvas | 滚动式频谱瀑布效果 |
| 4 | spectrum-spiral-v8 | 频谱螺旋 | Canvas | 螺旋状频谱排列 |
| 5 | particle-burst | 粒子爆发 | Canvas | 音频驱动的粒子从中心爆发 |
| 6 | particle-grid-v8 | 粒子网格 | Canvas | 粒子连接形成网格 |
| 7 | particle-flow-field-v8 | 粒子流场 | Canvas | 流动场中的粒子效果 |
| 8 | particle-trail-v8 | 粒子轨迹 | Canvas | 粒子拖尾轨迹效果 |
| 9 | particle-nebula-v8 | 粒子星云 | WebGL | 3D 星云粒子效果 |
| 10 | particle-gravity-v8 | 粒子引力 | Canvas | 引力场粒子系统 |
| 11 | particle-vortex-v8 | 粒子旋涡 | Canvas | 旋涡状粒子效果 |
| 12 | particle-explosion-v8 | 音频爆炸 | Canvas | 音频触发的爆炸效果 |
| 13 | waveform-v8 | 波形V8 | Canvas | 经典音频波形显示 |
| 14 | audio-shape-v8 | 音频形状 | Canvas | 几何形状随音频变形 |
| 15 | audio-painting-v8 | 音频绘画 | Canvas | 抽象画笔绘画效果 |
| 16 | vibration-geometry-v8 | 振动几何 | Canvas | 几何形状振动效果 |
| 17 | audio-crystal-v8 | 音频水晶 | WebGL | 3D 水晶折射效果 |
| 18 | fractal-geometry-v8 | 分形几何 | Canvas | 分形图形生成 |
| 19 | kaleidoscope-v8 | 万花筒 | Canvas | 镜像万花筒效果 |
| 20 | spring-system-v8 | 弹簧系统 | Canvas | 物理弹簧模拟 |
| 21 | star-field-v8 | 星场穿越 | WebGL | 3D 星场飞行效果 |
| 22 | tunnel-flight-v8 | 隧道飞行 | WebGL | 3D 隧道飞行效果 |
| 23 | space-grid-v8 | 3D网格 | WebGL | 空间网格波浪效果 |
| 24 | audio-sculpture-v8 | 音频雕塑 | WebGL | 3D 雕塑变形效果 |
| 25 | audio-liquid-v8 | 音频液体 | WebGL | 流体模拟效果 |

#### 4.2.4 参数系统

每个效果支持三层参数模式：

| 模式 | 参数数量 | 适用场景 |
|------|----------|----------|
| **基础模式** | 3-5个 | 普通用户快速调整 |
| **专业模式** | 10-15个 | 进阶用户精细控制 |
| **专家模式** | 全部 | 专业用户深度定制 |

参数类型支持：
- `number` - 数值滑块
- `color` - 颜色选择器
- `boolean` - 开关切换
- `select` - 下拉选择
- `vector2` - 2D向量
- `vector3` - 3D向量

#### 4.2.5 双渲染引擎管理 (`RenderEngineManager.tsx`)

系统支持 Canvas 2D 和 WebGL 双引擎，并提供自动降级机制：

```typescript
const selectActualEngine = (preferred: RenderEngine): RenderEngine =&gt; {
  if (preferred === "webgl" &amp;&amp; !isWebGLAvailable) {
    return "canvas";  // WebGL 不可用时降级到 Canvas
  }
  if (preferred === "auto") {
    return isWebGLAvailable ? "webgl" : "canvas";
  }
  return preferred;
};
```

### 4.3 预设管理系统

#### 4.3.1 预设数据结构

```typescript
interface EffectPreset {
  id: string;
  name: string;
  description?: string;
  effectId: string;
  thumbnail?: string;
  tags: string[];
  author?: string;
  createdAt: number;
  updatedAt: number;
  isSystem: boolean;       // 是否系统预设
  isFavorite: boolean;     // 是否收藏
  parameters: Record&lt;string, any&gt;;
  audioDrivenConfig?: Record&lt;string, any&gt;;
  animationKeyframes?: any[];
}
```

#### 4.3.2 预设功能

- 保存当前效果参数为预设
- 加载已保存的预设
- 导入/导出预设文件（JSON格式）
- 收藏喜欢的预设
- 预设分类标签管理
- 系统预设库

### 4.4 动画时间轴系统

#### 4.4.1 同步模式

| 模式 | 描述 |
|------|------|
| **音频同步** | 参数随音乐节拍/频谱变化 |
| **时间轴同步** | 基于时间线的关键帧动画 |
| **混合模式** | 音频 + 时间轴双重驱动 |

#### 4.4.2 动画预设

| 预设名称 | 描述 |
|---------|------|
| 跟随节拍 | 参数随音乐节拍变化 |
| 低频驱动 | 主要响应低频（贝斯） |
| 全频响应 | 响应全频段频谱 |
| 渐变变化 | 参数缓慢平滑过渡 |
| 脉冲效果 | 节拍时产生脉冲 |

### 4.5 手势控制系统

基于 MediaPipe 实现的手势识别：

- **手掌追踪**：移动手掌控制虚拟光标
- **左右摆手**：切换歌曲卡片
- **握拳手势**：选择/确认操作
- **食指点击**：模拟鼠标点击

### 4.6 性能监控系统

#### 4.6.1 监控指标

- **FPS** - 帧率（目标 30/60fps）
- **CPU 使用率** - 音频分析 + 渲染开销
- **内存使用量** - 当前内存占用
- **绘制调用次数** - 每帧绘制调用数
- **渲染引擎** - 当前使用的渲染引擎

#### 4.6.2 性能档位

| 档位 | 帧率目标 | 粒子限制 | WebGL 质量 |
|------|---------|---------|-----------|
| 低 | 30fps | 1000 | 低 |
| 中 | 30fps | 3000 | 中 |
| 高 | 60fps | 8000 | 高 |
| 极致 | 60fps+ | 20000+ | 超高 |

---

## 5. UI 组件系统

### 5.1 玻璃拟态组件

项目采用统一的玻璃拟态（Glassmorphism）设计语言：

| 组件 | 描述 |
|------|------|
| `GlassCard` | 玻璃卡片容器 |
| `GlassButton` | 玻璃风格按钮 |
| `GlassSlider` | 玻璃风格滑块 |
| `GlassToast` | 玻璃风格通知 |

### 5.2 核心 UI 组件

| 组件 | 功能 |
|------|------|
| `MusicCardStack` | 堆叠式音乐卡片交互 |
| `Player3D` | 3D 立体播放器 |
| `LyricVisualizer` | 歌词可视化显示 |
| `FullscreenLyrics` | 全屏歌词模式 |
| `DesktopLyrics` | 桌面歌词（Electron） |
| `AudioEqualizer` | 音频均衡器界面 |
| `SearchPanel` | 搜索面板 |
| `SettingsPanel` | 设置面板 |
| `QueuePanel` | 播放队列面板 |
| `HistoryPanel` | 播放历史面板 |
| `SmartPlaylistPanel` | 智能播放列表 |
| `LocalMusicManager` | 本地音乐管理器 |

### 5.3 专业功能组件

| 组件 | 功能 |
|------|------|
| `AudioProcessingPanel` | 音频处理面板 |
| `FormatConverter` | 格式转换器 |
| `TrackCutter` | 音轨切割器 |
| `DSDConverter` | DSD 格式转换 |
| `FingerprintScannerPanel` | 音频指纹扫描 |
| `BatchMetadataEditor` | 批量元数据编辑 |
| `LyricsSearchPanel` | 歌词搜索 |
| `LyricsImportPanel` | 歌词导入 |
| `CrossfadeMixer` | 交叉淡入淡出混音 |
| `RecordingPanel` | 录音面板 |
| `SpeechSynthesisPanel` | 语音合成面板 |

---

## 6. 状态管理架构

### 6.1 Zustand Stores

项目使用 Zustand 进行集中式状态管理，包含以下主要 Store：

| Store | 文件 | 职责 |
|-------|------|------|
| `audioStore` | `audioStore.ts` | 音频播放状态、均衡器、音效 |
| `visualizationV8Store` | `visualizationV8Store.ts` | 可视化效果状态 |
| `animationStore` | `animationStore.ts` | 动画系统状态 |
| `presetStore` | `presetStore.ts` | 预设管理状态 |
| `performanceV8Store` | `performanceV8Store.ts` | 性能监控状态 |
| `uiStore` | `uiStore.ts` | UI 交互状态 |
| `playlistStore` | `playlistStore.ts` | 播放列表状态 |
| `queueStore` | `queueStore.ts` | 播放队列状态 |
| `favoritesStore` | `favoritesStore.ts` | 收藏状态 |
| `searchStore` | `searchStore.ts` | 搜索状态 |
| `gestureStore` | `gestureStore.ts` | 手势控制状态 |
| `audioEffectsStore` | `audioEffectsStore.ts` | 音频效果状态 |
| `lyricSettingsStore` | `lyricSettingsStore.ts` | 歌词设置状态 |
| `sleepTimerStore` | `sleepTimerStore.ts` | 睡眠定时器状态 |
| `smartPlaylistStore` | `smartPlaylistStore.ts` | 智能播放列表状态 |
| `backupRestoreStore` | `backupRestoreStore.ts` | 备份恢复状态 |
| `crossfadeStore` | `crossfadeStore.ts` | 交叉淡入淡出状态 |
| `recordingStore` | `recordingStore.ts` | 录音状态 |
| `formatConversionStore` | `formatConversionStore.ts` | 格式转换状态 |
| `hiresStore` | `hiresStore.ts` | Hi-Res 音频状态 |
| `dsdProcessingStore` | `dsdProcessingStore.ts` | DSD 处理状态 |
| `libraryHealthStore` | `libraryHealthStore.ts` | 音乐库健康状态 |
| `statsAchievementsStore` | `statsAchievementsStore.ts` | 统计成就状态 |

### 6.2 状态持久化

关键状态使用 Zustand 的 `persist` 中间件进行本地存储：

```typescript
export const useAudioStore = create&lt;AudioState&gt;()(
  persist(
    (set, get) =&gt; ({
      // ... 状态和方法
    }),
    {
      name: "audio-store-v4",
      partialize: (state) =&gt; ({
        volume: state.volume,
        loopMode: state.loopMode,
        eqBands: state.eqBands,
        // ... 选择性持久化
      }),
    }
  )
);
```

---

## 7. 后端服务（可选）

### 7.1 API 架构

后端使用 FastAPI 框架，提供以下功能：

- **健康检查 API** - 服务状态监控
- **音频处理 API** - 音频分析和处理
- **语音识别 API** - 基于 FunASR 的语音识别
- **语音合成 API** - 基于 KantTS 的语音合成
- **文本理解 API** - NLP 文本分析
- **翻译 API** - 多语言翻译
- **视觉处理 API** - 图像识别处理

### 7.2 AI 模型集成

后端集成了多个 AI 模型：

| 模型 | 框架 | 用途 |
|------|------|------|
| Paraformer | FunASR | 语音识别 |
| SamBERT | KantTS | 语音合成 |
| ModelScope Models | ModelScope | 多模态 AI |

### 7.3 启动方式

```bash
# 单独启动后端
npm run backend

# 完整启动（前端 + 后端）
npm run start-full
```

---

## 8. Electron 桌面应用

### 8.1 功能特性

- **主窗口**：1280x720 默认尺寸，支持最小 800x600
- **桌面歌词**：独立透明窗口，始终置顶
- **系统托盘**：最小化到托盘，支持快捷操作
- **IPC 通信**：主进程与渲染进程安全通信

### 8.2 构建目标

| 平台 | 格式 |
|------|------|
| Windows | portable |
| macOS | dmg, zip |
| Linux | AppImage, deb |

### 8.3 构建命令

```bash
# 构建所有平台
npm run build:electron

# 构建 Windows 版本
npm run build:electron:win

# 构建 macOS 版本
npm run build:electron:mac

# 构建 Linux 版本
npm run build:electron:linux
```

---

## 9. Web Workers

项目使用 Web Workers 进行耗时任务的后台处理：

| Worker | 功能 |
|--------|------|
| `waveform.worker.ts` | 波形数据计算 |
| `fingerprint.worker.ts` | 音频指纹生成 |
| `dsd.worker.ts` | DSD 格式处理 |
| `conversion.worker.ts` | 音频格式转换 |

---

## 10. 开发指南

### 10.1 环境要求

- **Node.js**: 18+
- **npm**: 9+
- **操作系统**: Windows / macOS / Linux
- **Python**: 3.10+（后端开发）

### 10.2 快速开始

```bash
# 克隆项目
git clone &lt;repository-url&gt;

# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 访问应用
# http://localhost:3025
```

### 10.3 可用脚本

| 命令 | 功能 |
|------|------|
| `npm run dev` | 启动开发服务器 |
| `npm run dev:electron` | 启动 Electron 开发模式 |
| `npm run dev:full` | 启动完整开发环境 |
| `npm run build` | 构建生产版本 |
| `npm run build:electron` | 构建 Electron 应用 |
| `npm start` | 启动生产服务器 |
| `npm run lint` | 代码规范检查 |
| `npm run format` | 代码格式化 |
| `npm run clean` | 清理构建缓存 |
| `npm run reset` | 完全重置项目 |
| `npm run backend` | 启动后端服务 |
| `npm run start-full` | 启动完整服务 |

### 10.4 添加新的可视化效果

1. 在 `src/components/visualization-v8/effects/` 创建新文件
2. 实现 `EffectPlugin` 接口：

```typescript
export const MyCustomEffect: EffectPlugin = {
  id: "my-custom-effect",
  name: "我的自定义效果",
  category: "particles",
  description: "这是一个自定义效果",
  preferredEngine: "canvas",
  parameters: [
    {
      id: "param1",
      name: "参数1",
      type: "number",
      mode: "basic",
      min: 0,
      max: 100,
      default: 50
    }
  ],
  init(ctx) { /* 初始化逻辑 */ },
  render(ctx, audioData, params) { /* 渲染逻辑 */ },
  resize(width, height) { /* 尺寸调整 */ },
  destroy() { /* 清理资源 */ }
};
```

3. 在 `initEffects.ts` 中注册效果
4. 效果会自动出现在效果选择器中

### 10.5 项目配置文件

| 文件 | 用途 |
|------|------|
| `package.json` | 项目依赖和脚本 |
| `next.config.js` | Next.js 配置 |
| `tsconfig.json` | TypeScript 配置 |
| `tailwind.config.ts` | Tailwind CSS 配置 |
| `postcss.config.js` | PostCSS 配置 |
| `.eslintrc.json` | ESLint 规则 |
| `.prettierrc` | Prettier 格式规则 |

---

## 11. 快捷键

| 快捷键 | 功能 |
|--------|------|
| `←` `→` | 切换歌曲卡片 |
| `Enter` / `空格` | 选择卡片 |
| `P` | 切换性能监控面板 |
| `S` | 切换设置面板 |
| `C` | 切换控制面板 |
| `ESC` | 退出全屏/返回 |

---

## 12. 更新日志

### V8.0 (2026-03-30)
- ✅ 25种专业可视化效果
- ✅ 双渲染引擎（Canvas 2D + WebGL）
- ✅ 三层参数系统（基础/专业/专家）
- ✅ 完整预设管理系统
- ✅ 关键帧动画时间轴系统
- ✅ 深度音频分析引擎
- ✅ 实时性能监控面板
- ✅ 全面异常处理
- ✅ 内存优化与对象池

### V7.0 (2026-03-28)
- 玻璃拟态 UI 设计
- 动态渐变背景
- 堆叠音乐卡片交互
- 手势控制系统
- 虚拟光标
- 3D 立体播放器
- 三行歌词显示
- 基础音频可视化

---

## 13. 许可证

本项目采用 MIT 许可证开源。详见 [LICENSE](LICENSE) 文件。

---

## 14. 致谢

感谢以下开源项目：

- [Next.js](https://nextjs.org/) - React 全栈框架
- [Tailwind CSS](https://tailwindcss.com/) - 原子化 CSS 框架
- [Three.js](https://threejs.org/) - WebGL 3D 渲染库
- [Zustand](https://github.com/pmndrs/zustand) - 轻量级状态管理
- [Framer Motion](https://www.framer.com/motion/) - 动画库
- [Lucide Icons](https://lucide.dev/) - 图标库
- [MediaPipe](https://google.github.io/mediapipe/) - 手势识别框架
- [FastAPI](https://fastapi.tiangolo.com/) - Python Web 框架

---

**文档版本**: V1.0  
**最后更新**: 2026-05-01  
**项目状态**: ✅ 活跃开发中

