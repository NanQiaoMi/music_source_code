# S7 执行计划：服务与平台边界（实现级）

## 1. 元信息

| 项 | 内容 |
|---|---|
| 计划 ID | 2026-10-21-arch-perf-execution / S7 |
| 上游计划 | `docs/nbl/plans/2026-10-21-architecture-performance-optimization.md` §S7（任务 S7-1..S7-9）、§4.6、§7、§9.4 |
| 依据审计 | C：`scratch/architecture-audit-2026-10-21/runtime-audio-audit.md`（P0-3、P1-5/6/7/8、P2-5、§5.3、§6 Wave 4/5）；D：`scratch/architecture-audit-2026-10-21/build-quality-audit.md`（P0-1/P0-2/P1-6、§5.2/§5.3、附录 O）；前置设计：分支 `docs/architecture-performance-plan` 的 `docs/nbl/specs/2026-10-20-architecture-performance-design.md` 阶段 5（standalone、origin/`app://` 桥接） |
| 基线 | 分支 `feature/gesture-air-control-overhaul` @ `c73a872`（含 55 项未提交手势改动，约 17.3k 行）；S7 从 S0-1 处理后的干净 worktree 开始 |
| 本阶段估算 | 9 个任务 / 19 个子 PR / 约 4,300 变更行（不含测试；测试变更不计 400 行限制，PROCESS.md:131-136）。较总计划「9 个 PR / 约 2,800 行」上调，原因：审计 D 的 CI/打包门禁拆分 + 每 PR ≤400 行硬约束（总计划 §1.3 I6），见 §8 O-8 |
| 证据口径 | 代码引用均经 `read`/`grep` 核实并给 `文件:行号`；`[推断]` = 静态推导需实测；`待核实` = 本轮未取到直接证据 |
| 写法 | 中文；标识符/路径/命令保留英文；Step 编号可执行、可验收；每个子 PR 独立回滚 |

## 2. 阶段目标与出口

### 2.1 目标（对应总计划 §S7）

把「平台边界」从隐式假设变成显式契约：**浏览器 = Next 服务直达；Windows 桌面 = 本地 Next standalone 运行时 + `app://app` origin 桥接；FastAPI = 独立能力边界**。同时完成服务层（resolver/cache/worker）与安全项（插件沙箱、凭据加密）的可测试收敛。

### 2.2 出口（全部满足才关闭 S7）

| # | 出口标准 | 量化/证据 | 对应总计划 |
|---|---|---|---|
| E1 | 桌面运行时闭环：standalone 产物可构建、可启动、可退出、可校验 | `scripts/verify-next-runtime.mjs` exit 0；打包 `--dir` 冷启动窗口可见 <3s；退出后 0 残留 node/backend 子进程 | §9.4 |
| E2 | 主窗口 `/` 与 `/data-manager` 经 `app://app` 桥接返回 200 且页面可交互 | CDP/手工 smoke 记录 URL、status、标题；`/api/search` 返回 JSON 非 404 | §9.4 |
| E3 | **旧 origin 数据可见**：`app://app` 的 44 个 localStorage key 与 5 个 IndexedDB 库升级后可读 | 升级前快照 vs 升级后断言脚本输出一致（§6.3） | §9.4、I1 |
| E4 | 在线能力可用或显式降级：搜索/解析/歌词/封面/代理播放 5 条链路在桌面端有明确结果 | 冒烟 JSON：每条 `ok` 或 `degraded + reason`；无未捕获异常 | §9.4、§7 R11 |
| E5 | 后端异步启动、状态可观察、可重启、退出无残留 | 状态事件序列 `starting→ready` → `error` 可记录；故障时窗口 <3s；`backend:restart` 可用 | §9.4 |
| E6 | 插件沙箱：恶意 fixture 无法读文件/执行命令/逃逸到主进程 | `node --test electron/main/pluginSandbox.test.js` 全绿；fixture 结果 `PERMISSION_DENIED` | §9.4 |
| E7 | 凭据：桌面端平台 cookie 不再明文存入 localStorage；旧数据自动迁移且可回读 | 迁移测试断言 localStorage JSON 不含 cookie；vault 回读一致 | §9.4、D8 |
| E8 | 服务层收敛：resolver 每个模块 ≤300 行、所有外部请求带超时+取消+熔断；缓存有界 | `wc -l` 断言；坏 host 冒烟请求数下降；LRU/TTL 单测 | S7-1/2 验收 |
| E9 | Worker：4 个 worker 有明确归属（接入或删除），大 buffer 使用 transferable，Worker 不可用有显式降级 | 50MB 转换主线程长任务 <50ms；降级单测 | S7-3 验收 |
| E10 | 长会话有结论：2h soak 指标达标或记录未达标原因 | heap 增长 <30MB、activeAudioNodes 增量 0、监听数恒定；JSON 报告入库 | S7-9 验收 |

### 2.3 非目标（本阶段不做）

- 不做 S8 的 CI 全量门禁/覆盖率/文档事实流水线（仅复用 S0-2 的 CI 骨架与 S8-1 的 job 占位）。
- 不迁移用户数据到 OPFS（S7-9 仅 spike + 结论，迁移留待 S8-6 长期项）。
- 不改 V7 受保护视图（Home/Player/全屏歌词）；不改 44 个 persist key 的语义，不删旧 key（I1）。
- 不重写播放核心（S1/S2 职责）；S7 只消费 S1-8 的 AbortSignal 与 S2-5 的泄漏计数器。

## 3. 前置与不变量

### 3.1 前置（缺一不可）

| 前置 | 提供者 | 本阶段如何消费 | 未完成时的降级 |
|---|---|---|---|
| P1 干净树 + 基线 commit | S0-1 | 所有子 PR 从同一基线分叉 | 阻塞全部 S7（R1） |
| P2 CI 触发 master + tsc/lint/test | S0-2 | 每个子 PR 的必需检查 | 人工按 §6.1 顺序本地验证 |
| P3 构建产物/端口明确化 | S0-3 | S7-4 的 `build:desktop-runtime`、端口常量 3025 与动态 loopback | S7-4 先冻结桌面发布 |
| P4 测量基座（播放 mark/指标） | S0-6 | S7-9 soak 复用指标字段 | 用 §6.4 的最小采样脚本 |
| P5 AbortSignal 贯穿 resolver/cache | S1-8 | S7-1 request 包装直接接收 signal；S7-5 fetchApi 透传 | S7-1 先只做超时+熔断，取消后补（不合并后续） |
| P6 泄漏计数器/集合上界 | S2-5 | S7-9 的 activeAudioNodes/mediaBridgeListeners 采样 | soak 只测 heap/IDB |
| P7 决策 D2（桌面捆绑本地 Next）与 D8（第三方源/凭据边界） | 总计划 §8 | S7-4/S7-7/S7-8 的形态与合规文案 | 按推荐值 D2=B、D8=A 执行，记录待确认 |

### 3.2 不变量（违反即回滚）

- **I1 数据兼容**：不重命名/删除 44 个 persist key、5 个 IndexedDB 库与备份 envelope；凭据迁移只改「存哪里」，不改 key 名与字段可读性。
- **I2 播放连续性**：任何平台/网关/插件改动不得重建 audio 元素、不得重置进度。
- **I3 单一事实源**：API 基址唯一来源 `runtimeInfo`；插件能力唯一来源主进程白名单；后端状态唯一来源 main 的 `backendState`。
- **I4 资源有 owner**：runtime 子进程、utilityProcess、health 轮询、端口占用、日志流都有创建者与释放函数（见各任务 Step）。
- **I5 受保护界面**：不修改 `HomeView/PlayerView/FullscreenLyrics`；S7-6/S7-7 的 UI 挂载点若必须动 `GlobalClientComponents.tsx`（手势分支已修改，`git status` 可证），必须等 S0-1 合并后由单人串行提交。
- **I6 每 PR ≤400 行**：见 §4 子 PR 拆分；纯移动/删除如超限需在 PR 描述申请例外（PROCESS.md）。
- **I7 验证顺序**：`eslint → vitest → tsc --noEmit → build → clean-port/dev → HTTP smoke → CDP/Electron smoke`；禁止并行 build 与 tsc，禁止 dev 存活时 clean `.next`（ROADMAP.md:105-107、审计 D §7.3）。

### 3.3 写作用域与并行轨道（按总计划 §7.4）

| 轨道 | 负责子 PR | 写入范围（advisory） | 不可并行前提 |
|---|---|---|---|
| T1 服务层 | S7-1a/b/c、S7-2a、S7-3a/b | `src/services/**`、`src/lib/cache/**`、`src/workers/**`、`src/components/audio/{DSDConverter,FormatConverter}.tsx` | 与 T2 不共享文件即可并行 |
| T2 桌面平台 | S7-4a/b/c、S7-5a/b、S7-6a/b | `electron/main/**`、`electron/preload/**`、`scripts/**`、`next.config.js`、`package.json`、`.github/workflows/**`、`src/lib/api/**` | 共享文件（package.json/preload/index.js/main/index.js）必须串行，同一时刻单一 owner |
| T3 安全与数据 | S7-7a/b、S7-8a/b、S7-9a/b | `electron/main/plugin**`、`src/lib/security/**`、`src/store/userAccountStore.ts`、`src/lib/storage/opfsAudioStore.ts`、`scripts/perf/**` | S7-7 与 S7-8 都改 preload → 串行；S7-9 独立 |

## 4. 任务总表（19 个子 PR，顺序即建议合并顺序）

