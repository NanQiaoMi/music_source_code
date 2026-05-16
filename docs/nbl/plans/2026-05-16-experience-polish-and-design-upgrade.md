# Experience Polish And Design Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use nbl.subagent-driven-development (recommended) or nbl.executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Continue the 2026-05-14 project-completion upgrade by closing the remaining mock/coupling gaps and shipping a focused round of practicality-and-design-feel improvements across the most-used panels (Queue+Search command center, Audio Effects, Lyrics, Library, Stats, Settings, Visualization), then add three high-leverage new features (Smart Mix Sessions, Now Playing Halo skin pack, Listening Journal).

**Architecture:** Keep V7.0 core views (Home/Player/Fullscreen Lyrics) untouched. Land work as small, independently-shippable slices: each task adds tests first, isolates pure logic in `src/utils` or `src/lib`, then wires UI through existing Zustand stores. New features reuse the existing PanelOrchestrator + Glass component family so they inherit the design system rather than introducing new visual primitives.

**Tech Stack:** Next.js 16 / React 19 / TypeScript strict, Zustand 5 + persist, Framer Motion 12, Tailwind 3.4 + OKLCH design tokens, Web Audio API singleton, Canvas 2D / WebGL V8 effect engine, Vitest + jsdom.

---

## Current Baseline (verified 2026-05-16)

- Branch: `codex/animation-function-iteration-plan`, working tree clean.
- Recent commits already covered earlier tasks of `2026-05-14-project-completion-feature-upgrade.md`:
  - Task 1 stabilize branch: commit `1abd01a chore: stabilize current feature iteration baseline`.
  - Task 2 poster workshop: commit `c9f514c feat: improve poster workshop workflow` and `posterWorkshop.test.ts`.
  - Task 3 daily recommendations: commits `e36b4f1 feat: make recommendations explainable` and `736110c feat(recommendation): add feedback-driven daily recommendations`.
  - Task 4 partial (search side): commit `e0ecd40 feat: improve library search workflow`, `searchStore.test.ts`.
  - Task 7 lyrics partial: commit `280e7c0 feat: improve lyrics recovery workflow`, `lyricsSearchStore.test.ts`.
  - Task 9 visualization presets partial: commits `f9d3af0 feat: improve visualization controls`, `aff999d fix: use real visualization performance metrics`, `2fff3d0 fix: gate visualization parameters by mode`, `7ce2227 fix: persist visualization parameter mode`.
- Remaining gaps from the 05-14 plan:
  - Queue side of Task 4 (queue regression tests, QueuePanel action upgrades).
  - Task 5 Audio Effects presets + morphing + persistence boundary tests.
  - Task 6 mock blob paths still present at `src/components/audio/FormatConverter.tsx:128` and `src/components/audio/CrossfadeMixer.tsx:365`.
  - Task 8 decoupling: `src/store/recommendationStore.ts` still imports `playlistStore` and `emotionStore` directly; `src/components/visualization-v8/effects/AudioLiquidV8.ts:207` still uses dynamic `require("@/store/uiStore")`.
  - Task 10 docs alignment (ROADMAP reality + plan index) not yet finalized.
- 67 store files, 32 test files; coverage is concentrated on recently-touched slices.

---

## Guardrails

- Do not modify V7.0 core views: Home, Player, Fullscreen Lyrics.
- Do not change persisted storage keys without a versioned migration (e.g. keep `queue-store-v5` shape; add `-v6` only with a one-way migrator).
- Every UI change must respect `prefers-reduced-motion` and keep tab focus rings visible.
- Every new pure function lives under `src/utils/` or `src/lib/` and ships with a Vitest spec before wiring UI.
- Never `npm run dev` unattended in CI-style steps; use `npm run test -- <file>` for targeted verification.
- Use `git commit --no-verify` only if pre-commit hooks fail for unrelated lint debt; never bypass type errors.

---

## File Map

### Logic / Stores (touched or added)

