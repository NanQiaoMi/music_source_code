# S5 渲染运行时与可视化契约 — 执行计划

> 上级计划：[架构与性能优化总计划](../2026-10-21-architecture-performance-optimization.md) §5 S5 / §4.4 / §6.2 / §8 D5、D7
> 执行包：[README](./README.md) · [决策记录](./00-decisions.md) · [进度看板](./TRACKING.md) · 相邻阶段：[S3](./S3-shell-subscriptions.md) · [S4](./S4-bundle-loading.md) · [S6](./S6-state-architecture.md)
> 阶段：S5（7 个任务，17 个 PR）；预估：1.5-2 周（单人）/ 2-3 人并行约 1 周；状态：**未开始**
> 规划快照：feature/gesture-air-control-overhaul @ c73a872；实施基线：S0-1 后的干净 master + S3-4/S3-5 已合入
> 规范依据：PROCESS.md:131-134、AGENTS.md（V7 核心视图禁令）、总计划 §1.3 不变量 / §7.2 回滚 / D5、D7

---

## 1. 阶段目标与出口条件

**目标**：建立唯一的帧调度层（VisualRuntime），把可视化/3D/浮动层的 rAF 从"组件各自为政"收敛为"单循环 + 优先级桶 + 统一门控/DPR/降级"；把 V8 已验证的 EffectPlugin/RenderEngineManager 生命周期契约移植到 V7 效果体系，先迁移 2 个试点效果；建立质量档位与长任务自降档。**本阶段只改调度与资源生命周期，不改任何效果的视觉参数与绘制公式。**

### 1.1 已核实基线（2026-10-21 工作区；行号均本计划复核）

