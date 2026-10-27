# MIMI Music Player 架构与性能优化总计划（2026-10-21）

> **状态**：规划完成，产品代码尚未修改。本文是总计划与验收基线；各阶段执行时再按任务拆成独立 PR。
> **审计依据**：4 份独立审计（A 状态层 / B 渲染与可视化 / C 音频与运行时 / D 构建与质量）+ Lead 复核与实测基线。审计原文位于 `scratch/architecture-audit-2026-10-21/`（gitignore，未提交），本文引用其结论时标注证据文件:行号。
> **前置输入**：`docs/nbl/plans/2026-10-20-architecture-performance-*（旧审计草案，位于分支 docs/architecture-performance-plan，尚未合并）`。本计划接续其已确认的 3 项决策（保留现有技术栈与数据格式；Web 由 Next 服务承载、Windows 桌面捆绑本地 Next 运行时；以当前 Windows 1080p/60fps 为主场景、音频稳定为硬约束），并补齐其未覆盖的执行级任务。
> **适用分支**：`master`（稳定基线）；当前工作树 `feature/gesture-air-control-overhaul` 有 55 项未提交改动（约 17.3k 行），必须先处理（见 S0-1）。

---

## 0. TL;DR（一页结论）

### 0.1 一句话诊断

**项目的问题不是"某处性能差"，而是"正确性边界不清 + 多套权威并存 + 没有测量与门禁"，导致性能优化只能打症状、架构收敛不敢动。**

当前 build/tsc/lint/vitest **全绿**，但这是"没有门禁下的绿"：CI 触发分支指向不存在的 `main`（真实稳定分支是 `master`），Electron 打包读的是 2026-07-30 的陈旧 `out/`，覆盖率门禁只覆盖 2 个域（15 个文件）的 30%。在补上安全网之前做大规模重构或性能重写，无法证明收益，也无法防止回退。

### 0.2 必须先解决的 10 个 P0（证据见第 3 节）

| # | 问题 | 一句话影响 |
|---|---|---|
| 1 | 队列双权威：`audioStore.queue` vs `queueStore.queue` 手工同步 | 队列面板删/排/清后，播完切歌按旧队列走 → 播错歌/跳过新歌 |
| 2 | `VibeMusicDB` 同时以 v1/v2 打开 | 本地导入歌曲 `local://` 读取必失败且被静默吞掉 |
| 3 | 备份/恢复 key 错配 + 启动压缩截断 | 5/10 个备份槽位无效；启动把 200 项队列截成 50、30 条历史截成 20 |
| 4 | `useAudioPlayer` 多实例共享 audio 元素并互相剥离监听 | 关掉歌词/可视化后可能"进度不动、播完不切歌、错误无提示" |
| 5 | 播放请求无取消机制 | 连点切歌时旧解析/下载继续跑，抢带宽和 IndexedDB |
| 6 | `AudioContextWatchdog` 在懒创建路径永不生效 | 合盖/切设备后可能"suspended 不恢复" |
| 7 | 音频图双路 + 音量双写 | 干湿声叠加、效果强度失真；音量疑似双重衰减 |
| 8 | Electron 生产包断链（静态导出/API origin） | 桌面版会发旧前端；在线解析/歌词/封面/代理播放全部失效 |
| 9 | 页级整店订阅 + 全局样式内插 | 每个 toast/面板操作都重渲染整个应用壳 |
| 10 | V8 组件树（11,355 行）未接线；store 仍被 5 处引用 | 文档把 V7/V8 说反；空操作写入误导；同名效果改错文件；维护成本翻倍 |

### 0.3 总路线（7 个阶段，可独立交付/回滚）

```
S0 止血与基线       1-2 天    CI 复活、构建产物明确、文档纠偏、测量基座、决策 ADR
S1 数据与播放正确性  1.5-2 周 备份/压缩/配额、IDB 统一、队列唯一权威、媒体事件单例、看门狗、请求取消
S2 音频图与持久化    1 周     单入口混音、音量单点、效果增量、AnalyserHub、播放写盘降频
S3 应用外壳与订阅    1-1.5 周 页级/全局壳 selector、rAF 门控、面板 LRU、重复宿主、预取策略
S4 包体与加载        1 周     jsmediatags/crypto-js 懒加载、splitChunks、CoverImage、VirtualList、V8 处置
S5 渲染运行时        1.5-2 周 VisualRuntime、EffectPlugin 契约、质量档位、试点效果迁移
S6 状态架构收敛      2-3 周   storageRegistry、audio/player/ui 域收敛、selector 门禁、用例层
S7 服务与平台边界    2 周     解析器插件化、缓存、Worker、Electron 本地 Next 运行时、插件沙箱
S8 门禁与长期治理    持续     覆盖率扩域、包体/性能回归、文档事实校验、季度对账
```

- **关键路径（必须先做）**：S0 → S1 → S2 → S3。这四段完成后，用户可感知的正确性与卡顿问题应基本清零。
- **最小可交付版本（MVP，2-3 周 / 单人）**：S0 + S1 + S2 + S3（仅 S3-1/2/3/7）+ S4-1/2 + 最小 CI 门禁。
- **完整版（单人约 10-12 周；2-3 人并行约 5-6 周）**：S0-S8。
- 每个阶段有独立出口条件、验收指标与回滚点；不存在"大爆炸重构"。

### 0.4 三个第一批硬指标（用于判断计划是否真的有用）

| 维度 | 现状 | 目标 | 测量方式 |
|---|---|---:|---|
| 播放写盘 | ~8 次/秒（2 store × 4Hz） | ≤1 次/秒 | patch `Storage.prototype.setItem` 计数 |
| 首屏 rootMain gzip | 296.8 KB | ≤190 KB | `build-manifest.json` 求和 + zlib |
| 空闲 rAF 循环（Home 未播放） | ≥3（推断） | ≤1 | CDP/注入计数器统计 rAF 回调 |

### 0.5 开始前的两件事

1. **处理 55 项未提交手势改动**（17.3k 行，单文件最大 2,965 行）：先 commit checkpoint 或拆成 ≤400 行的 PR 序列合并到 `master`。否则后续所有基线不可复现，改 `page.tsx`/`uiStore`/`GlobalClientComponents` 必冲突。
2. **拍板第 8 节的 8 个决策**（V8 去留、桌面运行时形态、备份范围等），并确认执行计划包中的 23 个执行期确认项（Q01-Q23，见 [00-decisions.md](./2026-10-21-arch-perf-execution/00-decisions.md)）。未拍板的项按推荐默认值执行。

---

## 1. 计划范围、方法与不变量

### 1.1 范围

**包含**：状态管理与持久化、播放/音频图、渲染与可视化、包体与加载、Electron/后端边界、构建/测试/CI 门禁、文档事实。

**不包含（明确非目标）**：
- 不替换 Next/React/Zustand/Web Audio 技术栈，不重写播放器或渲染引擎；
- 不做一次性的目录大迁移（`src/features/*` 领域化只作为 S8 之后的长期项）；
- 不修改 V7 核心界面的视觉与交互（资料库 Home View、播放器 Player View、全屏歌词）；必要的订阅方式等价改写需单独授权（决策 D7）；
- 不重命名/删除任何现有 localStorage/IndexedDB key 或破坏备份 envelope（迁移必须"读旧写新、旧 key 保留一个版本"）；
- 不引入新的重型依赖（E2E 工具、Web 框架、状态库）；依赖新增必须单独评审。

### 1.2 方法与证据等级

- 4 个独立审计代理并行完成：A（60 store 全量清单与依赖图）、B（渲染挂载/双系统/包体）、C（音频栈/服务/Electron）、D（构建/测试/CI 实测基线）；Lead 复核关键路径并独立验证了数据与音频 P0 的代码行号。
- 本文所有数字来自实际命令或源码行；推断项标注 **[推断]**。行数以 `read` 工具 totalLines / Node 实测为准（PowerShell `Measure-Object -Line` 会低估 10-17%）。
- 基线 commit：`c73a872`（feature/gesture-air-control-overhaul，含 55 项未提交改动）；稳定基线 `master` = `90c2152`。**所有数字都是脏树口径**，S0-1 处理完需在干净树上复测一次。

### 1.3 硬不变量（任何阶段不得违反）

| # | 不变量 | 说明 |
|---|---|---|
| I1 | 用户数据兼容 | 44 个 persist key、备份 envelope、IndexedDB 现有字段继续可读；改结构必须 version+1 + migrate + 旧 JSON fixture 测试 |
| I2 | 播放连续性 | 打开面板/切视图/切可视化效果不重建 audio 元素、不重置进度；异步源失败不得污染当前曲目与队列 |
| I3 | 单一事实源 | 同一事实只允许一个可写 owner；其它位置只能是 selector 派生或单向只读投影 |
| I4 | 资源有 owner | 每个 AudioContext/Worker/Raf/监听/纹理都有明确创建者与释放方法；隐藏视图停止非必要工作 |
| I5 | 受保护界面 | Home View / Player View / 全屏歌词视觉与交互不变；改动前先拿授权（D7） |
| I6 | 每 PR ≤400 行 | 纯删除/纯格式化/测试可申请例外；大改动按"兼容层→调用迁移→删除旧路径"拆批 |
| I7 | 验证顺序 | `eslint → vitest → tsc --noEmit → build → clean-port/dev → HTTP smoke → CDP/Electron smoke`；禁止并行 build 与 tsc，禁止在 dev 存活时 clean `.next` |

---

## 2. 现状基线（2026-10-21 实测）

### 2.1 代码规模

| 指标 | 实测 | 备注 |
|---|---:|---|
| `src` ts/tsx 文件 | 693（生产 490 / 测试 203） | 另有 `.v7`、`.fix` 死文件 |
| `src` 总行数 | 168,716（生产 138,883 / 测试 29,833） | Node 实测口径 |
| `src/components` | 353 文件 / 95,600 行 | 最大层 |
| `src/store` | 60 模块 / ~17,940 行 | 44 处 persist |
| `src/lib` | 114 文件 / 14,314 行 | 含 `lib/audio` 26 生产文件/4,584 行 |
| `src/hooks` | 19 生产文件 / 5,551 行 | `useAudioPlayer.ts` 1,823 行 |
| `src/services` | 18 生产文件 / 6,116 行 | `MultiSourceResolver.ts` 1,366 行 |
| `src/workers` | 4 文件 / 674 行 | conversion/dsd/fingerprint/waveform |
| `electron` | 4 文件 / 615 行 | main 389 行 |
| API routes | 30 个 `src/app/api/**/route.ts` | 静态导出下不可用 |
| V7 可视化 | 34 非测试文件 / 18,495 行 | **实际挂载**（`page.tsx:29-32,133-135`） |
| V8 可视化 | 38 非测试文件 / 11,355 行 | **组件树零引用**（仅自身测试）；visualizationV8Store 被导航岛/AI 工具空操作写入，performanceV8Store 被 V7 3 文件使用（详见执行计划 S4） |
| 单文件热点 | `cinematicLyricDrift.ts` 2,653；`Shelf3DView.tsx` 2,521；`useAudioPlayer.ts` 1,823 | 与 ≤400 行/PR 规范冲突 |

### 2.2 质量门禁基线（实测，脏树）

| 门禁 | 命令 | 结果 | 耗时 |
|---|---|---|---:|
| 类型 | `npx tsc --noEmit` | exit 0，0 errors | 23.3s |
| Lint（源码） | `npx eslint src --max-warnings=99999` | exit 0，0 problems | 142.4s |
| Lint（根） | `npx eslint .` | exit 0，0 problems | 56.5s（热） |
| 单测 | `npm run test -- --run` | 205 文件 / 1,267 用例 / 0 failed | 106s |
| 覆盖率 | `npx vitest run --coverage` | 52.64/50.08/66.2/53.19（仅 audio+utils，15 文件） | 80s |
| 构建 | `npm run build` | exit 0，3 静态页 + 31 API route，`.next` 387MB | 114.9s（全冷） |
| CI | `.github/workflows/deploy.yml` | **只在 main 触发；仓库无 main** → 从未运行；且无 tsc/build/coverage | — |

### 2.3 产物与资源基线

