# Code Health, Test Coverage, and Type Safety Implementation Plan

> **For agentic workers:** Use nbl.subagent-driven-development or nbl.executing-plans to implement task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Drive MIMI from "feature-complete but lint-heavy" to "ship-quality code health" by eliminating the 583 ESLint errors, raising store test coverage from 25.9% to 50%+, and removing high-risk `any` usage from shared seams (stores, lib, hooks). This is the foundation for a clean v0.4.0 release.

**Architecture:** Work is strictly scoped to code health — no new features, no UI redesign. Each task modifies a small, well-defined file set. Untouched V7.0 core views remain off-limits for behavioral changes, but lint fixes in those files are permitted.

**Tech Stack:** Next.js 16 / React 19 / TypeScript strict, Zustand 5, Vitest + jsdom, ESLint 9 + Prettier + react-hooks plugin.

---

## Current Baseline (verified 2026-05-21)

- Branch: `codex/animation-function-iteration-plan`, HEAD at `ecbed32`.
- All 14 tasks from the 2026-05-16 plan are marked complete.
- Tests: 76 files, 382 tests, all passing.
- Build: `npm run build` passes with TS strict mode.
- **ESLint: 583 problems (583 errors, 0 warnings)** broken down as:
  | Rule | Count | Auto-fixable |
  |------|-------|-------------|
  | `prettier/prettier` | 350 | Yes |
  | `@typescript-eslint/no-explicit-any` | 156 | No |
  | `react-hooks/exhaustive-deps` | 34 | No |
  | `react-hooks/refs` | 29 | No |
  | `react-hooks/set-state-in-effect` | 25 | No |
  | `react-hooks/immutability` | 7 | No |
  | `react-hooks/purity` | 6 | No |
  | `react-hooks/preserve-manual-memoization` | 3 | No |
  | `react-hooks/static-components` | 1 | No |
  | Other (ban-ts-comment, display-name, jsx-no-comment-textnodes, no-img-element, no-prototype-builtins, no-control-regex) | 6 | Mixed |
- **Store test gap:** 26 of ~40 meaningful stores have zero test files.
- **`any` usage:** 62 files, concentrated in V8 visualization effects (ParticleFlowFieldV8: 30, ParticleGravityV8: 19, ParticleTrailV8: 17) and legacy panels.
- **Coupling:** `audioStore` imported by 48 files, `uiStore` by 33 files.

---

## Guardrails

- Every task must end with `npm run test` passing and `npm run build` passing.
- Do not change runtime behavior of V7.0 core views (Home / Player / Fullscreen Lyrics).
- Do not add new dependencies.
- Each task is independently committable; revert-safe if interrupted.
- ESLint error count must never increase from the start-of-task baseline.
- When a lint fix touches a V7.0 core view file, fix only the lint issue — no refactors.

---

## File Map

### Stores (test gap targets)

- `src/store/emotionStore.ts` - AI emotion state; currently untested.
- `src/store/crossfadeStore.ts` - crossfade queue management; untested.
- `src/store/visualizationStore.ts` - V8 visualization config; untested.
- `src/store/visualizationV8Store.ts` - V8 effect registry; untested.
- `src/store/dsdProcessingStore.ts` - DSD audio processing; untested.
- `src/store/formatConversionStore.ts` - format conversion queue; untested.
- `src/store/recordingStore.ts` - audio recording; untested.
- `src/store/trackCuttingStore.ts` - track cutting; untested.
- `src/store/waveformStore.ts` - waveform data; untested.
- `src/store/hiresStore.ts` - Hi-Res audio; untested.
- `src/store/fingerprintStore.ts` - audio fingerprint; untested.
- `src/store/knowledgeStore.ts` - music knowledge; untested.
- `src/store/linerNotesStore.ts` - AI liner notes; untested.
- `src/store/lyricSettingsStore.ts` - lyric display settings; untested.
- `src/store/metadataEditorStore.ts` - song metadata editing; untested.
- `src/store/libraryManagerStore.ts` - library management; untested.
- `src/store/spectrumStore.ts` - spectrum display; untested.
- `src/store/professionalModeStore.ts` - pro mode settings; untested.
- `src/store/totemStore.ts` - resonance totem; untested.
- `src/store/gestureStore.ts` - gesture controls; untested.
- `src/store/animationStore.ts` - animation state; untested.
- `src/store/presetStore.ts` - presets; untested.

