# S4 包体与加载 — 执行计划

> 上级计划：[架构与性能优化总计划](../2026-10-21-architecture-performance-optimization.md) §5 S4 / §6.2 / §8 D1
> 执行包：[README](./README.md) · [决策记录](./00-decisions.md) · [进度看板](./TRACKING.md) · 相邻阶段：[S3](./S3-shell-subscriptions.md) · [S5](./S5-render-runtime.md)
> 阶段：S4（7 个任务，10 个 PR）；预估：1 周（单人）/ 2-3 人并行约 3-4 天；状态：**未开始**
> 规划快照：feature/gesture-air-control-overhaul @ c73a872（含 55 项脏改）；实施基线：S0-1 处理后的干净 master
> 规范依据：PROCESS.md:131-134（单 PR 建议 ≤400 行）、AGENTS.md、总计划 §1.3 不变量、§7.2 回滚

---

## 1. 阶段目标与出口条件

**目标**：把"首屏必载但只在特定功能才需要"的重库移出初始闭包；把 20 块同名 vendor 碎片收敛为语义块；把两个高频长列表虚拟化；按 D1 决策处置 V8 双系统。**不改播放链路、不改数据格式、不改受保护视图视觉。**

### 1.1 已核实基线（2026-10-21，.next 快照 mtime 2026-10-20T17:22Z；口径=读构建产物，未重跑 build）