- `src/store/queueStore.ts` - extend with `playNext`, `clearAfterCurrent`, `bulkRemove` selectors; keep `queue-store-v5` shape.
- `src/store/audioEffectsStore.ts` - add `presets`, `activePresetId`, `morphTo(preset, ms)` with normalized payload.
- `src/store/recommendationStore.ts` - drop direct `playlistStore` / `emotionStore` imports; accept inputs via selector helper.
- `src/lib/recommendation/inputs.ts` (new) - pure helper that snapshots required inputs from peer stores.
- `src/lib/audio/effectsPresets.ts` (new) - canonical preset shape + 6 built-in presets + morph interpolation.
- `src/lib/audio/processingCapabilities.ts` (new) - detect WebCodecs / OfflineAudioContext / FFmpeg.wasm availability.
- `src/lib/queue/queueActions.ts` (new) - pure helpers for `playNext`, `bulkRemove`, `dedupe`, `shuffleAfter`.
- `src/lib/search/commandRouter.ts` (new) - parse search input into `{kind: "song"|"command", ...}` so search + queue act as a command center.
- `src/lib/journal/listeningJournal.ts` (new) - daily rollup of plays + emotion tags + manual notes.
- `src/store/listeningJournalStore.ts` (new) - persisted store for `listeningJournal` (key `journal-store-v1`).
- `src/store/smartMixStore.ts` (new) - in-memory mix-session state (no persist for v1).
- `src/store/playerSkinsStore.ts` - extend with new `halo` skin pack registration; reuse existing skin contract.

### UI / Components

- `src/components/player/QueuePanel.tsx` - add multi-select, `play next`, `clear after current`, bulk remove, drag handle a11y.
- `src/components/player/SearchPanel.tsx` - integrate command router; show `/` hint, command chips, recent searches.
- `src/components/features-v7/AudioEffectsPanel.tsx` - preset gallery, morph slider, A/B compare toggle, persisted `lastPresetId`.
- `src/components/audio/FormatConverter.tsx` - replace `mockBlob` with capability-aware path: real conversion when supported, explicit "preview only" state otherwise.
- `src/components/audio/CrossfadeMixer.tsx` - same capability-aware replacement; never emit fake `Blob`.
- `src/components/library/LibraryHealthPanel.tsx` - add empty / partial / healthy visual states with iconography from Glass system.
- `src/components/library/SmartPlaylistPanel.tsx` - polish rule editor (chips for operator, live preview count).
- `src/components/widgets/StatsAchievementsPanel.tsx` - add weekly mini-spark, streak ring; reuse listening insights.
- `src/components/widgets/DailyRecommendation.tsx` - add "why this" hover card; reuse explanation already in store.
- `src/components/widgets/SmartMixSessionCard.tsx` (new) - entry card for Smart Mix Sessions.
- `src/components/widgets/ListeningJournalCard.tsx` (new) - entry card + week ribbon.
- `src/components/lyrics/LyricSettingsPanel.tsx` - add three readability presets (Cinema, Reading, Karaoke).
- `src/components/visualization-v8/effects/AudioLiquidV8.ts` - replace dynamic `require` with injected hook prop or static import.
- `src/components/settings/SettingsPanel.tsx` - surface visual performance presets + reduced-motion echo from system.

### Tests

- `src/lib/queue/queueActions.test.ts`
- `src/lib/audio/effectsPresets.test.ts`
- `src/lib/audio/processingCapabilities.test.ts`
- `src/lib/search/commandRouter.test.ts`
- `src/lib/recommendation/inputs.test.ts`
- `src/lib/journal/listeningJournal.test.ts`
- `src/store/audioEffectsStore.test.ts`
- `src/store/listeningJournalStore.test.ts`
- `src/store/smartMixStore.test.ts`
- `src/components/audio/FormatConverter.test.tsx` (capability branch)
- `src/components/player/QueuePanel.test.tsx` (multi-select + play next)
- `src/components/widgets/ListeningJournalCard.test.tsx`

### Docs

- `docs/nbl/ROADMAP.md` - mark completed Phase 2/3 items honestly; add Phase 5 "polish + new features".
- `docs/nbl/plans/INDEX.md` (new) - chronological plan index with status badges.
- `docs/nbl/CHANGELOG.md` - add entries per shipped task.

---

## Part A - Close The 2026-05-14 Plan

### Task 1: Finish Queue Side Of The Queue+Search Command Center

- [ ] Task complete

**Dependencies:** None
**Parallelizable:** Yes (file ownership: `src/store/queueStore.ts`, `src/lib/queue/*`, `src/components/player/QueuePanel.tsx`)