| 指标 | 实测 | 证据 |
|---|---:|---|
| 全仓 requestAnimationFrame（非测试） | **43 处 / 20 文件** | 逐文件统计；Top：RenderEngineManager 6（V8 将删）、WaveformVisualization 4、SpectrumAnalyzer 4、Player3D 4、VisualizationView 3 |
| VisualizationView.tsx | 848 行；绘制循环 useEffect 267-578；draw 324-527；效果 switch 456-502；14 效果列表 66-81 | read 复核 |
| 可视化 DPR 上限 | 2（:60 MAX_RENDER_DPR；:275 钳制） | 与 Shelf3DView、V8 的 2 一致 |
| 可视化 rAF 门控 | 仅 document.visibilityState（:522-527、:543-555）；循环在 :267 只在进入 visualization 时启动，切走后靠 effect deps [currentView] 清理 | read 复核 |
| resize | window.resize + ResizeObserver（:308-315）、尺寸未变保护（:285）；尺寸变化时 initParticles 重建 1000 个粒子对象（:294-306） | read 复核 |
| 每帧构造 EffectContext | 408-437：每帧新建 ctx 对象 + refs 对象（9 个 ref）+ theme + utils.getThemeBaseHue 闭包 | read 复核 |
| EffectContext 类型 | src/components/visualization/effects/types.ts:2-31（ctx/width/height/data/params/time/musicTime/refs(9)/theme/utils） | read 复核 |
| 效果切换交叉淡化 | 离屏 canvas 抓帧（:332-352）+ 450ms 淡出（:504-519，EFFECT_SWITCH_FADE_MS=:64） | read 复核 |
| Shelf3DView.tsx | 2520 行；rAF 1452、1466；帧循环 1185-1468；可见/隐藏门控 1188-1191；自建自适应画质 1204-1235；取消 rAF 933-941 | read 复核 |
| 浮动层 rAF | FloatingSpectrumGlow 229,239；FloatingWaveformGlow 302,320；FloatingDebugHUD 77,81；useFloatingDragPhysics 407,410；LiquidStorageGauge 37,139；EmotionVisualizer 368,371；AppleMusicVisualizer 152；AudioSourceManagerModal 202 | 逐文件 grep（全部非测试） |
| 面板内非循环 rAF（可白名单） | AIAgentPanel:78（滚动一次）、PlaylistDetailDrawer:82（滚动节流）、useGestureSession:439（检测帧）、useAIAgentStore:459（合并 setState） | read 复核 4 处 |
| V8 生命周期样本 | RenderEngineManager.tsx 550 行：DPR 89-99、setupCanvas 116-136、resize 291-309、effect init/destroy 311-348、rAF 359-476（hidden skip 365-368、帧率上限 380-386、FPS 统计/降档 393-452）、visibilitychange 478-492、清理 494-514、卸载 516-541 | read 复核 |
| V8 EffectPlugin 类型 | lib/visualization/types.ts:74-87（init/render/resize/destroy + preferredEngine/parameters） | read 复核 |
| measure.py | 636 行；ROUTE 固定 /dev/lyric-stage（:52），依赖 window.__viz（:281、:294-309）；该路由当前不存在（src/app/dev/** 为空，已核实） | read 复核 |
| 既有测量资产 | scratch/perf/measure.py、BASELINE.md（1920×1080 dpr1：draw med≈1.3ms / p95≈1.7ms；165Hz 屏 frame med≈6.10ms、0 dropped）、_lead_determinism.py | 文件存在 |

> 结论：rAF 分散在 20 个文件；可视化已有可见性门控但**没有统一的帧预算与降级**；V8 的引擎生命周期是现成正确设计但随 V8 一起死；measure.py 因 harness 路由被删而**当前不可运行**——S5 必须先补 measure hook + harness，否则所有"性能验收"无法出证据。

### 1.2 出口条件（全部量化）

| ID | 出口 | 现状 | 目标 | 硬阈值（CI/阶段门） |
|---|---|---|---|---|
| E5-1 | 全仓 rAF 调用点（非测试、非白名单） | 43 处 / 20 文件 | **≤8 处**；含白名单文件后全仓 ≤12 | >12 |
| E5-2 | 同一时刻的 rAF 循环数（可视化+3D架+浮动层同时激活） | ≥3 | **1**（runtime 单循环） | >1 |
| E5-3 | 可视化 draw p95（1920×1080 dpr2、单效果 60s） | 以 scratch/perf/BASELINE 口径重测为 before | **劣化 ≤10%**；dropped=0；FPS 中位 ≥90 | p95 劣化 >15% 或 dropped >0 |
| E5-4 | 隐藏视图绘制 | 不可见时仍可能保留 rAF 空转（待 S3-5/本阶段治理） | 隐藏视图 **0 绘制回调**（5s 内 draw 次数=0） | >0 |
| E5-5 | 质量档位 | 无统一档位（visualSettings.visualMode 与 performanceV8Store.activePreset 两套） | D5 定义 low/medium/high 可判定、可切换；4x CPU throttle 下 10s 内自动降档；无 >200ms 长任务 | 降档不触发或出现 >200ms longtask |
| E5-6 | EffectPlugin 契约 | 中心 switch 14 效果 + 6 组共享 ref | 2 个试点效果实现同一 contract；契约测试通过；切换无残留状态 | 任一试点失败 |
| E5-7 | 粒子/resize | resize 重建 1000 对象（:294-306） | 连续 resize 100 次：对象分配不随次数线性增长；帧时间 p95 劣化 ≤10% | 线性增长 |
| E5-8 | 3 个重效果每帧分配 | 未测 | CDP Allocation Instrumentation：稳态 10s 无"每帧新增且不释放"对象类型（判定见 §5.7） | 每帧新增 >1KB/帧 |
| E5-9 | 常驻宿主拆包（canvas 宿主与控制层） | VisualizationView 单组件同层 | 控制层因 currentTime 重渲染时 canvas 宿主 commit=0（React Profiler） | canvas 宿主仍 commit |

**出口门（M5）**：E5-1..E5-9 全绿 + evidence/S5-evidence.md 含 before/after perf JSON 与 measure.py 输出。任何一项未达标必须写原因与回退决定（例如可视化 p95 劣化时回退 S5-2 flag）。

---

## 2. 前置条件、依赖与不变量

**前置**
1. S3-4（Player3D currentView 门控）与 S3-5（浮动层 gating）合入——S5-3 在其基础上迁移，避免重复改同一批文件。
2. S3-6（LazyPanel LRU + deactivate）合入——S5-3 的 3D 架/浮动层订阅必须能在关闭时 stop。
3. NEXT_PUBLIC_VISUAL_RUNTIME flag 已存在（S4-1a 建立 featureFlags.ts）；本阶段默认 **on**，出问题可一键 off 回到旧 rAF 路径（保留一版）。
4. D7 授权（S5-2 修改 VisualizationView 仅调度/门控，不改视觉）；D5 拍板（S5-6 档位阈值）。
5. measure harness：新增 dev-only 路由（见 S5-1 Step 5），并给 measure.py 加 --route 参数（当前 :52 硬编码）。**注意**：Next 会把所有 page 打进 build，harness 必须 NODE_ENV === "production" 时 notFound()，且不得进入任何导航/预取。

**依赖图**

    S5-1a(runtime core+tests) → S5-1b(measure hooks) → S5-2a(viz 迁移, 保留旧路径) → S5-2b(harness+测量) → S5-2c(删旧路径，晚一版)
    S5-1a → S5-3a(Shelf3D) / S5-3b(浮动组) / S5-3c(其余面板与 rAF 白名单)
    S5-2a → S5-4a(契约+registry) → S5-4b(spatialMesh) → S5-4c(nebulaField+switch 收敛)
    S5-4a → S5-5(粒子/EffectContext) → S5-7(3 个重效果分配审计)
    S5-1a → S5-6(qualityTier)（与 S5-3 并行，文件不相交）

**写作用域总览**：新增目录 src/runtime/**（S5-1/5-4/5-6）；src/components/visualization/**（S5-2/5/5-7）；src/components/library/Shelf3DView.tsx、src/components/player/floating/**（S5-3）；perf/（S5-1b/S5-2b）；scratch/perf/measure.py（S5-1b，仅加参数）。共享文件约束：VisualizationView.tsx 只允许 S5-2 一个 owner（S4-4c 的封面替换先行、S5-2 后置）；src/components/visualization/effects/* 由 S5-4/S5-5/S5-7 串行。

**不变量**
- I3 受保护视图：Home/Player/全屏歌词不改；VisualizationView 的 DOM/样式/动画参数不变，diff 只允许"调度/门控/事件清理"行（D7 白名单，PR 模板勾选）。
- I4 资源有 owner：每个 subscribeFrame 必须返回 handle 且组件卸载/关闭时 stop；插件 destroy 必须释放自有资源。
- I5 播放连续性：不改音频图/analyser 获取方式（S2-3 AnalyserHub 接口只读消费）。
- I7 验证顺序：eslint → vitest → tsc → build → dev/smoke → perf 专项；perf 测量必须在生产构建（npm run build; npm start，端口 3025）或固定 dev 模式下进行，并记录环境。
- 页面视觉：S5-3 迁移 3D 架/浮动层只换调度，不改 three.js 参数/材质/相机/FOV。

**feature flag 与本阶段回滚矩阵**

| 开关 | 默认 | 关闭后行为 | 适用任务 |
|---|---|---|---|
| NEXT_PUBLIC_VISUAL_RUNTIME | on | 组件走各自旧 rAF 路径（双跑一版，S5-2c 后删除旧路径） | S5-2/5-3 |
| NEXT_PUBLIC_EFFECT_PLUGINS | off→灰度开 | 中心 switch 走旧分发（插件注册表不激活） | S5-4/5-5/5-7 |
| NEXT_PUBLIC_QUALITY_TIER | on | 固定 high 档（DPR≤2、60fps 目标），不自动降档 | S5-6 |
| dev URL 参数 ?tier=low/medium/high | 无 | 仅 dev 生效，用于测量档位差异 | S5-6 |
| 代码级 revert | — | 每个 PR 独立可 revert；S5-4/5-5/5-7 每效果独立 PR | 全部 |

---

## 3. 任务总表

| ID | 任务 | 写作用域（精确文件） | 子 PR | 依赖 | 风险 | 验收 |
|---|---|---|---|---|---|---|
| S5-1 | VisualRuntime v1：单 rAF、优先级桶、统一门控/DPR/降级、measure 钩子 | src/runtime/visualRuntime.ts(新)+test、src/runtime/flags.ts(新)、src/runtime/types.ts(新)、perf/README.md(新) | 2（1a core/1b hooks+harness） | S0-6、S3-4/5、S4-1a | 中（新抽象） | E5-1/E5-2；单测 3 订阅者 1 rAF；pause/resume |
| S5-2 | VisualizationView 调度迁入 runtime（绘制不动，旧路径双跑一版） | src/components/visualization/VisualizationView.tsx、src/app/dev/viz-harness/page.tsx(新)、scratch/perf/measure.py(加 --route) | 3（2a/2b/2c） | S5-1a、D7 | 高（核心视图） | E5-3/E5-4/E5-9；14 效果截图 |
| S5-3 | Shelf3D + 浮动层 + 其余面板 rAF 迁入 runtime | src/components/library/Shelf3DView.tsx、src/components/player/floating/{FloatingSpectrumGlow,FloatingWaveformGlow,FloatingDebugHUD,useFloatingDragPhysics}.tsx、src/components/audio/{SpectrumAnalyzer,WaveformVisualization}.tsx、src/components/visualization/AppleMusicVisualizer.tsx、src/components/emotion/EmotionVisualizer.tsx、src/components/library/hub/LiquidStorageGauge.tsx、src/components/player/AudioSourceManagerModal.tsx、perf/rAF-whitelist.json(新) | 3（3a/3b/3c） | S5-1a、S3-4/5/6 | 中 | E5-1/E5-2；3D+可视化同开 FPS≥50 |
| S5-4 | EffectPlugin + registry；先迁移 spatialMesh + nebulaField | src/runtime/effectPlugin.ts(新)+test、src/runtime/effectRegistry.ts(新)+test、src/components/visualization/effects/spatialMesh.ts、nebulaField.ts、VisualizationView.tsx:456-502 | 3（4a/4b/4c） | S5-2a、D1=C 契约 | 中高 | E5-6；2 效果同 contract；截图/帧时间对比 |
| S5-5 | initParticles 对象复用；EffectContext 稳定引用（不每帧 new） | VisualizationView.tsx:294-306、:408-437+test | 1 | S5-4a | 低 | E5-7；resize 100 次无 GC 锯齿 |
| S5-6 | qualityTier + longtask 自降档（D5 阈值） | src/runtime/qualityTier.ts(新)+test、src/runtime/visualRuntime.ts（接线） | 2（6a/6b） | S5-1a | 中 | E5-5；4x throttle 自动降档 |
| S5-7 | 3 个重效果的每帧分配审计与修复 | src/components/visualization/effects/cinematicLyricDrift.ts、handwritten*.ts（见 §4.7）、orientalLandscape.ts、perf/allocation/ 脚本 | 3（7a/7b/7c） | S5-4a、S5-5 | 中 | E5-8；稳态 0 新增长期对象 |

**建议顺序（单人）**：S5-1a → S5-1b → S5-2a → S5-2b（出基线证据）→ S5-6a → S5-3a → S5-3b → S5-3c → S5-4a → S5-4b → S5-4c → S5-5 → S5-7a/b/c → S5-2c（删旧路径，单独一版后）。
理由：先用 S5-1 拿到"可测"，再迁可视化（最高风险，先双跑）；质量档位在 3D/浮动迁移前就位，避免迁移后再返工门控；插件契约最后收敛中心 switch。

---

## 4. 逐任务执行步骤

### S5-1 VisualRuntime v1（2 个 PR）

**目标**：全仓唯一帧调度者；订阅者不再直接 requestAnimationFrame；门控（可见/前台/reducedMotion）、DPR 上限、帧率上限、统计与 measure 钩子由 runtime 统一提供。
**前置**：S4-1a 的 featureFlags；无其它依赖。
**写作用域**：1a = src/runtime/types.ts(新)、src/runtime/visualRuntime.ts(新)、src/runtime/visualRuntime.test.ts(新)；1b = src/runtime/measure.ts(新)、src/app/dev/viz-harness/page.tsx(新)、scratch/perf/measure.py（只加 --route/--effects 参数）、perf/README.md(新)。

**Step 1｜S5-1a 类型与接口**（src/runtime/types.ts）

    export type FramePriority = "critical" | "normal" | "idle";

    export interface FrameGate {
      visible: boolean;               // 组件自身可见（如 currentView === "visualization"、panel.isOpen）
      foreground?: boolean;           // 默认 true；后台标签页/窗口失焦时跳过回调
      allowReducedMotion?: boolean;   // 默认 false：prefers-reduced-motion 下跳过
    }

    export interface FrameOptions {
      priority: FramePriority;
      gate: FrameGate;
      fpsCap?: number;                // 默认 critical=60、normal=30、idle=10
      eager?: boolean;                // 首帧是否立刻回调（默认 false）
    }

    export interface FrameHandle {
      readonly id: string;
      stop(): void;
      updateGate(patch: Partial<FrameGate>): void;  // 不重建订阅
      readonly active: boolean;
    }

    export interface RuntimeStats {
      fps: number; frameCount: number;
      drawP50Ms: number; drawP95Ms: number;
      droppedFrames: number;
      subscribers: { critical: number; normal: number; idle: number };
      tier: "low" | "medium" | "high";
    }

**Step 2｜S5-1a 调度器**（src/runtime/visualRuntime.ts；单例导出 visualRuntime）

    class VisualRuntime {
      subscribeFrame(id: string, cb: (t: number, dt: number) => void, opts: FrameOptions): FrameHandle;
      pause(): void;
      resume(): void;
      setDprCap(cap: number): void;      // S5-6 调用：low=1、medium=1.5、high=2
      getStats(): RuntimeStats;
      resetStats(): void;
      dispose(): void;                   // 仅测试
    }
    export const visualRuntime = new VisualRuntime();

调度器伪代码（写进文件头注释，实现按此）：

    状态：subs: Map<id, {cb, opts, active}>, rafId, lastT, paused, docHidden, reducedMotion
    单循环 tick(t):
      rafId = null
      if (paused || docHidden) return            // 恢复时由 visibilitychange 重新 schedule
      dt = lastT ? min(50, t - lastT) : 1000/60; lastT = t
      for bucket in [critical, normal, idle]:
        interval = 1000 / bucket.fpsCap
        if (t - bucket.lastRun < interval) continue
        bucket.lastRun = t
        for sub of bucket.subs:
          if (!shouldRun(sub)) continue
          t0 = performance.now()
          try { sub.cb(t, dt) } catch (e) { reportError(e); sub.stop() }
          record(performance.now() - t0)
      rafId = requestAnimationFrame(tick)
    shouldRun(sub) = sub.active && gate.visible && (!gate.foreground || !docHidden)
                     && (!reducedMotion || gate.allowReducedMotion)
    visibilitychange: docHidden = document.hidden；恢复且未 paused → schedule()
    reducedMotion: matchMedia("(prefers-reduced-motion: reduce)") 变化 → 下一帧生效
    stats：环形缓冲存最近 120 帧耗时与帧间隔；每秒算 fps；分位排序仅在统计时做

**Step 3｜S5-1a 单测**（src/runtime/visualRuntime.test.ts，jsdom + stub 全局 rAF）
1. "three subscribers share a single requestAnimationFrame"：stub rAF 计数；subscribe x3 → 立即 rAF=1；手动执行回调一次 → rAF=2。
2. "critical runs before normal before idle in one frame"：记录调用顺序 = [critical, normal, idle]。
3. "fpsCap throttles normal bucket"：fake performance.now 每帧 +8ms；normal fpsCap=30 → 1s 内回调 ∈ [28,32]。
4. "hidden document skips callbacks but keeps single pending frame"：mock document.hidden=true；回调 0 次、rAF 不叠加。
5. "reduced motion skips non-allowed subscribers"：matchMedia matches=true；allowReducedMotion=false 回调 0 次，true 仍执行。
6. "pause stops loop, resume restarts without duplicate scheduling"：pause 后 rAF 不被调用；resume 后 rAF=1、回调只执行一次。
7. "stop removes subscriber and last stop cancels the pending frame"：handle.stop() 后不回调；最后一个 stop → cancelAnimationFrame 被调用。
8. "updateGate(false) suppresses callbacks without resubscribe"：visible=false 后 0 次；true 恢复；rAF 每帧仍 1。
9. "callback throw is isolated and subscriber is stopped"：一个抛错 → 其它仍执行；抛错者 active=false。
10. "stats track p50/p95/dropped with synthetic durations"：注入耗时 1..100 → 分位与手算一致；帧间隔 3 倍目标 → dropped 正确。
11. "dispose cancels frame and clears subscribers"（测试专用）。

**Step 4｜S5-1b measure hooks**（src/runtime/measure.ts）
- 仅 dev：installMeasureHooks(runtime) 在 NODE_ENV !== "production" 时把 window.__visualRuntime = { getStats, reset, subscribeCount } 挂上（生产 no-op）。
- 协议与 measure.py 对齐：window.__viz.ready、window.__viz.perf.reset()、window.__viz.perf.getStats() 返回 medianDraw/p95Draw/maxDraw/droppedFrames/frameSamples、window.__viz.meta、window.__viz.fps、window.__viz.errors（measure.py:281,294-309 已定义）。适配函数放 harness 路由（S5-2b），runtime 只提供原始 stats。

**Step 5｜S5-1b dev harness 骨架**
- 新 src/app/dev/viz-harness/page.tsx："use client"；if (process.env.NODE_ENV === "production") notFound()（next/navigation）；dev 下渲染 VisualizationView 并把 useUIStore 切到 visualization。
- 不允许被 page.tsx/PanelOrchestrator 引用；PR 描述写 "dev-only，生产 404"。

**Step 6｜S5-1b measure.py 参数化**
- scratch/perf/measure.py:52：ROUTE 改为 args.route；新增 --route（默认值保留旧路径但文档要求显式传 /dev/viz-harness）、--effects（逗号分隔，默认 14 个全量；逐效果测量输出每效果一行）。
- 验收：python scratch/perf/measure.py --base-url http://localhost:3025 --route /dev/viz-harness --label s5-before --out perf/s5-before.json exit 0 且 JSON 含 14 个 case。

**Step 7｜验收**
- npx vitest run src/runtime/visualRuntime.test.ts 全 passed（≥11 用例）。
- harness 下注入 3 个 dummy subscriber：getStats().subscribers 正确；DevTools Performance 确认单 rAF。
- E5-2 达成：可视化+3D架+浮动层同时激活时只 1 个循环（为 S5-3 验收提供基础设施）。

**回滚**：runtime 纯新增，不接线零影响；S5-2 后关闭 NEXT_PUBLIC_VISUAL_RUNTIME 即回旧路径；runtime 文件的 revert 需同时 revert 消费方（按 PR 顺序）。
**风险**：jsdom 下 rAF stub 与 React 19 调度混用导致断言抖动 → 不用 fake timers，直接 stub 全局 rAF 手动调用；performance.now 用 vi.spyOn 控制。

---

### S5-2 VisualizationView 调度迁入 runtime（3 个 PR，核心视图，D7 白名单）

**目标**：只替换"谁在请求帧/何时停帧"，绘制代码（draw 函数体、效果 switch、交叉淡化、DPR 计算、resize、粒子初始化）**一行不改**；迁移前后 draw p95 劣化 ≤10%、dropped=0。
**前置**：S5-1a；D7 授权；S4-4c（封面替换）已合入，避免同文件两 PR。
**写作用域**：2a/2c = src/components/visualization/VisualizationView.tsx、VisualizationView.test.tsx；2b = src/app/dev/viz-harness/page.tsx、scratch/perf/measure.py、perf/README.md（S5-1b 只建空壳，2b 填充场景）。

**已核实现状（迁移边界）**
- 保留不动：:267-292 resize 结构、:294-306 initParticles、:317-437 draw 主体（analyser 取样、hue 平滑、EffectContext 构造——S5-5 再优化）、:439-520 效果分发/交叉淡化、:557-577 cleanup 大部分。
- 替换：:522-527 的 visible 才继续调度、:529-552 的 visibilitychange、:554-555 启动、cleanup 里的 cancelAnimationFrame。
- 订阅方式（2a）：

    const drawRef = useRef(draw); drawRef.current = draw;
    useEffect(() => {
      if (!featureFlags.visualRuntime) return;              // flag off → 旧路径（2c 前保留）
      const handle = visualRuntime.subscribeFrame("viz-canvas", (t, dt) => drawRef.current(t, dt), {
        priority: "critical",
        gate: { visible: currentViewRef.current === "visualization", foreground: true },
      });
      return () => handle.stop();
    }, []);
    useEffect(() => { gateHandleRef.current?.updateGate({ visible: currentView === "visualization" }); }, [currentView]);

- runtime 提供 dt（毫秒）；2a 只把 draw 签名改为 (timestamp, dt) 并把 dt 透传，**不改**现有基于 timestamp 的 fade/hue 计算。
- 隐藏时零绘制由 runtime gate 保证；组件不再自己 addEventListener("visibilitychange")。

**Step 1｜S5-2a 迁移 + 双跑**
- 按上面边界改文件；NEXT_PUBLIC_VISUAL_RUNTIME=off 时必须走原代码（flag 分支保留到 2c）。
- 单测（扩展 VisualizationView.test.tsx）：
  - "subscribes to visualRuntime once when view is visualization"
  - "updates gate instead of resubscribing on view change"（subscribeFrame 调用 1 次、updateGate 被调用）
  - "unsubscribes on unmount"
  - "legacy rAF path is used when flag off"（vi.stubEnv + resetModules）
- 手工：进入/退出可视化、切 Home/Player、后台 30s 再回来、14 效果逐个切换，无黑屏/无残留帧。

**Step 2｜S5-2b harness + 前后测量（关键证据）**
- harness 填充：window.__viz = { ready, meta: {effect,dpr,size}, fps, errors, setEffect, perf: { reset, getStats } }；perf.getStats() 由 visualRuntime.getStats() 映射为 measure.py 字段。
- **before 采集（同一 harness、旧路径）**：

    npm run build; npm start
    python scratch/perf/measure.py --base-url http://localhost:3025 --route /dev/viz-harness --label s5-before --out perf/s5-before.json

- **after 采集**：S5-2a 合入后同参数 → perf/s5-after-s52.json；逐效果比较：
  - 通过判据：drawP95After <= drawP95Before * 1.10、droppedAfter === 0、fps 中位 ≥90（1920×1080 dpr2，channel=chrome，关后台节流参数见 measure.py:74-80）。
  - PR 贴表：effect / before p95 / after p95 / delta% / dropped / fps / 样本帧数。
- 截图：14 效果各 1 张（同时间点/同歌词/同音源；用 scratch/perf/_lead_determinism.py 的确定性参数），人工对照。
- 隐藏视图零绘制：切到 Home 后 5s，window.__visualRuntime.getStats().frameCount 不增长，截图。
- E5-9 宿主拆包：同 PR 内把 canvas 宿主与控制层拆为两个 memo 子树（VisualCanvasHost / VisualControls），React Profiler 证明 currentTime 4Hz 更新时 canvas 宿主 commit=0；否则拆为 2b-2 独立 PR（≤120 行）。

**Step 3｜S5-2c 删除旧路径（晚一个版本）**
- 删除 flag false 的旧 rAF 分支与 visibilitychange 代码；visualRuntime 字段保留由 S8 决定是否移除；PR 附"双跑一版"的 release tag 与线上无回归证据。
- 验收：VisualizationView 内 rg requestAnimationFrame = 0；E5-4 仍绿。

**回滚**：S5-2a 用 flag 一键回旧路径；2b 是工具/证据 PR；2c 删除后可 revert。
**风险**：dt/门控语义与旧实现不一致导致淡化时长变化 → before/after 截图 + 450ms 淡出断言；后台恢复首帧 dt 过大 → runtime clamp 50ms，draw 内 timestamp 基准不受影响。

---

### S5-3 Shelf3D + 浮动层 + 其余面板 rAF 迁入 runtime（3 个 PR）

**目标**：常驻/面板渲染循环统一交给 runtime；关闭面板或不可见时 0 帧；3D 架与可视化同时开启 FPS ≥50。
**前置**：S5-1a、S3-4、S3-5、S3-6。
**写作用域**：3a = src/components/library/Shelf3DView.tsx；3b = src/components/player/floating/{FloatingSpectrumGlow.tsx,FloatingWaveformGlow.tsx,FloatingDebugHUD.tsx,useFloatingDragPhysics.ts}；3c = src/components/audio/{SpectrumAnalyzer.tsx,WaveformVisualization.tsx}、src/components/visualization/AppleMusicVisualizer.tsx、src/components/emotion/EmotionVisualizer.tsx、src/components/library/hub/LiquidStorageGauge.tsx、src/components/player/AudioSourceManagerModal.tsx、perf/rAF-whitelist.json(新)。

**已核实现状**
- Shelf3DView：onAnimationFrame（:1185）自建 rAF（:1452）；startAnimation（:1456-1468）已有 effectActive/animationRunning/contextLost/document.hidden 判断；stopAnimation（:933-941）；自适应画质（:1204-1235）在 S5-6 收敛为 qualityTier 的消费者（本任务不删，只迁调度）。
- FloatingSpectrumGlow：已用 IntersectionObserver（:273-281）+ isVisibleRef（:35）+ 播放态（:104-113）门控，是迁移样板；迁移后删自建 rAF（:229/:239）与 visibility 逻辑，改 runtime.gate。
- FloatingWaveformGlow 302/320；FloatingDebugHUD 77/81（FPS HUD，迁移时改用 runtime.getStats().fps，不必自己数帧）；useFloatingDragPhysics 407/410（**拖拽惯性，按总计划白名单保留**，只登记 whitelist）。
- 面板循环：SpectrumAnalyzer :57/:79/:119/:122、WaveformVisualization :56/:78/:125/:132、AppleMusicVisualizer :152、EmotionVisualizer :368/:371、LiquidStorageGauge :37/:139、AudioSourceManagerModal :202（打开才应跑）。
- 非循环/事件型 rAF（登记白名单，不迁移）：AIAgentPanel:78、PlaylistDetailDrawer:82、useGestureSession:439、useAIAgentStore:459、useFloatingDragPhysics:407/410。

**Step 1｜S5-3a Shelf3DView**
- 在 useEffect([isOpen, rendererGeneration])（:1571）内，把 startAnimation/stopAnimation 的 rAF 换为 visualRuntime.subscribeFrame("shelf3d", (t,dt)=>onAnimationFrame(t), { priority:"critical", gate:{ visible:isOpen, foreground:true } })；保留 contextLost 处理（:1484-1492）与 three.js 生命周期（:1510-1557）**不变**。
- onAnimationFrame 内删除自带 requestAnimationFrame（:1452）；stopAnimation（:933-941）保留函数但改为 handle.stop()；保留自适应画质逻辑。
- 测试：无既有测试则新增轻量测试（mock runtime + three 加载失败路径，断言 subscribe/stop 调用、面板关闭后 stop 1 次）；有则补 "unsubscribes when panel closes"。
- 测量：同时开 3D 架 + 可视化，FPS ≥50、dropped=0；关闭 3D 架后 5s 内 shelf3d 回调=0。

**Step 2｜S5-3b 浮动层组**
- FloatingSpectrumGlow / FloatingWaveformGlow：subscribeFrame(id, renderFrame, { priority:"normal", gate:{ visible:isVisibleRef.current && (isPlaying || hasSignal), foreground:true } })；IntersectionObserver 保留但只负责 updateGate({visible})；删除自建 rAF/cancel。
- FloatingDebugHUD：不再自己数帧，改为 idle 桶 1fps 读 visualRuntime.getStats().fps（或 500ms setInterval，PR 写明二选一，推荐 idle 桶）。
- useFloatingDragPhysics：**不动**（白名单），写入 perf/rAF-whitelist.json。
- 测试：mock runtime，断言每组件 subscribe 1 次、unmount stop 1 次、gate 更新路径。
- 验收：首页 idle（未播放）时 normal 订阅只含装饰层；rAF 循环总数 1。

**Step 3｜S5-3c 面板循环 + 白名单**
- 逐个组件迁移（每文件 ≤60 行 diff）：自建循环换 subscribeFrame，gate.visible 绑 isOpen/面板挂载状态（LazyPanel deactivate 后组件卸载 → cleanup stop）。
- 新建 perf/rAF-whitelist.json：允许仍直接 rAF 的文件 + 原因（PlaybackClock 时钟、useFloatingDragPhysics 拖拽、AIAgentPanel/PlaylistDetailDrawer 事件节流、useGestureSession 检测帧、useAIAgentStore 合并 setState、runtime 自身）。S8-1 的 lint 规则消费该文件。
- 验收：改动的 6 个组件至少有"订阅/清理"两条单测（无既有测试则补）；rg 统计全仓 rAF ≤12（含白名单），runtime 管理下实际循环 ≤1。

**回滚**：每文件独立 revert；NEXT_PUBLIC_VISUAL_RUNTIME=off 时组件走旧路径（3a/3b 保留 flag 分支一版，3c 直接 revert）。
**风险**：Shelf3DView 的 effectActive 与 runtime gate 重复 → 迁移后 effectActive 简化为 gate，但不改 three.js 渲染代码；浮动层 IntersectionObserver 回调频繁 → updateGate 加 100ms 去抖（PR 写明）。

---

### S5-4 EffectPlugin + registry；试点 spatialMesh + nebulaField（3 个 PR）

**目标**：把 V8 证明过的效果生命周期契约移植到 V7；中心 switch 只负责"取插件并调用"，每个效果自带资源池/预算；先迁移 2 个效果作为模板。
**前置**：S5-2a；D1=C 的契约（S4-7a 已合入则复用 src/runtime/effectPlugin.ts，否则本任务 4a 先建）。
**写作用域**：4a = src/runtime/effectPlugin.ts(新)+test、src/runtime/effectRegistry.ts(新)+test；4b = src/components/visualization/effects/spatialMesh.ts、effects/spatialMeshPlugin.ts(新)+test；4c = effects/nebulaField.ts、effects/nebulaFieldPlugin.ts(新)、VisualizationView.tsx:456-502（switch）、test。

**已核实现状（V8 参考实现，直接可移植）**

| 能力 | V8 位置（RenderEngineManager.tsx） | 移植到 V7 的落点 |
|---|---|---|
| DPR 按质量档钳制 | getQualityDpr :89-99（low=1/medium=1.5/high=1.75/ultra=2） | runtime.setDprCap + S5-6 qualityTier |
| canvas 后备尺寸与 transform | setupCanvas :116-136 | runtime 统一 resize 入口（S5-3 起逐步收敛） |
| resize 双监听 | :291-309（window.resize + ResizeObserver） | runtime 内部实现一次，插件只收 resize(w,h,dpr) |
| 效果切换 destroy→init | :311-348 | registry.activate/deactivate |
| hidden 时跳过绘制 | :365-368 | runtime gate（已实现） |
| 帧率上限 | :380-386（config.targetFPS） | runtime fpsCap（critical=60） |
| FPS 统计与降档 | :393-452（<35fps 连续 3s → DPR=1） | qualityTier 长任务/FPS 反馈（S5-6） |
| visibilitychange 恢复 | :478-492 | runtime 内部 |
| 卸载清理 | :494-514、:516-541 | registry.dispose + 插件 destroy |

**Step 1｜S5-4a 契约与注册表**

    export interface EffectInitContext { width: number; height: number; dpr: number; }

    export interface EffectPluginV7 {
      readonly id: VisualizationEffect;
      init(ctx: EffectInitContext): void;
      resize(width: number, height: number, dpr: number): void;
      draw(ctx: EffectContext, dt: number): void;   // dt 由 runtime 提供（毫秒）
      destroy(): void;                              // 必须释放离屏 canvas/纹理/大数组
      budget: { maxParticles?: number; maxTextLayers?: number };
    }

    // effectRegistry.ts
    export function registerEffect(id, loader: () => Promise<EffectPluginV7>): void;
    export async function getEffect(id: VisualizationEffect): Promise<EffectPluginV7>; // LRU=2，淘汰时 destroy
    export function getLoadedEffects(): VisualizationEffect[];

- 类型来源：S4-7a 的 runtime/effectPlugin.ts（未合入则 4a 先建，标注"与 S4-7a 同源，合入后删重复"）。
- 契约测试 effectRegistry.test.ts：
  - "registry caches plugin instances by id"
  - "LRU evicts least recently used and calls destroy"
  - "concurrent getEffect calls share one loader promise"
  - "plugin destroy releases owned resources"（fake plugin 计数）
  - "unknown effect id falls back to spatialMesh"（与现有 default 分支一致）

**Step 2｜S5-4b spatialMesh 插件化（试点 1，195 行）**
- 现状：export const drawSpatialMesh = ({...}: EffectContext) => {...}（:3-12 解构，:21-24 用 refs.smoothBass/smoothTreble），无自有大资源。
- 新 spatialMeshPlugin.ts：

    class SpatialMeshPlugin implements EffectPluginV7 {
      id = "spatialMesh";
      budget = { maxParticles: 0 };
      private bass = 0; private treble = 0;    // 替代共享 refs，效果自持
      init() {} resize() {} destroy() { this.bass = 0; this.treble = 0; }
      draw(ctx, dt) { /* 复用 drawSpatialMesh 主体，读取本插件私有 bass/treble，平滑系数不变 */ }
    }

