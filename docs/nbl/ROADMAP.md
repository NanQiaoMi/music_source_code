## 2026-05-17 Reality Update

Active plan: `docs/nbl/plans/2026-05-16-experience-polish-and-design-upgrade.md`.

Completed on branch `codex/animation-function-iteration-plan`:

- Phase 3 queue completion: multi-select queue actions, play-next helper extraction, queue store action wiring. Commit `d2c20f3`.
- Audio effects preset/morph pass: built-in presets, morph interpolation, safe persisted preset metadata, rebuilt Audio Effects panel. Commit `9547cdd`.
- Audio processing honesty pass: replaced fake conversion/crossfade blobs with capability detection and preview-only/export-disabled states. Commit `b2ae01e`.
- Phase 1 coupling pass: `recommendationStore` no longer imports playlist/emotion stores directly; `AudioLiquidV8` no longer uses dynamic `require("@/store/uiStore")`. Commit `f4bd42f`.

Still open from the 2026-05-16 plan:

- Part B design polish tasks for Search, Lyrics, Library, Stats, and Visualization settings.
- Part C new feature tasks: Smart Mix Sessions, Listening Journal, Now Playing Halo skin pack.
- Final full `npm run test`, `npm run build`, and local browser smoke on port 3025.

---
# MIMI Music Player 迭代路线�?
> **版本**: v1.0 | **创建日期**: 2026-05-10 | **核心理念**: 不修改已�?UI/视觉效果，聚焦功能完善、架构优化、体验提�?
---

## 现状总览

```
已完成的坚固基础                         待完善的薄弱环节
┌───────────────────────────�?    ┌────────────────────────────────�?�?32+ 功能面板框架 (Glass)   �?    �?8 �?Store 功能是骨架存�?     �?�?28 �?V8 效果文件          �?    �?11 个效果未注册到系�?         �?�?44 �?Zustand Store        �?    �?动�?require() 循环依赖       �?�?16 个自定义 Hooks          �?    �?重复 Song 类型定义             �?�?完整的玻璃拟�?UI           �?    �?Store 耦合过重                 �?�?Electron 桌面包装           �?    �?批量操作缺失                   �?�?音视频引擎框�?              �?    �?无播放队列持久化               �?�?设计系统 Tokens + Glass �? �?    �?测试覆盖�?~5%                �?�?手势控制 / 快捷�?          �?    �?ESLint 19,790 行问�?         �?└───────────────────────────�?    └────────────────────────────────�?```

---

## 优先级策�?
```
P0 🔴 堵塞修复 ── 已有框架但功能是空壳/假数据，直接影响用户体验
P1 🟡 功能增强 ── 新功能或已有功能的重要完善，提升使用价�?P2 🔵 架构优化 ── 代码质量、可维护性、性能提升
P3 🟢 锦上添花 ── 体验细节打磨
```

---

## Phase 0 �?基础设施与流程搭建（1-2 天）

**目标**: 建立文档体系、修复格式化问题、激�?CI

| 任务 | 描述 | 预计工时 |
|------|------|---------|
| 0.1 | 提交文档体系（AGENTS/PROCESS/CODING_STANDARDS/ARCHITECTURE/ROADMAP�?| 2h |
| 0.2 | Prettier 全项目格式化（修�?18,954 个样式错误） | 1h |
| 0.3 | 激�?CI 测试步骤 + 设置覆盖率门�?30% | 1h |
| 0.4 | 更新 PR Template + Changelog 路径 | 0.5h |

---

## Phase 1 �?Store 架构解耦（2-3 天）

**目标**: 消除循环依赖、拆分过大的 Store、建�?Coordinator �?
| 任务 | 描述 | 类型 |
|------|------|------|
| 1.1 | 设计 Coordinator 层接口规�?| P2 |
| 1.2 | 实现 AudioCoordinator / QueueCoordinator | P2 |
| 1.3 | 替换 emotionStore 中直�?import �?Coordinator 通信 | P2 |
| 1.4 | 消除动�?require() 循环依赖 | P2 |
| 1.5 | 拆分 audioStore（抽�?playerStore + 精简 audioStore�?| P2 |
| 1.6 | 统一 Song 类型�?`src/types/song.ts` | P2 |

---

## Phase 2 �?P0 堵塞修复�?-4 天）

**目标**: 8 �?P0 功能从骨架存根变为真实可�?
| # | 任务 | 涉及文件 | 描述 |
|---|------|----------|------|
| 2.1 | 健康检查真实化 | `healthCheckStore.ts`, `libraryHealthStore.ts` | 集成真实文件扫描 |
| 2.2 | 备份恢复真实�?| `backupRestoreStore.ts` | JSON Schema 校验 + �?Store 写入 |
| 2.3 | 推荐系统真实�?| `recommendationStore.ts`, `recommendationLogic.ts` | 播放历史 + 情感标签 + 随机发现 |
| 2.4 | AB 循环真实执行 | `abLoopStore.ts`, `useAudioPlayer.ts` | rAF 监听 currentTime + seek |
| 2.5 | 收藏功能持久�?| `favoritesStore.ts` | 添加 Zustand persist |
| 2.6 | V8 效果注册补齐 | `effects/index.ts` | 11 个未注册效果导入 |
| 2.7 | 歌词封面编辑补齐 | `lyricsCoverStore.ts` | Canvas 裁剪/缩放 |
| 2.8 | FFmpeg 加载真实�?| `audioProcessingStore.ts` | 真实加载 FFmpeg.wasm |

