# Changelog

## 2026-05-21

### Added

- feat(journal): confirmed playback now auto-records Listening Journal events with local mood labels.

### Changed

- The journal store now persists per-day playback events, rebuilds day rollups from those events, preserves notes, and prunes events with the 90-day journal window.
- Journal day details now show per-song play counts and listened minutes from recorded playback events.

### Verified

- Targeted tests passed: npm run test -- src/lib/journal/listeningJournal.test.ts src/store/listeningJournalStore.test.ts; 2 files, 13 tests.
- Journal detail tests passed: npm run test -- src/lib/journal/listeningJournal.test.ts src/components/widgets/JournalDayPanel.test.tsx src/store/listeningJournalStore.test.ts; 3 files, 14 tests.
- Type check passed: npx tsc --noEmit --pretty false.
- Production build passed: npm run build.
- Full Vitest suite passed: npm run test; 67 files, 350 tests. Vitest still prints non-fatal existing worker shutdown and jsdom canvas getContext warnings after the pass.

## 2026-05-20

### Added

- `dde228e` feat(search): Search command center now supports `/pause`, `/next`, `/prev`, and `/volume 60` backed by real audio store actions.
- feat(settings): Visual settings now exposes Cinematic, Balanced, and Battery performance presets backed by the V8 performance store.
- `3176e35` feat(smart-playlist): usable rule builder and pure smart-playlist rule engine.
- `f8fb272` feat(library): actionable Library Health results, issue ignore flow, and stable report export.
- `ca36fb5` feat(search): `/sleep` command execution through the real sleep timer store.
- `ad66673` feat(mix): Smart Mix Sessions MVP with deterministic session helper, store, and widget.
- `b21bf2f` feat(journal): local Listening Journal with persisted day notes and panel routing.

### Changed

- `69b7f8c` refactor(stats): typed Stats dashboard view models for overview metrics and daily history.
- `71662d2` refactor(visualization): typed V8 audio snapshot passed through render context instead of reading `_currentMusicTime`.

### Fixed

- `96a48a7` fix(verification): final TypeScript/build/smoke blockers, including event typing, theme color parsing, nullable narrowing, command expectations, and local `noise.svg` asset references.
- `d207bc7` test: stabilized the full Vitest suite by setting an explicit 10s per-test timeout for import-heavy jsdom tests.

### Verified

- Search command slice: targeted tests passed, 5 files and 26 tests; targeted ESLint passed; `npm run build` passed; local Search panel smoke showed `/pause`, `/next`, `/prev`, and `/volume 60` with 0 console/page/request/404 errors.
- Visual settings preset slice: targeted tests passed, 2 files and 4 tests; targeted ESLint passed; `npm run build` passed; local smoke on `http://localhost:3025` showed title `MIMI Music Player` with 0 console errors.
- Targeted tests passed: 11 files, 46 tests.
- Full test suite passed after `d207bc7`: 48 files, 293 tests.
- `npm run build` passed.
- Local smoke passed on `http://localhost:3025`: title `MIMI Music Player`, Search panel opened, 0 console errors, 0 page errors, 0 404s.
- Broad targeted ESLint over older touched UI files still has inherited formatting/debt and was not used as the final gate.

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