- 保留旧导出 drawSpatialMesh 原实现不动（供 flag off / 未迁移路径），插件是新增文件：双跑期两个实现同源、只差状态归属，避免视觉回归。
- 测试 spatialMeshPlugin.test.ts：init→draw→destroy 生命周期；draw 后私有状态被平滑更新；destroy 后清零；**对相同输入序列的 Canvas2D 调用序列与旧函数逐条一致**（mock CanvasRenderingContext2D 记录调用）——这是把"绘制代码不动"变成可断言的关键测试。

**Step 3｜S5-4c nebulaField 插件化 + switch 收敛（试点 2，344 行）**
- 现状：:7-16 解构；:35-41 用 smoothBass/Mid/Treble；:319 用 refs.nebulaStars（持久星场）。插件自持 stars 数组与 3 个平滑值。
- 插件重点：Array.from(data).reduce(...)（:42）改为预分配求和循环（与 S5-7 的 E5-8 同一处，本 PR 先修这个已核实热分配）。
- VisualizationView.tsx:456-502 switch 收敛：

    const plugin = useRef<EffectPluginV7 | null>(null);
    // effect 变化时（非每帧）：void registry.getEffect(currentEff).then(p => { plugin.current?.destroy(); plugin.current = p; p.init(...); });
    // draw 内：if (plugin.current?.id === currentEff) plugin.current.draw(effectCtx, dt); else legacySwitch(currentEff, effectCtx);
    // 未迁移的效果继续走 legacy switch（14 → 12 → …），迁移一个减少一个 case。

