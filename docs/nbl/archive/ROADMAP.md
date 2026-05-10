# MIMI Music Player 后续开发路线图

> **版本**: v1.0
> **创建日期**: 2026-05-10
> **核心理念**: 不修改现有 UI/视觉效果，聚焦功能完善、架构优化、体验提升
> **基线版本**: v0.2 (commit `467eed5`)

---

## 现状总览

```
已完成的坚固基础                 待完善的薄弱环节
┌─────────────────────┐     ┌──────────────────────────────┐
│ 32+ 功能面板框架     │     │ 8 个 Store 功能是骨架存根    │
│ 28 个 V8 效果文件    │     │ 11 个效果未注册到系统        │
│ 44 个 Zustand Store  │     │ 动态 require() 循环依赖     │
│ 16 个自定义 Hooks    │     │ 重复 Song 类型定义           │
│ 完整的玻璃拟态 UI     │     │ Store 耦合过重               │
│ Electron 桌面包装    │     │ 批量操作缺失                 │
│ 音视频引擎框架        │     │ 无播放队列持久化             │
│ 手势控制 / 快捷键    │     │ 搜索无分页/虚拟滚动          │
│ 设计系统 Tokens      │     │ 3 个测试文件覆盖不足         │
└─────────────────────┘     └──────────────────────────────┘
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

## P0 🔴 堵塞修复 — 已有框架但功能是空壳

### 1. 健康检查引擎真实化

**问题**: `healthCheckStore.startCheck()` 只生成 3 条硬编码的 mock issues，没有真实扫描音乐库。

**涉及文件**:

- `src/store/healthCheckStore.ts` — 重构
- `src/store/libraryHealthStore.ts` — 有真实 `generateHealthReport()` 但未被使用

**任务**:

- [ ] 将 `libraryHealthStore.generateHealthReport()` 集成到 `healthCheckStore`
- [ ] 实现真实的文件存在性检查（遍历播放列表文件路径验证）
- [ ] 实现重复歌曲检测（基于文件名+时长去重）
- [ ] 实现缺失元数据检测
- [ ] 修复功能真实执行修复（删除缺失条目、合并重复）

**验收**: `运行健康检查` → 扫描真实播放列表 → 报告真实问题 → 修复真实生效

---

### 2. 备份恢复真实化

**问题**: `backupRestoreStore.restoreBackup()` 仅模拟进度条动画，无实际数据恢复。

**涉及文件**: `src/store/backupRestoreStore.ts`

**任务**:

- [ ] `downloadBackup()` 导出真实数据：播放列表、设置、收藏、歌词配置
- [ ] `restoreBackup()` 解析导入文件并写入各 Store 的 localStorage
- [ ] 添加导入文件格式验证（JSON schema 校验）
- [ ] 添加恢复前的备份确认对话框

**验收**: 备份 → 清除数据 → 恢复 → 所有播放列表和设置完整还原

---

### 3. 推荐系统真实化

**问题**: `recommendationStore.getRecommendations()` 返回硬编码的"推荐歌曲 1"。

**涉及文件**: `src/store/recommendationStore.ts`, `src/utils/recommendationLogic.ts`

**任务**:

- [ ] 实现基于播放历史的推荐（播放次数多的同风格歌曲）
- [ ] 实现基于情感标签的推荐（EmotionStore 数据）
- [ ] 实现随机发现的推荐（引入未听过或少听的歌曲）
- [ ] 推荐结果去重和非重复保证

**验收**: 播放几首歌后"每日推荐"面板显示真实的相关歌曲推荐

---

### 4. AB 循环真实执行

**问题**: `abLoopStore` 有 A/B 点状态，但 `useAudioPlayer` 未监听执行循环。

**涉及文件**: `src/store/abLoopStore.ts`, `src/hooks/useAudioPlayer.ts`

**任务**:

- [ ] 在 `useAudioPlayer` 中添加 `requestAnimationFrame` 监听 currentTime
- [ ] 实现 timeupdate 回调中检查 A/B 边界并 seek
- [ ] AB 循环启用时在播放器进度条上标记 A/B 点位置
- [ ] 循环次数计数器（无限/指定次数）

**验收**: 设置 A/B 点 → 播放到 B 点自动跳回 A 点 → 可取消

---

### 5. 收藏功能持久化

**问题**: `favoritesStore` 没有 `persist` 中间件，刷新丢失。

**涉及文件**: `src/store/favoritesStore.ts`

**任务**:

- [ ] 添加 Zustand `persist` 中间件
- [ ] 补齐与 UI 收藏按钮的联动（快捷键 Ctrl+D 调用 toggleFavorite）
- [ ] 收藏按钮状态与 Store 同步

**验收**: 收藏歌曲 → 刷新页面 → 收藏状态保留

---

### 6. V8 效果注册补齐

**问题**: 28 个效果文件中有 11 个未注册到 `effects/index.ts`。

**涉及文件**: `src/components/visualization-v8/effects/index.ts`

**任务**:

- [ ] 盘点所有效果文件，列出已注册和未注册清单
- [ ] 为未注册效果添加导入和注册
- [ ] 验证每个效果能正常渲染

**验收**: 28 个效果全部可在可视化面板中切换和展示

---

### 7. 歌词封面编辑器功能补齐

**问题**: `lyricsCoverStore.cropCover()` 和 `resizeCover()` 返回 null。

**涉及文件**: `src/store/lyricsCoverStore.ts`

**任务**:

- [ ] 实现基于 Canvas 的图片裁剪逻辑
- [ ] 实现基于 Canvas 的图片缩放逻辑
- [ ] 结果保存到歌曲元数据

**验收**: 在歌词封面编辑器中上传图片 → 裁剪/缩放 → 保存成功

---

### 8. FFmpeg 加载真实化

**问题**: `audioProcessingStore.loadFFmpeg()` 直接标记 loaded，未真实加载。

**涉及文件**: `src/store/audioProcessingStore.ts`

**任务**:

- [ ] 使用 `@ffmpeg/ffmpeg` 真实加载 FFmpeg.wasm
- [ ] 加载进度反馈给 UI
- [ ] 加载失败时提供降级提示

**验收**: 格式转换面板显示 FFmpeg 加载进度 → 加载完成后可用

---

## P1 🟡 功能增强

### 9. 播放队列系统完善

**涉及文件**: `src/store/queueStore.ts`, `src/store/audioStore.ts`

**任务**:

- [ ] 队列持久化（Zustand persist）
- [ ] "插入下一首播放"功能（在当前播放位置后插入）
- [ ] "播放完自动清空"模式（"耗尽即止"）
- [ ] "播放完自动推荐"（队列播完自动填充推荐）
- [ ] 随机播放使用 Fisher-Yates 算法替代 Math.random

---

### 10. 批量操作支持

**涉及文件**: `src/store/playlistStore.ts`, 多个 library 组件

**任务**:

- [ ] 音乐库多选模式（checkbox 选择）
- [ ] 批量播放（播放选中歌曲）
- [ ] 批量添加到播放列表
- [ ] 批量删除
- [ ] 全选/取消全选

---

### 11. 统计数据分析仪表板

**涉及文件**: `src/store/statsAchievementsStore.ts`, `src/components/stats/StatsVisuals.tsx`, `src/components/widgets/StatsAchievementsPanel.tsx`

**任务**:

- [ ] 播放时长统计（今日/本周/本月/总计）
- [ ] 歌曲分布热力图（小时×星期）
- [ ] 最常播放歌曲/歌手 Top 10
- [ ] 音乐品味演化时间线（基于情感标签变化）
- [ ] 可视化图表展示（使用 Canvas 或简单 SVG 图表）

---

### 12. 搜索功能增强

**涉及文件**: `src/store/searchStore.ts`, `src/components/player/SearchPanel.tsx`

**任务**:

- [ ] 搜索结果分页（每页 20 条）
- [ ] 虚拟滚动优化（大数据量不卡顿）
- [ ] 搜索过滤器（按歌曲/歌手/专辑/流派/时长范围）
- [ ] 搜索历史自动保存和清除

---

### 13. 自定义主题导入导出

**涉及文件**: `src/store/visualSettingsStore.ts`, `src/components/player/PlayerSkinsPanel.tsx`

**任务**:

- [ ] 当前主题配置导出为 JSON
- [ ] 从 JSON 文件导入主题
- [ ] 内置 3-5 个官方主题预设
- [ ] 一键应用社区主题

---

### 14. AB 循环进度条视觉标记

**涉及文件**: `src/components/features-v7/ABLoopPanel.tsx`, `src/components/shared/GlobalPlayerBar.tsx`

**任务**:

- [ ] 进度条上绘制 A 点和 B 点标记
- [ ] A-B 区间高亮显示
- [ ] 拖拽标记点调整 A/B 位置

---

## P2 🔵 架构优化

### 15. 消除重复类型定义

**涉及文件**: 多个文件

**任务**:

- [ ] 抽取公共 `Song` 类型到 `src/types/song.ts`
- [ ] 所有 Store 统一引用 `types/song.ts`
- [ ] 合并两个 `HealthIssueType` 定义

---

### 16. 消除动态 require()

**涉及文件**: `audioStore.ts`, `smartPlaylistStore.ts`, `emotionStore.ts`

**任务**:

- [ ] 将所有 `require()` 替换为顶层 `import`
- [ ] 验证循环依赖消除
- [ ] TypeScript 编译无错误

---

### 17. 拆分 audioStore

**问题**: `audioStore.ts` 492 行，同时管理播放、EQ、设备、淡入淡出等多重职责。

**任务**:

- [ ] 抽取 `playerStore.ts` — 播放核心状态（currentTrack, isPlaying, volume）
- [ ] 抽取 `eqStore.ts` — EQ 预设相关
- [ ] 原 `audioStore.ts` 保留为兼容层或逐步迁移

---

### 18. 事件监听器清理

**涉及文件**: `src/hooks/useAudioPlayer.ts`

**任务**:

- [ ] `attachListeners()` 返回 cleanup 函数
- [ ] 组件卸载时调用 cleanup
- [ ] 防止重复监听（先 remove 再 add）

---

### 19. 组件 Selector 优化

**任务**: 检查高频更新组件

- [ ] `GlobalPlayerBar.tsx` 使用精细化 selector 替代直接订阅整个 store
- [ ] `PanelOrchestrator.tsx` 减少不必要的重渲染
- [ ] 可视化组件仅在音频数据变化时更新

---

## P3 🟢 锦上添花

### 20. 缺失通用组件补齐

```
GlassInput      ← 输入框
GlassSelect     ← 下拉选择器
GlassToggle     ← 开关
EmptyState      ← 空状态展示
LoadingSkeleton ← 加载骨架屏
VirtualList     ← 虚拟滚动列表
```

---

### 21. 快捷键可配置

**涉及文件**: `src/hooks/useKeyboardShortcuts.ts`, `src/components/settings/KeyboardShortcutsHelp.tsx`

- [ ] 从硬编码改为从 Store 读取映射
- [ ] UI 面板允许用户修改快捷键
- [ ] 冲突检测

---

### 22. 拖拽排序增强

- [ ] 拖拽到队列外移除
- [ ] 多选拖拽
- [ ] 从搜索结果/播放列表拖入队列

---

### 23. 更多播放列表格式支持

- [ ] PLS 格式解析
- [ ] XSPF 格式解析
- [ ] WPL 格式解析

---

## 执行路线图

```
Week 1          Week 2          Week 3          Week 4
┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐
│ P0 堵塞修复  │  │ P0 剩余 +   │  │ P1 功能增强  │  │ P2 架构优化  │
│ 1-8         │  │ P1 开始    │  │ 9-14       │  │ 15-19      │
│             │  │            │  │            │  │            │
│ 健康检查    │  │ 推荐系统   │  │ 队列完善   │  │ 类型合并   │
│ 备份恢复    │  │ AB循环     │  │ 批量操作   │  │ 消除require│
│ FFmpeg      │  │ 收藏持久化 │  │ 统计仪表板 │  │ Store拆分  │
│ 歌词编辑器  │  │ V8效果补齐 │  │ 搜索增强   │  │ 清理事件   │
└────────────┘  └────────────┘  └────────────┘  └────────────┘
```

### 每条任务的工作单元

每个 P0/P1 任务 = 独立 `feature/xxx` 分支 → PR → Review → 合并

```
git checkout -b feature/health-check-real
  └─ 修改 src/store/healthCheckStore.ts
  └─ 集成 libraryHealthStore.generateHealthReport()
  └─ 测试确认
  └─ git commit -m "feat(health): real library scanning"
  └─ PR → Review → Merge
