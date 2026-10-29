# S1 阶段退出证据（M1 出口门）

> 计划依据：[S1-data-playback.md](../S1-data-playback.md) §5「阶段级验证命令与证据清单」
> 看板：[TRACKING.md](../TRACKING.md)｜上游：[架构与性能优化总计划](../../../2026-10-21-architecture-performance-optimization.md)
> 生成时间：2026-10-29（Asia/Shanghai）
> worktree：`D:/26project/music_source_code_V1.1_full/_worktrees/arch-integration-s1-5`
> 分支：`feature/arch-perf-s1-10b`（S1-10b 增补，基于 `integration/s1-batch` @ `c736326`；原证据写于 `docs/s1-evidence` @ `1268e9b`；2026-10-29 在同一 worktree 的集成栈上并入 S1-2，见 §2 S1-2 行与 §8.1）
> 约束：未 push；未改动主工作区 `D:/26project/music_source_code_V1.1_full/music_source_code`；回滚演练的临时分支均已删除。

## 0. 结论（先看这里）

- **任务完成度**：TRACKING 记 S1-1..S1-10 全部 done（10/10）；本证据复核了每个任务的提交、变更规模与可运行的定向测试。
- **自动化回归**：本 worktree 9 组定向测试合计 **178 passed / 0 failed，全部 exit 0**（10b 新增 8；另有合入后的 S1-2 17 用例单列复核，见 §2）。全量 suite：**301 files / 1874 passed + 1 skipped，exit 0**（§8.1）。
- **M1 出口门未关闭**（按计划 §1「E1-1..E1-9 全部满足」判定）：
  1. ~~**S1-2 未合入集成栈**~~ → **已合入**（2026-10-29，`git merge --no-ff feature/arch-perf-s1-2a` @ `5862795` 并入 `496186f`）：v5 schema/迁移/rehydrate/面板报告已在集成栈上通过 17 用例，E1-2 转为**达成（自动化）**；用户可见的「恢复后重载」仍需真机 smoke（§8）。
  2. **firstSound 未采样**：S1-9 的 `playbackMarks` 已就位并有单测，但 P50/P95 无真实样本（§4），E1-8 不能判定。
  3. **真机 smoke 未执行**：devicechange/合盖、`local://` 导入→刷新→可播、真实网络源、听感 A/B 均未执行（§8）。
  4. ~~**S1-10 覆盖不足**~~ → **已补齐**（2026-10-29，S1-10b）：集成矩阵 **6 文件 / 21 用例**（备份恢复 7 + v1→v3 local:// 1 + 既有 13）；备份 restore 真实 rehydrate 路径另修复一处 `readPersist` 函数式 store 漏判（§2.2）。
- **证据口径**：只有在本 worktree 实际执行并捕获 exit code 的数字标「实测」；来自 TRACKING/历史分支的标「历史」；不能核实的标「**未复核**」；真机/采样项标「**未执行/未采样**」。

## 1. 环境与统计口径

| 项               | 值                                                                            |
| ---------------- | ----------------------------------------------------------------------------- |
| OS / shell       | Windows / PowerShell 7（pwsh）                                                |
| Node / npm / git | v24.16.0 / 11.13.0 / 2.54.0                                                   |
| 测试框架         | Vitest 4.1.5（jsdom）                                                         |
| 变更行数来源     | `git show --numstat <commit>`、`git diff --numstat <merge>^1 <merge> -- src`  |
| 测试命令         | `npx vitest run <files>`（CI=1，非 watch）                                    |
| 测试计数         | 仅统计被点名文件；与 TRACKING 的「targeted/full suite」口径不同处已在备注说明 |

## 2. S1-1..S1-10 交付与验证

> 本仓库没有 PR 编号（未 push），「分支/提交」列记录实际分支与提交；「变更」列优先取合并提交相对第一父的 `src/` 差集，其次取单提交 `--numstat`。