- 测试：nebulaFieldPlugin.test.ts 同 4b 的调用序列一致断言；VisualizationView.test.tsx 断言"已迁移走插件、未迁移走 switch"。
- 灰度：NEXT_PUBLIC_EFFECT_PLUGINS=off 时全部 legacy；逐个迁完后默认 on（S5-7 完成后）。

**Step 4｜测量/验收**
- 帧时间：measure.py 对比 legacy vs plugin（同 harness、同效果、60s）：draw p95 差 ≤10%、dropped=0。
- 视觉：截图 + 确定性对比（scratch/perf/_lead_determinism.py 已存在）；PR 附 contact sheet。
- 资源：切换效果 20 轮后 getLoadedEffects().length ≤2（LRU），旧插件 destroy 被调用（mock 计数或 dev 日志）。
- 硬验收：E5-6。

**回滚**：flag off 回 legacy；4b/4c 各自独立 revert；registry 纯新增。
**风险**：共享 refs 与插件私有状态双跑期并存 → 切换时 lastEffectRef 清理（:331-361）仍会清共享 refs，插件 init() 必须重置状态（契约测试覆盖）；插件动态 import 增加首次切换延迟 → 效果按钮 hover/focus 时 preloadEffect(id)（≤20 行，PR 注明）。

---

