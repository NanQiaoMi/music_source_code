# Changelog

## 2026-05-17

### Added

- `d2c20f3` feat(queue): multi-select queue actions, play-next pure helpers, and queue store action wiring.
- `9547cdd` feat(audio-effects): built-in effect presets, morph interpolation, safe preset persistence, and rebuilt Audio Effects panel.
- `b2ae01e` feat(audio): processing capability detection plus preview-only/export-disabled conversion and crossfade states.
- `f4bd42f` refactor(coupling): recommendation input helper, store decoupling, and static `AudioLiquidV8` UI store import.

### Verified

- `npm run test -- src/lib/queue src/store/queueStore.test.ts`
- `npm run test -- src/lib/audio/effectsPresets.test.ts src/store/audioEffectsStore.test.ts`
- `npm run test -- src/lib/audio/processingCapabilities.test.ts`
- `npm run test -- src/lib/recommendation/inputs.test.ts src/store/recommendationStore.test.ts src/utils/recommendationLogic.test.ts`

## [v0.3.0] - TBD

### ✨ 新功能

- feat(ui): 新增 P3 通用 Glass 组件（GlassInput/GlassSelect/GlassToggle/EmptyState/LoadingSkeleton/VirtualList）
- feat(settings): 新增可配置快捷键系统（KeyboardShortcutsSettings + keyboardShortcutsStore）

### 🐛 Bug 修复

<!-- 按 fix(type): description 格式添加 -->

### 🔧 重构与优化

- refactor(store): 增强 queueStore 功能（插入下一首/自动清空模式）
- refactor(store): 增强 smartPlaylistStore 逻辑
- refactor(hooks): 重写 useKeyboardShortcuts 支持 Store 驱动配置
- style: Prettier 全项目格式化

### 📚 文档

- docs: 新增 AGENTS.md 项目入口文件
- docs: 新增开发流程规范（PROCESS.md）
- docs: 新增编码与测试规范（CODING_STANDARDS.md）
- docs: 新增系统架构文档（ARCHITECTURE.md）
- docs: 新增迭代路线图（ROADMAP.md）
- docs: 归档 28 份旧文档到 docs/nbl/archive/
- docs: 新增 Phase 0-1 实施计划（plans/）

### 🧪 测试

- test(ui): 新增 P3Components.test.tsx（14 个测试）
- test(store): 新增 keyboardShortcutsStore 测试

### 🔨 CI/CD

- ci: 激活 GitHub Actions 测试步骤
- ci: 设置 Vitest 覆盖率门禁（statements≥30%, branches≥20%）

## [v0.2.0] - 2026-05-09

### ✨ 新功能

- 实现 AI Emotional Liner Notes
- 重构 Resonance Totem 视觉效果
- SpectrumRing 工业化审美优化
- 沉浸式影像级可视化系统完善

### 🔧 重构与优化

- 项目模块化重构完成
- 统一 Glass 组件库

### 📚 文档

- 更新 README v0.2 特性介绍
- 新增 AI Agent 成果总结