| 子 PR | 任务 | 主要文件（新增*） | 依赖 | 预估行 | 风险 | 量化验收 |
|---|---|---|---|---|---:|---|---|
| S7-0 | 预检：能力/使用情况核对（不单独 PR） | 只读 | P1 | 0 | 低 | 产出 §4.1 核对结论与待核实清单 |
| S7-1a | 统一请求包装 + 熔断接入 | `src/services/http/requestClient.ts*`、`src/services/EndpointCircuitBreaker.ts` | P5 | ~360 | 中 | 超时/取消/熔断单测；坏 host 跳过 |
| S7-1b | 抽 `platform/netease`+`qq`，迁移到 requestClient | `src/services/resolver/platform/*`、`MultiSourceResolver.ts` | S7-1a | ~380 | 中高 | 模块 ≤300 行；现有 resolver 测试全绿 |
| S7-1c | 抽 kugou/kuwo/qishui/lx + 搜索/歌词封面，facade 收口 | `src/services/resolver/**`、`MultiSourceResolver.ts` | S7-1b | ~400 | 中高 | 同上；公开 API 0 变化（类型导出快照测试） |
| S7-2a | 统一 LRU+TTL 缓存并替换 3 处缓存 | `src/lib/cache/lruTtlCache.ts*`、resolver/prefetcher | S7-1c | ~300 | 中 | 命中率指标；缓存条目有上界；内存不随会话线性增长 |
| S7-3a | Worker 归属核对 + transferable + 池化 | `src/workers/**`、`WorkerPoolManager.ts`、2 个转换组件 | P4 | ~320 | 低中 | 50MB 转换主线程长任务 <50ms；池并发 ≤2 |
| S7-3b | Worker/FFmpeg 不可用降级 + 离线可用性 | `src/workers/conversion.worker.ts`、`src/lib/audio/capabilities` | S7-3a | ~280 | 中 | 断网转换给出显式不可用；无静默失败 |
| S7-4a | standalone 构建/复制/校验链 | `next.config.js`、`package.json`、`scripts/verify-next-runtime.mjs*`、`scripts/build-desktop-win.ps1` | P3 | ~260 | 中 | 产物断言脚本 exit 0；缺失即 fail |
| S7-4b | 本地 Next 运行时 owner（启动/健康/退出） | `electron/main/runtime.js*`、`electron/main/index.js`、健康路由* | S7-4a | ~380 | 高 | 冷启动窗口可见 <3s；健康校验含 buildId+pid |
| S7-4c | `app://` 协议桥接（Range/SSE/Cookie/重定向）+ 回退开关 | `electron/main/protocol.js*`、`staticPath.js`、`electron/error.html*` | S7-4b | ~400 | 高 | §6.3 全部通过；旧 origin 数据可见 |
| S7-5a | BackendGateway + `resolveApiUrl` + preload runtimeInfo | `src/lib/api/backendGateway.ts*`、`preload`、`electron.d.ts` | S7-4c | ~320 | 中高 | 浏览器/Electron 分支单测；API 基址唯一 |
| S7-5b | 调用点迁移 + 能力协商 UI | 12 处调用点、`capabilityStore.ts*`、`BackendStatusBanner.tsx*` | S7-5a | ~300 | 中 | 调用点清单 §5.5 全绿；降级 UI 可见 |
| S7-6a | 后端异步启动 + 状态事件 + 重启 IPC | `electron/main/index.js`、`preload` | S7-5a | ~250 | 中 | 故障冷启动 <3s；事件序列可观测 |
| S7-6b | 离线/后端不可用 UI 与重试 | `BackendStatusBanner.tsx`、`capabilityStore.ts` | S7-6a | ~150 | 低 | 无静默失败；重试成功 |
| S7-7a | 插件沙箱纯模块 + 权限白名单 + 恶意 fixture | `electron/main/pluginSandbox.js*`、`pluginPermissions.js*`、fixtures* | S7-5a | ~350 | 中高 | `node --test` 全绿；恶意 fixture 被拒 |
| S7-7b | utilityProcess 宿主 + 主进程 RPC + preload/授权 UI | `pluginHost.js*`、`pluginManager.js`、`preload`、授权组件* | S7-7a | ~400 | 中高 | 主进程不执行插件代码；插件功能回归 |
| S7-8a | safeStorage 加密存储 + IPC + preload/types | `electron/main/credentials.js*`、`preload`、`electron.d.ts` | S7-5a | ~220 | 中 | 加密文件可回读；不可用状态可见 |
| S7-8b | cookie 迁移 + Web 提示 + 兼容读取 | `src/lib/security/credentialVault.ts*`、`userAccountStore.ts` | S7-8a | ~260 | 中 | localStorage 无明文 cookie；旧数据迁移成功 |
| S7-9a | OPFS 大文件 spike（feature flag） | `src/lib/storage/opfsAudioStore.ts*`、`scripts/perf/bench-opfs.mjs*` | P6、S1-4 | ~280 | 中 | 50MB FLAC 起播长任务 <100ms 或记录原因 |
| S7-9b | 2h soak + 泄漏上界 + 报告 | `scripts/perf/soak-playback.mjs*`、`docs/nbl/plans/evidence/S7-soak.md*` | S7-9a | ~280 | 中 | heap <30MB；节点/监听增量 0 |

> 说明：S7-4a/b/c 与 S7-5/6 共用 `package.json`、`electron/preload/index.js`、`electron/main/index.js`，由 T2 单人串行；S7-7b 与 S7-8a 都改 preload，按表中顺序合并。

### 4.1 S7-0 预检结论（决定 S7-3 范围，已核实项）

| 事实 | 证据 | 对计划的影响 |
|---|---|---|
| `src/workers` 4 个 worker 中，`waveform.worker.ts` 与 `fingerprint.worker.ts` **无任何引用**（grep 两个文件名仅命中自身） | `src/workers/waveform.worker.ts:1-64`、`fingerprint.worker.ts:1-61`；grep 0 命中（排除自身） | S7-3a 必须先决定「接入（波形/指纹功能）或删除」；默认按总计划 D3 精神：先标注、S8 删除（待产品确认 O-4） |
| `WorkerPoolManager` 生产代码 0 使用，仅测试引用 | `src/services/WorkerPoolManager.ts:34-38`；grep 仅 `WorkerPoolManager.test.ts` | S7-3a 要么接入 DSD/转换，要么随死代码处置；本计划选择**接入**（并发上限 2、45s 空闲终止是现成收益） |
| DSD 与格式转换当前**各自 new Worker**，绕开池 | `src/components/audio/DSDConverter.tsx:142-145,204`；`FormatConverter.tsx:54-57,142` | S7-3a 改为经池；卸载清理保留 `terminate` |
| 转换 worker 运行时从 unpkg 拉 FFmpeg core（离线/桌面会失败） | `src/workers/conversion.worker.ts:25,32-33` | S7-3b 改为随应用打包自托管 core（`public/ffmpeg-core`）或显式离线不可用 |
| 代理路由已实现 Range/206/tee 缓存语义 | `src/app/api/audio/proxy/route.ts:33,60-61,86-87,91-105`；`proxyDiskCache.ts:15,71,158` | S7-4c 的桥接必须**透传 Range 与流式响应**，不能整段缓冲 |
| `backendClient` 已存在并读取 `window.electronAPI.getBackendStatus()` | `src/lib/backendClient.ts:31-50,98-132`；`electron/preload/index.js:12` | S7-5a 以其为基座扩展，不重造；`resolveApiUrl` 另有局部实现需收编 |
| 凭据当前明文持久化：5 个 cookie 字段进 partialize | `src/store/userAccountStore.ts:632-642`；`API_BASE=""` 在 `:94` | S7-8 为真迁移，需兼容旧 JSON |
| Electron 主进程未使用 `safeStorage`/`utilityProcess` | `Select-String` 全仓 0 命中（`electron/**`、`src/**`） | S7-7/S7-8 为全新模块，需独立回滚开关 |
| 生产窗口当前加载 `app://app/`，协议从 `out/` 读静态文件 | `electron/main/index.js:36,38-47,197-198` | 桥接改造保留同一 origin（I1/E3 的基础） |
| builder 只打包 `out/**/*` 与 electron/public，无 `.next` | `package.json:92-97` | S7-4a 必须改 files/extraResources，并加产物断言 |
| CI 桌面 job 走 `build-desktop-win.ps1`（当前只 `npm run build`） | `.github/workflows/deploy.yml:33-57`；`scripts/build-desktop-win.ps1:45-47` | S7-4a 改脚本并加校验步骤；主 CI 门禁由 S0-2/S8-1 负责 |

## 5. 逐任务步骤

> 通用约定：新增模块默认 `export` 命名函数 + 用依赖注入（`fetchImpl`/`now`/`timer`）保证可单测；测试文件与被测文件同目录（`*.test.ts`）或 `electron/main/*.test.js`（`node --test`）；每个子 PR 必须附「验证命令 + 关键输出」到 PR 描述（总计划 §9.6）。命令模板见 §6.1。

### 5.1 S7-1a/b/c：Resolver 插件化 + 统一请求包装 + 熔断

**目标**：把 1,366 行的 `MultiSourceResolver` 拆成「统一 HTTP 客户端 + 平台解析器 + 搜索/歌词封面 + 门面」，所有外部请求带超时、`AbortSignal` 取消、主机级熔断与网络优先级。公开 API 不变（`resolvePlayableAudio`、`searchOnlineMusicSegmented`、`fetchOnlineCover`、`fetchOnlineLyrics` 等签名保持）。

