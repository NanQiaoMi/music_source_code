# S7 阶段退出证据（M7 出口门）

> 计划依据：[S7-platform-runtime.md](../S7-platform-runtime.md) §2.2 出口 E1–E10、§3 前置、§4 任务表、§5 逐任务、§6 验证
> 看板：[TRACKING.md](../TRACKING.md) §S7（行 123–134）、汇总行 19（S7 行）、M7 出口门行 125
> 决策：[00-decisions.md](../00-decisions.md) D2（行 23）/ D8（行 29）；[ADR 0002](../../../adr/0002-desktop-runtime.md)
> 生成时间：2026-10-29 19:05（Asia/Shanghai）
> worktree：`D:/26project/music_source_code_V1.1_full/_worktrees/arch-integration-s1-5`
> 分支：`docs/s7-evidence`（自 `98f0da5` 创建；该提交同时是 `integration/s2-audio` 的 HEAD）
> 约束：仅新增本文档；未 push；未改动主工作区 `D:/26project/music_source_code_V1.1_full/music_source_code`。
> 标注约定：**实测** = 本轮在本 worktree 执行并捕获 exit code；**历史** = TRACKING/提交时记录；**结构/构建** = 静态扫描或已有构建产物；**未验证** = 无直接证据。

## 0. 结论（先看这里）

- **任务完成度**：S7 共 9 个任务，**1 done（S7-2）、2 partial（S7-3、S7-9）、1 未开始（S7-1）、5 blocked（S7-4/S7-5/S7-6/S7-7/S7-8，均卡在 D2）**。`git log --all --oneline --grep='s7-'` 实测 **9 条**提交，全部为 2026-10-29：S7-2 占 4 条（2 代码 + 2 文档）、S7-3 占 2 条（1 代码 + 1 文档）、S7-9 占 3 条（1 工具 + 2 文档/报告）。
- **本轮实测（2026-10-29，本 worktree）**：3 组定向测试 **9 文件 / 45 passed，3/3 exit 0**；`npm run verify:docs` **fail=0 warn=0，exit 0**；`npx tsc --noEmit` **exit 0**；`node scripts/verify-desktop-release-ready.mjs` **exit 1**（桌面发布冻结，S7-4 未做，符合预期）。
- **2h soak**：历史报告 `perf/reports/soak-2h-20261029.json`（120 min / 120 ticks @60s）**PASS，heap delta −2.58 MB**（阈值 30 MB）；但负载是 **node-only 合成负载（TtlLruCache + hydrationStatus）**，不含浏览器/音频图/IDB/persist 写频，因此 **S7-9 只能判 partial，不能作为 M7 的 2h soak 达标证据**。50MB 起播延迟 **完全未测量**。
- **平台边界（本轮核实）**：仓库里 **不存在 `/api/media` 路由**（全仓 grep = 0）；实际代理是 `/api/audio/proxy`，**只校验 URL 以 "http" 开头，没有 host allowlist / 私网拦截**；FFmpeg **分块已 async 化（配置 + 构建产物双证）**，但 **core 仍从 unpkg 拉取**，离线不可用；Electron preload **20 个方法与 `electron.d.ts` 20 个签名手工一致，但无自动化 parity 测试**，S7-5 规划的 `getRuntimeInfo`/`onBackendStatus` 全部缺失。
- **M7 不能判绿**：TRACKING 行 125 的 4 项出口 **0 项完整达成**（soak 仅 node 合成 partial，OPFS 无结论，插件隔离未做，桌面运行时闭环为 0）；计划 §2.2 的 E1–E10 中 **E9 部分、E10 partial，其余 8 项未达成/未验证**。
- **本轮新发现（诚实登记）**：
  1. **S7-1 从未开工**：`src/services/http/`、`src/services/resolver/` 目录不存在；`MultiSourceResolver.ts` 仍 **1,421 行**、**16 处直接 `fetch(`**（行 435/554/582/612/703/749/778/821/850/893/922/1047/1167/1188/1209/1400）；`EndpointCircuitBreaker` 仍只被调试组件引用。TRACKING 把它标为待办，但没有任何提交。
  2. `/api/media` 是**误记的路由名**：全仓 0 命中；代理播放的真实入口是 `src/app/api/audio/proxy/route.ts`（112 行），且该 route **没有任何 route 级单测**，只有 `proxyDiskCache.test.ts` 覆盖磁盘缓存命中路径的 206。
  3. `/api/audio/proxy` 的 `url` 参数**无 allowlist**：条件只有 `!targetUrl || !targetUrl.startsWith("http")`（`route.ts:29-31`），因此任意以 `http` 开头的 URL（含 `http://127.0.0.1`、`http://169.254.169.254` 等回环/内网地址）都会被服务端 fetch，且该前缀判断连 `httpfoo:` 这类非 http(s) 协议也会放行——这是 S7 明确要求「URL allowlist」但**未实现**的安全缺口。
  4. 2h soak 报告违反 `perf/README.md` §11「reports 生成物不提交」的约定（`perf/reports/soak-2h-20261029.json` 已入库 759 行）——作为证据可接受，但需知悉口径例外。
  5. 本 worktree 的 `.next` 构建产物（BUILD_ID `14Aloa_KTN-1GpcBiPK1R`，mtime 2026-10-29 18:30）**不是本轮构建**，仅用于核实 chunk 归属；`out/` 目录不存在。

## 1. 环境与统计口径