- [ ] **Step 1: Add queue action regression tests**
  - Create `src/lib/queue/queueActions.test.ts` covering `playNext`, `clearAfterCurrent`, `bulkRemove`, `dedupe`, `shuffleAfterCurrent`.
  - Each test asserts pure transformation on `Song[]` plus `currentIndex` clamp.
  - `npm run test -- src/lib/queue/queueActions.test.ts` must fail (no impl yet).
- [ ] **Step 2: Extract pure helpers**
  - Create `src/lib/queue/queueActions.ts` exporting the four helpers above.
  - No store or React imports; input is `{ queue: Song[]; currentIndex: number }`, output is the next state.
- [ ] **Step 3: Wire helpers into `queueStore.ts`**
  - Add `playNext(song)`, `clearAfterCurrent()`, `bulkRemove(ids)` actions delegating to helpers.
  - Keep `queue-store-v5` storage key; only persist `ids` + minimal metadata (already done in commit `0d87b53`).
- [ ] **Step 4: Multi-select in `QueuePanel.tsx`**
  - Add `Set<string>` selection state (component-local) with checkbox column.
  - Add toolbar: `Play next`, `Remove`, `Clear after current`, `Shuffle remaining`.
  - Keyboard: `Space` toggles selection on focused row, `Shift+Click` range-select.
- [ ] **Step 5: Verify**
  - `npm run test -- src/lib/queue` and `npm run test -- src/store/queueStore` pass.
  - `npm run lint -- src/components/player/QueuePanel.tsx src/store/queueStore.ts src/lib/queue` clean.
- [ ] **Step 6: Commit**
  - Message: `feat(queue): multi-select actions and play-next pure helpers`.

### Task 2: Audio Effects Presets, Morphing, Safe Persistence

- [ ] Task complete

**Dependencies:** None
**Parallelizable:** Yes (file ownership: `src/lib/audio/effectsPresets.*`, `src/store/audioEffectsStore.*`, `src/components/features-v7/AudioEffectsPanel.tsx`)

- [ ] **Step 1: Define canonical preset shape**
  - Create `src/lib/audio/effectsPresets.ts` exporting `EffectPreset = { id, name, eq: number[10], reverb: 0..1, compressor: {...}, stereoWidth: 0..2 }`.
  - Ship 6 built-ins: `flat`, `vocal-focus`, `live-room`, `late-night`, `bass-room`, `clarity-boost`.
- [ ] **Step 2: Pure morph interpolator**
  - Add `morph(a: EffectPreset, b: EffectPreset, t: 0..1): EffectPreset` doing per-field lerp.
  - Write `effectsPresets.test.ts` covering boundaries and clamping.
- [ ] **Step 3: Extend `audioEffectsStore.ts`**
  - Add `presets`, `activePresetId`, `morphState: { from, to, t, durationMs }`, action `morphTo(toId, durationMs)`.
  - Add `lastPresetId` to persist payload; reject unknown ids on rehydrate.
- [ ] **Step 4: Preset gallery UI**
  - In `AudioEffectsPanel.tsx` add a horizontal preset chip strip with active highlight + tap-to-apply.
  - Add a single `Morph` slider (0..1) below the strip, plus `A/B` button that flashes the previous preset for 600ms.
- [ ] **Step 5: Verify**
  - Targeted vitest run for `effectsPresets` and `audioEffectsStore`.
  - Snapshot or DOM assertion that `Morph` slider updates `morphState.t`.
- [ ] **Step 6: Commit**
  - Message: `feat(audio-effects): preset gallery, morphing, and safe persistence`.

### Task 3: Replace Mock Blob Paths With Honest Capability States

- [ ] Task complete

**Dependencies:** None
**Parallelizable:** Yes (file ownership: `src/lib/audio/processingCapabilities.*`, `src/components/audio/FormatConverter.tsx`, `src/components/audio/CrossfadeMixer.tsx`)

- [ ] **Step 1: Capability detector**
  - Create `src/lib/audio/processingCapabilities.ts` with `detect(): { offlineAudioContext, webCodecs, ffmpegWasmLoaded }`.
  - Spec `processingCapabilities.test.ts` mocks `globalThis` to cover all four combinations.