```

---

## 附录: 涉及文件变动总览

| 阶段 | 文件                                               | 操作        |
| ---- | -------------------------------------------------- | ----------- |
| P0   | `src/store/healthCheckStore.ts`                    | 重构        |
| P0   | `src/store/backupRestoreStore.ts`                  | 重构        |
| P0   | `src/store/recommendationStore.ts`                 | 重构        |
| P0   | `src/utils/recommendationLogic.ts`                 | 重构        |
| P0   | `src/hooks/useAudioPlayer.ts`                      | 修改        |
| P0   | `src/store/abLoopStore.ts`                         | 修改        |
| P0   | `src/store/favoritesStore.ts`                      | 修改        |
| P0   | `src/components/visualization-v8/effects/index.ts` | 修改        |
| P0   | `src/store/lyricsCoverStore.ts`                    | 重构        |
| P0   | `src/store/audioProcessingStore.ts`                | 重构        |
| P1   | `src/store/queueStore.ts`                          | 修改        |
| P1   | `src/store/audioStore.ts`                          | 修改        |
| P1   | `src/store/playlistStore.ts`                       | 修改        |
| P1   | `src/store/searchStore.ts`                         | 修改        |
| P1   | `src/store/visualSettingsStore.ts`                 | 修改        |
| P1   | `src/store/statsAchievementsStore.ts`              | 修改        |
| P1   | `src/components/player/SearchPanel.tsx`            | 修改        |
| P1   | `src/components/stats/StatsVisuals.tsx`            | 重构        |
| P1   | `src/components/player/PlayerSkinsPanel.tsx`       | 修改        |
| P2   | `src/types/song.ts`                                | 新建        |
| P2   | `src/store/audioStore.ts`                          | 拆分        |
| P2   | `src/store/playerStore.ts`                         | 新建        |
| P2   | `src/store/eqStore.ts`                             | 新建 (抽取) |
| P2   | 多个 store                                         | 导入修改    |
| P3   | `src/components/shared/Glass/`                     | 新增组件    |
| P3   | `src/hooks/useKeyboardShortcuts.ts`                | 重构        |
