# 🎵 MIMI Music Player (Vibe Player) 深度全景技术与功能介绍文档

> **版本**：v0.2.1 | **代号**：Vibe Player | **团队**：大咪小咪组  
> **文档定位**：全量项目介绍、系统架构、功能字典与技术实现手册（无删减完整版）

---

## 目录

1. [项目定位与核心理念](#1-项目定位与核心理念)
2. [总体系统架构与技术栈](#2-总体系统架构与技术栈)
3. [核心功能体系与模块详析](#3-核心功能体系与模块详析)
   - 3.1 [单例音频引擎与专业 DSP 音效系统](#31-单例音频引擎与专业-dsp-音效系统)
   - 3.2 [电影级可视化与视听艺术系统 (Visual Suite)](#32-电影级可视化与视听艺术系统-visual-suite)
   - 3.3 [隔空手势无感交互系统 (Air Gesture Control)](#33-隔空手势无感交互系统-air-gesture-control)
   - 3.4 [情感矩阵 AI 与音乐大脑 (Emotion Matrix & Neural Interface)](#34-情感矩阵-ai-与音乐大脑-emotion-matrix--neural-interface)
   - 3.5 [多源聚合网络与曲库治理体系 (Sources & Library Hub)](#35-多源聚合网络与曲库治理体系-sources--library-hub)
   - 3.6 [全屏与桌面歌词系统 (Lyrics Engineering)](#36-全屏与桌面歌词系统-lyrics-engineering)
   - 3.7 [多形态流体播放器与界面交互 (Fluid Player UI)](#37-多形态流体播放器与界面交互-fluid-player-ui)
   - 3.8 [高颜值社交音乐海报工坊 (Social Poster Workshop)](#38-高颜值社交音乐海报工坊-social-poster-workshop)
4. [40+ 功能面板全景矩阵 (Panel Orchestrator)](#4-40-功能面板全景矩阵-panel-orchestrator)
5. [状态管理拓扑与数据持久化 (60 Zustand Stores)](#5-状态管理拓扑与数据持久化-60-zustand-stores)
6. [设计系统与动效美学 (Design System & Motion)](#6-设计系统与动效美学-design-system--motion)
7. [后端服务与桌面端工程化 (Backend & Electron Architecture)](#7-后端服务与桌面端工程化-backend--electron-architecture)
8. [质量保障、测试与项目运维 (Quality & Tooling)](#8-质量保障测试与项目运维-quality--tooling)
9. [快速启动与部署指南](#9-快速启动与部署指南)

---

## 1. 项目定位与核心理念

### 1.1 产品愿景

`MIMI Music Player`（亦称 `Vibe Player`）是一款打破传统音频播放器界限的**次世代沉浸式多模态音乐平台**。它的核心愿景是：**“不仅仅是播放器，更是音乐的数字舞台”**。

在传统流媒体播放器趋于同质化、工具化、扁平化的背景下，MIMI Music Player 提出了以**极致视觉美学（Visual-First）**、**专业音频处理（Audiophile Engineering）**、**AI 情感理解（Affective Computing）**和**前沿人机交互（Air Gesture & Neural Interface）**为四根支柱的感官升维方案。

### 1.2 核心用户画像

- **音乐发烧友与先锋视觉控 (Audiophiles & Visual Enthusiasts)**：不满足于平淡的波形显示，追求高保真音质（Hi-Res/DSD/30段EQ）、专业级动态混音，以及与音频节奏严格物理对齐的电影级 3D/2D 渲染视效。
- **数字工匠与调音客 (Digital Artisans)**：热衷于自由调整参数、组合 17 种微调 DSP 创意效果器、自定义歌词排版和画布海报，创造属于自己的视听预设。
- **氛围聆听与次屏美学爱好者 (Ambient Listeners)**：习惯在副屏、客厅大屏或桌面长期常驻运行播放器，将其作为一件具有有机呼吸感、流体玻璃拟态的动态数字艺术品。

### 1.3 核心设计哲学

1. **Visual-First（视觉即本体）**：界面不是音频的附庸，而是音乐振动的可视载体；UI 的透明度、折射与微动全面服务于声波的变化。
2. **Apple Glassmorphism（高级玻璃拟态）**：摒弃廉价的高斯模糊，采用精细调配的 `backdrop-blur`、次表面饱和度增强、0.5pt 细微边缘高光以及液态玻璃滤镜，营造高级物理材质质感。
3. **Data-Driven Audio Sync（真实声学驱动）**：杜绝虚假伪造的随机动画或预设循环。每一束极光的扭曲、每一个粒子的引力震颤、每一笔墨水的晕开，均严格绑定自 Web Audio API 实时傅里叶变换（FFT）的真实频谱与能量。
4. **Zero-Slop（拒绝泛滥与工业平庸）**：剔除任何破坏沉浸感的侵入式弹窗与广告，全功能模块采用抽屉与悬浮坞解耦设计。

---

## 2. 总体系统架构与技术栈

### 2.1 系统分层拓扑架构

MIMI Music Player 采用清晰的现代模块化分层架构，覆盖浏览器端 Web 运行态与 Electron 原生桌面运行态：

```
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
│  │ • useLyric        │  │ • lxRunner        │  │ • dsd.worker.ts        │  │
│  │ • useGesture      │  │ • BeatMapAnalyzer │  │ • fingerprint.worker.ts│  │
│  │ • useDynamicTheme │  │ • WorkerPool      │  │ • waveform.worker.ts   │  │
│  └───────────────────┘  └───────────────────┘  └────────────────────────┘  │
├────────────────────────────────────────────────────────────────────────────┤
│                       Core Audio Engine (Singleton)                        │
│   HTML5 Audio / Stream / Decoded Buffer → AudioContext Singleton           │
│   → 30-Band EQ → 17 Effects Manager → Crossfade Mixer → Master Gain        │
│   → AnalyserNode (Fast Fourier Transform 2048-sample) → Destination        │
├────────────────────────────────────────────────────────────────────────────┤
│                       Infrastructure & Cross-Platform                      │
│   Next.js 16 (App Router) │ Electron 41 │ IndexedDB (VibeMusicDB)          │
│   LocalStorage │ Web Audio API │ WebRTC (MediaPipe) │ FastAPI Python 后端  │
└────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 核心技术栈清单

| 维度            | 选用技术         | 版本 / 特征                | 架构价值                                           |
| :-------------- | :--------------- | :------------------------- | :------------------------------------------------- |
| **前端基座**    | Next.js + React  | Next 16.2.4 / React 19.2.5 | App Router、动态并行加载、极速首屏 Hydration       |
| **开发语言**    | TypeScript       | 5.4.3 (Strict 模式)        | 全局类型安全，0 隐式 any，严苛质量门禁             |
| **跨端框架**    | Electron         | 41.1.0                     | 桌面端跨平台打包（Windows / macOS / Linux）        |
| **状态管理**    | Zustand          | 5.0.12                     | 轻量零样板、选择器性能优化、离散持久化中间件       |
| **动画引擎**    | Framer Motion    | 12.38.0                    | 弹簧物理模拟（Spring Physics）、手势过渡、布局动画 |
| **三维渲染**    | Three.js         | 0.183.2 (WebGL)            | 3D 唱片架、空间几何变换、透视摄像机动力学          |
| **样式与设计**  | Tailwind CSS     | 3.4.1 + OKLCH Tokens       | 广色域色彩空间、现代玻璃拟态滤镜                   |
| **手势视觉**    | Google MediaPipe | tasks-vision 0.10.34       | 21 点手部 3D 姿态骨架跟踪、离线模型加载            |
| **音频计算**    | Web Audio API    | 原生单例图谱拓扑           | 零外部依赖低延迟处理、30段滤波、17种DSP节点        |
| **高阶音频**    | @ffmpeg/ffmpeg   | 0.12.15 (WebAssembly)      | 浏览器端纯前端多格式音频无损解码与转码             |
| **画布排版**    | Fabric.js        | 7.4.0                      | 社交分享海报的动态矢量排版与高分率合成导出         |
| **本地数据库**  | IndexedDB        | 封装安全事务层             | 大容量离线音频 Blob、本地曲库与元数据存储          |
| **AI 计算后端** | Python FastAPI   | Python 3.10+ / PyInstaller | 音频特征离线深度挖掘、ModelScope 模型部署          |

---

## 3. 核心功能体系与模块详析

### 3.1 单例音频引擎与专业 DSP 音效系统

播放器的核心心脏是位于 `src/lib/audio/AudioEngine.ts` 的全局单例音频引擎，结合 `AudioEffectsManager.ts` 和 `CrossfadeMixer.ts` 构成完整的专业音频链路。

```
[Audio Source (Stream/Blob)]
             │
             ▼
     [MediaElementSource]
             │
             ▼
   [30-Band Graphic EQ] ◄─── (32Hz ~ 16kHz 多级双二阶带通滤波器组)
             │
             ▼
   [AudioEffectsManager] ◄─── (17 种创意效果动态插入或并联/湿干比混合)
             │
             ▼
     [CrossfadeMixer]    ◄─── (A/B 轨道平滑交叉渐变增益控制)
             │
             ▼
       [MasterGain]      ◄─── (主音量衰减与静音保护)
             │
      ┌──────┴──────┐
      ▼             ▼
[AnalyserNode] [AudioDestination (扬声器/耳机)]
      │
      ▼
[AudioVisualizerManager] ──► (实时抓取 TimeDomain / FrequencyData 供可视化)
```

#### 1) 30 段专业图形均衡器 (30-Band EQ)

- 覆盖声学全频段：从次低频（32Hz、45Hz、64Hz）到中频人声（500Hz、1kHz、2kHz），再到极高频泛音（10kHz、14kHz、16kHz）。
- 每个频点均挂载独立的 `BiquadFilterNode`（Type: `peaking`，Q 因子精确匹配频带带宽）。
- 支持一键切换专业声学预设（流行、摇滚、爵士、古典、电子、人声增强、重低音、空气感高频）。

#### 2) 17 种专业创意 DSP 特效全解

系统在 `AudioEffectsManager` 中构建了 17 种微调创意音效，全部通过原生 Web Audio 节点网络实现，支持开启/关闭与强度（0.0 ~ 1.0）精确插值：

1. **自动立体声环绕 (AutoPan)**：通过 `StereoPannerNode` 连接低频正弦波振荡器（LFO），使声像在左右声道间按正弦轨迹无缝回旋。
2. **卷积空间混响 (Reverb)**：内置声学脉冲响应卷积器（`ConvolverNode`），模拟大教堂、录音棚与 livehouse 的真实早期反射与后期残响扩散。
3. **立体声声场拓宽 (Stereo Widener)**：通过 `ChannelSplitterNode` 将立体声解耦为 Mid（中央声像）与 Side（两侧声像），配合毫秒级 Haas 效应延迟节点，大幅扩大声场纵深。
4. **Nightcore 萌化升调 (Nightcore)**：在微调提升音频播放速率（`playbackRate`）的同时联动高通明亮滤波，展现元气快节奏。
5. **Vaporwave 蒸汽波 (Vaporwave)**：降低播放速率，配合温和低通滤波与微量合唱延迟，营造 80 年代复古慵懒的梦幻眩晕感。
6. **磁带机抖晃 (Cassette)**：使用随机低频抖晃振荡器模拟老式盒式磁带电机的机械颤抖（Wow & Flutter），并叠加轻微的磁带饱和增益。
7. **振幅震颤 (Tremolo)**：使用低频振荡器（LFO）周期性调制音量增益节点，产生经典的冲浪摇滚与复古电子琴震音。
8. **水下沉浸 (Underwater)**：以 400Hz 陡峭低通滤波（Low-Pass Filter）阻断中高频，并挂载轻微的漫反射回声，营造置身深海的沉浸声景。
9. **黑胶唱片质感 (Vinyl)**：通过波形整形器（`WaveShaperNode`）注入奇次谐波失真，并限制高低频频宽，模拟黑胶唱针与密纹唱片的温润空气感。
10. **8-Bit 比特粉碎 (Bitcrusher)**：降采样与量化深度裁剪算法，模拟早期红白机与复古采样器的数字糙音。
11. **对讲机/老收音机 (Talkie)**：串联带通滤波器（Band-Pass Filter: 800Hz - 3.5kHz）并提升增益至轻微破音，精准重现老式步话机与二战无线电通话声效。
12. **超重低音增强 (MegaBass)**：在 60Hz - 120Hz 频段挂载高 Q 值的低架滤波（Low-Shelf），配合动态压缩器避免低频失真打顶。
13. **ASMR 空气感增强 (ASMR)**：挂载高频空气架式滤波（High-Shelf > 8kHz）与微弱高灵敏度动态压缩，将歌手呼吸音、唇齿音与空间微弱细节极致放大。
14. **全通相位器 (Phaser)**：多级全通滤波器组（All-Pass Filters）结合 LFO 扫频，产生声波相互抵消的飞掠式旋转相位撕裂感。
15. **中置人声消除 (VocalRemove)**：基于立体声反相抵消算法（$L_{out} = L - R, R_{out} = R - L$），消除声相居中的主干人声，快速提取伴奏卡拉OK音轨。
16. **赛博朋克重型失真 (Cyberpunk Distortion)**：定制高斜率双曲正切（Tanh）传递函数驱动的 `WaveShaperNode`，生成极具工业机械质感的重度失真声。
17. **低保真电台 (Lo-Fi Phone)**：结合电话音频频宽截断与低幅度白噪声注入，呈现午夜电台的怀旧氛围。

#### 3) 情感感知交叉淡入淡出 (Crossfade Mixer)

- 切歌时杜绝突兀中断或爆音，支持 1~12 秒自定义淡入淡出曲线（Equal-Power 对数能量曲线保证过渡期总音量平稳）。
- 与情感矩阵 AI 协同：当检测到下一曲具有相似情感特征（Energy/Valence）时，自动根据 BPM 节奏对齐触发过渡。

#### 4) 高阶专业音频工具群

- **DSD 解码器 (DSD Converter)**：内置专用 Web Worker（`dsd.worker.ts`），支持 DSF/DFF 格式高解析度音频的 1-bit 直读与高阶十倍抽样脉冲编码调制（PCM）高精度回放。
- **WebAssembly 音频格式转换器 (Format Converter)**：集成 `@ffmpeg/ffmpeg` 核心，无需服务器介入即可在浏览器内存中无损转换 FLAC、WAV、MP3、OGG、AAC 等多种音频容器。
- **CUE 分轨与波形裁剪 (Track Cutter)**：自动解析整轨大文件伴随的 `.cue` 索引文件，一键切片分轨；配备精确至毫秒级的可视化音频波形剪辑器。
- **音频指纹识别 (Fingerprint Scanner)**：提取音频局部频谱能量特征生成声学指纹哈希（通过 `fingerprint.worker.ts`），为未知音轨提供智能听歌识曲。
- **A-B 复读循环 (ABLoopPanel)**：可在音轨上精确锚定 A 点与 B 点，支持毫秒级无缝循环播放、片段速度微调与复读标记持久化。

---

### 3.2 电影级可视化与视听艺术系统 (Visual Suite)

可视化是 MIMI Music Player 最耀眼的视觉名片。系统拥有底层 Canvas 2D 硬件加速与 WebGL 双渲染管道，当前主力挂载了 14 种专业级 2D/3D 效果，并独家研发了**手写质感歌词 MV (Handwritten Lyric MV)** 与 **Folia 歌词舞台 (Lyric Film Stage)**。

#### 1) 14 大核心可视化引擎全景

```
[AudioContext AnalyserNode]
          │ (getByteFrequencyData / getByteTimeDomainData)
          ▼
 [AudioVisualizerManager] ─── (FPS 监控 / 动态分辨率适配 / 色彩插值)
          │
          ├───► 1. 空间网格 (Spatial Mesh)
          ├───► 2. 赛博朋克粒子力场 (Cyberpunk Particles)
          ├───► 3. 有机流体 (Organic Fluid)
          ├───► 4. 极光波浪 (Aurora Wave)
          ├───► 5. 频谱光环 (Spectrum Ring)
          ├───► 6. 星云深空 (Nebula Field)
          ├───► 7. 黑胶唱盘纹理 (Vinyl Groove)
          ├───► 8. 赛博矩阵代码雨 (Cyber Matrix)
          ├───► 9. 引力场 (Gravitational Field)
          ├───► 10. 棱镜脉冲 (Prism Pulse)
          ├───► 11. 电影级丝绸极光 (Cinematic Silk Aurora)
          ├───► 12. 东方水墨山水 (Oriental Landscape)
          ├───► 13. 电影级东方水墨 (Cinematic Oriental Ink)
          └───► 14. 电影级歌词漂移 (Cinematic Lyric Drift)
```

1. **空间网格 (Spatial Mesh)**：仿 3D 空间三维透视网格，声波低频冲击引起网格高低起伏与空间折叠。
2. **赛博朋克粒子力场 (Cyberpunk Particles)**：上千颗受物理引力驱动的发光粒子，重低音瞬间触发粒子脉冲向外爆发与星芒拖尾。
3. **有机流体 (Organic Fluid)**：基于二维元球（Metaballs）和纳维-斯托克斯流体简化方程，液态色彩相互交融渗透。
4. **极光波浪 (Aurora Wave)**：多层半透明正弦波正交叠加，色彩随音调高低在青翠、深紫与桃红之间流转。
5. **频谱光环 (Spectrum Ring)**：圆形放射状频谱柱，随音节节奏收缩扩张，外围辅以辉光电弧。
6. **星云深空 (Nebula Field)**：模拟宇宙星系旋臂，音频能量注入时星云加速自转并产生超新星爆发光晕。
7. **黑胶唱盘纹理 (Vinyl Groove)**：高仿真拟物黑胶唱片，微细密纹随声波振动反射环境流光，唱针实时感应音频跳动。
8. **赛博矩阵代码雨 (Cyber Matrix)**：黑客帝国经典数字字符流，掉落速度与字符亮度受音频频谱高频能量动态调制。
9. **引力场 (Gravitational Field)**：中央黑洞视界模拟，周围光线受大质量引力弯曲吸附，重音触发引力波涟漪。
10. **棱镜脉冲 (Prism Pulse)**：光线穿过光学三棱镜折射出的色散光谱，随着节拍强弱产生高频脉冲震颤。
11. **电影级丝绸极光 (Cinematic Silk Aurora)**：柔顺飘逸的丝绸质感曲面，采用微积分平滑样条曲线模拟风中丝带。
12. **东方水墨山水 (Oriental Landscape)**：宣纸底色上实时勾勒出远山如黛的墨色等高线，音频起伏化作山峦跌宕。
13. **电影级东方水墨 (Cinematic Oriental Ink)**：墨滴在水面上滴落并随音律自由晕染、扩散、飞白，充满东方哲学写意留白美。
14. **电影级歌词漂移 (Cinematic Lyric Drift)**：歌词文字与音频质感共振，产生微颗粒风化漂移消散效果。

#### 2) 特色独占视效：手写质感歌词 MV (Handwritten Lyric MV)

- **纸张微质感模拟 (Paper Texture Engine)**：程序化生成微观纸张纤维噪点与光影渐变，摆脱数码冷感。
- **动态水墨晕染算法 (Ink Bleed Dynamics)**：字迹边缘呈现毛细现象形成的微小毛边与浓度深浅过渡。
- **拍立得快照节奏与手绘涂鸦 (Doodles & Snapshot Timing)**：随音乐小节随机闪烁出现的留声机、星光、声波音符手绘涂鸦，宛如一本活着的音乐手记。

#### 3) 沉浸式 3D 唱片架 (Shelf 3D View)

- 基于 Three.js 构建的交互式 3D 虚拟唱片货架。
- 专辑封面以 3D 实体 CD/黑胶封套形式排布，支持鼠标滚轮缩放、物理阻尼拖拽浏览与飞入中央唱机的高级动画。

---

### 3.3 隔空手势无感交互系统 (Air Gesture Control)

位于 `src/lib/gesture/` 的隔空手势控制系统是 MIMI Music Player 的革命性交互模块。经过 2026 年底的底层重构，系统摆脱了传统单一摄像头的简陋实现，成为具有**工业级稳定性**、**本地离线加载**和**低抖动高精度**的分层无感交互架构。

```
[Webcam Video Stream]
          │
          ▼
[Local-First MediaPipe Tasks-Vision] ◄─── (离线加载 local WASM & hand_landmarker.task)
          │
          ▼ (21 个 3D 手部关节点三维坐标)
[Scale-Normalized Landmarks Engine]
          │
          ▼
   [One Euro Filter]                 ◄─── (高精度自适应滤波：静止抗抖动，运动零迟滞)
          │
          ▼
[Gesture Posture State Machine]      ◄─── (多帧姿态投票与防误触消抖机制)
          │
          ├───────────────────────────────┐
          ▼                               ▼
[Pointer & Mouse Bridge]          [Action Layer (Player Command Bindings)]
  • 虚拟手部光标渲染                • 握拳悬停 (Fist Dwell) ──► 播放 / 暂停
  • 捏合模拟 Click/Drag             • 手掌左划 (Swipe Left) ──► 上一曲
  • 双击模拟 Double Click           • 手掌右划 (Swipe Right) ──► 下一曲
                                    • 手掌上划/下划 ──────────► 音量增减
```

#### 关键技术突破：

1. **1€ (One Euro Filter) 智能滤波**：传统低通滤波在静止时抖动严重，在快速移动时产生严重拖影。系统引入 One Euro 滤波器，通过自适应截止频率 $\alpha$ 控制：低速时大幅降低截止频率消除手颤，高速时提升截止频率保证瞬态跟手。
2. **本地模型全离线化**：通过 `npm run sync:mediapipe` 脚本将 6 个 WASM 运行时文件与 7.8MB 手部识别模型完整落地于 `public/mediapipe/`，杜绝由于外部网络阻塞导致的摄像头无法初始化问题；支持 GPU WebGL 加速向 CPU WebAssembly 的自动降级。
3. **光标事件虚拟桥接 (Pointer Bridge)**：食指指点不仅是视觉光标，更通过 DOM `dispatchEvent` 机制合成了完整的 PointerEvent/MouseEvent 链路，使用户仅凭手势捏合即可隔空点击界面上的任意按钮或拖动进度条。
4. **手势设置与灵敏度持久化 (`mimi-gesture-settings-v1`)**：允许用户自定义捏合灵敏度、平滑度参数、音量步进、镜像反转与摄像头输入源选择。

---

### 3.4 情感矩阵 AI 与音乐大脑 (Emotion Matrix & Neural Interface)

播放器内置的 AI 情感计算体系打破了“歌单/歌手/专辑”的刻板分类方式，从心理声学和情感维度重构音乐。

```
                     ↑ 极高能量 (High Energy)
                     │
         焦虑 / 愤怒  │  欢快 / 狂喜 (Euphoria)
        (Tense/Angry)│  (EDM / 摇滚 / 舞曲)
                     │
─────────────────────┼─────────────────────► 积极愉悦 (High Valence)
消极低沉 (Low Valence)│
         忧郁 / 悲伤  │  安宁 / 治愈 (Peaceful)
     (Melancholy/Sad)│  (氛围 / 纯音乐 / 民谣)
                     │
                     ↓ 极低能量 (Low Energy)
```

#### 1) 2D 情感坐标空间与音乐考古 (Music Archaeology)

- 依据心理声学 Russell 环形情感模型（Circumplex Model of Affect），将音乐投射在以 **Valence（情绪愉悦度：悲伤→欢快）** 为横轴、**Energy（声学能量：舒缓→激昂）** 为纵轴的连续直角坐标系中。
- **自动音乐考古**：结合音频 BPM、动态范围、和弦色彩及大模型歌词语义理解，全自动为每一首入库歌曲标注精确的 $(x, y)$ 情感坐标。

#### 2) 心情圈选播放 (Lasso Mood Selection)

- 用户在二维雷达图上使用鼠标自由框选或涂抹任意区域（例如选择“高愉悦度 + 中等能量”的右上区域），播放器即刻动态生成精准契合当前心境的智能无缝播放列表。

#### 3) 听觉基因图谱 (Auditory Gene) 与 DNA 听歌日记 (DNA Journal)

- 持续记录用户的真实聆听轨迹与时段偏好。
- 通过极具未来感的 `AuditoryGene` 螺旋组件，将用户的音乐品味抽象为声学染色体序列，展示属于用户个人的审美基因。
- **DNA 日记 (DNA Journal)**：按日期归档用户的听歌情感足迹，生成诗意的情感曲线。

#### 4) AI 音乐策展人智能体 (AI Agent & Toolbox)

- 内置专业级大语言模型会话面板（支持 OpenAI、Google Gemini、Anthropic Claude、DeepSeek、Ollama 及兼容端点配置）。
- **真正的 Tool Use / Function Calling 驱动**：AI Agent 具备调用播放器内部 API 的原生权限，能够根据自然语言指令执行实际操作：
  - `searchAndPlay(keyword)`：搜索并播放特定歌曲
  - `createMoodPlaylist(mood, count)`：自动按情感挑选生成歌单
  - `adjustEqualizer(preset)`：切换 30 段均衡器
  - `toggleEffect(effectName, intensity)`：实时调配 DSP 特效
- **灵感笔记 (AI Liner Notes) 与乐评故事 (Music Backstory)**：一键深度解读当前音轨的创作背景、乐器编配细节、艺术意象与诗意乐评。

---

### 3.5 多源聚合网络与曲库治理体系 (Sources & Library Hub)

#### 1) 全平台多音源解析矩阵

内置统一的 `MultiSourceResolver`，支持跨主流平台的高保真音源智能搜寻与聚合回放：

- **网易云音乐 (Netease)**：支持官方扫码登录、Cookie 状态维系、用户歌单导入、多码率无损音源解密与高精逐字歌词匹配。
- **QQ 音乐 (QQ)**：支持搜索、Cookie 鉴权、高品质音质链路解析。
- **酷狗音乐 (Kugou)**：精准歌曲检索与音质匹配。
- **酷我音乐 (Kuwo)**：无损音质无缝串流。
- **汽水音乐 (Qishui)**：流行趋势与特色音源解密探测。
- **万能反向代理服务器 (`/api/audio/proxy`)**：解决跨域资源共享（CORS）与防盗链限制，保障音轨与专辑封面的流畅无损拉取。

#### 2) 洛雪音乐 (LX Music) 自定义音源脚本引擎

- 在 `src/lib/sources/lxRunner.ts` 中完整实现了洛雪自定义源脚本解析沙箱。
- 用户可直接导入通用的社区第三方 `.js` 自定义源脚本，播放器将在受控环境中动态执行该脚本的 `musicUrl` 提取逻辑，实现音源库的无限扩展与长久免失效。

#### 3) 多源赛马竞速与自动容灾 (Url Race)

- 当发起播放请求时，系统可对多个可用平台发起并发探活（Url Race），毫秒级优先选择响应最快、码率最高的音轨链路。
- 若播放过程中遇到音源失效或 403 阻断，智能降级引擎自动平滑切换至备用源，确保听歌流程零打断。

#### 4) 统一数据管理中心 (Unified Data Manager Hub - `/data-manager`)

- **液体容量计 (Liquid Storage Gauge)**：动态液态波浪图，直观呈现浏览器 IndexedDB、LocalStorage 及离线下载的真实占用字节与配额。
- **曲库健康体检雷达 (Library Health Radar)**：全盘扫描本地与云端歌单，精准标出“缺失封面”、“缺少歌词”、“死链失效”、“低比特率（<128kbps）”和“重复歌曲”。
- **批量元数据编辑器 (Batch Metadata Editor)**：支持多选歌曲批量编辑 ID3 标签（歌曲名、艺术家、专辑、音轨号、年代、内嵌封面替换）。
- **全量数据备份与还原 (Backup & Restore)**：支持将所有播放列表、喜好记录、均衡器预设、手势配置、听歌日记一键导出为加密 JSON/ZIP 包，跨设备瞬间无损迁移。

---

### 3.6 全屏与桌面歌词系统 (Lyrics Engineering)

#### 1) 全屏沉浸式歌词 (Fullscreen Lyrics)

- 采用 Apple Music 风格超大字符排版与平滑逐字缓动滚屏。
- **动态聚焦与景深模糊**：当前演唱行高亮锐化，非当前行施加动态高斯景深模糊，伴随旋律起伏呈现自然的呼吸微动。
- 深度集成 **Folia 风格排版** 与 **手写字体排版**，支持双语歌词对照、音译注音显示与字体字号/行距实时调节。

#### 2) 悬浮桌面歌词 (Desktop Lyrics)

- 面向 Windows/macOS 桌面场景打造的半透明悬浮歌词小窗。
- 支持锁定穿透（点击穿透到下方工作窗口）、双行轮播、多层描边与色彩渐变，工作码字与看视频时歌词一目了然。

#### 3) 歌词全网搜索与本地关联 (Lyrics Search & Import)

- 若本地或歌曲元数据无歌词，可打开独立搜索面板在全网多平台检索匹配精准 LRC/逐字歌词；亦可一键拖拽关联本地 `.lrc` 文件，并支持时间轴毫秒级偏移修正（Offset Calibration）。

---

### 3.7 多形态流体播放器与界面交互 (Fluid Player UI)

位于底部的浮动播放器（`FloatingPlayer.tsx`）采用流体变形设计，针对用户不同的专注度提供了 **5 种形态自由切换**：

```
┌──────────────────────────────────────────────────────────────┐
│ 1. 灵动胶囊态 (Pill State)   - 仅显示微型播放状态与缩略封面       │
├──────────────────────────────────────────────────────────────┤
│ 2. 紧凑播放条 (Compact State)- 标准全局底部控制栏，集成进度与音量  │
├──────────────────────────────────────────────────────────────┤
│ 3. 悬浮展开态 (Expanded State)- 展开单行歌词、频谱微光与核心控制钮 │
├──────────────────────────────────────────────────────────────┤
│ 4. 停靠吸附态 (Docked State) - 紧贴边缘，融入数据管理与辅助界面   │
├──────────────────────────────────────────────────────────────┤
│ 5. 暗黑影院态 (Dark Cinema)  - 极简化光晕卡片，最大化视效视觉占比 │
└──────────────────────────────────────────────────────────────┘
```

#### 细节亮点：

- **液态玻璃折射滤镜 (LiquidGlassFilter)**：借助自定义 SVG `<feTurbulence>` 与 `<feDisplacementMap>` 滤镜管线，模拟真实液体在玻璃边缘的微光折射。
- **环境自适应光晕 (Ambient Glow & Dynamic Halo)**：通过 `colorExtractor.ts` 实时抓取专辑封面的三大主色调，化为多层柔和径向渐变跟随音乐低频轻微扩散。
- **Apple 风格 3D 播放队列抽屉 (Apple 3D Queue Drawer)**：右侧划出的卡片式 3D 叠层队列，支持拖拽重排与批量清理。

---

### 3.8 高颜值社交音乐海报工坊 (Social Poster Workshop)

位于 `src/components/social/` 的分享面板是用户展现品味与二次创作的画布利器：

- 基于 **Fabric.js** 交互式矢量画布，绝非生硬套模板。
- **高阶模板库**：支持黑胶唱片经典款、极简杂志排版、赛博霓虹卡片、怀旧拍立得与现代流体卡片。
- **动态元素注入**：可自由勾选显示高精度音频波形图、精选歌词金句高亮、播放时间戳、专属听歌二维码（扫描直达试听）。
- **高清导出**：支持 1x、2x、4x 超高分辨率 PNG/JPEG 离线渲染生成，适配手机长图与社交动态一键分享。

---

## 4. 40+ 功能面板全景矩阵 (Panel Orchestrator)

在 `src/components/layout/PanelOrchestrator.tsx` 中，应用通过单例协调器统一管理了 40 余个独立功能面板。所有面板均通过 `LazyPanel` 机制实现了**按需动态加载（Code Splitting）**与**崩溃隔离（Error Boundary）**：

| 面板标识 (`panelName`) | 对应组件 / 文件路径                   | 核心业务职责与技术细节                             |
| :--------------------- | :------------------------------------ | :------------------------------------------------- |
| `queue`                | `player/QueuePanel`                   | 当前播放队列管理、下一首预告、拖拽乱序、清空       |
| `history`              | `library/HistoryPanel`                | 最近播放历史清单与快速回放                         |
| `settings`             | `settings/SettingsPanel`              | 系统核心设置（快捷键、语言、桌面行为、通用选项）   |
| `sleepTimer`           | `widgets/SleepTimerPanel`             | 睡眠定时器（按分钟倒计时、播放完当前歌曲后停止）   |
| `search`               | `player/SearchPanel`                  | 全网全平台深度聚合搜索（支持快捷键与语音唤起）     |
| `lyricSettings`        | `lyrics/LyricSettingsPanel`           | 歌词排版定制（字体大小、行距、双语开关、对齐方式） |
| `lyricsSearch`         | `lyrics/LyricsSearchPanel`            | 在线多源精准歌词重新匹配与搜索                     |
| `lyricsImport`         | `lyrics/LyricsImportPanel`            | 本地 `.lrc` 歌词文件拖拽解析与手动关联             |
| `lyricsCoverEditor`    | `lyrics/LyricsCoverEditor`            | 歌词海报编辑、文字裁剪与背景蒙版调整               |
| `eq`                   | `audio/AudioEqualizer`                | 30 段图形均衡器调节与声学预设切换                  |
| `visualSettings`       | `settings/VisualSettings`             | 可视化帧率、粒子数、模糊度、动态渲染开关           |
| `listeningHistory`     | `library/ListeningHistory`            | 历史听歌足迹明细列表                               |
| `listeningJournal`     | `widgets/JournalDayPanel`             | 每日听歌日记详情与心情标注                         |
| `dailyRecommendation`  | `widgets/DailyRecommendation`         | 每日专属 AI 智能推荐歌单卡片                       |
| `libraryManager`       | `library/LibraryManagerPanel`         | 本地曲库全面盘点、文件重名查重与批量删除           |
| `smartPlaylist`        | `library/SmartPlaylistPanel`          | 基于规则引擎（流派/年代/时长/评分）的动态智能歌单  |
| `offlineCache`         | `library/OfflineCachePanel`           | 离线缓存池监控、存储清理与预加载管理               |
| `share`                | `social/SharePanel`                   | 社交分享与高颜值海报工坊（Fabric.js）              |
| `playerSkins`          | `player/PlayerSkinsPanel`             | 播放器拟态皮肤与色彩光晕主题切换                   |
| `keyboardShortcuts`    | `settings/KeyboardShortcutsHelp`      | 全局键盘快捷键键位提示手册                         |
| `gestureSettings`      | `settings/GestureSettings`            | MediaPipe 隔空手势阈值、平滑度与按键映射配置       |
| `backupRestore`        | `library/BackupRestorePanel`          | 全量数据 JSON/ZIP 导出与跨设备无缝恢复             |
| `statsAchievements`    | `widgets/StatsAchievementsPanel`      | 听歌勋章成就系统、时长里程碑与雷达统计             |
| `professionalMode`     | `widgets/ProfessionalModeToggle`      | 专业调音师模式全局切换                             |
| `professionalTools`    | `features-v7/ProfessionalToolsPanel`  | 专业级工具箱（相位表、响度计、音频信息分析）       |
| `formatConverter`      | `audio/FormatConverter`               | WebAssembly FFmpeg 前端无损音频格式转换器          |
| `dsdConverter`         | `audio/DSDConverter`                  | 高解析度 DSD (DSF/DFF) 解码与 PCM 重采样           |
| `trackCutter`          | `audio/TrackCutter`                   | CUE 索引分轨切割与微秒级音频波形剪裁               |
| `crossfadeMixer`       | `audio/CrossfadeMixer`                | 情感感知平滑交叉淡入淡出混音器控制台               |
| `fingerprintScanner`   | `interaction/FingerprintScannerPanel` | 音频指纹声学哈希与听歌识曲识别面板                 |
| `libraryHealth`        | `library/LibraryHealthPanel`          | 曲库健康度体检（无效链/空标签/低音质探测）         |
| `instantMix`           | `widgets/InstantMix`                  | 依据当前播放音轨快速生成风格一致的心流混音         |
| `smartMixSession`      | `widgets/SmartMixSessionPanel`        | 连续无缝 DJ 混音智能会话面板                       |
| `smartRandom`          | `shared/SmartRandomModal`             | 消除刻板随机的自适应智能洗牌算法面板               |
| `dnaJournal`           | `widgets/DNAJournal`                  | 听觉基因螺旋图谱与长期审美演变看板                 |
| `emotionMatrix`        | `emotion/EmotionMatrixView`           | 2D Valence/Energy 情感象限雷达与框选交互           |
| `aiSettings`           | `settings/AISettingsPanel`            | 大模型 API Key、端点 BaseURL 与模型供应商设置      |
| `aiAgent`              | `ai-agent/AIAgentPanel`               | 对话式 AI 音乐智能策展人（具备 Tool Use 能力）     |
| `shelf3D`              | `library/Shelf3DView`                 | Three.js 沉浸式 3D 唱片封套货架浏览视图            |
| `audioSourceManager`   | `player/AudioSourceManagerModal`      | 音轨多音源优先级策略与备选链路即时切换器           |
| `cloudMusic`           | `library/CloudMusicPanel`             | 多平台云盘音乐挂载与回放                           |
| `accountCenter`        | `account/MultiPlatformAccountModal`   | 网易/QQ/酷狗/酷我等多平台账号登录与 Cookie 托管    |
| `dataManager`          | `library/UnifiedDataManagerHub`       | 统一数据枢纽（整合存储水位、健康度与下载）         |

---

## 5. 状态管理拓扑与数据持久化 (60 Zustand Stores)

为了在无框架 Context 重新渲染惩罚的前提下实现极端复杂的多组件联动，系统采用了 **60 个专用 Zustand Store**，其中 44 个 store 接入了 `persist` 持久化中间件。

### 5.1 六大状态领域分类

```
                   ┌────────────────────────────────────────┐
                   │        Global Store Federation         │
                   └───────────────────┬────────────────────┘
                                       │
     ┌───────────────┬─────────────────┼────────────────┬───────────────┐
     ▼               ▼                 ▼                ▼               ▼
【核心播放域】    【专业音频DSP域】   【AI与情感域】   【曲库与源配置域】  【UI与交互域】
• playerStore   • eqStore         • emotionStore   • playlistStore  • uiStore
• audioStore    • audioEffects    • aiStore        • libraryManager • visualSettings
• queueStore    • crossfadeStore  • useAIAgentStore• sourceConfig   • gestureSettings
• playbackRun   • dsdProcessing   • linerNotesStore• backupRestore  • playerSkinStore
• hiresStore    • trackCutting    • listeningJourn • offlineDownload• keyboardShort
```

1. **核心播放与运行时域 (Playback & Runtime)**：
   - `playerStore`：播放核心意图、当前曲目、音量、播放模式（循环/随机/单曲）。
   - `audioStore`：与底座 `AudioEngine` 紧密对接的操作中枢。
   - `queueStore`：当前待播队列、历史播放队列、随机队列索引。
   - `playbackRuntimeStore`：负责播放时间戳、缓冲进度、音频上下文状态心跳。
   - `hiresStore`：音质规格判定（Hi-Res / DSD / 无损 / 标准）。
2. **专业音频与 DSP 域 (Audio DSP & Processing)**：
   - `eqStore`：30 段频点增益状态与 EQ 预设。
   - `audioEffectsStore`：17 种创意音效的开关状态与参数强度矩阵。
   - `crossfadeStore`：交叉淡入淡出时长与曲线模式。
   - `dsdProcessingStore` / `formatConversionStore` / `trackCuttingStore`：各音频处理任务队列与进度。
3. **AI 情感与音乐认知域 (AI & Affective Computing)**：
   - `emotionStore`：歌曲的二维 Valence/Energy 坐标映射表与区域框选状态。
   - `aiStore` / `useAIAgentStore`：多模型对话历史会话、Tool 调用状态、策展人流式输出。
   - `linerNotesStore`：AI 唱片内页笔记缓存。
   - `listeningJournalStore`：日常听歌心理日记与心情标签。
4. **曲库、源配置与数据存储域 (Library & Data Persistence)**：
   - `playlistStore` / `favoritesStore` / `smartPlaylistStore`：用户自建歌单、红心收藏与智能规则引擎。
   - `sourceConfigStore`：网易云/QQ/酷狗/酷我/汽水等多源优先级、网络代理与 LX 脚本状态。
   - `userAccountStore`：多平台账户登录态凭证与 Cookie 存储。
   - `useDataManagerStore` / `useStorageAnalyticsStore`：数据中心存储水位、IndexedDB 配额监控。
5. **UI、外观与交互感知域 (UI, Visual & Interaction)**：
   - `uiStore`：全局活动视图（`HomeView` / `PlayerView` / `VisualizationView`）与 40+ 面板激活掩码。
   - `visualSettingsStore` / `visualizationStore` / `visualizationV8Store`：可视化引擎参数。
   - `gestureStore` / `gestureSettingsStore`：隔空手势运行时跟踪状态与敏感度偏好。
   - `playerSkinStore` / `floatingDebugStore`：播放器拟态皮肤与开发者调试 HUD。

### 5.2 数据持久化分层设计

- **轻量级状态（配置、偏好、歌单索引）**：使用 `localStorage` 通过 Zustand `persist` 中间件自动同步，写入前通过类型版本号做向前兼容隔离（例如 `mimi-gesture-settings-v1`、`vibe-player-storage`）。
- **重型数据（离线完整音频、超大封面 Blob、完整 AI 对话记忆）**：存储在浏览器的 **IndexedDB (`VibeMusicDB`)** 中，避免阻塞主线程及突破 LocalStorage 5MB 配额限制。

---

## 6. 设计系统与动效美学 (Design System & Motion)

### 6.1 OKLCH 广色域色彩空间

系统全面弃用传统的 sRGB / HSL，在 `src/lib/tokens.ts` 中构建了基于感知均匀的 **OKLCH 色彩空间**：

- **Primary Background (深碳质感)**：`oklch(0% 0.005 240)` —— 比纯黑更深邃、具备微弱冷调倾向的无损底层。
- **Elevated Surface (悬浮材质)**：`oklch(15% 0.01 240)` —— 配合 20px 背景高斯模糊的半透明玻璃台面。
- **Pure Signal (文字主色)**：`oklch(100% 0.005 240)` —— 极高对比度的纯净信号白。
- **Aurora Primary (极光主紫)**：`oklch(60% 0.25 300)` —— 科技与艺术兼具的电光紫。
- **Neon Pulse (霓虹心跳)**：`oklch(65% 0.25 0)` —— 激发能量感的鲜艳粉红。
- **Cyber Trace (赛博青迹)**：`oklch(75% 0.2 200)` —— 兼具明亮与通透的高纯度青蓝。

### 6.2 玻璃拟态设计规范与组件族

所有公共 UI 组件均收拢于 `src/components/shared/Glass/`：

- **GlassPanel / GlassCard**：`backdrop-blur(20px) saturate(180%)`，边框使用超细 `rgba(255, 255, 255, 0.08)`，内阴影 `inset 0 1px 1px rgba(255, 255, 255, 0.15)`，产生自然的光学边缘折射。
- **动态色板提取 (Dynamic Theme Engine)**：在切歌时，`useDynamicTheme` 实时将新封面图像绘制到离线微型 Canvas，采用聚类算法提炼出三大主色调，无缝平滑插值到 CSS 全局变量中，实现“歌换，全景氛围随之幻化”的极致通透感。

---

## 7. 后端服务与桌面端工程化 (Backend & Electron Architecture)

### 7.1 Python FastAPI 高级音频 AI 后端 (`backend/`)

在独立于前端的 `backend/` 目录下，部署了基于 Python 的高性能计算后端：

- **技术栈**：FastAPI + Uvicorn + ModelScope (魔搭社区) + PyTorch。
- **服务职责**：
  - 音频特征离线批量提取（BPM 节拍追踪、音色和弦识别）。
  - 语音识别（ASR，支持语音搜歌与手势语音复合交互）。
  - 语音合成（TTS，为 AI 策展人赋予拟人化音频播报声线）。
  - WebSocket 实时流（`/ws/audio`）实现低延迟双向音频数据分析。
- **打包分发**：通过 `backend/build.spec` 与 PyInstaller，全自动编译为单文件无依赖的 `backend.exe`，直接注入 Electron 的桌面安装包。

### 7.2 Electron 跨平台桌面端集成 (`electron/`)

- **主进程 (`electron/main/index.js`)**：
  - 原生无边框沉浸式窗口，配备自定义亚克力/毛玻璃标题栏。
  - 桌面全局系统托盘（Tray）与全局多媒体热键拦截。
  - 自动管理后端子进程生命周期：启动 Electron 时自动唤醒内置 `backend.exe`，退出时平稳终止。
  - 桌面透明歌词独立渲染进程管理。
- **预加载桥梁 (`electron/preload/index.js`)**：
  - 基于 `contextBridge.exposeInMainWorld`，在绝对隔离安全的原则下向渲染层暴露桌面端独占接口（文件系统直接读写、原生音频设备选择、窗口最小化/最大化控制）。

---

## 8. 质量保障、测试与项目运维 (Quality & Tooling)

### 8.1 严苛的质量门禁标准

项目推行了极其严格的工程质量规范：

1. **TypeScript Strict 模式**：`tsconfig.json` 开启全部严格检查，`next.config.js` 禁止忽略类型错误，全代码库 0 类型缺陷。
2. **ESLint 零容忍**：源码维护在 **0 errors / 0 warnings** 基线，严禁新增无意义的 `eslint-disable` 或隐式 `any`。
3. **单元与集成测试套件 (Vitest)**：
   - 拥有 **198+ 测试套件文件**，超 **1,200 个自动化测试用例**。
   - 全面覆盖：One Euro 滤波器数学精度、音频引擎状态机、Zustand store 状态迁移、媒体标签解析、URL 竞速逻辑、API 错误降级。
4. **端口自动化自愈系统 (`scripts/clean-port.js`)**：
   - 针对 Windows 环境下 Next.js 常驻占用端口的顽疾，自研了调用底层 `netstat.exe` 和 `taskkill.exe` 的智能探针，在每次 `npm run dev` 启动前自动排查并释放 3025 端口，防止僵尸进程引发 500 编译雪崩。

---

## 9. 快速启动与部署指南

### 9.1 环境要求

- **Node.js**：`>= 20.x`
- **npm**：`>= 10.x`
- **Python**（可选，仅当运行高级 AI 离线后端时必需）：`3.10+`

### 9.2 开发命令速查表

| 场景                 | 对应执行命令                       | 详细说明                                                            |
| :------------------- | :--------------------------------- | :------------------------------------------------------------------ |
| **全栈启动 (推荐)**  | `npm run dev:full`                 | 自动清理端口，一键同时拉起 Next.js 前端与 Python 后端               |
| **Web 前端启动**     | `npm run dev`                      | 仅启动 Next.js 前端开发服务器（默认运行于 `http://localhost:3025`） |
| **桌面客户端调试**   | `npm run dev:electron`             | 启动 Web 端并自动挂载 Electron 桌面调试窗口                         |
| **Python 后端启动**  | `npm run backend`                  | 单独启动 FastAPI 后端服务（运行于 `http://localhost:8000`）         |
| **手势模型同步**     | `npm run sync:mediapipe`           | 下载并同步 MediaPipe 本地离线模型与 WASM 资源至 public              |
| **类型与代码检查**   | `npx tsc --noEmit && npm run lint` | 全量运行 TypeScript 严格类型检查与 ESLint 规范审计                  |
| **全量自动化测试**   | `npm run test`                     | 运行 Vitest 运行 1200+ 单元测试与状态测试                           |
| **测试覆盖率**       | `npm run test:coverage`            | 生成并查看工程核心模块测试覆盖率报告                                |
| **Web 生产构建**     | `npm run build`                    | 编译 Next.js 生产环境发布包                                         |
| **Windows 桌面打包** | `npm run build:electron:win`       | 编译后端 `backend.exe` 并打包 Windows NSIS 与免安装 Portable 程序   |

### 9.3 环境变量配置 (`.env.example`)

复制根目录下 `.env.example` 为 `.env.local`：

```env
# AI 策展人与分析服务配置 (可选)
OPENAI_API_KEY=your_openai_key_here
GEMINI_API_KEY=your_gemini_key_here
DEEPSEEK_API_KEY=your_deepseek_key_here

# 本地服务端口配置
PORT=3025
BACKEND_PORT=8000
```

---

## 总结

`MIMI Music Player` 不仅是一座现代前端技术（React 19 / Next 16 / Web Audio / Three.js / WebAssembly / MediaPipe）的集大成者，更是一次探索数字时代“人、音符、图像、情感”之间多感官对话的先锋实践。从底层的 30 段滤波到顶层的手写歌词动效，从隔空手势的一挥一捏到 2D 情感矩阵的随心探索，每一行代码都在践行其最初的承诺：**让音乐拥有形体，让聆听成为舞台。**
