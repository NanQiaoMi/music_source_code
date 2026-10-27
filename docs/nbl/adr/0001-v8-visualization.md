# ADR 0001: V8 可视化处置

- 状态: Proposed
- 日期: 2026-10-21
- 关联: D1（00-decisions.md）、S4-7、S5-4
- 决策人: 待用户

## 背景

- src/components/visualization-v8（38 非测试文件 / 11,355 行）组件树未被 page.tsx 挂载；VisualizationViewV8 仅自身测试引用。
- 但并非"零引用"：visualizationV8Store 被 AppleUnifiedNavIsland.tsx:36,151,168 与 aiAgentTools.ts:7,726 引用（当前写入无渲染消费者＝空操作）；performanceV8Store 被 V7 的 VisualSettings/NowPlayingHalo/PlayerSkinsPanel 使用。
- 实际挂载的是 V7（src/components/visualization，14 效果，18,495 行）。
- V8 的 RenderEngineManager 生命周期（DPR/resize/contextlost/FPS 降档）与 EffectPlugin 契约设计正确。

## 决策（推荐）

采用 C：冻结 V8 实现 → 把 EffectPlugin/RenderEngineManager 契约移植到 src/runtime/ → 重定向 5 处 store 引用 → 删除 V8 实现（S4-7）。
如产品明确需要 28+ 效果，再评估方案 B（完成接线）。

## 影响

- 减少 tsc/vitest/搜索/误读成本（不减少首屏包体）。
- 需要视觉回归（V7 14 效果截图）与 store 引用迁移测试。

## 验收

- src 内 visualization-v8/VisualizationViewV8 引用 = 0；tsc/vitest/build 绿；V7 行为/截图不变。
