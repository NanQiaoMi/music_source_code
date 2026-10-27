# MIMI Music Player 项目交接文档

> 文档版本：v1.0 ｜ 编写日期：2026-10-22 ｜ 对应交付包：MIMI-Music-Player-0.2.1-handover-2026-10-22
> 上级文档：`README.md`、`STARTUP_GUIDE.md`、`AGENTS.md`、`docs/nbl/ARCHITECTURE.md`
> 规划文档：`docs/nbl/plans/2026-10-21-architecture-performance-optimization.md`（总计划）、`docs/nbl/plans/2026-10-21-arch-perf-execution/`（执行计划包）
> 重要：本包是 **工作树快照**（含未提交改动），不是 git 仓库克隆，详见第 9 节。

---

## 0. 交接卡片（先看这一页）

| 项 | 内容 |
|---|---|
| 项目名称 | MIMI Music Player（Vibe Player） |
| 版本 | 0.2.1（package.json） |
| 产品形态 | Next.js 16 Web 应用 + Electron 桌面壳 + 可选 Python FastAPI 后端 |
| 代码快照 | 分支 `feature/gesture-air-control-overhaul`，HEAD `c73a872` + 未提交工作树（87 项变更/新增；含本交接文档） |
| 主要语言 | TypeScript 5.4（strict）/ React 19 / Python 3.10+ |
| 运行环境（已验证） | Windows 11，Node v24.16.0，npm 11.13.0；Node 20.9+ 应可用 |
| 当前可运行性 | Web 开发模式可运行；`npm run build` 通过；桌面发布已**主动冻结**（见第 8.2 节） |
| 未完成计划 | 架构与性能优化总计划：74 任务，已完成 4 项（S0-4/S0-6/S1-1/S1-3），详见第 11 节 |
| 敏感信息 | 包内**不含** `.env.local`、平台 cookie、API Key、构建产物；见第 14 节 |
| 交付物 | 项目源码目录（944 文件 / 26.2MB）+ ZIP（约 7.6MB）+ 本交接文档 + 包内 `PACKAGE-MANIFEST.md` + 同级 `*.zip.sha256` |

**接手第一天建议顺序**：第 2 节跑起来 → 第 9 节理解 WIP → 第 10 节看已知问题 → 第 11 节看计划与决策 → 第 12 节逐项签收。

---

## 1. 项目概览

MIMI Music Player 是一个"音乐播放 + 视觉舞台 + 情感分析"的沉浸式播放器：

- 本地/网络音乐播放、队列、歌词、封面、音效（17 种 effect）、均衡器、交叉淡入淡出。
- 可视化：当前挂载的是 V7 可视化（14 个 Canvas 2D 效果）；V8 可视化组件树（38 文件 / 11,355 行）**未接线**，属于待处置死代码（见 ADR 0001）。
- 情感矩阵：2D valence/energy 坐标、AI 歌词笔记（依赖外部 AI Key）。
- 手势控制：MediaPipe HandLandmarker + 手势会话（属于当前未提交 WIP，见第 9 节）。
- 桌面：Electron 41（Windows portable/NSIS 构建脚本存在，但当前发布链路冻结）。
- 后端：Python FastAPI（当前仅 health/capabilities 桩 + 3 个占位模型；"12 个 AI 模型"是历史规划，见 ARCHITECTURE 第 6 节已修正）。
- 文档站：`docs/nbl/`（ROADMAP/PROCESS/CODING_STANDARDS/ARCHITECTURE/specs/plans/adr/archive）。

**代码规模（2026-10-21 审计口径，之后新增约 10 个 S0/S1 文件）**：

| 指标 | 数值 |
|---|---:|
| src 下 ts/tsx | 约 700 文件（生产约 500） |
| 生产代码 | 约 14 万行 |
| Zustand store | 60 个（44 处 persist） |
| Next API route | 30 个（src/app/api/**/route.ts） |
| 测试 | 见第 7 节（约 208 文件 / 1,290+ 用例） |
| 首屏基线 | rootMain 969.3KB raw / 296.8KB gzip；首页 1,996.7KB raw / 615.7KB gzip；CSS 227.4KB |

---

## 2. 快速开始（10 分钟）

### 2.1 环境要求

- Node.js **20.9+**（本项目在 Node 24.16 上验证；Next 16 要求 20.9+）。
- npm 10+（验证版本 11.13）。
- Windows / macOS / Linux 均可开发；Electron 打包脚本当前只支持 Windows。
- Python 3.10–3.12（可选；用于 backend。3.13/3.14 下 torch/ModelScope 兼容性未验证）。
- 磁盘：源码约 60MB；安装依赖后约 1.6GB；构建缓存另需约 0.4GB。

### 2.2 安装与启动

