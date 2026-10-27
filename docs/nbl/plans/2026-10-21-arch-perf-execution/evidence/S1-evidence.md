# S1-2a evidence — backup v5 schema, v4 migration, rehydrate (2026-10-27)

- Worktree: D:/26project/music_source_code_V1.1_full/_worktrees/arch-perf-s1-2a
- Branch/commit: feature/arch-perf-s1-2a @ 4f9325d (based on checkpoint 6f7a3bc)
- Why isolated: main worktree still contains another session's uncommitted handwritten-MV changes; S1-2a was developed and verified in a separate worktree with a node_modules junction.

## Delivered (8 files, +948/−456)

- src/lib/storage/backupSchema.ts (new): BACKUP_SCHEMA_VERSION=5; create/parse v5 payload; v4 slot migration (gesture/sleep/playlist dead slots reported unsupported); atomic restoreBackupV5 (validate all entries before first write; corrupt payload aborts with zero writes); rollback snapshot helper (mimi:restore-rollback).
- src/lib/storage/rehydrateRegisteredStores.ts (new): registerRehydrateHandle + lazy store loaders for player/queue/audio/visual/gesture/recommendation/library/lyrics/ui; collects ok/failed instead of throwing.
- src/store/backupRestoreStore.ts (rewrite): createBackup uses registry BACKUP_KEYS (8 real keys; no gesture-store/queue-store/recommendation-store); v5 body under backup-data-<id>; restore parses v5 or migrates v4, snapshots overwritten keys, validates/writes atomically, rehydrates restored stores, returns restoreReport (restored/skipped/failed); preview/get/download/upload/import/export handle v5 + legacy; delete/clearOld/clearAll remove bodies; pruneOrphanBackupBodies.
- src/store/backupRestoreStore.test.ts (rewrite): 10 tests — v5 create, settings subset, preview, v4 migration (dead keys skipped), v3 rejection, v5 roundtrip, corrupt atomic abort, v5 fixture, orphan/clear pruning, export/import + legacy.
- src/lib/storage/rehydrateRegisteredStores.test.ts (new): 4 tests.
- src/store/__fixtures__/backup-v4-legacy.json, backup-v3-unknown-major.json, backup-v5.json (new).

## Verification (inside isolated worktree)

| Command | Result |
| --- | --- |
| npx vitest run src/store/backupRestoreStore.test.ts src/lib/storage/rehydrateRegisteredStores.test.ts | 14 tests passed |
| npx vitest run (full suite) | 210 files / 1291 tests passed |
| npx tsc --noEmit --incremental false --pretty false | exit 0 |
| npx eslint <changed files> --max-warnings=0 | 0 errors / 0 warnings |
| npx prettier --check <changed files> | all matched |

## Remaining (S1-2b / merge)

- BackupRestorePanel UI: show restoreReport (restored/skipped/unsupported), "已恢复 N 项，M 项需刷新" + 立即刷新 button, and panel tests (<=180 lines).
- Split S1-2a/2b commits into <=400-line PR(s); merge/PR to master after CI decisions (Q02).
- Main worktree's other-session changes were not touched.

## S1-2b + rebase onto latest checkpoint (2026-10-27 evening)

- Rebase: `feature/arch-perf-s1-2a` was rebased onto the latest checkpoint HEAD `1c3f1a1` (audioStore slices, V8 archive, coordinator removal). No conflicts; S1-2a tests/tsc re-verified after rebase.
- S1-2b commit `5862795`: BackupRestorePanel now shows the restore report (restored / skipped / failed), warns "旧版本槽位不会恢复" for unsupported legacy slots, hides dead keys from preview chips, exposes "立即刷新" (`window.location.reload()`), and calls `pruneOrphanBackupBodies()` on mount. `BackupPreview.unsupportedStores` added to the store.
- Panel tests (new `src/components/library/BackupRestorePanel.test.tsx`, 3 cases): unsupported legacy slots preview; v5 preview does not render dead keys; restore report + reload action.

## S1-2 verification (after rebase, inside isolated worktree)

| Command | Result |
| --- | --- |
| npx vitest run src/store/backupRestoreStore.test.ts src/components/library/BackupRestorePanel.test.tsx src/lib/storage/rehydrateRegisteredStores.test.ts | 17 tests passed (10 + 3 + 4) |
| npx vitest run (full suite) | 204 files / 1272 tests passed |
| npx tsc --noEmit --incremental false --pretty false | exit 0 |
| npx eslint <changed files> --max-warnings=0 | 0 errors / 0 warnings |
| npx prettier --check <changed files> | all matched |

Note: the full-suite count changed from 210/1291 to 204/1272 after rebasing onto 1c3f1a1 because the audio/V8 refactor commits removed coordinator/v8-related test files.

## Remaining after S1-2

- Split branch into S1-2a / S1-2b PRs (<=400 lines each incl. tests) and merge after CI/Q02 decisions.
- Main worktree still has another session's uncommitted handwritten-MV changes; untouched.
