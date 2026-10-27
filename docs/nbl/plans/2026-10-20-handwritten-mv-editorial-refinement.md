# Handwritten MV Editorial Refinement Implementation Plan

> **For agentic workers:** Use nbl.subagent-driven-development to implement this plan task by task. The user explicitly requested a GPT-6 Luna subagent at max effort.

**Goal:** Make 温光浮字 read as an intentional illustrated lyric film through clear phrase hierarchy, one composed sketch, restrained paper, and music-time-driven motion.

**Architecture:** Keep the existing Canvas 2D effect and lyric/audio contracts. Refine the handwritten modules; derive composition, reveal, camera, and transitions from absolute music time and stable identities. Keep temporary visual QA outside the delivered application.

**Tech Stack:** Next.js 16, React 19, TypeScript strict, Canvas 2D, Vitest; no new dependencies or storage changes.

## Starting evidence and scope

- The user's current working branch contains unfinished gesture and handwritten MV work. Its modified/untracked file hashes were recorded outside the repository before editing.
- Latest local stable base: master `39b4d91`. Baseline `0430c56` imports only the 12 existing handwritten MV source/settings/document files. This baseline is preserved separately from this iteration's implementation.
- Working branch: `feature/handwritten-mv-refinement-work`, same-drive isolated checkout. Initial managed baseline remains at `C:/Users/Legion/.codex/worktrees/handwritten-mv-refinement/music_source_code`; Windows cross-drive dependency resolution prevented Next runtime compilation there. Same-drive checkout serves the renderer on port 3032. No remote operations.
- Baseline validation: 12 test files / 151 tests pass (effects, queue, search, listening insights); standalone TypeScript exits 0. Complete baseline suite: 1 existing failure / 1064 passes in `DataManagerPlayerDock.test.tsx:228`; it asserts immediate `isPlaying` changes although current code uses playback intent and media-event receipts. The original user checkout already has a fixture correction. Reused that exact correction in separate commit `792de8f`; all 18 dock tests then pass. No production playback code was changed for it.
- Old contact sheet is evidence of the previous state only. It shows isolated small lyric blocks, long subtitle-like single rows, unstructured empty space, and scattered icon-like decorations. Current-renderer screenshots must replace it for acceptance.
- Production write ownership: `handwritten_mv` owns `cinematicLyricDrift.ts`, `handwrittenScene.ts` and layout/motion helpers with focused tests. The second GPT-6 Luna Max agent, `mv_overlay_review`, owns `handwritten{Ink,Doodles,Paper,Palette}.ts` and their focused tests, after completing the independent global-overlay fix. Root owns docs, imported existing validation corrections, test harness, runtime/visual validation, review, integration, and final delivery. No overlapping file writes.
- Existing validation prerequisite: reused the user's `tsconfig.json` exclusions for `scratch` and `.worktrees` in separate commit `c292c8e`. This keeps nested local checkouts and temporary fixtures out of project-wide TypeScript checks; the original user file remains untouched.

## Design decisions

- Retain the handwritten paper identity. Use 2–3 coherent composition families instead of independent random positioning per decoration.
- Create a readable phrase hierarchy, with 2–3 balanced stepped rows for long lyrics. Emphasis must reserve layout width and must never enlarge a glyph into its neighbour.
- Pair the lyric block with one substantial pencil sketch at the opposite visual weight. Retain at most one relevant annotation and one restrained physical detail on lyric pages. Intro/interlude/outro must have a deliberate subject.
- Reduce full-screen yellow light, grain, bokeh, and floating debris. Keep neutral paper, directional light, and one accent.
- Use small continuous camera movement, controlled page-lift/draw-on phases, and separate outgoing/incoming readability. Do not claim true Chinese stroke-order animation: the input contains font outlines and timing, not stroke data.
- Respect existing effect IDs/settings and five palettes. Preserve the meaning of user controls, including font, palette, motion speed, grain, light, and vignette.

## Task 1: Baseline and visual inventory

**Dependencies:** None

**Parallelizable:** Yes (root, read-only while subagent audits)

