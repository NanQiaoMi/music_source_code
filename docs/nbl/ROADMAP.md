# MIMI Music Player 迭代路线图

> **版本**: v1.0 | **创建日期**: 2026-05-10 | **核心理念**: 不修改已有 UI/视觉效果，聚焦功能完善、架构优化、体验提升

---

## 现状总览

```
已完成的坚固基础                         待完善的薄弱环节
┌───────────────────────────┐     ┌────────────────────────────────┐
│ 32+ 功能面板框架 (Glass)   │     │ 8 个 Store 功能是骨架存根      │
│ 28 个 V8 效果文件          │     │ 11 个效果未注册到系统          │
│ 44 个 Zustand Store        │     │ 动态 require() 循环依赖       │
│ 16 个自定义 Hooks          │     │ 重复 Song 类型定义             │
│ 完整的玻璃拟态 UI           │     │ Store 耦合过重                 │
│ Electron 桌面包装           │     │ 批量操作缺失                   │
│ 音视频引擎框架               │     │ 无播放队列持久化               │
│ 设计系统 Tokens + Glass 库  │     │ 测试覆盖率 ~5%                │
│ 手势控制 / 快捷键           │     │ ESLint 19,790 行问题          │
└───────────────────────────┘     └────────────────────────────────┘
```

---

## 优先级策略

```
P0 🔴 堵塞修复 ── 已有框架但功能是空壳/假数据，直接影响用户体验
P1 🟡 功能增强 ── 新功能或已有功能的重要完善，提升使用价值
P2 🔵 架构优化 ── 代码质量、可维护性、性能提升
P3 🟢 锦上添花 ── 体验细节打磨
```

---

## Phase 0 — 基础设施与流程搭建（1-2 天）

**目标**: 建立文档体系、修复格式化问题、激活 CI

| 任务 | 描述 | 预计工时 |
|------|------|---------|
| 0.1 | 提交文档体系（AGENTS/PROCESS/CODING_STANDARDS/ARCHITECTURE/ROADMAP） | 2h |
| 0.2 | Prettier 全项目格式化（修复 18,954 个样式错误） | 1h |
| 0.3 | 激活 CI 测试步骤 + 设置覆盖率门禁 30% | 1h |
| 0.4 | 更新 PR Template + Changelog 路径 | 0.5h |

---

## Phase 1 — Store 架构解耦（2-3 天）

**目标**: 消除循环依赖、拆分过大的 Store、建立 Coordinator 层

| 任务 | 描述 | 类型 |
|------|------|------|
| 1.1 | 设计 Coordinator 层接口规范 | P2 |
| 1.2 | 实现 AudioCoordinator / QueueCoordinator | P2 |
| 1.3 | 替换 emotionStore 中直接 import → Coordinator 通信 | P2 |
| 1.4 | 消除动态 require() 循环依赖 | P2 |
| 1.5 | 拆分 audioStore（抽取 playerStore + 精简 audioStore） | P2 |
| 1.6 | 统一 Song 类型到 `src/types/song.ts` | P2 |

---

## Phase 2 — P0 堵塞修复（3-4 天）

**目标**: 8 个 P0 功能从骨架存根变为真实可用

| # | 任务 | 涉及文件 | 描述 |
|---|------|----------|------|
| 2.1 | 健康检查真实化 | `healthCheckStore.ts`, `libraryHealthStore.ts` | 集成真实文件扫描 |
| 2.2 | 备份恢复真实化 | `backupRestoreStore.ts` | JSON Schema 校验 + 各 Store 写入 |
| 2.3 | 推荐系统真实化 | `recommendationStore.ts`, `recommendationLogic.ts` | 播放历史 + 情感标签 + 随机发现 |
| 2.4 | AB 循环真实执行 | `abLoopStore.ts`, `useAudioPlayer.ts` | rAF 监听 currentTime + seek |
| 2.5 | 收藏功能持久化 | `favoritesStore.ts` | 添加 Zustand persist |
| 2.6 | V8 效果注册补齐 | `effects/index.ts` | 11 个未注册效果导入 |
| 2.7 | 歌词封面编辑补齐 | `lyricsCoverStore.ts` | Canvas 裁剪/缩放 |
| 2.8 | FFmpeg 加载真实化 | `audioProcessingStore.ts` | 真实加载 FFmpeg.wasm |

---

## Phase 3 — P1 功能增强（3-4 天）