**前置**：P5（S1-8 的 signal 贯穿）；现状证据：`src/services/MultiSourceResolver.ts:243-1366`，fetch 站点 `:406,518,546,576,665,707,736,775,804,843,872,988,1112,1133,1154,1345`，超时/预算 `:241,478-480,988`，缓存 `:253-270,293-298,325,899-921,1087`；熔断器 `EndpointCircuitBreaker.ts:47-116` 目前仅调试 UI 使用（`AppleAudioSourceInspector.tsx:6,36-44`）。

**写作用域**：`src/services/http/**`（新）、`src/services/resolver/**`（新）、`src/services/EndpointCircuitBreaker.ts`（只加导出辅助）、`MultiSourceResolver.ts`（逐步删减）、对应测试。

**Step 1（S7-1a）**：新增 `src/services/http/requestClient.ts`
```ts
export interface RequestOptions {
  timeoutMs?: number;            // 默认 3000
  signal?: AbortSignal;
  priority?: NetworkPriority;    // 复用 src/services/networkPriorityManager.ts:10-40
  headers?: Record<string, string>;
  method?: "GET" | "POST";
  body?: string;
  retries?: number;              // 默认 0；仅网络错误重试，4xx/取消不重试
}
export interface RequestResult<T> { ok: boolean; status: number; data: T | null; error?: string }
export async function requestJson<T>(url: string, options?: RequestOptions): Promise<RequestResult<T>>;
export function combineSignals(timeoutMs: number, external?: AbortSignal): { signal: AbortSignal; dispose(): void };
export function classifyFetchError(error: unknown, signal?: AbortSignal): "timeout" | "aborted" | "network" | "http";
```
接入熔断：入口先查 `endpointCircuitBreaker.isHostCooling(url)`（`EndpointCircuitBreaker.ts:70-82`），失败 `recordFailure`（`:47-68`）、成功 `recordSuccess`（`:84-91`）；新增 `recordHttpFailure(status)` 的判定表（502/503/504/ECONNRESET/timeout 计入，404 只计一次后跳过 1 分钟）。`combineSignals` 必须在结算后 `removeEventListener` 清理（I4）。
**Step 2（S7-1a）**：`EndpointCircuitBreaker` 增加可注入时钟（`now()`）与 `getHostStates()` 只读快照（调试 UI 不用改）；`resetAll()` 已存在（`EndpointCircuitBreaker.ts:116` 导出单例）。
**Step 3（S7-1b）**：新建 `src/services/resolver/platform/netease.ts`、`qq.ts`：把 `:644-701`、`:702-769` 的搜索+取流逻辑改为 `requestJson`，导出 `resolveNetease(query, deps)`/`resolveQQMusic(query, deps)`，`deps = { apiBase, requestJson, loggedIn, cookie }`（便于单测与 S7-5 迁移）。
**Step 4（S7-1c）**：同法迁移 `kugou(:770-837)`、`kuwo(:510-607)`、`qishui(:838-899)`、`lx(:434-509)`，以及 `:904-1098`（搜索）、`:1099-1177`（封面）、`:1314-1366`（歌词）；`MultiSourceResolver` 保留为门面（`:243-432` 的竞速/预算/缓存逻辑），内部改为调用新模块。移动代码的 PR 只做「搬运 + 依赖注入」，不改行为；行为变化单独 PR。
**Step 5（S7-1c）**：加类型导出快照测试，防止门面公开 API 变化；删除已迁移平台的重复私有方法，行数棘轮：`MultiSourceResolver.ts ≤ 450`、每个 `resolver/**` 文件 ≤300。

**测试文件与用例名**

| 文件 | 用例 |
|---|---|
| `src/services/http/requestClient.test.ts` | `returns data on 200` / `times out after timeoutMs` / `aborted by external signal` / `skips request when host cooling` / `records failure on 502 and skips next call` / `does not retry on abort` |
| `src/services/resolver/platform/netease.test.ts` | `builds song/url query with cookie header` / `maps empty url to null` / `propagates abort` |
| `src/services/resolver/platform/qq.test.ts` | `search then url flow` / `http 403 surfaces without throw` |
| `src/services/MultiSourceResolver.test.ts`（既有 230 行） | 保持全绿；新增 `public API snapshot` / `lx_only mode does not call platform race` |
| `src/services/EndpointCircuitBreaker.test.ts`（既有 44 行） | 新增 `http failure counted` / `success resets` |

**验证命令与预期**：`npx vitest run src/services/http src/services/resolver src/services/MultiSourceResolver.test.ts src/services/EndpointCircuitBreaker.test.ts` → 全绿；`npx tsc --noEmit --incremental false --pretty false` → exit 0；`npx eslint src/services --max-warnings=99999` → 0 errors；`wc -l src/services/resolver/**/*.ts` → 每文件 ≤300。

**验收标准（量化）**：① 每个 resolver 模块 ≤300 行；② 所有 `fetch(` 只出现在 `requestClient.ts`（grep 断言 `src/services/resolver` 下 0 直接 fetch）；③ 坏 host 冒烟：同一 host 连续 2 次失败后第 3 次请求 0ms 返回；④ 现有 resolver 测试 0 回归。

**回滚**：三个子 PR 均可独立 revert；门面 shim 保留旧实现一个版本（不删除旧文件，只改调用），回滚成本低。**风险**：平台接口差异（QQ/Kuwo 搜索参数）在搬运中易偏；用「先搬运后改行为」+ 现有 230 行 resolver 测试兜底；`[推断]` 熔断可能误伤同 host 的多平台（若多个平台共用代理 host，键需含协议+host+首个 path 段，待核实实际 host 分布）。

### 5.2 S7-2a：缓存统一 LRU+TTL

**目标**：三处内存缓存统一为有界 `LruTtlCache`，与 `networkAudioCache`（200 首/4GB，`networkAudioCache.ts:17-18`）和 `BlobUrlRegistry`（100 上限，`BlobUrlRegistry.ts:21,40-56`）对齐，长会话内存不随会话线性增长。

**前置**：S7-1c（缓存调用点收口）；现状：`resolvedUrlCache` 有 30min TTL（`MultiSourceResolver.ts:325` `expiry = now + 1800000`）但**无容量上界**；`searchCache`（`:899-921,1087`）；`prefetchCache` 25min TTL（`audioPrefetcher.ts:21-24,75-80`，无上界）；prefetcher 预热元素最多 2（`:127-136`）。

**写作用域**：`src/lib/cache/lruTtlCache.ts`（新）、`src/services/MultiSourceResolver.ts`、`src/lib/audio/audioPrefetcher.ts`、测试。

**Step 1**：新增 `src/lib/cache/lruTtlCache.ts`
```ts
export interface LruTtlOptions<K> { maxEntries: number; ttlMs: number; now?: () => number; onEvict?: (key: K, value: unknown, reason: "lru" | "ttl") => void }
export class LruTtlCache<K, V> {
  constructor(options: LruTtlOptions<K>);
  get(key: K): V | null;
  set(key: K, value: V): void;
  delete(key: K): void;
  clear(): void;
  size(): number;
  stats(): { hits: number; misses: number; evictions: number; hitRate: number };
}
```
**Step 2**：`resolvedUrlCache` 换为 `new LruTtlCache({maxEntries: 300, ttlMs: 30*60_000})`；`searchCache` 换为 `maxEntries: 50`；`prefetchCache` 换为 `maxEntries: 20, ttlMs: 25*60_000`，`prefetchSong` 读取改为 `cache.get()`（`audioPrefetcher.ts:50-54`）。
**Step 3**：加指标出口（dev-only）：`window.__MIMI_CACHE_STATS__` 由三个 cache 的 `stats()` 聚合，供 S7-9/§6.1 采样；生产不挂载。

**测试**：`src/lib/cache/lruTtlCache.test.ts`：`evicts least recently used at capacity` / `expires entries after ttl` / `hitRate reflects hits and misses` / `onEvict reason ttl vs lru` / `injected clock expiry`。resolver/prefetcher 测试：`prefetcher reuses cache within ttl` / `resolver cache does not grow beyond 300`。

**验证**：`npx vitest run src/lib/cache src/lib/audio/audioPrefetcher.test.ts src/services/MultiSourceResolver.test.ts` 全绿；`npx tsc --noEmit` exit 0；grep 断言这三处不再用裸 `new Map<string` 作缓存。

**验收**：① 三个缓存都有上界（单测断言 size≤max）；② 1000 次不同歌曲解析后 `resolvedUrlCache.size()===300`；③ 指标可输出命中率。**回滚**：缓存类独立，替换点各 2-3 行，revert 无数据影响。**风险**：TTL/容量过小导致重复解析（首声变慢）；先按 `[推断]` 默认值上线，用命中率指标在 S7-9 校准。

### 5.3 S7-3a/b：Worker 归属、transferable、降级

**目标**：4 个 worker 都有明确归属；大 buffer 使用 transferable；Worker/FFmpeg 不可用时有显式降级；DSD/转换接入 `WorkerPoolManager`（并发 ≤2、45s 空闲终止）。

**前置**：P4（指标）；事实见 §4.1 表：`waveform/fingerprint` worker **零引用**、`WorkerPoolManager` 生产 0 使用、DSD/转换各自 new Worker（`DSDConverter.tsx:142-145`、`FormatConverter.tsx:54-57`）、FFmpeg core 走 unpkg（`conversion.worker.ts:25,32-33`）。

**写作用域**：`src/workers/**`、`src/services/WorkerPoolManager.ts`、`src/components/audio/DSDConverter.tsx`、`src/components/audio/FormatConverter.tsx`、`src/lib/audio/formatConversionWorker.ts`、测试。