| 项           | 值                                                                                                    |
| ------------ | ----------------------------------------------------------------------------------------------------- |
| OS / shell   | Windows / PowerShell 7（pwsh）                                                                        |
| Node / npm   | v24.16.0 / 11.13.0（本轮 `node -v` / `npm -v`）                                                       |
| 测试框架     | Vitest 4.1.5（jsdom，非 watch）                                                                       |
| 分支 / 基点  | `docs/s7-evidence` ← `98f0da5`（`integration/s2-audio` HEAD）                                         |
| S7 提交数    | `git log --all --grep='s7-' -i` = **9**（代码/工具 4 条、纯文档 4 条、文档+报告 1 条）                |
| 变更行数来源 | `git show --numstat <commit>`（代码 + 测试合并计；文档单列）                                          |
| 定向测试合计 | **9 文件次 / 45 passed / 0 failed，3 条命令全部 exit 0**                                              |
| 构建产物     | `.next/BUILD_ID = 14Aloa_KTN-1GpcBiPK1R`（mtime 2026-10-29 18:30，**非本轮构建**）；`out/` **不存在** |

## 2. S7-1..S7-9 交付与验证

### 2.0 `git log --all --oneline --grep='s7-'`（实测 9 条）

```text
26c2f38 docs(s7-9): record 2h soak result
1e499f5 docs(s7-9): record soak harness
69bff7d test(s7-9): add node soak harness
fb906a3 docs(s7-3): record worker transferables partial
898935d perf(s7-3): transfer audio buffers across workers
56576ab docs(s7-2): mark cache unification done
bc590b2 perf(s7-2b): bound search cache and expose cache stats
2df6a08 docs(s7-2): record TTL LRU cache unification
00f52fd perf(s7-2): unify resolver/prefetch caches behind TTL LRU
```

> 9 条全部是 2026-10-29；无 S7-1/S7-4/S7-5/S7-6/S7-7/S7-8 相关提交（分别 `git log --all --grep=<关键词>` 检索 requestClient / pluginSandbox / next-runtime / standalone / opfs，均为 0 命中；`safeStorage` 的命中是 S1 旧提交，非 S7）。

### 2.1 任务表

| ID   | 状态                   | 代码提交              | 文档提交             | 文件 / 行                                           | 定向测试（本轮实测）                                                                                                     | exit | 证据 / 缺口                                                                                                                                                                          |
| ---- | ---------------------- | --------------------- | -------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| S7-1 | **未开始**             | 无                    | 无                   | 0                                                   | 无                                                                                                                       | —    | `src/services/http/requestClient.ts`、`src/services/resolver/` **不存在**；resolver 1,421 行 / 16 处裸 `fetch`；熔断器未接入请求路径。计划「每模块 ≤300 行、坏 host 请求下降」无证据 |
| S7-2 | **done**               | `00f52fd` + `bc590b2` | `2df6a08`、`56576ab` | 9 文件 / +486 −32（docs 2 文件 +4 −4）              | `src/lib/cache` + `audioPrefetcher.test.ts` + `MultiSourceResolver.test.ts` → 4 文件 / **26 passed**                     | 0    | 3 处缓存全部迁 `TtlLruCache`（300/30min、100/20min、20/25min）；dev-only `window.__MIMI_CACHE_STATS__`；缺：probe 无浏览器手读、计数器不清零、S7-1c 拆分未做                         |
| S7-3 | **partial**            | `898935d`             | `fb906a3`            | 13 文件 / +316 −99（docs 1 文件 +1 −1）             | `workerCapabilities` + `formatConversionWorker` + `WorkerPoolManager` + `DSDConverter.test.tsx` → 4 文件 / **15 passed** | 0    | 3a 完成（transferable + 显式降级）；缺 3b：FFmpeg core 未自托管（仍 unpkg）、池未接入转换组件、50MB 主线程 <50ms **未测**                                                            |
| S7-4 | **blocked（D2）**      | 无                    | 无                   | 0                                                   | 无                                                                                                                       | —    | `app://` 仍从 `out/` 读静态（`electron/main/index.js:36,38-47`）；`verify-next-runtime.mjs`/runtime.js/protocol.js 均不存在；发布 guard **实测 exit 1**                              |
| S7-5 | **blocked（D2）**      | 无                    | 无                   | 0                                                   | 无                                                                                                                       | —    | 无 `backendGateway.ts`/`capabilityStore.ts`；preload 仍 20 个 invoke 方法、无 `getRuntimeInfo`/`onBackendStatus`；12 处调用点未迁移                                                  |
| S7-6 | **blocked（D2）**      | 无                    | 无                   | 0                                                   | 无                                                                                                                       | —    | `whenReady` 仍 `await startBackend()` 后才建窗（`index.js:370-374`）；无 `backend-status` 广播、无 `backend:restart`；`stopBackend` 只 `kill()`（`:149-157`）                        |
| S7-7 | **blocked（D2）**      | 无                    | 无                   | 0                                                   | 无                                                                                                                       | —    | 插件仍在主进程 `vm.Script` 执行（`pluginManager.js:4,37,90`）；无 pluginSandbox/pluginHost/fixtures；`utilityProcess` grep = 0                                                       |
| S7-8 | **blocked（D2、D8）**  | 无                    | 无                   | 0                                                   | 无                                                                                                                       | —    | 5 个 cookie 仍进 partialize（`userAccountStore.ts:340-352`）；无 credentials.js/credentialVault.ts；`safeStorage` 在 `electron/` grep = 0                                            |
| S7-9 | **partial（9a done）** | `69bff7d`             | `1e499f5`、`26c2f38` | 6 文件 / +1,053 −0（含报告 759 行；TRACKING +1 −1） | `scripts/perf/soak.test.mjs` → 1 文件 / **4 passed**                                                                     | 0    | soak harness + 2h node 合成 PASS（−2.58 MB）；**OPFS spike 未做**（`src` opfs grep = 0）、50MB 起播未测、无 CDP/音频节点/FPS/persist 采样                                            |

