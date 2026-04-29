# Vibe Music Player V8.0

一个具有沉浸式UI体验和高级音频可视化的音乐播放器，支持25种专业可视化效果、预设管理、关键帧动画系统。

## 🎵 功能特性

### 核心功能
- 🎨 **玻璃拟态UI设计** - 现代化的透明玻璃效果
- 🎵 **完整播放控制** - 播放/暂停、上一首/下一首、进度控制
- 📝 **三行歌词显示** - 支持双语歌词
- 🎹 **音频均衡器** - 专业音频处理
- 📊 **25种可视化效果** - Canvas + WebGL 双引擎渲染
- 📦 **预设管理系统** - 导入/导出/收藏/分类
- ⏱️ **关键帧动画系统** - 音频驱动 + 时间轴编辑
- 📈 **性能监控面板** - 实时FPS/CPU/内存监控
- 🌙 **动态主题** - 自适应色彩主题

### 高级特性
- 🖐️ **手势控制系统**（MediaPipe）
- 👆 **虚拟光标**
- 🎥 **3D立体播放器**
- 📁 **本地音乐管理**
- 🔄 **智能播放列表**
- 💾 **离线缓存**
- 🌐 **多音源支持**

---

## 🛠️ 技术栈

### 前端技术
- **Next.js 14** - React框架
- **React 18** - UI库
- **TypeScript** - 类型安全
- **Tailwind CSS** - 样式框架
- **Framer Motion** - 动画库
- **Zustand** - 状态管理
- **Lucide React** - 图标库

### 可视化技术
- **Canvas 2D** - 2D渲染引擎
- **Three.js** - WebGL 3D渲染
- **Web Audio API** - 音频分析与处理

### 后端技术（可选）
- **FastAPI** - Python后端API
- **Uvicorn** - ASGI服务器

---

## 🎨 25种可视化效果

### 频谱类（4种）
| 效果ID | 名称 | 描述 |
|--------|------|------|
| spectrum-v8 | 频谱V8 | 基础柱状频谱 |
| ring-spectrum-v8 | 环形频谱 | 环形频谱显示 |
| spectrum-waterfall-v8 | 频谱瀑布 | 滚动式频谱瀑布 |
| spectrum-spiral-v8 | 频谱螺旋 | 螺旋状频谱 |

### 粒子类（8种）
| 效果ID | 名称 | 描述 |
|--------|------|------|
| particle-burst | 粒子爆发 | 音频驱动粒子爆发 |
| particle-grid-v8 | 粒子网格 | 粒子连接网格 |
| particle-flow-field-v8 | 粒子流场 | 流动场粒子效果 |
| particle-trail-v8 | 粒子轨迹 | 粒子轨迹拖尾 |
| particle-nebula-v8 | 粒子星云 | 3D星云效果 |
| particle-gravity-v8 | 粒子引力 | 引力场粒子系统 |
| particle-vortex-v8 | 粒子旋涡 | 旋涡粒子效果 |
| particle-explosion-v8 | 音频爆炸 | 音频触发爆炸 |

### 形状类（5种）
| 效果ID | 名称 | 描述 |
|--------|------|------|
| waveform-v8 | 波形V8 | 音频波形显示 |
| audio-shape-v8 | 音频形状 | 几何形状变形 |
| audio-painting-v8 | 音频绘画 | 抽象画笔绘画 |
| vibration-geometry-v8 | 振动几何 | 几何形状振动 |
| audio-crystal-v8 | 音频水晶 | 3D水晶效果 |

### 几何类（2种）
| 效果ID | 名称 | 描述 |
|--------|------|------|
| fractal-geometry-v8 | 分形几何 | 分形图形生成 |
| kaleidoscope-v8 | 万花筒 | 镜像万花筒 |

### 物理类（1种）
| 效果ID | 名称 | 描述 |
|--------|------|------|
| spring-system-v8 | 弹簧系统 | 物理弹簧模拟 |

### 空间类（5种）
| 效果ID | 名称 | 描述 |
|--------|------|------|
| star-field-v8 | 星场穿越 | 3D星场飞行 |
| tunnel-flight-v8 | 隧道飞行 | 3D隧道效果 |
| space-grid-v8 | 3D网格 | 空间网格波浪 |
| audio-sculpture-v8 | 音频雕塑 | 3D雕塑变形 |
| audio-liquid-v8 | 音频液体 | 流体模拟效果 |