**Step 1（S7-3a）**：`WorkerPoolManager` 增加 `terminateAll()` 与 `getStats()`（active/idle/queued），保持现有 `execute(data, transferables?, timeoutMs?)`（`WorkerPoolManager.ts:57-75`）与 60s 任务超时；`getPool` 增加 `onWorkerUnavailable` 回调。
**Step 2（S7-3a）**：`DSDConverter`/`FormatConverter` 改为 `WorkerPoolManager.getPool("dsd"|"conversion", new URL(...))`，提交任务用 `execute`，`transferables` 传输入 `ArrayBuffer`（若当前输入是 `Blob` 则先 `arrayBuffer()` 再 transfer；`[推断]` Blob 在 worker 边界是共享引用、无需 transfer，但 `fileData` 若转为 ArrayBuffer 必须 transfer）。
**Step 3（S7-3a）**：`waveform/fingerprint` worker 决策：若产品确认需要，新增调用方（`waveformStore`/`fingerprintStore` 的生成入口）并用 transfer 传输 `AudioBuffer.getChannelData()` 的 `Float32Array` 底层 buffer；否则在该 PR 标注 `@deprecated` + 加「禁止新引用」检查，删除留给 S8-6。默认按 `[推断]`：先标注不删（AGENTS.md 禁删不确定代码）。
**Step 4（S7-3b）**：FFmpeg core 自托管：把 core 放 `public/ffmpeg-core/`（prebuild 脚本可选下载并校验 SHA256，`scripts/sync-ffmpeg-core.mjs` 新增），`conversion.worker.ts:25-33` 改为相对 `/ffmpeg-core/...`；失败时 `loadFFmpeg` 抛 `FFMPEG_UNAVAILABLE`。
**Step 5（S7-3b）**：能力探测模块 `src/lib/audio/workerCapabilities.ts`：`canUseWorker()`、`canUseFFmpeg()`；UI 在不可用时显示「当前环境不支持在线转换/本地 core 缺失」并禁用按钮（复用现有错误展示，不新增面板）。

**测试**：`src/services/WorkerPoolManager.test.ts` 新增 `caps concurrency at maxWorkers` / `terminates idle workers after timeout` / `transfers ArrayBuffer without copy`（mock worker 断言 `postMessage` 第二参数为 transfer 列表）/ `terminateAll terminates active and idle`；`src/lib/audio/workerCapabilities.test.ts`：`reports unavailable when Worker constructor throws` / `reports ffmpeg unavailable when core 404`。

**验证**：`npx vitest run src/services/WorkerPoolManager.test.ts src/lib/audio/workerCapabilities.test.ts` 全绿；手工 50MB 文件转换时 Performance 面板主线程长任务 <50ms（§6.1）；断网后转换入口显示明确错误（截图入证据）。

**验收**：① WorkerPoolManager 生产引用 ≥2（grep）；② 4 个 worker 每个都有「调用点或 deprecated 标记」；③ 无 transferable 的 postMessage 列表中的大 buffer 为 0；④ 离线转换有明确降级。**回滚**：池化与 FFmpeg 自托管分两个提交，可分别 revert；保留 `new Worker` 直连路径一个版本作为开关。**风险**：FFmpeg core 体积（约 30MB）影响安装包；S7-3b 先在 `--dir` 包测体积，超预算则维持 CDN + 显式离线降级（O-5）。

### 5.4 S7-4a/b/c：Electron 本地 Next standalone 运行时 + `app://` 桥接

**目标**（总计划 D2=B）：桌面端不再打包陈旧 `out/`，改为构建 Next standalone、以 loopback 子进程提供页面与 `/api/*`，主窗口继续使用 `app://app` origin（旧 localStorage/IndexedDB 原样可见），协议层把请求桥接到本地服务。

**前置**：P3（构建/端口明确化）；**待核实**：electron-builder 对 `node_modules`/`asar` 的包含规则（O-1）、`app` 自定义 scheme 的 Cookie/SSE 语义（O-2/O-3）。现状：`next.config.js:3` 只有 `STATIC_EXPORT`；`package.json:13-18` 构建不含 standalone；`package.json:92-105` 只打包 `out/**/*`；`electron/main/index.js:36,38-47` 从 `out/` 读文件；`:197-198` 生产加载 `app://app/`。

**写作用域**：`next.config.js`、`package.json`（scripts/files/extraResources）、`scripts/build-desktop-win.ps1`、`scripts/verify-next-runtime.mjs`（新）、`electron/main/index.js`、`electron/main/runtime.js`（新）、`electron/main/protocol.js`（新）、`electron/main/staticPath.js`、`electron/splash.html`/`error.html`（新）、`electron/preload/index.js`（诊断 API）、`.github/workflows/deploy.yml`（desktop job）。

#### 5.4.1 S7-4a：产物结构与构建链

目标产物（打包后 `resources/next-runtime/`，放在 asar 外供 Node 执行）：
```
resources/next-runtime/
  server.js                      # Next standalone 入口
  package.json                   # standalone 自带
  node_modules/                  # standalone 追踪的最小依赖
  .next/
    BUILD_ID
    server/                      # 路由与 app 代码
    static/                      # 由构建脚本显式复制
  public/                        # 由构建脚本显式复制（mediapipe/封面等）
  runtime-manifest.json          # {buildId, builtAt, nextVersion}
```
**Step 1**：`next.config.js` 输出改为三态：`process.env.STATIC_EXPORT ? "export" : process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined`（Web 默认不变，I1）。
**Step 2**：`package.json` 新增（不删旧脚本，S0-3 已建 fail-fast 前置）：
```json
"build:desktop-runtime": "npm run clean && cross-env NEXT_OUTPUT=standalone next build --webpack && node scripts/prepare-desktop-runtime.mjs",
"build:electron": "npm run build:desktop-runtime && node scripts/verify-next-runtime.mjs && electron-builder",
"build:electron:win": "npm run build:desktop-runtime && npm run build:backend:win && node scripts/verify-next-runtime.mjs && electron-builder --win --x64 --publish never"
```
`scripts/prepare-desktop-runtime.mjs`：复制 `.next/static` → `.next/standalone/.next/static`、`public` → `.next/standalone/public`、写 `runtime-manifest.json`（buildId 取 `.next/BUILD_ID`）；仅在此脚本内做复制，保证唯一事实源（审计 D §5.3）。
**Step 3**：`electron-builder` 配置：`files` 移除 `out/**/*`（保留 `electron/**/*`、`public/**/*`、`package.json`）；`extraResources` 增加 `{from: ".next/standalone", to: "next-runtime"}`（`.next/static`/`public` 已复制入内）；`asar` 保持 true；`compression: "maximum"`（顺带修审计 D P2-4）。
**Step 4**：`scripts/verify-next-runtime.mjs` 断言并 `process.exit(1)`：`server.js` 存在；`runtime-manifest.json.buildId` 与 `.next/BUILD_ID` 一致；`server.js`/`BUILD_ID` mtime ≥ 本次构建开始；`.next/static` 有 `chunks/`；`public/mediapipe` 存在（若启用）；总大小 ≤ 预算（先记录，阈值 S8-1 收紧）。
**Step 5**：`scripts/build-desktop-win.ps1:45` 的 `npm run build` 改为 `npm run build:desktop-runtime` 并追加 `node scripts/verify-next-runtime.mjs`；`deploy.yml` desktop job 打印 manifest 并上传为 artifact。

**测试/验证**：`node scripts/verify-next-runtime.mjs` exit 0；`node --test scripts/verify-next-runtime.test.js`（fixture 目录：缺 server.js/新旧 buildId/缺 static → 各自 exit 1）；`npm run build:desktop-runtime` 后 `ls .next/standalone/server.js`。

#### 5.4.2 S7-4b：运行时 owner（loopback 端口/健康检查/退出）

**新增** `electron/main/runtime.js`：
```js
async function pickLoopbackPort(host = "127.0.0.1", attempts = 3) // 复用 findAvailablePort 逻辑（electron/main/index.js:49-59）
async function startNextRuntime({ resourcesPath, isPackaged, env })      // -> { port, pid, child, baseUrl }
async function waitForHealthy({ port, expectedPid, expectedBuildId, timeoutMs = 15000 }) // 250ms 轮询
async function stopNextRuntime(runtime, { graceMs = 3000 })             // SIGTERM → SIGKILL/taskkill → 断言退出
module.exports = { pickLoopbackPort, startNextRuntime, waitForHealthy, stopNextRuntime, getRuntimeState }
```
**Step 1**：新增仅桌面使用的健康路由 `src/app/api/runtime/health/route.ts`：返回 `{ ok: true, pid: process.pid, buildId: process.env.MIMI_DESKTOP_BUILD_ID ?? "", startedAt }`；`MIMI_DESKTOP_BUILD_ID` 由 runtime 启动时从 `runtime-manifest.json` 注入。
**Step 2**：启动子进程：`spawn(process.execPath, [serverJs], { cwd: runtimeDir, env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", NODE_ENV: "production", HOSTNAME: "127.0.0.1", PORT: String(port), MIMI_DESKTOP_BUILD_ID: buildId }, stdio: ["ignore","pipe","pipe"], windowsHide: true })`；stdout/stderr 落 `userData/logs/runtime.log`（追加，单文件 ≤5MB 轮转）。
**Step 3**：健康检查必须证明「是本子进程」：轮询 `GET http://127.0.0.1:${port}/api/runtime/health`（500ms 超时），断言 `body.pid === child.pid && body.buildId === buildId`；失败重试端口 ≤3；15s 未就绪 → 返回失败（不阻塞主窗口，见 S7-4c/Step 6）。
**Step 4**：退出：`app.on("before-quit")` 阻止默认 → `await stopNextRuntime()`（先 `child.kill()`，3s 未退出 Windows 用 `taskkill /PID <pid> /T /F`）→ `stopBackend()` → `app.exit(0)`；总超时 5s 强制退出并写日志；断言 `child.exitCode !== null`。
**Step 5**：单实例/端口抢占：沿用 `app.requestSingleInstanceLock()`（`electron/main/index.js:361-368`）；端口由本进程先探测后传子进程，健康检查含 pid 防「端口被其他服务抢占后误认」。
**Step 6**：启动顺序与降级（S7-4c 共用）：`createWindow()` 立即创建、先加载 `electron/splash.html`（`show:false` + `ready-to-show`），并行启动 runtime；健康 → `loadURL("app://app/")`；失败 → 读 `userData/runtime.json` 的 `mode/failCount`：`failCount>=2` 或 env `MIMI_DESKTOP_RUNTIME=static` → 回退静态 `out/`（若 `out/index.html` 新鲜，mtime 断言）并显示降级 banner；否则加载 `electron/error.html`（显示日志路径、重试、退出；重试走 IPC `runtime:retry`）。