| 指标 | 实测 | 测量/证据 |
|---|---:|---|
| build-manifest.rootMainFiles | **23 文件 / 969.3 KB raw / 296.8 KB gzip(level9)** | .next/build-manifest.json + zlib 逐文件求和（本计划复核，与审计 B/D 一致） |
| / 首屏 script（去重） | **37 个 script src / 1,996.7 KB raw / 615.7 KB gzip** | 解析 .next/server/app/index.html（审计 D 只报 raw；gzip 为本计划新增口径） |
| /data-manager 首屏 script | 37 个 / 1,857.7 KB raw | .next/server/app/data-manager.html；与 / 的 37 个仅差 6 个 page-specific chunk |
| 全局 CSS | 232,837 B raw（227.4 KB）/ 29,868 B gzip | .next/static/css/aa58388ffd0b99ed.css |
| vendor 碎片 | **20 个 vendors-***（next.config.js:27-80 的 name:"vendors" + maxSize:300000） | build-manifest；固定 name + maxSize 拆分是碎片根因 |
| vendors-aacc2dbb | **86,125 B raw / 30.3 KB gz**，仅命中 crypto-js WordArray 标记 | 首屏引用；crypto-js 静态可达链见 §4.2 |
| vendors-c5c6856a | **184,266 B raw / 50.7 KB gz**，同时命中 jsmediatags 与 @mediapipe/tasks-vision（mediapipe.NormalizedRect proto / Task API 字符串） | 首屏引用；两库同块 ⇒ 删除 jsmediatags 不会整块消失 |
| 裸 img（非测试） | 34 处命中 / 18 文件（含 1 处注释误命中）；loading/decoding 属性 0 处 | 全仓 grep（审计 B P1-5 报 33/17，工作区已漂移，以本表为准） |
| VirtualList 使用点 | **0**（组件与导出存在：src/components/shared/Glass/VirtualList.tsx、Glass/index.ts:10） | 全仓 grep，仅定义/导出/测试 |
| V8 死代码 | visualization-v8/** 45 文件、lib/visualization/** 7 文件、lib/three/ThreeJSScene.ts 1 文件 | glob；但 3 处跨系统引用见 §4.7，**不是"零引用"** |

> **与审计的两处重要更正（已核实）**
> 1. 审计 B 称 layout.tsx:22-23 的 Google Fonts preconnect 是"死 preconnect"——**错误**。src/app/globals.css:1 用 @import url("https://fonts.googleapis.com/css2?...") 真实加载 5 个字体族（Ma Shan Zheng / Long Cang / Liu Jian Mao Cao / Noto Serif SC / ZCOOL XiaoWei），preconnect 有效。真正的问题是 **CSS @import 串行阻塞**，处理方式见 S4-3。
> 2. 审计 B 称 V8"零引用"——**只对 VisualizationViewV8 成立**。visualizationV8Store 被 AppleUnifiedNavIsland.tsx:36,151,168 与 aiAgentTools.ts:7,726 引用；performanceV8Store 被 V7 UI 的 VisualSettings.tsx:7,131、NowPlayingHalo.tsx:10,55、PlayerSkinsPanel.tsx:32,264 引用。删除前必须先处理这 5 处（S4-7）。

### 1.2 出口条件（全部量化，按 S4-1→S4-7 顺序复测）

| ID | 出口 | 现状 | 目标 | 硬阈值（不达标不得宣布阶段完成） |
|---|---|---|---:|---:|
| E4-1 | 初始 script 集合内 jsmediatags 标记数 | 1（c5c6856a） | **0** | >0 |
| E4-2 | 初始 script 集合内 crypto-js 标记数 | 1（aacc2dbb） | **0**，且该 chunk 不再出现在 /、/data-manager 的 script 列表 | >0 |
| E4-3 | rootMainFiles 数量 | 23 | **≤12** | >16 |
| E4-4 | rootMainFiles gzip | 296.8 KB | **≤190 KB**（分段：S4-2 后 ≤266；S4-3b 后 ≤200；见 §5.3） | >230 KB（总计划 §6.2 硬阈值） |
| E4-5 | / First Load raw | 1,996.7 KB | **≤1,700 KB** | >2,000 KB |
| E4-6 | 初始 script 集合内 @mediapipe/tasks-vision 标记数 | 1（c5c6856a，理论上动态 import 才加载） | **0** | >0 |
| E4-7 | 裸 img 无 loading/decoding | 33 有效处（18 文件） | 首批 3 个高频文件全部走 CoverImage；新增裸 img=0 | 出现新增裸 img |
| E4-8 | 列表虚拟化 | Queue/Search 均全量 map | 2 个列表使用 VirtualList；500 项打开 longtask（>50ms）=0；滚动 60fps（draw p95 不劣化 >10%） | longtask >0 或滚动丢帧 |
| E4-9 | V8 处置 | 45+7+1 文件未接线但被 5 处引用 | 按 D1 结论执行；执行后 src 内 visualization-v8 引用=0、VisualizationViewV8 引用=0；tsc/vitest/build 绿 | 仍有引用 |

**出口门（M4）**：E4-1..E4-9 全绿 + node scripts/perf/bundle-budget.mjs 输出 violations: []。E4-4 若落在 190-230KB 之间，必须附 §5.3 的缺口表并经 Lead 书面同意后按"预算重定基线"收口（不允许静默通过）。

---

## 2. 前置条件、依赖与不变量

**前置**
1. S0-1 完成（干净基线）；S0-6a 完成（scripts/perf/bundle-budget.mjs、perf/budget.json 可用）——本计划所有 before/after 都用该脚本同一口径。
2. S0-7/D1 已拍板（S4-7 依赖）；D7 授权（S4-4c 触碰 VisualizationView.tsx:686 封面时）。
3. S3-6 完成（VirtualList 涉及的 QueuePanel 由 S3-6 改了 LazyPanel 生命周期；本阶段不再改 LazyPanel）。
4. **测量快照**：开工前先跑 node scripts/perf/bundle-budget.mjs --out perf/s4-before.json，作为本阶段所有对比的 before；若与 §1.1 偏差 >1%，先解释差异（Node/构建环境/脏改）再改代码。

**依赖图**

    S4-1a(flags+metadata 动态化) → S4-1b(LocalMusicManager)
    S4-2(lxRunner crypto 动态化) ── 独立
    S4-3a(splitChunks 语义块) ─→ S4-3b(字体与 async 泄漏核验)
    S4-4a(CoverImage) → S4-4b(MusicCardStack) → S4-4c(SearchPanel+VisualizationView 封面)
    S4-5(VirtualList+QueuePanel) 依赖 S4-4a（队列封面用 CoverImage）；S4-5 → S4-6(SearchPanel 虚拟化)
    S4-7(V8 处置) 依赖 D1 + S5-4 契约前置（选 C 时先复制契约，见 §4.7）

全部任务共享文件只有 next.config.js（S4-3 独占）、src/app/layout.tsx + src/app/globals.css（S4-3 独占）、src/components/player/SearchPanel.tsx（S4-4c→S4-6 串行）。其余文件集合不相交。

**不变量**
- I1 数据兼容：不改任何 persist key / IndexedDB 字段 / 备份 envelope（本阶段无数据改动；S4-7 删除 store 前需 S6 确认无持久化 key 依赖）。
- I2 播放连续性：不改 src/lib/audio/**、src/hooks/useAudioPlayer.ts、播放 store。
- I3 受保护视图：Home/Player/全屏歌词视觉与交互不变；S4-4b 只替换 MusicCardStack 内的图片组件，不改布局/动画参数。
- I4 资源有 owner：动态 import 失败必须有降级路径，不得让封面/元数据/音源解析把主流程打挂。
- I7 验证顺序：eslint → vitest → tsc → build → dev/smoke；禁止并行 build 与 tsc；dev 存活时禁止 npm run clean。

**feature flag 约定（本阶段统一）**
- 客户端开关放 src/lib/perf/featureFlags.ts（S4-1a 新建），全部是**构建期内联**的 NEXT_PUBLIC_*，运行时零分支成本：virtualListQueue、virtualListSearch、coverImageV2（默认 on）；visualRuntime、effectPlugins（S5 用，S4-1a 先建表，默认 on/false 见 S5）。
- 构建期开关 SPLIT_CHUNKS_V2（next.config.js 读 process.env.SPLIT_CHUNKS !== "off"，默认 on）。
- 关闭开关 + 重新构建 = 回到旧行为，不需要改代码即可回滚（"双跑一版"的物理形态）。每个 PR 必须写清 flag 名/默认值/关闭后行为。

---

## 3. 任务总表

| ID | 任务 | 写作用域（精确文件） | 子 PR | 依赖 | 风险 | 验收（量化） |
|---|---|---|---|---|---|---|
| S4-1 | jsmediatags 动态化（函数内 await import），调用方 async 适配 | src/lib/perf/featureFlags.ts(新)+test、src/services/audioMetadata.ts+test、src/utils/localMusicImport.ts+test、src/components/library/LocalMusicManager.tsx+test | 2（1a/1b） | S0-6 | 中（调用方 async 化） | E4-1：初始 chunk 中 jsmediatags 标记=0；导入/元数据回归用例全绿 |
| S4-2 | crypto-js 动态化（LX 源执行时加载），不改加密语义 | src/lib/sources/lxRunner.ts、src/lib/sources/lxRunner.test.ts | 1 | 无 | 中（LX 脚本兼容） | E4-2：aacc2dbb 移出初始集合；rootMain raw −84.1KB ±2%；LX 测试全绿 |
| S4-3 | splitChunks 收敛语义块 + 字体加载路径修正 + async vendor 泄漏核验 | next.config.js、src/app/layout.tsx、src/app/globals.css、scripts/perf/check-initial-chunks.mjs(新)+test | 2（3a/3b） | S0-6 | 中（缓存失效一次） | E4-3/E4-4/E4-6：script 23→≤12；mediapipe 标记 0；vendor 碎片 ≤6 |
| S4-4 | CoverImage 统一图片组件；先接 Home/Search，队列随 S4-5 | src/components/shared/ui/CoverImage.tsx(新)+test、src/components/player/MusicCardStack.tsx、src/components/player/SearchPanel.tsx、src/components/visualization/VisualizationView.tsx:686 | 3（4a/4b/4c） | 无（4c 需 D7） | 低 | E4-7：3 文件走 CoverImage；封面不闪、无布局跳动；截图对照 |
| S4-5 | VirtualList 能力补齐 + QueuePanel 接入（顺带修 3 处整店订阅） | src/components/shared/Glass/VirtualList.tsx+test、src/components/player/QueuePanel.tsx+test | 2（5a/5b） | S3-6、S4-4a | 中（滚动/自动定位/键盘） | E4-8：500 项队列打开 longtask=0；当前曲目自动滚入视野；键盘/点击行为不变 |
| S4-6 | SearchPanel 结果虚拟化 + CrossfadeMixer/BatchMetadataEditor 列表 | src/components/player/SearchPanel.tsx、src/components/audio/CrossfadeMixer.tsx、src/components/library/BatchMetadataEditor.tsx + 3 test | 2（6a/6b） | S4-5 | 中 | E4-8：500 条结果首帧 <50ms；批量工具滚动无长任务 |
| S4-7 | V8 处置执行（D1）：A/B/C 三方案步骤；推荐 C（先复制契约→再删除） | 见 §4.7（目录级删除 + 5 处消费者重定向 + 类型迁移） | 4（7a/7b/7c/7d） | D1、S5-4 前置 | 中高（误删/行为变化） | E4-9：引用=0；tsc/vitest/build 绿；V7 14 效果截图不变 |

**PR 顺序建议（单人）**：S4-1a → S4-2 → S4-3a → S4-3b → S4-1b → S4-4a → S4-4b → S4-5a → S4-5b → S4-4c → S4-6a → S4-6b → S4-7a/b/c/d。
理由：先做"纯移出初始闭包"的低风险项拿到包体收益；Queue 行的封面替换与列表重写合并到 S4-5 PR，避免 QueuePanel 两 PR 冲突。

---

## 4. 逐任务执行步骤

### S4-1 jsmediatags 动态化（2 个 PR）

**目标**：把 jsmediatags 从"任何路由的静态闭包"改为"导入动作触发时加载"，初始 chunk 中不再出现该库；导入功能与元数据读取行为不变。
**前置**：无（S0-6 只需 bundle 脚本用于测量）。
**写作用域**：1a = src/lib/perf/featureFlags.ts(新)、featureFlags.test.ts(新)、src/services/audioMetadata.ts、audioMetadata.test.ts、src/utils/localMusicImport.ts、localMusicImport.test.ts；1b = src/components/library/LocalMusicManager.tsx、LocalMusicManager.test.tsx。

**已核实现状**
- 静态 import：src/services/audioMetadata.ts:4、src/utils/localMusicImport.ts:6、src/components/library/LocalMusicManager.tsx:18。
- 使用点：audioMetadata.ts:196（extractAudioMetadata 内）、localMusicImport.ts:37（extractMetadata 内）、LocalMusicManager.tsx:112（组件内 extractMetadata）。
- 静态可达链（解释"为什么 / 首屏也有 jsmediatags"）：src/app/data-manager/page.tsx:4 → UnifiedDataManagerHub.tsx:28 → LocalMusicManager.tsx:18；而 / 与 /data-manager 共享 31 个 vendor chunk（仅 6 个 page chunk 不同，已实测），该库被 vendor 合并进 / 首屏。audioMetadata 侧仅被零引用的 src/hooks/useAudioMetadata.ts 与 metadataStorage.ts:4（type-only import，会被 TS 消除）引用，不是首屏主因，但一并动态化以杜绝未来回归。

**Step 1｜S4-1a 新增 flags 模块**（接口见 §2 末）
测试 src/lib/perf/featureFlags.test.ts：vi.resetModules() + vi.stubEnv("NEXT_PUBLIC_VL_QUEUE","off") 后动态 import 断言 false；未设置时默认值；"0" 不算 off。

**Step 2｜S4-1a audioMetadata.ts**
- :4 改为 import type { MediaTags, MediaTagResult } from "jsmediatags"（类型不产生运行时 import）。
- extractAudioMetadata()（:179）内 try 首行加：const { default: jsmediatags } = await import("jsmediatags")（该函数已是 async；extractCoverImage/extractLyrics 不需要库实例，无需改签名）。
- 失败降级：动态 import 抛错时沿用现有 onError 分支的 filename fallback（:227-243），在 catch 加 console.warn("[audioMetadata] jsmediatags 加载失败，降级文件名解析", err)。

**Step 3｜S4-1a localMusicImport.ts**
- :6 改为 import type { MediaTagResult } from "jsmediatags"。
- extractMetadata（:28-58）改为 async function extractMetadata(file: File): Promise<{...}>，函数体首行 const { default: jsmediatags } = await import("jsmediatags")，其余不变；调用点 processAudioFile（:111 的 Promise.all）已是 async 上下文，无需改。

**Step 4｜S4-1b LocalMusicManager.tsx**
- :18 改为 type-only import。
- extractMetadata（:99）改为 async，函数体首行动态 import 后再 new Promise(...)；调用点若在同步 map 中改为 await/Promise.all（待核实具体调用行，实施时 rg -n "extractMetadata\(" 为准）。
- 保持组件渲染不变；动态 import 失败时仍走 defaultResult（:106-110）。

**Step 5｜测试**
- audioMetadata.test.ts（现有 mock 形如 :7-11）：mock 工厂 { default: { read } } 已兼容动态 import；新增 "jsmediatags 仅在 extractAudioMetadata 被调用后才加载"（vi.hoisted 计数器；调用前 0、调用后 1）、"jsmediatags 加载失败时降级文件名解析"（mock 工厂 throw，断言 success:true 且 title 来自文件名）。
- localMusicImport.test.ts 新增 "import 流程在 jsmediatags 加载失败时仍产出 Song（fallback artist/title）"。
- LocalMusicManager.test.tsx 新增 "点击导入时动态加载 jsmediatags；加载失败不阻塞列表"。

**Step 6｜测量与验收**
    node scripts/perf/bundle-budget.mjs --out perf/s4-after-s41.json
    node scripts/perf/check-initial-chunks.mjs --next .next --forbid jsmediatags
预期：check-initial-chunks exit 0（初始集合匹配 0）；rootMainFiles.gzipBytes 比 perf/s4-before.json 至少 −12 KB（若 c5c6856a 因 mediapipe 仍留初始集合，不期望整块消失；实测值写证据）。硬验收：E4-1；npx vitest run src/services/audioMetadata.test.ts src/utils/localMusicImport.test.ts src/components/library/LocalMusicManager.test.tsx src/lib/perf/featureFlags.test.ts 全 passed。

**回滚**：revert 两个 PR（动态 import 是纯技术改动，失败路径已有降级）。若动态 import 在 Electron app:// 下异常（待核实 chunk 相对路径），临时把 audioMetadata.ts 恢复静态 import，仅保留 LocalMusicManager 动态化。
**风险**：调用方 async 化遗漏（表现为 Promise 未 await → 空列表）→ 用 rg 全量核查 extractMetadata( 调用点；jsmediatags 的 CJS default 形状（已核实 src/types/jsmediatags.d.ts:30-34 默认导出，动态 import 取 .default）。

---

### S4-2 crypto-js 动态化（1 个 PR）

**目标**：去掉初始闭包中的 crypto-js（首屏 84.1 KB raw / 30.3 KB gz），仅在执行 LX 脚本时加载；不改变 LX 脚本可见的同步加密 API 语义。
**前置**：无（lxRunner 的所有公开入口已是 async，已核实）。
**写作用域**：src/lib/sources/lxRunner.ts、src/lib/sources/lxRunner.test.ts。

**已核实现状**
- lxRunner.ts:2 静态 import CryptoJS from "crypto-js"；全部使用点在同一文件 createSandbox() 内：:88-115（buffer 编解码、md5/sha256、AES-CBC/Pkcs7、base64）。
- 公开入口均为 async：testScript（:127）、getMusicUrl（:258）、search（:363）；createSandbox 是同步方法（:13），在 await 之后调用即可注入。
- 静态可达链：GlobalClientComponents.tsx:29（SourceManagementModal 静态）→ SourceManagementModal.tsx:6 → sourceConfigStore.ts:13 → lxRunner.ts:2 → crypto-js；对应首屏 vendors-aacc2dbb（86,125 B，仅命中 crypto 标记）。
- 为什么不用 WebCrypto：LX 脚本的 utils.crypto.aesEncrypt/md5/sha256 是**同步**契约（脚本内直接调用），WebCrypto 只有异步 API；替换会改变 LX 兼容语义。本任务选"动态 import + 依赖注入"，WebCrypto 替换列为不做的备选（仅当明确允许异步化 LX utils 时再评估）。

**Step 1｜模块级懒加载与注入**
    type CryptoModule = typeof import("crypto-js");
    private static cryptoPromise: Promise<CryptoModule> | null = null;
    private static async ensureCrypto(): Promise<CryptoModule> {
      this.cryptoPromise ??= import("crypto-js");
      return this.cryptoPromise;
    }
- createSandbox 签名改为 private static createSandbox(crypto: CryptoModule, script: {...}, onEvent?: ...)，函数体 :88-115 的 CryptoJS 全部替换为参数 crypto。
- 三个 async 入口在调用 createSandbox 前插入 const crypto = await this.ensureCrypto()（对应 :138、:269、:375 三处）。

**Step 2｜测试（lxRunner.test.ts）**
- 既有 testScript/search/getMusicUrl 用例保持全绿（行为等价断言）。
- 新增 "crypto 模块只加载一次（并发入口共享 promise）"：vi.hoisted 计数 mock 工厂 + Promise.all([LXRunner.testScript(a), LXRunner.testScript(b)])，断言工厂调用 1 次；vi.resetModules() 后重新 import 再断言可重新加载。
- 新增 "AES/base64 工具输出与旧实现一致"：固定 key/iv 的黄金值（从现有实现跑出、写死在测试里）覆盖 utils.crypto.aesEncrypt、utils.buffer.from(hex)。

**Step 3｜测量与验收**
    node scripts/perf/bundle-budget.mjs --out perf/s4-after-s42.json
    node scripts/perf/check-initial-chunks.mjs --next .next --forbid crypto
- 预期：/、/data-manager script 列表不再含 vendors-aacc2dbb；rootMain raw −84.1 KB ±2%、gzip −30.3 KB ±2%（相对 S4-1 后值）。若 chunk 仍在列表，说明还有其它模块占用该 chunk → 查 chunk→marker 映射，把结论写证据后再决定是否追加"该 chunk 余量分析"（不新增任务 ID）。
- 功能验收：npx vitest run src/lib/sources/lxRunner.test.ts src/services/MultiSourceResolver.test.ts 全 passed；/sources 面板手测 LX 源搜索/播放（dev smoke）。
- 硬验收：E4-2。

**回滚**：revert 单 PR（cryptoPromise 与注入是纯内部重构）；若线上发现 LX 源异常，可临时把 ensureCrypto() 改为 import("crypto-js") 的静态别名（不需要回滚整 PR）。
**风险**：crypto-js 的 default 形状（import("crypto-js") 返回 { default: CryptoJS }；esModuleInterop:true 已核实 tsconfig.json:9）→ 不匹配时用 const mod = await import("crypto-js"); const crypto = mod.default ?? (mod as unknown as CryptoModule) 兜底并加测试。

---

### S4-3 splitChunks 语义块 + 字体加载路径 + async vendor 泄漏核验（2 个 PR）

**目标**：把 20 块同名 vendor 收敛为语义块并让 Next 只把"初始真正需要"的模块放进初始 chunk；消除 @mediapipe 被合入首屏的泄漏；把 Google Fonts 从 CSS @import 改为 link，避免 CSSOM 串行。
**前置**：S0-6a bundle 脚本；构建只能在无 dev server 时跑（S0-3 clean-port 规则）。
**写作用域**：3a = next.config.js（:26-80）；3b = src/app/layout.tsx:21-24、src/app/globals.css:1、scripts/perf/check-initial-chunks.mjs(新)+test.mjs(新)。

**已核实现状**
- next.config.js:27-80：chunks:"all"、maxSize:300000、默认组 vendor:{name:"vendors", chunks:"all"} 是所有 vendor 的兜底命名，导致 20 块同名碎片；three/fabric/ffmpeg 已单独 chunks:"async"（:39-59）。
- @mediapipe/tasks-vision 只被 src/lib/gesture/tracker.ts:188 **动态 import**，但首屏 vendors-c5c6856a 含其实例字符串 ⇒ 动态边界被 vendor 合并破坏（机制待核实，S4-3a 后用脚本验证是否消失）。
- 字体：src/app/globals.css:1 用 @import 加载 5 个字体族；src/app/layout.tsx:22-23 已有 preconnect（保留）。

**Step 1｜S4-3a 重写 splitChunks（async 组不动）**
- 默认 chunks 改为 "initial"（只从初始 chunk 抽公共块；async 模块由各 async cacheGroup 承接）；
- 删除 maxSize:300000（碎片直接原因）；
- cacheGroups：framework（chunks:"all"）、vendor-ui（framer-motion+lucide-react，chunks:"initial"）、vendor-core（其余 node_modules，chunks:"initial"，priority 10）、three/fabric/ffmpeg 保持现有 async 组、新增 mediapipe:{name:"chunk-mediapipe", test:/@mediapipe/, priority:36, chunks:"async"}；
- 用 process.env.SPLIT_CHUNKS !== "off" 包裹（回滚开关）；
- **不新增 "audio-vendor" 块**：首屏无音频类 npm 依赖（Web Audio 是原生 API；@ffmpeg 已 async），凭空建空块会让配置与实际依赖脱节（对总计划 S4-3 命名的一处修正，需 Lead 知悉）。
- if (!isServer) 分支其余逻辑（externals/fallback）不动。

**Step 2｜S4-3b 字体加载**
- globals.css:1：删除 @import url(...) 行（保留其余 CSS）。
- layout.tsx:21-24：head 中 preconnect 之后追加 <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Ma+Shan+Zheng&family=Long+Cang&family=Liu+Jian+Mao+Cao&family=Noto+Serif+SC:wght@300;400;600;900&family=ZCOOL+XiaoWei&display=swap" />。
- 保留 preconnect；display=swap 保持；不改字体族/字重/引用它们的 CSS。不承诺 self-host（见 §7 Q4-2）。

**Step 3｜S4-3b 初始 chunk 守卫脚本**
scripts/perf/check-initial-chunks.mjs（log-only 起步，S8-1 转 CI 硬门禁）：
- 纯函数 parseInitialChunks(htmlPaths[]) -> { files: Set, chunks: Map<file, bytes> }
- assertNoMarkers(initialFiles, nextDir, markers: {name, patterns: string[]}[])
- CLI：node scripts/perf/check-initial-chunks.mjs --next .next --json out.json；markers 默认 jsmediatags（["jsmediatags","ID3v2"]）、crypto（["WordArray"]）、mediapipe（["mediapipe.NormalizedRect","@mediapipe/tasks-vision"]）；violations 非空 exit 1（--forbid <name> 可只查一项）。
测试 scripts/perf/check-initial-chunks.test.mjs：fixture HTML（2 个 script）+ fixture chunk（1 含 marker/1 不含）→ violations 精确到文件；"external script src 被忽略"；"重复 script src 去重"。

**Step 4｜测量与验收（每个子 PR 各一次）**
    node scripts/perf/bundle-budget.mjs --out perf/s4-after-s43a.json
    node scripts/perf/check-initial-chunks.mjs --next .next
    node scripts/perf/bundle-budget.mjs --out perf/s4-after-s43b.json
- 3a 预期：rootMainFiles.count 23 → ≤12；vendors-* 数量 20 → ≤6；/ First Load raw ≤1,700KB；check-initial-chunks 的 mediapipe violation **必须为 0**。若不为 0：说明还有静态可达路径（已核实仅 tracker.ts 动态 import），把 chunk 图证据写入 S4 证据，并追加方案：把 tracker 的 import 改命名 async chunk（/* webpackChunkName: "gesture-vision" */），仍不新增任务 ID。
- 3b 预期：link rel="stylesheet" 出现在 / HTML；CSS 内不再有 @import；字体仍加载（dev 控制台 document.fonts.check("16px 'Ma Shan Zheng'") 为 true）；LCP 与 S0-6 基线对比允许 ±10%。
- 硬验收：E4-3、E4-4 分段值、E4-6。

