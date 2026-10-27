# S3 应用外壳与订阅治理 — 实现级执行计划

> **上级计划**：[2026-10-21 架构与性能优化总计划](../2026-10-21-architecture-performance-optimization.md) §5 S3、§4.4、§6.2
> **阶段**：S3（S0→S1→S2→**S3**→S4 关键路径第 4 段）｜**预估**：5–7 人日（12 个 PR：S3-1..S3-10 含 2 个拆分后缀，约 2,000 行 + 测试）｜**状态**：未开始
> **审计依据**：审计 B P0-1/P0-2/P0-4/P0-5/P0-6、P1-1/P1-2/P1-7；审计 A P0-04/P1-01/P1-09、§2.3 Top20；审计 C 音频宿主相关项。全部行号已用 read/grep 核实（2026-10-21 脏树）；未核实项标「待核实」。
> **本阶段只写计划**：不改代码、不跑构建/测试。

---

## 1. 阶段目标与出口条件

**目标**：让 toast/面板/主题等高频 UI 写入不再重渲染整个应用壳与常驻视图；常驻 rAF 按可见性门控；43 个面板可回收、重复宿主去重；清掉 playlistStore/audioStore 的整店订阅扇出；预取改由空闲/意图驱动。

| # | 出口指标 | 现状（基线） | 目标 | 硬阈值（fail） | 测量方式 |
|---|---|---:|---:|---:|---|
| E1 | page.tsx 整店订阅（useXStore() 空参） | 2 | 0 | >0 | node scripts/report-store-stats.mjs（S0-6） |
| E2 | 5 个全局壳文件整店订阅 | 10（HomeView 3 / PlayerView 1 / HeaderToolbar 4 / Apple3DQueueDrawer 1 / useDynamicTheme 1） | 0 | >0 | 同上 + grep |
| E3 | 单个 toast 触发的 <Home> 子树 commit 组件数 | 全部常驻树（≥100 组件） | 下降 ≥80% | 下降 <50% | React Profiler（dev，record 3s / 5 次 toast） |
| E4 | 播放中 VisualizationView 顶层 commit（10s） | ≈40（currentTime 4Hz） | ≤1 | >3 | Profiler commit count |
| E5 | idle（Home 未播放）rAF 循环数 | ≥3 [审计推断] | ≤1 | >1 | CDP 注入 rAF 计数 + 60s 采样 |
| E6 | Home 页播放中 Player3D rAF 回调（60s） | ≈3,600 | 0 | >60 | dev probe __perf.player3dFrames |
| E7 | 打开 20 个面板再关 18 个后的 DOM 回收率 | 0%（粘性挂载） | ≥80% | <50% | CDP DOM.getDocument 节点计数 |
| E8 | 关闭面板 5min 内 setInterval 活跃数 | ≥3 个面板（accountCenter×2 / audioSourceManager / aiSettings） | 0 | >0 | probe 注册表 + CDP Runtime.evaluate |
| E9 | 重复全局宿主实例数（toast / SourceManagementModal） | 2 / 2 | 1 / 1 | ≠1 | 组合挂载测试 + DOM 计数 |
| E10 | playlistStore 整店订阅文件数 | 29 | 0 | >0 | grep usePlaylistStore() |
| E11 | audioStore 整店订阅文件数 | 7 | 0 | >0 | grep useAudioStore() |
| E12 | 首屏后 5s 动态 import 数 | 12（预取 9 + page 3） | ≤3 | >6 | PerformanceObserver(resource) |
| E13 | 组件层整店订阅总数 | 160 | ≤10（白名单=V8 死代码 + S6 待删） | >20 | report-store-stats.mjs |

**出口条件**：E1–E13 达标；受保护视图（Home/Player/全屏歌词）截图对比通过（D7 授权下只允许订阅等价改写）；面板重开 queue ≤300ms；无新增 console error/exception。

---

## 2. 前置条件、依赖与不变量

| 类型 | 内容 |
|---|---|
| 必须已合入 | S0-1（干净树）、S0-2（CI 复活）、S0-6（report-store-stats/measure 基座）、S1-5/S1-6（队列与媒体桥）、S2-3（VisualizationView 的 analyser 段已改） |
| 受保护视图（I5/D7） | Home View / Player View / 全屏歌词只允许订阅方式等价改写（同字段、同渲染输出、同动画参数）；改前/改后 3 视口截图 diff ≤0.1% 像素；需 Lead 复核。禁止改 JSX 结构、className、framer-motion 参数、z-index、时序 |
| 数据兼容（I1） | 本阶段不新增/不改 localStorage key；面板开合仍由 uiStore.panels 驱动（S6-6 才拆 panelStore），不得改变持久化语义 |
| 播放连续性（I2） | 面板卸载/浮动层停帧不得影响 audio 元素、进度、队列；Player3D 切回时必须重启采样 |
| 单一事实源（I3） | 本阶段只改「怎么订阅」，不改「谁拥有」；新增 selectors 是纯派生，不得引入第二可写状态 |
| 每 PR ≤400 行（I6） | S3-8 拆 2 个 PR；S3-3/S3-5/S3-6 若超行再拆 a/b |
| 验证顺序（I7） | eslint → vitest → tsc → build → dev/smoke |

**文件冲突矩阵**：page.tsx 被 S3-1/S3-7/S3-9 触碰 → 串行（S3-1 先，S3-7/S3-9 后）。PanelOrchestrator.tsx 被 S3-6/S3-7/S3-9 触碰 → S3-6 → S3-7 → S3-9 串行。GlobalClientComponents.tsx 被 S3-5/S3-7 触碰 → S3-5 → S3-7。VisualizationView.tsx 被 S3-3 独占（S2-3 已先合入）。playlistStore 消费文件被 S3-8a/8b 独占。HeaderToolbar/HomeView 被 S3-2 独占后，S3-10 不再碰它们。

---

## 3. 任务总表