| ID     | 交付摘要                                                             | 分支 / 提交（合入）                                                                                                       | 变更（文件/行）                                                                                                                                 | 测试（本 worktree 实测）                                                                                                     | exit | 备注 / 缺口                                                                                                        |
| ------ | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------ |
| S1-1   | storageRegistry v1：44 key + owner/version/group/backup + 一致性测试 | 无独立提交，随 checkpoint `2b99173` 落入基线                                                                              | 新增 2 文件（storageRegistry.ts 443 行 + test 119 行，checkpoint 时）；当前 442 + 138 行                                                        | `storageRegistry.test.ts` **6 passed**                                                                                       | 0    | TRACKING 记 5 用例，当前文件实测 6（后续有增补）；任务改动行数无法从 123 文件的 checkpoint 中单独归属 → **未复核** |
| S1-2   | 备份 v5 schema、v4 迁移、rehydrate、body 清理、面板报告              | **已合入**：`feature/arch-perf-s1-2a` @ `5862795`（2a `825e109`，2b `5862795`）→ merge commit（父 `496186f` + `5862795`） | 2a：8 文件 +948/−456；2b：3 文件 +261/−2；合并冲突 2 文件（store 重写 vs S6-12h 拆分、面板整店订阅 vs no-whole-store），解法见 §2.2             | store 10 + panel 3 + rehydrate 4 = **17 passed**（2026-10-29 本 worktree 实测，exit 0）；另 S6-11 备份契约 3 passed 未改一行 | 0    | 面板「立即刷新」仍靠真机 smoke；v5 备份对 pre-S1-2 代码前向不兼容（§6.2/§7）；S1-10b 已补备份恢复集成矩阵（§2.2）  |
| S1-3   | 启动压缩不截断、quotaPolicy 逐级降级、degradedNotifier               | 无独立提交，随 checkpoint `2b99173` 落入基线                                                                              | 新增 quotaPolicy.ts 46 行、degradedNotifier.ts 49 行（checkpoint 时；当前 46/34）；safeStorage/queue/recommendation/stats 的修改行数 **未复核** | quotaPolicy + safeStorage + queueStore + recommendation + stats：**51 passed**                                               | 0    | TRACKING 记 40；本轮统计含 5 个文件全部用例                                                                        |
| S1-4   | VibeMusicDB 统一 open v3、五类错误、v1/v2→v3 迁移                    | `2310b6d`，merge `1268e9b`                                                                                                | 10 文件 +518/−83（src 7 文件 +502/−79）                                                                                                         | vibeMusicDb 6 + localMusicService 3 + audioSource 8 = **17 passed**                                                          | 0    | TRACKING 记 targeted 22（含其他 resolver 用例）；full suite 297 files/1861 tests 为历史记录，**未复核**            |
| S1-5   | queueStore 唯一权威 + queueNavigator + selectors                     | `48e1319`（docs `1f909d7`），merge `2f4dcd6`                                                                              | merge：14 文件 +724/−162（src 13 文件 +689/−127）                                                                                               | queueNavigator 15 + queuePlaybackSync 8：**23 passed**                                                                       | 0    | TRACKING 记 targeted 45（含 queueStore 20）；本轮只点名导航/同步 2 文件                                            |
| S1-6   | PlaybackMediaBridge 12 事件单订阅 + 引用计数                         | `0988bc2` + `72cb4f0`，merge `ef537b0`                                                                                    | merge：4 文件 +469/−71（src 3 文件 +465/−67）                                                                                                   | mediaBridge：**7 passed**                                                                                                    | 0    | 另有 S1-10 的播放权威/重挂载集成用例（4 用例）                                                                     |
| S1-7   | Watchdog 懒 attach/detach + onContextCreated                         | `0861733`，merge `c164967`                                                                                                | merge：5 文件 +219/−20（src 4 文件 +215/−16）                                                                                                   | AudioContextWatchdog + AudioEngine：**15 passed**                                                                            | 0    | 真机 devicechange/合盖仍未执行                                                                                     |
| S1-8   | RequestCoordinator + AbortSignal 贯穿                                | `7ff38da`…`ec3f109`（docs `a84fac0`），merge `843e3a4`                                                                    | merge：15 文件 +864/−64（src 11 文件 +784/−60）                                                                                                 | coordinator 9 + resolvePlayableAbort 2 + cancellation 3 + audioSource 8 + prefetcher 4 = **26 passed**                       | 0    | TRACKING 记 290 files/1828 tests（历史，未复核）                                                                   |
| S1-9   | sourceResolver 四路并发 + playbackMarks 接线                         | `a3b758a` + `e140c02`（docs `ee6de43` / `60c6b46`），merge `b7775a4`                                                      | merge：6 文件 +675/−145（src 5 文件 +671/−141）                                                                                                 | sourceResolver 7 + playbackMarks 5 = **12 passed**                                                                           | 0    | P50/P95 未采样（§4）；顺序断言由 S1-10 覆盖                                                                        |
| S1-10  | 正确性集成矩阵（队列/播放权威/首声/取消）                            | `86d9a50`，merge `ed628e1`                                                                                                | merge：4 文件 +494/−4（src 3 文件 +490）                                                                                                        | `src/test/integration`：4 文件 / **13 passed**                                                                               | 0    | 计划 6 文件 ≥20 用例；10b 已补到 **6 文件 / 21 用例**（§2.2/§8）                                                   |
| S1-10b | 备份恢复 + v1→v3 local:// 集成矩阵增补                               | `feature/arch-perf-s1-10b`（基于 `c736326`，未合入）                                                                      | 新增 2 测试文件 386 行；生产修复 1 文件 +3/−1                                                                                                   | `src/test/integration`：**6 文件 / 21 passed**（新增 8）                                                                     | 0    | 备份/DB 迁移为 jsdom+fake-indexeddb 结构证据；真机 smoke 仍缺（§8）                                                |

### 2.1 定向测试汇总（2026-10-29，本 worktree）

