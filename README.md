# 🎵 MIMI Music Player (Vibe Player) V0.1

> **Not just a player, but a digital stage for your music.**

`MIMI Music Player` 是一款结合了**极致视觉美学**与**专业音频处理**的沉浸式音乐播放器。它打破了传统音频软件的界限，将玻璃拟态 UI、25 种电影级可视化效果以及情感矩阵交互融为一体，为每一首旋律打造独一无二的视觉盛宴。

---

## ✨ 核心亮点

### 🎨 电影级可视化系统 (Visual Suite V8.0)
内置 25 种专业级可视化引擎，支持 **Canvas 2D + WebGL** 双驱动。
- **频谱类**：从基础柱状图到 3D 螺旋，多维度捕捉音频动态。
- **粒子类**：引力场、流场、星云效果，由音频节奏实时驱动。
- **空间类**：3D 隧道飞行、星场穿越，打造真正意义上的沉浸式空间感。
- **苏式美学**：包含“苏维埃光谱”、“普罗列塔利亚极光”等具有工业构建主义美学的主题效果。

### 🎭 情感矩阵 (Emotion Matrix)
革命性的 **2D 情感坐标系统**，让音乐管理不再仅仅是列表。
- 通过 (X, Y) 坐标定义歌曲情绪。
- 基于坐标的智能播放列表，自动匹配你的心情。
- 直观的交互层，支持拖拽与框选。

### 🖐️ 智能交互系统
- **手势控制**：基于 MediaPipe 的手部跟踪，挥手即切换，握拳即暂停。
- **玻璃拟态 UI**：极致的透明度处理、磨砂材质感与动态高光，每一帧都是视觉享受。
- **3D 播放器**：支持 3D 立体旋转展示，让唱片封面焕发新生。

---

## 🛠️ 技术架构

本项采用最前沿的前端技术栈构建：

| 领域 | 技术方案 |
| :--- | :--- |
| **核心框架** | Next.js 14 / React 19 / TypeScript |
| **跨端能力** | Electron (支持 Windows/macOS/Linux) |
| **状态管理** | Zustand / UI & Audio Store |
| **动画引擎** | Framer Motion / GSAP / Spring Physics |
| **渲染引擎** | Three.js (WebGL) / Canvas API |
| **音频处理** | Web Audio API / AudioEngine Singleton |
| **人工智能** | MediaPipe (Hand Tracking) / Transformers.js |

---

## 🚀 快速上手

### 环境要求
- Node.js 18.x 或更高版本
- npm 9.x 或更高版本
- Python 3.10+ (用于可选的后端服务)

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

3.  **启动开发环境**
    ```bash
    # 启动 Next.js 前端 (端口 3025)
    npm run dev

    # 启动 Electron 桌面端
    npm run dev:electron
    ```

---

## 📁 目录结构

```text
├── src/
│   ├── app/                # 页面路由与布局
│   ├── components/         # 核心 UI 组件与可视化插件
│   │   ├── visualization-v8/ # V8.0 可视化渲染系统
│   │   └── emotion/        # 情感矩阵交互组件
│   ├── lib/
│   │   ├── audio/          # 核心音频分析引擎 (AudioEngine)
│   │   └── three/          # WebGL 场景管理器
│   └── store/              # 全局状态管理 (Zustand)
├── electron/               # Electron 主进程与预加载脚本
├── musicapi/               # 音源插件支持
└── backend/                # FastAPI 后端服务
```

---

## 📈 性能与优化

- **单例音频引擎**：全局统一的 `AudioContext` 管理，杜绝内存泄漏。
- **硬件加速渲染**：利用 GPU 加速 3D 粒子系统，确保 60FPS 流畅体验。
- **三层参数模式**：支持“基础”、“专业”、“专家”三种参数调节模式，满足不同层级的定制需求。

---

## 🤝 参与开发

如果你对沉浸式音视频、WebGL 渲染或情感交互感兴趣，欢迎加入我们！

1. Fork 本仓库。
2. 创建你的特性分支 (`git checkout -b feature/AmazingFeature`)。
3. 提交你的更改 (`git commit -m 'Add some AmazingFeature'`)。
4. 推送到分支 (`git push origin feature/AmazingFeature`)。
5. 开启一个 Pull Request。

---

## 📄 开源协议

本项目采用 **MIT License**。详情请参阅 [LICENSE](LICENSE) 文件。

---

**Developed with ❤️ by 大咪小咪组**
*Vibe Music Player - 重新定义聆听的维度*