- 行数为 `git show --numstat` 汇总（代码/测试合并；文档行数在括号或备注中单列）。
- 「N passed」为当次 vitest 输出，包含点名文件内既有用例，不全部归本任务新增。
- 状态判定：**done** = TRACKING 勾选 + 计划验收项有代码与可复跑测试；**partial** = 子 PR 有交付但验收门槛未达；**blocked** = 计划前置决策未拍板，代码零改动。

### 2.2 定向测试明细（2026-10-29，本 worktree 实测）

| 任务  | 命令（`npx vitest run` 后跟文件/目录）                                                                                                                                    | 结果                        | exit |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- | ---- |
| S7-2  | `src/lib/cache src/lib/audio/audioPrefetcher.test.ts src/services/MultiSourceResolver.test.ts`                                                                            | 4 文件 / 26 passed（8.55s） | 0    |
| S7-3  | `src/lib/audio/workerCapabilities.test.ts src/lib/audio/formatConversionWorker.test.ts src/services/WorkerPoolManager.test.ts src/components/audio/DSDConverter.test.tsx` | 4 文件 / 15 passed（1.98s） | 0    |
| S7-9a | `scripts/perf/soak.test.mjs`                                                                                                                                              | 1 文件 / 4 passed（1.40s）  | 0    |
| 合计  | 9 文件次                                                                                                                                                                  | **45 passed**               | 0    |

> 口径：全部为 jsdom 单测 / 纯函数测试；**没有**浏览器、Electron、真实 Worker、FFmpeg wasm、50MB 文件或 2h 播放测量。

### 2.3 逐任务判定说明

**S7-1（未开始）** — 计划要求新增 `requestClient.ts`（超时/AbortSignal/熔断/分类）并把 6 个平台解析器拆到 `src/services/resolver/platform/`。现状：`src/services/http/` 与 `src/services/resolver/` 目录均不存在（`Test-Path` = False）；resolver 仍单文件 1,421 行；16 个 `fetch(` 站点未收口；`EndpointCircuitBreaker` 只被 `AppleAudioSourceInspector.tsx` 与自身测试引用，**未进入任何请求路径**。TRACKING 行 126 的验收（每模块 ≤300 行、坏 host 请求下降）无一项有证据。

**S7-2（done，TRACKING 已勾选）** — 3 处无界缓存换成有界 TTL LRU：

- `src/lib/cache/TtlLruCache.ts`（112 行）：`maxEntries`/`maxAgeMs`/`now`/`onEvict`，`get/set/has/delete/clear/size/prune/stats`，无定时器懒过期（`:104-111`）。
- `MultiSourceResolver.resolvedUrlCache` = 300 项 / 30 min（`:264-267`）；`searchCache` = 100 项 / 20 min（`:951-955`）；`audioPrefetcher.prefetchCache` = 20 项 / 25 min（`audioPrefetcher.ts:26-29`）。
- `src/lib/cache/cacheStats.ts`（55 行）：三缓存 stats 聚合，**仅 development + 有 window** 时挂 `window.__MIMI_CACHE_STATS__` 惰性 getter（`:17-19,35-43`），生产/SSR no-op。
- 测试：TtlLruCache 5 例（LRU/TTL/统计/onEvict/有界）、cacheStats 4 例（形状/每次重算/SSR/非 dev）、resolver 13 例含「长会话下解析缓存不超过 300 条」（`:181`）与「搜索缓存不超过 100 条」（`:288`）、prefetch 4 例。
- 缺口：probe 只有单测，未在浏览器 DevTools 手读；计数器按页面累计且 `clearCache` 不重置；计划里的「S7-1c 收口后替换」改成了原地替换，resolver 拆分仍欠。

**S7-3（partial，3a 完成）** — transferable 与显式降级已落地：

- `workerCapabilities.ts`（35 行）：`canUseWorker/createAudioWorker`，Worker 缺失/构造失败返回 `null` 并给显式 `WORKER_UNAVAILABLE_MESSAGE`（`:10-34`）。
- `formatConversionWorker.ts`：输入 `ArrayBuffer`，`postMessage(message,[fileBuffer])`（`:150`），响应优先 transferred `outputBuffer`（`:110-121`）。
- `conversion.worker.ts`：接收 transferred buffer（`:11,52,65`），返回 `outputBuffer` 并 transfer（`:126-131`）；`dsd.worker.ts` 同（`:244-249`）；两个转换组件 `blob.arrayBuffer()` → transfer（`FormatConverter.tsx:144-148`、`DSDConverter.tsx:181,227,236`）。
- `WorkerPoolManager.ts` 只加了 transferables 转发（`:140-143`）与注释；`terminateAll()` 已存在（`:170`），计划 Step 1 要求的 `getStats()`/`onWorkerUnavailable` **未加**；`waveform`/`fingerprint` worker 标 `@deprecated S7-3`（各自 `:4`）。
- **未达验收**：① 50MB 主线程长任务 <50ms **未测**（无浏览器 Performance 记录）；② FFmpeg core 仍 `https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd`（`conversion.worker.ts:25,31-33`），S7-3b 的自托管/离线能力未做；③ `WorkerPoolManager` 未接入 DSD/FormatConverter（仍各自 `createAudioWorker`）；④ 4 个 worker 归属只完成「标注」，未接入波形/指纹功能。

