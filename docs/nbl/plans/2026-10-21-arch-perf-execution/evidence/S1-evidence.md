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