**测试**：`electron/main/runtime.test.js`（node:test，纯函数 + 注入 spawn/fetch mock）：`picks free loopback port` / `retries when port busy` / `health fails on pid mismatch` / `health fails on buildId mismatch` / `stop sends SIGTERM then force kills after grace` / `does not throw when process already exited`。

#### 5.4.3 S7-4c：`app://` 协议桥接 + 回退开关

**新增** `electron/main/protocol.js`：
```js
function createAppProtocolHandler({ getRuntime, resolveStatic, outDirectory }) {
  return async (request) => { /* 返回 Response */ };
}
// 规则：
// 1) runtime.mode==="static" 或 runtime 未就绪 → 旧 staticPath 行为（electron/main/staticPath.js:3-30）
// 2) runtime.mode==="next" → http://127.0.0.1:${port} + pathname + search
//    转发 method/headers/body；透传 Range/Cookie/Accept；
//    Location 为 loopback 相对/绝对 → 改写回 app://app/...；外部 http(s) → 保留（由导航策略拦截）
//    响应体直接返回（流式，禁止 await response.arrayBuffer()）
```
**Step 1**：`protocol.handle("app", handler)` 替换现状 `electron/main/index.js:38-47`；开发模式（`!app.isPackaged`）保持 `http://localhost:3025` 不变（`:199-202`）。
**Step 2**：`configureWindowSecurity`（`:160-177`）保持：`app://app/` 允许、外链走 `shell.openExternal`；新增桥接内部 loopback 重定向改写后不得触发 `will-navigate` 拦截。
**Step 3**：验证场景（全部通过才出口，详见 §6.2）：根/路由 200、`/_next/static` 资源、`/api/*` JSON、Range 206、SSE 流、Cookie、重定向、abort/背压。
**Step 4**：回退开关：`MIMI_DESKTOP_RUNTIME=next|static`（默认 next）；`userData/runtime.json` 记录 `{mode, failCount, lastFailureAt, lastError}`；连续 2 次失败自动 static 并弹一次提示；**绝不删除/迁移 userData**。
**Step 5**：诊断 IPC：`runtime:diagnostics` 返回 `{ runtimeMode, port, buildId, origin: "app://app", storage: {localStorageKeys, indexedDbDatabases}, logPath }`；preload 暴露 `getRuntimeDiagnostics()`（types 同步，S7-5a 统一整理）。

**测试**：`electron/main/protocol.test.js`（node:test，注入 fetch mock）：`proxies GET to loopback` / `forwards range header` / `forwards method and body` / `rewrites loopback redirect to app origin` / `returns 404 when static missing` / `does not buffer stream body`（断言返回对象不是已消费 body）。
**手工/冒烟证据**：§6.2 的 8 条记录 + 截图/JSON 入 `docs/nbl/plans/evidence/S7-desktop-smoke.md`。

**S7-4 验收/回滚/风险**：验收 E1-E3 全绿；回滚 = `MIMI_DESKTOP_RUNTIME=static` 立即回退（需保留新鲜 `out/` 作为过渡，S7-4 合并后一个版本再删除静态兜底）。风险：① electron-builder 对 standalone 的 node_modules 处理（O-1）；② `app` scheme 的 Cookie jar/SSE 语义未知（O-2/O-3）——若验证失败，按设计草案「另写可回退 origin 迁移 ADR」，本阶段退化为「窗口直接加载 `http://127.0.0.1:port`」并接受一次数据迁移，需 Lead 批准（O-2）；③ 杀进程树在 Windows 可能残留 Next 子进程，验收强制检查。

### 5.5 S7-5a/b：BackendGateway + `resolveApiUrl` + 能力协商

**目标**：API 基址唯一来源；浏览器/Electron 分支可单测；在线能力不可用时 UI 显式降级。**前置**：S7-4b/c（runtime 信息可用）；已有资产：`src/lib/backendClient.ts:31-50`（`getBackendBaseUrl` 读 `window.electronAPI.getBackendStatus()`）、`electron/preload/index.js:12`、`src/types/electron.d.ts:2-6`、局部 `resolveApiUrl`（`useOfflineDownloadStore.ts:80-90`）。

**写作用域**：`src/lib/api/backendGateway.ts`（新）、`src/lib/backendClient.ts`、`electron/preload/index.js`、`src/types/electron.d.ts`、调用点清单（下表）、`src/lib/api/capabilityStore.ts`（新）、`src/components/shared/BackendStatusBanner.tsx`（新）。

**Step 1（S7-5a）**：新增 `src/lib/api/backendGateway.ts`：
```ts
export type ApiTarget = "auto" | "next" | "backend";
export interface RuntimeInfo {
  mode: "web" | "electron";
  origin: string;              // web: location.origin；electron: "app://app"
  nextBaseUrl: string | null;  // web: location.origin；electron: "app://app"（桥接）
  backendBaseUrl: string | null;
  backendStatus: "disabled" | "external" | "starting" | "ready" | "stopping" | "error";
  buildId: string | null;
}
export function resolveApiUrl(path: string, options?: { target?: ApiTarget }): string;
export async function getRuntimeInfo(): Promise<RuntimeInfo>;
export async function fetchApi(path: string, init?: RequestInit & { timeoutMs?: number; target?: ApiTarget }): Promise<Response>;
export class ApiUnavailableError extends Error { readonly code: "BACKEND_UNAVAILABLE" | "RUNTIME_UNAVAILABLE" }
```
语义：`target:"next"` → 相对路径（Electron 走 `app://app` 桥接，Web 走 origin）；`target:"backend"` → 用 `runtimeInfo.backendBaseUrl`，不可用抛 `ApiUnavailableError`；`auto`（默认）→ Next 优先、AI/模型类路径（`/api/ai/*`、`/api/tts/*`、`/api/vision/*`、`/api/audio/process`）走 backend（与 `backendClient.ts:98-132` 对齐）。`getRuntimeInfo` 在 Electron 下由 preload `getRuntimeInfo()` 返回，Web 下本地构造；结果缓存 + `onBackendStatus` 更新。
**Step 2（S7-5a）**：`preload/index.js` 新增 `getRuntimeInfo()`、`onBackendStatus(cb)`（`ipcRenderer.on("backend-status")` 并返回 unsubscribe）、`getRuntimeDiagnostics()`；`electron.d.ts` 补 `RuntimeInfo`/`RuntimeDiagnostics` 类型；`backendClient.ts` 的 `getBackendBaseUrl()` 改为 `getRuntimeInfo().backendBaseUrl`（删除重复的 `window.electronAPI` 分支）。
**Step 3（S7-5b）**：迁移调用点（**完整清单**，每处改为 `fetchApi`/`resolveApiUrl`）：

| # | 文件:行 | 现状 | 目标 |
|---|---|---|---|
| 1 | `useOfflineDownloadStore.ts:80-90` | 局部 `resolveApiUrl` 定义 | 删除，import 共享实现 |
| 2 | `useOfflineDownloadStore.ts:190,224` | `resolveApiUrl(...)` | 共享实现语义不变 |
| 3 | `MultiSourceResolver.ts:227-232` | `getApiBase()=location.origin` | 注入 `deps.resolveApiUrl`（S7-1b 已依赖注入） |
| 4 | `useAudioPlayer.ts:286` | `/api/audio/proxy?url=...` | 保持相对路径（桥接自动处理），加注释与测试 |
| 5 | `audioSource.ts:105` | 直接 `fetch(audioUrl)`（远端直链） | 保持（外部 URL 非 API），加 `AbortSignal` 由 S1-8 提供 |
| 6 | `aiAgentService.ts:399,458,483,507,532` | `isBrowser ? "/api/ai/chat" : 外部 URL` | `resolveApiUrl("/api/ai/chat",{target:"backend"})`；浏览器保持 Next 路由由 S7-5 判别 |
| 7 | `aiStore.ts:408,460` | 相对 `/api/ai/chat`、`/api/ai/models` | `resolveApiUrl` |
| 8 | `emotionStore.ts:310` | 相对路径 | 同上 |
| 9 | `knowledgeStore.ts:122` | 同上 | 同上 |
| 10 | `linerNotesStore.ts:171` | 同上 | 同上 |
| 11 | `userAccountStore.ts:94`（`API_BASE=""`）及 226/328/341/368/408/454/477/523 | 相对路径 + `API_BASE` | 初始化时 `const API_BASE = resolveApiUrl("")` 语义化（空串→origin） |
| 12 | `backendClient.ts:31-50,98-132` | 自带 base 解析 | 复用 `getRuntimeInfo` |
**Step 4（S7-5b）**：`capabilityStore.ts`（zustand）：`{ status, capabilities, lastCheckedAt, refresh(), subscribe() }`，数据源 `backendClient.getBackendCapabilities()` + `onBackendStatus`；`BackendStatusBanner` 在 `status==="error"` 或能力 `available:false` 时显示「本机 AI 能力不可用：{reason}」+ 重试按钮；挂载点等 S0-1 后串行改 `GlobalClientComponents.tsx`（I5 风险）。