| 指标 | 实测 | 说明 |
|---|---:|---|
| `/` 首屏 JS | **1,996.7 KB** raw + 227.4 KB CSS | 38 个 script 引用求和（D） |
| `/data-manager` 首屏 JS | 1,857.7 KB | — |
| `/_not-found` 首屏 JS | 1,524.7 KB | 全局 provider 全量绑定 |
| rootMainFiles | 23 文件 / 969.3 KB raw / **296.8 KB gzip** | 每路由必载 |
| 最大 async chunk | three 333.5 KB、fabric 275 KB | 懒加载边界成立 |
| 首屏 vendor 碎片 | 20 个同名 `vendors-*` 块 | splitChunks `maxSize:300000` 副作用 |
| `public/` | 58.4 MB | mediapipe 40.55MB + default-cover 三份 17.8MB |
| `out/` | 20.7 MB，mtime **2026-07-30** | 陈旧，Electron 打包会发旧前端 |
| `dist-electron/` | 1.68 GB | 历史产物堆积 |
| `node_modules/` | 1,537 MB | 含 extraneous `pixi.js` junction |
| 本地 worktree | 27 个 / 5.19 GB | 磁盘与搜索噪声 |

### 2.4 运行时与架构基线

| 指标 | 实测 | 说明 |
|---|---:|---|
| store hook 调用点 | 642 / 150 文件 | 整店订阅 **160（24.9%）**；只整店无 selector 的文件 **59** |
| store 间静态 import 边 | 21 条，其中 SCC 1 个 | `audioStore ↔ playlistStore` |
| 跨层 `getState` 写状态 | 358 处 / 78 文件 | 组件 126、hook 83、store 94、service 29、lib 25 |
| persist key | 44 个；有 version 的 3 个；有 migrate 的 1 个 | 22 个在首屏 eager 图中同步 hydrate |
| rAF 调用点 | 43 处 / 20 文件 | 门控标准三套并存 |
| setInterval | 13 处 / 10 文件 | 多数无统一清理注册表 |
| `backdrop-filter` | 271 处 / 119 文件 | 其中可视化顶/底栏压在全屏动画 canvas 上 |
| 强制同步布局 | 77 处 / 25 文件 | 部分在 rAF 内 |
| `<img>` | 33 处 / 17 文件，`loading/decoding` 属性 0 | 封面常为 500-1000px 原图 |
| 虚拟列表 | `VirtualList` 组件存在，**使用点 0** | 队列/搜索/数据管理列表均直接 `.map()` |
| 面板 | PanelOrchestrator 43 个面板 | `LazyPanel.hasMounted` 永不复位（粘性挂载） |
| `useAudioPlayer()` 调用点 | 7 处（初始路径至少 3 个实例） | 共享同一对 `<audio>` |
| IndexedDB | 5-6 个库 | `VibeMusicDB` v1/v2 双版本冲突 |
| API 能力 | 30 个 Next route | Electron `app://` 下 origin 不可用 |

### 2.5 已有资产（不要重造）

- **播放正确性核心**：`playbackRuntimeStore`（requestId/phase/activeDeck）、`playbackStateMachine.ts`、`playbackMediaEventGuard.ts`、`PlaybackClock.ts`（rAF + useSyncExternalStore + dispose）——这是正确设计，目标架构应围绕它收敛，而不是另起一套。
- **渲染引擎契约**：V8 的 `RenderEngineManager`（DPR 钳制、ResizeObserver、contextlost、FPS 降档）与 `lib/visualization/types.ts` 的 EffectPlugin 契约虽然系统未接线，但设计正确，应移植到 V7。
- **资源管理样板**：`Shelf3DView` 的 dispose/DPR/contextlost、`BlobUrlRegistry`（100 上限 LRU）、`networkAudioCache`（200 首/4GB LRU）、`audioPrefetcher`（仅 2 个预热元素）。
- **基础设施**：`safeStorage`、`queueActions.ts`（纯函数 + 测试）、`VirtualList`、`scratch/perf/measure.py`（Chrome channel + 画布非空校验 + draw/掉帧分位）、`scratch/perf/BASELINE.md`（1080p draw 中位 1.3ms）。
- **流程资产**：ROADMAP 的验证顺序、`docs/nbl/PROCESS.md` 的 PR/提交规范、既有 205 个测试文件。

---

## 3. 问题诊断（P0 / P1 / P2）

### 3.1 P0：正确性与数据（必须先修）

| # | 问题 | 关键证据 | 影响 |
|---|---|---|---|
| P0-1 | **队列双权威**：`audioStore` 与 `queueStore` 各存一份 queue/currentIndex，仅 3 个入口手工同步；`QueuePanel` 等只改 queueStore，`audioStore.nextSong` 读旧副本 | `audioStore.ts:77-78,394-464,517-557`；`queueStore.ts:130-133,140-230,343-348`；`useAudioPlayer.ts:783-806` | 删/排/清队列后播错歌、跳过新插入、越界；两套持久化（`queue-store-v5` 与 `audio-store-v4.currentIndex`）重启后互相矛盾 |
| P0-2 | **VibeMusicDB 版本冲突**：`localMusicService` 以 v1 打开，`localMusicStorage` 以 v2 打开同库 | `localMusicService.ts:7-13,42`；`localMusicStorage.ts:6-7,58-72` | 库升到 v2 后 v1 open 必抛 VersionError → 静默返回 null → 本地导入歌曲"文件不存在" |
| P0-3 | **备份/恢复 key 错配 + 恢复不 rehydrate + 启动压缩有损** | `backupRestoreStore.ts:148,217-242,279-341,504-507`；`safeStorage.ts:76-112`（queue 50/history 20）vs `queueStore.ts:343-348`（200/30）；`queueStore.ts:359-405` 配额失败写空队列 | 5/10 备份槽位写无人读取的 key；恢复后界面无变化；启动把有效队列截短；配额不足时静默丢队列 |
| P0-4 | **媒体事件多实例互删**：模块级共享 `<audio>`，每个 hook 实例 attach 时 detach 上一次监听，cleanup 无条件 detach 当前 owner | `useAudioPlayer.ts:51-56,200-250,396-400,954-981,1248-1288`；7 个调用点 | 关掉歌词/可视化等面板后，ended/timeupdate/error 可能无人处理 |
| P0-5 | **播放请求无取消**：`managePlayback` 5 处 await，仅靠 requestId 丢弃结果；resolver/cache/prefetch 均无 AbortSignal | `useAudioPlayer.ts:1400-1706`；`audioSource.ts:105`；`MultiSourceResolver.ts:988`；`useNetworkAudioCache.ts:107` | 连点切歌时多条链路并发，起播更慢、内存峰值、旧请求继续写缓存 |
| P0-6 | **Watchdog 永不生效**：启动即 `start()`，但 AudioContext 懒创建，attach 时 ctx=null 直接 return；`isStarted` 阻止重试；无 removeEventListener | `bootstrap.ts:73`；`AudioContextWatchdog.ts:29-46,143-153`；`AudioEngine.ts:26-28` | 合盖/切输出设备后可能保持 suspended；用户感知"点了播放没声音" |
| P0-7 | **音频图双路 + 音量双写**：`analyser→destination` 常连后又接效果链到 destination；element.volume 与 masterGain 同改 | `AudioEngine.ts:68,194-198`；`useAudioPlayer.ts:986-1005,1758-1764`；`AudioEffectsManager.ts:316-400` | 干湿叠加、效果强度被稀释、约 +3dB；音量疑似双重衰减 **[推断，需实测]** |
| P0-8 | **Electron 生产包断链**：`build` 不产 `out/`（仅 `STATIC_EXPORT=1` 时 export，全仓无设置），但打包只含 `out/**`、主窗口加载 `app://app/`；渲染层 `/api/*` 全走 `location.origin` | `next.config.js:3`；`package.json:13,92-97`；`electron/main/index.js:36,197-202`；`MultiSourceResolver.ts:227-231` | 桌面版发 2026-07-30 旧前端；在线搜索/解析/歌词/封面/代理播放全失效（待打包实测） |
| P0-9 | **页级整店订阅 + 全局样式内插**：`page.tsx:78-79` 整店订阅 uiStore/visualSettingsStore；`:98-119` 把 blur/animation 内插进 `<style jsx global>`；`useDynamicTheme` 再整店订阅一次 | `page.tsx:78-79,98-119`；`useDynamicTheme.ts:138` | 任意 toast/面板/主题写入 → 整个应用壳（Home/Player/常驻 Visualization/43 面板包装）reconcile + 全站 271 处 backdrop-filter 重算 |

### 3.2 P0/P1：性能（按可测量收益排序）

| # | 问题 | 证据 | 现状 → 目标 |
|---|---|---|---|
| P1-1 | 播放写盘放大：audioStore/playerStore 双向同步 + 双 persist，250ms tick 各写一次 | `playerStore.ts:38-44,165-179`；`audioStore.ts:232-249,703-818`；`useAudioPlayer.ts:412-430` | ~8 次/秒 → ≤1 次/秒 |
| P1-2 | 常驻 rAF 门控不一致：Player3D 只判 `document.visibilityState`，不看 `currentView` | `Player3D.tsx:357-419`（无 currentView 判断）；`VisualizationView.tsx:267` 有 gate | idle rAF ≥3 → ≤1 |
| P1-3 | 面板粘性挂载：一次打开永久驻留（DOM/订阅/timer） | `LazyPanel.tsx:50-60`；43 个面板 | 开 20 关 18 → DOM 回收 ≥80% |
| P1-4 | 重复全局宿主：toast ×2、SourceManagementModal ×2 | `GlobalClientComponents.tsx:65` + `PanelOrchestrator.tsx:473`；`page.tsx:144-147` | 每类实例 =1 |
| P1-5 | 首屏混入可懒加载库：jsmediatags（~180KB chunk）、crypto-js（~84KB chunk） | `services/audioMetadata.ts:3`；`utils/localMusicImport.ts:5`；`lib/sources/lxRunner.ts:1` | rootMain gzip 296.8 → ≤190KB |
| P1-6 | 效果参数拖动重建整条音频链 | `AudioEffectsManager.ts:331-377,620-628`；`AudioEffectsPanel.tsx:378` | 拖动 100 次 connect 次数 = 0 |
| P1-7 | 共享 Analyser 被 V8 改写 fftSize + 每帧 `new Uint8Array` | `useVisualizationV8.ts:56-93`；`AudioEngine.ts:52-54` | fftSize 稳定；每帧 0 分配 |
| P1-8 | 列表无虚拟化：队列/搜索/数据管理均 `.map()` | `SearchPanel.tsx:791` 等 45 文件/75 处；`VirtualList` 使用 0 | 500 行列表首帧长任务 = 0 |
| P1-9 | 图片策略缺失：33 个 `<img>` 无 lazy/decoding；`images.unoptimized:true` | `hotpath-greps.txt`；`next.config.js:98-99` | 裸 `<img>` 归零（白名单除外） |
| P1-10 | 可视化每帧分配与 resize 重建粒子：`initParticles` 在 resize 时 new 1000 个 | `VisualizationView.tsx:294-306,408-437` | 连续 resize 100 次无 GC 抖动 |
| P1-11 | 包体 vendor 碎片 20 块、CSS 227.4KB、polyfills 110KB | `next.config.js:27-80`；`build-manifest.json` | script 请求 23 → ≤12 |
| P1-12 | Worker 无 transferable；大缓冲结构化克隆 | 4 个 worker 全部无 transfer list；`WorkerPoolManager.ts:53-75` | 50MB 转换主线程长任务 <50ms |

### 3.3 P1/P2：架构与维护性

