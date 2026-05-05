# 深度优化实施计划 (Deep Optimization Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 按照 A->B->C 顺序对播放器进行深度性能调优、架构清理和视觉打磨。

**Architecture:** 采用“数据驱动性能、层次化状态管理、文件系统自动发现”的方案，减少渲染开销并提升代码可维护性。

**Tech Stack:** Next.js, Three.js, Zustand, ESLint, Framer Motion

---

### Task 1: 阶段 A - 真实性能指标追踪

**Files:**
- Modify: `src/store/performanceV8Store.ts`
- Modify: `src/components/visualization-v8/engines/RenderEngineManager.tsx`

- [ ] **Step 1: 更新 Store 定义以支持 WebGL 指标**
修改 `PerformanceState` 接口，增加对绘制调用和 GPU 内存的追踪。
```typescript
// src/store/performanceV8Store.ts
interface PerformanceState {
  // ... 现有字段
  drawCalls: number;
  gpuMemory: number; // MB
  // ...
}
```

- [ ] **Step 2: 在渲染循环中提取 WebGL 指标**
在 `RenderEngineManager.tsx` 的渲染循环中获取 Three.js 渲染器数据。
```typescript
// src/components/visualization-v8/engines/RenderEngineManager.tsx
const info = threeSceneRef.current.renderer.info;
updateStats({
  fps,
  cpuUsage: /* ... */,
  memoryUsage: performance.memory?.usedJSHeapSize / (1024 * 1024) || 0,
  drawCalls: info.render.calls,
  gpuMemory: info.memory.geometries + info.memory.textures // 简化计算
});
```

- [ ] **Step 3: 提交更改**
```bash
git add src/store/performanceV8Store.ts src/components/visualization-v8/engines/RenderEngineManager.tsx
git commit -m "perf: enable real-time WebGL metrics tracking"
```

---

### Task 2: 阶段 A - 渲染链路稳定性优化

**Files:**
- Modify: `src/components/visualization-v8/engines/RenderEngineManager.tsx`

- [ ] **Step 1: 对 RenderContext 进行 Memoize 处理**
避免每一帧都重新创建上下文对象。
```typescript
const ctx = useMemo(() => ({
  canvas: canvasRef.current!,
  width: displayWidth,
  height: displayHeight,
  // ... 其他静态属性
}), [displayWidth, displayHeight]);
```

- [ ] **Step 2: 提交更改**
```bash
git add src/components/visualization-v8/engines/RenderEngineManager.tsx
git commit -m "perf: memoize render context and stabilize render loop"
```

---

### Task 3: 阶段 B - 修复 ESLint 与开发环境

**Files:**
- Modify: `.eslintrc.json`
- Modify: `package.json`

- [ ] **Step 1: 解决插件冲突**
修改 `.eslintrc.json` 确保 `next` 和 `prettier` 插件顺序正确。
```json
{
  "extends": [
    "next/core-web-vitals",
    "plugin:prettier/recommended"
  ]
}
```

- [ ] **Step 2: 运行 Lint 检查并修复简单错误**
运行: `npm run lint`
根据报错修复 `src` 下的静态代码问题。

- [ ] **Step 3: 提交更改**
```bash
git add .eslintrc.json package.json
git commit -m "build: fix eslint configuration and developer environment"
```

---

### Task 4: 阶段 C - 特效全量注册与自动化

**Files:**
- Modify: `src/components/visualization-v8/effects/index.ts`
- Modify: `src/components/visualization-v8/effects/initEffects.ts`

- [ ] **Step 1: 实现基于模块化的特效注册**
修改 `initEffects.ts` 引入所有当前文件夹下的特效。
```typescript
// src/components/visualization-v8/effects/initEffects.ts
import * as Effects from "./index"; // 假设 index.ts 导出了所有特效
export function initAllEffects() {
  Object.values(Effects).forEach(effect => {
    if (effect && typeof effect === 'object' && 'id' in effect) {
      registerEffect(effect as EffectPlugin);
    }
  });
}
```

- [ ] **Step 2: 提交更改**
```bash
git add src/components/visualization-v8/effects/
git commit -m "feat: unlock all 28 visualization effects via automated registration"
```

---

### Task 5: 阶段 C - UI 视觉精修与毛玻璃质感

**Files:**
- Modify: `src/components/GlassCard.tsx`

- [ ] **Step 1: 优化毛玻璃参数**
调整模糊度和饱和度以匹配设计文档。
```tsx
// src/components/GlassCard.tsx
const glassStyle = {
  backdropFilter: "blur(20px) saturate(180%)",
  backgroundColor: "rgba(255, 255, 255, 0.05)",
  border: "1px solid rgba(255, 255, 255, 0.1)"
};
```

- [ ] **Step 2: 提交更改**
```bash
git add src/components/GlassCard.tsx
git commit -m "style: refine glassmorphism effects for premium feel"
```