**测试**：`src/lib/api/backendGateway.test.ts`：`web mode resolves to origin` / `electron mode keeps relative path for next` / `backend target throws when unavailable` / `auto routes ai paths to backend` / `refresh updates runtime info on status event`；`src/lib/api/capabilityStore.test.ts`：`loading→ready` / `error with reason`；`backendClient.test.ts` 既有 65 行保持全绿。

**验证**：`npx vitest run src/lib/api src/lib/backendClient.test.ts src/store/userAccountStore.test.ts`；`npx tsc --noEmit`；`npx eslint src/lib/api ...`；Electron 冒烟：搜索走后端/Next 有网络记录（§6.2）。

**验收**：① 12 处调用点清单全部迁移（grep `/api/` 字面量在服务/store 层只剩 `resolveApiUrl` 参数或测试）；② 浏览器/Electron 分支单测覆盖；③ 后端不可用时 UI 显式降级且本地播放不受影响（E4）。**回滚**：网关是新增模块，调用点逐文件 revert；保留 `backendClient` 旧签名一个版本。**风险**：`[推断]` AI 路径在 Electron 应走 FastAPI 还是本地 Next（ai/chat 是 Next route 且有服务端 env key）；默认策略「有 backend 用 backend，否则 Next」，需产品确认（O-6）。

### 5.6 S7-6a/b：后端异步启动 + 状态事件 + 离线 UI

**目标**：后端不再阻塞窗口；状态可观察、可重启；不可用时 UI 明确。**前置**：S7-5a（preload 事件通道）；现状：`electron/main/index.js:370-379` 在 `whenReady` 中 `await startBackend()` 后才 `createMainWindow()`；`startBackend` 最长等 30s（`:75-82,133-142`）；`backendState` 已有（`:30-34`）；renderer 仅 `getBackendStatus`（`preload:12`），`useElectron` 未使用。

**写作用域**：`electron/main/index.js`（启动段与 IPC）、`electron/preload/index.js`、`src/lib/api/capabilityStore.ts`、`src/components/shared/BackendStatusBanner.tsx`、`src/types/electron.d.ts`。

**Step 1（S7-6a）**：`index.js` 启动改为：`createWindow()`（splash）→ `void startBackend().then(broadcast)` → 窗口不等待；`backendState` 每次变化调用 `broadcastBackendStatus()`（遍历 `BrowserWindow.getAllWindows()` `webContents.send("backend-status", state)`）；新增 `ipcMain.handle("backend:restart")`：停止后重启，防重入。
**Step 2（S7-6a）**：`stopBackend()` 增强：先发信号，超时 `taskkill /PID /T /F`，记录 `exitCode`；`before-quit` 统一 await（与 S7-4b 的 `stopNextRuntime` 串行，总超时 5s）。
**Step 3（S7-6b）**：`capabilityStore` 订阅 `onBackendStatus` 与 `getBackendStatus()` 初始值；`BackendStatusBanner` 展示 `starting/error` 与 `restart` 按钮；AI/模型功能入口在 `error` 时显示不可用原因（复用 `backendClient.getBackendErrorMessage`）。
**Step 4（S7-6b）**：本地播放不受影响：banner 只读，不阻断播放；启动失败日志路径可复制。

**测试**：`src/lib/api/capabilityStore.test.ts`：`starting→ready event updates state` / `error shows reason` / `restart clears error optimistically`；`electron/main/runtime.test.js` 增加 `backend stop escalates to taskkill on timeout`（注入 mock）；`BackendStatusBanner.test.tsx`：`renders error reason and retry`。
**验证**：`npx vitest run src/lib/api src/components/shared/BackendStatusBanner.test.tsx`；手工：删除 `resources/backend.exe` 启动 → 窗口 3s 内可见 + banner 显示错误 + 本地歌曲可播（E5）。
**验收**：① 后端故障冷启动窗口 <3s；② 事件序列可记录（日志/诊断 JSON）；③ 退出无残留（§6.2 第 8 条）。**回滚**：启动顺序改动集中在 `index.js` 一个函数，可独立 revert；banner 独立组件。**风险**：后端端口随机，重启后端口变化需广播新 baseUrl，否则 renderer 缓存旧值 → capabilityStore 必须按事件刷新（测试覆盖）。

### 5.7 S7-7a/b：插件 utilityProcess 沙箱 + 权限白名单

**目标**：插件不再在主进程执行；主进程不跑插件代码；插件网络/文件/命令有显式白名单；恶意 fixture 无法读文件/执行命令。**前置**：S7-5a（preload/IPC 基线）、D8=A（第三方源明示 + 用户确认）。现状：`electron/main/pluginManager.js:4,31-52` 用 `vm.Script` 在主进程执行 `userData/plugins/*.js`；沙箱注入 `fetch/request/Buffer/CryptoJS`（`:54-91`）；启动时自动加载（`electron/main/index.js:372`）；preload 插件 API `:14-19`。

**写作用域**：`electron/main/pluginSandbox.js`（新，纯函数）、`electron/main/pluginPermissions.js`（新）、`electron/main/pluginHost.js`（新 utilityProcess 入口）、`electron/main/pluginManager.js`（改为 RPC 客户端）、`electron/main/__fixtures__/`（新）、`electron/preload/index.js`、`src/types/electron.d.ts`、`src/components/settings/PluginConsent*.tsx`（新，挂载点待 S0-1）。

**权限清单**（每插件 `userData/plugins/<id>.permission.json`，缺省全部拒绝）：
```json
{ "version": 1, "networkHosts": ["api.example.com"], "fs": false, "exec": false, "maxResponseBytes": 10485760 }
```
**Step 1（S7-7a）**：`pluginSandbox.js` 导出 `createPluginContext({ pluginId, permissions, hostApi })`：用 `vm.createContext`，context 只含 `console`（限速）、`fetch`（转发 hostApi.fetch，host 白名单校验）、`CryptoJS` 兼容 shim、`setTimeout/clearTimeout`；`vm.createContext(sandbox, { codeGeneration: { strings: false, wasm: false } })`；**不注入** `require/process/module/Buffer/global/import`。`loadPluginModule(code, ctx)` 返回 `{platform, search, getMediaSource, getLyric}`。
**Step 2（S7-7a）**：`pluginPermissions.js`：`loadPermissions(pluginId)`（缺省 deny）、`assertHostAllowed(permissions, url)`、`requestUserConsent(pluginId, permissions)`（主进程 `dialog.showMessageBox`，结果持久化）；插件首次加载必须用户确认，拒绝则标记 `DISABLED`。
**Step 3（S7-7b）**：`pluginHost.js` 作为 utilityProcess 入口：`process.parentPort.on("message")` 处理 `{id, method, payload}`，在沙箱上下文内调用插件函数，回传 `{id, ok, data|error}`；插件读盘/执行命令的能力**不存在**（宿主不注入）；网络请求通过 `hostApi.fetch` 回主进程，主进程按白名单用 `net.fetch` 发起并限 `maxResponseBytes`。
**Step 4（S7-7b）**：`pluginManager.js` 改为 RPC 客户端：`utilityProcess.fork(path.join(__dirname, "pluginHost.js"), [], { serviceName: "mimi-plugin-host", stdio: "ignore" })`；`search/getMediaSource/getLyric` 发消息并 15s 超时；host 崩溃自动重启 ≤1 次并标记降级；退出时 `host.kill()`。preload 暴露 `getPluginPermissions()`/`setPluginPermission()`；类型同步。
**Step 5（S7-7b）**：授权 UI：设置页插件卡片显示「声明域名/是否授权/撤销」；未授权时插件不可用并有提示（合规文案 D8=A）。

**恶意 fixture 与测试**（`electron/main/__fixtures__/`）：
```
safe-plugin.js            // 返回固定搜索结果，用于回归
malicious-fs.js           // try{ require("fs").readFileSync("C:/Windows/win.ini") }catch(e){ report(e.message) }
malicious-exec.js         // try{ require("child_process").execSync("calc") }catch(e){ report(e.message) }
malicious-escape.js       // try{ this.constructor.constructor("return process")().mainModule.require("fs") }catch(e){ report(e.message) }
malicious-network.js      // fetch("http://169.254.169.254/latest/meta-data") → 期望 PERMISSION_DENIED
```
`electron/main/pluginSandbox.test.js`（`node --test`）：`safe plugin exports platform and search` / `malicious fs fixture reports NO_REQUIRE and reads no file`（canary 文件 mtime 不变）/ `malicious exec fixture does not spawn process`（mock hostApi.exec 记录 0 调用）/ `malicious escape fixture cannot reach host process` / `network not in whitelist rejected with PERMISSION_DENIED` / `network to whitelisted host forwards and applies maxResponseBytes` / `codeGeneration strings disabled`。
`electron/main/pluginHost.smoke.md`：Electron 内 e2e 手工清单（`npx electron . --smoke-plugin-host`），CI 不作为必需（GUI/Windows runner 不稳定）。