| ID | 任务 | 写作用域（精确文件） | PR 数 | 依赖 | 风险 | 验收 |
|---|---|---|---|---:|---|---|
| S3-1 | 页级 selector 化 + VisualTokens（CSS 变量） | src/app/page.tsx、新增 src/components/layout/VisualTokens.tsx、测试 | 1（~150 行） | S0-2 | 低（FOUC） | E1=0；调 blur 不重写 style 表 |
| S3-2 | 全局壳 selector（5 文件） | HomeView.tsx、PlayerView.tsx、HeaderToolbar.tsx、Apple3DQueueDrawer.tsx、useDynamicTheme.ts、测试 | 1（~250 行） | S0-1、D7 授权 | 中（保护视图） | E2=0；E3 达标；截图 diff 通过 |
| S3-3 | VisualizationView selector + 进度下沉 + canvas style memo | src/components/visualization/VisualizationView.tsx、新增 VisualizationProgressContainer.tsx、测试 | 1（~200 行） | S3-1、S2-3 | 中（保护视图） | E4≤1；视觉不变 |
| S3-4 | Player3D currentView 门控 | src/components/player/Player3D.tsx、src/components/player/player3dMotion.ts、测试 | 1（~70 行） | 无 | 低 | E6=0；切回重启 |
| S3-5 | 浮动层 gating | src/components/layout/GlobalClientComponents.tsx、src/components/player/floating/{FloatingSpectrumGlow,FloatingWaveformGlow,FloatingDebugHUD,useFloatingDragPhysics}.ts(x)、新增 src/hooks/useFloatingActive.ts、测试 | 1（~200 行） | S3-4 | 中（观感） | E5≤1；进出可视化无劣化 |
| S3-6 | LazyPanel keepAlive LRU + deactivate | src/components/shared/LazyPanel.tsx、src/components/layout/PanelOrchestrator.tsx、新增 src/components/shared/panelLifecycle.tsx、5 个重面板、测试 | 2（6a 框架/白名单 ~250，6b 5 面板接入 ~150） | S3-1 | 中（重开成本） | E7≥80%、E8=0 |
| S3-7 | 重复宿主清理 | src/components/layout/GlobalClientComponents.tsx、src/components/layout/PanelOrchestrator.tsx、src/app/page.tsx、测试 | 1（~90 行） | S3-1 | 低 | E9=1/1；无重复请求 |
| S3-8 | playlistStore 29 处整店订阅清零 | a：8 文件（全局壳+数据管理 hub）；b：21 文件（库/工具/搜索/hooks）；新增 src/store/selectors/playlistSelectors.ts、测试 | 2（各 ~200 行） | S3-1 | 中 | E10=0；输入 commit 下降 |
| S3-9 | 预取策略（idle/intent） | src/components/layout/PanelOrchestrator.tsx、src/app/page.tsx、测试 | 1（~130 行） | S0-6 | 低 | E12≤3；LCP 不退化 |
| S3-10 | Top20 剩余整店订阅 + audioStore 7 处清零 | 见 §4.10 精确清单（~16 文件） | 1（~260 行） | S3-2、S3-8 | 低中 | E11=0；组件整店 ≤10 |

建议顺序：S3-1 →（S3-2 ∥ S3-4 ∥ S3-8a）→（S3-3 ∥ S3-5 ∥ S3-8b）→ S3-6 → S3-7 → S3-9 → S3-10。

---

## 4. 逐任务执行步骤

### S3-1 页级 selector 化 + VisualTokens

**目标**：page.tsx 空参订阅 2→0；blur/animation 变量不再内插进 styled-jsx（避免每次视觉设置变化重写全局样式表）。

**前置**：S0-2 CI；S0-6 report-store-stats 可统计。**写作域**：src/app/page.tsx、新增 src/components/layout/VisualTokens.tsx、src/components/layout/VisualTokens.test.tsx。

**Step 1**：page.tsx:78 改两个原子 selector：const currentView = useUIStore(s => s.currentView); const isTransitioning = useUIStore(s => s.isTransitioning)。
**Step 2**：删除 :79 的 useVisualSettingsStore() 整店订阅；:112-113 的 --blur-intensity / --animation-speed 两行从 <style jsx global> 移除（其余静态 token 保留，成为无插值常量 → React 不再重建 style 内容）。首屏默认值写入 src/app/globals.css 的 :root（--blur-intensity: 8px; --animation-speed: 1s;），避免 FOUC。
**Step 3**：新增 VisualTokens.tsx（"use client"）：分别订阅 blurIntensity、animationSpeed；useLayoutEffect 中 document.documentElement.style.setProperty("--blur-intensity", blurIntensity + "px") 与 ("--animation-speed", animationSpeed + "s")；组件返回 null；依赖数组只含这两个值。
**Step 4**：page.tsx 的 <main> 内加 <VisualTokens />（放在 <style jsx global> 之后）。

**测试**：VisualTokens.test.tsx：①"渲染为空且写入两个 CSS 变量"；②"值变化只触发一次 setProperty 且不抛错"；③"卸载后不残留副作用"。

**验证命令与预期**

~~~bash
npx vitest run src/components/layout/VisualTokens.test.tsx   # pass
node scripts/report-store-stats.mjs --file src/app/page.tsx  # whole=0（S0-6 脚本支持 --file）
# dev + CDP：MutationObserver 观察 <style> 节点 3s；拖动 blur 滑杆 -> style mutation = 0
~~~

**验收**：E1=0；改 blurIntensity 只触发 VisualTokens 渲染（Profiler 中 <Home> commit=0）；CSS 变量生效（computed style 变化）；首屏无样式闪烁。**回滚**：revert page.tsx + 删 VisualTokens。**风险**：useLayoutEffect 与 SSR → 组件为 client-only（页面本已 "use client"）；变量默认值缺省导致首批帧无 blur → globals.css 兜底。

---

### S3-2 全局壳 selector（D7 保护视图）

**目标**：5 个全局壳文件 10 处整店订阅→0，且渲染输出逐字节等价（除订阅机制）。

**前置**：S0-1；D7-A 授权已拍板（仅订阅等价改写允许）；否则本任务阻塞。**写作域**：HomeView.tsx、PlayerView.tsx、HeaderToolbar.tsx、Apple3DQueueDrawer.tsx、useDynamicTheme.ts、新增 lib 测试。

**逐文件替换清单（字段与行号已核实）**