### S5-5 initParticles 对象复用 + EffectContext 稳定引用（1 个 PR）

**目标**：resize 不再重建 1000 个粒子对象；draw 每帧不再 new EffectContext/refs/闭包。
**前置**：S5-4a（插件契约；本任务先在 VisualizationView 旧路径做，再随插件迁移）。
**写作用域**：src/components/visualization/VisualizationView.tsx（:113-118 refs 声明、:294-306、:408-437）、VisualizationView.test.tsx。

**已核实现状**
- :294-306：initParticles 每次调用 particlesRef.current = [] 后 push 1000 个新对象；resize（:274-292）在尺寸变化时调用它。
- :408-437：每帧构造 EffectContext（新对象 + refs 新对象 + theme 新对象 + utils 新闭包）。
- :113-118：smoothData/smoothBass/Mid/Treble 已是 ref。

**Step 1｜粒子池**

    const particlePoolRef = useRef<Particle[]>([]);
    const initParticles = (w: number, h: number) => {
      const count = 1000;                       // 本 PR 不改数量，只复用对象（数量限额留给 S5-6/D5）
      const pool = particlePoolRef.current;
      if (pool.length < count) for (let i = pool.length; i < count; i++) pool.push({ x:0,y:0,z:0,ox:0,oy:0 });
      pool.length = count;
      for (const p of pool) { p.x = (Math.random()-0.5)*2000; p.y = ...; p.z = ...; p.ox = 0; p.oy = 0; }
      particlesRef.current = pool;              // 既有 effects/*.ts 读 refs.particles.current，契约不变
    };