**验证**：`node --test electron/main/pluginSandbox.test.js` → 全绿；`npx electron . --smoke-plugin-host` → 控制台输出每个 fixture 的判定；主进程存活；`git grep "vm.Script" electron/main/pluginManager.js` → 0（插件代码不再在主进程编译执行）。
**验收**：E6；正常插件 `search/getMediaSource/getLyric` 回归通过；用户授权流程可见。**回滚**：`MIMI_PLUGIN_HOST=legacy` 开关一个版本（legacy=旧 vm 主进程实现，默认新）；pluginHost 与 pluginManager 分两个 PR。**风险**：`[推断]` `vm` 逃逸无法 100% 防（O-7），因此二级防线是 utilityProcess 进程隔离 + 无高权限 API 注入；若 fixture 仍逃逸到 utilityProcess 的宿主脚本，则升级为「进程内再 fork 受限子进程」，需 O-7 决策。

### 5.8 S7-8a/b：平台凭据 safeStorage 加密 + 迁移

**目标**：桌面端 5 个平台 cookie 不再明文进 localStorage；旧数据自动迁移且可回读；Web 端明确「仅本地」提示。**前置**：S7-5a；D8=A；现状：cookie 字段在 `userAccountStore.ts:632-642` 持久化，`API_BASE=""`（`:94`），全仓无 `safeStorage`（grep 0）。

**写作用域**：`electron/main/credentials.js`（新）、`electron/preload/index.js`、`src/types/electron.d.ts`、`src/lib/security/credentialVault.ts`（新）、`src/store/userAccountStore.ts`、`src/components/account/*Notice*`（新/小改）。

**Step 1（S7-8a）**：`credentials.js`：`userData/credentials.enc`（JSON → `safeStorage.encryptString` → Buffer 写文件，临时文件 + rename 原子替换）；`get(platform)`/`set(platform, value)`/`clear(platform)`/`status()`（`safeStorage.isEncryptionAvailable()`）；IPC 通道 `credentials:get/set/clear/status`；`status()` 返回 `{available, backend: "dpapi"|"keychain"|"plain"}`。
**Step 2（S7-8a）**：preload 暴露 `credentials`（仅上述 4 个方法，不接受文件路径）；`electron.d.ts` 类型；不可用时 `status.available=false`，不静默降级（renderer 决定）。
**Step 3（S7-8b）**：`credentialVault.ts`：`hydrate()`（读 vault 到内存）、`get(platform)`、`set(platform, value)`、`migrateFromLegacy(state)`（旧 persisted cookie 非空 → 写 vault → 返回「已迁移」标记）、`isDesktop()`；Web 模式直接读写 localStorage 兼容层 + 一次性提示。
**Step 4（S7-8b）**：`userAccountStore`：cookie 字段保留在内存（大量调用点 `getPlatformCookie` 不改签名）；`partialize`（`:632-642`）删除 5 个 cookie 字段，新增 `credentialSchemaVersion: 2`；首次 hydrate 执行迁移并把 state 中 cookie 置空触发一次持久化清洗；登录/登出路径改为 `await vault.set`（`loginWithCookie` 等，失败时回滚内存值并提示）。
**Step 5（S7-8b）**：兼容读取：v1 明文数据可读（一次性迁移）；Web 显式提示「浏览器模式凭据仅保存在本机浏览器，清除站点数据将丢失」，桌面显示「已使用系统加密存储」。

**测试**：`src/lib/security/credentialVault.test.ts`（mock `window.electronAPI.credentials`）：`migrates legacy cookie and clears persisted value` / `returns null when vault unavailable` / `web mode falls back to localStorage` / `set then get roundtrip`；`src/store/userAccountStore.migration.test.ts`（fake localStorage 旧 JSON fixture）：`hydrated state keeps login` / `persisted JSON has no cookie field after migration` / `login writes vault once` / `v1 fixture still readable`。
**验证**：`npx vitest run src/lib/security src/store/userAccountStore.migration.test.ts`；Electron 手工：登录某平台 → 退出重启 → 仍登录；`userData` 下 `credentials.enc` 非空、localStorage 无 cookie 明文（诊断 IPC 输出）。
**验收**：E7；兼容旧数据（I1）。**回滚**：`credentialSchemaVersion` 保持双读；关闭 `useCredentialVault` 开关回旧路径一个版本。**风险**：`[推断]` Linux 无 keyring 时 `isEncryptionAvailable()=false`，需 UI 明示；迁移失败不能登出用户 → 失败时保留旧明文并上报（不回滚数据）。

### 5.9 S7-9a/b：OPFS 大文件 spike + 2h soak + 泄漏上界

**目标**：对「IndexedDB 存整段音频 → 主线程反序列化」给出可落地结论；建立 2h soak 与泄漏上界，作为 S8-3 的输入。**前置**：S2-5（泄漏计数器）、S1-4（VibeMusicDB 统一，OPFS 不与其冲突）；现状：整段 ArrayBuffer 读写（审计 C P1-10，`useAudioPlayer.ts:1407,1466,1469`、`audioSource.ts:56-66,85,99`、`networkAudioCache.ts:236-253`）；OPFS 全仓 0 引用（grep 0）。

**写作用域**：`src/lib/storage/opfsAudioStore.ts`（新，feature flag）、`scripts/perf/bench-opfs.mjs`（新）、`scripts/perf/soak-playback.mjs`（新）、`docs/nbl/plans/evidence/S7-soak.md`（新，证据）。

**Step 1（S7-9a）**：`opfsAudioStore.ts`：
```ts
export interface OpfsAudioStore {
  isAvailable(): Promise<boolean>;
  put(songId: string, file: Blob): Promise<{ bytes: number }>;
  getUrl(songId: string): Promise<string | null>; // createObjectURL(await handle.getFile())
  delete(songId: string): Promise<void>;
  estimate(): Promise<{ count: number; bytes: number }>;
}
```
开关 `NEXT_PUBLIC_ENABLE_OPFS`（默认 0）；不接播放入口，只供 benchmark 与文档结论（迁移留 S8-6）。
**Step 2（S7-9a）**：`scripts/perf/bench-opfs.mjs`：生成 50MB FLAC fixture（或复用现有 fixture 生成器）→ 分别走 IDB（旧路径模拟）与 OPFS → 测「起播前主线程长任务」与峰值内存；输出 JSON（`p50/p95/max`，5 次样本）；结论写入 evidence。
**Step 3（S7-9b）**：`scripts/perf/soak-playback.mjs`：以系统 Chrome CDP（无新依赖，沿用审计 C 的 smoke 方式）启动 dev/start 页面 → 注入固定 20 首 fixture 到 `VibeMusicDB/localMusic` → 循环播放/暂停/seek/切歌 2h（`--duration=7200`，CI 用 `--duration=600`）→ 每 5min 采样：`heapMB`（`performance.memory`）、`activeAudioNodes`/`mediaBridgeListeners`（S2-5 计数器）、`persistWritesPerSec`（patch setItem）、`idbBytes`（`navigator.storage.estimate()`）→ 写 `scratch/perf/soak-<ts>.json` + 断言（下）。
**Step 4（S7-9b）**：泄漏上界（断言）：`activeAudioNodes` 增量 = 0；`mediaBridgeListeners` = 12 恒定；heap 2h 增长 <30MB；`persistWritesPerSec ≤1`（衔接 S2-4）；`idbBytes` 不因播放单调增长。未达标项必须在 evidence 中写明原因与后续任务（E10）。
**Step 5（S7-9b）**：报告 `docs/nbl/plans/evidence/S7-soak.md`：环境、命令、原始 JSON、结论、未执行项（真机/听感）。

**测试**：`src/lib/storage/opfsAudioStore.test.ts`（mock `navigator.storage.getDirectory`）：`unavailable when opfs missing` / `put then getUrl returns blob url` / `delete removes entry` / `estimate sums sizes` / `feature flag off returns unavailable`；soak 脚本自身：`node --test scripts/perf/soak-playback.test.js`（参数解析/断言阈值/采样聚合，纯函数）。
**验证**：`npx vitest run src/lib/storage/opfsAudioStore.test.ts`；`node scripts/perf/soak-playback.mjs --duration=600` → JSON + exit 0（阈值内）或 exit 1（超阈值并打印原因）。
**验收**：E10 + 「50MB FLAC 起播长任务 <100ms 或记录未达标原因」。**回滚**：OPFS 模块 feature flag 默认关，删除即回滚；soak 脚本独立。**风险**：CI 无 GUI/Chrome 时 soak 不可跑 → 默认只 nightly/本地执行，PR 必跑 10min 版（O-8）。

## 6. 阶段验证命令与证据

### 6.1 固定验证顺序（每个子 PR）

```bash
# 1) 定向测试（先）
npx vitest run <本 PR 测试文件> --reporter=dot
# 2) 全量测试（合并前）
npm run test -- --run
# 3) 类型
npx tsc --noEmit --incremental false --pretty false
# 4) lint（本 PR 文件）
npx eslint <本 PR 文件> --max-warnings=99999
# 5) 生产构建（S0-3 后由脚本 fail-fast 校验产物；禁止与 tsc 并行，禁止 dev 存活时 clean .next）
npm run build
# 6) 桌面/桥接相关（S7-4/5/6/7/8）
npm run build:desktop-runtime && node scripts/verify-next-runtime.mjs
npx electron-builder --dir --win --x64          # 只 unpacked 目录，不生成安装包
node scripts/perf/desktop-smoke.mjs             # 新增：启动 --dir 产物、等窗口、跑 §6.2 断言
# 7) soak（S7-9，本地/nightly）
node scripts/perf/soak-playback.mjs --duration=600
```
> 顺序依据：总计划 I7、审计 D §7.3；`electron-builder --dir` 只做打包目录验证，发布构建仍由 S8-5 发布清单执行。