| 文件 | 行 | 现写法 | 替换为（字段级） | 备注 |
|---|---|---|---|---|
| src/components/layout/HomeView.tsx | :22 | const {currentView, openPanel} = useUIStore() | useUIStore(s=>s.currentView); useUIStore(s=>s.openPanel) | 动作引用稳定 |
| 同上 | :23 | const {groups} = usePlaylistGroupStore() | usePlaylistGroupStore(s=>s.groups) | 数组引用；仅 :26 计数 |
| 同上 | :24 | const {userPlaylists} = useUserAccountStore() | useUserAccountStore(s=>s.userPlaylists) | 仅 :26 计数 |
| src/components/layout/PlayerView.tsx | :22 | const {currentView} = useUIStore() | useUIStore(s=>s.currentView) | 6 处使用 |
| src/components/layout/HeaderToolbar.tsx | :23 | const {currentView, openPanel} = useUIStore() | 2 个原子 selector | — |
| 同上 | :24 | const {songs} = usePlaylistStore() | usePlaylistStore(s=>s.songs.length)（若仅计数）否则 s=>s.songs | 执行时确认 :59 用法 |
| 同上 | :25 | const {neteaseUser} = useUserAccountStore() | useUserAccountStore(s=>s.neteaseUser) | — |
| 同上 | :26 | const {openManagementModal} = useSourceConfigStore() | useSourceConfigStore(s=>s.openManagementModal) | — |
| src/components/player/Apple3DQueueDrawer.tsx | :9 | const {panels, openPanel, closePanel, togglePanel} = useUIStore() | panels→useUIStore(s=>s.panels.shelf3D)（布尔）；其余 3 个动作独立 selector | :10 isOpen 固定用 shelf3D |
| src/hooks/useDynamicTheme.ts | :138 | const {themeColors,isDynamicTheme,setThemeColors,themeMode} = useUIStore() | 4 个原子 selector | 返回的 themeColors 若被调用方消费则保留该 selector |

**Step 1**：逐文件替换上表；字段多于 3 个且同文件多处使用时可保留一次 useStoreWithEqualityFn(useUIStore,(s)=>...,shallow)（样板：PanelOrchestrator.tsx:146），但优先原子 selector（R7）。
**Step 2**：useDynamicTheme.ts 除 :138 外不改副作用；确认 page.tsx:82 不接收返回值后，hook 可只做副作用（若 :268-289 内部依赖 themeColors，保留该订阅）。
**Step 3**：D7 证据：改前/改后分别对 Home/Player/全屏歌词在 1280×720、1920×1080、2560×1440 截图，pixelmatch/ImageMagick compare 输出 diff 比例（目标 ≤0.1%，仅允许亚像素抗锯齿差异），PR 附 6 张对比图 + Lead 复核记录。

**测试（新增）**：src/components/layout/shellSubscriptions.test.tsx（React.Profiler 包裹单组件，stub 全局 store 初始值，act 后断言）：
- "HomeView 在 uiStore.toasts 变化时 commit 次数 0"
- "PlayerView 在 uiStore.toasts 变化时 commit 次数 0"
- "HeaderToolbar 在 uiStore.toasts 变化时 commit 次数 0"
- "Apple3DQueueDrawer 在 uiStore.panels.queue 变化时 commit 次数 0"
- "useDynamicTheme 在 uiStore.themeMode 变化时不再触发宿主组件重渲染（返回稳定引用）"
- beforeEach 重置 store（zustand setState 浅合并回初值）。

**验证命令与预期**

~~~bash
npx vitest run src/components/layout/shellSubscriptions.test.tsx   # pass，新增 ≥5 用例
node scripts/report-store-stats.mjs --file src/components/layout/HomeView.tsx --file src/components/layout/PlayerView.tsx \
  --file src/components/layout/HeaderToolbar.tsx --file src/components/player/Apple3DQueueDrawer.tsx --file src/hooks/useDynamicTheme.ts
# 预期 whole=0
# React Profiler（dev）：toast show 一次，<Home> 子树 commit 组件数 before vs after（目标 -80%）
~~~

**验收**：E2=0、E3 达标；6 张截图 diff ≤0.1%；无 lint/tsc 新增警告。**回滚**：逐文件 revert（每文件改动 ≤20 行）。**风险**：①数组 selector（groups/userPlaylists/songs）仍会在写库时重渲染，属预期（数据变化）；②useDynamicTheme 若返回 themeColors 且调用方使用，必须保留该字段订阅，不能误删。

---

### S3-3 VisualizationView selector + 进度下沉 + canvas style memo（D7）

**目标**：播放中 viz 顶层 commit ≈40/10s → ≤1；视觉与 rAF 绘制逻辑完全不动。

**前置**：S3-1、S2-3（本文件 analyser 段已改）。**写作域**：VisualizationView.tsx、新增 src/components/visualization/VisualizationProgressContainer.tsx、测试。

**Step 1**：:84 整店 useUIStore() 拆 3 个原子 selector（currentView/setCurrentView/isTransitioning）。
**Step 2**：:96 整店 useVisualizationStore() 拆为 currentEffect、setCurrentEffect、effectSettings 三个字段 selector；:97 删除未使用的 _currentTheme（整店 useVisualSettingsStore() 移除）。
**Step 3**：:91-93 的 currentTime/duration/bufferedRanges 从父组件移除；新增 VisualizationProgressContainer.tsx（订阅这 3 个字段并渲染现有 VisualizationProgressBar，props 签名不变），替换 :820-827。
**Step 4**：:593-635 getCanvasStyle 改为 useMemo(makeCanvasStyle, [currentEffect, effectSettings])（把函数提到模块级纯函数 makeCanvasStyle(effect, settings)），避免每次渲染返回新对象导致 canvas style prop 变化。
**Step 5**：不改 :209-211/:363-371（S2-3 已改）、不改绘制循环、不改 14 个 effect 按钮 map。

**测试（新增）**：src/components/visualization/VisualizationView.selectors.test.tsx（Profiler + 全局 store stub）：
- "audioStore.currentTime 变化 10 次，VisualizationView 顶层 commit 0"
- "VisualizationProgressContainer commit 10 次"
- "currentEffect 变化时 canvas style 对象引用改变且只重算一次"
- "effectSettings 未变时 getCanvasStyle 结果引用稳定"