**Step 2｜稳定 EffectContext**
- refs 对象、theme 对象、utils.getThemeBaseHue 闭包在挂载时创建一次（useRef 初始值），此后只改字段：
  c.ctx/c.width/c.height/c.data/c.time/c.musicTime/c.params 每帧赋值；c.refs = refsRef.current；c.theme.primary = active.primary（同一对象，不换引用）。
- 约束写入契约注释：效果实现不得缓存 effectCtx 引用做跨帧比较（已抽查 spatialMesh/nebulaField/orientalLandscape，均为解构后即时使用）。

**Step 3｜测试与测量**
- 单测："resize reuses particle objects"（两次 resize 后 pool 内对象引用是同一批、count 不变）；"effect context object identity is stable across frames"（spy 替换 Effects.drawSpatialMesh 捕获 ctx，比较两次调用 ctx 引用相同——不新增测试 API）。
- 测量：连续 resize 100 次（window.dispatchEvent(new Event("resize")) + clientWidth mock 变化）→ Chrome Allocation Instrumentation 10s 内 Particle 分配数与 resize 次数不线性相关；frame p95 劣化 ≤10%。
- 硬验收：E5-7。

**回滚**：单 PR revert（无外部接口变化）；若粒子数量限额引起观感差异，只回退数量策略、保留对象复用（本 PR 不引入数量限额，风险低）。
**风险**：效果实现持有 ctx 引用跨帧（抽查 3 个常用效果无此模式；其余 11 个在迁移时逐个确认，发现则改契约注释 + 测试）。