**回滚**：SPLIT_CHUNKS=off npm run build 回到旧 splitChunks；字体改动 revert 单 PR 即恢复 @import。缓存失效一次属预期（首访变慢，二次命中）。
**风险**：chunks:"initial" 可能让 async 共享模块重复打包（包体反而上升）→ 用 bundle-budget 的 asyncChunkTop 与 rootMain 双向对比；若重复，回退到 chunks:"all" 但保留"删除 maxSize + 分语义 name"部分（结论写证据）。Turbopack 不兼容自定义 splitChunks（审计 D P1-4）属已知既有取舍，不改 --webpack。

---

### S4-4 CoverImage 统一图片组件（3 个 PR）

**目标**：为封面/缩略图提供单一组件：固定比例、loading/decoding、可选 fetchPriority、命中 coverCache 的 blob/data URL 直出；先覆盖 Home（MusicCardStack）、Search（SearchPanel）、Queue（随 S4-5）。
**前置**：无；4c 触碰 VisualizationView.tsx:686 需 D7 授权（仅替换图片元素，不改视觉）。
**写作用域**：4a = src/components/shared/ui/CoverImage.tsx(新)+CoverImage.test.tsx(新)；4b = src/components/player/MusicCardStack.tsx+test；4c = src/components/player/SearchPanel.tsx+test、src/components/visualization/VisualizationView.tsx+test。