```bash
# 1) 解压后进入项目根目录
npm ci --legacy-peer-deps      # 必须带 --legacy-peer-deps（部分 peer 依赖未对齐）
cp .env.example .env.local     # Windows: copy .env.example .env.local，按需填 AI Key；不填也能启动

# 2) 启动 Web 开发服务器（端口 3025）
npm run dev
# 打开 http://localhost:3025
# 首次启动会自动生成 next-env.d.ts、.next；耗时约 10-30s
```

```bash
# 3) 可选：启动 Python 后端（端口 8000）
cd backend
python -m venv .venv
.venv\Scripts\activate            # Windows
pip install -r requirements-minimal.txt
python -m uvicorn main:app --reload --port 8000
# 打开 http://localhost:8000/docs
```

```bash
# 4) 一条命令同时启动前端 + 后端（Windows 推荐）
npm run dev:full

# 5) Electron 开发模式（会再起一个 Next dev）
npm run dev:electron
```

### 2.3 生成 MediaPipe 资源（手势/手部追踪必需）

本包**未包含** `public/mediapipe/`（约 40MB 生成物，脚本自动生成）：

```bash
npm run sync:mediapipe          # 从 node_modules 复制 wasm，必要时下载 model（约 7.8MB）
# 或直接 npm run build / npm run dev（prebuild 会自动执行 --optional）
```

缺少该目录时：手势功能降级；其余播放/可视化功能不受影响。

### 2.4 端口与地址

| 服务 | 地址 | 说明 |
|---|---|---|
| Next dev | http://localhost:3025 | `npm run dev` |
| Next start | **3024**（历史遗留，与 dev 不一致） | `npm run start` 需先 build；建议统一改 3025（见第 10 节） |
| Python 后端 | http://localhost:8000 | uvicorn |
| Docker | 3025:3025（但 next start 实际 3024，容器不可用） | 已知问题，见第 10 节 |
| Electron 生产 | `app://app/`（协议层，映射 out/） | 当前发布冻结，见第 8.2 节 |

---

## 3. 技术栈与关键依赖

| 领域 | 方案/版本 |
|---|---|
| 框架 | Next.js 16.2.4（App Router，`--webpack` 构建；默认 server build） |
| UI | React 19.2.5、TypeScript 5.4 strict、Tailwind 3.4 + OKLCH、Framer Motion 12 |
| 状态 | Zustand 5（60 store / 44 persist；含手写 storage wrapper） |
| 渲染 | Canvas 2D（V7 可视化/手书）、Three.js 0.183（Shelf3D）、WebGL |
| 音频 | Web Audio API（AudioEngine 单例、30-band EQ、17 effects、Analyser） |
| 手势 | @mediapipe/tasks-vision、@mediapipe/hands |
| 文件/格式 | jsmediatags、@ffmpeg/ffmpeg（浏览器转码）、fabric（海报）、html-to-image |
| 桌面 | Electron 41、electron-builder 26 |
| 后端 | Python FastAPI、uvicorn、ModelScope（占位） |
| 测试 | Vitest 4 + jsdom；205+ 文件 |
| Lint/格式 | ESLint 8（legacy config）+ prettier 3；husky/lint-staged |

注意：
- `@xenova/transformers` 已安装但 src 0 引用（待移除）。
- `node_modules` 中曾有 `pixi.js` extraneous junction（打包环境独有），本包无 node_modules，不受影响。
- `.eslintrc.json` 的 4 个 parser/plugin 未在 package.json 显式声明（靠传递依赖），升级依赖时留意。

---

## 4. 目录结构（交接包内）

```
.
├── src/                    # Next.js 应用源码（约 700 文件）
│   ├── app/                # 路由、layout、30 个 API route、data-manager 页面
│   ├── components/         # UI：layout/player/library/visualization(V7)/visualization-v8(未接线)/lyrics/...
│   ├── hooks/              # useAudioPlayer(1.8k 行)、useGestureSession、useDynamicTheme 等
│   ├── lib/                # audio/(引擎)、playback/、storage/、visualization/、three/、queue/、gesture/
│   ├── services/           # 元数据/歌词/本地音乐/缓存/resolver/worker pool
│   ├── store/              # 60 个 Zustand store + coordinator/(已弃用空壳) + selectors/(规划)
│   ├── workers/            # conversion/dsd/fingerprint/waveform
│   ├── utils/ types/ test/
├── electron/               # main/index.js(389 行)、preload、pluginManager
├── backend/                # FastAPI 源码（build/dist/venv 已排除）
├── public/                 # 运行时静态资源（mediapipe 已排除，见 2.3）
├── scripts/                # 启动/清理/构建/打包/校验脚本（含本次新增 package-handover.mjs）
├── perf/                   # 性能基线：budget.json、bundle-baseline.json、store-stats-baseline.json、README
├── docs/nbl/               # 架构/流程/计划/规范/ADR/specs/archive；交接文档在本目录
├── .github/workflows/      # CI（master 触发；本轮修复）
├── .husky/                 # pre-commit
├── .env.example            # 环境变量模板（新增；真实 .env.local 不在包内）
├── AGENTS.md / README.md / STARTUP_GUIDE.md / DESIGN.md / PRODUCT.md / LICENSE
├── package.json / package-lock.json / next.config.js / tsconfig.json / vitest.config.ts
├── Dockerfile / docker-compose.yml
└── PACKAGE-MANIFEST.md / SNAPSHOT.txt / HANDOVER-README.md   # 打包生成
```