**验证命令与预期**

~~~bash
npx vitest run src/components/visualization/VisualizationView.selectors.test.tsx   # pass，≥4 用例
node scripts/report-store-stats.mjs --file src/components/visualization/VisualizationView.tsx  # whole=0
# dev + Profiler：播放 10s -> viz 顶层 commit ≤1（before 40）
~~~

**验收**：E4≤1；播放/切效果/全屏视觉与截图对比一致（14 个效果各 1 张，D7 授权记录）。**回滚**：revert 3 文件。**风险**：effectSettings 嵌套对象 selector 返回新引用时无限重渲染 → 只选 effectSettings 字段本身并用 useMemo 派生；若必须嵌套取 effectSettings[currentEffect]，用 useShallow。


---

### S3-4 Player3D currentView 门控

**目标**：Home 页（即使正在播放）60s 内 Player3D 音频采样 rAF 回调 = 0；切回 player 后 <100ms 恢复采样。

**前置**：无（独立小 PR）。**写作域**：Player3D.tsx、player3dMotion.ts、player3dMotion.test.ts（扩充）。

**现状核实**：Player3D.tsx:313-316 的 isVisualPlaybackActive 只由 playbackPhase + shouldReduceMotion 决定；:357-425 的采样循环仅用 document.visibilityState 门控（:366、:402-412），全文件无 currentView 判断。:429/:572 的 rAF 是切视图一次性调度，不属循环。

**Step 1**：player3dMotion.ts:43 增加纯函数 shouldRunPlayer3DFrameLoop(input: {phase, reducedMotion, isPlayerViewActive}): boolean，内部 = isPlayer3DVisualsActive(...) && isPlayerViewActive（保留旧函数不动，新函数供组件用）。
**Step 2**：Player3D.tsx 增加 const currentView = useUIStore(s=>s.currentView)；:313-316 改为 shouldRunPlayer3DFrameLoop({phase: playbackPhase, reducedMotion: shouldReduceMotion===true, isPlayerViewActive: currentView==="player"})；:425 依赖数组加入 currentView（切回重启 effect，内部 scheduleSample 立即首帧）。
**Step 3**：dev-only 探针：循环内 window.__perf.player3dFrames++（S0-6 __perf 基座，NODE_ENV 判断）。

**测试**：扩充 player3dMotion.test.ts：①"currentView 非 player 时返回 false（即使 playing）"；②"player + playing 返回 true"；③"reducedMotion 返回 false"；④"非 playing 返回 false"。

**验证命令与预期**

~~~bash
npx vitest run src/components/player/player3dMotion.test.ts   # pass，新增 4 用例
# dev + CDP：currentView=home 且播放中 60s -> __perf.player3dFrames === 0（before ≈3600）
# 切到 player -> 500ms 内 player3dFrames 开始增长
~~~

**验收**：E6=0；切回无视觉空窗（首帧 <100ms）。**回滚**：revert 2 文件。**风险**：若 Player3D 有非音频 rAF 依赖该 gate（当前无，:215/:429/:572 均为事件/一次性），不会误停。

---

### S3-5 浮动层 gating

**目标**：idle（Home 未播放/不可见/全屏可视化）时浮动系 rAF 停跑，进入可视化不劣化。

**前置**：S3-4（门控样板）。**写作域**：GlobalClientComponents.tsx、src/components/player/floating/FloatingSpectrumGlow.tsx、FloatingWaveformGlow.tsx、FloatingDebugHUD.tsx、useFloatingDragPhysics.ts、新增 src/hooks/useFloatingActive.ts、测试。

**现状核实**：GlobalClientComponents.tsx:56-58 用 <div hidden={isImmersiveVisualization}><FloatingPlayer /></div> —— display:none 不会停 JS 循环；:42 isImmersiveVisualization 已由 currentView 计算。floating 目录自建 rAF 点：FloatingSpectrumGlow.tsx:229,239；FloatingWaveformGlow.tsx:302,320；FloatingDebugHUD.tsx:77,81；useFloatingDragPhysics.ts:407,410。FloatingSpectrumGlow.tsx:258-274 已有 IntersectionObserver 休眠样板（唯一正面样板，复用其模式）。

**Step 1**：新增 useFloatingActive.ts：组合 document.visibilityState（visibilitychange）+ IntersectionObserver(root=document) + 外部 active 值，返回布尔；SSR 返回 true。
**Step 2**：GlobalClientComponents.tsx 计算 const floatingActive = !isImmersiveVisualization && currentView !== "visualization"；用 <FloatingPlayer active={floatingActive} />（保留 hidden 布局语义，避免拖拽位置状态丢失），:56-58 不改 DOM 结构。
**Step 3**：FloatingPlayer 将 active 透传给上述 4 个文件对应组件（挂载关系执行时以 FloatingPlayer.tsx 全文确认，待核实具体子组件路径）；每个组件的 rAF 循环顶部 gate：if (!active || !isVisible) { cancel + return; }，恢复时重新 schedule。
**Step 4**：useFloatingDragPhysics.ts:407-410 的拖拽帧仅在拖动中运行（已事件驱动，确认无需常驻）。

**测试（新增）**：src/components/player/floating/floatingGating.test.tsx（vi.stubGlobal("requestAnimationFrame", spy)）：
- "active=false 时不调用 rAF"
- "active 从 false→true 恢复调度一次"
- "document.hidden 时不调度"
- "组件卸载后 cancelAnimationFrame 被调用"

**验证命令与预期**

~~~bash
npx vitest run src/components/player/floating/floatingGating.test.tsx   # pass，≥4 用例
# dev + CDP 注入 rAF 汇总计数，Home 未播放 60s：
#   before：floating 系循环数 >=3（审计 P1-2）；after：循环数 <=1（仅 PlaybackClock 等白名单）
# 进入全屏可视化 60s：FPS 与 before 差 <=5%，无 dropped 增加
~~~

