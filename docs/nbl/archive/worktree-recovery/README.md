# worktree-recovery — S0-5 归档（2026-10-30）

> 触发：用户授权清理 dirty worktree（E0-5：worktree ≤5）。删除前对每个 worktree 做**三重保底**：
> ① `<name>-2026-10-30.patch`（`git add -A -N` + `git diff --binary`，**含 untracked 全文**）；
> ② `<name>-2026-10-30.status.txt`（删除前 `git status --porcelain` 原样清单）；
> ③ `git stash push -u -m "s0-5 archive <name> 2026-10-30"`（repo 内 stash，含 untracked）。
> 分支与提交全部保留，未 push、未改主仓库 tracked 文件。

## 1. 已删除的 5 个 worktree

| worktree（删除前路径） | 分支 / HEAD | 改动 | patch | status | stash 名 |
| --- | --- | --- | --- | --- | --- |
| `C:/Users/Legion/.codex/worktrees/audio-source-switch-task4/music_source_code` | feature/audio-source-switch-task4 @ `ea43c0e` | 4（2M + 2??） | `audio-switch-task4-2026-10-30.patch`（70KB / 1,805 insertions） | `audio-switch-task4-2026-10-30.status.txt` | `s0-5 archive audio-switch-task4 2026-10-30` |
| `C:/Users/Legion/.codex/worktrees/folia-webgl-mv-merge/music_source_code` | feature/folia-webgl-mv-merge @ `c367699` | 26（17M + 9??） | `folia-webgl-mv-merge-2026-10-30.patch`（322KB / 6,239 insertions） | `folia-webgl-mv-merge-2026-10-30.status.txt` | `s0-5 archive folia-webgl-mv-merge 2026-10-30` |
| `D:/26project/music_source_code_V1.1_full/_codex_player_sync_verify` | detached @ `06bccd8` | 47（25M + 22??） | `codex-player-sync-verify-2026-10-30.patch`（354KB / 5,647 insertions） | `codex-player-sync-verify-2026-10-30.status.txt` | `s0-5 archive codex-player-sync-verify 2026-10-30` |
| `D:/26project/music_source_code_V1.1_full/music_source_code/.worktrees/ui-task8-discovery` | codex/ui-discovery-settings @ `b7743ce` | 2（1M + 1??） | `ui-task8-discovery-2026-10-30.patch`（3.9KB） | `ui-task8-discovery-2026-10-30.status.txt` | `s0-5 archive ui-task8-discovery 2026-10-30` |
| `D:/26project/music_source_code_V1.1_full/music_source_code/.worktrees/ui-task9-tools` | codex/ui-tools-analysis @ `b7743ce` | 2（2??） | `ui-task9-tools-2026-10-30.patch`（6.1KB） | `ui-task9-tools-2026-10-30.status.txt` | `s0-5 archive ui-task9-tools 2026-10-30` |

## 2. 恢复方式

**A. 从 stash 恢复（推荐，含 untracked）**

```powershell
git worktree add D:/tmp/<name> <branch>          # detached 的用 git worktree add --detach ... 06bccd8
git -C D:/tmp/<name> stash apply "s0-5 archive <name> 2026-10-30"
```

**B. 从 patch 恢复**

```powershell
git worktree add D:/tmp/<name> <branch>
git -C D:/tmp/<name> apply --binary <patch 路径>
```

两个来源内容一致（patch 由 `git add -N` + `git diff --binary` 生成，untracked 以 new file 形式写入）；status 文件只用于核对路径清单。

## 3. 范围与限制

- **只覆盖工作树改动**：`node_modules`、`.next`、`.cache`、`tsbuildinfo` 等 ignored 文件未归档，可由 `npm install` / `npm run build` 再生；5 个被删 worktree 均无 `.env.local`。
- **分支未动**：`git branch` 与提交历史全部保留，`git worktree list` 删除后为 4（主仓库 + `arch-integration-s1-5` + `arch-perf-s6-1` + `promo-video`）。
- **保留的 2 个 dirty worktree**：`arch-perf-s6-1`（2026-10-29 最新活动；`scratch/`、`.env.local` 为 ignored）与 `promo-video`（187MB ignored 渲染资产 + `promo-final.mp4`）。它们不在此归档内，改动仍在原路径。
- stash 是 repo 级、按创建时间堆叠（本次创建时为 `stash@{0}`..`stash@{4}`）；后续再 stash 会前移索引，**请按名字引用**。

## 4. 复核命令

```powershell
git worktree list --porcelain | Select-String '^worktree'   # 期望 4 行
git stash list | Select-String 's0-5 archive'              # 期望 5 行
Get-ChildItem docs/nbl/archive/worktree-recovery            # 5 patch + 5 status + 本 README
```