**交接包中已排除**（不在包内）：`node_modules`、`.next`、`out`、`dist-electron`、`MIMI-Music-Player-Portable`、`.git`、`.worktrees`、`scratch`、`.venv`、`coverage`、`test-results`、`backend/build|dist|__pycache__`、`public/mediapipe`、`.env.local`、AI 助手 dot 目录、日志、tsbuildinfo、`skills/`、`musicapi/` 等。完整清单与原因见包内 `PACKAGE-MANIFEST.md`。

---

## 5. 架构与关键链路

### 5.1 启动链路

```
src/app/page.tsx（"use client"）
  → 动态 import 重视图（PlayerView/VisualizationView/FeatureButtons/...）
  → useEffect: uiStore.restorePersistedView()
  → bootstrapApp()（src/lib/bootstrap.ts）
       → 恢复队列/播放会话/播放模式
       → 初始化播放器与服务（含 AudioContextWatchdog.start() 等）
  → useDynamicTheme / useKeyboardShortcuts
  → GlobalClientComponents（常驻：手势、音频、Toast、面板宿主）
```

已知问题：页面级整店订阅（`useUIStore()`）导致 UI 写入会重渲染整个应用壳；优化计划 S3 处理。

### 5.2 播放链路（最重要）

```
UI 播放按钮 → useAudioPlayer.playSong()
  → 离线/本地/缓存/网络 多源解析（MultiSourceResolver 1,366 行 + 30 个 API route）
  → <audio> 元素（模块级共享）
  → AudioEngine(AudioContext) → 30-band EQ → masterGain → AnalyserNode
  → AudioEffectsManager(17 effects) → CrossfadeMixer → destination
  → playbackRuntimeStore（requestId/phase/activeDeck）+ playbackStateMachine
  → queueStore / playerStore / audioStore（三套状态，历史遗留）
```

关键文件：`src/hooks/useAudioPlayer.ts`（1,823 行，god hook）、`src/lib/audio/*`、`src/store/{playerStore,audioStore,queueStore,playbackRuntimeStore}.ts`。

已知 P0（交接后优先处理，详见第 10 节）：
- 队列双权威：audioStore.queue 与 queueStore.queue 手工同步，队列面板操作后可能播错歌。
- useAudioPlayer 多实例共享 audio 元素并互相剥离监听（关面板后 ended/timeupdate 可能失效）。
- 播放请求无 AbortController。
- AudioContextWatchdog 懒创建路径不生效。
- 音频图双路（analyser 常连 destination + 效果链再连）→ 干湿叠加/音量疑似双衰减。
- `src/lib/playback/`、`src/lib/storage/quotaPolicy.ts` 等新模块是 S1 优化的一部分（已落地部分）。

### 5.3 可视化

- 当前挂载：`src/components/visualization/VisualizationView.tsx`（747 行，14 个 effect，Canvas 2D）。
- 未接线：`src/components/visualization-v8/**`（38 非测试文件 / 11,355 行）仅自身测试引用；`visualizationV8Store` 仍被导航岛/AI 工具写入（空操作），`performanceV8Store` 被 V7 3 个文件使用。处置方案见 `docs/nbl/adr/0001-v8-visualization.md`（推荐"移植契约→重定向→删除"）。
- 3D 书架：`src/components/library/Shelf3DView.tsx`（2,521 行，Three.js）。
- 性能注意：43 处 rAF / 20 文件、13 处 setInterval；常驻视图（Home/Player/Visualization）都有整店订阅，优化计划 S3/S5。

### 5.4 状态管理

- 60 个 store，44 处 persist。单一事实源缺失（11 组重复事实）。
- 新增 `src/lib/storage/storageRegistry.ts`：44 key 的 owner/version/group/backup/quotaPolicy 注册表 + 一致性测试；后续迁移以它为准。
- 新增 `src/lib/storage/quotaPolicy.ts` + `degradedNotifier.ts`：统一配额降级策略（S1-3 已落地）。
- store 间静态 import 边 25 条，唯一强连通分量 `audioStore ↔ playlistStore`。
- 目标架构（待执行）：playerStore（播放意图 owner）、queueStore（队列 owner）、playbackRuntimeStore（生命周期权威）、domain 用例层 + 类型化事件；详见 S6 执行计划。

