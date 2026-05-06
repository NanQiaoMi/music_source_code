# 🎵 MIMI Music Player (Vibe Player) V0.2

> **不仅仅是播放器，更是音乐的数字舞台。**

`MIMI Music Player` 是一款将**极致视觉美学**、**AI 情感解析**与**专业音频处理**深度融合的次世代沉浸式音乐平台。它通过玻璃拟态 UI、电影级可视化引擎以及革命性的情感矩阵交互，将每一首旋律转化为一场感官与灵魂的盛宴。

---

## ✨ 核心亮点

### 🎨 电影级可视化系统 (Visual Suite V8.0)

内置 25+ 种专业级可视化引擎，支持 **Canvas 2D + WebGL** 硬件加速驱动。

- **频谱演变**：从基础柱状图到 3D 螺旋，多维度捕捉音频动态。
- **粒子力场**：引力场、流场、星云效果，由音频节奏实时驱动。
- **空间穿越**：3D 隧道飞行、星场穿越，打造极致的沉浸式空间感。
- **共鸣图腾 (Resonance Totem)**：基于音色特征生成的独特视觉标识，赋予每首歌独一无二的“灵魂印记”。

### 🎭 情感矩阵 (Emotion Matrix AI)

革命性的 **2D 情感坐标系统**，结合 AI 深度分析技术：

- **自动考古 (Music Archaeology)**：利用 AI 自动分析歌曲的 Valence（愉悦度）与 Energy（能量），将其精准定位在情感版图。
- **灵感笔记 (AI Liner Notes)**：AI 自动生成的诗意乐评与背景故事，为您解读旋律背后的深意。
- **心情驱动播放**：通过在坐标系中框选区域，快速生成符合当前心境的智能播放列表。

### 🧠 智能交互与诊断 (Neural Interface)

- **手势控制**：基于 MediaPipe 的手部跟踪，挥手即切歌，握拳即暂停，实现零接触交互。
- **神经接口**：实时监控 AI 响应延迟、系统性能与数据流向，透明化展示播放器背后的“思考”过程。
- **DNA 日志 (DNA Journal)**：记录您的音乐品味演化轨迹，通过 Auditory Gene 组件展示音乐审美的基因图谱。

---

## 🛠️ 技术架构

本项目采用最前沿的前端技术栈与 AI 模型构建：

| 领域         | 技术方案                                 |
| :----------- | :--------------------------------------- |
| **核心框架** | Next.js 16 / React 19 / TypeScript       |
| **跨端能力** | Electron (支持 Windows/macOS/Linux)      |
| **状态管理** | Zustand (Global State / AI Context)      |
| **动画引擎** | Framer Motion / GSAP / Spring Physics    |
| **渲染引擎** | Three.js (WebGL) / Canvas API            |
| **音频处理** | Web Audio API / AudioEngine Singleton    |
| **人工智能** | MediaPipe / Transformers.js / Gemini API |

---

## 🚀 快速上手

### 环境要求

- Node.js 20.x 或更高版本
- npm 10.x 或更高版本
- Python 3.10+ (用于高级 AI 音频分析后端)

### 安装与启动

1.  **克隆项目**

    ```bash
    git clone [repository-url]
    cd music_source_code
    ```

2.  **安装依赖**

    ```bash
    npm install
    ```

3.  **配置环境**
    复制 `.env.example` 为 `.env` 并填入您的 API Key（用于 AI 解析功能）。

4.  **启动开发环境**
    ```bash
    # 同时启动前端与后端服务
    npm run dev:full
    ```

---

## 📁 目录结构

```text
├── src/
│   ├── app/                # 页面路由与布局系统
│   ├── components/         # 核心 UI 组件
│   │   ├── visualization-v8/ # V8.0 电影级渲染系统
│   │   ├── emotion/        # 情感矩阵 AI 交互层
│   │   └── widgets/        # AI Toolbox, DNA Journal 等功能插件
│   ├── lib/
│   │   ├── audio/          # 核心音频分析引擎 (AudioEngine)
│   │   └── three/          # WebGL 场景管理器
│   └── store/              # 全局状态管理 (Zustand Stores)
├── electron/               # Electron 主进程与预加载逻辑
└── backend/                # FastAPI 音频特征提取后端
```

---

## 📈 性能与优化

- **单例音频引擎**：全局统一的 `AudioContext` 链路，确保极低延迟并杜绝内存泄漏。
- **GPU 硬件加速**：针对 3D 粒子系统进行深度优化，确保在 4K 分辨率下依然维持 60FPS。
- **玻璃拟态优化**：采用自研着色器处理 `backdrop-blur`，在低功耗设备上也能流畅展示。

---

## 🤝 参与开发

我们欢迎任何形式的贡献，无论是新可视化效果的开发还是 AI 模型的优化！

1. Fork 本仓库。
2. 创建您的特性分支 (`git checkout -b feature/AmazingFeature`)。
3. 提交您的更改 (`git commit -m 'Add some AmazingFeature'`)。
4. 推送到分支 (`git push origin feature/AmazingFeature`)。
5. 开启一个 Pull Request。

---

## 📄 开源协议

本项目采用 **MIT License**。详情请参阅 [LICENSE](LICENSE) 文件。

---

**Developed with ❤️ by 大咪小咪组**
_Vibe Music Player - 重新定义聆听的维度_