- [ ] **Step 2: Replace `mockBlob` in `FormatConverter.tsx`**
  - At `FormatConverter.tsx:128` branch on `detect()`. If unsupported, mark task `status: "preview-only"`, never emit a Blob.
  - Add a banner `"Local conversion not available in this browser - export disabled"` with a Settings deeplink.
- [ ] **Step 3: Replace `mockBlob` in `CrossfadeMixer.tsx`**
  - At `CrossfadeMixer.tsx:365` same treatment. Real path uses `OfflineAudioContext` to render the crossfade region.
- [ ] **Step 4: Component test for capability branch**
  - `FormatConverter.test.tsx` renders with stubbed `detect()` and asserts the banner + disabled export.
- [ ] **Step 5: Verify**
  - `npm run test -- src/components/audio src/lib/audio/processingCapabilities` pass.
- [ ] **Step 6: Commit**
  - Message: `feat(audio): honest capability states replace mock-blob completion`.

### Task 4: Decouple Recommendation Inputs And Remove Dynamic Require

- [ ] Task complete

**Dependencies:** None
**Parallelizable:** Yes, but coordinate with Task 5 of Part B (both touch `recommendationStore`)

- [ ] **Step 1: Recommendation inputs helper**
  - Create `src/lib/recommendation/inputs.ts` exporting `collectRecommendationInputs(deps)` where `deps` is `{ getPlaylists, getEmotionTags, getHistory }`.
  - Pure function returning the shape `recommendationStore` needs.
- [ ] **Step 2: Update `recommendationStore.ts`**
  - Drop `import { usePlaylistStore } from "./playlistStore"` and `import { useEmotionStore }` (lines 11-12 today).
  - Accept inputs via `refresh(getInputs)` action; UI hook supplies bindings.
- [ ] **Step 3: Update `useDailyRecommendation.ts`**
  - Pass `() => collectRecommendationInputs({ getPlaylists: usePlaylistStore.getState, getEmotionTags: useEmotionStore.getState, getHistory: useHistoryStore.getState })`.
- [ ] **Step 4: Replace dynamic require in `AudioLiquidV8.ts:207`**
  - Inject `uiStore` snapshot through the existing effect-context object (preferred) or use a static top-level import gated by `typeof window !== "undefined"` at the call site.
  - Confirm no SSR hazard with `npm run build` partial step on this file.
- [ ] **Step 5: Verify**
  - `npm run test -- src/store/recommendationStore src/utils/recommendationLogic` pass.
  - Grep `Select-String -Path src -Recurse -Pattern 'require\\("@/store'` returns no hits.
- [ ] **Step 6: Commit**
  - Message: `refactor(coupling): drop store-to-store imports and dynamic require`.

### Task 5: Doc Reality Pass

- [ ] Task complete

**Dependencies:** Tasks 1-4 of Part A
**Parallelizable:** No (snapshot of completed work)

- [ ] **Step 1: ROADMAP reality**
  - Mark Phase 2 items 2.1, 2.2, 2.3, 2.6 (and any others now landed) with the matching commit short SHAs.
  - Add Phase 5 section header pointing to this plan.
- [ ] **Step 2: Plan index**
  - Create `docs/nbl/plans/INDEX.md` with rows: date, name, status (active/done/superseded), link.
- [ ] **Step 3: Changelog entries**
  - Append entries per shipped task above to `docs/nbl/CHANGELOG.md` under a new `## 2026-05-16` heading.
- [ ] **Step 4: Commit**
  - Message: `docs: align roadmap and plan index with shipped work`.

---

## Part B - Practicality And Design-Feel Polish For Existing Features

### Task 6: Queue+Search As Real Command Center (Design Pass)

- [ ] Task complete

**Dependencies:** Part A Task 1
**Parallelizable:** Yes with Part B Task 7-9 (different files)

Goal: search bar becomes a `/`-triggered command center matching the visual rhythm of the rest of the Glass UI.

- [ ] **Step 1: Command router with tests**
  - `src/lib/search/commandRouter.ts` parses `/play <q>`, `/queue <q>`, `/clear`, `/shuffle`, `/sleep <n>m`, plus plain text.
  - `commandRouter.test.ts` covers each branch and unknown commands fall back to `text-search`.