### 5.5 持久化与数据兼容（红线）

- 44 个 localStorage key（清单见 storageRegistry.ts）；IndexedDB：`VibeMusicDB`（v1/v2 冲突）、`VibeMusicMetadataDB`、`VibeMusicCoverDB`、`VibeNetworkAudioCacheDB`、AI agent DB 等。
- **禁止**重命名/删除现有 key、破坏备份 envelope、改变 IndexedDB keyPath；结构变更必须 version+1 + migrate + 旧 JSON fixture 测试。
- 已知问题：备份 10 槽位中 5 个 key 错配（S1-2 待做）；启动压缩已修（S1-3，不再 200→50 截断）；VibeMusicDB v1/v2 双版本冲突（S1-4 待做，本地歌曲可能提示"文件不存在"）。

### 5.6 网络音源与 API

- 30 个 Next API route：搜索/歌曲 URL/歌词/歌单/登录 cookie/代理/音源诊断等；第三方平台包括网易云、QQ、酷狗、酷我、汽水、LX。
- 客户端通过 `MultiSourceResolver` 逐平台解析；Electron 下 `/api/*` 依赖 `location.origin`，而生产窗口是 `app://app/` → 在线能力在桌面版失效（P0-8）。
- 第三方源/平台 cookie 存在合规风险：cookie 明文存 localStorage（S7-8 计划加密）；内置源与用户源配置需注意授权。
- 网络受限环境下，播放本地文件不受影响。

### 5.7 AI 与后端

- Next API `/api/ai/*` 读取 `SENSENOVA_*` 环境变量（见 .env.example）。
- Python backend 当前是能力发现/健康检查桩；`/docs` 可看接口；模型不会随包下载。
- 未配置 Key 时 AI 功能应降级为不可用（UI 会提示）。

### 5.8 Electron

- 主进程 `electron/main/index.js`：生产加载 `app://app/`，映射到 `out/`；dev 加载 localhost:3025。
- 当前发布冻结（D2/ADR 0002）：Next 16 `output:"export"` 与 31 个 API route 不兼容（实测报错），静态导出无法作为发布路径；推荐改为"本地 Next standalone 运行时 + app:// 协议桥接"（S7-4）。
- `scripts/verify-desktop-release-ready.mjs` 默认 exit 1；`build-desktop-win.ps1` 与 CI desktop job 已接入该门禁，防止发陈旧前端。

---

## 6. 开发命令速查

```bash
# 开发 / 构建 / 启动
npm run dev              # Next dev，端口 3025（先 clean-port）
npm run dev:full         # 前端 + Python 后端
npm run dev:electron     # 前端 + Electron
npm run build            # 生产构建（webpack；约 115s 冷构建）
npm run start            # next start，端口 3024（历史遗留）
npm run clean            # 清理 .next
npm run clean:all        # .next + node_modules/.cache

# 质量
npm run test             # vitest（watch）
npm run test -- --run    # 单次运行
npm run test:coverage    # 覆盖率（仅 audio+utils 范围）
npm run lint             # eslint .（仓库根）
npx tsc --noEmit         # 类型检查
npm run format           # prettier 写入

# 新增（本轮 S0/S1）
node scripts/perf/bundle-budget.mjs             # 包体预算（读 .next）
node scripts/perf/report-store-stats.mjs --check # Store 架构回归
node scripts/check-docs-facts.mjs               # 文档事实校验
node scripts/verify-static-export.mjs           # out/ 新鲜度（当前会 fail，预期）
node scripts/verify-desktop-release-ready.mjs   # 桌面发布门禁（当前 exit 1，预期）
node scripts/package-handover.mjs               # 生成本交接包

# 平台
npm run build:backend:win  # PyInstaller（需 Python + 依赖）
./scripts/build-desktop-win.ps1 -Clean  # 桌面打包（当前会被 release guard 拦截）
```

**注意**：`npm run dev` 会先 `clean .next`；不要与 `npm run build` 并行；`npm run build` 也会 clean。CI 顺序：tsc → eslint → test → build。

---

## 7. 测试与质量现状

| 项 | 现状 |
|---|---|
| 测试框架 | Vitest 4 + jsdom（`vitest.config.ts`） |
| 测试规模 | **208 个测试文件 / 1,284 个用例**（2026-10-22 实测，Node 24.16，耗时 70.2s） |
| 通过状态 | `npx vitest run`：208 文件 / 1,284 用例全部通过；`npx tsc --noEmit` exit 0；`npx eslint src` 0 problems |
| 覆盖率 | 仅 `src/lib/audio/**` + `src/utils/**`（15 文件），阈值 30/20/30/30；store/services/hooks/visualization 未纳入（S8 扩域） |
| CI | `.github/workflows/deploy.yml`：master push/PR 触发；verify job 含 tsc/lint/test/build/bundle report/store stats/docs facts；desktop/Vercel 改手动触发。**尚未 push，因此未在 GitHub 上实际运行过** |
| 已知短板 | 组件/API route/visualization 测试覆盖低；Electron IPC 仅 3 个用例；无 E2E（Playwright 为长期项） |