**S7-4 / S7-5 / S7-6 / S7-7 / S7-8（blocked，D2 未拍板）** — 见 §5.3。共同事实：D2（Windows 桌面运行时形态，推荐 B = 捆绑本地 Next standalone）仍是 `Pending`；ADR 0002 仍是 `Proposed`；桌面打包被 `scripts/verify-desktop-release-ready.mjs` 冻结（实测 exit 1）。这 5 个任务在代码层 **零改动**（对应文件/目录全部不存在），不是「做了一半」。依赖链：D2 → S7-4a/b/c → S7-5a（preload runtimeInfo）→ S7-6/7/8；S7-7/S7-8 另需 D8（第三方源与凭据边界，同样 Pending）。

**S7-9（partial，9a done）** — soak harness 与 2h 结论见 §4；OPFS spike 完全未做（`src` 全仓 `opfs` grep = 0，`scripts/perf/bench-opfs.mjs` 不存在），50MB 起播延迟未测，CDP 播放 soak（`soak-playback.mjs`）未写。

## 3. 平台边界证据（逐项）

### 3.1 汇总判定

| #   | 边界声明                             | 判定                                    | 证据                                                                                                                             |
| --- | ------------------------------------ | --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 存在 `/api/media` 代理路由           | **不存在（UNVERIFIED）**                | 全仓 grep `api/media` = **0**；真实入口为 `/api/audio/proxy`                                                                     |
| 2   | 代理 URL 有 allowlist                | **未实现（UNVERIFIED）**                | 仅 `startsWith("http")`（`route.ts:29-31`）；无 host/私网校验                                                                    |
| 3   | Range/206 与流式透传                 | **partial（结构 verified，live 未测）** | `route.ts:60-62,92-102,104-107`；缓存命中 206 有测试（`proxyDiskCache.test.ts:30-57`），route 无测试                             |
| 4   | FFmpeg 走动态分块                    | **verified（配置 + 构建产物）**         | `next.config.js:47-53`；`.next/static/chunks/chunk-ffmpeg.38b43ff0b2d7dca9.js`（6,451 B），不在 rootMainFiles、index.html 引用 0 |
| 5   | FFmpeg 可离线（core 自托管）         | **未实现（UNVERIFIED）**                | 构建产物内含 `unpkg.com/@ffmpeg/core`；`conversion.worker.ts:25`                                                                 |
| 6   | Electron preload 类型与实现一致      | **partial（手工 verified，无自动化）**  | preload 20 方法 vs `electron.d.ts:8-32` 20 签名；无 parity 测试                                                                  |
| 7   | preload 暴露 runtimeInfo/diagnostics | **缺失（UNVERIFIED）**                  | `getRuntimeInfo`/`onBackendStatus`/`getRuntimeDiagnostics` 全仓 0 命中                                                           |
| 8   | `app://app` 桥接到本地 Next          | **未实现（UNVERIFIED）**                | `protocol.handle("app")` 仍读 `out/`（`index.js:36,38-47`）                                                                      |

### 3.2 `/api/media` vs `/api/audio/proxy`

- `/api/media`：**不存在**。仓库 30 个 route 文件中无此路径（`src/app/api/**/route.ts` 清单可复核），全仓文本 grep 也是 0。任何把「`/api/media` 代理路由」写成既成事实的表述都应修正为 `/api/audio/proxy`。
- `/api/audio/proxy` **存在**：`src/app/api/audio/proxy/route.ts`（112 行），`GET/HEAD/OPTIONS`（`:9-23`），磁盘 LRU 缓存命中优先（`:36-44`），未命中回源并 tee 写盘（`:64-107`）。
- 客户端入口：`getPlayableStreamUrl` 把所有外部 `http(s)` 直链改写成该代理（`useAudioPlayer.ts:316-321`），本地 `blob:/data:/local://` 原样返回（`:301-309`）。
- 测试覆盖：**route handler 无单测**；`src/lib/audio/proxyDiskCache.test.ts` 3 例只测磁盘缓存（含缓存命中 206、`Content-Range`、`X-Cache: HIT`，`:30-57`）。因此「代理路由返回 206/流式」属于**结构可读、未运行时验证**。

### 3.3 URL allowlist（安全缺口，verified absence）

- `route.ts:29-31` 唯一校验：`if (!targetUrl || !targetUrl.startsWith("http")) return 400`。这允许任意以 `http` 开头的 URL 指向任意 host，包括回环与内网地址；也没有真正的协议白名单（`httpfoo:` 这类前缀同样会通过），更无私网/重定向校验。
- `proxyDiskCache.ts` 只用 `sha256(url)` 当键（`:28-30`），缓存目录固定 `.cache/audio_stream`（`:14`），因此**没有路径穿越**，但也**没有 host 级隔离**。
- 计划 S7-4c/S7-5 要求「外部请求带超时+取消+熔断」与桥接白名单；当前代理既无 allowlist，也无超时/取消（`fetch(targetUrl,{headers})` 无限期，`:65-67`）。
- 建议（不属本文档改动范围）：host allowlist + 私网/回环拒绝 + `AbortSignal.timeout`，并补 route 级测试（含 400/403/206）。

### 3.4 FFmpeg 分块动态加载（verified 结构 + 构建）