- [ ] **Step 2: Wire into `SearchPanel.tsx`**
  - Pressing `/` focuses the input and shows a chip strip of available commands.
  - Submit dispatches into existing stores (queue, audio engine sleep, etc.).
- [ ] **Step 3: Design polish**
  - Use existing Glass tokens (`var(--glass-fg-strong)`, OKLCH accent) for the chip strip.
  - Add a subtle shimmer (12px blur, 200ms) only on first focus, gated by reduced-motion.
  - Show last 5 commands as ghosted chips under the input; click re-runs them.
- [ ] **Step 4: A11y pass**
  - Chip strip is a `role=listbox` with arrow-key navigation.
  - Live region announces command execution result ("Queued 3 songs").
- [ ] **Step 5: Verify**
  - `npm run test -- src/lib/search` and `src/components/player/SearchPanel.test` (add if missing) pass.
- [ ] **Step 6: Commit**
  - Message: `feat(search): command-center router with chip strip and a11y`.

### Task 7: Lyrics Readability Presets + Karaoke Polish

- [ ] Task complete

**Dependencies:** None
**Parallelizable:** Yes

- [ ] **Step 1: Define three presets**
  - In `src/lib/lyrics/readabilityPresets.ts` (new) export `Cinema`, `Reading`, `Karaoke` with `{ fontSize, lineHeight, weight, contrast, glow }`.
  - Spec covers serialization and clamps.
- [ ] **Step 2: Wire to `LyricSettingsPanel.tsx`**
  - Add a segmented control above existing sliders. Selecting a preset writes through to the same store fields.
  - "Custom" appears when the user nudges any slider after picking a preset.
- [ ] **Step 3: Karaoke pass on `LyricVisualizer.tsx`**
  - Current word gets a 2px underline that animates with the audio progress; respects reduced-motion.
  - Keep current line vertically centered with 16/24/32px breathing room based on preset.
- [ ] **Step 4: Verify**
  - Targeted vitest run; snapshot of preset application.
- [ ] **Step 5: Commit**
  - Message: `feat(lyrics): readability presets and karaoke underline`.

### Task 8: Library Health + Smart Playlist Design Pass

- [ ] Task complete

**Dependencies:** None
**Parallelizable:** Yes

- [ ] **Step 1: `LibraryHealthPanel.tsx` empty / partial / healthy states**
  - Three explicit states with iconography (use existing `EmptyState` Glass component).
  - Show next-best-action button on each: "Scan folder", "Resolve 3 broken paths", "Run weekly check".
- [ ] **Step 2: `SmartPlaylistPanel.tsx` rule editor polish**
  - Replace free-text operator dropdowns with chip toggles (`includes`, `is`, `>`, `<`).
  - Live preview count badge under the editor (e.g. `42 songs match`).
  - Use a 320ms spring when the count changes; respect reduced-motion (no transition).
- [ ] **Step 3: Tests**
  - Pure helper for chip-state -> rule object lives in `src/lib/library/smartPlaylistRules.ts` with a spec.
- [ ] **Step 4: Verify**
  - `npm run test -- src/lib/library` and `src/store/libraryHealthStore`.
- [ ] **Step 5: Commit**
  - Message: `feat(library): health states and smart playlist chip editor`.

### Task 9: Stats / Achievements / Daily Recommendation Glow-Up

- [ ] Task complete

**Dependencies:** None
**Parallelizable:** Yes

- [ ] **Step 1: Streak ring + weekly spark in `StatsAchievementsPanel.tsx`**
  - Add a 64px streak ring using SVG `strokeDasharray`; color via OKLCH accent.
  - Add a 7-bar mini-spark using listening-insights data.
- [ ] **Step 2: "Why this" hover card in `DailyRecommendation.tsx`**
  - Render the existing `explanation` field from `recommendationStore` inside a Glass tooltip.
  - Tooltip is keyboard-reachable via the existing focus order; press `?` to toggle pinned.
- [ ] **Step 3: Verify**
  - DOM assertions for streak ring `aria-label` and tooltip open/close.
- [ ] **Step 4: Commit**
  - Message: `feat(widgets): streak ring, weekly spark, and explainable hover card`.

### Task 10: Visualization Performance Presets In Settings

- [ ] Task complete

**Dependencies:** None
**Parallelizable:** Yes