| # | 任务 | 描述 |
|---|------|------|
| 3.1 | 播放队列系统完善 | 持久化 / 插入下一首 / 自动清空 / Fisher-Yates shuffle |
| 3.2 | 批量操作支持 | 多选 / 批量播放 / 批量添加到播放列表 / 批量删除 |
| 3.3 | 统计数据分析仪表板 | 播放时长 / 分布热力图 / Top 10 / 品味时间线 |
| 3.4 | 搜索功能增强 | 分页 / 虚拟滚动 / 过滤器 / 搜索历史 |
| 3.5 | 自定义主题导入导出 | JSON 导入导出 / 内置 3-5 个预设 |
| 3.6 | AB 循环进度条视觉标记 | 进度条 A/B 点标记 + 拖拽调整 |

---

## Phase 4 — 架构优化 + 测试覆盖（3-4 天）

| # | 任务 | 类型 |
|---|------|------|
| 4.1 | Store 测试覆盖（Top 10 关键 Store） | P2 |
| 4.2 | Utils 和 AudioEngine 核心层测试补充 | P2 |
| 4.3 | 事件监听器清理（useAudioPlayer cleanup） | P2 |
| 4.4 | 组件 Selector 优化（GlobalPlayerBar / PanelOrchestrator） | P2 |
| 4.5 | TypeScript 修复（清零 no-explicit-any + no-unused-vars） | P2 |
| 4.6 | 消除重复类型定义 | P2 |
| 4.7 | 合并两个 HealthIssueType 定义 | P2 |

---

## Phase 5 — 视觉打磨 + P3（2-3 天）

| # | 任务 | 类型 |
|---|------|------|
| 5.1 | 缺失通用组件补齐（GlassInput / GlassSelect / GlassToggle / EmptyState / LoadingSkeleton / VirtualList） | P3 |
| 5.2 | 快捷键可配置（Store 映射 + UI 面板） | P3 |
| 5.3 | 拖拽排序增强（跨列表 / 多选） | P3 |
| 5.4 | 更多播放列表格式（PLS / XSPF / WPL） | P3 |

---

## 时间线总览

```
Week 1              Week 2              Week 3              Week 4
┌────────────────┐  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐
│ Phase 0         │  │ Phase 2         │  │ Phase 3         │  │ Phase 4+5       │
│ 基础设施 + 流程  │  │ P0 堵塞修复     │  │ P1 功能增强     │  │ 优化 + 视觉     │
│                 │  │                 │  │                 │  │                 │
│ 文档体系 ✅     │  │ 健康检查       │  │ 队列完善       │  │ Store 测试     │
│ Prettier 格式化 │  │ 备份恢复       │  │ 批量操作       │  │ TS 修复        │
│ CI 激活        │  │ 推荐系统       │  │ 统计仪表板     │  │ Glass 组件补全  │
│                 │  │ AB循环+收藏    │  │ 搜索增强       │  │ 快捷键配置     │
│ Phase 1 (并行)  │  │ V8 + FFmpeg    │  │ 主题导入导出   │  │                │
│ Store 解耦      │  │ 歌词编辑器     │  │                │  │                │
└────────────────┘  └────────────────┘  └────────────────┘  └────────────────┘
```

---

## 执行原则

- **每个任务 = 独立 `feature/xxx` 分支 → PR → Review → 合并**
- **Phase 0 + Phase 1 可并行**（文档 + 解耦互不依赖）
- **Phase 2-3 串行**（功能修复依赖 store 解耦完成）
- **Phase 4-5 可并行**（测试 + 视觉互不依赖）

---

## 涉及文件变动总览

| Phase | 文件 | 操作 |
|-------|------|------|
| 0 | `AGENTS.md`, `docs/nbl/*.md` | 新建 |
| 0 | `src/**/*.{ts,tsx,css,json}` | Prettier 格式化 |
| 0 | `.github/workflows/deploy.yml` | 取消注释测试步骤 |
| 0 | `vitest.config.ts` | 添加覆盖率阈值 |
| 1 | `src/store/coordinator/` | 新建目录 |
| 1 | `src/store/audioStore.ts` | 拆分 |
| 1 | `src/store/playerStore.ts` | 新建（抽取） |
| 1 | `src/types/song.ts` | 合并类型 |
| 2 | 8 个 store 文件 | 重构 |
| 2 | `src/components/visualization-v8/effects/index.ts` | 修改 |
| 2 | `src/hooks/useAudioPlayer.ts` | 修改 |
| 3 | `src/store/queueStore.ts`, `playlistStore.ts`, `searchStore.ts`, `statsAchievementsStore.ts` | 修改 |
| 3 | `src/components/stats/StatsVisuals.tsx` | 重构 |
| 4 | 10+ store 测试文件 | 新建 |
| 4 | 多个组件 | Selector 优化 |
| 5 | `src/components/shared/Glass/` | 新增组件 |
| 5 | `src/hooks/useKeyboardShortcuts.ts` | 重构 |