- [x] Read repository rules, current design/plans, renderer, timeline contracts, and prior visual evidence.
- [x] Create isolated branch, preserve original dirty hashes, import handwritten-only baseline, run baseline tests/typecheck.
- [x] Capture current baseline at vertical/short lyric, long lyric, transition and interlude (1600x900 at t=8/30/60.2/100/112/219), with explicit defaults, DPR=1 and settle=0. The original fixture's t=8 is an interlude, not an intro; final intro coverage uses a separate self-written fixture whose first LRC starts at t=14. The original fixture ends with lyrics, so final true outro coverage uses the self-written mixed fixture.
- [x] Record shared QA inventory: legibility/composition; write-in/motion phases; same-time pause/seek; 0.5x/2x; missing song/lyrics; long CJK/Latin/emoji; multiple palettes; narrow/wide viewport; reduced motion; errors/performance. Temporary routes cover pinned/advancing synthetic clocks separately from the actual VisualizationView and native HTMLAudioElement.

## Task 2: Composition, typography, and purposeful motion

**Dependencies:** Task 1 baseline evidence

**Parallelizable:** No (single production write owner)

- [x] Add meaningful failing regressions for continuous camera/time determinism, safe readable bounds, and transition timing. Tests express observable behaviour rather than reproduce random constants.
- [x] Implement scene families, phrase layout, sketch scale/placement, restrained accessories, neutral paper, and music-time-based reveal/transition phases.
- [x] Remove per-load unseeded grain. Preserve live outgoing LRC timing until its final unit is ready, then use an absolute canonical snapshot. Entering the same transition by playback or seek must match.
- [x] Preserve complete grapheme content and LRC timing through wrapping. Cover punctuation, empty/short/long rows, vertical layouts, translations, and frame sizes without clipping.
- [x] Run focused regressions with observed red/green. Material owner: 20/20 tests, ESLint/Prettier/diff-check exit 0. Renderer checkpoint: 50 tests; root completed its interrupted final test and added actual-render-entry regressions for pre-LRC vertical text and portrait sketch/text separation, plus late-transition ink visibility.

Incremental completed integration: commit `c6dcdf3` initially hides FloatingPlayer and AILinerNotes only during immersive visualization. Root subsequently keeps FloatingPlayer mounted inside a hidden wrapper so its existing global keyboard listeners survive; data-manager routing retains priority and root audio hooks remain mounted. Seven routing tests pass, including hidden/restored UI and unchanged audio/floating-owner mount counts. Actual browser inspection confirms that the floating UI is invisible while the same native audio element and review queue remain active.

## Task 3: Real renderer review and iteration

**Dependencies:** Task 2

**Parallelizable:** No (root reviews actual outputs and returns concrete corrections)

- [x] Capture before/after using the same song, music time, viewport, palette, and explicit parameter defaults. Corrected the harness's missing-number parameter bug before captures.
- [x] Inspect transitions/reveals and completed compositions. Saved 60 actual renderer frames at t=9.2..16.28, 120ms music-time intervals, as a silent sampled GIF; this is not a real-time screen recording or FPS benchmark.
- [x] Exercise fixed-clock seek in both directions. In the actual VisualizationView with native HTMLAudioElement, verified play/pause, seek, 0.5x/2x, next/previous, and leave/re-enter MV. Same media identity (1), queue (2 items), intended rates and continued time were observed.
- [x] Check 1600x900, 390x844 and 2560x1080, reduced motion, five palettes, fonts 0/1/3, empty/instrumental and long CJK/Latin/emoji fixtures. Repaired mobile long-lyric overlap by fitting the complete block below the sketch. Verified reduced-motion vertical text remains pencil-only before its LRC start and fully inked at the exact start.
- [x] Record CPU submission and frame intervals separately. A warmed pinned desktop t=60.2 reported median draw 1.1ms / p95 1.5ms. Hidden-browser frame intervals sometimes throttle to about 1 second; these measurements do not establish real-device frame rate or performance improvement.
- [x] Reload and repeat affected checks. Same zero-spectrum t=9.5 raw PNG after initial seek, seek-away/return, and reload has identical SHA256 `7589de687fe9e838f8813740708b5265bd859c36f974951706b9d761a44bde48`.

## Task 4: Regression, review, and local integration

**Dependencies:** Task 3

**Parallelizable:** No (build must finish before standalone tsc)