**已核实现状**
- 三个高频文件当前用 next/image（全局 images.unoptimized:true，next.config.js:98-99）：MusicCardStack.tsx:488-493、:518-524、:596（Home 黑胶/卡片封面）；SearchPanel.tsx:798-804（结果封面 36px）；QueuePanel.tsx:373-379（队列封面 44px，随 S4-5 改）。
- 裸 img 34 处/18 文件（非测试）；loading/decoding 属性 0 处（VisualizationView.tsx:686 是全屏封面原图直出）。
- 封面缓存 API 已存在：src/services/coverCache.ts:35 saveCoverToCache、:72 getCoverFromCache、:149 preloadCovers（直接复用，不重造）。

**Step 1｜S4-4a 组件接口**
    "use client";
    import Image from "next/image";
    export interface CoverImageProps {
      src?: string | null;
      alt: string;
      size?: "xs" | "sm" | "md" | "lg" | "hero";
      priority?: boolean;
      className?: string;
      sizes?: string;
      fill?: boolean;
      cachedSrc?: string | null;
    }
内部规则（文件头注释 + 单测断言）：finalSrc = cachedSrc || src || "/default-cover.svg"；loading={priority ? "eager" : "lazy"}；decoding="async"；fetchPriority={priority ? "high" : "auto"}；unoptimized={finalSrc.startsWith("data:") || finalSrc.startsWith("blob:")}（与 QueuePanel.tsx:379 现有判断一致）；featureFlags.coverImageV2 === false 时退化为最小 Image 包装（不改 DOM 结构）。不引入新依赖、不新建 Context。