| 类别 | 事实 | 影响 |
|---|---|---|
| 多权威状态 | 11 组重复：播放 8 字段三处、队列两处、EQ 两处、主题三套、全屏三处、toast 两套、currentView 两套、V7/V8 可视化两套、性能档两套 | 每个新功能都要决定写哪几个 store；迁移面随使用增长 |
| God store | `audioStore` 819 行/38 state/51 action/86 导入者/189 selector；`aiStore`、`statsAchievementsStore` 类似 | 改动成本高，无法判断职责边界 |
| 死层/死代码 | `src/store/coordinator/` 4 文件 66-76 行，全仓 0 引用；`audioProcessingStore` 0 消费者；`AudioGraphManager`/`DSPProcessor` 未接主链（~750 行）；V8 组件树 11,355 行（store 仍有 5 处引用）；`CinematicDirector.ts` 孤立 | 文档误读、tsc/eslint/vitest 变慢、改错文件风险 |
| 分层穿透 | service/lib 直接 `getState` 写 store 54 次；`lib/audio/AudioVisualizerManager` 反向依赖 hooks | 无法单测、无法复用、边界不可执行 |
| 持久化治理 | 44 key 无注册表；仅 3 version/1 migrate；22 个首屏同步 hydrate；5 个整店持久化；cookie 明文（5 个平台） | 一次结构变更可能静默丢设置；主题闪烁/ hydration 风险 |
| 文档失真 | ARCHITECTURE 声称 44/46 stores（实 60）、coordinator 已落地（实死层）、16 hooks/7 services/5 workers（实 19/18/4）、12 AI 模型（实 3 占位）、Static Export（实默认非 export）；AGENTS 声称 lint 19,790（实 0） | 新人与 AI agent 会按错误信息做决策（本轮审计任务书即复述了 V8 和 44 store） |
| 仓库卫生 | 39 个 AI 助手 dot 目录、27 个本地 worktree 5.19GB、`dist-electron` 1.68GB、2 个 git 跟踪死文件、`pixi.js` extraneous junction | 搜索/构建/磁盘成本 |
| 流程 | PR ≤400 行规范与现实冲突（单文件 2,965 行变更）；pre-commit 仅格式化；CI 未运行；覆盖率门禁 2 域 30% | "绿"不代表质量 |

### 3.4 六条根因

1. **兼容层只进不出**：`audioStore → playerStore → playbackRuntimeStore` 逐代叠加，旧权威未降级，形成三层多写。
2. **没有"运行时所有者"**：音频图、rAF、DPR、canvas、媒体监听散落在 20+ 组件/模块，各自实现生命周期。
3. **网络能力"浏览器优先"假设**：所有服务以 `location.origin + /api` 为契约，Electron 只是换了加载协议，没有 API 传输抽象与静态产物契约。
4. **追加式演化**：`useAudioPlayer` 1,823 行、`audioStore` 819 行、`MultiSourceResolver` 1,366 行都是"在旧结构上贴补丁"的产物；PR 规范和文件行数无机器约束。
5. **无测量、无门禁**：性能决策靠注释里的经验判断；CI 没跑；覆盖率门禁只保护 2 个域；导致"优化"无法证明、无法防回归。
6. **文档先于实现**：V8/coordinator/Static Export 都是"计划写成了现状"；数字长期漂移，反过来误导后续决策。

---

## 4. 目标架构 v2

> 目标不是"重写一套架构"，而是把现有正确设计（playbackRuntimeStore / 状态机 / PlaybackClock / V8 的引擎契约 / Shelf3D 的资源管理）收敛到明确的所有权与依赖方向。所有改造以"单 PR 可回滚、旧接口保留一个版本"的方式落地。

### 4.1 分层与依赖方向（硬约束）

    L5 components/views    只消费 hooks + selectors；不 import store，不在 render 体 getState 写状态
    L4 hooks/commands      React 适配层：组合 selector/action、注册事件；唯一允许跨多个 store 编排的层
    L3 selectors           纯派生函数（filteredSongs/当前曲目派生等），返回原始值或稳定引用
    L2 stores (owners)     每域一个 owner；store 之间只允许 import type，禁止运行时互调
    L1 domain (pure logic) playSong/nextSong/handleQueueEnd/queue 纯函数；无 React、无 zustand
    L0 services/workers    只依赖 L1 接口与平台 adapter；不 import store/hook/component
       persistence         仅 store 的 persist 配置；key 必须来自 storageRegistry
       platform adapters   browser WebAudio/IDB | Electron IPC | Next API | FastAPI

| 规则 | 内容 | 执行方式 |
|---|---|---|
| R1 | components 不得 import src/store/*；过渡期允许 selector 订阅，禁止整店订阅 | ESLint no-restricted-imports + 订阅规则 |
| R2 | 组件 render 体不得 useXStore.getState()；仅事件处理器/hook 允许 | no-restricted-syntax |
| R3 | store 之间禁止运行时 import（只允许 import type） | dependency-cruiser |
| R4 | services/lib 不得 import store/hook/component；需要状态时由调用方传入 port | dependency-cruiser |
| R5 | 持久化只在 store 的 persist 配置中声明，key 来自 storageRegistry | registry 一致性测试 |
| R6 | 每个事实只有一个可写 owner；第二处可写状态在 review 直接拒绝 | 所有权表 + contract 测试 |
| R7 | selector 返回对象必须 useShallow；优先返回原始值 | codemod + review |
| R8 | 新增 store 必须同时提交：所有权表条目、persist 注册（或显式 transient）、至少 1 个 contract 测试 | PR 模板 + CI 脚本 |

### 4.2 状态所有权表（目标态，推荐）

| 事实 | 唯一 owner | 允许的只读派生 | 写入口 | 持久化 |
|---|---|---|---|---|
| 当前歌曲 / 音量 / 倍速 / 循环模式 / 播放意图 | playerStore | audioStore 兼容投影（S6 后删除） | player actions + domain use-cases | player-store（v2，去掉高频进度） |
| 播放请求状态机（requestId/phase/shouldPlay/activeDeck） | playbackRuntimeStore | 组件只读 | request/bind/dispatch actions | 不持久化 |
| 队列 / currentIndex / history / 播放模式 | queueStore | 播放器 UI 通过 selector | queue actions + QueueNavigator | queue-store-v5（v6 迁移） |
| 即时进度（currentTime 高频） | PlaybackClock（内存） | 进度条/可视化按需订阅 | 媒体事件 → clock | 仅低频检查点（5s 一次、≤1 次/秒） |
| EQ / 音频设备 / 耳机预设 / 淡入淡出 / 效果设置 | audioSettingsStore（原 audioStore 收缩，改名在后） | 无 | 该 store actions | audio-store-v4（仅设置字段） |
| 效果链开关/强度 | audioEffectsStore / crossfadeStore | 无 | 各自 actions | 现有 key |
| 库歌曲列表（IndexedDB 为真实来源） | playlistStore（长期：library repository + UI store） | selectors | playlist actions + repository | 不持久化 |
| 视图 / 全屏 / 面板开合 | uiShellStore + panelStore（从 uiStore 拆出） | selector 标量 | shell actions | ui-store-v3 |
| 主题（mode/colors/dynamic） | themeStore（新增；D6 决策，备选 uiStore 独占） | 组件只读 CSS 变量 | theme actions + useDynamicTheme 副作用 | theme-store-v1（新） |
| Toast / 成就提示 | toastStore（合并 uiStore.toasts 与 stats activeToasts） | 无 | show/remove | 不持久化 |
| 可视化效果/参数/全屏（V7 唯一） | visualizationStore（V8 store 随 V8 处置） | 渲染运行时命令式读取 | visualization actions | visualization-store-v2 |
| 性能/质量档 | qualityStore（合并 visualMode + performanceV8 preset） | 渲染运行时读取 | quality actions | quality-store-v1 |
| 持久化注册表 | src/lib/storage/storageRegistry.ts | — | 只读 | 无 |

> 迁移期间旧字段保留为单向只读投影（由 owner subscribe 派生），不允许反向写回。兼容层必须在 PR 描述写明：替代 API、目标阶段、删除版本。

### 4.3 播放运行时控制器（src/lib/playback/）

| 模块 | 职责 | 从哪来 | 落地阶段 |
|---|---|---|---|
| PlaybackKernel | 唯一播放事实：requestId/phase/shouldPlay/deck；消费所有媒体事件 | playbackRuntimeStore + useAudioPlayer 内联判定 | S1 |
| QueueNavigator | next/prev/随机/循环/队列结束策略；唯一读 queueStore | audioStore.nextSong/prevSong（audioStore.ts:394-494） | S1 |
| PlaybackMediaBridge | 唯一 attach 媒体事件；节流进度；转成状态机事件 | useAudioPlayer.ts:396-981 | S1 |
| PlaybackRequestCoordinator | 每次起播一个 generation+AbortController；编排离线/本地/缓存/网络 | useAudioPlayer.ts:1302-1726 | S1 |
| SourceResolver | 三层音源（离线/本地/网络缓存）并行查询 + resolver 兜底 | useAudioPlayer.ts:1400-1630 | S1 |
| MetadataEnricher | 歌词/封面/元数据补全（失败不影响起播） | useAudioPlayer.ts:1556-1619 | S1 |
| ListeningRecorder | 播放统计/日志（5s 确认逻辑） | useAudioPlayer.ts:1728-1755 | S3 |
| AudioGraphController | AudioContext/EQ/master/analyser 所有权；单入口 destination；dispose | AudioEngine + AudioEffectsManager + initializeAudioGraph | S2 |
| AnalyserHub | 一份 FFT 数据多消费者；按需 fftSize；预分配缓冲 | getAudioAnalyser 全局共享 | S2 |

### 4.4 渲染运行时（src/runtime/）

| 模块 | 职责 | 阶段 |
|---|---|---|
| visualRuntime | 唯一 rAF 调度者：优先级桶（critical=可视化/3D，normal=浮动，idle=装饰）、统一门控（可见+前台+reducedMotion）、统一 DPR、统一降级、measure 钩子 | S5 |
| effectRegistry | EffectPlugin 注册表；按需动态 import + 缓存；每效果独立预算 | S5 |
| canvasPool | 离屏 canvas 复用、contextlost 恢复、纹理尺寸预算 | S5 |
| qualityTier | low/medium/high 判定（deviceMemory/hardwareConcurrency/长任务反馈）与切换 | S5 |
| ViewHost / PanelHost | 3 个常驻视图 + overlay 组合；43 面板 LRU(2)+deactivate（替代 page.tsx 内联与 PanelOrchestrator 手写） | S3/S5 |
| CoverImage | 统一图片组件：lazy/decoding/固定比例/缓存 URL | S4 |

契约（直接落成代码）：

    // C1 订阅
    // 禁止：const { a, b } = useUIStore();
    // 允许：const a = useUIStore(s => s.a);
    // 多值：const { a, b } = useUIStore(useShallow(s => ({ a: s.a, b: s.b })));

    // C2 帧订阅（组件不再直接 requestAnimationFrame）
    type FramePriority = "critical" | "normal" | "idle";
    const handle = visualRuntime.subscribeFrame("viz-canvas", (t, dt) => draw(t, dt), {
      gate: { visible: isVisible, foreground: true },
      priority: "critical",
    });

    // C3 效果契约（移植 V8 的正确设计，V7 效果逐步实现）
    interface EffectPlugin {
      id: VisualizationEffect;
      init(ctx: { width: number; height: number; dpr: number }): void;
      resize(width: number, height: number, dpr: number): void;
      draw(ctx: EffectContext, dt: number): void; // dt 由运行时提供，不自行取 timestamp
      destroy(): void;                            // 必须释放离屏 canvas/纹理/大数组
      budget: { maxParticles?: number; maxTextLayers?: number };
    }

    // C4 面板生命周期
    interface PanelLifecycle {
      onDeactivate?(): void; // 关闭时必须清 timer/rAF/subscription
    }
    // LazyPanel keepAlive: "never" | "lru" | "always"（默认 lru，容量 2；Shelf3D/EQ/可视化设置 opt-in always）

### 4.5 持久化基础设施（src/lib/storage/）

核心：注册表即代码（storageRegistry），取代 44 个散落的 persist({name}) 与三套存储策略。

    export interface StorageEntry {
      key: string;
      owner: string;                 // 唯一 owner store
      version: number;               // 结构版本，从 1 开始
      migrate?: (persisted: unknown, from: number) => unknown;
      group: "settings" | "playback" | "library" | "ai" | "ui" | "transient";
      backup: boolean;
      sizeBudgetBytes?: number;
      quotaPolicy?: "prune" | "prune-then-memory" | "memory";
      pruneFields?: string[];        // 按优先级
    }
    export const STORAGE_REGISTRY: StorageEntry[] = [ /* 44 项 */ ];