---

### S5-6 qualityTier + longtask 自降档（2 个 PR）

**目标**：按 D5 定义 low/medium/high 档位；运行时根据设备能力与长任务/FPS 反馈自动降档；不新增持久化 key。
**前置**：S5-1a；D5 拍板。
**写作用域**：6a = src/runtime/qualityTier.ts(新)+test；6b = src/runtime/visualRuntime.ts（DPR/帧率上限接线）、src/components/visualization/VisualizationView.tsx（DPR cap 读取，替换 :60 固定 2，仅 flag on 时）。

**D5 档位（00-decisions.md D5）**

| 档 | 判定（deviceMemory 缺失用 hardwareConcurrency） | maxDpr | 粒子预算 | canvas CSS filter | 目标 fps |
|---|---|---|---|---|---|
| low | 核数 ≤4 或 deviceMemory ≤4 | 1 | 减半（≤500） | 关闭 | 30 |
| medium | ≤8 核或 ≤8GB | 1.5 | ≤1000 | 保留但降 blur | 45 |
| high | 其它（独显/16GB+） | 2 | 现状 | 保留 | 60 |

**Step 1｜6a 判定与控制器**

    export type QualityTier = "low" | "medium" | "high";
    export interface TierConfig { tier: QualityTier; maxDpr: number; particleScale: number; allowCanvasFilter: boolean; targetFps: number; }
    export function detectTier(input?: { hardwareConcurrency?: number; deviceMemory?: number; urlOverride?: string | null; reducedMotion?: boolean }): QualityTier;
    export class QualityTierController {
      get(): TierConfig;
      setOverride(tier: QualityTier | null): void;              // ?tier= 与 dev 面板
      reportFrame(fps: number, p95Ms: number): void;            // runtime 每秒调用
      reportLongTask(durationMs: number): void;                 // PerformanceObserver("longtask")
      onChange(cb: (t: TierConfig) => void): () => void;
      reset(): void;
    }
    export const qualityTier = new QualityTierController();

- 降档规则：连续 3s fps 低于阈值（high<45、medium<30）→ 降一档；稳定 10s 可回升，但最多 1 次/分钟（防抖）；60s 内 ≥3 次 >200ms longtask → 降一档。写进 module 注释与单测。
- 不新增 localStorage key；?tier= 仅 dev 生效（NODE_ENV !== "production"）；生产初始 override 读 performanceV8Store.config.level（**只读不写**，S6-8 再合并两套性能档）。
- 单测："detects low tier for 4-core 8GB"、"medium for 8-core 16GB"、"high by default"、"url override wins only in development"、"degrades after 3 consecutive low-fps seconds"、"recovers at most once per minute"、"3 long tasks in 60s trigger degradation"、"change listeners fire once per tier change"。

**Step 2｜6b 接线 runtime**
- visualRuntime.setDprCap(qualityTier.get().maxDpr)；tier 变化 → 更新并触发订阅者 resize（runtime 内部 onTierChange 钩子）。
- longtask：runtime 内部 PerformanceObserver({entryTypes:["longtask"]})（不支持则跳过，必须先判 typeof PerformanceObserver !== "undefined"），duration 交给 qualityTier.reportLongTask。
- VisualizationView：DPR = Math.min(window.devicePixelRatio || 1, qualityTier.get().maxDpr)（替换 :60 常量；flag off 保持 2）。
- 测试：runtime 补 "dpr cap is applied to subscribers"；qualityTier 单测如上。

**Step 3｜测量/验收（E5-5）**
- Chrome DevTools Performance → CPU 4x throttle + 打开可视化 60s：10s 内 tier high→medium/low，getStats().tier 与日志一致；无 >200ms longtask。
- low 档 1920×1080：粒子减半、DPR=1、canvas filter 关闭（检查 canvas.style.filter 为空）——截图 + getStats()。
- 不退化：high 档 165Hz 屏 FPS 与 S5-2b 基线一致（±10%）。
- 回滚：NEXT_PUBLIC_QUALITY_TIER=off → 固定 high；qualityTier.ts 纯新增。

---

### S5-7 3 个重效果每帧分配审计与修复（3 个 PR）

**目标**：用 CDP Allocation Instrumentation 找出 3 个重效果在稳态绘制中的"每帧新增且不释放"对象；只修确认为每帧路径的分配，不做猜测性重构。
**前置**：S5-4a、S5-5。
**写作用域**：7a = scripts/perf/allocation-probe.mjs(新)+README、perf/allocation/README.md(新)；7b = effects/{cinematicLyricDrift.ts,handwrittenInk.ts,handwrittenPaper.ts,handwrittenDoodles.ts,handwrittenScene.ts,handwrittenLayout.ts,handwrittenMotion.ts,handwrittenPalette.ts} 中已确认热点 + test；7c = orientalLandscape.ts + 剩余热点 + test。

**已核实现状（先分清"缓存内一次性分配"与"每帧分配"）**
- cinematicLyricDrift.ts（2653 行）：已有 layoutCache/sceneCache/measureCache（:312-314）；大量 .map（:460、:540、:674、:750、:785、:825）位于布局/短语缓存构建路径（:535-548 是 wrapHandwrittenPhrase→缓存），**未必每帧**——需 probe 确认。
- handwrittenDoodles.ts（1490 行）：circlePoints(...).map(...)（:219、:428、:513、:615、:823-824、:890-891、:863）位于 dummy/spec 构建路径（有 set = new Map() 缓存 :208）；Array.from({length:5})（:827）疑似模块级/缓存，需确认。
- handwrittenPaper.ts（1039 行）：grainPatterns 有缓存（:958-969，命中后复用）；:965 是 cache miss 路径，**不是每帧**。
- orientalLandscape.ts（1550 行）：仅 2 处 new Float32Array（:87-88，模块级预分配）与 9 处 createLinearGradient（Canvas API 每次 create 不可避免，但可减少数量/缓存色标）——需 probe 判定。
- 已确认每帧分配（本阶段一并修）：nebulaField.ts:42 Array.from(data).reduce(...)（S5-4c 已列）。
**判定规则**：60s 稳态下，若某构造函数（Object/Array/Map/CanvasGradient）分配量 ≈ 帧数 × 常量（>1KB/帧）且 GC 后反复出现 → 判定为每帧分配并修复；否则在 PR 记录"缓存一次性分配，不修"。