**Step 2｜S4-4a 测试** CoverImage.test.tsx（mock next/image 为 img，参考 LocalMusicManager.test.tsx:20-22）：
- "lazy by default, eager when priority"
- "decoding is async for all covers"
- "data/blob URL disables next-image optimization"
- "falls back to default cover when src empty"
- "uses cachedSrc over src"

**Step 3｜S4-4b MusicCardStack 接入**
- 三处 Image（:488、:518、:596）替换为 CoverImage fill size="lg" priority={index===0} ...；**不改**布局 class、motion 参数、cover 回退逻辑（:46-64）。
- 保留 getCoverFromCache 调用点（:157 已写缓存），无 cached 值就传 src。
- 测试：MusicCardStack.test.tsx 断言 3 个封面节点存在、loading 属性符合、播放/切换用例不变。

**Step 4｜S4-4c SearchPanel + VisualizationView 接入**
- SearchPanel.tsx:798 换 CoverImage fill size="sm" alt={song.title} src={song.cover}。
- VisualizationView.tsx:686 换 CoverImage fill size="hero" priority src={currentSong.cover}（此处原为裸 img；替换后走 next/image + fill；不改容器尺寸/缩放动画）。
- 测试：SearchPanel.test.tsx 断言结果行封面 props；VisualizationView.test.tsx 只断言存在封面节点与 priority。

**Step 5｜测量/验收**
- rg -n "<CoverImage" src/components 命中 3 个业务文件（MusicCardStack/SearchPanel/VisualizationView）+ S4-5 的 QueuePanel（后置）。
- 计数：rg -n "<img" src/components --glob '!*.test.*' | wc -l 记录 before/after（本阶段目标是 3 个高频文件不再裸 img，不承诺全仓归零）；白名单：canvas 绘制、PosterTemplates（html-to-image 导出源）、AmbientFluidMeshBackground（预加载双封面，注释已说明）暂不动。
- 视觉：Home/Search 各 3 张截图（正常/慢网/离线）对比，封面不闪、无布局跳动。
- 性能：Chrome Performance 面板 Decoded image/heap 不高于基线；coverCache 命中时无网络请求（Network 面板核对）。