- 配置：`next.config.js:47-53` 定义 `chunk-ffmpeg`，`test: /@ffmpeg/`、`chunks:"async"`、`priority:35`，即 `@ffmpeg/*` 只进异步块。
- 代码路径：`audioProcessingStore.ts:211-212` 使用 `await import("@ffmpeg/ffmpeg")` / `await import("@ffmpeg/util")`（S4 既有行为）；转换 worker 内部仍是静态 `import { FFmpeg } from "@ffmpeg/ffmpeg"`（`conversion.worker.ts:3`）。worker 由转换组件经 `createAudioWorker(new URL(...))` 按需创建，本次只核对了 `chunk-ffmpeg` 不在首屏，未逐 chunk 核对全部 worker 产物。
- 构建产物（**非本轮构建**，BUILD_ID `14Aloa_KTN-1GpcBiPK1R`）：`.next/static/chunks/chunk-ffmpeg.38b43ff0b2d7dca9.js` 存在，**6,451 B**；`build-manifest.json` 的 `rootMainFiles` 仅 3 个（webpack/vendor-core/main-app）；`.next/server/app/index.html` 中 `chunk-ffmpeg` 引用 **0**。
- **未验证/未达标**：FFmpeg core（`ffmpeg-core.js`/`.wasm`，约 30MB 量级）仍运行时从 unpkg 拉取（`conversion.worker.ts:25,31-33`），构建产物里可搜到该 URL；断网/桌面离线转换会失败。`src/lib/perf/lazyImports.test.ts:7` 的懒加载守卫只覆盖 `jsmediatags`/`crypto-js`，**不含 `@ffmpeg`**。S7-3b 的 `canUseFFmpeg`/`FFMPEG_UNAVAILABLE` 未实现（`workerCapabilities.ts` 只有 Worker 能力）。

### 3.5 Electron preload 类型状态

- 运行时实现：`electron/preload/index.js` 36 行，`contextBridge.exposeInMainWorld("electronAPI")` 暴露 **20 个方法**（`:3-32`）：8 个歌词/桌面窗口方法 + `getBackendStatus` + 5 个插件方法 + 5 个事件订阅 + `removeAllListeners`。
- 类型声明：`src/types/electron.d.ts` 41 行，`ElectronAPI` **20 个签名**（`:8-32`），`window.electronAPI?` 与 `isDesktopLyricsMode?`（`:34-39`）。**逐项手工比对一致**（名称/参数数量）。
- 窗口安全基线在位：`contextIsolation: true`、`nodeIntegration: false`、preload 绝对路径（`electron/main/index.js:188-192`）。
- **缺口**：① 没有「preload 导出 vs d.ts」自动化 parity 测试（全仓无相关用例），类型靠人工维护；② S7-5a 规划的 `getRuntimeInfo()`/`onBackendStatus(cb)`/`getRuntimeDiagnostics()` 未实现（全仓 0 命中），因此「API 基址唯一来源 runtimeInfo」不成立；③ 现有 `getBackendStatus` 只有轮询式 invoke（`:12`），没有事件通道。

### 3.6 `app://` origin 与桌面运行时（补充边界事实）

- `protocol.registerSchemesAsPrivileged` 已注册 `app`（standard/secure/supportFetchAPI/corsEnabled，`index.js:13-20`），`protocol.handle("app")` 用 `resolveStaticPath` 从 `out/` 读文件（`:36-47`）；生产窗口 `loadURL("app://app/")`（`:197-198`）。
- 因此当前 `app://` 只服务**静态导出的 HTML**，**没有** loopback 反向代理、没有 `/api/*` 透传、没有 Range/SSE/Cookie 改写——S7-4c/E2 的桥接能力为零。
- `resolveStaticPath` 的路径约束（拒绝 `..`、前缀校验）有 3 个用例（`electron/main/staticPath.test.js`），这是当前唯一有测试的桌面边界模块。
- `electron/main/index.js` 389 行仍是 S0 时的静态窗口 + 内置后端同步启动；`runtime.js`/`protocol.js`/`error.html`/`splash.html` 均不存在。

## 4. S7-9 soak 证据（2h）与 50MB 起播

### 4.1 2h 结果（历史记录，非本轮重跑）

来源：[S7-9-soak-2h-20261029.md](./S7-9-soak-2h-20261029.md)；原始报告 `perf/reports/soak-2h-20261029.json`（759 行，已入库，commit `26c2f38`）。

| 指标                    | 值                                                                           |
| ----------------------- | ---------------------------------------------------------------------------- |
| 运行窗口                | 120 min / **120 ticks** @ 60s（`durationMinutes:120`、`intervalSeconds:60`） |
| 时间戳                  | `generatedAt: 2026-10-29T07:25:28.780Z`（UTC）= 15:25 Asia/Shanghai          |
| heap start / peak / end | **27.15 MB / 31.90 MB / 24.57 MB**                                           |
| heap delta              | **−2.58 MB**（阈值 30 MB）                                                   |
| peak delta              | +4.75 MB                                                                     |
| 结果                    | **PASS**（`passed: true`，记录 exit 0）                                      |
| 负载                    | sets 30,000 / gets 48,000 / pruned 17,700 / transitions 480                  |
| cache                   | 400/400 项，hitRate **28.97%**，evictions 29,600                             |
| hydration               | 16 listeners，最终 `ready`                                                   |
| 判定公式                | `passed = deltaMB <= thresholdMb`（`scripts/perf/soak.mjs:172`）             |

同 harness 的 1 min 记录（`perf/README.md` §11）：60 ticks，27.15→27.46 MB，delta **+0.31 MB**，PASS。

### 4.2 这份 soak 覆盖了什么 / 没覆盖什么

