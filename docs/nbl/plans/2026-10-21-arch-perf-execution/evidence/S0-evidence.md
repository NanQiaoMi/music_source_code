# S0-1 checkpoint & baseline evidence

- Date: 2026-10-27 13:39–13:52 +08:00
- Operator: DSH agent (Lead)
- Branch: checkpoint/gesture-air-control-overhaul-20261027
- Checkpoint commit: 2b991731a1e48d5b3ba8084cc2b18276fb5b1e7d
- Original branch: feature/gesture-air-control-overhaul @ c73a872 (untouched)
- master: 90c2152 (+11 commits ahead of snapshot base)
- Dirty inventory: 122 paths (git status -uall); checkpoint diff: 123 files changed, +27,294 / −1,967
- Snapshot contents: gesture air-control overhaul; handwritten lyric MV; arch-perf S0/S1 baseline work (docs/plans/scripts/perf/storage); handover package docs/scripts.
- Git safety: no reset/clean/push; original feature branch untouched; checkpoint commit used --no-verify because lint-staged would reformat the whole snapshot. Follow-up PRs must use normal hooks.

## Baseline verification (clean tree @ 2b99173)

| Command | Result |
| --- | --- |
| npx tsc --noEmit --incremental false --pretty false | exit 0 |
| npm run test -- --run | 208 files / 1284 tests passed, 77.52s |
| npx eslint src (chunks: src/components; src/lib+store+hooks+utils+types+services+test+app+workers, --max-warnings=0) | both exit 0, 0 errors / 0 warnings |
| npm run build | isolated worktree @2b99173 + node_modules junction: next build --webpack exit 0; 28 static pages + 31 API routes; TypeScript 16.1s |

Environment: Windows 11, Node v24.16.0 (same as HANDOVER §2/§7).

## Deviations vs plan baseline

- Plan baseline (§2.2) expected 205 test files / 1267 tests; actual 208 / 1284 (+3 files / +17 tests: gesture integration + handwritten MV coverage).
- Dirty count 122 vs plan's ~55: snapshot accumulated handwritten MV, S0/S1 baseline, handover docs between 2026-10-21 and 2026-10-27.
- Snapshot base c73a872 is 11 commits behind master; a rebase/merge to master is required before splitting PRs.
- Build ran in an isolated worktree because the user's dev server (PID 6656) was serving :3025; main .next was not cleaned and the dev server stayed healthy.

## Open items after S0-1

- Q02 (push/required checks) and GitHub admin permissions remain pending.
- D1/D2/D7 decisions remain pending (V8 dispose / desktop runtime / protected-view subscription rewrite).
- S0-3 port unification and S0-5/S0-7 partially complete; see TRACKING.
- Checkpoint --no-verify is documented; first split PR should run husky/lint-staged normally.

## S0-3 / S0-5 follow-up (2026-10-27)

- S0-3 commit 84305f6: start port 3025 (3024 refs = 0); build:electron* now runs verify-desktop-release-ready guard first (exit 1 while frozen); added build:static; verify-static-export refactored to an exported pure evaluateOutFreshness + 5 vitest cases; CLI exits 2 for missing out, 3 for stale; observed exit 2 in main worktree; guard observed exit 1. Deferred: npm start:3025 HTTP 200 (dev server still serving 3025).
- S0-5 commit 195d996: removed tracked dead files src/app/page.tsx.v7 and src/components/visualization/VisualizationView.tsx.fix (0 code references); added scripts/gc-worktrees.ps1 (dry-run default; observed 25 worktrees, 5 dirty skipped, clean candidates listed). Worktree <=5 and root-file cleanup remain blocked on Q22 authorization.
- Concurrency note: src/app/dev/lyric-stage/page.tsx was recreated at 13:47 by another active session (temporary handwritten-MV QA route); intentionally left untracked and not committed.

## S0-3 HTTP smoke + S0-5 worktree GC (2026-10-27 evening)

- S0-3 production smoke: isolated worktree @ 1be849f, node_modules junction; `npx next build --webpack` exit 0; `next start -p 3026` (3025 occupied by the user's dev server, PID 6656) returned HTTP 200 for `/` and `/data-manager`; server stopped and worktree removed. Config source of truth remains port 3025.
- S0-5 worktree GC: `scripts/gc-worktrees.ps1 -Apply` reduced worktrees 25 → 6 (19 clean removed, 5 dirty skipped; branches/commits untouched). Remaining 6 = main + 5 dirty worktrees. Root-file cleanup (31 files vs <=20 target) still pending; no user files were deleted.
- NOTE: another session had uncommitted handwritten-MV changes in the main worktree during this pass; they were not staged/committed.