**回滚**：NEXT_PUBLIC_COVER_V2=off + 重建回到旧 Image 直用；或 revert 4b/4c 单 PR（4a 组件会被删除）。**风险**：data: URL 被误判导致 404 → 用 DEFAULT_COVER_SRC 兜底，加测试。

---

### S4-5 VirtualList 接入 QueuePanel（2 个 PR）

**目标**：500 项队列打开时不再一次性创建数百 DOM 节点；保持当前曲目自动滚入视野、键盘/点击行为、滚动体验不变；顺带修 QueuePanel 3 处整店订阅。
**前置**：S3-6（LazyPanel 生命周期已改）；S4-4a（封面组件可用）。
**写作用域**：5a = src/components/shared/Glass/VirtualList.tsx+VirtualList.test.tsx(新)；5b = src/components/player/QueuePanel.tsx+QueuePanel.test.tsx。

**已核实现状**
- VirtualList.tsx（83 行）：固定 itemHeight、overscan=5、ResizeObserver 测容器高、onScrollEnd；**无 ref/scrollToIndex/可变高度**（:5-12 接口）。
- QueuePanel.tsx：整店订阅 3 处——:43 useQueueStore()、:44 useAudioStore()、:46 useOfflineDownloadStore()；列表 :302 容器 overflow-y-auto + :326 filteredQueue.map；当前项自动滚动靠 :93-101 的 activeItemRef.current.scrollIntoView；行高 ≈ 44(封面)+20(py-2.5×2)+2(border)=66px，间距 space-y-1.5(6px) → 建议 itemHeight=72（实施前用 getBoundingClientRect().height 实测 3 种字号/缩放，实测值写 PR）。
- QueuePanel.test.tsx 已存在（导入/渲染用例）。

**Step 1｜S4-5a 扩展 VirtualList（保持向后兼容）**
    export interface VirtualListHandle {
      scrollToIndex(index: number, opts?: { align?: "start" | "center" | "auto"; smooth?: boolean }): void;
      scrollToTop(): void;
    }
    export interface VirtualListProps<T> {
      items: T[];
      itemHeight: number;
      renderItem: (item: T, index: number) => React.ReactNode;
      className?: string;
      overscan?: number;
      onScrollEnd?: () => void;
      handleRef?: React.Ref<VirtualListHandle>;
      initialIndex?: number;
    }
- 用 useImperativeHandle 暴露 scrollToIndex（内部 containerRef.current.scrollTop = idx*itemHeight - (containerHeight-itemHeight)/2，behavior 由 smooth 决定）；保持 items.slice 逻辑；renderItem 签名不变（既有使用点 0，风险低）。
- 测试 VirtualList.test.tsx（jsdom 无真实布局 → mock clientHeight 与 ResizeObserver）："renders only visible window plus overscan"（1000 项、容器 480px、itemHeight 48 → 渲染 ≤ 480/48+2*5+1）、"scrollToIndex centers target item"、"initialIndex sets initial scrollTop"、"onScrollEnd fires once near bottom"。

**Step 2｜S4-5b 重构 QueuePanel**
- 订阅改原子 selector（3 处整店 → 0）：const queue = useQueueStore(s=>s.queue)；currentIndex/removeFromQueue/clearQueue/moveToNext 分别取；多值用 useShallow（参考 PanelOrchestrator.tsx:146 正确样板；不新造 hook）。
- 行抽成 const QueueRow = memo(function QueueRow({song, index, isCurrent, isPlaying, onPlay, onRemove}) {...})；itemHeight=72 常量与行内 h-[66px] 由同一常量派生。
- 列表容器（:302）替换为 VirtualList（items=filteredQueue、itemHeight=QUEUE_ROW_HEIGHT、initialIndex=playbackQueueIndex、handleRef=listRef、renderItem=QueueRow）。
- 当前曲目变化时 useEffect(() => listRef.current?.scrollToIndex(playbackQueueIndex, { align: "center", smooth: true }), [playbackQueueIndex])，删除 activeItemRef.scrollIntoView（:93-101），保留"仅当 isOpen"条件。
- 封面用 CoverImage fill size="sm" 替换 :373-380；保留：搜索过滤（:104-117）、总时长（:127-130）、ESC（:79-90）、点击播放（:132-138）、动画容器。
- 测试：QueuePanel.test.tsx 新增 "renders viewport-sized window for 500 songs"（断言 DOM 行数 < 100）、"current song scrolls into view via handle"；静态门禁 rg "use(Queue|Audio|OfflineDownload)Store()" → 0。

**Step 3｜测量/验收**
- 长任务：dev + Chrome DevTools Performance 录制打开 500 项队列 → longtask 计数 0（基线会 >1）；滚动 3s 的 frame p95 ≤ 16.7ms（60fps）。
- 行为：打开面板定位到当前曲目（截屏）；点击/删除/清空/搜索过滤/键盘 ESC 与基线一致；空队列不崩。
- 单测：npx vitest run src/components/shared/Glass/VirtualList.test.tsx src/components/player/QueuePanel.test.tsx 全 passed。
- 硬验收：E4-8 中 Queue 侧三项。

**回滚**：NEXT_PUBLIC_VL_QUEUE=off + 重建 → 走旧 map 分支（5b 内保留旧分支直到 S5 结束）；或 revert 5b。**风险**：scrollToIndex 与 motion 动画并发抖动 → 打开时等 AnimatePresence 完成（复用现有 isOpen 时序），必要时 smooth:false；行高随字体缩放变化 → ResizeObserver 实测校准 + ±2px 裁剪（写证据）。

---

### S4-6 SearchPanel 结果虚拟化 + 批量工具列表（2 个 PR）

**目标**：搜索结果（可能数百条）与批量工具长列表不再一次性渲染；首帧 <50ms。
**前置**：S4-5（VirtualList 句柄能力）。
**写作用域**：6a = src/components/player/SearchPanel.tsx+test；6b = src/components/audio/CrossfadeMixer.tsx+test、src/components/library/BatchMetadataEditor.tsx+test。

**已核实现状**
- SearchPanel.tsx:773-830：results.map（:791）渲染整批；行含 36px 封面（:798）+ 3 个 hover 按钮；结果区在滚动容器内（待核实父级 overflow 样式，实施时确认 VirtualList 高度来源）。
- CrossfadeMixer.tsx:357-358（歌曲选择列表，max-h-64 overflow-y-auto）、:442-444（队列预览，max-h-64）。
- BatchMetadataEditor.tsx:154-155（源歌曲列表，max-h-96）、:313-314（预览变更列表）。