交接后第一件事建议：在干净环境跑一次 `npm ci --legacy-peer-deps && npx tsc --noEmit && npm run test -- --run && npm run build`，确认与本文一致。

---

## 8. 打包与发布

### 8.1 Web

- 构建：`npm run build` → `.next/`，`next start`（注意端口 3024）或 Docker。
- Vercel workflow 已改为手动触发（`deploy-to-vercel` job）；secrets 需在仓库配置。
- Dockerfile/compose 存在端口不一致（3025 映射 vs next start 3024），修复前 Docker 镜像不可用。

### 8.2 Windows 桌面（当前必须冻结）

原因（2026-10-21 实测）：`STATIC_EXPORT=1 next build` 失败：
`/api/audio/proxy`、`/api/kugou/login/status` 等 31 个 API route 报 "export const dynamic/revalidate not configured ... with output: export"。
因此 `out/` 无法由当前代码生成（现存 out 是 2026-07-30 陈旧产物）；Electron 打包若继续会发旧前端 → 已加门禁主动阻断。

解冻路径（计划 S7-4，D2-B）：本地 Next standalone 运行时 + `app://` 协议桥接 + BackendGateway；保留 origin 以兼容 44 个 localStorage key 与 IndexedDB。验收：打包 `--dir` 冷启动窗口 <3s、`/` 与 `/data-manager` 200、旧数据可见、在线链路可用或明确降级。
替代方案（不推荐）：只做本地播放器（放弃在线能力）或砍掉 API route 后静态导出。

### 8.3 本次交接包

- 生成脚本：`scripts/package-handover.mjs`（新增；替代旧的 `scripts/package-project.ps1`，后者已过时且排除规则有 bug）。
- 输出：`dist/handover/MIMI-Music-Player-0.2.1-handover-2026-10-22/` + 同名 `.zip` + `.zip.sha256`。
- 包内：源码（含未提交 WIP）、docs、scripts、perf、electron、backend 源码、config、public（不含 mediapipe）、`.env.example`、本交接文档、`PACKAGE-MANIFEST.md`、`SNAPSHOT.txt`、`HANDOVER-README.md`。
- 包体实测：**944 个文件 / 26.2MB（未压缩）**；ZIP 约 **7.6MB**；SHA256 见同级 `.zip.sha256`。
- 重新生成：`node scripts/package-handover.mjs`（输出到 `dist/handover/`；暂存目录在项目同级 `handover-build/`，默认自动清理）。
- 排除：见第 4 节与包内 MANIFEST（含每项排除原因）。

---

## 9. 当前工作树状态（重要）

> **2026-10-27 更新**：未提交快照已按 Q01-A 处理为 checkpoint 分支 `checkpoint/gesture-air-control-overhaul-20261027`（commit `2b99173`，123 files / +27,294/−1,967；含手势 WIP、handwritten MV、S0/S1 基线、交接文档）。主工作区现已干净；原 `feature/gesture-air-control-overhaul` 分支保持在 `c73a872`。后续按 S0/S1 计划拆分 ≤400 行 PR。

本包是 **working tree 快照**，包含尚未提交的改动。base commit：`c73a872`（分支 `feature/gesture-air-control-overhaul`，落后 master 11 个提交）。

未提交内容分两类（共 87 项 git status，含本交接文档与打包/环境模板脚本）：

1. **手势 Air Control  overhaul（原有 WIP，约 55 项）**
   - 新增：`src/hooks/useGestureSession.ts`（649 行）、`src/store/gestureSettingsStore.ts`、`src/components/interaction/GestureHUD.tsx`、`src/components/settings/GestureSettings.tsx`、`src/lib/gesture/**` 等。
   - 修改：`page.tsx`、`PanelOrchestrator.tsx`、`GlobalClientComponents.tsx`、`uiStore.ts`、`package.json`、`tsconfig.json`、`gestureStore.ts` 等；删除 `src/hooks/useHandGesture.ts`。
   - 这批改动**已合入当前源码**，接收方无需再"应用补丁"；但没有对应 commit，无法回溯历史。
2. **本轮架构/数据修复（2026-10-21/22，约 29 项）**
   - docs：总计划、执行计划包、ADR、INDEX、AGENTS/ARCHITECTURE 修正。
   - 工程：CI 重写、ESLint 规则、coordinator 弃用、S0-3 构建校验脚本、S1-1 storageRegistry、S1-3 配额策略、perf 基线、docs-facts 脚本、本交接包脚本。
   - 这些改动同样已体现在源码中；相关测试/tsc 已通过。