---

## 📁 项目结构

```
vibe-music-player/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── layout.tsx               # 根布局
│   │   ├── page.tsx                 # 主页
│   │   ├── data-manager/            # 数据管理器页面
│   │   │   └── page.tsx
│   │   └── globals.css              # 全局样式
│   │
│   ├── components/                   # React组件
│   │   ├── visualization-v8/        # V8.0可视化系统
│   │   │   ├── VisualizationViewV8.tsx          # 主视图
│   │   │   ├── engines/
│   │   │   │   └── RenderEngineManager.tsx      # 双渲染引擎管理器
│   │   │   ├── effects/
│   │   │   │   ├── index.ts                      # 效果注册
│   │   │   │   ├── initEffects.ts                # 效果初始化
│   │   │   │   ├── SpectrumV8.ts                 # 频谱V8
│   │   │   │   ├── ParticleBurst.ts              # 粒子爆发
│   │   │   │   ├── RingSpectrumV8.ts             # 环形频谱
│   │   │   │   ├── WaveformV8.ts                 # 波形V8
│   │   │   │   ├── ParticleGridV8.ts             # 粒子网格
│   │   │   │   ├── AudioShapeV8.ts               # 音频形状
│   │   │   │   ├── SpectrumWaterfallV8.ts        # 频谱瀑布
│   │   │   │   ├── ParticleFlowFieldV8.ts        # 粒子流场
│   │   │   │   ├── ParticleTrailV8.ts            # 粒子轨迹
│   │   │   │   ├── ParticleNebulaV8.ts           # 粒子星云
│   │   │   │   ├── KaleidoscopeV8.ts              # 万花筒
│   │   │   │   ├── SpectrumSpiralV8.ts           # 频谱螺旋
│   │   │   │   ├── FractalGeometryV8.ts          # 分形几何
│   │   │   │   ├── AudioPaintingV8.ts            # 音频绘画
│   │   │   │   ├── VibrationGeometryV8.ts        # 振动几何
│   │   │   │   ├── SpringSystemV8.ts             # 弹簧系统
│   │   │   │   ├── StarFieldV8.ts                 # 星场穿越
│   │   │   │   ├── TunnelFlightV8.ts              # 隧道飞行
│   │   │   │   ├── SpaceGridV8.ts                 # 3D网格
│   │   │   │   ├── AudioSculptureV8.ts            # 音频雕塑
│   │   │   │   ├── ParticleGravityV8.ts           # 粒子引力
│   │   │   │   ├── AudioLiquidV8.ts                # 音频液体
│   │   │   │   ├── AudioCrystalV8.ts               # 音频水晶
│   │   │   │   ├── ParticleVortexV8.ts            # 粒子旋涡
│   │   │   │   └── ParticleExplosionV8.ts         # 音频爆炸
│   │   │   ├── panels/
│   │   │   │   ├── PerformanceMonitorPanel.tsx    # 性能监控面板
│   │   │   │   ├── PresetManagerPanel.tsx         # 预设管理面板
│   │   │   │   └── AnimationTimelinePanel.tsx     # 动画时间轴面板
│   │   │   └── shared/
│   │   │       └── ParameterControls.tsx          # 参数控件
│   │   │
│   │   ├── GlassCard.tsx           # 玻璃卡片
│   │   ├── GlassButton.tsx         # 玻璃按钮
│   │   ├── GlassSlider.tsx         # 玻璃滑块
│   │   ├── Background.tsx          # 背景组件
│   │   ├── MusicCardStack.tsx      # 音乐卡片堆叠
│   │   ├── VirtualCursor.tsx       # 虚拟光标
│   │   ├── Player3D.tsx            # 3D播放器
│   │   ├── LyricVisualizer.tsx     # 歌词可视化
│   │   ├── GestureController.tsx   # 手势控制器
│   │   ├── LocalMusicManager.tsx   # 本地音乐管理
│   │   ├── SettingsPanel.tsx       # 设置面板
│   │   └── ... (更多组件)
│   │
│   ├── hooks/                      # 自定义Hooks
│   │   ├── useVisualizationV8.ts   # V8可视化Hook
│   │   ├── useAudioPlayer.ts       # 音频播放器
│   │   ├── useHandGesture.ts       # 手势识别
│   │   ├── useLyricParser.ts       # 歌词解析
│   │   ├── useDynamicTheme.ts      # 动态主题
│   │   └── ... (更多Hooks)
│   │
│   ├── store/                      # Zustand状态管理
│   │   ├── visualizationV8Store.ts # V8可视化状态
│   │   ├── animationStore.ts        # 动画状态
│   │   ├── presetStore.ts           # 预设状态
│   │   ├── performanceV8Store.ts    # 性能监控状态
│   │   ├── audioStore.ts            # 音频状态
│   │   ├── uiStore.ts               # UI状态
│   │   ├── playlistStore.ts         # 播放列表状态
│   │   └── ... (更多Store)
│   │
│   ├── lib/                        # 工具库
│   │   ├── visualization/
│   │   │   ├── types.ts             # 可视化类型定义
│   │   │   └── animationTypes.ts    # 动画类型定义
│   │   ├── three/
│   │   │   └── ThreeJSScene.ts     # Three.js场景
│   │   └── audio/
│   │       ├── AudioEffectsManager.ts
│   │       └── AudioGraphManager.ts
│   │
│   ├── services/                   # 服务层
│   │   ├── localMusicService.ts    # 本地音乐服务
│   │   ├── lyricsService.ts        # 歌词服务
│   │   ├── metadataStorage.ts      # 元数据存储
│   │   └── ... (更多服务)
│   │
│   └── utils/                      # 工具函数
│       ├── formatTime.ts
│       ├── colorExtractor.ts
│       └── ... (更多工具)
│
├── public/                         # 静态资源
│   └── default-cover.svg
│
├── docs/                           # 文档
│   ├── MODEL_DOWNLOAD_GUIDE.md    # 模型下载指南
│   ├── MODEL_INTEGRATION_PLAN.md  # 模型集成计划
│   ├── PROJECT_DOCUMENTATION.md   # 项目文档
│   ├── PROJECT_MIGRATION_GUIDE.md # 项目迁移指南
│   ├── TROUBLESHOOTING.md         # 故障排除
│   ├── V5_ITERATION_TASK.md       # V5迭代任务
│   ├── V8.0_DEVELOPMENT_PLAN.md   # V8.0开发计划
│   └── V7.0_DEVELOPMENT_PLAN.md   # V7.0开发计划
│
├── musicapi/                       # 音源API
│   ├── lx-music-source.js
│   ├── flower-v1.js
│   └── ... (更多音源)
│
├── scripts/                        # 脚本
│   ├── clean-port.js
│   ├── start-full.js
│   └── local/                      # 本地开发辅助脚本
│       ├── clean-and-rebuild.ps1
│       ├── download_models.py
│       ├── fix-encoding.js
│       ├── fix-refs.js
│       ├── fix-scrolling.js
│       ├── start-backend.bat
│       └── start-full.bat
│
├── electron/                       # Electron桌面应用
│   ├── main/
│   │   └── index.js
│   └── preload/
│       └── index.js
│
├── backend/                        # 后端API（可选）
│   ├── main.py
│   ├── requirements.txt
│   └── ... (更多后端文件)
│
├── package.json                    # 项目依赖
├── next.config.js                  # Next.js配置
├── tailwind.config.ts              # Tailwind配置
├── tsconfig.json                   # TypeScript配置
├── .eslintrc.json                  # ESLint配置
├── .prettierrc                     # Prettier配置
└── README.md                       # 项目文档
```

