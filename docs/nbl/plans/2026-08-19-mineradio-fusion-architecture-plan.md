# MIMI Music Player (Vibe Player) v0.2.2 — Mineradio 深度融合与旗舰级升级开发计划

- **状态**: 规划完成 / 准备执行
- **日期**: 2026-08-19
- **作者**: Antigravity Pair-Programming Agent
- **参考蓝本**: d:\26project\Mineradio

---

## 一、 计划目标

将 **Mineradio** 的核心技术优势（3D 粒子流场波浪地形、3D 空间实体发光歌词排版、电影级镜头智能调度、3D 空间歌单物理架、多平台原生解密与桌面壁纸生态）深度融合到 **MIMI Music Player (Next.js 16 + React 19 + TypeScript Strict + Zustand 5)** 的高工业级架构中。

---

## 二、 核心阶段划分

### Phase 1: 视觉核心落地 — KineticParticleStageV8 (3D 粒子地貌 + 3D 实体发光歌词)
- 新增 src/components/visualization-v8/effects/ParticleTerrainStage.ts (16,384 粒子网格 + Simplex Noise + 音频波浪置换着色器)
- 新增 src/components/visualization-v8/effects/Kinetic3DLyricsStage.ts (3D 实体发光网格歌词 + 粒子消散)
- 修改 RenderEngineManager.tsx、initEffects.ts 注册为 V8 第 29 号旗舰预设。

### Phase 2: 交互与界面升级 — 3D Shelf 空间唱片架与极简暗场悬浮卡片
- 新增 src/components/library/Shelf3DView.tsx (Three.js 3D 物理唱片架 + 鼠标悬停倾斜 + 滚轮惯性)
- 新增 src/components/player/DarkCinemaFloatingCard.tsx (极简磨砂悬浮状态卡片 + 呼吸光晕)
- 修改 VisualizationViewV8.tsx 支持一键沉浸暗场模式。

### Phase 3: 算法与运镜升级 — 离线节拍分析与智能镜头导演
- 新增 src/lib/audio/AudioBeatTracker.ts (BPM / Downbeat / 段落识别)
- 新增 src/lib/visualization/CinematicDirector.ts (运镜编排: intimate-dolly / drop-rush / stage-orbit)
- 修改 visualizationV8Store.ts 接入智能运镜数据流。

### Phase 4: 音源生态重构 — 多平台原生解密与扫码中心
- 新增 src/lib/services/music-sources/qishui-decryptor.ts (汽水音频流实时解密器)
- 新增 src/lib/services/music-sources/MultiPlatformAuthService.ts (统一扫码、Cookie 持久化与跨平台音源自动降级替换)

### Phase 5: 桌面底层增强 — 桌面壁纸与极轻量歌词
- 新增 electron/wallpaperEngineRuntime.ts (挂载 Windows DWM WorkerW 桌面底层)
- 优化轻量独立透明歌词窗口。
