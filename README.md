# 🎵 MIMI Music Player (Vibe Player) v0.2.1

<div align="center">

![MIMI Music Player Banner](public/app-icon.ico)

**不仅仅是播放器，更是音乐的数字舞台。**  
_次世代沉浸式多模态视听流体艺术平台 — 极致视觉美学 · 专业声学工程 · AI 情感理解 · 隔空手势体感_

[![Next.js](https://img.shields.io/badge/Next.js-16.2.4-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.2.5-61DAFB?style=flat-square&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4_Strict-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Three.js](https://img.shields.io/badge/Three.js-0.183-black?style=flat-square&logo=three.js)](https://threejs.org/)
[![Framer Motion](https://img.shields.io/badge/Framer_Motion-12.38-black?style=flat-square&logo=framer)](https://www.framer.com/motion/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4_OKLCH-38B2AC?style=flat-square&logo=tailwind-css)](https://tailwindcss.com/)
[![Zustand](https://img.shields.io/badge/Zustand-5.0_Stores-brown?style=flat-square)](https://github.com/pmndrs/zustand)
[![Electron](https://img.shields.io/badge/Electron-41.1-47848F?style=flat-square&logo=electron)](https://www.electronjs.org/)
[![Unit Tests](https://img.shields.io/badge/Vitest-1319%2B_Passed-brightgreen?style=flat-square&logo=vitest)](https://vitest.dev/)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)

[在线体验与架构](#-系统架构) · [核心亮点](#-核心功能亮点矩阵) · [安装与运行](#-安装与快速启动) · [快捷键手册](#-键盘快捷键速查) · [桌面端构建](#-桌面端打包构建)

</div>

---

## 📖 目录

- [🌟 项目愿景与设计哲学](#-项目愿景与设计哲学)
- [✨ 核心功能亮点矩阵](#-核心功能亮点矩阵)
  - [1. 🎬 电影级视听艺术系统 (Visual Suite V7)](#1--电影级视听艺术系统-visual-suite-v7)
  - [2. 💿 Mineradio 3D 空间唱片架 (v0.2 SPATIAL)](#2--mineradio-3d-空间唱片架-v02-spatial)
  - [3. 🏝️ 灵动岛多形态流体播放器 (Dynamic Island & Floating Player)](#3-️-灵动岛多形态流体播放器-dynamic-island--floating-player)
  - [4. 🎛️ 专业单例音频引擎与 DSP 音效中心 (Audiophile Audio Pipeline)](#4-️-专业单例音频引擎与-dsp-音效中心-audiophile-audio-pipeline)
  - [5. ✋ 隔空手势无感交互系统 (Air Gesture Control)](#5--隔空手势无感交互系统-air-gesture-control)
  - [6. 🧠 情感矩阵 AI 与音乐大脑 (Emotion Matrix & Neural Interface)](#6--情感矩阵-ai-与音乐大脑-emotion-matrix--neural-interface)
  - [7. 🌐 多源聚合网络与曲库资产中心 (Sources & Library Hub)](#7--多源聚合网络与曲库资产中心-sources--library-hub)
  - [8. 📜 电影级沉浸式双语歌词与动态光影 (Lyrics Engineering)](#8--电影级沉浸式双语歌词与动态光影-lyrics-engineering)
  - [9. 🎨 社交音乐海报工坊 (Social Poster Workshop)](#9--社交音乐海报工坊-social-poster-workshop)
  - [10. 🗃️ 专业音频工具箱 (Professional Audio Tools)](#10-️-专业音频工具箱-professional-audio-tools)
- [🏛️ 系统架构与拓扑图](#-系统架构与拓扑图)
- [⌨️ 键盘快捷键速查](#-键盘快捷键速查)
- [🚀 安装与快速启动](#-安装与快速启动)
- [🖥️ 桌面端打包构建](#-桌面端打包构建)
- [🛡️ 工程质量与测试门禁](#-工程质量与测试门禁)
- [🤝 参与开发与贡献](#-参与开发与贡献)
- [📄 开源协议与鸣谢](#-开源协议与鸣谢)

---

## 🌟 项目愿景与设计哲学

在传统流媒体播放器日趋同质化、扁平工具化与广告泛滥的今天，**MIMI Music Player (Vibe Player)** 提出了一场感官升维革命。我们坚信：**播放器不只是播放声音的工具，更是让旋律在视觉、空间与情感三维中具象化绽放的数字舞台。**

### 四大核心支柱

1. **Visual-First（视觉即本体）**：界面绝非音频的附属，而是声波振动的可视载体。自研 14+ 电影级实时渲染视效与 3D 空间立体唱片架，将音频傅里叶变换（FFT）的真实频段与能量映射为光影、粒子与摄像机推镜。
2. **Audiophile Engineering（发烧级声学工程）**：全局唯一的 `AudioContext` 单例管道、自愈看门狗保护机制、30 段高精图示均衡器、17 种独立创意 DSP 效果链、DSD/SACD 原生硬件解析与无缝交叉混音器。
3. **Affective Computing & Brain（AI 情感理解与音乐考古）**：将传统线性的音乐列表投影至 2D 情感坐标空间（Valence 愉悦度 × Energy 能量值），结合大语言模型深度分析歌曲乐理内涵与创作背景，生成独一无二的“听觉基因”。
4. **Natural Air Gesture & Liquid Glass（隔空体感与苹果级液态玻璃拟态）**：融合 MediaPipe 手部 21 关节点三维追踪，挥手即切歌、握拳即暂停；全 UI 深度应用多层 `backdrop-blur`、微边缘内发光与弹簧物理动力学。

---

## ✨ 核心功能亮点矩阵

### 1. 🎬 电影级视听艺术系统 (Visual Suite V7)

内置 14+ 款完全由底层声学特征驱动的专业实时可视化引擎（Canvas 2D + WebGL），拒绝随机预设动画，每一帧光影均与音频波形实时共振：

| 可视化引擎                             | 技术特征与视觉表现                                                                                                                  |
| :------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------- |
| **动漫手书 MV (Anime Handwritten MV)** | **旗舰级视效**。AE 风格 3D 摄像机连续推镜与多平面景深分层，暖光掠影与电影暗角；歌词随节奏动态呼吸逐字对齐、毛笔飞白与水墨溅射粒子。 |
| **温光浮字 (Cinematic Lyric Drift)**   | 电影级温润流光字体漂浮穿行，微弱次表面散射与景深虚化，如同身处暗室投影放映厅。                                                      |
| **青绿千里 (Oriental Landscape)**      | 宋代《千里江山图》设色灵感，高山重峦叠嶂随低频起伏沉降，云雾在山脊间随中频流动飘逸。                                                |
| **千里江山 (Cinematic Oriental Ink)**  | 宣纸水墨渗化质感，重低音落笔泼墨，高音提笔游丝，呈现中国传统写意美学。                                                              |
| **流金丝绸 (Silk Aurora)**             | 纳维-斯托克斯流体物理动力学模拟，金色流光丝绸在空气中受声波冲击波拂动起伏。                                                         |
| **流光幻境 (Spatial Mesh 3D)**         | WebGL 三维拓扑流体网格变形，法线随音频泛音颤动产生实时幻彩干涉菲涅尔高光。                                                          |
| **神经之网 (Cyberpunk Particles)**     | 赛博朋克粒子力场突触网络，数千个带电粒子在节点间高速放电激变。                                                                      |
| **生命流体 (Organic Fluid)**           | 具有粘稠表面张力的有机水银流体球，随节奏分裂、融合并呈现物理镜面反射。                                                              |
| **极光幻影 (Aurora Wave)**             | 多层高斯流光波纹在夜空幕布下交织起伏，绿色与紫色的极光帷幕随音乐荡漾。                                                              |
| **频谱奇点 (Spectrum Ring)**           | 环形发散引力场奇点，圆周多频段雷达波束在空间中激荡扩散。                                                                            |
| **星海漫游 (Nebula Field)**            | 3D 星际穿越飞掠场景，数万颗恒星向视线扑面而来，重低音触发曲速跃迁闪光。                                                             |
| **量子空间 (Vinyl Groove)**            | 3D 动态旋转黑胶唱盘与音轨纹路微观微距视图，光轨在唱针与沟槽间流淌。                                                                 |
| **赛博矩阵 (Cyber Matrix)**            | 经典绿光数据流瀑布与三维空间网格跳变，音频节奏触发数字代码暴雨震颤。                                                                |
| **棱镜脉冲 (Prism Pulse)**             | 多棱镜折射几何分形，纯白光柱穿过晶体分裂为光谱色散彩虹脉冲。                                                                        |

---

### 2. 💿 Mineradio 3D 空间唱片架 (v0.2 SPATIAL)

专为大屏与桌面沉浸式选歌设计的全 3D 虚拟唱片架：

- **双展示模态自由切换**：
  - **舞台展开模态 (Stage Mode)**：呈弧形半包围剧场式陈列所有专辑与歌单，当前唱片居中主角放大展示；
  - **侧栏透视模态 (Side Mode)**：PSP 风格侧倾 $55^\circ$ 景深阶梯陈列，翻阅手感极具物理工业机械质感。
- **高级液态玻璃双层内发光边缘**：
  - 彻底移除了直角外挂网格，改由卡片内部贴合 $36\text{px}$ 倒角的高级液态微发光线条生成；
  - 外层细腻微透白光边 + 内层温润香槟金微发光晕圈，高光自然收敛，与唱片封面完美呼应。
- **全部分类标签与无痕横向滚动**：
  - 支持「全部歌单」、「全部单曲」、「我的收藏」、「最近播放」、「离线曲库」、「每日推荐」分类极速筛选；
  - 注入跨端无痕滚动规范（`no-scrollbar scrollbar-hide`），彻底根除系统原生灰白滚动条，支持普通鼠标滚轮直接横向平移。
- **二级曲目详情看板 (Tracklist Billboard)**：
  - 点击任意 3D 唱片，立即平滑唤出 $78\text{dvh}$ 暗黑液态玻璃磨砂曲目瀑布流，支持一键整单播放、快速加入队列、收藏与单曲搜索。

---

### 3. 🏝️ 灵动岛多形态流体播放器 (Dynamic Island & Floating Player)

突破传统播放器的呆板固定底部栏，首创多形态流体灵动岛微交互：

```
Level 1: 极简灵动岛 (Mini Capsule)   ──[悬停/点击]──>   Level 2: 舒展控制胶囊 (396px~440px)
                                                                 │
                                                       [双击 / 展开按钮]
                                                                 ↓
Level 4: 沉浸大唱片全屏 (Fullscreen Player) <──[最大化]───  Level 3: 全功能悬浮卡片 (Expanded Card)
```

- **Level 1 Minimal Dynamic Island**：悬浮在屏幕边缘的微型小药丸，仅展示旋转黑胶缩略图与实时跳动微型均衡器。
- **Level 2 Island Controls（舒展胶囊）**：
  - 常驻舒展宽度 $396\text{px}$（悬停自适应扩展至 $440\text{px}$），消除暴躁折叠空洞与残影；
  - 严格遵循半圆内切圆安全边距法则（`pl-3.5 pr-4.5`），控制按钮全量规范统一为 `w-7 h-7`，消除任何贴边与裁切；
  - 常驻展示歌曲标题与实时滚动的双语动态微歌词，内置 0ms 极速高光控制组（歌词、上一首、播放/暂停、下一首、倍速、红心、展开）。
- **Level 3 Expanded Floating Card**：展开为具有 Apple 暗黑磨砂质感的悬浮全功能面板，支持音频波形与实时频谱一键切换，并提供 NowPlayingHalo 氛围光晕皮肤换肤。
- **Level 4 Fullscreen Player**：震撼的全屏双栏大唱片视图，包含唱针起落动效、动态自适应高斯模糊环境光幕与实时滚动歌词墙。
- **物理惯性拖拽与边缘吸附**：全局支持以平滑阻尼在屏幕任意位置自由拖拽，松手后智能停驻并限制安全边界。

---

### 4. 🎛️ 专业单例音频引擎与 DSP 音效中心 (Audiophile Audio Pipeline)

专为对音质与听感有极高要求的数字音乐发烧友设计：

- **单例 AudioContext 架构与自愈看门狗**：
  - 全局唯一硬件级 `AudioContext` 实例驱动，杜绝多实例创建造成的音频上下文冲突与卡顿；
  - 内置 `AudioContextWatchdog`，当系统睡眠唤醒或驱动中断导致上下文处于 `suspended` 时，0ms 自动静默自愈恢复。
- **30 段专业高精图示均衡器 (30-Band EQ)**：
  - 覆盖 $20\text{Hz}\sim20\text{kHz}$ 的 30 个高精度 Biquad 滤波器节点，增益范围 $\pm12\text{dB}$；
  - 预设覆盖：纯净人声、流行重低音、摇滚现场、交响古典、爵士沙龙、电子迷幻、Hi-Res 监听声场等。
- **17 种独立创意 DSP 效果链与 2D XY 空间垫**：
  - **效果器矩阵**：Lo-Fi 电话亭、磁带黑胶杂音模拟、母带级卷积混响、立体声拓宽 (Stereo Widener)、自动声相环绕 (Auto Pan)、移相器 (Phaser)、合唱 (Chorus)、法兰 (Flanger)、颤音 (Tremolo)、超重低音 (MegaBass)、明亮高音、动态激励器、压限器 (Compressor)、3D 空间化 (Spatial Audio)、8D 颅内环绕等；
  - **2D XY 垫**：可在二维触控垫上实时拖拽控制点，平滑渐变调节声场宽度与空间混响深度。
- **智能无缝交叉混音器 (Crossfade Mixer)**：
  - 支持 $0\sim15\text{秒}$ 任意可调的切歌淡入淡出（Crossfade），结合音量对数曲线，实现 DJ 级无缝无感知换曲；
  - **AB Loop 循环标记**：支持在时间轴任意标记 A 点与 B 点，精准毫秒级片段循环。

---

### 5. ✋ 隔空手势无感交互系统 (Air Gesture Control)

告别鼠标与触控，只要坐在电脑前挥动双手，即可优雅掌控音乐节奏：

- **MediaPipe 21 关节点三维立体追踪**：通过前置普通摄像头进行毫秒级手势骨骼解算与姿态识别。
- **直觉手势字典**：
  - 🖐️ **向左/向右轻挥**：流畅切换至上一首 / 下一首歌曲；
  - ✊ **握拳 (Fist)**：极速静音并暂停当前播放；
  - ✋ **张开手掌 (Open Palm)**：恢复正常播放；
  - ☝️ **空中垂直滑动 (Pinch / Slider)**：精准调节音量大小与播放进度。
- **低功耗动态调度与绝对隐私安全**：
  - 闲置无手部入镜时自动降低采样帧率，CPU/GPU 占用骤降；
  - **纯本地机器学习推理**，所有视频流仅在内存中作为像素数据即刻处理后丢弃，绝不上云存储或回传。

---

### 6. 🧠 情感矩阵 AI 与音乐大脑 (Emotion Matrix & Neural Interface)

将听觉与认知科学、人工智能深度结合的音乐探索矩阵：

- **2D 情绪坐标轴系统 (Valence × Energy)**：
  - 横轴表示情绪正负（Valence：从忧郁悲伤到明媚狂喜），纵轴表示能量高低（Energy：从静谧舒缓到激昂澎湃）；
  - 每一首导入的歌曲都会经过 AI 音频特征提取算法，被精准投射为星图上的一个发光星点。
- **情绪圈选与心境随行**：
  - 鼠标在坐标系中自由框选特定区域（例如“低能量+高愉悦”的午后微醺区），系统即可智能筛选并生成符合当前情绪意境的专属播放列表。
- **AI 灵感随身笔记 (AI Liner Notes)**：
  - 基于大语言模型对曲目歌词、旋律调式与歌手创作背景进行深度挖掘，自动生成富有文学美感的定制乐评与诗意解读。
- **听觉审美基因图谱 (Auditory Gene)**：
  - 长期追踪用户的听歌偏好，可视化解构您在节奏偏好、音色明暗度、旋律复杂度维度的审美基因进化。

---

### 7. 🌐 多源聚合网络与曲库资产中心 (Sources & Library Hub)

打破平台数据孤岛，打造真正属于自己的终极数字音乐资产库：

- **多平台聚合音源搜索与播放**：
  - 聚合多方主流音源通道，支持按单曲、歌手、歌单、专辑跨源统一极速检索；
  - 支持自动流式解密与断流智能备用源降级切换（Fallback Routing），播放成功率显著提升。
- **全格式本地高保真音乐导入与标签解析**：
  - 完美支持 **FLAC, APE, WAV, MP3, OGG, M4A, AAC, DSF, DFF (DSD64/128/256)** 格式本地直接导入；
  - 基于高效 Web Worker 流式解析 ID3v1/ID3v2、Vorbis Comment、FLAC Metadata 标签与内嵌超清封面，秒级导入万首曲目不卡顿。
- **离线持久化存储引擎 (IndexedDB VibeMusicDB v3)**：
  - 采用结构化分库技术存储音频二进制流与元数据，离线断网亦能完整享受高保真播放；
  - 配套数据分析看板与存储配额自适应清理策略。
- **智能歌单引擎 (Smart Playlist Rules Engine)**：
  - 支持像写 SQL 一样自由构建过滤规则（如 `播放次数 > 20 且 语种 == 日语 且 流派 包含 CityPop`），歌单内容随曲库动态实时刷新。
- **曲库健康度诊断中心 (Library Health Center)**：
  - 自动扫描全曲库，识别缺失封面、元数据乱码、失效死链曲目，并支持一键自动化修复补全。

---

### 8. 📜 电影级沉浸式双语歌词与动态光影 (Lyrics Engineering)

- **毫秒级三语融合解析器**：
  - 支持 LRC 标准时间轴与逐字增强时间轴，原生支持**原文歌词 + 中文翻译 + 罗马音/拼音音译**三行同步渲染；
- **逐字卡拉 OK 炫彩染色流动**：
  - 结合 Web Audio 时钟驱动，高亮渐变色根据演唱进度在字母与字形笔画间平滑流淌；
- **全屏歌词大字体视效**：
  - 提供居中对齐、左对齐画报风格、动态模糊离焦背景与逐行弹性滚轮滑动；
- **歌词与封面校准编辑器**：
  - 内置在线歌词搜索补全工具、手动 LRC 文本导入编辑以及毫秒级时间轴提前/滞后平移校准。

---

### 9. 🎨 社交音乐海报工坊 (Social Poster Workshop)

将当前正在聆听的感动瞬间，定格为可以直接分享到社交网络的高分辨率视觉大片：

- **12+ 种大师级版式模板**：
  - 极简黑胶封套、怀旧拍立得相纸、卡带磁带复古盒子、CD 透明水晶盒、现代杂志大字体长图等；
- **深度视觉参数调优**：
  - 提取封面主色调生成自适应流光渐变底图，自定义毛玻璃透明度、纹理噪点与暗角强度；
- **一键高清无损导出**：
  - 基于 Canvas 高分屏 2x/3x 渲染管线，一键生成高清 PNG/JPG 格式海报，自动集成歌词选段、歌曲信息与专属二维码。

---

### 10. 🗃️ 专业音频工具箱 (Professional Audio Tools)

面向进阶创作者与调音玩家的内建实用工具群：

- **音频格式转换中心 (Format Converter)**：在浏览器端纯前端将常见格式互转为高品质 WAV/MP3/FLAC/OGG；
- **DSD 高解析转换器 (DSD Converter)**：将发烧级 DSD (DSF/DFF) 码流无损解调降采样为 PCM 音轨；
- **波形裁剪与铃声截取器 (Track Cutter)**：可视化音频波形编辑器，自由拖拽选区制作专属铃声；
- **音频声学指纹比对仪 (Fingerprint Scanner)**：基于 Chromaprint 算法比对两首曲目的声学指纹一致性。

---

## 🏛️ 系统架构与拓扑图

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

---

## ⌨️ 键盘快捷键速查

| 按键                                       | 功能操作                                                    |
| :----------------------------------------- | :---------------------------------------------------------- |
| <kbd>Space</kbd>                           | 播放 / 暂停播放                                             |
| <kbd>→</kbd> / <kbd>←</kbd>                | 快进 5 秒 / 快退 5 秒                                       |
| <kbd>↑</kbd> / <kbd>↓</kbd>                | 音量增加 5% / 音量减少 5%                                   |
| <kbd>Shift</kbd> + <kbd>→</kbd>            | 切至下一首曲目                                              |
| <kbd>Shift</kbd> + <kbd>←</kbd>            | 切至上一首曲目                                              |
| <kbd>M</kbd>                               | 切换 3D 空间唱片架展示模态 (Stage 舞台展开 ↔ Side 侧栏透视) |
| <kbd>Q</kbd> / <kbd>⌘</kbd> + <kbd>L</kbd> | 呼出 / 隐藏 3D 空间立体唱片架抽屉                           |
| <kbd>F</kbd>                               | 进入 / 退出全屏歌词大唱片模式                               |
| <kbd>V</kbd>                               | 进入 / 退出沉浸式电影级可视化视听剧场                       |
| <kbd>E</kbd>                               | 打开 / 关闭 2D 情感矩阵 AI 坐标图谱                         |
| <kbd>L</kbd>                               | 呼出 / 关闭当前歌词浮窗与详细设置                           |
| <kbd>S</kbd>                               | 打开全功能快捷搜索面板                                      |
| <kbd>Esc</kbd>                             | 关闭当前打开的所有弹窗、抽屉或退回主界面                    |

---

## 🚀 安装与快速启动

### 环境准备

- **Node.js**：`>= 20.11.0`（推荐使用 Node 20 LTS 或 Node 22）
- **npm**：`>= 10.0.0`
- **Python（可选）**：`>= 3.10`（若需使用本地 ModelScope 高级乐理特征提取分析后端）

### 1. 克隆源码仓库

```bash
git clone https://github.com/NanQiaoMi/music_source_code.git
cd music_source_code
```

### 2. 安装前端项目依赖

```bash
npm install --legacy-peer-deps
```

### 3. 环境配置 (可选)

复制 `.env.example` 为 `.env.local` 并配置第三方大模型 Key（用于 AI 随身乐评与歌词笔记功能）：

```bash
cp .env.example .env.local
```

### 4. 启动开发服务器

```bash
# 启动 Web 前端开发服务器 (默认端口 3025)
npm run dev
```

浏览器访问：[`http://localhost:3025`](http://localhost:3025)

如需同时联调 Python FastAPI 后端服务，可运行：

```bash
npm run dev:full
```

---

## 🖥️ 桌面端打包构建

MIMI Music Player 完美支持打包为跨平台桌面客户端（Windows / macOS / Linux）：

### Windows 端（x64）

完整构建脚本会自动执行代码清理、Next.js 生产构建、PyInstaller Python 后端打包以及 Electron-Builder 封包：

```powershell
# 在 Windows PowerShell 执行 (生成 Portable 免安装版与 NSIS 安装程序)
./scripts/build-desktop-win.ps1 -Clean
```

或使用内置 npm 脚本：

```bash
npm run build:electron:win
```

构建产物将输出至 `dist-electron/` 目录中。

---

## 🛡️ 工程质量与测试门禁

项目遵循严苛的工业级工程代码规范与自动化测试基准：

- **严格模式 TypeScript**：`tsconfig.json` 开启 `strict: true`，构建时 `ignoreBuildErrors: false`，0 类型警告。
- **ESLint 严格清零**：源码执行 `npx eslint src` 保持 **0 errors / 0 warnings**。
- **全量单元测试矩阵**：内置 206+ 个测试套件，**1319+ 项测试用例全部通过**。
- **Git 卫生与安全**：禁止直接在发布主干分支硬推，强制执行分支隔离验证与 `--no-ff` 可追溯合并流程。

```bash
# 运行单元测试
npm run test -- --run

# 运行代码规范校验
npm run lint

# 运行 TypeScript 严格类型检查
npx tsc --noEmit --incremental false
```

---

## 🤝 参与开发与贡献

热烈欢迎全球先锋开发者、声音设计师与视觉极客加入 MIMI Music Player 的开发建设！

1. **Fork** 本仓库至您的 GitHub；
2. 从最新稳定分支切出您的工作特性分支（例如 `feature/amazing-visualizer`）；
3. 遵循现有的代码风格与命名规范，以最小可运行增量进行修改；
4. 运行 `npm run test -- --run` 与 `npm run lint` 确保全绿；
5. 提交清晰规范的 Commit 信息（如 `feat(visual): add new cyberpunk shader`）；
6. 提交 Pull Request，我们将第一时间进行代码评审与交流！

---

## 📄 开源协议与鸣谢

本项目采用 [MIT 许可证](LICENSE) 开源。

特别鸣谢以下卓越开源生态的滋养：

- [Next.js](https://nextjs.org/) & [React](https://react.dev/)
- [Three.js](https://threejs.org/) & WebGL Community
- [Framer Motion](https://www.framer.com/motion/)
- [Zustand](https://github.com/pmndrs/zustand)
- [MediaPipe](https://developers.google.com/mediapipe)
- [Lucide Icons](https://lucide.dev/)

---

<div align="center">

**Developed with ❤️ by 大咪小咪组**  
_Vibe Music Player — 重新定义聆听的感官维度_

</div>