### 6.2 桌面桥接验证步骤（S7-4c / E2，8 条全过）

使用 `--dir` 产物 + DevTools（或 `desktop-smoke.mjs` 的 CDP 断言）：

1. **页面**：`location.origin === "app://app"`；`document.title` 含 `MIMI Music Player`；主窗口可见 <3s（main 日志记录 `whenReady→ready-to-show`）。
2. **路由**：`/data-manager` 返回 200 且渲染；`/` 刷新后仍为 `app://app/`。
3. **静态资源**：Network 面板中 `app://app/_next/static/...` 全部 200，无 404；CSS/字体加载正常。
4. **API**：`fetch("/api/search?keywords=test&limit=1")` 返回 JSON（非 404 HTML）；响应头 `content-type: application/json`。
5. **Range/206**：`fetch("/api/audio/proxy?url=<本地 fixture mp3>",{headers:{Range:"bytes=0-1023"}})` → `status===206`、`content-range` 存在、`content-length===1024`；播放器可拖动进度不整段缓冲（DevTools 看到多次 Range 请求）。
6. **流式**：`GET /api/runtime/health?stream=1` 探针（5 个小 chunk）逐块到达，`abort` 后服务端无未捕获异常；主窗口不冻结。
7. **Cookie/重定向**：登录接口响应 `Set-Cookie` 后刷新仍保持；访问 `/data-manager/` 尾部斜杠 308 → 最终 `app://app/data-manager`（location 被改写，不跳出 app origin）。
8. **退出一致性**：关闭窗口后 `tasklist` 无残留 `node.exe`/`backend.exe`/`MIMI Music Player.exe`；重启二次进入旧数据仍在。

### 6.3 旧 origin 数据可见验证（E3 / I1，必须人工+脚本各一次）

1. **升级前**（旧版本安装或旧 `--dir` 产物）：DevTools 执行并保存 JSON：`Object.keys(localStorage).length`（期望 44）、`indexedDB.databases()` 名称列表、`localStorage.getItem("player-store")` 哈希；另写 canary：`localStorage.setItem("mimi-origin-canary", String(Date.now()))`。
2. 构建并安装新版本（同一 `appId`/`userData`，`nsis oneClick=true` 保留 userData）。
3. 启动后在 DevTools 断言：`location.origin === "app://app"`；`localStorage.length >= 44`；canary 值与升级前一致；`indexedDB.databases()` 含 `VibeMusicDB`、`VibeNetworkAudioCacheDB`、`VibeMusicMetadataDB`、`VibeMusicCoverDB`、`mimi_ai_agent_db_v1`。
4. 功能断言：本地导入歌曲可见且 `local://` 可播（S1-4 修复后）、队列/播放进度恢复、备份导出仍含 44 key。
5. 脚本化：`runtime:diagnostics` 返回 `storage` 快照写日志，`desktop-smoke.mjs` 与升级前 JSON diff（允许新增 key，不允许丢失）。
6. **失败判定**：任一旧 key/DB 丢失或 `location.origin` 变化 → 阻断发布，回退 `MIMI_DESKTOP_RUNTIME=static` 并走 O-2 ADR。

### 6.4 失败回退演练（S7-4/5/6，每项留证据）

| # | 注入故障 | 期望行为 | 证据 |
|---|---|---|---|
| F1 | 删除 `resources/next-runtime` | 不白屏：error.html 显示日志路径+重试+退出；userData 不变 | 截图 + runtime.log |
| F2 | 让 Next 端口被占用/健康检查 buildId 不匹配 | 重试 ≤3 后失败；第 2 次启动回退 static（若 out 新鲜）并 banner 提示 | runtime.json + 日志 |
| F3 | 删除 `backend.exe` | 窗口 <3s 可见；banner 显示后端不可用；本地播放可用；退出无残留 | 录像/截图 + process 列表 |
| F4 | 断网（禁用网卡） | 在线功能显式不可用；本地播放/转换（自托管）可用；不无限转圈 | 截图 + 网络面板 |
| F5 | `MIMI_DESKTOP_RUNTIME=static` | 回退旧静态路径（需新鲜 out）；不影响流量；不删数据 | 启动日志 |

### 6.5 阶段证据产物（合入 S7 出口）

- `docs/nbl/plans/evidence/S7-desktop-smoke.md`（§6.2/6.3 记录 + 截图索引）
- `docs/nbl/plans/evidence/S7-soak.md`（2h JSON 与结论）
- `scratch/perf/soak-*.json`、`userData/logs/runtime.log` 样例（脱敏）
- 每个子 PR 的「命令 + exit code + 关键输出」贴 PR 描述（总计划 §9.6）

## 7. 与相邻阶段的接口

| 相邻 | 接口/依赖方向 | 约定 |
|---|---|---|
| S1-8（请求取消） | S1 → S7 | S7-1a 的 `RequestOptions.signal`、S7-5a `fetchApi` 透传 signal；S7 不重复实现取消 |
| S2-5（泄漏计数器） | S2 → S7-9 | `activeAudioNodes`/`mediaBridgeListeners` 字段名与采样方式由 S2-5 定义，S7-9 只消费；若 S2-5 未落地，soak 降级只测 heap/IDB |
| S0-3（构建/端口） | S0 → S7-4 | 端口常量与 `build:static` 规则被 S7-4a 继承；S7-4 新增 `build:desktop-runtime` 不替换 web 默认构建 |
| S0-2/S8-1（CI） | S0 → S7，S7 → S8 | S7 只保证「本地/CI 可执行命令」；S8-1 把 `verify-next-runtime`/`pluginSandbox.test`/`soak` 纳入 job 与 required checks |
| S6-9（服务 port 化/domain） | S6 → S7-1/5 | 若 S6-9 先落地，resolver 依赖注入接口沿用其 port 类型；否则 S7 用局部 `deps` 接口，S6-9 再适配（避免互等） |
| S5（渲染运行时） | 无直接依赖 | S7 不动可视化；S7-9 的 soak 只采样不改渲染 |
| S8-3/S8-5（性能回归/发布） | S7 → S8 | soak JSON schema、desktop smoke 脚本、runtime manifest 作为 S8 输入 |
| 决策 D2/D8（总计划 §8） | Lead → S7 | D2=B 已按推荐执行；D8=A（第三方源明示+同意）用于 S7-7/S7-8 文案；若改 D8=B/C，S7-7 白名单与 S7-8 Web 提示范围相应调整 |

## 8. 未决问题

| ID | 问题 | 影响 | 建议/默认 | 需谁决定 |
|---|---|---|---|---|
| O-1 | electron-builder 在 `files` 自定义后是否包含 `node_modules`（`pluginManager.js:5-6` 依赖 axios/crypto-js；standalone 的 server.js 依赖也在 `.next/standalone/node_modules`） | 打包启动成败 | S7-4a 先 `electron-builder --dir` 解包审计；若缺依赖，改 `extraResources` 或 `asarUnpack` | 平台 owner + Lead |
| O-2 | 自定义 `app` scheme 的 Cookie jar 与 `Set-Cookie`/重定向语义是否与 http 等价 | 登录态/后端会话（S7-5/6） | 先用 §6.2 第 7 条验证；失败则走设计草案「origin 迁移 ADR」或主进程代理注入 Cookie | Lead（架构） |
| O-3 | protocol.handle 下 SSE/背压/abort 是否可靠（Next 流式 AI 响应） | AI 流式体验 | §6.2 第 6 条验证；失败则流式请求走 preload `apiFetch` 主进程代理 | 平台 owner |
| O-4 | `waveform/fingerprint` worker 的产品去留（当前零引用） | S7-3a 范围 | 默认先标 deprecated 不删（AGENTS.md），S8-6 再定 | 产品 + Lead |
| O-5 | FFmpeg core 自托管体积（约 30MB）是否可接受 | 安装包大小/离线转换 | 默认自托管；超预算则维持 CDN + 显式离线降级 | Lead |
| O-6 | Electron 下 AI 路径走 FastAPI 还是本地 Next `/api/ai/chat`（后者有服务端 env key） | S7-5 路由策略 | 默认「有 backend 用 backend，否则 Next」；能力协商优先 | Lead |
| O-7 | `vm` 逃逸在 utilityProcess 内的残余风险是否接受 | S7-7 安全结论 | 接受 + ADR 记录（二级防线=进程隔离+无高权限注入）；若不可接受，需受限子进程方案 | Lead（安全） |
| O-8 | 子 PR 数/行数较总计划上浮（19 PR/~4.3k vs 9 PR/~2.8k）；soak 是否必须进 PR 门禁 | 工期/CI 时长 | 以 ≤400 行硬约束为准；总计划 §10.2 的 S7 预算在 S7 开工时修订；soak PR 跑 10min 版，2h 版 nightly | Lead |
| O-9 | 新增生产路由 `/api/runtime/health`（含 `?stream=1` 探针）是否允许 | S7-4b 验证方式 | 可接受：仅返回进程元信息，不泄露敏感数据；或改为仅桌面模式返回完整字段 | Lead |
| O-10 | Windows 杀进程树（taskkill /T /F）与 portable 版单文件启动的兼容性 | 退出无残留（E5） | `--dir` 与 NSIS 各验一次；portable 需额外验证 | 平台 owner |
| O-11 | 手势分支（55 项）合并时间：S7-6/7 的 UI 挂载点依赖 `GlobalClientComponents.tsx`（当前 dirty） | 排期 | S7 先做无 UI 部分（S7-1..5、7a、8a）；UI 子 PR 等 S0-1 合并后串行 | Lead |