| 组       | 文件                                                                                 | 结果           | exit  |
| -------- | ------------------------------------------------------------------------------------ | -------------- | ----- |
| S1-1     | storageRegistry.test.ts                                                              | 6 passed       | 0     |
| S1-2     | backupRestoreStore/BackupRestorePanel/rehydrateRegisteredStores（合入后实测）        | 17 passed      | 0     |
| S1-3     | quotaPolicy/safeStorage/queueStore/recommendation/stats                              | 51 passed      | 0     |
| S1-4     | vibeMusicDb/localMusicService/audioSource                                            | 17 passed      | 0     |
| S1-5     | queueNavigator/queuePlaybackSync                                                     | 23 passed      | 0     |
| S1-6     | mediaBridge                                                                          | 7 passed       | 0     |
| S1-7     | AudioContextWatchdog/AudioEngine                                                     | 15 passed      | 0     |
| S1-8     | requestCoordinator/resolvePlayableAbort/playback-cancellation/prefetcher/audioSource | 26 passed      | 0     |
| S1-9     | sourceResolver/playbackMarks                                                         | 12 passed      | 0     |
| S1-10b   | src/test/integration（6 文件）                                                       | 21 passed      | 0     |
| **合计** | —                                                                                    | **178 passed** | **0** |

> S1-2 的 17 用例为合入后单列复核，不计入合计（合计数为其余 9 组之和）；S6-11 备份契约 3 用例属 S6 门禁，未计入本表。全量 suite 结果见 §8.1。

### 2.2 S1-2 合入冲突与解法（2026-10-29）

> 命令：`git merge --no-commit --no-ff feature/arch-perf-s1-2a`（merge-base `1c3f1a1`）。仅 2 个文件冲突，其余 8 个文件（backupSchema.ts / rehydrateRegisteredStores.ts+test / 3 fixtures / panel.test / store.test）直取 S1-2 版本。