- [ ] **Step 1: Surface presets from `performanceV8Store` into `VisualSettings.tsx`**
  - Segmented control: `Cinematic`, `Balanced`, `Battery`.
  - Each preset writes `targetFps`, `effectBudget`, `particleCount`.
- [ ] **Step 2: Reduced-motion echo**
  - When `window.matchMedia("(prefers-reduced-motion: reduce)")` is true, show a pinned banner "Reduced motion is on - visuals will downgrade automatically".
- [ ] **Step 3: Verify**
  - Targeted vitest; snapshot the three preset writes.
- [ ] **Step 4: Commit**
  - Message: `feat(visual): performance preset segmented control and reduced-motion echo`.

---

## Part C - New Feature Additions (Practicality-First)

Three new features chosen because they reuse the existing data the app already collects (playback history, emotion tags, audio engine) and slot into the existing PanelOrchestrator + Glass widget pattern without disturbing V7.0 core views.

### Task 11: Smart Mix Sessions

A "session" is a temporary, AI-flavored queue built from the current song plus three knobs: `energy`, `familiarity`, `length`. It is throwaway by default; the user can save it as a real playlist.

- [ ] Task complete

**Dependencies:** Part A Task 4 (decoupled recommendation inputs)
**Parallelizable:** Yes after dependency

- [ ] **Step 1: Pure session builder**
  - `src/lib/mix/sessionBuilder.ts` exports `buildSession({ seedSong, history, library, knobs })`.
  - Algorithm: weighted draw from library by tag similarity to seed + energy proximity; familiarity knob blends recent-play frequency.
  - Spec `sessionBuilder.test.ts` asserts determinism with seeded RNG.
- [ ] **Step 2: `smartMixStore.ts`**
  - In-memory store (no persist) with `start(seedSong, knobs)`, `regenerate()`, `commitToPlaylist(name)`.
  - Spec covers all three actions.
- [ ] **Step 3: `SmartMixSessionCard.tsx` widget**
  - Placed on Home view widget rail (after `DailyRecommendation`).
  - Three slim knobs (range inputs) + `Start mix` button; Glass card with OKLCH accent.
  - Reuses existing Framer Motion spring presets; no new motion primitives.
- [ ] **Step 4: "Save as playlist" flow**
  - On commit, name auto-suggested as `Mix - {seed.title} - {date}`, editable.
  - Writes through existing `playlistStore.create`.
- [ ] **Step 5: Verify**
  - `npm run test -- src/lib/mix src/store/smartMixStore` pass.
- [ ] **Step 6: Commit**
  - Message: `feat(mix): smart mix sessions widget and builder`.

### Task 12: Listening Journal

Daily auto-rollup of plays + emotion + optional one-line note. Lives in a single panel that opens from a new Glass card; persists across sessions; never asks for network.

- [ ] Task complete

**Dependencies:** None
**Parallelizable:** Yes

- [ ] **Step 1: Rollup helper**
  - `src/lib/journal/listeningJournal.ts` exports `rollupDay(playEvents, emotionEvents): JournalDay`.
  - JournalDay shape: `{ date, topSongs: Song[], dominantMood: string, totalMinutes, note?: string }`.
  - Pure; spec covers empty days and mood ties.
- [ ] **Step 2: `listeningJournalStore.ts`**
  - Persisted under `journal-store-v1`; capped at 90 days rolling.
  - Actions: `appendNote(date, text)`, `recomputeForToday()`.
- [ ] **Step 3: `ListeningJournalCard.tsx` widget**
  - Week ribbon: 7 small Glass tiles with mood dot color (reuse emotion palette).
  - Click a tile to open `JournalDayPanel` (lazy panel) showing top songs + note editor.
- [ ] **Step 4: `JournalDayPanel.tsx` panel**
  - Glass panel registered in `PanelOrchestrator`; reuses existing close / a11y patterns.
  - Note editor is a single-line input; saves on blur with toast.
- [ ] **Step 5: Verify**
  - `npm run test -- src/lib/journal src/store/listeningJournalStore` pass.
  - DOM test: weekly ribbon renders 7 tiles with correct `aria-label`.
- [ ] **Step 6: Commit**
  - Message: `feat(journal): listening journal weekly ribbon and day panel`.