---

## 🚀 快速开始

### 环境要求
- Node.js 18+
- npm 9+
- Windows / macOS / Linux

### 安装依赖

```bash
npm install
```

### 启动开发服务器

```bash
npm run dev
```

打开浏览器访问 [http://localhost:3025](http://localhost:3025)

### 构建生产版本

```bash
npm run build
```

### 启动生产服务器

```bash
npm start
```

### 启动完整版本（前端+后端）

```bash
npm run start-full
```

---

## 🎮 使用说明

### 鼠标操作
- 悬停在卡片上查看效果
- 点击卡片进入播放界面
- 左右按钮切换卡片
- 在播放界面点击左上角返回

### 键盘快捷键
- `←` `→` 切换卡片
- `Enter` 或 `空格` 选择卡片
- `P` 切换性能监控面板
- `S` 切换设置面板
- `ESC` 退出全屏

### 手势操作
- 启用摄像头后，移动手掌控制光标
- 左右摆手切换卡片
- 握拳手势选择卡片

### 可视化效果
1. 在可视化界面顶部选择效果
2. 点击右侧设置按钮打开参数面板
3. 选择基础/专业/专家模式查看不同级别的参数
4. 点击预设按钮管理预设
5. 点击动画按钮使用关键帧动画
6. 点击性能按钮查看实时性能数据

---

## 🎨 参数系统

### 三层参数模式

| 模式 | 描述 | 参数数量 |
|------|------|---------|
| 基础模式 | 3-5个最核心参数，适合普通用户 | 3-5 |
| 专业模式 | 10-15个详细参数，适合进阶用户 | 10-15 |
| 专家模式 | 所有技术参数开放，适合专业用户 | 全部 |

### 参数类型
- **数字参数** - 滑块调节
- **选择参数** - 下拉选择
- **颜色参数** - 颜色选择器
- **开关参数** - 开关切换

---

## 📦 预设管理系统

### 预设功能
- ✅ 保存当前效果参数为预设
- ✅ 加载已保存的预设
- ✅ 导入/导出预设文件
- ✅ 收藏喜欢的预设
- ✅ 预设分类标签
- ✅ 系统预设库

### 预设文件格式
```json
{
  "version": "1.0",
  "type": "single",
  "presets": [
    {
      "id": "preset-1",
      "name": "霓虹频谱",
      "description": "赛博朋克风格的频谱效果",
      "effectId": "spectrum-v8",
      "tags": ["赛博朋克", "频谱"],
      "parameters": {
        "barCount": 64,
        "barWidth": 8,
        "colorScheme": "neon"
      }
    }
  ]
}
```

---

## ⏱️ 动画时间轴系统

### 同步模式
- **音频同步** - 参数随音乐节拍/频谱变化
- **时间轴同步** - 基于时间线的关键帧动画
- **混合模式** - 音频+时间轴双重驱动

### 动画预设
| 预设名称 | 描述 |
|---------|------|
| 跟随节拍 | 参数随音乐节拍变化 |
| 低频驱动 | 主要响应低频（贝斯） |
| 全频响应 | 响应全频段频谱 |
| 渐变变化 | 参数缓慢平滑过渡 |
| 脉冲效果 | 节拍时产生脉冲 |

---

## 📊 性能监控

### 监控指标
- **FPS** - 帧率（目标30/60fps）
- **CPU使用率** - 音频分析+渲染
- **内存使用量** - 当前内存占用
- **绘制调用次数** - 每帧绘制次数
- **渲染引擎** - 当前使用的渲染引擎

### 性能档位
| 档位 | 帧率目标 | 粒子限制 | WebGL质量 |
|------|---------|---------|-----------|
| 低 | 30fps | 1000 | 低 |
| 中 | 30fps | 3000 | 中 |
| 高 | 60fps | 8000 | 高 |
| 极致 | 60fps+ | 20000+ | 超高 |

---

## 🔧 开发指南

### 添加新的可视化效果

1. 在 `src/components/visualization-v8/effects/` 创建新文件
2. 实现 `EffectPlugin` 接口
3. 在 `initEffects.ts` 中注册
4. 效果会自动出现在效果选择器中

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
  init(ctx) { /* 初始化 */ },
  render(ctx, audioData, params) { /* 渲染 */ },
  resize(width, height) { /* 调整大小 */ },
  destroy() { /* 清理 */ }
};
```

### 状态管理

项目使用 Zustand 进行状态管理，主要 Store 包括：
- `visualizationV8Store` - 可视化效果状态
- `animationStore` - 动画系统状态
- `presetStore` - 预设管理状态
- `performanceV8Store` - 性能监控状态
- `audioStore` - 音频播放状态
- `uiStore` - UI交互状态

---

## 📝 更新日志

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
- 玻璃拟态UI设计
- 动态渐变背景
- 堆叠音乐卡片交互
- 手势控制系统
- 虚拟光标
- 3D立体播放器
- 三行歌词显示
- 基础音频可视化

---

## 🤝 贡献指南

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

---

## 📄 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件

---

## 🙏 致谢

- [Next.js](https://nextjs.org/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Three.js](https://threejs.org/)
- [Zustand](https://github.com/pmndrs/zustand)
- [Framer Motion](https://www.framer.com/motion/)
- [Lucide Icons](https://lucide.dev/)
- [MediaPipe](https://google.github.io/mediapipe/)

---

**项目状态**: ✅ 活跃开发中  
**最新版本**: V8.0  
**最后更新**: 2026-03-30