**Step 1｜S5-7a 分配探针**
- scripts/perf/allocation-probe.mjs：Playwright + CDP HeapProfiler.startSampling/stopSampling；流程：启动 harness → 选效果 → warmup 5s → 采样 10s → 输出 { effect, allocKBPerSec, topFrames:[{fn,url,line,allocBytes}] } 到 perf/allocation/<effect>.json。
- CLI：node scripts/perf/allocation-probe.mjs --route /dev/viz-harness --effects cinematicLyricDrift,orientalLandscape,handwrittenPaper --out perf/allocation/s5-before。
- 验收：3 份 JSON + allocKBPerSec 排序的 Top 帧表；"每帧/缓存一次性"的结论写进 PR。

**Step 2｜S5-7b cinematicLyricDrift + handwritten 集群修复**
- 只修 probe 确认的每帧分配：候选模式——每帧 Array.from(data).reduce、每帧 lines.map/groups.map 重建（可移到 layout 缓存命中路径）、每帧 new Set/展开运算符。
- 每处修复必须：修改前后 allocKBPerSec 对比（同命令）+ 单测（mock ctx 记录调用序列，保证绘制输出不变）。
- 测试文件：cinematicLyricDrift.alloc.test.ts（已有测试则扩展）；断言示例："layout work is not repeated for identical inputs"（连续两帧同 layoutKey → 内部 layoutCache.size 不变、构建函数 mock 调用 1 次）。

**Step 3｜S5-7c orientalLandscape + 余量**
- createLinearGradient：若 probe 确认它是主要分配源，减少每帧渐变数量/缓存色标字符串；若判定可接受，记录"保留"及理由。
- 验收：3 个效果稳态 allocKBPerSec 比 before 下降 ≥50%，或剩余分配全部有书面理由；无视觉回归（截图 + 调用序列一致测试）。

**回滚**：每效果独立 PR/revert；修复必须不改变绘制输出（调用序列测试为硬门禁）。
**风险**：缓存内分配被误判为每帧（probe 受 JIT 影响）→ 每项修复前 3 次 probe 取中位数；修复后 p95 draw 劣化 >10% → 回退该项。

---

## 5. 阶段级验证命令与证据清单

### 5.1 顺序（I7）

    npx eslint src --max-warnings=0
    npx vitest run
    npx tsc --noEmit --incremental false --pretty false
    npm run build
    npm run clean:port; npm run dev       # smoke：Home→Player→Visualization→开 3D 架→开 EQ→切 14 效果→后台 30s 返回
    npm start                             # 生产模式 perf 测量（3025）
    python scratch/perf/measure.py --base-url http://localhost:3025 --route /dev/viz-harness --label s5-final --out perf/s5-final.json
    node scripts/perf/allocation-probe.mjs --route /dev/viz-harness --effects cinematicLyricDrift,orientalLandscape,handwrittenPaper --out perf/allocation/s5-final
    rg -n "requestAnimationFrame" src --glob '!*.test.*' | wc -l    # ≤12（含白名单）
    node -e "JSON.parse(require('fs').readFileSync('perf/rAF-whitelist.json'))"

### 5.2 证据文件 evidence/S5-evidence.md 必含
- S5-1：11 条 runtime 单测结果 + DevTools 单 rAF 截图 + getStats() 输出；
- S5-2：14 效果 before/after 表（draw p50/p95/max、dropped、fps、样本帧数）、measure.py JSON 路径、14 张截图与接触表、React Profiler 宿主 commit 对比（E5-9）、隐藏视图 5s 绘制计数=0；
- S5-3：3D+可视化同开 FPS 曲线/截图；关闭面板后各订阅者回调=0；rAF 白名单 JSON；
- S5-4：2 个插件契约测试、切换 20 轮后 LRU=2、legacy vs plugin 帧时间与截图 diff；
- S5-5：resize 100 次对象复用证据（Allocation 截图）、p95 对比；
- S5-6：4x throttle 降档日志 + tier 变化截图、low 档粒子/DPR/filter 证据；
- S5-7：3 份 allocation JSON（before/after）+ 每项"修/不修"结论；
- 未执行项：4K、真机低端机、Electron 生产 perf、长时 soak（归 S7/S8）明确标注。

### 5.3 回归判定
- 硬：measure.py 任效果 draw p95 劣化 >15% 或 dropped >0 → 阻塞合入/回退对应 PR。
- 软：FPS 中位降 >10%、LCP +30% → 建 issue，不阻塞但阶段证据记录。
- 视觉：14 效果截图人工对照；任何"观感差异"必须由 Lead + 用户确认后才可接受（R8）。

---

## 6. 与相邻阶段的接口/交接物

| 方向 | 交接物 | 消费方 |
|---|---|---|
| S3 → S5 | S3-4 Player3D gate、S3-5 浮动层 gating、S3-6 LazyPanel deactivate、S3-3 VisualizationView selector 化 | S5-2/S5-3 |
| S4 → S5 | featureFlags.visualRuntime/effectPlugins、check-initial-chunks（runtime 不得引入初始 vendor） | S5-1 |
| S5 → S4 | S5-4 契约（D1=C 时 S4-7a 输入）、S5-2 harness | S4-7 |
| S5 → S6 | runtime.getStats()/qualityTier 作为 S6-8 性能档合并输入；插件接口作为 S6-9 用例层边界 | S6-8/S6-9 |
| S5 → S7/S8 | measure.py --route、allocation-probe、rAF-whitelist.json、perf JSON schema | S8-3、S7 桌面 perf |
| 交接物清单 | src/runtime/{visualRuntime,effectPlugin,effectRegistry,qualityTier,measure}.ts、perf/rAF-whitelist.json、perf/README.md、perf/allocation/* | 后续阶段 |

---

## 7. 未决问题 / 需用户决策

| # | 问题 | 影响 | 建议 |
|---|---|---|---|
| Q5-1 | D7：VisualizationView 的"调度/门控等价改写"是否获授权（不改绘制/样式） | S5-2 全部 PR | 授权；diff 白名单 = 仅 rAF/visibility/gate 行 + Profiler 证据 |
| Q5-2 | D5 档位阈值与 deviceMemory 缺失时的回退 | S5-6 | 按 00-decisions D5 默认；缺 deviceMemory 用 hardwareConcurrency + 显式 ?tier 测试 |
| Q5-3 | dev harness 路由是否允许入库（Next 会构建但生产 404） | S5-1b/S5-2b 测量 | 允许 dev-only+notFound；若不允许，退化为 Playwright 驱动真实页面（+1-2 天） |
| Q5-4 | measure.py 修改归属（S0-6 固化 vs 本阶段加 --route） | 工具冲突 | 由 S5-1b 独占改 measure.py；S0-6 只入库脚本，不并行改同文件 |
| Q5-5 | V8 RenderEngineManager 的 WebGL/contextlost 是否移植到 V7（V7 纯 Canvas2D；3D 架自管 WebGL） | S5-4 契约范围 | 本轮只移植 DPR/resize/lifecycle/降级；WebGL 插件待确有 WebGL 效果时再扩契约 |
| Q5-6 | S5-7 若 probe 显示"每帧分配可接受"是否仍要求修 | E5-8 判定 | allocKBPerSec 稳定且无 GC 锯齿即判通过，不强制为 0 |