**Step 1｜S4-6a SearchPanel**
- 结果列表容器改为固定高度虚拟区（如 max-h-[420px]，按现有 UI 尺寸定，PR 附截图）；VirtualList items=results itemHeight=52 renderItem={SearchResultRow}（52=p-1.5×2+36，实测校准）；SearchResultRow 抽为 memo；保留 handlePlaySong、handleAddNext、"播放全部"（:780-788）、空态/加载态。
- 测试："renders window for 500 results"、"click row plays selected song"、"row keep same key ordering after new search"。

**Step 2｜S4-6b 批量工具列表**
- CrossfadeMixer 两处列表 itemHeight≈72（行含 BPM/时长，实测）；BatchMetadataEditor 两处 itemHeight≈64；均用 memo 行组件。
- 保留全选/取消全选（CrossfadeMixer.tsx:133）、预览变更数据结构（BatchMetadataEditor.tsx:314-322 不变，只外层虚拟化）。
- 测试：现有两文件测试 + 新增窗口渲染断言。

**Step 3｜测量/验收**
- Search：500 条 mock 结果，输入后首帧 <50ms（performance.now 打点）；滚动 60fps。
- Batch/Crossfade：打开列表无 >50ms 长任务；全选/应用结果与基线一致。
- 硬验收：E4-8 中 Search/批量两项。

**回滚**：NEXT_PUBLIC_VL_SEARCH=off + 重建；6b 无 flag 时可独立 revert。**风险**：结果折叠高度变化导致滚动位置跳动 → results 变化时重置 scrollTop=0（现有行为）；虚拟列表内行动画（若有）需禁用（已核实 :791-830 未使用 motion；若有，改 CSS transition）。

---

### S4-7 V8 处置执行（依赖 D1；推荐 C，4 个 PR）

