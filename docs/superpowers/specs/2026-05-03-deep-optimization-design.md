# 深度优化设计方案 (Deep Optimization Design)

## 1. 背景与目标
本项目是一个基于 Next.js + Electron 的高端音乐播放器，拥有复杂的可视化渲染系统。目前的深度优化目标是按照“性能调优 -> 架构清理 -> 视觉打磨”的顺序（A->B->C），全面提升应用的流畅度、稳定性和视觉表现力。

## 2. 详细设计 (方案 A -> B -> C)

### 阶段 A：性能引擎调优 (Performance Optimization)
*   **真实指标追踪**：修改 `src/store/performanceV8Store.ts`。利用 `WEBGL_debug_renderer_info` 等扩展，在 `RenderEngineManager` 中实时更新渲染压力数据（Draw Calls, GPU Memory）。
*   **渲染上下文记忆化**：在 `RenderEngineManager.tsx` 中使用 `useMemo` 对 `RenderContext` 进行记忆化，并优化 `requestAnimationFrame` 的依赖项，避免不必要的上下文重建。
*   **特效懒加载**：将 `src/components/visualization-v8/effects/` 中的特效文件导出方式改为 `const Effect = dynamic(() => import(...))`，并仅在切换到该特效时加载对应模块。

### 阶段 B：架构与稳定性清理 (Architecture & Stability)
*   **ESLint 环境修复**：清理 `.eslintrc.json` 中的插件冲突，修复 Prettier 与 Next.js lint 规则的兼容性。
*   **Store 层次化重构**：将分散的 41 个 Store 按功能域（音频、渲染、UI、系统）进行逻辑分组，合并冗余的状态片段。
*   **错误鲁棒性**：为所有 V8 可视化层添加 `PanelErrorBoundary`，在渲染出错时自动重置引擎而非导致界面白屏。

### 阶段 C：视觉体验打磨 (UX & Aesthetics)
*   **特效全量注册**：重写 `src/components/visualization-v8/effects/initEffects.ts`，实现基于文件系统的自动化注册，激活所有 28 个特效。
*   **毛玻璃视觉升级**：对 `GlassCard.tsx` 和 `GlassRadarWidget.tsx` 进行微调，使用 `backdrop-filter: blur(...) saturate(...)` 的黄金比例配置。
*   **动效衔接**：为全局 `PanelOrchestrator` 添加视图切换动画，增强操作的连贯感。

## 3. 验收标准
- [ ] `npm run lint` 无报错。
- [ ] 性能监控面板能够实时显示 Draw Calls 数量。
- [ ] 所有 28 个特效均可在菜单中选中并正常运行。
- [ ] 应用首屏 JS 加载体积显著减少。

## 4. 实施顺序
1. 阶段 A (性能) -> 2. 阶段 B (架构) -> 3. 阶段 C (视觉)