### High-risk `any` seams

- `src/components/visualization-v8/effects/ParticleFlowFieldV8.ts` (30 any)
- `src/components/visualization-v8/effects/ParticleGravityV8.ts` (19 any)
- `src/components/visualization-v8/effects/ParticleTrailV8.ts` (17 any)
- `src/components/visualization-v8/effects/ParticleExplosionV8.ts` (13 any)
- `src/components/visualization-v8/effects/ParticleVortexV8.ts` (11 any)
- `src/components/visualization-v8/effects/TunnelFlightV8.ts` (10 any)
- `src/components/visualization-v8/effects/StarFieldV8.ts` (9 any)
- `src/components/visualization-v8/effects/VibrationGeometryV8.ts` (9 any)

### Hooks with react-hooks violations

- `src/hooks/useAudioPlayer.ts` - core playback hook.
- `src/hooks/useDailyRecommendation.ts` - recommendation integration.
- `src/hooks/useDynamicTheme.ts` - theme extraction.
- `src/app/data-manager/page.tsx` - data manager page (set-state-in-effect).

---

## Part A — ESLint Auto-fix and Quick Wins

### Task 1: Prettier Auto-fix (350 errors -> 0)

- [x] Task complete

**Dependencies:** None
**Parallelizable:** No

- [ ] **Step 1: Run prettier auto-fix**
  - `npx prettier --write "src/**/*.{ts,tsx}"` to format all source files.
  - Run `npx eslint src --max-warnings=99999` to confirm 350 prettier errors are gone.
- [ ] **Step 2: Verify build and tests**
  - `npm run test` must pass.
  - `npm run build` must pass.
- [ ] **Step 3: Commit**
  - Message: `style: auto-fix prettier formatting across all source files`.
  - Note the remaining ESLint error count in the commit message.

### Task 2: Fix Simple Lint Errors (ban-ts-comment, display-name, jsx-no-comment, no-img-element, no-prototype-builtins, no-control-regex)

- [x] Task complete

**Dependencies:** Task 1
**Parallelizable:** No

- [ ] **Step 1: Fix each rule manually**
  - `@typescript-eslint/ban-ts-comment` (1): replace `@ts-ignore` with `@ts-expect-error` and a reason.
  - `react/display-name` (1): wrap the anonymous component in a named const.
  - `react/jsx-no-comment-textnodes` (1): move the comment out of JSX or wrap in `{/* */}`.
  - `@next/next/no-img-element` (1): replace `<img>` with Next.js `<Image>`.
  - `no-prototype-builtins` (1): replace `obj.hasOwnProperty(key)` with `Object.prototype.hasOwnProperty.call(obj, key)`.
  - `no-control-regex` (1): escape or refactor the regex in `PosterTemplates.tsx`.
- [ ] **Step 2: Verify**
  - `npx eslint src --max-warnings=99999` — these 6 rules should report 0 errors.
  - `npm run test` and `npm run build` must pass.
- [ ] **Step 3: Commit**
  - Message: `fix: resolve 6 miscellaneous ESLint errors`.

---

## Part B — React Hooks Violations

### Task 3: Fix `react-hooks/set-state-in-effect` (25 errors)

- [x] Task complete

**Dependencies:** Task 1
**Parallelizable:** Yes (disjoint file sets)

- [x] **Step 1: Triage by file**
  - Run `npx eslint src --rule '{"react-hooks/set-state-in-effect":"error"}' --format json` to get per-file locations.
  - Group into: (a) `setMounted(true)` patterns — move to lazy initializer or ref. (b) Sync-time cascade patterns like `setDisplayTime(currentTime)` — derive with `useMemo` or remove the effect entirely.