**目标**：按 D1 决策处理 V8 双系统；推荐 C = 先把 V8 的 EffectPlugin/RenderEngineManager 生命周期契约移植进 src/runtime/（S5-4 消费），再删除 V8 实现。**净删除约 −12k 行，预期不减少首屏包体**（V8 未被打包，不要在本任务 PR 中写包体收益）。
**前置**：D1 拍板（00-decisions.md）；S5-4 契约 PR 已合入（C）或已明确不移植（A）。
**写作用域（目录级；单 PR 文件集合见下）**：src/components/visualization-v8/**（45 文件，38 非测试）；src/lib/visualization/**（7 文件）、src/lib/three/ThreeJSScene.ts；src/store/{visualizationV8Store,presetStore,animationStore}.ts 及 src/store/visualInteractionStores.test.ts；src/components/layout/AppleUnifiedNavIsland.tsx、src/services/aiAgentTools.ts；src/store/performanceV8Store.ts（**保留**，迁移类型后自包含）。

**已核实现状（删除前必须处理的 5 处跨系统引用）**
1. AppleUnifiedNavIsland.tsx:36,151,168：调用 useVisualizationV8Store.getState().setCurrentEffect("kinetic-particle-stage"/"aurora-fluid") —— V8 未挂载，这两个导航动作**当前是空操作**；应改指向 V7 useVisualizationStore（或删除动作，需产品确认）。
2. aiAgentTools.ts:7,726：同款 V8 store 写入；应改 V7 useVisualizationStore（工具语义"切换可视化效果"）。
3. VisualSettings.tsx:7,131、NowPlayingHalo.tsx:10,55、PlayerSkinsPanel.tsx:32,264：使用 performanceV8Store 的 config/activePreset/targetFPS —— **V7 仍在用，不能删**；只迁移 import 的 PerformanceLevel/PerformanceConfig 类型（lib/visualization/types.ts:96-104）到 performanceV8Store.ts 内或新 src/types/visualization.ts。
4. visualizationV8Store.ts:3、presetStore.ts:2、animationStore.ts:8 依赖 lib/visualization/types|animationTypes；删除 V8 UI 后三者无消费者（除 visualInteractionStores.test.ts）。
5. ThreeJSScene 唯一引用 = RenderEngineManager.tsx:14；CinematicDirector.ts 全仓仅自身（已核实）。

**方案 A（直接删除，D1=A 时）**
- 7a：删除 visualization-v8/**、lib/three/**、lib/visualization/CinematicDirector.ts；visualizationV8Store/presetStore/animationStore 的持久化 key 从 S1-1 registry 标记 deprecated（**不在本阶段删 key**）。
- 7b：重定向 5 处消费者（同 C 方案 Step 2）；7c：删除三个 dead store + 其测试，lib/visualization 其余文件随最后一个消费者删除；7d：文档事实（ARCHITECTURE:72-73/AGENTS 概览）由 Lead 在 S0-4 follow-up 追加，本任务只在 PR 描述贴 rg 证据。

**方案 B（完成接线，D1=B 时）**
- 不删除；把 VisualizationViewV8 接入 page.tsx（替换 V7 入口）或提供切换开关。**成本与风险超出 S4 预算**（需重做 28 效果视觉/性能验收），本计划仅登记为"若 D1=B，S4-7 升级为 2-3 周专项并与 S5 合并执行"，不在本轮展开。

**方案 C（推荐，D1=C 时，4 个 PR）**
- 7a 契约先行（~350 行）：新增 src/runtime/effectPlugin.ts（类型 + EffectContext 兼容层）、src/runtime/effectRegistry.ts（注册表骨架，S5-4 填充）；类型来源 = lib/visualization/types.ts:74-87（EffectPlugin）+ RenderEngineManager.tsx 生命周期语义（:89-99 DPR 钳制、:291-309 resize、:311-348 init/destroy、:359-514 rAF/可见性/FPS 降档、:516-541 卸载清理）。复制时只复制契约与注释，不复制实现；附契约测试 runtime/effectPlugin.test.ts。
- 7b 消费者重定向（~120 行）：AppleUnifiedNavIsland.tsx、aiAgentTools.ts 改 V7 store；performanceV8Store.ts 类型自包含；VisualSettings/NowPlayingHalo/PlayerSkinsPanel import 不变（类型来源改新文件）。**行为变化说明**：导航岛两个"切 V8 效果"动作从空操作变为真实切 V7 效果（等同修复 bug），需产品/Lead 在 PR 中确认（截图 + 点击验证）；若不允许行为变化，删除这两个动作（二选一，PR 写明）。
- 7c 删除实现（净 −12k 行，纯删除 PR）：src/components/visualization-v8/**、src/lib/visualization/**（除 7b 已迁移类型）、src/lib/three/**；visualizationV8Store/presetStore/animationStore + visualInteractionStores.test.ts；删除 useVisualizationV8.ts（仅 V8 使用）；rg 证据贴 PR。纯删除可申请 PROCESS 例外（审计 B Q2）；否则按目录拆 5-6 个 PR（visualization-v8/components、.../effects、.../engines+panels、lib/*、store+test）。
- 7d 验证与清理（~50 行）：rg -n "visualization-v8|VisualizationViewV8|RenderEngineManager|ThreeJSScene|CinematicDirector" src → 0；npx tsc --noEmit、npx vitest run、npm run build 绿；V7 14 效果逐个截图（同 S5-2 harness，未就绪则人工切换截图）；docs/nbl/ARCHITECTURE.md 的"V8 为主力"表述由 Lead 在 S0-4 follow-up 修（本任务不碰 docs 事实文件，避免与 S0-4 冲突）。

**测量/验收**
- 包体：预期不变（删除前后 rootMainFiles/First Load 差异 ≤1%，否则说明 V8 曾被误打包，立即查 import 图并写证据）。
- npx vitest run 文件数减少 7（V8 测试）；tsc/eslint 耗时下降（记录 before/after，不设阈值）。
- 硬验收：E4-9。

**回滚**：纯删除 = git revert 恢复文件（零数据影响）；7b 行为重定向可单独 revert；如果 D1 临时改为 B，revert 7a 契约（S5-4 未合入时无依赖）。
**风险**：误删 lib/visualization 中仍被 V7 使用的类型（已核实仅 types/audioSnapshot/parameterMode/animationTypes 被 V8/store 消费，V7 效果用 src/components/visualization/effects/types.ts，两套独立）→ 删除前一文件执行 rg "lib/visualization" src --glob '!src/components/visualization-v8/**'，剩余引用必须为 0 或已迁移；visualizationV8Store 的 persist key 若已有用户数据，按 S1-1 registry 迁移规则保留读取一个版本（**不能在同一 PR 删 key**）。

---

## 5. 阶段级验证命令与证据清单

### 5.1 顺序（I7）
    npx eslint src --max-warnings=0
    npx vitest run
    npx tsc --noEmit --incremental false --pretty false
    npm run build
    node scripts/perf/bundle-budget.mjs --out perf/s4-final.json
    node scripts/perf/check-initial-chunks.mjs --next .next
    node scripts/perf/bundle-budget.mjs --out perf/s4-final.rerun.json
然后 npm run clean:port; npm run dev → /、/data-manager、打开 Home 封面、打开 Queue（500 项 fixture）、Search 输入、/sources 面板 LX 源（S4-2）各一次 smoke；结束 kill 进程。

### 5.2 证据文件 evidence/S4-evidence.md 必含
- perf/s4-before.json、perf/s4-after-s41/42/43a/43b/final.json 路径与关键字段（rootMain count/raw/gzip、/ First Load raw、多余 script 数）；
- check-initial-chunks violations 输出（目标空）；
- 每个 E4-x 的 before→after 数值 + 命令 + 退出码；
- 截图：Home/Search 封面、500 项 Queue 打开、S4-3 字体加载（document.fonts.check）、S4-7 前后 V7 14 效果；
- 未执行项（真机低端机 LCP、4K 屏、Electron 打包后包体——属 S7/S8）明确标注。

### 5.3 E4-4 缺口处理（预置，不许静默）
实测推算：S4-2 −30.3KB gz、S4-1 约 −12~15KB gz、S4-3b mediapipe 移出约 −30~35KB gz ⇒ 296.8 − ~78 = **~219KB**，距 190KB 仍有 ~29KB 缺口（推断，以实测为准）。缺口处理顺序：
1. check-initial-chunks 列出**所有**初始 chunk 内可识别的 async-only 库（three/fabric/ffmpeg/mediapipe/其他），逐个确认静态可达链；仍泄漏的按 S4-3a 同样方式加 chunks:"async" 命名组（每项 ≤40 行，独立 PR）。
2. 复核 rootMainFiles 中是否有"仅 /data-manager 需要"的模块被两路由共享（build-manifest + HTML 差集）；若存在，报 Lead 评估"两路由 entry 拆分"（超出 S4 预算，登记 S8 backlog）。
3. 若仍 >190KB：证据中给"每条缺失量 + 原因 + 候选杠杆"，由 Lead/用户决定是否把 E4-4 调整为 ≤200KB（总计划 §6.2 硬阈值 230KB 不变）。**不允许**用改口径/剔文件凑数。

---

## 6. 与相邻阶段的接口/交接物

| 方向 | 交接物 | 消费方 |
|---|---|---|
| S0 → S4 | scripts/perf/bundle-budget.mjs、perf/budget.json、check-docs-facts | 本阶段所有 before/after |
| S3 → S4 | S3-6 LazyPanel 生命周期、PanelOrchestrator.tsx:146 selector 样板 | S4-5 订阅改写 |
| S4 → S5 | src/lib/perf/featureFlags.ts（visualRuntime/effectPlugins 字段）、scripts/perf/check-initial-chunks.mjs、S4-3 的 splitChunks 语义块（S5 新增 src/runtime/** 不得引入新一轮 vendor 碎片） | S5-1/S5-2 |
| S4 → S6 | S4-7 删除的 dead store/key 清单（供 S6-2 registry 与 S6-9 清理）；**不删 key** | S6 |
| S4 → S8 | 初始 chunk 守卫脚本（log→CI hard gate）、CoverImage/VirtualList 使用率规则 | S8-1/S8-3 |
| S5 → S4 | S5-4 的 EffectPlugin 契约（D1=C 的 7a 输入） | S4-7 |

---

## 7. 未决问题 / 需用户决策

| # | 问题 | 影响 | 建议 |
|---|---|---|---|
| Q4-1 | D1 V8 处置是否按 C 执行；7b 的"导航岛两动作从空操作→真实切效果"是否接受为 bug 修复 | S4-7 全部 PR | 接受 C + 接受行为修复（附截图）；否则选"删除动作" |
| Q4-2 | 字体是否必须 self-host（离线/合规） | S4-3b 只做 link 迁移 | 本轮不承诺 self-host，单列 S8 backlog；若要求离线，需新增任务与字体子集化预算 |
| Q4-3 | E4-4 若实测缺口 ~20-30KB，是否接受 ≤200KB 的阶段性预算 | 阶段出口判定 | 先按 §5.3 处理；缺口 <10KB 时 Lead 可批准重定基线，>10KB 需用户确认 |
| Q4-4 | 裸 img 全仓归零时间表（本阶段只覆盖 3 个高频文件） | S8 门禁 | 统一走 CoverImage 的 eslint no-restricted-syntax 规则在 S8-1 加 warn→error |
| Q4-5 | 工作区脏改（55 项）是否会在 S4 期间变化 | 基线可复现性 | 由 S0-1 先处理；本阶段所有测量记录 commit + .next mtime |