| 冲突文件                                        | 冲突成因                                                                                         | 解法（保留的栈语义）                                                                                                                                                                                                            |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/store/backupRestoreStore.ts`               | S1-2 重写为 v5 单文件 440 行；S6-12h 已把类型/纯函数拆到 `store/backup/helpers.ts`（189 行棘轮） | 以 S1-2 行为为准，但类型/预览/解析下沉：`helpers.ts` 保留类型+id/date/size，新增 `store/backup/preview.ts`（128 行，v5+legacy 预览、`parseAnyBackupData`）。store 296 行（基线 366，硬上限 400），`check-store-budgets` SCC 0。 |
| `src/components/library/BackupRestorePanel.tsx` | S1-2b 用整店解构 `useBackupRestoreStore()`；S6-10/no-whole-store 已改为逐字段选择器              | 保留逐字段选择器，补 `restoreReport` 与 `pruneOrphanBackupBodies` 两个选择器；面板报告/unsupported/立即刷新逻辑全取 S1-2b。`npm run lint` 0 error。                                                                             |

语义取舍（明确写在代码注释里）：

1. **S6-11 备份契约不改一行**：`importBackup` 对「槽位形状但 major≠4」的 body 仍抛 `Unsupported backup schema version: <v>`（含被误标成 5.0.0 的 v4 body），预览 `canRestore=false`。契约里 `{...v4, version:"5.0.0"}` 用例继续通过，证明 v4 ratchet 未被 S1-2 打开的口子破坏。
2. **v5 才是写路径**：`createBackup` 只写 registry 的 8 个 backup key（`BACKUP_KEYS`），快照 body 长度 = `BackupItem.size`（UTF-16 长度，`estimateBackupSize` 随之统一，不再用 Blob 字节数）。
3. **恢复路径**：先 `snapshotRestoreRollback` 写 `mimi:restore-rollback`，`restoreBackupV5` 全量校验后原子写，再 `rehydrateRegisteredStores` 逐店 rehydrate；失败进 `restoreReport.failed`（`rehydrate-failed`），不静默。
4. **无 lib→store 新增边**：预览/解析放在 `src/store/backup/`，`src/lib/storage/*` 不反向 import store；`verify:layers` 0 error。

**S1-10b 增补（2026-10-29）**：新增 `s1-backup-restore.integration.test.ts`（7 用例）走真实 `backupRestoreStore` + `rehydrateRegisteredStores`，覆盖 v5 create→parse→restore（assert 内存值恢复与 rehydrate 调用）、v4 升级/误标 5.0.0 拒绝、schemaVersion 6 拒绝、孤儿 body prune、settings/full 作用域与 `createBackupV5` 忽略 `backup:false` 的已知行为、失败前 rollback 快照。补测发现 `readPersist` 只接受 `object`，而 Zustand store 是函数，导致 restore 后 rehydrate 静默跳过；已改为同时接受 function（+3/−1），并用真实 store 验证。

## 3. E1 九场景 before/after 矩阵

> Before 取自计划 §1 的「现状（已核实证据）」；After 只写本分支能复核的证据。判定：达成 / 部分 / 未达成 / 未执行。

| 出口              | 指标                       | Before（计划 §1）                                                   | After（本分支证据）                                                                                                                                                                                                                                                                        | 判定                                       |
| ----------------- | -------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------ |
| E1-1 数据不丢     | persist key 覆盖、启动压缩 | 44 key 无注册表；启动压缩 200→50、30→20（safeStorage.ts:105,110）   | 44/44 注册；S1-10「queue-store-v5 roundtrip keeps a 200-item queue, 30 history entries and the index」通过：queue=200、history=30、currentIndex=199、重载后仍 200/199/30；storageRegistry 6 用例                                                                                           | **达成**（自动化）                         |
| E1-2 备份可恢复   | 备份→恢复→重载闭环         | 10 槽位中 5 个 key 错配；恢复后不 rehydrate                         | S1-2 已合入：`createBackup` 写 registry 8 key 的 v5 entries；`restoreBackup` v4→v5 迁移（死槽位 `playlist-store`/`sleep-timer-store` 记 skipped 不写）+ 原子 restore + rollback 快照 + `rehydrateRegisteredStores`；**17 passed**（store 10 + panel 3 + rehydrate 4）；S6-11 契约 3 passed | **达成**（自动化；面板「立即刷新」待真机） |
| E1-3 本地音源     | 同一 IDB 版本              | localMusicService v1、localMusicStorage v2 同库 → VersionError 被吞 | 统一 v3 opener；v1→v3/v2→v3 保数据、keyPath/index 不变、五类错误；17 用例通过                                                                                                                                                                                                              | **部分**（结构证据；真机导入→刷新未执行）  |
| E1-4 队列唯一     | 队列写 owner               | audioStore.queue/currentIndex 与 queueStore 双权威                  | queueStore 唯一权威 + navigator；23 用例；S1-10 删除/重排/清空/ended 用例通过；audioStore 无 queue 字段投影                                                                                                                                                                                | **达成**（自动化）                         |
| E1-5 媒体事件单例 | 监听 owner                 | 每个 hook 实例 attach/detach 共享元素                               | mediaBridge 12 事件单订阅 + 引用计数；7 用例；S1-10 双实例单监听、面板重挂载 12 监听不重复通过                                                                                                                                                                                             | **达成**（自动化）                         |
| E1-6 设备恢复     | watchdog 生效              | start 先于懒创建 context → 不挂载；stop 不摘监听                    | 懒 attach + onContextCreated + stop 对称清理；15 用例（mock engine/context）                                                                                                                                                                                                               | **部分**（真机合盖/devicechange 未执行）   |
| E1-7 请求可取消   | AbortSignal 贯穿           | 无 AbortController，仅 requestId 丢弃                               | coordinator + signal 贯穿 resolver/cache/prefetch/播放；26 用例，含「5 连点仅 1 in-flight、前 4 aborted、stale 不写 store、abort 不污染缓存」                                                                                                                                              | **达成**（自动化）                         |
| E1-8 首声更快     | firstSound 缓存命中        | 串行 3 次 IDB + resolver，最坏 >5s                                  | sourceResolver 四路并发 + marks 接线；但 P50/P95 **未采样**（§4）                                                                                                                                                                                                                          | **未执行/未采样**                          |
| E1-9 回归网       | 场景自动化                 | 总计划 §9.2 全人工                                                  | 4 文件 / 13 集成用例；覆盖队列、播放权威/重挂载、首声竞速、取消；缺备份恢复与 v1→v3 local:// 场景                                                                                                                                                                                          | **部分**（13 < 20，4 < 6 文件）            |

## 4. firstSound P50/P95：未采样

**状态：未采样（0 个真实样本）。** 本 worktree 没有可用浏览器/音频设备，jsdom 无法产生真实起播时延；不得用单测代替 E1-8。S1-9 的埋点已就位：

| 件        | 位置                                                                                                     | 作用                                                                                                                                                                |
| --------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 埋点 API  | `src/lib/perf/playbackMarks.ts`                                                                          | `markPlayback(kind)`、`getFirstSoundMs()`、`getPlaybackMarks()`；User Timing 名 `mimi:playback:<kind>`；`CustomEvent("mimi:playback-mark")`；每次 intent 只认第一声 |
| hook 接线 | `src/hooks/useAudioPlayer.ts:1371`（intent）、`:1658`（source-ready）、`:708-709`（playing/first-sound） | 真实播放路径打点                                                                                                                                                    |
| 保护      | `playbackMarks.ts:27`                                                                                    | `NODE_ENV === "production"` 时整体 no-op → **只能在 dev 构建采样**                                                                                                  |

### 4.1 采集协议（按计划 §4 S1-9 Step 4）

- 场景 A 缓存命中：固定本地 fixture，重复播放 **20 次**，目标 **P50 < 300ms、P95 < 800ms**。
- 场景 B 冷启动：清缓存/新 profile，**10 次**，目标 **P95 < 2.5s**。
- 同一设备、同一构建（dev）、同一网络条件；记录设备型号、场景、命令、样本数。
- 指标：`intent` → `first-sound`（缺失时回落该次 `playing`）；`getFirstSoundMs()` 只取最近一次，批量采样需监听事件或读 `performance` marks。

### 4.2 采集命令

```powershell
# 1) dev 构建（playbackMarks 只在非 production 生效）
npm run dev            # 端口 3025
```

在浏览器 DevTools Console 注入采集器，然后播放 20 次（缓存命中）/10 次（冷启动）：

```js
window.__s1FirstSound = [];
window.addEventListener("mimi:playback-mark", (e) => {
  const d = e.detail;
  if (d.kind === "intent") {
    window.__s1FirstSound.push({ songId: d.songId, t0: d.at, ms: null });
  } else if (d.kind === "first-sound") {
    const cur = window.__s1FirstSound.at(-1);
    if (cur && cur.ms == null) cur.ms = d.at - cur.t0;
  }
});
// 采完后：
const xs = window.__s1FirstSound
  .map((x) => x.ms)
  .filter(Number.isFinite)
  .sort((a, b) => a - b);
const pct = (p) => xs[Math.min(xs.length - 1, Math.floor(p * (xs.length - 1)))];
({ n: xs.length, p50: pct(0.5), p95: pct(0.95), raw: xs });
```

> 也可用 Playwright/CDP 在真实页面执行同一段 `page.evaluate` 采集，循环点击播放并落盘 JSON；项目未内置该脚本，属后续 S2-6 工作。

### 4.3 结果占位（必须补齐后才能关闭 E1-8）

| 场景     | 样本数 |    P50 |    P95 | 目标                    | 状态       |
| -------- | -----: | -----: | -----: | ----------------------- | ---------- |
| 缓存命中 | 0 / 20 | 未采样 | 未采样 | P50 <300ms / P95 <800ms | **未采样** |
| 冷启动   | 0 / 10 | 未采样 | 未采样 | P95 <2.5s               | **未采样** |

建议落盘：`perf/s1-first-sound.json`（设备、构建、场景、原始样本、P50/P95），供 S2-6 消费。

## 5. 迁移 fixture 清单与输出

### 5.1 v1/v2 → v3（本分支已复核）

| #   | fixture                           | 构造                                                                                                                                       | 断言                                                                                                                   | 结果                          |
| --- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| 1   | v1 库 + musicFiles 记录           | raw `indexedDB.open("VibeMusicDB", 1)`，建 `musicFiles(id)`，写 `{id:"a", data:[1,2,3], type:"audio/mpeg"}`                                | 打开 v3 后 version=3、4 个 store 齐全、记录 type/data 原样                                                             | passed（vibeMusicDb.test.ts） |
| 2   | v2 库 + localMusic/offline_audios | raw v2 建 `localMusic(id)`/`musicMetadata(id)`/`offline_audios(songId)+downloadedAt`，写 `{id:"l1",fileName}`、`{songId:"s1",fileSize:42}` | v3 保留两记录；store 集合与 v3 一致                                                                                    | passed                        |
| 3   | keyPath / index 不变              | v3 空库逐 store 读 keyPath                                                                                                                 | `musicFiles:id / localMusic:id / musicMetadata:id / offline_audios:songId`；index `downloadedAt/isPinned/lastPlayedAt` | passed                        |
| 4   | 版本冲突                          | 先以 raw v4 打开再调 `openVibeMusicDb()`                                                                                                   | 抛 `VibeMusicDbError.code="version-conflict"`；`classifyVibeMusicDbError` 覆盖 missing-store/quota/blocked/unknown     | passed                        |
| 5   | 并发单连接                        | `Promise.all` 三次 open                                                                                                                    | 同一 `IDBDatabase` 引用                                                                                                | passed                        |
| 6   | localMusicService 记录缺失        | v3 空库 `getFileFromStorage("missing")`                                                                                                    | 返回 null                                                                                                              | passed                        |
| 7   | localMusicService v1 记录         | seed v1 musicFiles `{id:"a",type:"audio/flac",name:"demo.flac"}`                                                                           | 自动升级到 v3 后读出 type/name/data                                                                                    | passed                        |
| 8   | localMusicService 版本冲突        | raw v4 库                                                                                                                                  | 拒绝并带 `code="version-conflict"`（不再静默 null）                                                                    | passed                        |

命令与结果：

```powershell
npx vitest run src/lib/storage/vibeMusicDb.test.ts src/services/localMusicService.test.ts
# -> 9 passed (6 + 3), exit 0
npx vitest run src/lib/storage/vibeMusicDb.test.ts src/services/localMusicService.test.ts src/lib/audio/audioSource.test.ts
# -> 17 passed, exit 0（audioSource 8 含 local:// 错误映射）
```

### 5.2 队列/持久化 fixture（本分支已复核）

| #   | fixture                                   | 断言                                                                                                                        | 结果            |
| --- | ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | --------------- |
| 9   | 200 项队列 + 35 次历史 + currentIndex=199 | 持久化 queue=200、history=30、currentIndex=199；rehydrate 后仍 200/199/30，history[0]=h34；audioStore 无 queue/currentIndex | passed（S1-10） |
| 10  | player/audio/eq 持久化往返                | player-store 不存进度；audio-store 无 queue/EQ key；eq-store v2 往返                                                        | passed（S1-10） |

### 5.3 备份 fixture（S1-2 合入后，本 worktree 已复核）

| fixture       | 路径                                                  | 用途                      | 状态                                                                                                                                                    |
| ------------- | ----------------------------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| v4 legacy     | `src/store/__fixtures__/backup-v4-legacy.json`        | v4 旧备份导入、死槽位跳过 | **passed**：队列/推荐/歌单组/库/歌词按 registry key 落盘，`gesture-store`/`sleep-timer-store`/`playlist-store` 为 null，`report.skipped` 恰为两个死槽位 |
| v3 未知大版本 | `src/store/__fixtures__/backup-v3-unknown-major.json` | 拒绝未知 major            | **passed**：`restoreError` 含「不支持的备份版本」，live key 未动，`restoreReport` 为 null，未触发 rehydrate                                             |
| v5 全量       | `src/store/__fixtures__/backup-v5.json`               | v5 往返、3 entries        | **passed**：恢复 audio/visual/queue 3 项，`report.restored` 长度 3                                                                                      |

## 6. 回滚演练（两次实际执行）

> 两次演练均在**临时分支**上执行，未提交、未 push；演练后临时分支删除、工作树恢复干净。

### 6.1 演练 A：revert S1-4（`2310b6d`）

| 步骤                                 | 命令                                                                                              | 结果                                                                                                                                                                                                                      |
| ------------------------------------ | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 建临时分支                           | `git switch -c tmp/drill-s1-4 2310b6d`                                                            | HEAD=`2310b6d`                                                                                                                                                                                                            |
| 反向应用                             | `git revert --no-commit 2310b6d`                                                                  | exit 0；10 个路径：3 删除（`vibeMusicDb.ts` / `vibeMusicDb.test.ts` / `localMusicService.test.ts`）+ 7 修改（TRACKING、package.json、package-lock.json、audioSource.ts/test、localMusicService.ts、localMusicStorage.ts） |
| 计划指定测试                         | `npx vitest run src/lib/storage/vibeMusicDb.test.ts src/services/localMusicService.test.ts`       | **exit 1**；vitest 报 `No test files found`（两个测试文件随提交被删除，回滚后不再有 v3 覆盖）                                                                                                                             |
| 行为探针（临时未跟踪文件，跑完即删） | 建 raw v2 库并写入 musicFiles 记录，调用回滚后的 `getFileFromStorage("a")`                        | **exit 0**；`PROBE getFileFromStorage -> null`，而 raw 记录仍可读（`{"id":"a","type":"audio/mpeg"}`）→ 复现「记录存在但 API 静默返回 null」的原缺陷                                                                       |
| 清理                                 | `git reset --hard 2310b6d`；删探针；`git switch docs/s1-evidence`；`git branch -D tmp/drill-s1-4` | 分支已删，工作树干净                                                                                                                                                                                                      |

**结论**：回滚 S1-4 会把 `local://` 读取打回 v1/v2 双版本 opener；在已升级的库上静默吞掉 VersionError，UI 表现为「文件不存在/不可播」。这不是可接受的生产回滚路径。

### 6.2 演练 B：revert S1-2（`5862795` + `825e109`）

| 步骤                                 | 命令                                                                                                                                                       | 结果                                                                                                                                                                                                      |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 建临时分支                           | `git switch -c tmp/drill-s1-2 5862795`                                                                                                                     | HEAD=`5862795`（S1-2 分支 tip）                                                                                                                                                                           |
| 反向应用（先 2b 后 2a）              | `git revert --no-commit 5862795 825e109`                                                                                                                   | exit 0；10 个路径：7 删除（`backupSchema.ts`、`rehydrateRegisteredStores.ts`+test、`BackupRestorePanel.test.tsx`、3 个 backup fixture）+ 3 修改（`backupRestoreStore.ts`+test、`BackupRestorePanel.tsx`） |
| 相关测试                             | `npx vitest run src/store/backupRestoreStore.test.ts src/components/library/BackupRestorePanel.test.tsx src/lib/storage/rehydrateRegisteredStores.test.ts` | **exit 0**，但只跑了回滚后残留的旧 `backupRestoreStore.test.ts`（**12 passed**）；两个已删除的测试文件被 vitest 静默忽略 → **绿灯但覆盖消失**，这是回滚演练里最危险的信号                                 |
| 行为探针（临时未跟踪文件，跑完即删） | 用回滚后的 store 预览 `version:"5.0.0"` 的备份                                                                                                             | **exit 0**；`canRestore:false`、`error:"Unsupported backup schema version: 5.0.0"`，且 `includedStores` 仍列出死槽位 `gesture-store` / `sleep-timer-store` / `playlist-store`                             |
| 清理                                 | `git reset --hard 5862795`；删探针；`git switch docs/s1-evidence`；`git branch -D tmp/drill-s1-2`                                                          | 分支已删，工作树干净                                                                                                                                                                                      |

**结论**：S1-2 回滚后旧代码最高只认 major 4，**用户已创建的 v5 备份将无法恢复**，且旧 10 槽位清单仍会把死 key 当成可恢复项。回滚必须保留 2a 的 v5 读取器（或先提供 v5→v4 导出），不能简单 revert。

## 7. v3 回滚注意（IndexedDB 版本不可回退）与缓解

- **事实**：`VIBE_MUSIC_DB_VERSION = 3`，`onupgradeneeded` 只做 `contains → create`，不删除/不搬迁 store。IndexedDB 不能以低于磁盘版本的 version 打开：库一旦是 v3，旧代码 `open(..., 1)` 或 `open(..., 2)` 必得 `VersionError`；数据仍在，但旧 API 读不到（pre-S1-4 会 `catch` 成 null，见 6.1 探针）。
- **缓解（按优先级）**：
  1. **只回滚业务逻辑，保留 v3 opener**：发布回滚包时保留 `vibeMusicDb.ts` 与 `VIBE_MUSIC_DB_VERSION=3`，不要回退 `localMusicService/localMusicStorage` 的 open 版本。
  2. 若必须整体回退旧代码：在补丁中把旧代码的 `indexedDB.open` 改为**不传 version**（打开当前版本）或传 3；禁止以 v1/v2 打开已升级的库。
  3. 回滚前导出备份/记录清单；**禁止删除重建数据库**（会丢已下载音频）。
  4. 回滚窗口内 `local://` 失败要显示可行动错误（「本地数据库版本异常，请升级/重启」），不能沿用「文件不存在」。
- **S1-2 的同类注意**：v5 备份对 old code 是前向不兼容（major 4 上限）；回滚 2b（仅 UI）相对安全，但 2a 必须保留读取器。

## 8. 未执行项 / 未复核项

| 项                                         | 类别   | 原因 / 说明                                                                               | 建议                                              |
| ------------------------------------------ | ------ | ----------------------------------------------------------------------------------------- | ------------------------------------------------- |
| 真机 devicechange、合盖恢复、蓝牙切换      | 未执行 | 仅有 jsdom + mock engine/context 证据（S1-7 15 用例）                                     | 在 Windows/macOS 真机做手工 smoke，记录设备与结果 |
| `local://` 导入→刷新→真机可播              | 未执行 | 仅 fake-indexeddb + jsdom 结构证据（S1-4；10b 已补 v1→v3 读取字节一致集成用例）           | 真机导入 mp3/flac + 刷新 + 播放                   |
| 真实网络源、offline-first vs resolver 竞速 | 未执行 | 测试全 mock；产品决策未定（TRACKING S1-9 缺口）                                           | 真实源 smoke + 产品决策                           |
| firstSound P50/P95                         | 未采样 | 无浏览器/音频设备；production 下 marks 关闭                                               | 按 §4.1 在 dev 采样 20+10 次                      |
| 听感 A/B、gapless、切歌爆音                | 未执行 | 需人耳/真机                                                                               | 手工 smoke 清单                                   |
| ~~S1-2 v4/v5 备份恢复矩阵~~                | 已复核 | 已合入集成栈；17 用例通过，S6-11 契约 3 通过；10b 已并入 `src/test/integration`（7 用例） | 无（真机 smoke 另列）                             |
| 恢复后面板「立即刷新」生效                 | 未执行 | jsdom 只断言 `location.reload` 被调用，真实页面重载未验                                   | 真机：造 v4 备份→恢复→点刷新→数据可读             |
| ~~S1-10 计划的备份/v1→v3 集成用例~~        | 已交付 | 10b 新增 8 用例（备份 7 + v1→v3 1），矩阵 6 文件 / 21 用例，全绿                          | 剩余：真机 smoke 与 firstSound 采样               |
| ESLint / build / dev 冒烟                  | 部分   | 10b 已跑 lint / 全量 vitest / tsc / verify:layers；build 与 dev 冒烟未执行                | S1 出口前按 I7 顺序补 build→dev                   |

### 8.1 本次证据自身的验证

| 命令                                   | 预期                        | 结果                                                                                              |
| -------------------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------- |
| `npx tsc --noEmit`（10b 后）           | exit 0                      | **exit 0，0 errors**（2026-10-29 实测）                                                           |
| `npx vitest run`（全量，10b 后）       | exit 0                      | **301 files passed / 1874 passed + 1 skipped，exit 0**（105s，2026-10-29 实测）                   |
| `npm run lint`（10b 后）               | 0 error                     | **0 error / 0 warning，exit 0**                                                                   |
| `node scripts/check-store-budgets.mjs` | PASS，无新增超基线          | **上轮 PASS：113 files、总 19527 行、SCC 0**；store 296≤366，新增 `backup/preview.ts` 128≤400     |
| `node scripts/check-docs-facts.mjs`    | fail=0（ports WARN 可接受） | **10b fail=0 warn=0，exit 0**（8 项 PASS，store-count=64）                                        |
| `npm run verify:layers`                | 0 error                     | **0 errors / 29 warnings（既有 no-orphans），exit 0**；新增 preview.ts 已被引用，不在 orphan 名单 |
| 文档提交                               | 证据 + 看板                 | 本文件与 TRACKING.md 随 S1-2 合并提交一并更新；10b 计数/缺口同步更新                              |

> 10b 已复跑 tsc / 全量 vitest / lint / verify:layers / check-docs-facts（fail=0 warn=0）；check-store-budgets 未在 10b 提交上复跑（无 store 预算相关改动）。

## 9. 复现命令

```powershell
# 定向测试（本文件 §2.1）
npx vitest run src/lib/storage/storageRegistry.test.ts
npx vitest run src/lib/storage/quotaPolicy.test.ts src/lib/storage/safeStorage.test.ts src/store/queueStore.test.ts src/store/recommendationStore.test.ts src/store/statsAchievementsStore.test.ts
npx vitest run src/lib/storage/vibeMusicDb.test.ts src/services/localMusicService.test.ts src/lib/audio/audioSource.test.ts
npx vitest run src/lib/playback/queueNavigator.test.ts src/store/queuePlaybackSync.test.ts
npx vitest run src/lib/playback/mediaBridge.test.ts
npx vitest run src/lib/audio/AudioContextWatchdog.test.ts src/lib/audio/AudioEngine.test.ts
npx vitest run src/lib/playback/requestCoordinator.test.ts src/lib/playback/resolvePlayableAbort.test.ts src/test/integration/playback-cancellation.integration.test.ts src/lib/audio/audioPrefetcher.test.ts src/lib/audio/audioSource.test.ts
npx vitest run src/lib/playback/sourceResolver.test.ts src/lib/perf/playbackMarks.test.ts
npx vitest run src/test/integration
npx vitest run src/test/integration/s1-backup-restore.integration.test.ts src/test/integration/s1-vibemusicdb-local.integration.test.ts
npx vitest run src/store/backupRestoreStore.test.ts src/components/library/BackupRestorePanel.test.tsx src/lib/storage/rehydrateRegisteredStores.test.ts
npx vitest run src/store/__contract__/backupRoundtrip.contract.test.ts

# 门禁（S1-2 合入后按此顺序）
npx tsc --noEmit
npx vitest run
npm run lint
node scripts/check-store-budgets.mjs
node scripts/check-docs-facts.mjs
npm run verify:layers

# 回滚演练（勿在 docs/s1-evidence 上直接执行）
git switch -c tmp/drill-s1-4 2310b6d
git revert --no-commit 2310b6d
npx vitest run src/lib/storage/vibeMusicDb.test.ts src/services/localMusicService.test.ts   # 预期 exit 1（文件已随提交删除）
git reset --hard 2310b6d; git switch docs/s1-evidence; git branch -D tmp/drill-s1-4

git switch -c tmp/drill-s1-2 5862795
git revert --no-commit 5862795 825e109
npx vitest run src/store/backupRestoreStore.test.ts src/components/library/BackupRestorePanel.test.tsx src/lib/storage/rehydrateRegisteredStores.test.ts
git reset --hard 5862795; git switch docs/s1-evidence; git branch -D tmp/drill-s1-2
```

## 10. 附：TRACKING 与本轮实测的差异

| 任务   | TRACKING 记录                           | 本轮实测                      | 说明                              |
| ------ | --------------------------------------- | ----------------------------- | --------------------------------- |
| S1-1   | 5 用例                                  | 6 passed                      | 测试文件后续增补                  |
| S1-3   | 40 用例                                 | 51 passed                     | 本轮含 5 个文件全部用例           |
| S1-4   | targeted 22 / full 297 files 1861 tests | 17 passed（定向 3 文件）      | full 为历史记录，本轮另行全量复跑 |
| S1-5   | targeted 45                             | 23 passed（导航/同步 2 文件） | 口径不同                          |
| S1-10  | 3 文件 / 10 用例 + 既有 3 = 13          | 4 文件 / 13 passed            | 与本轮一致                        |
| S1-10b | —（新增）                               | 6 文件 / 21 passed（新增 8）  | 矩阵补齐                          |
| S1-2   | 17 用例（分支静态/历史）                | 17 passed（合入后实测）       | 从「未复核」转「实测」            |