**WIP 风险**：单文件最大改动 `cinematicLyricDrift.ts`（约 2,965 行）；`package.json` 与 `tsconfig.json` 被手势改动占用，因此端口统一（S0-3）与部分依赖调整尚未做。建议接收方第一步：在本地建分支提交当前快照作为基线（原仓库勿丢失），再按第 11 节计划推进。

---

## 10. 已知问题与优先级（交接后必读）

| 级别 | 问题 | 位置/证据 | 计划 |
|---|---|---|---|
| P0 | 队列双权威：audioStore.queue vs queueStore.queue 手工同步 | audioStore.ts:77-78,394-464；queueStore.ts:343-348 | S1-5 |
| P0 | VibeMusicDB 同时以 v1/v2 打开 → 本地音源读取失败 | localMusicService.ts:7-13；localMusicStorage.ts:6-7 | S1-4（需 fake-indexeddb，Q04） |
| P0 | 备份 10 槽位中 5 个 key 错配，恢复不 rehydrate | backupRestoreStore.ts:148,231-232,327-329 | S1-2（下一步） |
| P0 | useAudioPlayer 多实例互删监听 | useAudioPlayer.ts:200-250,954-981 等 | S1-6 |
| P0 | 播放请求无 AbortController | useAudioPlayer.ts:1400-1706 | S1-8 |
| P0 | AudioContextWatchdog 懒创建失效 | AudioContextWatchdog.ts:29-46；bootstrap.ts:73 | S1-7 |
| P0 | 音频图双路 + 音量双写 | AudioEngine.ts:68；useAudioPlayer.ts:986-1005,1758-1764 | S2-1 |
| P0 | 桌面发布链路断（静态导出与 API 不兼容） | 第 8.2 节 | S7-4（D2） |
| P1 | 页级/常驻视图整店订阅 | page.tsx:78-79；HomeView/PlayerView | S3 |
| P1 | LazyPanel 粘性挂载、重复宿主 | LazyPanel.tsx:50-60；SourceManagementModal 双挂载 | S3-6/7 |
| P1 | V8 组件树未接线（11,355 行死代码） | visualization-v8/** | S4-7（D1） |
| P1 | 首屏混入 jsmediatags/crypto-js | rootMain 296.8KB gzip；audit D/B | S4 |
| P1 | 60 store 无所有权、audioStore god store | store 审计 | S6 |
| P2 | 文档历史数字失真（44 stores/28 effects 等） | 已在 AGENTS/ARCHITECTURE 修正；ROADMAP/CHANGELOG 仍含旧叙述 | S0-4 收尾 |

完整分级见：`docs/nbl/plans/2026-10-21-architecture-performance-optimization.md` 第 3 节；执行级步骤见 `docs/nbl/plans/2026-10-21-arch-perf-execution/S*-*.md`。

---

## 11. 进行中的计划与交接状态

### 11.1 文档入口

- 总计划（S0-S8，74 任务，~129 子 PR）：`docs/nbl/plans/2026-10-21-architecture-performance-optimization.md`
- 执行计划包（逐任务文件级步骤/测试/验收/回滚）：`docs/nbl/plans/2026-10-21-arch-perf-execution/README.md`
- 进度看板：`docs/nbl/plans/2026-10-21-arch-perf-execution/TRACKING.md`
- 决策记录 D1-D8 + Q01-Q23：`docs/nbl/plans/2026-10-21-arch-perf-execution/00-decisions.md`
- ADR：`docs/nbl/adr/`（V8/桌面运行时/音频图/持久化/受保护视图，均为 Proposed）
- 审计证据：`scratch/architecture-audit-2026-10-21/`（**不在交接包内**，已 gitignore；如需可向原维护者索取）

### 11.2 已完成（4/74）

- S0-4 文档事实修正（AGENTS/ARCHITECTURE；docs-facts 通过）
- S0-6 测量基座（bundle-budget/store-stats/check-docs-facts + perf 基线）
- S1-1 storageRegistry（44 key/8 backup + 一致性测试）
- S1-3 启动压缩与配额策略（不截断队列、不写空队列、降级可见）

S0-2（CI）本地完成未 push；S0-3 结论确定（桌面冻结）；S0-5/S0-7 部分完成。

### 11.3 未决事项（接收方需与产品/原负责人确认）

| ID | 事项 | 默认假设 |
|---|---|---|
| Q01 | 55 项手势 WIP 如何处理（提交/拆 PR/冻结） | 建议先提交 checkpoint 再继续 |
| Q02 | GitHub branch protection / required checks 权限 | 有权限则开，否则 CI report-only |
| Q04 | 是否允许 devDep fake-indexeddb（S1-4 测试） | 建议允许 |
| Q05 | 新增 persist key（theme-store/quality-store） | 允许，旧 key 保留一版 |
| Q07 | 旧 key 删除窗口 / coordinator 删除 | 迁移后下一个 minor |
| Q10 | S4 包体目标 190KB vs 实测缺口 ~29KB | 缺口≤10KB 可重定 ≤200KB |
| D1/D2/D7 | V8 处置 / 桌面运行时 / 受保护视图改写授权 | 推荐 C/B/A（见 ADR） |

---

## 12. 交接验收清单（接收人逐项确认）

- [ ] 解压后目录完整（约 944 文件 / 26.2MB）；`PACKAGE-MANIFEST.md` 的排除清单符合预期；ZIP 校验值与同级 `*.zip.sha256` 一致。
- [ ] `npm ci --legacy-peer-deps` 成功（Node 20.9+）。
- [ ] `cp .env.example .env.local` 后（可不填 Key）`npm run dev` 可启动，http://localhost:3025 打开首页。
- [ ] `npm run build` 成功（约 2 分钟）；产物含 3 个静态页 + 31 个 API route。
- [ ] `npx tsc --noEmit` 与 `npm run test -- --run` 通过（数字与第 7 节一致或更好）。
- [ ] 能播放本地音频；能打开播放器/队列/歌词/可视化（V7）；`public/mediapipe` 生成后手势可初始化（需摄像头）。
- [ ] 明确知道：**桌面发布暂停**，原因与解冻路径见 8.2；不要直接跑 desktop 打包发布。
- [ ] 明确知道：当前源码含未提交 WIP（第 9 节），建议先建基线提交。
- [ ] 明确知道：数据格式红线（第 5.5 节）；改 store persist 前先看 storageRegistry 与 S6 计划。
- [ ] 明确知道：包内无 secrets/cookie/API Key；线上能力需自行配置 .env.local 与平台登录。
- [ ] 已阅读第 10/11 节，确认下一步优先级（建议 S1-2 → S1-6/7 → S0-1 收尾）。

---

## 13. 常见陷阱与排障

1. **端口**：dev=3025，start=3024（不一致）。端口占用用 `npm run clean:port` 或 `node scripts/clean-port.js 3025`。
2. **构建/开发互斥**：`npm run build` 会先删 `.next`；不要在 dev 运行时 build，也不要并行 tsc+build。
3. **依赖安装**：必须 `--legacy-peer-deps`；`npm install` 可能因 peer 冲突失败。
4. **MediaPipe 资源**：缺失时手势降级；`npm run sync:mediapipe` 需要网络下载模型（首次）。
5. **长路径/中文路径（Windows）**：项目路径含中文/空格时，个别脚本（Python/PyInstaller/Electron）可能异常；建议短英文路径。
6. **Electron 打包**：会被 `verify-desktop-release-ready.mjs` 拦截（预期）；不要用 `--no-verify` 绕过发布。
7. **备份/恢复**：当前 v4 备份存在 key 错配（S1-2 未做），测试恢复前务必备份 localStorage/导出。
8. **数据库**：`VibeMusicDB` v1/v2 冲突（S1-4 未做）；本地导入歌曲可能提示"文件不存在"，不要据此判断文件丢失。
9. **AI**：没配 `.env.local` 时 AI 功能不可用是预期行为；不要把 Key 提交到仓库。
10. **性能测量**：`bundle-budget.mjs` 依赖 `.next`（先 build）；`perf/measure.py` 是临时脚手架，目标 dev 路由已不存在，S5-1b 会重建 harness。
11. **工作树**：原仓库有 27 个本地 worktree（5.19GB）与 30+ AI dot 目录，本包已排除；重新接手原仓库时注意不要误删用户 worktree。
12. **CI**：本地改的 workflow 未 push，GitHub 上可能仍显示旧配置；推送前确认分支/权限。

---

## 14. 安全与合规

- **本包不含任何密钥**：`.env.local` 被排除；`.env.example` 仅列变量名。
- 平台登录 cookie 当前明文存 localStorage（S7-8 计划加密）；不要在共享机器登录账号。
- 第三方音源/解析脚本（musicapi 等已排除，但 src 内仍有 resolver）存在版权与平台条款风险；商用/分发前需法务确认（决策 D8）。
- 备份默认不含 IndexedDB 音频二进制（D4-A）；"完整导出"需另立计划。
- Electron 插件当前用 vm 沙箱（非安全边界），计划迁移 utilityProcess（S7-7）。
- 仓库历史中可能含旧 secrets？本包无 git 历史；若接手原仓库，建议跑一次 secret 扫描。

---

## 15. 外部服务、权限与联系人（占位，需原负责人补充）

| 项 | 说明 | 交接动作 |
|---|---|---|
| GitHub | remote：NanQiaoMi/music_source_code（默认 master） | 转移/添加协作者权限；确认 Actions 可用 |
| Vercel | deploy workflow 需 VERCEL_TOKEN/ORG/PROJECT secrets | 手动触发前配置 |
| AI Key | SenseNova/ModelScope（.env.local，5 key 轮换） | 通过安全渠道交接，勿写入文档/仓库 |
| 平台账号 | 网易云/QQ/酷狗/酷我/汽水 登录 cookie 由用户在应用内扫码 | 不随包交接 |
| 后端服务 | Python FastAPI（8000），Electron 打包时 PyInstaller 内嵌 | 交接 requirements 与生产启动方式 |
| 项目负责人 | 原"大咪小咪组" | 补充联系人/值班方式 |

---

## 16. 参考文档索引

| 文档 | 用途 |
|---|---|
| `README.md` | 产品介绍（部分营销数字已过时，以 ARCHITECTURE 为准） |
| `STARTUP_GUIDE.md` | 启动指南（端口/打包部分以本交接文档为准） |
| `AGENTS.md` | AI Worker 入口 + 项目约束（已按实测修正） |
| `docs/nbl/ARCHITECTURE.md` | 系统分层/模块/链路（已按实测修正） |
| `docs/nbl/ROADMAP.md` | 路线图（部分内容早于本轮计划） |
| `docs/nbl/PROCESS.md` | 开发流程（PR ≤400 行、验证顺序） |
| `docs/nbl/CODING_STANDARDS.md` | 编码/测试规范 |
| `docs/nbl/plans/2026-10-21-architecture-performance-optimization.md` | 架构与性能总计划（当前主计划） |
| `docs/nbl/plans/2026-10-21-arch-perf-execution/` | 执行计划包 + TRACKING + 决策 |
| `docs/nbl/adr/` | 架构决策记录 |
| `docs/nbl/specs/` | 视觉/交互设计规格（Folia/手书/3D 架/手势） |
| `perf/README.md` | 性能基线工具与口径 |
| `PACKAGE-MANIFEST.md`（包内） | 本包文件数/大小/排除清单/生成元信息 |

---

## 17. 术语表

| 术语 | 含义 |
|---|---|
| V7 / V8 可视化 | 两代可视化实现；V7 当前挂载（14 效果），V8 未接线（11,355 行） |
| 整店订阅 | `useXStore()` 不带 selector，订阅整个 store（性能问题） |
| persist key | Zustand 持久化到 localStorage 的 key（44 个） |
| WIP | 未提交工作（本包中的手势 overhaul 与本轮修复） |
| D1-D8 / Q01-Q23 | 决策与执行期待确认项（00-decisions.md） |
| S0-S8 | 总计划的 9 个阶段 |
| guard | 发布门禁脚本（桌面/静态产物） |

---

## 18. 附录

### A. 常用验证命令

```bash
npx tsc --noEmit --incremental false --pretty false
npx eslint src --max-warnings=0
npm run test -- --run
npm run build
node scripts/check-docs-facts.mjs
node scripts/perf/report-store-stats.mjs --check
node scripts/perf/bundle-budget.mjs
```

### B. 环境变量

见 `.env.example`；关键：`SENSENOVA_BASE_URL`、`SENSENOVA_DEFAULT_MODEL`、`SENSENOVA_API_KEY_1..5`、`SENSENOVA_API_KEY`、`NEXT_PUBLIC_APP_URL`、`NEXT_PUBLIC_BACKEND_URL`、`NEXT_PUBLIC_MEDIAPIPE_ASSET_BASE`。

### C. 包内附加文件

- `SNAPSHOT.txt`：打包时的分支/HEAD/git status 摘要（84 项）。
- `PACKAGE-MANIFEST.md`：文件数/大小/排除清单/生成时间/脚本版本。
- `HANDOVER-README.md`：包根目录的 30 秒上手说明。
- `CHECKSUMS.sha256`（ZIP 同级）：ZIP 完整性校验。

### D. 交接后的第一批 TODO（建议）

1. 建基线提交（把当前 WIP 固化到新分支），避免再丢改动。
2. S1-2 备份/恢复修复（改 5 个错配 key + rehydrate + 旧备份兼容 + 测试）。
3. S1-7 看门狗、S1-6 媒体事件桥（P0，播放稳定性）。
4. S0-1 收尾（脏改变成正式提交）→ S0-3 端口统一（package.json 3024→3025、build:static 脚本接入）。
5. 按 TRACKING 推进 S2/S3，性能目标见总计划第 6 节。

---

*本文档由 2026-10-22 交接打包流程生成；如与代码不一致，以代码与 `PACKAGE-MANIFEST.md` 为准，并回写本文档。*
