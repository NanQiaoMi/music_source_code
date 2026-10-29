# S6-9d hooks getState 收敛（2026-10-29）

分支：`feature/arch-perf-s6-9d`（worktree `_worktrees/arch-perf-s6-1`，父 `7868b73`）

## 目标与口径

- 目标：hooks 层 `useXxxStore.getState()` 收敛到 ≤20；本次直接归零（0）。
- 口径：`scripts/report-getstate.mjs`（src 下非测试 .ts/.tsx 中 `use[A-Z]\w*Store.getState(` 出现次数）。
- 依赖层棘轮保持：services 0 / components 0 / lib 5（bootstrap 2 + gesture/actions 3 白名单）。

## 数量对比

| 层 | before | after | 说明 |
|---|---|---|---|
| hooks | **84** | **0** | 本次收敛 |
| store | 168 | 210 | 同一批命令式读取迁入 `src/store/actions/*`（store 层只报告、未棘轮） |
| domain | 15 | 15 | ports.ts 适配器不动 |
| lib | 5 | 5 | 白名单不变 |
| services / components / app | 0 / 0 / 0 | 0 / 0 / 0 | 保持 |

before 逐文件：useAudioPlayer 55、useMediaSession 9、useGestureSession 9、useKeyboardShortcuts 6、useDailyRecommendation 4、useStorageDegradedToast 1。

报告原件：`perf/reports/s6-9d-getstate.before.json`（由 HEAD 树 `git archive` 生成）、`perf/reports/s6-9d-getstate.after.json`。

## 做法

1. **渲染期读取不动**：所有 `useXStore((s) => ...)` selector 订阅保持原样（零重渲染语义不变）。
2. **命令式读取收口到动作层**（沿用 S6-9c/S6-10b 既有约定：薄适配、每次现取 getState、不缓存快照）：
   - 新增 `src/store/actions/playbackEngineActions.ts`：播放请求/机位/媒体事件、进度·时长·加载成对写入、MediaSession 传输命令、AB 循环/队列/情绪/日志/登录引导。
   - 新增 `src/store/actions/gestureActions.ts`：手势设置/绑定/运行时快照（每帧检测回调）。
   - 新增 `src/store/actions/recommendationActions.ts`：负反馈/收藏快照 + 推荐刷新。
   - 新增 `src/store/actions/shellActions.ts`：uiShell 快照、面板命名命令、Esc 关闭设置浮层。
   - 复用既有 `playbackActions`（getPlayerSnapshot/getPlayerPlaybackRate/playQueue）、`playbackRuntimeActions`（getPlaybackRuntimeSnapshot）、`uiActions`（showToast）。
3. **行为保持**：全部替换都指向同一个 store 方法、同一调用时序（事件回调内仍是「此刻」值）；toast 走 uiActions.showToast 与 uiStore.showToast 同一实现；未改任何 selector/持久化/事件总线。
4. **棘轮与守卫**：`report-getstate.mjs` 的 `RATCHET_LAYERS` 增加 `hooks`；`perf/getstate-baseline.json` 增 `targets.hooks=0`、`allowed.hooks={}` 与 rationale；`src/test/getstate-boundary.test.ts` 同步纳入 hooks，并把「扫描器非退化」哨兵从 useAudioPlayer 改为 `src/store/audioStore.ts`。

## 验证

| 检查 | 结果 |
|---|---|
| `node scripts/report-getstate.mjs --check` | PASS：services 0/0、components 0/0、lib 5/5、hooks 0/0 |
| `npx vitest run` | 280 files / 1,750 tests passed（单独串行执行；并行跑 lint 时 visualRuntime p95 计时用例曾抖动 1 次，单跑通过） |
| `npx tsc --noEmit` | 0 errors |
| `npx eslint src --ext ts,tsx --rulesdir eslint-rules --max-warnings=0` | 0 errors / 0 warnings |
| `npm run verify:layers` | 0 errors / 29 no-orphan warnings（与基线同量） |
| `npm run perf:gates` | PASS：store budgets 107 files / SCC 0；wholeCalls 0；bundle markers 0；getState {"domain":15,"lib":5,"store":210} |

## 缺口与遗留

- store 层 getState 168→210（净 +42）：这是「hooks 不再直连 store」的代价，动作层是仓库既定的命令式读取归属；store 层当前无棘轮，是否下一步收紧由 Lead 决定。
- 计划 S6-9 Step4（lib/services 的 ESLint no-getState override）未加，仍靠 report + guard test。
- store 间运行时边 23（未达 ≤6，属 S6-5/S6-10 范围）；无浏览器 smoke。
- 未改 main 仓库、未合并、未 push。