- [x] **Step 2: Fix `setMounted` patterns**
  - Replace `useEffect(() => setMounted(true), [])` with `const [mounted] = useState(true)` (it's always true on client) or a ref-based approach.
- [x] **Step 3: Fix sync cascade patterns**
  - `setDisplayTime(currentTime)` in data-manager: derive `displayTime` via `useMemo` or use `currentTime` directly.
  - `setShowMiniPlayer(true)` in data-manager: derive from `currentSong` existence.
- [x] **Step 4: Verify**
  - `npx eslint src --max-warnings=99999` — `set-state-in-effect` should report 0.
  - `npm run test` and `npm run build` must pass.
- Verification completed 2026-05-23:
  - `npx eslint src --rule '{"react-hooks/set-state-in-effect":"error"}' --format json --output-file test-results/eslint-set-state-current.json` reported 0 `react-hooks/set-state-in-effect` violations.
  - `npm run test -- --run` passed: 76 files, 382 tests.
  - `npm run build` passed.
- [ ] **Step 5: Commit**
  - Message: `fix: eliminate react-hooks/set-state-in-effect violations`.

### Task 4: Fix `react-hooks/exhaustive-deps` (34 errors)

- [x] Task complete

**Dependencies:** Task 1
**Parallelizable:** Yes (disjoint files)

- [x] **Step 1: Triage**
  - Get per-file locations from ESLint JSON output.
  - Categorize: (a) missing deps that should be added (stable refs, store selectors), (b) deps that intentionally change frequently and need `useCallback`/`useMemo` upstream, (c) cases where the effect should be split.
- [x] **Step 2: Fix category (a) — add missing deps**
  - Add stable dependencies. For Zustand selectors, the selector function reference is stable so it can be added safely.
- [x] **Step 3: Fix category (b) — stabilize callbacks**
  - Wrap inline functions in `useCallback` or extract them outside the component.
- [x] **Step 4: Fix category (c) — split effects**
  - When one effect does two things with different dep lists, split into two effects.
- [x] **Step 5: Verify**
  - `npx eslint src --max-warnings=99999` — `exhaustive-deps` should report 0.
  - `npm run test` and `npm run build` must pass.
- Verification completed 2026-05-23:
  - `npx eslint src --rule '{"react-hooks/exhaustive-deps":"error","react-hooks/set-state-in-effect":"error"}' --format json --output-file test-results/eslint-hooks-task4-current.json` reported 0 `react-hooks/exhaustive-deps` violations and 0 `react-hooks/set-state-in-effect` violations.
  - Remaining hook violations are Task 5 scope: `react-hooks/refs` 29, `react-hooks/immutability` 2, `react-hooks/static-components` 1.
  - `npm run test -- --run` passed: 76 files, 382 tests.
  - `npm run build` passed.
- [ ] **Step 6: Commit**
  - Message: `fix: resolve react-hooks/exhaustive-deps violations`.

### Task 5: Fix `react-hooks/refs` + `immutability` + `purity` + `preserve-manual-memoization` + `static-components` (46 errors)

- [x] Task complete

**Dependencies:** Task 1
**Parallelizable:** Yes

- [x] **Step 1: `refs` (29)**
  - These warn about reading `.current` during render. Move ref reads into effects or event handlers.
- [x] **Step 2: `immutability` (7)**
  - These warn about mutating state or props directly. Replace mutations with state setter calls.
- [x] **Step 3: `purity` (6)**
  - These warn about side effects during render. Move to effects or callbacks.
- [x] **Step 4: `preserve-manual-memoization` (3)**
  - These warn about reassigning memoized values. Preserve `useMemo`/`useCallback` return values.
- [x] **Step 5: `static-components` (1)**
  - Move the component definition outside the parent component or outside render scope.
- [x] **Step 6: Verify**
  - `npx eslint src --max-warnings=99999` — all react-hooks rules should report 0.
  - `npm run test` and `npm run build` must pass.
  - Verification completed 2026-05-23:
    - `npx eslint src --rule '{"react-hooks/refs":"error","react-hooks/immutability":"error","react-hooks/purity":"error","react-hooks/preserve-manual-memoization":"error","react-hooks/static-components":"error","react-hooks/exhaustive-deps":"error","react-hooks/set-state-in-effect":"error"}' --format json --output-file test-results/eslint-hooks-task5-current.json` reported 0 target react-hooks violations.
    - `npm run test -- --run` passed: 76 files, 382 tests.
    - `npm run build` passed: Next.js production build and TypeScript checks completed successfully.
    - Browser smoke test passed at `http://localhost:3025`: `/` rendered meaningful content, had no framework error overlay, had no console error/warn entries, and `Manage music` navigated to `/data-manager` with content rendered and console still clean.
- [ ] **Step 7: Commit**
  - Message: `fix: resolve remaining react-hooks violations (refs, immutability, purity, memoization, static-components)`.

---

## Part C — Store Test Coverage Expansion

### Task 6: Tier 1 Store Tests (highest risk, most imported)

- [ ] Task complete

**Dependencies:** None (can start in parallel with Part A)
**Parallelizable:** Yes (disjoint test files)

Stores to test (6 files, ~6 pure test specs):

- [ ] **Step 1: `emotionStore.test.ts`**
  - Test: `analyzeEmotion`, `setEmotion`, `clearEmotion`, persistence shape.
  - Mock: `aiStore` if needed.
- [ ] **Step 2: `crossfadeStore.test.ts`**
  - Test: `addToQueue`, `updateQueueItemStatus`, `incrementProcessed`, `clearQueue`, `settings` updates.
- [ ] **Step 3: `visualizationStore.test.ts`**
  - Test: `setActiveEffect`, `setParameters`, `toggleFullscreen`, persistence round-trip.
- [ ] **Step 4: `visualizationV8Store.test.ts`**
  - Test: `registerEffect`, `getEffect`, `setPerformanceMode`, `registeredEffects` array.
- [ ] **Step 5: `dsdProcessingStore.test.ts`**
  - Test: `startConversion`, `updateProgress`, `setOutputFormat`, error handling.
- [ ] **Step 6: `formatConversionStore.test.ts`**
  - Test: `addToQueue`, `updateProgress`, `markComplete`, `markError`.
- [ ] **Step 7: Verify**
  - `npm run test -- src/store/emotionStore.test.ts src/store/crossfadeStore.test.ts src/store/visualizationStore.test.ts src/store/visualizationV8Store.test.ts src/store/dsdProcessingStore.test.ts src/store/formatConversionStore.test.ts` must pass.
- [ ] **Step 8: Commit**
  - Message: `test(store): add tests for tier 1 untested stores (emotion, crossfade, visualization, dsd, formatConversion)`.

### Task 7: Tier 2 Store Tests (secondary stores)

- [ ] Task complete

**Dependencies:** None
**Parallelizable:** Yes

Stores to test (8 files):

- [ ] **Step 1:** `recordingStore.test.ts` - start/stop recording, status transitions.
- [ ] **Step 2:** `trackCuttingStore.test.ts` - set range, preview, export.
- [ ] **Step 3:** `waveformStore.test.ts` - load waveform, zoom, cursor position.
- [ ] **Step 4:** `hiresStore.test.ts` - quality detection, badge display state.
- [ ] **Step 5:** `fingerprintStore.test.ts` - fingerprint computation, match result.
- [ ] **Step 6:** `knowledgeStore.test.ts` - fetch/cache knowledge entries.
- [ ] **Step 7:** `linerNotesStore.test.ts` - generate notes, save, retrieve.
- [ ] **Step 8:** `lyricSettingsStore.test.ts` - font size, color, alignment, persistence.
- [ ] **Step 9: Verify**
  - Targeted vitest run for all 8 test files must pass.
- [ ] **Step 10: Commit**
  - Message: `test(store): add tests for tier 2 untested stores (recording, trackCutting, waveform, hires, fingerprint, knowledge, linerNotes, lyricSettings)`.

### Task 8: Tier 3 Store Tests (remaining stores)

- [ ] Task complete

**Dependencies:** None
**Parallelizable:** Yes

Stores to test (8 files):

- [ ] **Step 1:** `metadataEditorStore.test.ts` - edit field, validate, save.
- [ ] **Step 2:** `libraryManagerStore.test.ts` - scan, import, export library.
- [ ] **Step 3:** `spectrumStore.test.ts` - mode switch, sensitivity, persistence.
- [ ] **Step 4:** `professionalModeStore.test.ts` - enable/disable pro features.
- [ ] **Step 5:** `totemStore.test.ts` - totem type, animation state, config.
- [ ] **Step 6:** `gestureStore.test.ts` - gesture binding, enable/disable.
- [ ] **Step 7:** `animationStore.test.ts` - animation queue, timing, spring config.
- [ ] **Step 8:** `presetStore.test.ts` - save/load/delete presets, import/export.
- [ ] **Step 9: Verify**
  - Targeted vitest run for all 8 test files must pass.
- [ ] **Step 10: Commit**
  - Message: `test(store): add tests for tier 3 untested stores (metadataEditor, libraryManager, spectrum, professionalMode, totem, gesture, animation, preset)`.

---

## Part D — Type Safety (no-explicit-any)

### Task 9: Define shared V8 Effect Types

- [ ] Task complete

**Dependencies:** None
**Parallelizable:** No (foundational for Tasks 10-11)

- [ ] **Step 1: Create `src/lib/visualization/v8EffectTypes.ts`**
  - Define `V8EffectState` interface (private state shared across particle effects).
  - Define `V8Particle` interface (position, velocity, life, color, size).
  - Define `V8EffectConfig` interface (resolution, fps target, color palette).
  - Define `V8AudioData` interface (frequency bins, waveform, beat detection).
  - Export all types; no runtime code, only type definitions.
- [ ] **Step 2: Test compile**
  - `npx tsc --noEmit --incremental false` must pass.
- [ ] **Step 3: Commit**
  - Message: `type(visualization): define shared V8 effect type interfaces`.

### Task 10: Replace `any` in Particle V8 Effects (30+19+17+13+11 = 90 errors)

- [ ] Task complete

**Dependencies:** Task 9
**Parallelizable:** Yes (disjoint effect files)

- [ ] **Step 1:** `ParticleFlowFieldV8.ts` — replace 30 `any` with `V8Particle`, `V8EffectState`, `V8AudioData`.
- [ ] **Step 2:** `ParticleGravityV8.ts` — replace 19 `any`.
- [ ] **Step 3:** `ParticleTrailV8.ts` — replace 17 `any`.
- [ ] **Step 4:** `ParticleExplosionV8.ts` — replace 13 `any`.
- [ ] **Step 5:** `ParticleVortexV8.ts` — replace 11 `any`.
- [ ] **Step 6: Verify**
  - `npx tsc --noEmit --incremental false` must pass.
  - `npm run test -- src/components/visualization-v8` must pass (if tests exist).
  - `npx eslint src/components/visualization-v8 --max-warnings=99999` — `no-explicit-any` count should drop by ~90.
- [ ] **Step 7: Commit**
  - Message: `type(visualization): replace any with typed interfaces in particle V8 effects`.

### Task 11: Replace `any` in Remaining V8 Effects + Non-V8 High-Count Files

- [ ] Task complete

**Dependencies:** Task 9
**Parallelizable:** Yes

- [ ] **Step 1:** `TunnelFlightV8.ts` (10 any), `StarFieldV8.ts` (9), `VibrationGeometryV8.ts` (9), `ResonanceTotemV8.ts` (3), `ParticleNebulaV8.ts` (2) — replace with shared types.
- [ ] **Step 2: Scan remaining `no-explicit-any` violations**
  - After Tasks 10-11 step 1, run ESLint for the rule to find remaining ~50 violations.
  - Group by area: hooks, stores, components, utils.
- [ ] **Step 3: Fix store `any` usages**
  - Replace `any` state fields with proper interfaces. Priority: `statsAchievementsStore.ts` (29.3 KB, likely has `any` in achievement types).
- [ ] **Step 4: Fix hook `any` usages**
  - Replace `any` params and return types in hooks.
- [ ] **Step 5: Fix component `any` usages**
  - Replace `any` props and state in components.
- [ ] **Step 6: Verify**
  - `npx eslint src --rule '{"@typescript-eslint/no-explicit-any":"error"}' --max-warnings=99999` — error count should be under 20.
  - `npm run test` and `npm run build` must pass.
- [ ] **Step 7: Commit**
  - Message: `type: reduce no-explicit-any violations from 156 to under 20`.

---

## Part E — Final Verification

### Task 12: Full Verification and Release Gate

- [ ] Task complete

**Dependencies:** All previous tasks
**Parallelizable:** No

- [ ] **Step 1: Full ESLint**
  - `npx eslint src --max-warnings=99999` must report 0 errors and 0 warnings.
  - If any remain, fix or document as pre-existing with `eslint-disable` + issue reference.
- [ ] **Step 2: Full test suite**
  - `npm run test` must pass with exit 0.
  - Record total test count (target: 382 + ~44 new = ~426 tests).
- [ ] **Step 3: Build**
  - `npm run build` must pass with TS strict mode.
- [ ] **Step 4: Manual smoke**
  - `npm run dev` on port 3025.
  - Open in browser: verify Home, Queue, Search, Audio Effects, Lyrics, Library, Stats, Journal, Smart Mix, Halo skins.
  - Confirm 0 console errors, 0 page errors.
- [ ] **Step 5: Update docs**
  - Update `docs/nbl/CHANGELOG.md` with v0.4.0 section.
  - Update `docs/nbl/ROADMAP.md` with reality update.
  - Update `docs/nbl/plans/INDEX.md` with this plan's status.
- [ ] **Step 6: Commit + tag**
  - Message: `chore: v0.4.0 code health — zero ESLint, 400+ tests, reduced any usage`.
  - Consider tagging: `git tag v0.4.0`.

---

## Execution Strategy

### Solo execution order
Part A (1 -> 2) -> Part B (3 -> 4 -> 5) -> Part C (6 -> 7 -> 8) -> Part D (9 -> 10 -> 11) -> Part E (12).

### Parallel strategy (subagent-driven)
- **Wave 1:** Tasks 1, 6, 7, 8 (auto-fix + store tests are fully disjoint).
- **Wave 2 (after 1):** Tasks 2, 3, 4, 5 (lint fixes by rule, non-overlapping files).
- **Wave 3:** Task 9 (type definitions).
- **Wave 4 (after 9):** Tasks 10, 11 (type replacements, disjoint V8 files).
- **Wave 5:** Task 12 (final gate).

### Estimated effort
| Part | Tasks | Errors resolved | Tests added | Commits |
|------|-------|----------------|-------------|---------|
| A | 2 | 356 | 0 | 2 |
| B | 3 | 111 | 0 | 3 |
| C | 3 | 0 | ~44 specs | 3 |
| D | 3 | ~140 | 0 | 3 |
| E | 1 | remaining | 0 | 1 |
| **Total** | **12** | **~583 -> 0** | **~44** | **12** |

---

## Risks And Mitigations

- **Prettier auto-fix may cause merge conflicts with in-flight branches.** Mitigation: commit auto-fix first and rebase any parallel work on top.
- **react-hooks fixes may change render behavior.** Mitigation: each task runs the full test suite; if a fix causes a test failure, investigate whether the test was asserting broken behavior or the fix is wrong.
- **Store tests may reveal hidden bugs in untested stores.** Mitigation: document bugs as follow-up issues rather than expanding scope into bug fixes.
- **V8 type replacements may break Canvas rendering at runtime.** Mitigation: the types are compile-time only; verify with `npm run dev` smoke after Part D.
- **ESLint react-hooks plugin is relatively new and may have false positives.** Mitigation: if a violation is genuinely incorrect, use `// eslint-disable-next-line` with a comment explaining why.