**验收**：E5≤1；可视化入口 FPS 不退化；浮动播放器拖拽/展开/收起功能回归通过。**回滚**：逐文件 revert（active 默认为 true 时行为回到现状）。**风险**：hidden→停帧后恢复可能有 1 帧闪烁 → 恢复时先同步算一帧再入循环。

---

### S3-6 LazyPanel keepAlive LRU + deactivate

**目标**：43 面板从「打开一次永久驻留」改为三档生命周期；重面板 opt-in 保活；关闭面板停 timer/rAF。

**前置**：S3-1。**写作域**：LazyPanel.tsx（:19 componentCache、:50-60 粘性挂载）、PanelOrchestrator.tsx（:128-133、:174-472 的 43 个 LazyPanel）、新增 panelLifecycle.tsx、5 个重面板、测试。拆 2 PR：
- S3-6a：框架（LazyPanel/panelLifecycle/PanelOrchestrator 白名单 + 测试）≈250 行
- S3-6b：5 个重面板接入 usePanelLifecycle/deactivate ≈150 行

**三档 keepAlive（本任务定义）**

| 档位 | 语义 | 面板 |
|---|---|---|
| always | 关闭后保留实例（初始化昂贵/资源重） | shelf3D（Shelf3DView，three.js）、eq（AudioEqualizer，音频图+动画）、visualSettings（VisualSettingsPanel） |
| lru（默认） | 最近打开过的 2 个保留，其余关闭即卸载；重开走 lazy loading | queue、search、settings、history、lyricsSearch、lyricsImport、lyricsCoverEditor、smartPlaylist、playerSkins、listeningHistory、listeningJournal、dailyRecommendation、statsAchievements、accountCenter、cloudMusic、share、keyboardShortcuts、gestureSettings、professionalMode、professionalTools、instantMix、smartMixSession、smartRandom、emotionMatrix、aiAgent、aiSettings、dnaJournal、sleepTimer、lyricSettings、backupRestore、libraryManager、offlineCache |
| never | 关闭即卸载（一次性重工具，无保活价值） | dataManager、formatConverter、dsdConverter、trackCutter、crossfadeMixer、fingerprintScanner、libraryHealth、audioSourceManager |

**5 个重面板名单（初始化成本高/资源重，需 opt-in 与 deactivate）**：shelf3D、eq、visualSettings、playerSkins、dataManager（前 3 为 always；playerSkins 为 lru 但保留最近实例；dataManager 为 never 且必须有骨架屏）。
**5 个需停 timer 的面板名单（E8 依据）**：accountCenter（MultiPlatformAccountModal.tsx:105,117 两个 setInterval）、audioSourceManager（AudioSourceManagerModal.tsx:104）、aiSettings（src/components/settings/ai/tabs/AIPlaygroundTab.tsx:158）、search（输入防抖 timer，待核实行号）、lyricsSearch（搜索轮询/防抖 timer，待核实行号）；另 AppleAudioSourceInspector.tsx:56 为嵌套在来源管理面板内的第三处 timer，随父面板 deactivate 停止。

**Step 1**：新增 panelLifecycle.tsx：PanelLifecycleProvider({active, name, children}) 暴露 {active, name}；usePanelLifecycle() 读取；usePanelDeactivate(cb) 在 active false 时调用 cb（一次）。
**Step 2**：LazyPanel.tsx：接口新增 keepAlive?: "never"|"lru"|"always"（默认 lru）；删除 :50-58 hasMounted 逻辑，改为 const retained = usePanelRetained(name, keepAlive)（context 来自 PanelOrchestrator）；const shouldMount = isOpen || retained；!shouldMount 时 return null；渲染时套 PanelLifecycleProvider active={isOpen}；componentCache/prefetch 逻辑（:19-41）不动。
**Step 3**：PanelOrchestrator.tsx：新增 KEEPALIVE_CONFIG 常量（上表 43 项显式列出；测试断言 keys 与 FACTORIES（:11-126）完全一致）；用 useState 维护 lruOrder（打开时 unshift，去重，截断到 2 个 lru 面板），通过 context 提供；:174-472 的每个 LazyPanel 传 keepAlive={KEEPALIVE_CONFIG[name]}。
**Step 4**（S3-6b）：5 个重面板接入 usePanelLifecycle：shelf3D 在 active=false 时暂停 three.js 渲染循环（保留 renderer，不停 dispose）、eq 停频谱 rAF、visualSettings/playerSkins 停装饰动画、dataManager 停 tab 切换后的懒加载；accountCenter/audioSourceManager/aiSettings/search/lyricsSearch 用 usePanelDeactivate 清理 setInterval/防抖 timer（具体行号：见上；search/lyricsSearch 待核实）。

**测试（新增）**
- src/components/shared/LazyPanel.test.tsx：①"never 面板 isOpen=false 时立即卸载（返回 null）"；②"lru 面板超过容量 2 后最旧被卸载"；③"always 面板关闭后仍挂载"；④"关闭时子组件 active=false 且 deactivate 回调触发一次"；⑤"重开被卸载的 lru 面板仍能加载（Suspense boundary 不失效）"。
- src/components/layout/PanelOrchestrator.keepAlive.test.tsx：①"KEEPALIVE_CONFIG 的 key 集合 == FACTORIES 的 key 集合（43）"；②"always 名单 = [shelf3D,eq,visualSettings]"；③"never 名单无 always 项"。

**验证命令与预期**

~~~bash
npx vitest run src/components/shared/LazyPanel.test.tsx src/components/layout/PanelOrchestrator.keepAlive.test.tsx
# pass，新增 >=8 用例
# dev + CDP：依次打开 20 个面板再全部关闭；DOM 节点数（Document.getDocument 计数）
#   before ≈ 20 棵子树常驻；after <= 3(always)+2(lru) 棵 -> 回收率 >=80%
# 关闭全部面板后 5min：probe __perf.activeIntervals === 0
# 重开 queue 面板：PerformanceObserver longtask 无 >300ms；首帧 <300ms
~~~