### Task 13: Now Playing Halo Skin Pack

A small set of three player skins that change only the mini-player Halo (glow ring, particles, ambient hue) without touching V7.0 core view layout. Skins plug into the existing `playerSkinsStore`.

- [ ] Task complete

**Dependencies:** None
**Parallelizable:** Yes

- [ ] **Step 1: Define three halo skins**
  - `src/lib/skins/halo/` with `aurora.ts`, `vinyl.ts`, `pulse.ts`. Each exports `{ id, name, paint(ctx, audio): void }`.
  - All paint on a separate Canvas overlay layer; no DOM reflow.
- [ ] **Step 2: Register in `playerSkinsStore`**
  - Add the three skins to the existing registry; persist `lastHaloId`.
  - Spec `playerSkinsStore.test.ts` (extend) covers registration and rehydration of an unknown id (fallback to `aurora`).
- [ ] **Step 3: UI surface in `PlayerSkinsPanel.tsx`**
  - Add a "Halo" segmented control beside the existing skin selector.
  - Live preview swatch (40x40 Canvas) for each option.
- [ ] **Step 4: Performance gate**
  - Halo painter respects `performanceV8Store.targetFps`; downgrades to static SVG at <30fps.
- [ ] **Step 5: Verify**
  - Targeted vitest run for skin registration.
  - Manual smoke: `npm run dev` (port 3025), open in-app browser, switch halos, confirm no console errors.
- [ ] **Step 6: Commit**
  - Message: `feat(skins): now playing halo pack with performance gate`.

---

## Part D - Final Verification And Release

### Task 14: Final Verification

- [ ] Task complete

**Dependencies:** All previous tasks
**Parallelizable:** No

- [ ] **Step 1: Full vitest**
  - `npm run test` must pass with exit 0; if any unrelated test is already red on `master`, document it in the PR but do not fix here.
- [ ] **Step 2: Type check + lint**
  - `npm run build` (will TS check with strict mode).
  - `npm run lint` should not regress the existing 19,790 line count.
- [ ] **Step 3: Manual smoke**
  - `npm run dev`; open `http://localhost:3025`; verify Home, Queue+Search, Audio Effects, Lyrics, Library Health, Stats, Smart Mix, Journal, Halo skin switch.
  - Use Browser plugin to open the local target and capture page title + console error count.
- [ ] **Step 4: Commit + PR draft**
  - Stage and commit final docs/changelog updates.
  - Open a draft PR titled `Experience polish and design upgrade (2026-05-16)` summarizing the 13 feature tasks with checklist mirroring this plan.

---

## Execution Strategy

- Suggested order for solo execution: Part A 1 -> 2 -> 3 -> 4 -> 5, then Part B 6 -> 7 -> 8 -> 9 -> 10, then Part C 11 -> 12 -> 13, then Part D 14.
- Suggested parallelization (subagent-driven):
  - Wave 1 (in parallel): A1, A2, A3, A4 (disjoint file ownership).
  - Wave 2 (after A4): A5, plus B6, B7, B8, B9, B10, C12, C13 in parallel.
  - Wave 3 (after A4): C11 (depends on A4).
  - Wave 4: D14.
- Each wave ends with `npm run test` on the touched slice before moving on.
- If a task balloons past one sitting, split its Step list into a follow-up plan rather than expanding scope mid-task.

## Risks And Mitigations

- **OfflineAudioContext export quality:** real conversion may not match user expectation. Mitigation: ship as `preview-only` first, expose explicit "Export" button only when capability detector returns `webCodecs=true`.
- **Persist key drift:** new stores (`journal-store-v1`) and extended `audioEffectsStore` must not collide with existing keys. Mitigation: prefix every key with a version suffix and add `version` field for future migrations.
- **Halo skins on low-end GPUs:** Canvas overlay can drop frames. Mitigation: performance gate in Task 13 Step 4 plus reduced-motion fallback to static SVG.
- **Recommendation decoupling regressions:** dropping direct imports may break consumers. Mitigation: add a `useDailyRecommendation` integration test before Task A4 Step 2.
- **Mojibake docs:** ROADMAP/PRODUCT files show legacy mojibake. Mitigation: only edit ASCII sections this round; do not attempt encoding rewrites in this plan.