---

## Phase 3 �?P1 功能增强�?-4 天）

| # | 任务 | 描述 |
|---|------|------|
| 3.1 | 播放队列系统完善 | 持久�?/ 插入下一�?/ 自动清空 / Fisher-Yates shuffle |
| 3.2 | 批量操作支持 | 多�?/ 批量播放 / 批量添加到播放列�?/ 批量删除 |
| 3.3 | 统计数据分析仪表�?| 播放时长 / 分布热力�?/ Top 10 / 品味时间�?|
| 3.4 | 搜索功能增强 | 分页 / 虚拟滚动 / 过滤�?/ 搜索历史 |
| 3.5 | 自定义主题导入导�?| JSON 导入导出 / 内置 3-5 个预�?|
| 3.6 | AB 循环进度条视觉标�?| 进度�?A/B 点标�?+ 拖拽调整 |

---

## Phase 4 �?架构优化 + 测试覆盖�?-4 天）

| # | 任务 | 类型 |
|---|------|------|
| 4.1 | Store 测试覆盖（Top 10 关键 Store�?| P2 |
| 4.2 | Utils �?AudioEngine 核心层测试补�?| P2 |
| 4.3 | 事件监听器清理（useAudioPlayer cleanup�?| P2 |
| 4.4 | 组件 Selector 优化（GlobalPlayerBar / PanelOrchestrator�?| P2 |
| 4.5 | TypeScript 修复（清�?no-explicit-any + no-unused-vars�?| P2 |
| 4.6 | 消除重复类型定义 | P2 |
| 4.7 | 合并两个 HealthIssueType 定义 | P2 |

---

## Phase 5 �?视觉打磨 + P3�?-3 天）

| # | 任务 | 类型 |
|---|------|------|
| 5.1 | 缺失通用组件补齐（GlassInput / GlassSelect / GlassToggle / EmptyState / LoadingSkeleton / VirtualList�?| P3 |
| 5.2 | 快捷键可配置（Store 映射 + UI 面板�?| P3 |
| 5.3 | 拖拽排序增强（跨列表 / 多选） | P3 |
| 5.4 | 更多播放列表格式（PLS / XSPF / WPL�?| P3 |

---

## 时间线总览

```
Week 1              Week 2              Week 3              Week 4
┌────────────────�? ┌────────────────�? ┌────────────────�? ┌────────────────�?�?Phase 0         �? �?Phase 2         �? �?Phase 3         �? �?Phase 4+5       �?�?基础设施 + 流程  �? �?P0 堵塞修复     �? �?P1 功能增强     �? �?优化 + 视觉     �?�?                �? �?                �? �?                �? �?                �?�?文档体系 �?    �? �?健康检�?      �? �?队列完善       �? �?Store 测试     �?�?Prettier 格式�?�? �?备份恢复       �? �?批量操作       �? �?TS 修复        �?�?CI 激�?       �? �?推荐系统       �? �?统计仪表�?    �? �?Glass 组件补全  �?�?                �? �?AB循环+收藏    �? �?搜索增强       �? �?快捷键配�?    �?�?Phase 1 (并行)  �? �?V8 + FFmpeg    �? �?主题导入导出   �? �?               �?�?Store 解�?     �? �?歌词编辑�?    �? �?               �? �?               �?└────────────────�? └────────────────�? └────────────────�? └────────────────�?```

---

## 执行原则

- **每个任务 = 独立 `feature/xxx` 分支 �?PR �?Review �?合并**
- **Phase 0 + Phase 1 可并�?*（文�?+ 解耦互不依赖）
- **Phase 2-3 串行**（功能修复依�?store 解耦完成）
- **Phase 4-5 可并�?*（测�?+ 视觉互不依赖�?
---

## 涉及文件变动总览

| Phase | 文件 | 操作 |
|-------|------|------|
| 0 | `AGENTS.md`, `docs/nbl/*.md` | 新建 |
| 0 | `src/**/*.{ts,tsx,css,json}` | Prettier 格式�?|
| 0 | `.github/workflows/deploy.yml` | 取消注释测试步骤 |
| 0 | `vitest.config.ts` | 添加覆盖率阈�?|
| 1 | `src/store/coordinator/` | 新建目录 |
| 1 | `src/store/audioStore.ts` | 拆分 |
| 1 | `src/store/playerStore.ts` | 新建（抽取） |
| 1 | `src/types/song.ts` | 合并类型 |
| 2 | 8 �?store 文件 | 重构 |
| 2 | `src/components/visualization-v8/effects/index.ts` | 修改 |
| 2 | `src/hooks/useAudioPlayer.ts` | 修改 |
| 3 | `src/store/queueStore.ts`, `playlistStore.ts`, `searchStore.ts`, `statsAchievementsStore.ts` | 修改 |
| 3 | `src/components/stats/StatsVisuals.tsx` | 重构 |
| 4 | 10+ store 测试文件 | 新建 |
| 4 | 多个组件 | Selector 优化 |
| 5 | `src/components/shared/Glass/` | 新增组件 |
| 5 | `src/hooks/useKeyboardShortcuts.ts` | 重构 |