**验收**：E7≥80%、E8=0；重开 queue ≤300ms；always 面板重开 0 加载；dataManager 首开有骨架屏。**回滚**：feature flag PANEL_KEEPALIVE_LRU=false（或把 KEEPALIVE_CONFIG 全设为 always）即回旧行为，单个面板可单独调整档位。**风险**：①重开成本（lru 容量过小会让 search 每次重载）→ 容量 2 + 重开 <300ms 实测，超过则调到 3；②卸载面板时进行中的异步请求需 abort（与 S1-8 token 结合，PR 中说明）。

---

### S3-7 重复宿主清理

**目标**：toast 容器与 SourceManagementModal 全局各 1 个实例。

**前置**：S3-1（page.tsx 已改）。**写作域**：GlobalClientComponents.tsx、PanelOrchestrator.tsx、page.tsx、测试。

**现状核实**：SourceManagementModal 在 GlobalClientComponents.tsx:29 import / :65 渲染，又在 PanelOrchestrator.tsx:8 import / :473 渲染（重复）。GlassToastContainer 在 page.tsx:46 dynamic / :146 渲染，又在 GlobalClientComponents.tsx:30 import / :61 渲染（重复）。AchievementToastContainer 仅 GlobalClientComponents.tsx:60（保留）。

**Step 1**：删除 GlobalClientComponents.tsx:29/:65 的 SourceManagementModal（PanelOrchestrator 是面板所有者，保留 :473）。
**Step 2**：toast 保留 GlobalClientComponents.tsx:61（layout 级，覆盖 /data-manager）；删除 page.tsx:145-147 的 Toast Overlay 块与 :46-49 的 dynamic 声明。
**Step 3**：给两个宿主加 data-global-host 属性（"toast"/"source-modal"）供测试与 E9 断言。

**测试（新增）**：src/components/layout/globalHosts.test.tsx：①"渲染 GlobalClientComponents + PanelOrchestrator 后 data-global-host=toast 数量 1"；②"data-global-host=source-modal 数量 1"；③"两宿主均在 DOM 中且无 console warning（重复 key/重复实例）"。

**验证命令与预期**

~~~bash
npx vitest run src/components/layout/globalHosts.test.tsx   # pass，3 用例
# dev + CDP：document.querySelectorAll('[data-global-host]').length === 2
# Network：触发 toast 一次 -> 无重复 toast DOM；打开来源管理 -> 1 个请求而非 2
~~~

**验收**：E9=1/1；无重复无障碍树（读屏）；/data-manager 路由 toast 可用。**回滚**：revert 3 文件。**风险**：删除 page.tsx toast 后若 layout 未覆盖某路由 → 核对 layout.tsx 已挂载 GlobalClientComponents（审计 B P0-6 证据）。

---

### S3-8 playlistStore 29 处整店订阅清零（2 PR）

**目标**：usePlaylistStore() 空参订阅 29→0（E10）；搜索输入触发的无关组件重渲染下降 ≥70%。

**前置**：S3-1。**写作域**：29 个文件（下表）+ 新增 src/store/selectors/playlistSelectors.ts + 测试。**目录 src/store/selectors/ 当前不存在，需新建。**

**selectors API（新增）**

~~~ts
// src/store/selectors/playlistSelectors.ts
export const selectSongs = (s: PlaylistState) => s.songs;
export const selectSongCount = (s: PlaylistState) => s.songs.length;
export const selectSearchQuery = (s: PlaylistState) => s.searchQuery;
export const selectFilteredSongs = (s: PlaylistState) => s.filteredSongs;
export const selectSelectedSongIds = (s: PlaylistState) => s.selectedSongIds;
// 动作：调用方逐个原子 select，或聚合后配 useShallow（禁止裸对象 selector）
~~~

**29 文件分批清单（字段已逐文件 grep 核实）**

| 批次 | 文件 | 现解构字段 | 替换 |
|---|---|---|---|
| S3-8a（7 文件，S3-2 已改 HeaderToolbar 不含） | src/components/library/UnifiedDataManagerHub.tsx、src/components/library/hub/CloudAssetsTab.tsx、src/components/library/hub/DataDashboardTab.tsx、src/components/library/hub/HealthStorageTab.tsx、src/components/library/hub/PlaylistHubTab.tsx、src/components/library/hub/LxMusicSearchTab.tsx、src/components/library/MusicLibrarySyncProvider.tsx | songs；songs；songs；songs+removeSong；songs:librarySongs；addSong:_addSong+importSongs:_importSongs；songs | 字段→s=>s.songs（或 count）；动作→原子 selector |
| S3-8b（21 文件） | library/DataManager.tsx（songs,filteredSongs,searchQuery,addSong,updateSong,removeSong,searchSongs,clearFilters,importSongs,exportSongs）、library/LibraryManagerPanel.tsx（songs）、library/LocalMusicManager.tsx（addSong,removeSong,importSongs）、library/OfflineCachePanel.tsx（songs）、library/HistoryPanel.tsx（songs:librarySongs）、library/LibraryHealthPanel.tsx（songs,removeSong）、library/BatchMetadataEditor.tsx（songs）、library/SmartPlaylistPanel.tsx（songs）、audio/CrossfadeMixer.tsx（songs）、audio/DSDConverter.tsx（songs）、audio/FormatConverter.tsx（songs）、emotion/EmotionVisualizer.tsx（songs）、interaction/FingerprintScannerPanel.tsx（songs）、lyrics/LyricsCoverEditor.tsx（songs）、lyrics/LyricsImportPanel.tsx（songs,updateSong）、player/SearchPanel.tsx（songs）、shared/SmartRandomModal.tsx（songs）、widgets/InstantMix.tsx（songs）、hooks/useDailyRecommendation.ts（songs）、hooks/useMusicLibrarySync.ts（songs）、hooks/useOfflineCache.ts（songs,updateSong:_updateSong） | 见左 | 同上 |

> 说明：审计口径 29 文件含 HeaderToolbar.tsx，它在 S3-2 已处理，因此 S3-8 实际 28 文件；执行时以 grep 结果为准并回填 PR。