配套机制：

1. 统一 envelope：{ v, savedAt, data }（推荐），由 createRegisteredStorage 读写；migrate 有版本可依，可记录 savedAt 做 TTL。
2. 显式 hydration：所有 persist 设 skipHydration: true，由 hydrateStores() 在客户端按依赖顺序 rehydrate（player/queue → audio 投影 → UI/主题 → 业务域），提供 useStoresHydrated()。消除 22 个首屏同步 hydrate 与 SSR mismatch。
3. 版本升级流程：改 partialize 结构 = version+1 + migrate + 旧 JSON fixture 测试；CI 检查"字段集合变化但 version 未变"。
4. 备份 v5：从 registry 收集 backup=true 的 key；逐 key 校验 version 并 migrate；恢复后 rehydrate + 明确提示；备份正文从 localStorage 移到 IndexedDB。
5. 体积预算：启动空闲统计每个 key 字节数；44 key 总量 <2MB、单 key <256KB（audio/queue/lyrics 单列）；超预算告警 + 一次性 UI 提示。
6. 配额策略统一：先裁低价值字段 → 压缩 → 内存降级并 toast；任何路径不得在写入成功前删除旧有效值。

### 4.6 平台边界

| 能力 | 浏览器 / Web | Windows Electron（按前置决策：捆绑本地 Next 运行时） |
|---|---|---|
| 页面产物 | next build → .next/，Vercel/Docker next start | Next standalone 产物 + 本地 loopback 服务；主窗口保留现有 app:// origin（协议层桥接本地服务），避免 44 个 key/IndexedDB 的 origin 迁移 |
| API | Next route /api/* | BackendGateway.resolve(path)：浏览器 location.origin；Electron 本地 Next 或 FastAPI baseUrl；预留 net.fetch 主进程代理 |
| 后端 | 可选（AI 能力不可用时明确降级） | backend.exe 异步启动，不阻塞窗口；状态通过 IPC 广播；能力协商 |
| 插件 | 不支持 | 插件移入 utilityProcess，能力白名单 + 用户授权；vm 不作为安全边界 |
| 敏感凭据 | 明确提示"仅本地" | Electron safeStorage 加密存储平台 cookie |
| 构建产物 | .next/ | dist-electron/（依赖 S7-4 本地运行时）；禁止再打包陈旧 out/ |

### 4.7 目标目录（渐进，不做一次性迁移）

    src/
      domain/                  # 新增（S6）：playback/queue/library 纯用例
      lib/playback/            # 新增（S1/S2）：kernel/queueNavigator/mediaBridge/requestCoordinator/sourceResolver/audioGraph/analyserHub
      lib/storage/             # 扩展：storageRegistry/hydrateStores/vibeMusicDb（统一 IDB open）
      runtime/                 # 新增（S5）：visualRuntime/effectRegistry/canvasPool/qualityTier
      store/selectors/         # 新增（S3/S6）：派生 selector
      store/uiShellStore.ts 等 # 新增（S6，从 uiStore 拆出；旧 uiStore 保留兼容 facade）
      components/visualization-v8/  # S4 删除（若 D1 选 A/C）；现有 V7 保留并改造为 plugin
      services/resolver/       # 新增（S7）：平台插件化后的 resolver
      components/shared/ui/CoverImage.tsx # 新增（S4）

### 4.8 迁移策略：strangler + 兼容层退出日期

- 每个域单独迁移；旧 API 保留但标注 deprecated（替代 API、目标阶段、删除版本），新代码通过 no-restricted-imports 禁止使用。
- 兼容层只允许单向依赖（新 owner → 旧 facade 或反之，禁止循环）；旧 store 不再新增可写状态。
- 完成判据：旧 API 引用数 = 0（脚本统计）+ 旧 key 迁移完毕（读旧写新；删除旧 key 的代码保留一个版本）。
- 数据迁移 PR 与删除旧 key 的 PR 必须分开；迁移 PR 单独发布并观察一个版本。
- 每个 PR 记录：文件集合、依赖、验收命令、回滚方式；文件集合尽量不相交。

---

## 5. 优化路线图（阶段与任务）

> 估算行数为"变更行数（含测试）"经验值，属 [推断]；测试文件不计入 400 行/PR 限制（PROCESS.md 规则）。每阶段结束必须通过"阶段出口"才能进入下一阶段。S1/S2/S3 内部可并行，但写文件集合必须不相交。

### S0 止血与基线（1-2 天，7 项）

**目标**：让后续所有工作有可复现基线、真实 CI 和可信文档；桌面发布不再发旧前端。

| ID | 任务 | 主要文件 | 预估行 | 依赖 | 风险 | 验收 |
|---|---|---|---:|---|---|---|
| S0-1 | 处理 55 项未提交手势改动：commit checkpoint 或拆 PR 合并到 master；在干净树复测基线 | 无代码（git 操作由授权人执行） | — | 无 | 高（17.3k 行） | git status 干净或只剩预期项；记录基线 commit |
| S0-2 | CI 复活：触发分支改 master；加 tsc、lint --max-warnings=0、vitest run、build；concurrency/timeout/cache | .github/workflows/（ci.yml） | ~120 | S0-1 | 低 | PR required checks 绿；push master 触发 |
| S0-3 | 构建产物与端口明确化：build:static 或"桌面发布暂冻结 + 构建脚本 fail-fast 检查 out 新鲜度"；端口统一 3025（start/Docker/compose/clean-port） | package.json、scripts/、Dockerfile、docker-compose.yml | ~80 | 无 | 中 | 构建脚本在 out 缺失/过期时非 0；npm start 3025 返回 200 |
| S0-4 | 文档事实修正：ARCHITECTURE（60 stores/真实链路/构建模式/coordinator 死层）、AGENTS（lint/44/CI/no-verify）、ROADMAP、PR 模板、phase1 计划 superseded | AGENTS.md、docs/nbl/*、INDEX.md、模板 | 文档不计 | 无 | 低 | 文档数字与 S0-6 校验脚本一致 |
| S0-5 | 死层标记与仓库卫生：coordinator 标 deprecated + 禁止 import；确认后删 VisualizationView.tsx.fix / page.tsx.v7；worktree GC 脚本；根目录垃圾清理 | coordinator、scripts/、根目录 | ~80 | S0-1 | 中（V7 禁令） | coordinator 仍 0 引用；worktree ≤5；根文件 ≤20 |
| S0-6 | 测量基座 v1：scripts/perf/bundle-budget.mjs（rootMain/gzip/路由/CSS）；scripts/report-store-stats.mjs（整店订阅/依赖边）；perf/measure.py 固化（复用 scratch/perf）；播放阶段 mark（dev-only）；check-docs-facts.mjs | scripts/、perf/、src/lib/perf/（dev-only） | ~350 | 无 | 低 | 一条命令输出 baseline JSON；字段与 BASELINE.md 兼容 |
| S0-7 | ADR 集与决策：V8 去留、桌面运行时、DSP 去留、备份范围、主题 owner、质量档位最低配置（见第 8 节） | docs/nbl/adr/000x-*.md | 文档不计 | 无 | 低 | 8 个 ADR 通过评审；默认值可执行 |

**出口**：CI 在 master 全绿；基线 JSON 入库；文档事实校验通过；out/ 陈旧导致发布被阻断；55 项脏改已处理；ADR 已定。
**回滚**：只回滚脚本/CI/文档/标记，不涉及产品逻辑。

### S1 数据与播放正确性（1.5-2 周，10 个 PR，约 2,800 行 + 测试）

**目标**：把用户可感知的数据丢失、播错歌、本地音源不可播、监听丢失、设备切换不恢复全部修掉。

| ID | 任务 | 主要文件 | 预估行 | 依赖 | 风险 | 验收 |
|---|---|---|---:|---|---|---|
| S1-1 | storageRegistry v1：44 个 key 的 owner/version/group/backup；registry 与代码一致性测试 | 新 src/lib/storage/storageRegistry.ts、测试 | ~250 | S0-6 | 低 | 44/44 注册；测试断言 key 集合一致 |
| S1-2 | 备份/恢复修复：从 registry 收集槽位；移除/标注不存在的槽位；恢复后 rehydrate + 提示/刷新；清理 backup-data-* 泄漏；v5 schema + migrate | backupRestoreStore.ts、BackupRestorePanel.tsx、测试 | ~350 | S1-1 | 中 | 备份→恢复→重载闭环通过；includedStores 与实际 key 一致 |
| S1-3 | 启动压缩与配额策略修复：不再把有效队列 200→50/历史 30→20；配额失败保留旧快照；统一三套策略；降级必须可见 | safeStorage.ts、queueStore.ts、recommendationStore.ts、statsAchievementsStore.ts | ~300 | S1-1 | 中 | 51/200 项、20/30 条历史、索引末端、QuotaExceeded 均有明确结果；不静默清空 |
| S1-4 | VibeMusicDB 统一 open/version（v3）：一个模块管理 upgrade；localMusicService/localMusicStorage 复用；错误三分类 | 新 src/lib/storage/vibeMusicDb.ts、两个 service | ~250 | S0-6 | 中（数据迁移） | v1→v3 升级测试；local:// 导入后可播 |
| S1-5 | 队列唯一权威：queueStore 拥有 queue/index/history；audioStore 队列字段先标 deprecated 再改只读投影；QueueNavigator 接管 next/prev/队列结束 | audioStore.ts、queueStore.ts、src/lib/playback/queueNavigator.ts、bootstrap.ts | ~350 | S1-3 | 中高 | 删/排/清后 next/ended 与面板一致；SCC 进入消除轨道 |
| S1-6 | PlaybackMediaBridge 单例：12 个媒体事件唯一订阅者；幂等 attach/detach；进度节流；hook 只订阅快照 | 新 src/lib/playback/mediaBridge.ts、useAudioPlayer.ts | ~350 | S0-6 | 中高 | 多实例交错挂载/卸载后 ended/timeupdate 仍触发（集成测试） |
| S1-7 | AudioContextWatchdog 懒 attach + detach：context 创建回调、幂等 start、完整移除监听 | AudioContextWatchdog.ts、AudioEngine.ts | ~180 | S1-6 | 低 | 单测：start 在 context 前 → 创建后已挂载；stop 后无监听 |
| S1-8 | PlaybackRequestCoordinator + AbortSignal 贯穿 resolver/cache/prefetch；finally 中止旧 token | 新 requestCoordinator.ts、MultiSourceResolver.ts、audioSource.ts、useNetworkAudioCache.ts | ~350 | S1-6 | 高（核心链路） | 连点 5 首仅 1 个 in-flight；旧 promise 不写 store |
| S1-9 | 首声并行化：离线/本地/缓存三查 Promise.any；resolver 兜底并发启动；歌词/封面在起播后补 | sourceResolver.ts、useAudioPlayer.ts | ~250 | S1-8 | 中 | 缓存命中 firstSound P50 <300ms、P95 <800ms；冷启动 P95 <2.5s |
| S1-10 | 正确性集成测试：队列编辑→结束；本地导入→刷新→播放；备份往返；多实例面板；设备切换 mock | src/test/、store/audio 测试 | 测试不计 | S1-2..S1-9 | 低 | 上述场景全部自动化；无回归 |

**出口**：播放正确性 P0 全部有回归测试；数据 P0 全部闭环；桌面离线/本地路径可验证。
**回滚**：每 PR 独立 revert；S1-2/S1-4 的数据迁移与删除旧 key 分开发布。

### S2 音频图与持久化性能（1 周，6 个 PR，约 1,500 行）

| ID | 任务 | 主要文件 | 预估行 | 依赖 | 风险 | 验收 |
|---|---|---|---:|---|---|---|
| S2-1 | 单入口混音：analyser→destination 只由效果链独占（无效果时直连）；切效果先 disconnect 再 connect；音量只由 masterGain 控制（元素 volume 固定 1） | AudioEngine.ts、AudioEffectsManager.ts、useAudioPlayer.ts:986-1005,1758-1764 | ~350 | S1-6 | 中（听感） | destination 入边=1；效果强度 A/B 通过；volume=0.5 输出 -6dB（实测） |
| S2-2 | 效果参数增量更新：intensity 走 setTargetAtTime；滑杆 rAF 合并；仅结构参数重建链 | AudioEffectsManager.ts:620-628、AudioEffectsPanel.tsx:378 | ~250 | S2-1 | 中 | 拖动 100 次 connect=0；无爆音/长任务 |
| S2-3 | AnalyserHub：一份 FFT 多消费者；预分配缓冲；不再改写全局 fftSize | 新 src/lib/audio/analyserHub.ts、useVisualizationV8.ts、AudioVisualizerManager.ts | ~250 | S2-1 | 低中 | fftSize 稳定；每帧 0 分配；GC 锯齿消失 |
| S2-4 | 播放写盘降频：移除 currentTime 等高频字段的 partialize；5s 检查点 + pause/seek/切歌/visibility/pagehide 补写 | playerStore.ts、audioStore.ts、useAudioPlayer.ts:412-430 | ~250 | S1-5 | 中（恢复精度） | 播放期写盘 ≤1 次/秒；刷新恢复误差 ≤5s（可配） |
| S2-5 | 图与集合生命周期：AudioEngine.dispose/sourceNodes 删除；watchdog 心跳；rescue/failed/cache Map 上界 + LRU | AudioEngine.ts、useAudioPlayer.ts:63-70、useNetworkAudioCache.ts、MultiSourceResolver.ts | ~250 | S1-7 | 低 | 100 次切歌 activeNodes 增量 0；2h soak 不增长 |
| S2-6 | 性能验证与沉淀：firstSound/persistWrites/activeNodes 指标报告、soak 脚本、before/after 证据 | scripts/、perf/、文档 | ~150 | S1/S2 | 低 | 指标达成且可重复；报告入计划 |

**出口**：音频正确性与听感回归通过；写盘与节点指标达标；效果拖动无爆音。
**回滚**：S2-1 与 S2-4 各独立 PR；出现听感/恢复问题时先回滚对应 PR。

### S3 应用外壳与订阅治理（1-1.5 周，10 个 PR，约 2,000 行）

| ID | 任务 | 主要文件 | 预估行 | 依赖 | 风险 | 验收 |
|---|---|---|---:|---|---|---|
| S3-1 | 页级 selector 化 + CssVarsStyle（CSS 变量用 effect 写，不重建样式表） | page.tsx:78-79,98-119、新组件 | ~150 | S0-2 | 低 | page 整店订阅 2→0；调节 blur 不重写 style |
| S3-2 | 全局壳 selector：HomeView/PlayerView/HeaderToolbar/Apple3DQueueDrawer/useDynamicTheme | 上述 5 文件 | ~250 | S0-1 | 中（保护视图授权 D7） | 这 5 文件整店订阅→0；行为与截图一致 |
| S3-3 | VisualizationView selector + 进度下沉 + getCanvasStyle memo | VisualizationView.tsx:84-98,593-635,820-827 | ~200 | S3-1 | 中 | 播放时 viz 顶层 commit 降 ≥80%；视觉行为不变 |
| S3-4 | Player3D currentView 门控（含切回重启） | Player3D.tsx:357-419 | ~60 | 无 | 低 | Home 页 60s Player3D rAF=0 |
| S3-5 | 浮动层 gating：IntersectionObserver + 播放态 + 可见性；hidden 改条件停帧 | Floating 系、GlobalClientComponents.tsx:56-58 | ~200 | S3-4 | 中（观感） | idle rAF ≥3→≤1；进出可视化无劣化 |
| S3-6 | LazyPanel keepAlive LRU(2)+deactivate；Shelf3D/EQ/可视化设置 opt-in always；5 个重面板停 timer | LazyPanel.tsx、PanelOrchestrator.tsx、5 面板 | ~300 | S3-1 | 中（重开成本） | 开 20 关 18 → DOM 回收 ≥80%；关闭面板 5min CPU idle <5% |
| S3-7 | 重复宿主清理：toast/SourceManagementModal 各保留一个全局宿主 | GlobalClientComponents.tsx:65、PanelOrchestrator.tsx:473、page.tsx:144-147 | ~80 | S3-1 | 低 | 组合测试断言实例数=1；无重复同步请求 |
| S3-8 | playlistStore 29 个整店订阅清零（分 2 PR：全局壳/数据管理） | 29 文件、新 selectors/playlistSelectors.ts | ~400 | S3-1 | 中 | playlistStore whole=0；搜索输入 commit 数下降 |
| S3-9 | 预取策略：PanelOrchestrator 2s/5s 两波改为 idle/intent 预取；移除 bootstrap 后立即预取 3 个重 chunk | PanelOrchestrator.tsx:151-172、page.tsx:89-91 | ~120 | S0-6 | 低 | 首屏后 5s 内动态 import ≤3；LCP 不退化 |
| S3-10 | 剩余 Top-20 整店订阅与 audioStore 7 处整店订阅清零 | Top-20 文件 | ~250 | S3-2 | 低中 | 组件层整店订阅=0（全仓 ≤10） |

**出口**：toast/面板操作不再重渲染整页；常驻视图不再被无关状态驱动；空闲循环 ≤1；面板可回收；列表输入顺畅。
**回滚**：S3-6/S3-8 各独立 PR；如出现面板行为回归，先回滚该面板的 keepAlive 配置而非整波。

---

### S4 包体与加载（1 周，7 个 PR，约 1,200 行）

| ID | 任务 | 主要文件 | 预估行 | 依赖 | 风险 | 验收 |
|---|---|---|---:|---|---|---|
| S4-1 | jsmediatags 动态化（函数内 await import），调用方 async 适配 | services/audioMetadata.ts:3、utils/localMusicImport.ts:5 | ~80 | S0-6 | 中（调用方） | rootMain 中 jsmediatags 标记消失；导入功能回归 |
| S4-2 | crypto-js 动态化或 WebCrypto 替换（LX 源执行时加载） | lib/sources/lxRunner.ts:1 | ~100 | S4-1 | 中（加密兼容） | 首屏 -84KB raw；LX 源功能回归 |
| S4-3 | splitChunks 收敛为 4 个语义块（framework/react-vendor/ui-vendor/audio-vendor）+ 字体加载从 CSS @import 迁到 link（非删除 preconnect；globals.css:1 真实加载 5 个字体族） | next.config.js:27-80、layout.tsx:22-23 | ~80 | S0-6 | 中（缓存失效一次） | 首屏 script 23→≤12；vendor 碎片 ≤6 |
| S4-4 | CoverImage 统一图片组件，先接 3 个高频文件（Home/Queue/Search） | 新组件 + 3 文件 | ~150 | 无 | 低 | 裸 img 逐步归零（白名单除外）；封面不闪烁 |
| S4-5 | VirtualList 接入 QueuePanel（顺带修 3 处整店订阅） | QueuePanel.tsx | ~250 | S3-6 | 中（滚动/键盘） | 500 项队列打开长任务=0；滚动 60fps |
| S4-6 | VirtualList 接入 SearchPanel + Crossfade/BatchEditor | 3 文件 | ~300 | S4-5 | 中 | 500 条结果首帧 <50ms |
| S4-7 | V8 处置执行（依赖 D1 决策）：删除 visualization-v8/**、仅 V8 使用的 lib/three/types/store；若选 C，先把 EffectPlugin/RenderEngineManager 契约复制进 runtime/，并重定向 5 处 store 引用（导航岛/AI/performanceV8Store） | 整目录 + lib/visualization、lib/three | 删除不计（净 -12k 行） | S0-7、S5-4 前置契约 | 中（误删） | rg visualization-v8=0；tsc/vitest 绿；视觉行为不变 |

**出口**：rootMain gzip ≤190KB（S4-1/2/3 后）；First Load / ≤1,800KB raw；首屏 script ≤12；V8 按决策处置；至少 2 个高频列表虚拟化。
**回滚**：splitChunks 改回即恢复；动态 import 保留失败降级；V8 删除可 revert（纯文件恢复）。

### S5 渲染运行时与可视化契约（1.5-2 周，7 个 PR，约 1,800 行）

| ID | 任务 | 主要文件 | 预估行 | 依赖 | 风险 | 验收 |
|---|---|---|---:|---|---|---|
| S5-1 | VisualRuntime v1：单 rAF、优先级桶、统一门控/DPR/降级、measure 钩子 | 新 src/runtime/visualRuntime.ts、测试 | ~200 | S0-6、S3-4/5 | 中（新抽象） | 3 订阅者只产生 1 个 rAF；pause/resume 单测 |
| S5-2 | VisualizationView 调度迁入 runtime（绘制代码不动） | VisualizationView.tsx:267-578 | ~200 | S5-1 | 高（核心视图授权 D7） | draw p95 劣化 ≤10%、dropped=0；14 效果逐个截图 |
| S5-3 | Shelf3D + 浮动层迁入 runtime | Shelf3DView.tsx:1452-1466 等 | ~250 | S5-1 | 中 | 同时开 3D 架+可视化 FPS ≥50 |
| S5-4 | EffectPlugin + registry；先迁移 spatialMesh + nebulaField（2 PR） | 新 runtime/effectRegistry.ts、2 效果、中心 switch | ~400 | S5-2 | 中高 | 2 效果同一 contract；截图/帧时间对比通过 |
| S5-5 | initParticles 对象复用；EffectContext 稳定引用（不每帧 new） | VisualizationView.tsx:294-306,408-437 | ~120 | S5-4 | 低 | 连续 resize 100 次无 GC 抖动 |
| S5-6 | qualityTier + longtask 自降档（最低配置见 D5） | 新 runtime/qualityTier.ts、runtime | ~150 | S5-1 | 中 | 4x CPU throttle 自动降档；无 >200ms 长任务 |
| S5-7 | 3 个最重效果的每帧分配审计与修复（CinematicLyricDrift/Handwritten/OrientalLandscape） | 3 效果文件 | ~300 | S5-4 | 中 | Allocation Instrumentation：稳态 0 新增长期对象 |

**出口**：全仓 rAF 调用点 ≤8（白名单：runtime/PlaybackClock/拖拽）；1080p dpr2 可视化 ≥90fps 且无 dropped；隐藏视图零绘制；质量档可用。
**回滚**：runtime 有 feature flag（RUNTIME_V2=off）双跑一版；每个效果迁移独立 revert。

### S6 状态架构收敛（2-3 周，12 个 PR，约 4,000 行）

| ID | 任务 | 主要文件 | 预估行 | 依赖 | 风险 | 验收 |
|---|---|---|---:|---|---|---|
| S6-1 | selector 门禁：ESLint 规则（warn→error）+ codemod（整店解构→原子 selector）+ CI 快照 | scripts/codemod-store-selectors.mjs、eslint | ~250 | S3 | 低 | 新增整店订阅=CI error；whole≤10（白名单） |
| S6-2 | 持久化基础设施：44/44 registry + envelope + hydrateStores + 版本策略 + 体积预算（2 PR） | storageRegistry.ts、bootstrapStores.ts、44 store 配置 | ~400×2 | S1-1、S2-4 | 中高 | 44/44 注册；hydration 顺序测试；升级 fixture 通过 |
| S6-3 | audioStore/playerStore 去重：停止双 persist；删除双向同步；保留单向只读投影；迁移旧 key | audioStore.ts、playerStore.ts、bootstrap.ts、测试 | ~300 | S2-4 | 中高 | 播放写盘 ≤1/s；两 store 写路径唯一；旧 JSON 可迁移 |
| S6-4 | audioStore 播放字段消费迁移（3 PR，按全局壳/播放器/面板分批） | 80+ 文件 | ~400×3 | S6-3 | 中高 | audioStore 播放字段引用=0；行为回归通过 |
| S6-5 | 队列/EQ 副本删除：audioStore.queue/currentIndex/EQ 移除；audioStore↔playlistStore SCC 消除 | audioStore.ts、queueStore.ts、eqStore.ts | ~300 | S1-5、S6-3 | 中 | 队列/EQ 单一 owner；store 运行时边 0 环 |
| S6-6 | UI 域拆分：uiShellStore/panelStore/toastStore（+themeStore 按 D6）；uiStore 兼容 facade | uiStore.ts、新 store、消费文件 | ~400 | S3 | 中高 | 每类事实 owner=1；page/壳不再整店订阅 |
| S6-7 | 主题单一来源 + CSS 变量；删除重复主题字段/双写 | 新 themeStore、visualSettingsStore.ts、layout.tsx、useDynamicTheme.ts | ~300 | S6-6 | 中 | 切歌/切换主题不闪；主题来源唯一 |
| S6-8 | 全屏/toast/性能档去重：3 个 isFullscreen→1 个枚举；成就 toast 合并 variant；两套性能档合并 | uiStore.ts、visualizationStore.ts、performanceV8Store.ts、AchievementToast.tsx | ~250 | S6-6 | 中 | 每类事实 owner=1；持久化 key 减少 |
| S6-9 | 用例层：src/domain/playback|queue|library + 类型化事件；服务层 port 化；旧 coordinator 退场 | 新 src/domain/、lib/events/、服务调用点 | ~400 | S6-4/5 | 中高 | store 间运行时 import ≤6 且 type-only；服务层 getState=0 |
| S6-10 | 剩余分层穿透：组件/service/lib 的 getState 写状态收敛到 hooks/actions | 78 文件分批 | ~300 | S6-9 | 中 | 组件 getState=0；service=0 |
| S6-11 | store contract 测试矩阵：44 key 持久化、21 边、播放一致性、hydration | 新 contract 测试 | 测试不计 | S6-2/3 | 低 | 覆盖全部 owner 与 key |
| S6-12 | 文件行数棘轮 + depcruise 边界门禁 | scripts/、.dependency-cruiser.cjs、CI | ~200 | S0-2 | 中 | 新增文件 ≤400；存量只减不增；0 循环 |

> **执行计划修订（2026-10-21）**：拆出 S6-9a（domain 骨架 + playSong 用例）前置到 S6-5 之前；否则 audioStore→playlistStore SCC 无法消除（audioStore.ts:6,529-540）。详见 [S6 执行计划](./2026-10-21-arch-perf-execution/S6-state-architecture.md)。

**出口**：整店订阅=0（组件层）；store 运行时 import ≤6 且无环；44/44 key 有 version/migrate；整店持久化 0；audioStore <400 行；语义重复事实 11 组→0。
**回滚**：S6-3/S6-6 涉及迁移，迁移 PR 与删除旧路径 PR 分开；每 PR 独立 revert，旧 key 保留一个版本。

### S7 服务与平台边界（2 周，9 个 PR，约 2,800 行）

| ID | 任务 | 主要文件 | 预估行 | 依赖 | 风险 | 验收 |
|---|---|---|---:|---|---|---|
| S7-1 | Resolver 插件化 + 统一 request 包装（超时/取消/熔断）；接入 EndpointCircuitBreaker（2 PR） | MultiSourceResolver.ts → services/resolver/*、circuit breaker | ~800 | S1-8 | 中高 | 每模块 ≤300 行；坏 host 请求数下降；熔断单测 |
| S7-2 | 缓存统一：resolvedUrl/search/prefetch LRU+TTL；与 network cache/BlobUrlRegistry 对齐 | 3-4 服务 | ~250 | S7-1 | 中 | 缓存命中率指标；内存不随会话线性增长 |
| S7-3 | Worker transferable + 降级：4 个 worker + WorkerPoolManager | src/workers/*.ts、WorkerPoolManager.ts | ~250 | S0-6 | 低中 | 50MB 转换主线程长任务 <50ms；worker 不可用有明确降级 |
| S7-4 | Electron 本地 Next 运行时（D2）：standalone 构建、loopback 服务、app:// 协议桥接、启动/退出/健康检查、产物校验 | electron/main/index.js、scripts/、package.json | ~400 | S0-3 | 高 | 打包 --dir 冷启动窗口 <3s；/、/data-manager 200；旧 origin 数据可见 |
| S7-5 | BackendGateway + preload baseUrl + 能力协商：resolver/API 调用统一 resolveApiUrl(path) | 新 src/lib/api/backendGateway.ts、preload、resolver/cache 调用点 | ~350 | S7-4 | 中高 | 浏览器/Electron 分支单测；在线能力可用或有明确降级 UI |
| S7-6 | 后端异步启动 + 状态事件 + 离线 UI；不阻塞窗口 | electron/main/index.js:370-379、preload、renderer | ~250 | S7-5 | 中 | 后端故障时冷启动 <3s 可见窗口；状态可观察 |
| S7-7 | 插件 utilityProcess 沙箱 + 权限确认 + 白名单 | pluginManager.js、新 pluginHost.js、preload | ~400 | S7-5 | 中高 | 恶意 fixture 插件无法读文件/执行命令 |
| S7-8 | 敏感凭据：平台 cookie 迁移 Electron safeStorage；Web 明确"仅本地"提示 | userAccountStore.ts、Electron bridge | ~200 | S7-5 | 中 | cookie 不再明文（桌面）；兼容旧数据读取 |
| S7-9 | OPFS/大文件 spike + 2h soak + 泄漏上界收尾 | 新 src/lib/storage/opfsAudioStore.ts（spike）、soak 脚本 | ~250 | S2-5 | 中 | 50MB FLAC 起播长任务 <100ms（或记录未达标原因）；2h heap 增长 <30MB |

**出口**：桌面端发布链路闭环（产物、API、后端、插件、凭据）；长会话指标达标；大文件起播有结论。
**回滚**：S7-4/S7-5 各阶段可用开关回退到浏览器模式；插件沙箱与凭据迁移独立 revert。

### S8 门禁与长期治理（持续）

| ID | 任务 | 验收 |
|---|---|---|
| S8-1 | CI 完整门禁：tsc/lint/test/build/coverage 分域/bundle budget/depcruise/docs-facts/文件行数 | PR required checks ≤12min；超阈值 fail |
| S8-2 | 覆盖率阶梯：audio 60/55/65/60、store 65/60/70/65、services/hooks 55+；先按现状-5pp 锁定 | npm run verify:coverage 域级达标 |
| S8-3 | 性能回归套件：bundle diff 每 PR；measure.py nightly；2h soak 每周；指标看板 | 连续 4 周无回归；报告可查 |
| S8-4 | 文档事实流水线：数字由脚本生成；季度对账；plan/INDEX 归档 | check-docs-facts exit 0 |
| S8-5 | 发布检查清单：Changelog、版本、V7 禁令、数据兼容、Electron 冒烟 | 每次发版执行 |
| S8-6 | 长期 backlog：features 目录领域化、14 个 V7 效果全部插件化、4K/低端场景、Playwright E2E、OPFS 落地 | 每季度评审 |

### 5.9 阶段依赖与并行矩阵

    S0 ──┬─> S1 ──> S2 ──┬─> S3 ──> S4 ──> S5
         │               │
         ├─> S0-7/D1 ────┴─> S4-7（V8 处置，需先复制契约）
         └─> S6-1（selector 门禁，可在 S3 后启动）
    S1/S2/S3 内部可并行（文件集合不相交）；S6 与 S5 可并行（S6 不碰渲染文件）
    S7 依赖 S2/S3 完成度；S8 随 S0 起持续

| 阶段 | 单人估算 | 2-3 人并行 | 可并行项 |
|---|---:|---:|---|
| S0 | 1-2 天 | 1 天 | 全部（S0-1 需人工） |
| S1 | 8-10 天 | 4-5 天 | S1-1/3/4 与 S1-5..9 可并行（数据 vs 播放） |
| S2 | 4-5 天 | 2-3 天 | S2-1/2/3 串行；S2-4/5/6 可并行 |
| S3 | 5-7 天 | 3 天 | 壳层/可视化/面板/虚拟化分轨 |
| S4 | 4-5 天 | 2-3 天 | 包体、图片、列表、V8 分轨 |
| S5 | 7-9 天 | 4 天 | runtime 先串行，效果迁移可并行 |
| S6 | 10-15 天 | 5-7 天 | 按域分轨（audio/ui/persist/contract） |
| S7 | 8-10 天 | 4-5 天 | resolver/worker/electron 分轨 |
| **合计** | **10-12 周** | **5-6 周** | 关键路径 S0→S1→S2→S3→S4→S5 |

---

## 6. 质量门禁与性能预算

### 6.1 门禁分层

| 层 | 时机 | 内容 | 目标耗时 | 失败后果 |
|---|---|---|---|---|
| L0 本地 pre-commit | commit | lint-staged：改动文件 eslint --fix + prettier；大提交可选 tsc | <20s | 阻止提交 |
| L0.5 本地 pre-push | push | verify:fast = tsc + eslint src + 受影响域 vitest | <3min | 阻止 push（可选） |
| L1 PR required | PR | tsc + eslint src --max-warnings=0 + vitest run（分片）+ build + 覆盖率域阈值 + 包体预算 + depcruise + docs-facts | <12min | 阻止合并（branch protection） |
| L2 nightly | schedule | 全量 vitest + 全域覆盖率 + Electron 打包冒烟 + backend pytest + 依赖/体积 | <45min | 告警建 issue |
| L3 release | tag | L1 全部 + build:electron 双产物 + SHA256 + 安装包冒烟 + 性能报告 | <60min | 阻止发版 |

统一脚本（S0-6/S8-1 落地）：

    verify:type      tsc --noEmit --incremental false --pretty false
    verify:lint      eslint src --max-warnings=0 --report-unused-disable-directives
    verify:test      vitest run --reporter=dot
    verify:coverage  vitest run --coverage
    verify:build     next build --webpack
    verify:budget    node scripts/check-bundle-budget.mjs
    verify:docs      node scripts/check-docs-facts.mjs
    verify:boundaries depcruise --config .dependency-cruiser.cjs src
    verify:fast      verify:type + verify:lint + verify:test
    verify:ci        verify:type + verify:lint + verify:test + verify:coverage + verify:build + verify:budget + verify:docs + verify:boundaries

CI 拓扑（S0-2 最小版 → S8-1 完整版）：

- 触发：push/PR 到 master（当前 deploy.yml 的 main 是无效分支，必须改）。
- verify job：Node 24（或 20/24 matrix）、npm ci、缓存 .next/cache 与 tsconfig.tsbuildinfo、按顺序跑 verify:*；测试可分 2 片。
- desktop-nightly：windows-latest，build:static + electron-builder --dir + 启动冒烟 + 断言产物新鲜度；失败告警。
- backend-nightly：python 3.11，pip install -r backend/requirements-minimal.txt && pytest backend（先 report-only）。

### 6.2 性能预算（整合审计 B/D 的实测与目标）

| 指标 | 现状 | 阶段目标 | 硬阈值（CI fail） | 测量方式 |
|---|---:|---:|---:|---|
| rootMainFiles raw / gzip | 969.3 / 296.8 KB | ≤650 / ≤190 KB | >800 / >230 KB | build-manifest 求和 + zlib |
| 首屏 script 请求数 | 23 | ≤12 | >16 | rootMainFiles.length |
| First Load /（raw） | 1,996.7 KB | ≤1,700 KB | >2,000 KB | 解析 .next/server/app/index.html 引用求和 |
| First Load /_not-found（raw） | 1,524.7 KB | ≤1,200 KB | >1,500 KB | 同上 |
| 全局 CSS raw | 227.4 KB | ≤210 KB | >230 KB | .next/static/css 求和 |
| 单 async chunk raw | three 333.5 / fabric 275 KB | ≤350 KB | >400 KB | chunks 目录遍历 |
| 初始静态闭包模块数 | 150 | ≤110 | >140 | scripts/perf/import-graph |
| 首屏后 5s 动态 import 数 | 12（预取 9 + page 3） | ≤3 | >6 | PerformanceObserver resource |
| idle rAF 循环数（Home 未播放） | ≥3 [推断] | ≤1 | >1 | CDP Tracing / 注入计数 |
| 视图切换 to-first-frame | 未测 | ≤100ms | >160ms | performance.mark/measure |
| 可视化 FPS（1080p dpr2） | 165Hz 屏实测 164fps（单效果基线） | ≥90fps 无 dropped | <55fps 持续 2s | 复用 scratch/perf/measure.py |
| 长任务（>50ms）/10s | 未测 | ≤2 | >5 | PerformanceObserver(longtask) |
| INP p75（桌面 Electron） | 未测 | ≤200ms | >300ms | web-vitals 本地日志 |
| LCP（Electron 本地） | 未测 | ≤1.8s | >2.5s | PerformanceObserver |
| 播放写盘 | ~8 次/秒 | ≤1 次/秒 | >2 次/秒 | patch Storage.setItem |
| firstSound（缓存命中） | 未测（串行路径 >5s 最坏） | P50 <300ms / P95 <800ms | P95 >1.5s | performance.mark: intent→playing |
| firstSound（冷启动） | 未测 | P95 <2.5s | >4s | 同上 |
| 30min 会话 heap 增长 | 未测 | ≤10% | >25% | CDP HeapProfiler |
| 2h soak heap 增长 | 未测 | <30MB | >60MB | 同上 |
| 面板关闭 DOM 回收 | 未测 | ≥80% | <50% | CDP DOM 计数 |
| activeAudioNodes（100 次切歌） | 未测 | 增量 0 | >5 | connect/disconnect 探针 |
| public 体积 | 58.4 MB | ≤40 MB | >45 MB | 目录统计 |
| dist-electron 安装包 | 264.7 MB | ≤200 MB | >300 MB | electron-builder 产物 |

> 预算选取依据：现状 rootMain gzip 中至少 81KB 是 jsmediatags+crypto-js（可移除），20 块 vendor 碎片可合并；≤190KB 是"移除漏网库 + 合并 vendor"后的合理落点 [推断]。所有阈值先用"现状不退化"锁定，再随 S4/S5 分批下调。

### 6.3 测量体系（三层）

| 层 | 手段 | 频率 | 产出 | 对应阶段 |
|---|---|---|---|---|
| A 构建期 | 读 .next：rootMain/路由/CSS/chunk；静态闭包；规则计数（整店订阅/rAF/img） | 每 PR（约 10s） | perf/build-report.json + 预算 diff | S0-6 |
| B 运行时合成 | Playwright + 本机 Chrome（channel=chrome，避免 SwiftShader 假数据）；rAF 帧间隔、draw 分位、LCP、longtask、heap | nightly + 每阶段验收 | perf/run-YYYYMMDD.json 与 baseline diff | S0-6/S8-3 |
| C 真实交互 | React Profiler（dev）+ PerformanceObserver(event/longtask) + CDP HeapProfiler；场景：启动→Home→Player→Viz→开 Queue→开 Search→输入→切歌→关面板→30min 挂机 | 每阶段验收 | 火焰图 + 指标表 | S0-6/S8-3 |

固定场景（写进 perf/scenarios.md）：
1. 冷/热启动：生产模式，空库与固定 1000 首元数据，各 5 次。
2. 日常播放：固定本地 3 曲，5 分钟；暂停、seek、倍速、切路由。
3. 队列与大曲库：1k/10k 元数据，200 项队列（含重复曲目）。
4. 手书与 WebGL：同一音源/歌词，1080p 与 4K，固定 DPR/画质，每场景 60s。
5. 多任务争用：MV+手势；波形/转换/AI 任务。
6. 生命周期：效果与路由各切 20 轮；后台 60s 返回。
7. 桌面：干净安装、首次启动、离线、关闭进程。

### 6.4 回归判定

1. 构建期硬门禁（每 PR）：6.2 表中"硬阈值"任一项超限 → fail。
2. nightly 软门禁：draw p95 劣化 >15%、dropped >0、FPS 中位降 >10%、LCP +30% → 建 issue。
3. 每阶段验收：C 层场景全跑，before/after 贴 PR（场景 / 指标 / before / after / 样本数）。
4. 代码规则计数（脚本进 lint）：白名单外出现 requestAnimationFrame → warning；新增整店订阅 → error；img 无 loading/decoding → warning。

---

## 7. 风险、回滚与兼容

### 7.1 风险登记（Top 12）

| # | 风险 | 影响 | 概率 | 缓解 |
|---|---|---|---|---|
| R1 | 55 项脏改在重构期间被污染/冲突 | 基线不可复现、代码丢失 | 高 | S0-1 先处理；所有实现从干净 worktree 开始；每 PR 记录 commit |
| R2 | 数据迁移导致用户设置/队列丢失 | 数据安全 | 中 | I1 不变量；version+migrate+旧 fixture；迁移 PR 单独发布；旧 key 保留一个版本 |
| R3 | 播放核心改造引入听感/时序回归 | 用户可感知 | 中高 | S1 先测试后改；feature flag；逐 PR 回滚；S2-1 人工 A/B |
| R4 | 受保护视图（Home/Player/歌词）改动被判违规 | 流程风险 | 中 | D7 明确"仅订阅方式等价改写"授权；改前截图，改后对比 |
| R5 | Electron 本地 Next 运行时与 Next 16/ASAR/路径/权限不兼容 | 桌面发布延期 | 中高 | S0-3 先冻结发布；S7-4 单独 spike；打包 --dir 冒烟；保留回退方案（静态导出+BackendGateway） |
| R6 | 包体预算过紧导致功能/体验回退 | 体验下降 | 中 | 阈值分阶段；优先移除死代码与漏网库，不激进 tree-shaking；每阶段复测 |
| R7 | 43 面板 LRU 卸载导致重开卡顿 | 体验下降 | 中 | keepAlive=always 白名单（Shelf3D/EQ/可视化设置）；重开 <300ms 目标 |
| R8 | VisualRuntime 抽象影响可视化观感 | 体验下降 | 中 | 先只改调度不改绘制；RUNTIME_V2=off 双跑；14 效果逐个截图 |
| R9 | 状态拆分与组件迁移量大（100+ 文件） | 工期超支 | 高 | strangler 分域分批；兼容 facade；每批 ≤400 行；先 selector 后结构 |
| R10 | CI 首次运行暴露大量既有问题 | 阻塞合并 | 中 | S0-2 先只加非阻塞 report job，再逐项收紧为 required |
| R11 | 第三方解析源/平台 cookie 的合规与稳定性 | 法律/安全 | 中 | D8 产品决策；源配置与内置源分离；凭据加密；UI 提示 |
| R12 | 后端 12 模型能力名不副实 | 产品预期错位 | 高 | 文档明确"当前仅 health/capabilities 桩"；AI 能力另立计划 |

### 7.2 回滚策略

| 阶段 | 回滚方式 | 成本 |
|---|---|---|
| S0 | revert 脚本/CI/文档 | 零 |
| S1 | 每 PR 独立 revert；数据迁移回滚代码保留旧 key 读取 | 低-中 |
| S2 | S2-1（听感）与 S2-4（持久化）分开 revert | 中 |
| S3 | 面板 keepAlive 配置/订阅改动逐文件 revert | 低 |
| S4 | splitChunks 改回；动态 import 保留 fallback；V8 删除可恢复文件 | 低 |
| S5 | RUNTIME_V2=off 开关；效果迁移独立 revert | 中 |
| S6 | 迁移 PR 与删除 PR 分离；兼容 facade 保留一个版本 | 中高 |
| S7 | S7-4/S7-5 用开关回退浏览器模式；插件/凭据独立 revert | 中高 |

### 7.3 数据兼容管理

- 迁移必须同时满足：旧版本代码可读旧数据（前向兼容一个版本）、新版本可读旧数据、备份可导入旧 envelope。
- 每次持久化结构变更：registry version+1、migrate 函数、旧 JSON fixture 测试、Changelog 记录。
- 禁止在同一个 PR 里同时做"结构变更 + 删除旧 key"；删除旧 key 的 PR 必须在迁移发布一个版本后。
- IndexedDB：统一 open 模块先行；新增 object store 只增不删不改 keyPath；二进制迁移（OPFS）先 spike 再评审。

### 7.4 并行开发规则（Agent / 多人）

- 同一阶段内按"文件集合不相交"分轨：状态域（store/lib/storage）、渲染域（components/visualization/runtime）、播放域（lib/playback/audio/hooks）、平台域（electron/services/scripts）。
- 共享文件（package.json、next.config.js、eslint 配置、UI store、page.tsx）由单人串行修改，禁止并行。
- 每轨 PR 记录：write scope、依赖、验收命令、未覆盖项；Lead 合并前跑完整验证并复核 diff。
- 测试/文档变更不计 400 行限制，但不得与功能变更混在同一 PR（除测试与实现强耦合时）。

---

## 8. 需要拍板的决策（按阻塞程度排序）

| # | 决策 | 选项 | 推荐 | 影响 |
|---|---|---|---|---|
| D1 | V8 可视化（组件树 11,355 行零引用；store 仍有 5 处引用）如何处置 | A 直接删除；B 完成接线启用 V8；C 冻结 V8、先把 EffectPlugin/RenderEngineManager 契约移植到 V7，再删除实现 | **C**（并先重定向 5 处 store 引用：导航岛/AI 写入改为 V7，performanceV8Store 并入 qualityStore） | S4-7、S5-4；删除不减少首屏，只减少 tsc/vitest 与误读 |
| D2 | Windows 桌面运行时形态 | A 静态导出 out/ + 在线能力降级；B 捆绑本地 Next 运行时（前置已确认方向）；C 桌面仅本地播放器 | **B**（符合已确认决策；需 S7-4 专项验证 app:// origin 与 API 桥接） | S0-3、S7-4/5/6；决定桌面能否保留在线音乐 |
| D3 | DSPProcessor/AudioGraphManager（约 750 行，未接主链） | A 删除；B 接入播放链（需要产品确认压缩/混响需求） | **A**（先标 deprecated 一个版本，再随 S2 删除；若产品需要再接入） | S2-5/S6-9 |
| D4 | 备份范围 | A 仅设置+元数据（不含音频二进制）；B 含 IndexedDB 音频文件 | **A**（v5 默认；B 作为后续可选"完整导出"独立计划） | S1-2、S6-2 |
| D5 | 最低配置与质量档位 | low：4 核/8GB/1080p 集显；medium：8 核/16GB；high：独显 | low 档默认 DPR 1、粒子减半、关闭全屏 canvas filter；medium 档 DPR ≤1.5；high 保持现状 | S5-6 |
| D6 | 主题 owner | A 新建 themeStore；B uiStore 独占、visualSettings 只留视觉参数 | **A**（语义清晰；迁移约 ±150 行） | S6-6/S6-7 |
| D7 | 受保护视图是否允许"仅订阅方式"的等价改写 | A 允许（视为技术性无行为变化，需截图对比+Lead 复核）；B 完全禁止，只能通过 wrapper 间接优化 | **A**（否则 S3-2/S3-3 无法落地，页面重渲染问题保留） | S3-2/S3-3、S5-2 |
| D8 | 第三方解析源与平台登录 cookie 的产品边界 | A 明示"第三方源"并让用户确认；B 只保留官方/授权源；C 现状不改，仅加提示 | **A**（合规风险可控；凭据桌面加密，Web 明示仅本地） | S7-8、产品合规 |

> 未拍板项按推荐值执行；若 D1/D2/D7 与推荐不同，S4/S5/S7 的范围与预算需相应调整。

---

## 9. 验收清单

### 9.1 全局 Definition of Done（每个阶段）

- [ ] 该阶段所有 PR 合并前：eslint/tsc/vitest/build 全绿；新增测试覆盖关键分支；无新增整店订阅/无新增 rAF 调用点（白名单外）。
- [ ] 该阶段出口指标在固定场景下复测并记录 before/after；未达标项写明原因与后续任务。
- [ ] 数据兼容：旧 key/旧备份 fixture 测试通过；迁移 PR 单独发布。
- [ ] V7 保护界面（Home/Player/全屏歌词）行为与视觉对照通过（截图/人工）。
- [ ] 文档更新：ARCHITECTURE/ROADMAP/CHANGELOG/INDEX 对应阶段记录。
- [ ] 回滚方案已验证（至少一次本地 revert 演练或开关回退验证）。

### 9.2 正确性验收（S1 出口）

| 场景 | 期望 |
|---|---|
| 队列面板删除当前项/末项/清空 → 播放结束 | 与 queueStore 一致；不播已删除曲目；不越界 |
| 队列重排/插入 next → 下一首 | 按新顺序播放 |
| 本地导入 → 刷新 → 播放 | local:// 可播；无"文件不存在" |
| 备份 → 改设置 → 恢复 → 重载 | 10 个有效槽位全部恢复；不存在的槽位 UI 明确提示 |
| 队列 200 项/历史 30 条 + 刷新 | 不被启动压缩截断 |
| 开/关全屏歌词、可视化、面板后再播放 | 进度、ended、错误提示均正常 |
| 模拟设备切换/合盖恢复 | AudioContext 恢复，无需刷新 |
| 连点 5 首切歌 | 仅 1 个 in-flight 解析；最终播放最后一首 |

### 9.3 性能验收（S2/S3/S4/S5 出口）

- [ ] 播放写盘 ≤1 次/秒；播放 60s 内 localStorage 写入次数可复现统计。
- [ ] toast/面板操作不再触发 page 重渲染（Profiler commit 组件数下降 ≥80%）。
- [ ] idle rAF ≤1；隐藏视图不再绘制。
- [ ] rootMain gzip ≤190KB；首屏 script ≤12；First Load / ≤1,700KB（S4 后）。
- [ ] 1080p dpr2 可视化 ≥90fps 且无持续 dropped；4x CPU throttle 自动降档。
- [ ] 500 项队列/搜索结果打开无 >50ms 长任务；滚动 60fps。
- [ ] 30min 会话 heap 增长 ≤10%；2h soak <30MB。
- [ ] activeAudioNodes 100 次切歌增量 0；效果滑杆拖动 connect=0。

### 9.4 桌面验收（S7 出口）

- [ ] 打包产物包含新鲜前端产物（断言构建时间 > 构建开始时间）。
- [ ] 安装后冷启动：窗口可见 <3s（后端故障时也是）。
- [ ] / 与 /data-manager 返回 200；旧 origin 的 localStorage/IndexedDB 数据可见。
- [ ] 在线搜索/解析/歌词/封面/代理播放可用，或 UI 明确降级。
- [ ] 后端 async 启动、状态可观察、退出无残留子进程。
- [ ] 恶意插件 fixture 无法读文件/执行命令；用户授权流程可见。
- [ ] 旧数据（44 key + IDB）升级后可读；备份可导入。

### 9.5 质量门禁验收（S8 出口）

- [ ] PR 上 required checks 全绿且 ≤12min；push master 触发。
- [ ] 覆盖率分域阈值生效；PR 不得降低 >0.5pp。
- [ ] 包体预算脚本在 PR 上运行；超阈值 fail。
- [ ] depcruise 0 violations（例外清单显式）；文件行数棘轮生效。
- [ ] docs-facts 脚本 0 失败；过期数字/描述不再出现。
- [ ] nightly desktop/backend 报告可查；连续 4 周无回归。

### 9.6 最终交付格式

每个阶段完成时提交：
1. 变更文件/commit 列表与 PR 链接；
2. 验证命令、退出码、关键日志；
3. 指标 before/after（固定场景、样本数）；
4. 未执行项（真机/听感/摄像头/4K/打包）与原因；
5. 已知风险与下一阶段入口条件。

---

## 10. 附录

### 10.1 审计证据索引

| 审计 | 报告 | 关键内容 |
|---|---|---|
| A 状态层 | scratch/architecture-audit-2026-10-21/store-audit.md | 60 store 全量清单、21 条依赖边、44 persist key 表、整店订阅 Top20、13 波次 backlog |
| B 渲染 | scratch/architecture-audit-2026-10-21/render-perf-audit.md | V7/V8 双系统、43 处 rAF、包体实测、根因 R1-R6、目标渲染架构、预算 |
| C 音频/运行时 | scratch/architecture-audit-2026-10-21/runtime-audio-audit.md | 7 P0/10 P1、音频图/看门狗/媒体桥、服务/IDB/Electron、7 波次 backlog |
| D 构建/质量 | scratch/architecture-audit-2026-10-21/build-quality-audit.md | tsc/lint/test/build 实测、路由包体、覆盖率缺口、CI/端口/依赖、门禁提案 |
| 前置审计 | 分支 docs/architecture-performance-plan 的 docs/nbl/audits/2026-10-20-architecture-performance-audit.md 与 specs/2026-10-20-architecture-performance-design.md | 数据/备份/队列/桌面前置发现，6 轮决策（1-3 已确认） |

### 10.2 PR 规模总表

| 阶段 | 逻辑 PR（约） | 执行子 PR（≤400 行） | 变更行（约） | 说明 |
|---|---:|---:|---:|---|
| S0 | 7 | 10 | ~350 代码 + 文档 | CI/构建/文档/测量/ADR |
| S1 | 8-10 | 15 | ~2,700 + 测试 | 数据与播放正确性 |
| S2 | 6 | 6 | ~1,500 | 音频图/持久化性能 |
| S3 | 9-10 | 12 | ~2,000 | 订阅/rAF/面板 |
| S4 | 6-7 | 10 | ~1,100 | 包体/加载/列表/V8 |
| S5 | 7 | 17 | ~1,700 | 渲染运行时 |
| S6 | 12 | 28 | ~3,900 | 状态架构收敛 |
| S7 | 9-10 | 19 | ~4,300 | 服务/Electron（≤400 行硬约束导致上浮） |
| S8 | 持续 | ~12 | — | 门禁与长期治理 |
| **合计** | **约 60-65** | **约 129** | **约 17.5k 行** | 不含 V8 删除（净 -12k）与测试；同一任务子 PR 可在阶段收口时 squash |

> 口径说明：逻辑 PR 是任务级交付单位；执行子 PR 是实施时按 ≤400 行约束拆出的最小可合并单元（来源：9 份阶段执行计划）。S7 上浮因 ≤400 行硬约束与 Electron 运行时拆分，S7 开工时同步修订本表。

### 10.3 命令速查

    # 基线（S0-6 后）
    node scripts/report-store-stats.mjs
    node scripts/check-bundle-budget.mjs
    node scripts/check-docs-facts.mjs
    node scripts/perf/import-graph.mjs

    # 验证顺序（禁止并行 build 与 tsc；禁止 dev 存活时 clean .next）
    npx eslint src --max-warnings=99999
    npm run test -- --run
    npx tsc --noEmit --incremental false --pretty false
    npm run build
    node scripts/clean-port.js 3025
    npm run dev   # 或 npm start（3025，验证构建产物）

    # 冒烟
    # HTTP: http://127.0.0.1:3025/ 与 /data-manager 返回 200
    # Chrome CDP: 加载两路由，0 console error / 0 exception
    # 专项: 队列编辑→结束、本地导入→刷新→播放、备份→恢复→重载、设备切换

### 10.4 未覆盖与已知限制（诚实声明）

1. 本计划基于静态审计 + 构建期实测，未做运行时 Profiler；所有 FPS/INP/LCP/内存结论标注 [推断]，由 S0-6 测量基座补测。
2. 未执行 electron-builder/后端 PyInstaller/真机音频/摄像头验收；S7 需专项打包验证。
3. 55 项未提交手势改动的代码质量未审；其新增 layout 常驻组件与 timer/rAF 需在 S3 一并纳入门控。
4. aiAgentService/aiAgentTools（约 1,370 行）与 Python 后端实现未深审，建议单独立项。
5. Electron 是否自动打包 node_modules（pluginManager require axios/crypto-js）待 --dir 验证；若否，安装包启动即崩。
6. 音量是否双重衰减、效果干湿叠加的听感影响需真机 A/B；锁屏/合盖恢复需人工验证。
7. 4K/低功耗/移动场景未纳入本轮主场景（按前置决策以 Windows 1080p/60fps 为主）；S8 长期 backlog。
8. 本计划不包含代码修改；开始实施前需按 S0-1/S0-7 完成冻结与决策。
9. 执行计划编写复核修正：Google Fonts preconnect 并非死代码（globals.css:1 有 @import，真实加载 5 个字体族）；V8 组件树零引用但其 store 仍有 5 处引用（导航岛/AI/performanceV8Store）。详见执行计划包 00-decisions.md 的修订汇总。
10. S4 实测推算 rootMain gzip 距 190KB 目标约差 29KB，需 Q10 决策是否接受阶段性 ≤200KB。
11. S7 子 PR 数上浮至 19 个（总计划估 9 个），S7 开工时修订 §10.2 预算。
12. 执行期 23 项确认（Q01-Q23）见 [00-decisions.md](./2026-10-21-arch-perf-execution/00-decisions.md)；其中 Q01（脏改授权）、Q02（branch protection）、Q04（devDeps）、Q05（新增 key）、Q07（旧 key 删除窗口）、Q10（S4 预算缺口）是关键阻塞项。

### 10.5 变更记录

| 日期 | 版本 | 说明 |
|---|---|---|
| 2026-10-21 | v1.0 | 基于 4 份审计（A/B/C/D）与既有 2026-10-20 审计草案整合；完成基线与 8 阶段路线图；未开始实现 |
| 2026-10-21 | v1.1 | 新增 §11 执行计划包（9 份阶段计划 + TRACKING + 决策记录）；回写 S4/S6/S7 修订、V8/字体复核更正、PR 计数口径 |

---

## 11. 执行计划包（2026-10-21）

总计划的 74 个任务已拆成 9 份实现级执行计划，放在 [docs/nbl/plans/2026-10-21-arch-perf-execution/](./2026-10-21-arch-perf-execution/README.md)：

| 文件 | 内容 | 规模 |
|---|---|---|
| [README.md](./2026-10-21-arch-perf-execution/README.md) | 使用方式、角色/并行、排期（单人 10-12 周 / 2-3 人 5-6 周）、门禁、完成判定 | — |
| [S0-baseline.md](./2026-10-21-arch-perf-execution/S0-baseline.md) | 止血与基线（CI/构建/文档/测量/ADR） | 493 行 / 10 子 PR |
| [S1-data-playback.md](./2026-10-21-arch-perf-execution/S1-data-playback.md) | 数据与播放正确性 | 649 行 / 15 子 PR |
| [S2-audio-persistence.md](./2026-10-21-arch-perf-execution/S2-audio-persistence.md) | 音频图与持久化性能 | 409 行 / 6 PR |
| [S3-shell-subscriptions.md](./2026-10-21-arch-perf-execution/S3-shell-subscriptions.md) | 外壳与订阅治理 | 465 行 / 12 子 PR |
| [S4-bundle-loading.md](./2026-10-21-arch-perf-execution/S4-bundle-loading.md) | 包体与加载 | 443 行 / 10 子 PR |
| [S5-render-runtime.md](./2026-10-21-arch-perf-execution/S5-render-runtime.md) | 渲染运行时与效果契约 | 571 行 / 17 子 PR |
| [S6-state-architecture.md](./2026-10-21-arch-perf-execution/S6-state-architecture.md) | 状态架构收敛 | 481 行 / 28 子 PR |
| [S7-platform-runtime.md](./2026-10-21-arch-perf-execution/S7-platform-runtime.md) | 服务与平台边界 | 524 行 / 19 子 PR |
| [S8-quality-governance.md](./2026-10-21-arch-perf-execution/S8-quality-governance.md) | 质量门禁与长期治理 | 549 行 / 约 12 子 PR |
| [TRACKING.md](./2026-10-21-arch-perf-execution/TRACKING.md) | 74 任务进度看板、阶段出口门、阻塞登记 | 151 行 |
| [00-decisions.md](./2026-10-21-arch-perf-execution/00-decisions.md) | D1-D8 + Q01-Q23 执行期确认项 + 修订汇总 | — |

**使用方式**：从 S0 开始按 TRACKING 领取任务；每份阶段计划给出文件级步骤、测试用例、验证命令、验收指标与回滚。合计约 129 个执行子 PR（可 squash 为 60-65 个逻辑 PR）。

**状态**：计划包编写完成（2026-10-21）；S0 已部分实施（S0-4/S0-6 完成、S0-2 本地完成、S0-3 结论确定、S0-5/S0-7 部分），S1-1 storageRegistry 与 S1-3 启动压缩/配额策略已落地（50 项相关测试通过，full suite exit 0）。S0-1/S0-3 端口待授权/脏改清理；仍需确认 Q01/Q02/Q04/Q05/Q07/Q10。