| 计划 E10 / S7-9b 要求                 | 当前证据                                                               | 状态                     |
| ------------------------------------- | ---------------------------------------------------------------------- | ------------------------ |
| heap 2h 增长 <30 MB                   | node 进程 `heapUsed`，delta −2.58 MB                                   | **达成（仅 node 合成）** |
| `activeAudioNodes` 增量 0             | 无（脚本不加载浏览器/音频图；S2-5 计数器未在该 harness 使用）          | **未测**                 |
| `mediaBridgeListeners` 恒 12          | 无                                                                     | **未测**                 |
| `persistWritesPerSec ≤1`              | 无（不跑 renderer）                                                    | **未测**                 |
| `idbBytes` 不单调增长                 | 无                                                                     | **未测**                 |
| 20 首 fixture 循环播放/暂停/seek/切歌 | 无（合成 TtlLruCache + hydrationStatus 负载，`soak.mjs:30-36,39-85`）  | **未测**                 |
| 报告 JSON 入库                        | 有（`perf/reports/soak-2h-20261029.json`）                             | **达成**                 |
| OPFS 大文件 spike                     | 无（`opfsAudioStore.ts`/`bench-opfs.mjs` 不存在，`src` opfs grep = 0） | **未做**                 |

> 结论：S7-9a「工具完成 + 一次 2h 长跑」成立；S7-9b「播放/浏览器泄漏上界」**不成立**。因此 S7-9 整体 partial，M7「2h soak 达标」不能勾。

### 4.3 50MB 起播延迟：**未测量**

- 计划要求：S7-9a「50MB FLAC 起播长任务 <100ms 或记录原因」（`S7-platform-runtime.md:97,432`）；E9「50MB 转换主线程长任务 <50ms」（`:33`）。
- 现状：**没有任何测量产物**——无 `bench-opfs.mjs`、无 `opfsAudioStore`、无 Performance 面板记录、无 `p50/p95/max` JSON；也没有「未达标原因」的实测数据，只有「未执行」这一事实。
- 应如何补（供后续执行）：生成/复用 50MB FLAC fixture → 分别走 IDB 旧路径与 OPFS（feature flag）→ 记录起播前主线程 long task 与峰值内存，5 次样本出 p50/p95/max，写入 `evidence/S7-9-opfs.md`。在此之前**不得**声称该验收项达成。

## 5. M7 出口门 checklist 与 D2 决策表

### 5.1 TRACKING 行 125 的 M7 四项

| #   | M7 项                                                                                         | 状态                           | 证据 / 阻塞原因                                                                                                                                                                                         |
| --- | --------------------------------------------------------------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 桌面本地运行时闭环（窗口 <3s、`/` 与 `/data-manager` 200、旧 origin 数据可见、在线能力/降级） | **未达成（blocked D2）**       | 运行时/协议/健康检查代码全缺；`protocol.handle("app")` 仍读 `out/`；`out/` 在本 worktree 不存在；`verify-desktop-release-ready.mjs` **exit 1**；无 `--dir` 产物、无冷启动/200/旧 origin 任一 smoke 记录 |
| 2   | 插件隔离                                                                                      | **未达成（blocked D2→S7-5a）** | `pluginManager.js:4,37,90` 仍在主进程 `vm.Script` 执行插件；`utilityProcess` 0 引用；无恶意 fixture/权限白名单（E6 无证据）                                                                             |
| 3   | 2h soak 达标                                                                                  | **partial**                    | node 合成 2h PASS（−2.58 MB），但无音频节点/监听/persist/IDB/浏览器指标（§4.2）；不能作为 M7 播放 soak 证据                                                                                             |
| 4   | OPFS 有结论                                                                                   | **未达成**                     | OPFS 零代码、零 benchmark、零结论                                                                                                                                                                       |

### 5.2 计划 §2.2 E1–E10

| ID  | 出口                                                    | 状态                           | 证据 / 缺口                                                                                                     |
| --- | ------------------------------------------------------- | ------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| E1  | standalone 可构建/启动/退出/校验                        | **未达成**                     | 无 `build:desktop-runtime` 脚本、无 `verify-next-runtime.mjs`、无 runtime owner；发布 guard exit 1              |
| E2  | `/` 与 `/data-manager` 经 `app://app` 200 且可交互      | **未验证**                     | 构建产物有 `index.html`/`data-manager.html`，但无 loopback 桥接、无 packaged smoke                              |
| E3  | 旧 origin 44 key / 5 IDB 升级后可读                     | **未验证**                     | 无升级前快照、无 canary、无 diagnostics；origin 理论上未变但无实测                                              |
| E4  | 搜索/解析/歌词/封面/代理播放 5 链路有结果               | **未验证（代理结构部分在位）** | `/api/audio/proxy` 存在但无 route 测试；桌面端未跑；FFmpeg core 依赖 CDN                                        |
| E5  | 后端异步启动/状态可观察/可重启/无残留                   | **未达成**                     | `await startBackend()` 阻塞建窗（`index.js:370-374`）；无广播/重启 IPC；`stopBackend` 仅 `kill()`（`:149-157`） |
| E6  | 插件沙箱：恶意 fixture 无法读文件/执行命令              | **未达成**                     | 无 `pluginSandbox.js`/fixtures；主进程 vm 现状                                                                  |
| E7  | 凭据不明文进 localStorage / 可迁移回读                  | **未达成**                     | 5 个 cookie 仍在 partialize（`userAccountStore.ts:340-352`）；无 `safeStorage`/`credentials.js`                 |
| E8  | resolver 每模块 ≤300 行、请求有超时+取消+熔断、缓存有界 | **未达成（缓存项达成）**       | resolver 1,421 行、16 处裸 fetch、熔断未接入；缓存有界已由 S7-2 达成                                            |
| E9  | 4 worker 归属 + transferable + 显式降级；50MB <50ms     | **partial**                    | transferable/降级/标注完成；池未接入、core 未自托管、50MB 未测                                                  |
| E10 | 2h soak 指标达标或记录未达标原因                        | **partial**                    | node 合成 PASS；播放/IDB/persist/FPS 未测（§4.2）                                                               |