**Step 1**：新建 selectors 文件 + 测试（纯函数断言）。
**Step 2**：S3-8a 改 7 文件；S3-8b 改 21 文件。每个替换保持解构变量名不变（仅订阅方式变），不重排 JSX。
**Step 3**：对只用于 length 的消费降为 number（执行时逐文件确认，减少无谓重渲染）。
**Step 4**（可选，若 PR 行数允许）：DataManager 的 searchQuery 输入加 300ms 防抖（若现无，执行时确认）。

**测试**
- src/store/selectors/playlistSelectors.test.ts：5 个 selector 纯函数断言（含空库）。
- src/components/layout/playlistSubscriptions.test.tsx：抽 3 个代表文件（HeaderToolbar、SearchPanel、CloudAssetsTab），Profiler 断言："playlistStore.setSelectedSong 变化不触发这些组件 commit"；"songs 引用变化时仅列表组件 commit"。

**验证命令与预期**

~~~bash
npx vitest run src/store/selectors/playlistSelectors.test.ts src/components/layout/playlistSubscriptions.test.tsx  # pass
node scripts/report-store-stats.mjs --store usePlaylistStore   # whole 文件数 = 0（before 29）
# React Profiler：搜索输入 10 字符 -> commit 组件数 before vs after（目标 -70%）
~~~

**验收**：E10=0；输入流畅（每键 commit 组件数下降 ≥70%，无 >50ms 长任务）；列表数据仍实时。**回滚**：a/b 两个 PR 各自可 revert。**风险**：songs 数组 selector 与旧整店解构在「引用不变」语义上一致，不会丢更新；DataManager 若依赖 filteredSongs 同步更新，需确认 searchSongs 逻辑不变。


---

### S3-9 预取策略（idle/intent）

**目标**：首屏后 5s 动态 import 12→≤3；LCP 不退化；面板首开仍可用。

**前置**：S0-6（PerformanceObserver 资源采集）。**写作域**：PanelOrchestrator.tsx、page.tsx、测试。

**现状核实**：PanelOrchestrator.tsx:151-172 两波 setTimeout（2000ms 后 4 个、再 3000ms 后 5 个，共 9 个 prefetchPanel）；page.tsx:87-93 bootstrapApp().then 立即 import PlayerView/VisualizationView/FeatureButtonsContainer 3 个。

**Step 1**：删除 page.tsx:89-91 三个立即 import（这三者已由 dynamic 声明按需加载）。
**Step 2**：PanelOrchestrator prefetch 改为：①只预取 queue、search 两个高概率面板；②用 requestIdleCallback（fallback setTimeout 3000，timeout 2000）；③navigator.connection?.saveData === true 时跳过；④移除第二波 5 个。
**Step 3**：intent 预取：PanelOrchestrator 内挂 document pointerover 委托：元素带 [data-panel-prefetch="<name>"] 时 prefetchPanel(name, FACTORIES[name])（每元素一次）；给 4 个高频入口加该属性（HeaderToolbar 队列按钮、HomeView 搜索按钮、FeatureButtonsContainer 搜索/设置按钮——后两者执行时定位，待核实）。
**Step 4**：卸载时移除委托监听。

**测试（新增）**：src/components/layout/PanelOrchestrator.prefetch.test.tsx（fake timers + spy import）：
- "mount 后 5s 内只调用 2 次 prefetchPanel"
- "saveData=true 时不预取"
- "pointerover 带 data-panel-prefetch 时触发一次预取"
- "卸载后 pointerover 不再触发"

**验证命令与预期**

~~~bash
npx vitest run src/components/layout/PanelOrchestrator.prefetch.test.tsx   # pass，4 用例
# dev + CDP PerformanceObserver(resource) 记录首屏后 5s 动态 import 数：目标 <=3（before 12）
# LCP 对比 before：劣化 <=+5%
~~~

**验收**：E12≤3；queue/search 首开无额外等待（命中预取）；LCP 不退化。**回滚**：revert 2 文件。**风险**：减少预取后首开变慢 → intent 预取补偿；requestIdleCallback 在 Safari 缺失 → fallback。

---

### S3-10 Top20 剩余整店订阅 + audioStore 7 处清零

**目标**：audioStore 空参订阅 7→0（E11）；Top20 中未被 S3-2/8 覆盖的整店订阅清零；组件层整店 ≤10（仅剩 V8 死代码与 S6 待删清单）。

**前置**：S3-2、S3-8。**写作域**：~16 文件（下表）。**PR 数**：1（~260 行）；若超 400 行按 audioStore / uiStore 两类拆 a/b。

**audioStore 7 处（grep 已核实）**：src/components/emotion/EmotionVisualizer.tsx、src/components/library/hub/CloudAssetsTab.tsx、src/components/library/hub/OfflineDownloadsTab.tsx、src/components/library/hub/PlaylistHubTab.tsx、src/components/widgets/MusicBackstory.tsx、src/components/library/hub/LxMusicSearchTab.tsx、src/components/player/QueuePanel.tsx。