- [x] Remove both temporary routes and synthetic WAV before production checks; preserve their sources/assets and screenshots/QA logs outside committed code.
- [x] Run TypeScript/TSX ESLint and changed-file Prettier, full Vitest, production build, then standalone `tsc --noEmit --incremental false --pretty false`. All pass. Standalone TSC exposed one fake Canvas test cast missed by the build; explicitly cast through `unknown`, then repeated its 3 tests/lint/format and standalone TSC successfully.
- [x] Review canvas-state restore, cache bounds/invalidation, clock authority, per-frame allocations, lyric preservation and storage/view scope. Independent findings were resolved and root completed the final follow-up after the delegate usage limit.
- [x] Update design, changelog, roadmap and plan with actual evidence and unexecuted device/audio checks.
- [x] Commit work on feature branch and merge locally with `--no-ff`. No remote operation. First merge included four Markdown hard-break trailing spaces because the staged-check exit was not propagated; this documentation follow-up fixes them without rewriting history and gates the final merge on a complete branch diff check.
- [x] Copy delivered MV files back to the original working checkout after rechecking recorded hashes. Stable regression passes and unrelated original hashes remain identical. Original checkout repeats 18 relevant test files / 197 tests successfully.

## Acceptance and limitations

The central words and sketch must form a perceptible focal group in reviewed browser screenshots, with no clipped lyrics or overlapping characters. A static screenshot cannot establish animation quality; review staged frames and an advancing-clock path. Synthetic-clock tests cannot establish audible playback, device performance, or Electron acceptance. Final handoff must include file/branch/commit links, actual checks, remaining issues and a usable preview.

## Local evidence and remaining acceptance

Evidence directory: `C:/Users/Legion/.codex/visualizations/2026/10/20/01a15796-8597-7832-a7dc-903e827b566b`.

Final feature validation: `npm test -- --run --maxWorkers=4` (193 files / 1120 tests, exit 0); `npx eslint src --ext ts,tsx --max-warnings=99999` (exit 0); changed-source Prettier (exit 0); `npm run build` (exit 0); sequential `npx tsc --noEmit --incremental false --pretty false` (exit 0); `git diff --check` (exit 0). The bare `eslint src` attempt was interrupted because it selected the unrelated bundled/obfuscated JavaScript source scripts; it is not reported as a pass. No bundled scripts were changed. Next retains its existing multiple-lockfile and stale Browserslist notices. Production preview returned `/` and `/data-manager` 200, both removed `/dev/handwritten-*` routes 404, with no errors/warnings in the fresh production browser smoke.

## Delivery receipt

- Implementation commit: `76d06af`; validation record: `64104e7`; initial local master merge: `c94800f`. Feature branch: `feature/handwritten-mv-refinement-work`.
- Master regression after the implementation merge: full Vitest 193 files / 1120 tests, production build, then standalone strict TypeScript all exit 0. The final receipt/whitespace follow-up changes this plan only; final integration verifies source identity and the entire branch diff.
- Delivery copied 21 reviewed files and appended three MV documentation sections while preserving every original document byte. The original branch stays `feature/gesture-air-control-overhaul` at `c73a872`; its existing index and unrelated dirty changes were retained. Of the 58 recorded pre-existing changed/untracked files, no unrelated file hash or existence changed; delivered hashes match.
- Original checkout regression: `npm test -- --run src/components/visualization/effects src/components/layout/GlobalClientComponents.test.tsx src/components/player/DataManagerPlayerDock.test.tsx --maxWorkers=4` passes 18 files / 197 tests; original port 3025 returns HTTP 200. The unrelated unfinished gesture work was not given a full-build acceptance claim.
- Temporary QA routes/assets and test servers on 3032/3033 were removed/stopped. The unused cross-drive baseline worktree was archived recoverably; the reviewed same-drive feature worktree remains available. No push, PR or publication was performed.

- `mv-before-after.png`, `mv-motion-preview.gif`, individual desktop/portrait/wide/palette frames, `browser-visual-qa.json`, `motion-samples.json`, `mixed-program.json`, and `native-playback-final.json` distinguish fixed-clock artwork checks from real media-element checks.
- Browser artwork captures ended with no renderer exceptions or console errors. Leaving the MV exposes the pre-existing unconfigured AI-notes warning / local AI 401 requests; no AI configuration or credential was changed.
- Native fullscreen was attempted but could not be confirmed in the in-app browser. Real phone/tablet, Electron, audio output/listening, and device performance were not executed. Viewport emulation is not a real device test.
- During a long 2x QA interval the queue advanced naturally; a later Next at the final item cleared store song/playing state while the native source continued. Controlled first-to-second/previous switching passed after resetting the fixture. Queue-end reconciliation remains a separate observed issue: `audioStore.ts` and `useAudioPlayer.ts` have no changes in this branch; this iteration does not claim that boundary is fixed.
- GPT-6 Luna Max performed the primary implementation and independent review. Its usage limit interrupted the last review turn; root completed the remaining vertical timing fix and addressed the final mobile/transition findings with red/green tests and browser checks. There is no claim of a final independent approval after those root fixes.