### 5.3 D2 决策表（S7-4..S7-8 的共同阻塞根因）

来源：`00-decisions.md:23`（D2 = **Pending**，推荐 B）、`docs/nbl/adr/0002-desktop-runtime.md:3`（状态 **Proposed**）、`scripts/verify-desktop-release-ready.mjs:10-17`（frozen 时 exit 1）。

| 选项      | 内容                                                                                   | 证据                                                                                                                                   | 影响                                                 | 状态                      |
| --------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | ------------------------- |
| A         | 静态导出 `out/`（旧路径）                                                              | S0-3 实测 `output: export` 在 31 个 API route 上失败（guard 注释 `:4-9`）；guard 记录 `out/` 陈旧（2026-07-30），本 worktree 无 `out/` | 不可行（除非砍掉在线能力）                           | **已排除**                |
| B（推荐） | 捆绑本地 Next standalone + `app://` 协议桥接 + BackendGateway；保留 `app://app` origin | ADR 0002 决策段；S7-4a/b/c 设计                                                                                                        | 解锁 S7-4/5/6；S7-7/8 依赖其 preload                 | **待用户拍板（Pending）** |
| C（退路） | 窗口直接加载 `http://127.0.0.1:port`                                                   | 计划 S7-4 风险段（O-2）                                                                                                                | 触发一次 origin 迁移与 44 key 数据迁移，需 Lead 批准 | **未批准**                |

| 决策                 | 当前值               | 状态        | 阻塞任务                          | 拍板人              | 不拍板的后果                                                                           |
| -------------------- | -------------------- | ----------- | --------------------------------- | ------------------- | -------------------------------------------------------------------------------------- |
| D2 桌面运行时形态    | B（推荐）            | **Pending** | S7-4、S7-5、S7-6；间接 S7-7、S7-8 | 用户 / Lead         | 桌面发布持续冻结（guard exit 1）；M7 出口第 1 项无法开工；S7-5a preload 缺失连带 6/7/8 |
| D8 第三方源/凭据边界 | A（明示 + 用户确认） | **Pending** | S7-7 授权文案、S7-8 迁移范围      | 用户 / Lead（合规） | 即使 D2 拍了，S7-7/8 的同意流与 Web 提示无法定稿                                       |

> 说明：S7-7/S7-8 的**直接**前置是 S7-5a（preload/事件通道），而 S7-5a 的前置是 S7-4c；因此把它们统一标注为「blocked on D2」在依赖链上成立，同时 D8 是第二重阻塞（合规文案/迁移策略）。

## 6. 缺失产物清单（计划 vs 现状）

| 计划产物                                                                         | 现状                                                                                     |
| -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `src/services/http/requestClient.ts`（S7-1a）                                    | **不存在**；`src/services/http/` 目录不存在                                              |
| `src/services/resolver/platform/{netease,qq,kugou,kuwo,qishui,lx}.ts`（S7-1b/c） | **不存在**；`src/services/resolver/` 目录不存在                                          |
| `electron/main/runtime.js`（S7-4b）                                              | **不存在**                                                                               |
| `electron/main/protocol.js`（S7-4c）                                             | **不存在**                                                                               |
| `electron/error.html` / `electron/splash.html`（S7-4b/c）                        | **不存在**（`staticPath.js` 存在且有 3 个用例）                                          |
| `scripts/verify-next-runtime.mjs`（S7-4a）                                       | **不存在**；`package.json` 无 `build:desktop-runtime` 脚本                               |
| `scripts/prepare-desktop-runtime.mjs`（S7-4a）                                   | **不存在**                                                                               |
| `scripts/perf/desktop-smoke.mjs`（§6.1/6.2）                                     | **不存在**                                                                               |
| `src/app/api/runtime/health/route.ts`（S7-4b）                                   | **不存在**                                                                               |
| `src/lib/api/backendGateway.ts`/`capabilityStore.ts`（S7-5）                     | **不存在**                                                                               |
| `src/components/shared/BackendStatusBanner.tsx`（S7-5b/6b）                      | **不存在**                                                                               |
| `electron/main/pluginSandbox.js`/`pluginPermissions.js`/`pluginHost.js`（S7-7）  | **不存在**                                                                               |
| `electron/main/__fixtures__/`（恶意 fixture，S7-7）                              | **不存在**                                                                               |
| `electron/main/credentials.js`/`src/lib/security/credentialVault.ts`（S7-8）     | **不存在**                                                                               |
| `src/lib/storage/opfsAudioStore.ts` + `opfsAudioStore.test.ts`（S7-9a）          | **不存在**（`src` opfs grep = 0）                                                        |
| `scripts/perf/bench-opfs.mjs`（S7-9a）                                           | **不存在**                                                                               |
| `scripts/perf/soak-playback.mjs`（S7-9b，CDP 播放 soak）                         | **不存在**；现有 `soak.mjs` 是 node 合成负载                                             |
| `docs/nbl/plans/evidence/` 目录 + `S7-desktop-smoke.md` / `S7-soak.md`（§6.5）   | **目录不存在**；实际证据落在执行包 `evidence/S7-9-soak-2h-20261029.md`（命名与计划不同） |
| `runtime-manifest.json` 产物 / `userData/logs/runtime.log` 样例（§6.5）          | **不存在**（无 desktop runtime）                                                         |
| 回退演练 F1–F5 记录（§6.4）                                                      | **全部不存在**                                                                           |

