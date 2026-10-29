# ADR 0001: V8 可视化处置

- 状态: **Accepted（2026-10-29，D1）**
- 日期: 2026-10-21（提议）/ 2026-10-29（批准）
- 关联: D1（00-decisions.md）、S4-7、S5-4
- 决策人: 用户（Lead 记录）

## 背景

- src/components/visualization-v8（38 非测试文件 / 11,355 行）组件树未被 page.tsx 挂载；VisualizationViewV8 仅自身测试引用。
- 但并非"零引用"：visualizationV8Store 被 AppleUnifiedNavIsland.tsx:36,151,168 与 aiAgentTools.ts:7,726 引用（当前写入无渲染消费者＝空操作）；performanceV8Store 被 V7 的 VisualSettings/NowPlayingHalo/PlayerSkinsPanel 使用。
- 实际挂载的是 V7（src/components/visualization，14 效果，18,495 行）。
- V8 的 RenderEngineManager 生命周期（DPR/resize/contextlost/FPS 降档）与 EffectPlugin 契约设计正确。

## 决策（推荐，2026-10-21）

采用 C：冻结 V8 实现 → 把 EffectPlugin/RenderEngineManager 契约移植到 src/runtime/ → 重定向 5 处 store 引用 → 删除 V8 实现（S4-7）。
如产品明确需要 28+ 效果，再评估方案 B（完成接线）。

## 决策（最终，2026-10-29 用户批准）

用户选择"**保留归档 + 清理死代码**"，不采用删除实现的路径：

- **保留** `archive/visualization-v8/`（47 文件 / 12,304 行；2026-10-27 由 `1e7ffbc` 归档，非 S4-7 所为）。
- **保留** legacy persist key `visualization-v8-store`（`src/lib/storage/storageRegistry.ts:395` EXTERNAL_KEYS，external:true，不接管读写；旧用户数据不迁移、不删除）。
- **不删除** V8 实现、**不接线**；产品若后续需要 28+ 效果再重新评估 B。
- 7b 死代码清理已于 2026-10-29 完成：删除 `CinematicDirector.ts`(113) / `ThreeJSScene.ts`(140) / `presetStore.ts`(196) / `animationStore.ts`(122)，合计 **571 行**（0 importer）。
- EffectPlugin/RenderEngineManager 契约由 S5-4 承接：`src/runtime/effectPlugin.ts` + `effectRegistry.ts` + spatialMesh/nebulaField 2/14 试点；**RenderEngineManager 不再单独移植**。
- E4-9 原验收"rg visualization-v8 = 0"按**偏差豁免**（用户 2026-10-29 接受）：src 组件树已为 0，唯一命中是保留的 legacy key。

## 影响

- 不减少首屏包体（未引用代码不进 bundle）；保留 28 效果储备与历史归档。
- 减少误读成本有限（归档在 src 之外，不参与 tsc/vitest 扫描）。
- 文档需与"V8 已归档、key 保留"一致（ARCHITECTURE/AGENTS 已同步）。

## 验收（2026-10-29）

- `src/components/visualization-v8` 目录不存在（0 文件）；`archive/visualization-v8` = 47 文件。
- `rg "visualization-v8" src` = **1**（legacy key，D1 批准保留）。
- 守卫 `scripts/dead-v8-leftovers.test.mjs` 4 用例通过（4 路径不存在 / 引用为 0 / 保留 legacy key / 基线无残留）。
- V7 代码未改动；tsc / vitest / lint 绿。

## 结果（2026-10-29）

S4-7 以"7a 保留归档 + legacy key、7b 死代码已删"收口并标记 done；store 数 64→62（7b 删除的 preset/animation store），`perf/store-line-baseline.json` 已 shrink-only 更新（113→111 文件）。