**其余 Top20 未覆盖文件（审计 A §2.3 Top20 减已处理项）**：src/components/audio/HiResBadge.tsx（useHiResStore ×4）、src/components/player/PlayerSkinsPanel.tsx（3）、src/components/player/QueuePanel.tsx（3，与 audioStore 重叠）、src/components/layout/AIToolbox.tsx（3）、src/components/widgets/DNAJournal.tsx（3）、src/components/widgets/MusicBackstory.tsx（3，重叠）、src/components/features-v7/*Toggle.tsx（uiStore 整店，5 文件）、src/components/player/floating/FloatingExpandedState.tsx（uiStore 整店）、src/components/features-v7/ProfessionalToolsPanel.tsx（uiStore 整店）、src/components/library/UnifiedDataManagerHub.tsx（uiStore 整店；S3-8 只改 playlistStore）。执行时以 node scripts/report-store-stats.mjs --top 20 输出为准回填清单；不纳入本 PR：src/components/visualization-v8/**（死代码，随 S4-7 删除）。

**Step 1**：对每个文件按字段拆原子 selector；动作保持原引用。
**Step 2**：QueuePanel 同时改 audioStore（7 处之一）与 uiStore；注意其队列数据应来自 queueStore（S1-5 后），若仍读 audioStore.queue 则改为 queueStore selector（单向只读投影，不改 owner）。
**Step 3**：用 grep 验证（本 PR 不新增 lint 规则，规则在 S6-1）。

**测试（新增）**：src/components/layout/top20Subscriptions.test.tsx（抽 QueuePanel/PlayerSkinsPanel/AIToolbox 3 文件）：Profiler 断言无关字段变化不触发 commit。

**验证命令与预期**

~~~bash
npx vitest run src/components/layout/top20Subscriptions.test.tsx   # pass
node scripts/report-store-stats.mjs --top 20   # 组件层整店 <=10（before 160 总量）
grep -rn "useAudioStore()" src --include=*.tsx  # 0 命中
~~~

**验收**：E11=0；组件层整店 ≤10 且剩余项全部在 S4-7/S6 删除清单内（PR 附清单）。**回滚**：revert PR。**风险**：HiResBadge 4 处整店订阅可能是有意（徽标依赖多字段）→ 用 useShallow 聚合而非逐字段；禁止裸对象 selector。

---

## 5. 阶段级验证命令与证据清单

顺序执行（I7）：

~~~bash
# 1 Lint（改动文件；全仓阈值在 S8 前不变）
npx eslint src/app/page.tsx src/components/layout src/components/player src/components/visualization/VisualizationView.tsx \
  src/components/shared/LazyPanel.tsx src/components/features-v7 src/store/selectors --max-warnings=0
# 预期 exit 0

# 2 单测
npx vitest run src/app src/components/layout src/components/player src/components/shared src/store/selectors
# 预期全 pass；S3 新增 >=35 用例

# 3 类型
npx tsc --noEmit --incremental false --pretty false   # 预期 0 error

# 4 构建
npm run build   # 预期 exit 0；rootMain gzip 变化 <=5KB（S3 不改包体）

# 5 dev + 冒烟（3025）
npm run clean:port && npm run dev
# 场景：启动 -> Home 60s -> toast/打开队列/搜索/设置 -> 播放 -> 切 Player -> 切可视化 -> 回 Home
# CDP：0 console.error / 0 uncaught exception
# Profiler 三场景：toast、面板开合、搜索输入，各记录 before/after commit 数

# 6 规则复测
node scripts/report-store-stats.mjs --top 20                    # E1/E2/E10/E11/E13
node scripts/report-store-stats.mjs --file src/app/page.tsx     # whole=0
~~~

**证据清单（每 PR 必附）**：①命令+退出码；②Profiler 截图/commit 计数表（场景/指标/before/after/样本数）；③受保护视图截图对比（S3-2/S3-3，D7 授权记录 + diff 比例）；④CDP DOM 节点计数（S3-6）；⑤rAF 计数（S3-4/5，60s 采样）；⑥首屏 5s 动态 import 列表（S3-9）。

---

## 6. 与相邻阶段的接口/交接物

| 方向 | 交接物 |
|---|---|
| S2 → S3 | S2-3 已改 VisualizationView 的 analyser 段；S2-4 写盘降频让 Profiler 数据更干净 |
| S3 → S4 | ①S3-1 的 VisualTokens 与 CSS 变量方案供 S4-3（splitChunks/字体）复用；②S3-6 keepAlive 决定 S4-4/4-5 列表组件是否常驻；③S3-9 的 idle/intent 预取是 S4 动态 import 的基础 |
| S3 → S5 | S3-4/S3-5 的门控函数（shouldRunPlayer3DFrameLoop、useFloatingActive、PanelLifecycle）在 S5 由 VisualRuntime 接管：保留 hook 作为 adapter，删除组件内自建 rAF；S3-6 的 deactivate 成为 runtime 的 visibility 契约 |
| S3 → S6 | S6-1 的 codemod/ESLint 规则以 S3 清零结果为基准（whole≤10 白名单）；S6-6 UI 域拆分时 page.tsx/壳的 selector 已是原子形态；S6-6 的 panelStore 可直接复用 panelLifecycle |
| S3 内部 | S3-8a/8b 与 S3-2 不共享文件（HeaderToolbar 由 S3-2 独占）；S3-10 依赖 S3-8 清完 playlistStore |

---

## 7. 未决问题 / 需决策项

1. **D7 授权（阻塞 S3-2/S3-3）**：受保护视图仅允许订阅方式等价改写（推荐 A）。若选 B（完全禁止），S3-2/S3-3 只能做 wrapper（收益减半、风险更高），E2/E3/E4 目标需下调。
2. **面板 keepAlive 默认档**：关闭即卸载会让 dataManager/formatConverter 重开加载 1–2s。默认方案：never 面板必须提供骨架屏且重开 ≤300ms（否则放宽为 lru）。请确认可接受。
3. **toast 单宿主放在 layout 级（GlobalClientComponents）而非 page.tsx**：/data-manager 也能收到 toast；但崩溃隔离边界从 page 的 PanelErrorBoundary(silent) 移到 layout，需确认可接受（或把 silent boundary 一并移到 Global）。
4. **浮动层用 hidden（停帧）还是条件挂载**：默认 hidden + active 停帧，保留拖拽位置；若产品接受位置重置可改条件挂载（更彻底但交互回归）。
5. **songs 数组 selector 的语义**：部分组件只需数量却订阅整个数组。默认逐文件降为 length；若后续需要排序/过滤，应在 selectors 文件新增派生函数（本阶段不新增派生逻辑）。
6. **Top20 口径差异**：审计 A 统计 160 处整店（含 hooks/app/lib），本次 grep 文件级结果与审计 Top20 有 ±1 差异（如 uiStore 18 vs 19）。以 S0-6 report-store-stats 输出为唯一口径，PR 中记录差异。
7. **待核实项**：search/lyricsSearch 的 timer 精确行号；FloatingPlayer 子组件挂载关系；FeatureButtonsContainer/HomeView 搜索按钮位置（intent 预取 data 属性落点）；HeaderToolbar.tsx:59 对 songs 的用法（count vs 数组）。
8. **与未提交手势分支的冲突**：55 项未提交改动新增的常驻 layout 组件/timer/rAF（总计划 §10.4-3）需在 S3-5/S3-6 一并纳入门控；执行前必须先完成 S0-1。