## 7. 复现命令

在 `D:/26project/music_source_code_V1.1_full/_worktrees/arch-integration-s1-5`（分支 `docs/s7-evidence`）执行：

```bash
# 1) 提交清单与变更量
git log --all --oneline --grep='s7-' -i
git show --numstat --format='COMMIT %h %s' 00f52fd 2df6a08 bc590b2 56576ab 898935d fb906a3 69bff7d 1e499f5 26c2f38

# 2) S7-2 定向测试（4 文件 / 26 passed，exit 0）
npx vitest run src/lib/cache src/lib/audio/audioPrefetcher.test.ts src/services/MultiSourceResolver.test.ts --reporter=dot

# 3) S7-3 定向测试（4 文件 / 15 passed，exit 0）
npx vitest run src/lib/audio/workerCapabilities.test.ts src/lib/audio/formatConversionWorker.test.ts \
  src/services/WorkerPoolManager.test.ts src/components/audio/DSDConverter.test.tsx --reporter=dot

# 4) S7-9a harness 测试（1 文件 / 4 passed，exit 0）
npx vitest run scripts/perf/soak.test.mjs --reporter=dot

# 5) 静态门禁（本轮均 exit 0）
npx tsc --noEmit
npm run verify:docs          # fail=0 warn=0

# 6) 桌面运行时现状（预期 exit 1，冻结）
node scripts/verify-desktop-release-ready.mjs

# 7) 2h soak 复跑（约 2h；报告写入 perf/reports/soak-<ts>.json，生成物，勿提交）
node scripts/perf/soak.mjs --duration 120 --interval 60 --threshold-mb 30
# 快速冒烟：node scripts/perf/soak.mjs --quick 1

# 8) 2h 报告字段核对（不重跑）
node -e "const r=require('./perf/reports/soak-2h-20261029.json'); console.log(JSON.stringify({durationMinutes:r.durationMinutes,intervalSeconds:r.intervalSeconds,ticks:r.ticks,memory:r.memory,passed:r.passed},null,2))"

# 9) 平台边界静态核对
rg -n "api/media" .                                   # 0 命中
rg -n 'startsWith\("http"\)' src/app/api/audio/proxy/route.ts   # 仅 scheme 校验
ls .next/static/chunks | rg ffmpeg                    # chunk-ffmpeg（需已有构建产物）
rg -n "unpkg.com/@ffmpeg/core" .next/static/chunks/chunk-ffmpeg*.js
```

计划 §5/§6 中**当前不可执行**的命令（如实登记）：

```text
npm run build:desktop-runtime            # script 不存在
node scripts/verify-next-runtime.mjs     # 文件不存在
node --test electron/main/pluginSandbox.test.js   # 文件不存在
node scripts/perf/soak-playback.mjs --duration=600  # 文件不存在
node scripts/perf/bench-opfs.mjs         # 文件不存在
```

> 本轮未执行：`npm run build`、`npm run dev`、Electron/`electron-builder --dir`、浏览器 smoke、CDP、2h 重跑；未 push，未触碰主工作区。

## 8. 结论、风险与建议顺序

- **可以确认**：S7-2 的 3 处缓存有界化与 dev 探针真实存在且测试通过；S7-3a 的 transferable 发送/返回与 Worker 不可用显式降级有代码 + 4 文件单测（合计 9 文件次 / 45 passed）；S7-9a 的 node soak harness 可复跑，2h 报告入库且 heap delta 为负；平台侧 `/api/audio/proxy` 与 `app://` 静态协议的现状可逐行核实；`tsc`/docs 门禁绿。
- **不能确认**：任何桌面运行时闭环、插件隔离、凭据加密、OPFS、50MB 起播、播放 2h 泄漏、`app://` 桥接 200/Range/SSE/Cookie、代理 allowlist。**S7 不能关闭，M7 不能判绿。**
- **风险（按严重度）**：① `/api/audio/proxy` 无 allowlist/超时，服务端可被诱导请求任意 host（SSRF 面）；② FFmpeg core 走 CDN，桌面离线转换必失败且当前错误路径不是 `FFMPEG_UNAVAILABLE`；③ D2 长期 Pending 使桌面发布持续冻结（guard exit 1），S7-5a 缺失导致 6/7/8 无法并行；④ 2h soak 的「达标」容易被误读为播放达标（实际仅 node 合成）。
- **建议的解锁顺序**：① 用户拍板 **D2=B**（并确认 D8=A），把 ADR 0002 转 Accepted；② 并行推进 **S7-1a/b/c**（不依赖 D2，可立即开工，先补 requestClient + allowlist/超时）；③ D2 落地后按 S7-4a→4b→4c→5a→5b→6→7→8 串行；④ S7-9b 做 OPFS spike + 50MB 起播采样 + CDP 播放 soak，再评审 M7；⑤ 在 M7 评审前补 §6 缺失的 8 类证据（桌面 smoke、旧 origin 快照、插件 fixture、凭据迁移、OPFS、50MB、F1–F5）。
- **回退**：S7 已合入的部分无 feature flag（缓存与 transferable 是行为等价替换），按提交粒度 revert 即可；S7-2 回退需同时还原 3 处调用点（各 2–3 行），S7-3 回退需还原 worker 消息契约（`outputBlob` 兼容分支仍在，旧 worker 可读）。桌面/插件/凭据均未落地，无回退面。
