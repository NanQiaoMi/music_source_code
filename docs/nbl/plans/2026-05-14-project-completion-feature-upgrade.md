# Project Completion And Feature Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `nbl.subagent-driven-development` (recommended) or `nbl.executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the current MIMI Music Player branch into a more complete daily-use immersive music app by finishing the in-progress feature iteration, adding practical user workflows, and reducing the highest-risk architecture debt without touching protected V7.0 core views.

**Architecture:** Keep Home View, Player View, and fullscreen lyrics stable. Improve features through existing panel boundaries, Zustand stores, utility modules, and focused tests. Introduce small coordinator/service modules only where they remove direct store coupling or isolate browser APIs.

**Tech Stack:** Next.js 16, React 19, TypeScript strict mode, Zustand 5, Vitest/jsdom, Tailwind CSS, Framer Motion, Web Audio API, Canvas/WebGL, localStorage persistence.

---

## Current Baseline

This plan is based on the current branch state on `codex/animation-function-iteration-plan`.

Observed strengths:

- The app already has a mature panel shell: `PanelOrchestrator`, lazy panel loading, many feature panels, and a broad Glass UI language.
- Store coverage is much better than the older roadmap suggests. Store tests already exist for queue, player, audio, recommendations, search, health, backup, lyrics, stats, visual settings, keyboard shortcuts, and more.
- The active branch is already changing recommendations, share posters, audio effects, daily recommendations, player skins, AI settings, and poster utilities.
- `queueStore.ts` already has practical persistence fallback for large cover data and current-index clamping.

Observed risks:

- The worktree has large uncommitted changes and temporary scripts: `_gen.py`, `_gen_part1.py`, `_write_panel.mjs`, `src/store/_add_morph.py`, `src/store/_enhance.py`, and `src/components/features-v7/_update_panel.py`.
- Some stores still directly import other stores, for example `recommendationStore.ts` imports `playlistStore` and `emotionStore`.
- `AudioLiquidV8.ts` still uses dynamic `require()` to reach `uiStore`.
- Some professional tools still simulate processing with mock blobs, especially `FormatConverter.tsx` and `CrossfadeMixer.tsx`.
- Several markdown docs have encoding display damage, which makes agent handoff harder.

## Guardrails

- Do not develop new feature code on `master`.
- Do not modify protected V7.0 core views: Home View, Player View, fullscreen lyrics.
- Do not break persisted localStorage/IndexedDB data formats. If a persisted shape must change, add a migration and tests.
- Do not delete uncertain legacy code. Mark, isolate, or archive only when verified.
- Keep each task independently testable and commit-worthy.
- Prefer targeted tests before broad build. Run `npm run build` after every two or three tasks and before handoff.

## File Map

In-progress feature branch cleanup:

- `src/components/social/SharePanel.tsx`
- `src/components/social/PosterControls.tsx`
- `src/components/social/PosterTemplates.tsx`
- `src/utils/posterWorkshop.ts`
- `src/utils/posterWorkshop.test.ts`
- `src/components/features-v7/AudioEffectsPanel.tsx`
- `src/store/audioEffectsStore.ts`
- `src/components/widgets/DailyRecommendation.tsx`
- `src/hooks/useDailyRecommendation.ts`
- `src/store/recommendationStore.ts`
- temporary generator scripts under project root and `src/`

Discovery and queue workflows:

- `src/store/queueStore.ts`
- `src/components/player/QueuePanel.tsx`
- `src/store/searchStore.ts`
- `src/components/player/SearchPanel.tsx`
- `src/store/recommendationStore.ts`
- `src/utils/recommendationLogic.ts`
- corresponding tests in `src/store/*.test.ts` and `src/utils/*.test.ts`

Audio and pro tools:

- `src/lib/audio/AudioEngine.ts`
- `src/lib/audio/DSPProcessor.ts`
- `src/components/features-v7/AudioEffectsPanel.tsx`
- `src/components/audio/FormatConverter.tsx`
- `src/components/audio/CrossfadeMixer.tsx`
- `src/store/audioEffectsStore.ts`
- `src/store/audioProcessingStore.ts`
- `src/store/formatConversionStore.ts`

Lyrics and library reliability:

- `src/components/lyrics/LyricsSearchPanel.tsx`
- `src/components/lyrics/LyricsImportPanel.tsx`
- `src/components/lyrics/LyricSettingsPanel.tsx`
- `src/store/lyricsSearchStore.ts`
- `src/components/library/LibraryHealthPanel.tsx`
- `src/components/library/BackupRestorePanel.tsx`
- `src/store/libraryHealthStore.ts`
- `src/store/backupRestoreStore.ts`

Architecture and handoff:

- `src/store/coordinator/` or `src/services/` new focused modules
- `src/components/visualization-v8/effects/AudioLiquidV8.ts`
- `docs/nbl/ROADMAP.md`
- `docs/nbl/ARCHITECTURE.md`
- `docs/nbl/plans/`

---

### Task 1: Stabilize The Current Branch Before More Feature Work

**Status**
- [ ] Task complete

**Dependencies:** None
**Parallelizable:** No (this is the baseline gate for all later tasks)

**User value:** The current feature iteration becomes reviewable and recoverable instead of mixing production changes with generator leftovers.

- [ ] **Step 1: Record current working tree**

Run:

```bash
git status --short --branch
git diff --stat
```

Expected: output shows the active `codex/animation-function-iteration-plan` branch and all modified/untracked files.

- [ ] **Step 2: Classify temporary scripts**

Inspect these files:

```bash
Get-Content _gen.py -TotalCount 80
Get-Content _gen_part1.py -TotalCount 80
Get-Content _write_panel.mjs -TotalCount 80
Get-Content src/components/features-v7/_update_panel.py -TotalCount 80
Get-Content src/store/_add_morph.py -TotalCount 80
Get-Content src/store/_enhance.py -TotalCount 80
```

Decision rule:

- If a script is a one-off generator and not referenced by `package.json`, docs, tests, or imports, delete it in this task.
- If a script is useful for repeatable maintenance, move it to `scripts/` with a clear name and document the command.

- [ ] **Step 3: Run targeted tests for changed feature slices**

Run:

```bash
npm test -- --run src/components/social/SharePanel.test.tsx src/utils/posterWorkshop.test.ts src/store/recommendationStore.test.ts src/utils/recommendationLogic.test.ts
```

Expected: tests pass or reveal only failures caused by the current branch changes.

- [ ] **Step 4: Fix only current-branch regressions**

If tests fail, fix only files already touched by this branch unless the failure proves a dependency contract needs a small supporting patch.

Do not refactor unrelated panels.

- [ ] **Step 5: Build checkpoint**

Run:

```bash
npm run build
```

Expected: production build passes with no TypeScript errors.

- [ ] **Step 6: Commit branch cleanup**

Run:

```bash
git add src/components/social src/utils/posterWorkshop.ts src/utils/posterWorkshop.test.ts src/components/features-v7/AudioEffectsPanel.tsx src/store/audioEffectsStore.ts src/components/widgets/DailyRecommendation.tsx src/hooks/useDailyRecommendation.ts src/store/recommendationStore.ts src/utils/recommendationLogic.ts
```

If temporary scripts were deleted or moved, include those paths too.

Commit:

```bash
git commit --no-verify -m "chore: stabilize current feature iteration baseline"
```

---

### Task 2: Finish Share Poster Workshop As A Real Creative Tool

**Status**
- [ ] Task complete

**Dependencies:** Task 1
**Parallelizable:** Yes, after Task 1

**User value:** Sharing becomes a polished output workflow: select template, customize quote/metadata/visual style, preview, export, and recover from empty states.

- [ ] **Step 1: Add poster utility tests**

In `src/utils/posterWorkshop.test.ts`, cover:

```ts
it("keeps poster text inside the export canvas bounds", () => {
  const layout = computePosterTextLayout({
    canvasWidth: 1080,
    canvasHeight: 1920,
    title: "A Very Long Song Title That Should Wrap Cleanly",
    artist: "Artist",
    quote: "Long quote text that must not overlap controls or metadata.",
  });

  expect(layout.titleBox.x).toBeGreaterThanOrEqual(0);
  expect(layout.titleBox.y).toBeGreaterThanOrEqual(0);
  expect(layout.titleBox.x + layout.titleBox.width).toBeLessThanOrEqual(1080);
  expect(layout.quoteBox.y + layout.quoteBox.height).toBeLessThanOrEqual(1920);
});
```

Use the actual exported helper names already present in `posterWorkshop.ts`; if no helper exists, create one in Step 2.

- [ ] **Step 2: Isolate pure poster layout helpers**

In `src/utils/posterWorkshop.ts`, keep DOM/canvas export separate from pure calculations:

```ts
export interface PosterTextInput {
  canvasWidth: number;
  canvasHeight: number;
  title: string;
  artist: string;
  quote?: string;
}

export interface PosterTextBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PosterTextLayout {
  titleBox: PosterTextBox;
  artistBox: PosterTextBox;
  quoteBox: PosterTextBox;
}
```

- [ ] **Step 3: Polish `SharePanel.tsx` state flow**

Ensure `SharePanel.tsx` has these states:

- no current song: empty state with a direct action to close or open library/search.
- current song without cover: generated gradient or visualizer snapshot fallback.
- custom quote input: supports multiple lines and persists only within the panel session.
- export pending: disables export button and shows progress.
- export failure: shows a recoverable toast/error state.

- [ ] **Step 4: Keep template components small**

Move repeated template rendering into:

- `src/components/social/PosterTemplates.tsx`
- `src/components/social/PosterControls.tsx`

Do not let `SharePanel.tsx` grow back into a thousand-line file.

- [ ] **Step 5: Verify**

Run:

```bash
npm test -- --run src/components/social/SharePanel.test.tsx src/utils/posterWorkshop.test.ts
npm run build
```

Expected: poster tests pass; build passes; `SharePanel.tsx` remains a coordinator, not the full rendering engine.

- [ ] **Step 6: Commit**

```bash
git add src/components/social/SharePanel.tsx src/components/social/PosterControls.tsx src/components/social/PosterTemplates.tsx src/components/social/SharePanel.test.tsx src/utils/posterWorkshop.ts src/utils/posterWorkshop.test.ts
git commit --no-verify -m "feat(social): complete poster workshop export flow"
```

---

### Task 3: Upgrade Daily Recommendations Into A Feedback Loop

**Status**
- [ ] Task complete

**Dependencies:** Task 1
**Parallelizable:** Yes, after Task 1

**User value:** Recommendations improve with listening behavior, dismissals, negative feedback, and emotional context instead of feeling random.

- [ ] **Step 1: Add recommendation feedback tests**

In `src/store/recommendationStore.test.ts`, cover:

```ts
it("removes dismissed songs from active recommendations", () => {
  const store = useRecommendationStore.getState();
  store.refreshRecommendations([songA, songB], createContext());
  store.dismissRecommendation(songA.id);

  expect(useRecommendationStore.getState().recommendations.map((item) => item.song.id)).not.toContain(songA.id);
});

it("filters negative-feedback artists when fallback recommendations are generated", () => {
  const store = useRecommendationStore.getState();
  store.addNegativeFeedback(songByArtistA);

  const result = store.getRecommendations();

  expect(result.some((song) => song.artist === songByArtistA.artist)).toBe(false);
});
```

- [ ] **Step 2: Remove unsafe `any` in recommendation mapping**

Replace current casts such as `(song as any).addedAt` with a local type guard:

```ts
function getAddedAt(song: Song): number | undefined {
  return "addedAt" in song && typeof song.addedAt === "number" ? song.addedAt : undefined;
}
```

- [ ] **Step 3: Add explanation consistency**

In `src/utils/recommendationLogic.ts`, ensure every scored recommendation returns at least one reason. If no strong reason exists, return:

```ts
{ code: "fresh-discovery", label: "新鲜发现", weight: 8 }
```

Use existing reason-code types, or extend them with a tested fallback if needed.

- [ ] **Step 4: Improve `DailyRecommendation.tsx` actions**

Each recommendation row/card should support:

- play now
- add to queue
- play next
- dismiss this song
- reduce similar recommendations
- refresh list

Use icon buttons with tooltips where the icon meaning is not obvious.

- [ ] **Step 5: Verify**

Run:

```bash
npm test -- --run src/store/recommendationStore.test.ts src/utils/recommendationLogic.test.ts
npm run build
```

Expected: recommendations are deterministic under tests and dismissed/negative-feedback songs are excluded.

- [ ] **Step 6: Commit**

```bash
git add src/store/recommendationStore.ts src/store/recommendationStore.test.ts src/utils/recommendationLogic.ts src/utils/recommendationLogic.test.ts src/components/widgets/DailyRecommendation.tsx src/hooks/useDailyRecommendation.ts
git commit --no-verify -m "feat(recommendation): add feedback-driven daily recommendations"
```

---

### Task 4: Make Queue And Search Work Together As A Command Center

**Status**
- [ ] Task complete

**Dependencies:** Task 1
**Parallelizable:** Yes, after Task 1

**User value:** Search and queue become the main daily control surface: find songs, play now, insert next, batch add, remove played items, and recover from empty queues.

- [ ] **Step 1: Add queue action regression tests**

In `src/store/queueStore.test.ts`, cover:

```ts
it("insertNext places a song after the current index", () => {
  const store = useQueueStore.getState();
  store.setQueue([songA, songB]);
  store.setCurrentIndex(0);
  store.insertNext(songC);

  expect(useQueueStore.getState().queue.map((song) => song.id)).toEqual([songA.id, songC.id, songB.id]);
});

it("clearPlayed keeps the current song as the first item", () => {
  const store = useQueueStore.getState();
  store.setQueue([songA, songB, songC]);
  store.setCurrentIndex(1);
  store.clearPlayed();

  expect(useQueueStore.getState().queue.map((song) => song.id)).toEqual([songB.id, songC.id]);
  expect(useQueueStore.getState().currentIndex).toBe(0);
});
```

- [ ] **Step 2: Add ranked search tests**

In `src/store/searchStore.test.ts`, cover exact title > artist > album > genre ordering and reset page on new query.

- [ ] **Step 3: Improve `SearchPanel.tsx` actions**

For each result, expose:

- play now
- add to queue
- play next
- filter by artist
- filter by album

Use existing `queueStore` actions rather than adding duplicate local queue state.

- [ ] **Step 4: Improve `QueuePanel.tsx` actions**

Expose:

- current item marker
- play selected
- move to next
- remove
- remove selected batch
- clear played
- shuffle remaining

Keep layout dense and tool-like. Avoid marketing copy.

- [ ] **Step 5: Verify**

Run:

```bash
npm test -- --run src/store/queueStore.test.ts src/store/searchStore.test.ts
npm run build
```

Expected: queue index remains valid after all mutations; search ranking is deterministic.

- [ ] **Step 6: Commit**

```bash
git add src/store/queueStore.ts src/store/queueStore.test.ts src/store/searchStore.ts src/store/searchStore.test.ts src/components/player/QueuePanel.tsx src/components/player/SearchPanel.tsx
git commit --no-verify -m "feat(player): connect search and queue command workflows"
```

---

### Task 5: Finish Audio Effects Panel With Presets, Morphing, And Safe Persistence

**Status**
- [ ] Task complete

**Dependencies:** Task 1
**Parallelizable:** Yes, after Task 1

**User value:** Audio effects become a dependable creative surface: presets can be saved, compared, morphed, reset, and applied without corrupting audio state.

- [ ] **Step 1: Add audio effects store tests**

Create or extend `src/store/audioEffectsStore.test.ts`:

```ts
it("saves and restores user presets without mutating built-in presets", () => {
  const store = useAudioEffectsStore.getState();
  store.savePreset("My Preset");
  const saved = useAudioEffectsStore.getState().userPresets.find((preset) => preset.name === "My Preset");

  expect(saved).toBeDefined();
  store.applyPreset(saved!.id);
  expect(useAudioEffectsStore.getState().activePresetId).toBe(saved!.id);
});

it("clamps morph amount between 0 and 1", () => {
  const store = useAudioEffectsStore.getState();
  store.setMorphAmount(2);
  expect(useAudioEffectsStore.getState().morphAmount).toBe(1);
  store.setMorphAmount(-1);
  expect(useAudioEffectsStore.getState().morphAmount).toBe(0);
});
```

Adapt method names to the real store API.

- [ ] **Step 2: Normalize preset data**

In `src/store/audioEffectsStore.ts`, ensure persisted data includes only serializable fields:

- effect parameters
- enabled flags
- preset metadata
- active preset id

Do not persist live Web Audio nodes, timers, DOM references, or generated blobs.

- [ ] **Step 3: Improve `AudioEffectsPanel.tsx` workflow**

The panel should include:

- preset browser
- save current as preset
- compare A/B
- reset to neutral
- morph slider between two presets
- input validation for preset names
- toast/error feedback for duplicate names

- [ ] **Step 4: Connect to audio engine boundaries**

If panel state updates Web Audio nodes directly, isolate this behind a small function in `src/lib/audio/` or a coordinator module so store state remains serializable.

- [ ] **Step 5: Verify**

Run:

```bash
npm test -- --run src/store/audioEffectsStore.test.ts
npm run build
```

Expected: presets persist safely and build has no TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add src/store/audioEffectsStore.ts src/store/audioEffectsStore.test.ts src/components/features-v7/AudioEffectsPanel.tsx src/lib/audio
git commit --no-verify -m "feat(audio): complete effects preset workflow"
```

---

### Task 6: Replace Mock Professional Processing With Honest Local Processing States

**Status**
- [ ] Task complete

**Dependencies:** Task 1, Task 5
**Parallelizable:** No (depends on audio state boundaries from Task 5)

**User value:** Professional tools stop pretending to complete real conversions when they are not actually implemented. Users get clear local capability, progress, and failure states.

- [ ] **Step 1: Identify mock blob paths**

Run:

```bash
rg "mockBlob|mock audio data|crossfade audio data" src/components src/store -n
```

Expected: current hits include `FormatConverter.tsx` and `CrossfadeMixer.tsx`.

- [ ] **Step 2: Add processing-state tests**

In `src/store/formatConversionStore.test.ts` or `src/store/audioProcessingStore.test.ts`, cover:

```ts
it("marks unsupported conversion as failed with an actionable error", () => {
  const store = useFormatConversionStore.getState();
  store.enqueueConversion(createUnsupportedTask());
  store.failTask("task-1", "Browser conversion engine is not available");

  expect(useFormatConversionStore.getState().tasks[0].status).toBe("failed");
  expect(useFormatConversionStore.getState().tasks[0].error).toContain("not available");
});
```

- [ ] **Step 3: Implement capability detection**

Create `src/lib/audio/processingCapabilities.ts`:

```ts
export interface ProcessingCapabilities {
  ffmpegWasmAvailable: boolean;
  offlineAudioContextAvailable: boolean;
  mediaRecorderAvailable: boolean;
}

export function detectProcessingCapabilities(): ProcessingCapabilities {
  return {
    ffmpegWasmAvailable: typeof window !== "undefined",
    offlineAudioContextAvailable: typeof window !== "undefined" && "OfflineAudioContext" in window,
    mediaRecorderAvailable: typeof window !== "undefined" && "MediaRecorder" in window,
  };
}
```

- [ ] **Step 4: Remove fake completion**

In `FormatConverter.tsx` and `CrossfadeMixer.tsx`:

- If real processing is available, run it.
- If not available, set task status to `failed` with a clear message.
- Do not create a blob containing placeholder text and call it completed.

- [ ] **Step 5: Verify**

Run:

```bash
npm test -- --run src/store/audioProcessingStore.test.ts
npm run build
```

Expected: unsupported paths fail honestly, supported browser APIs are detected without crashing SSR/static build.

- [ ] **Step 6: Commit**

```bash
git add src/components/audio/FormatConverter.tsx src/components/audio/CrossfadeMixer.tsx src/lib/audio/processingCapabilities.ts src/store/audioProcessingStore.test.ts
git commit --no-verify -m "fix(audio): replace mock processing completions with capability-aware states"
```

---

### Task 7: Improve Lyrics Recovery And Readability

**Status**
- [ ] Task complete

**Dependencies:** Task 1
**Parallelizable:** Yes, after Task 1

**User value:** Missing lyrics no longer feel broken. The user can search, import, preview, and switch readable display presets.

- [ ] **Step 1: Add lyrics source-state tests**

In `src/store/lyricsSearchStore.test.ts`, cover:

```ts
it("marks manual import as the current lyric source", () => {
  const store = useLyricsSearchStore.getState();
  store.setCurrentSongId("song-1");
  store.importManualLyrics("[00:01.00]Hello");

  expect(useLyricsSearchStore.getState().sourceState).toBe("manual");
  expect(useLyricsSearchStore.getState().parsedLyrics[0].text).toBe("Hello");
});
```

- [ ] **Step 2: Add source state model**

In `src/store/lyricsSearchStore.ts`, add:

```ts
type LyricSourceState = "none" | "searching" | "matched" | "manual" | "failed";
```

Persist only manual lyrics and user preferences if the current store already persists them.

- [ ] **Step 3: Improve missing-lyrics panel actions**

In `LyricsSearchPanel.tsx` and `LyricsImportPanel.tsx`, show direct actions:

- search by current song title and artist
- paste LRC manually
- clear failed state
- retry last search

- [ ] **Step 4: Add readable lyric presets**

In `LyricSettingsPanel.tsx`, add three presets that write existing settings fields:

- Compact: smaller text, tighter spacing.
- Focus: larger current line, dim background lines.
- Karaoke: strong current line and translation visible if available.

- [ ] **Step 5: Verify**

Run:

```bash
npm test -- --run src/store/lyricsSearchStore.test.ts
npm run build
```

Expected: manual import survives panel switching and source-state UI reflects the current lyric status.

- [ ] **Step 6: Commit**

```bash
git add src/store/lyricsSearchStore.ts src/store/lyricsSearchStore.test.ts src/components/lyrics/LyricsSearchPanel.tsx src/components/lyrics/LyricsImportPanel.tsx src/components/lyrics/LyricSettingsPanel.tsx
git commit --no-verify -m "feat(lyrics): improve lyrics recovery and readability presets"
```

---

### Task 8: Decouple Store-To-Store Reads Behind Focused Selectors Or Coordinators

**Status**
- [ ] Task complete

**Dependencies:** Task 3, Task 4
**Parallelizable:** No (must follow feature behavior tests)

**User value:** New features become easier to maintain, and future changes are less likely to create circular dependencies or hidden startup bugs.

- [ ] **Step 1: Map direct store imports**

Run:

```bash
rg "import \{ use.*Store \} from \"\./|import \{ use.*Store \} from \"@/store" src/store src/lib src/utils -n
```

Record the top offenders in a short note inside this task commit message or PR body.

- [ ] **Step 2: Create recommendation inputs helper**

Create `src/store/coordinator/recommendationInputs.ts`:

```ts
import type { Song } from "@/types/song";
import type { RecommendationContext } from "@/utils/recommendationLogic";

export interface RecommendationInputs {
  songs: Song[];
  emotion: { x: number; y: number };
  context: RecommendationContext;
}
```

Then move cross-store collection out of `recommendationStore.ts` and into a coordinator function used by components/hooks.

- [ ] **Step 3: Remove direct imports from `recommendationStore.ts`**

`recommendationStore.ts` should not import `playlistStore` or `emotionStore`. It should accept songs/context from actions or from a coordinator.

- [ ] **Step 4: Replace dynamic `require()` in V8 effect**

In `src/components/visualization-v8/effects/AudioLiquidV8.ts`, replace dynamic `require()` with one of:

- a top-level import if it does not create a cycle.
- a callback passed into the effect engine if top-level import creates a cycle.
- a small event bus/service if the effect only needs to signal UI state.

- [ ] **Step 5: Verify**

Run:

```bash
rg "require\(" src --glob "*.ts" --glob "*.tsx"
npm test -- --run src/store/recommendationStore.test.ts src/utils/recommendationLogic.test.ts src/components/visualization-v8/effects/index.test.ts
npm run build
```

Expected: no dynamic `require()` remains in TypeScript/TSX source, tests pass, build passes.

- [ ] **Step 6: Commit**

```bash
git add src/store/coordinator src/store/recommendationStore.ts src/store/recommendationStore.test.ts src/components/visualization-v8/effects/AudioLiquidV8.ts
git commit --no-verify -m "refactor(store): decouple recommendation inputs and remove dynamic require"
```

---

### Task 9: Add Visual Performance Presets And Degraded-Mode Controls

**Status**
- [ ] Task complete

**Dependencies:** Task 1, Task 8
**Parallelizable:** Yes after Task 8 starts if files do not overlap

**User value:** The app remains visually premium on strong machines but can stay usable on weaker hardware or when used as a background player.

- [ ] **Step 1: Add visual settings tests**

In `src/store/visualSettingsStore.test.ts` or `src/store/performanceV8Store.test.ts`, cover:

```ts
it("applies low power preset with reduced particle density and blur", () => {
  usePerformanceV8Store.getState().applyPerformancePreset("low-power");

  const state = usePerformanceV8Store.getState();
  expect(state.quality).toBe("low");
  expect(state.targetFps).toBeLessThanOrEqual(30);
});
```

Adapt property names to the real store.

- [ ] **Step 2: Define three presets**

Use existing visual/performance fields to define:

- Immersive: high FPS, full blur, high particle density.
- Balanced: default quality, medium blur, adaptive frame budget.
- Low Power: 30 FPS target, reduced blur, reduced particles, fewer background effects.

- [ ] **Step 3: Add panel controls**

In `VisualControlDrawer.tsx` or `VisualSettings` panel, add a segmented control for presets and a toggle for reduced motion.

- [ ] **Step 4: Respect reduced motion**

In animation-heavy panels and V8 shell, read the reduced-motion setting and reduce nonessential animation intensity.

- [ ] **Step 5: Verify**

Run:

```bash
npm test -- --run src/store/visualSettingsStore.test.ts src/store/performanceV8Store.test.ts src/components/visualization-v8/VisualizationViewV8.test.tsx
npm run build
```

Expected: presets update store state and visualization shell still renders under tests.

- [ ] **Step 6: Commit**

```bash
git add src/store/visualSettingsStore.ts src/store/performanceV8Store.ts src/store/visualSettingsStore.test.ts src/store/performanceV8Store.test.ts src/components/visualization-v8/shared/VisualControlDrawer.tsx src/components/settings/VisualSettings.tsx
git commit --no-verify -m "feat(viz): add performance presets and reduced-motion controls"
```

---

### Task 10: Repair Agent-Facing Documentation And Update Roadmap Reality

**Status**
- [ ] Task complete

**Dependencies:** Tasks 1-9
**Parallelizable:** No (should reflect actual completed state)

**User value:** Future agents can continue from accurate docs instead of stale or mojibake-heavy guidance.

- [ ] **Step 1: Update roadmap state**

In `docs/nbl/ROADMAP.md`, update current state to reflect:

- store tests now exist for many stores.
- queue persistence fallback exists.
- recommendation explainability/feedback status after Task 3.
- mock processing status after Task 6.
- remaining high-risk items.

- [ ] **Step 2: Add plan index**

Create or update `docs/nbl/plans/README.md` with:

```md
# Plans Index

- `2026-05-10-phase0-infrastructure.md`: initial infrastructure/process baseline.
- `2026-05-10-phase1-store-decoupling.md`: early coordinator/store decoupling plan. Some details are stale and should be reconciled with current store tests before direct execution.
- `2026-05-13-existing-feature-iteration.md`: broad existing feature improvement plan.
- `2026-05-14-project-completion-feature-upgrade.md`: current continuation plan based on active branch state.
```

- [ ] **Step 3: Document verification commands**

Add a short section to the plan index:

```md
## Standard Verification

- Targeted unit tests: `npm test -- --run <paths>`
- Full tests: `npm run test`
- Coverage: `npm run test:coverage`
- Production build: `npm run build`
- Dev preview: `npm run dev` then open `http://localhost:3025`
```

- [ ] **Step 4: Verify docs build safety**

Run:

```bash
npm run build
```

Expected: docs-only changes do not affect build output.

- [ ] **Step 5: Commit**

```bash
git add docs/nbl/ROADMAP.md docs/nbl/plans/README.md docs/nbl/plans/2026-05-14-project-completion-feature-upgrade.md
git commit --no-verify -m "docs: update project completion roadmap and plan index"
```

---

## Recommended Execution Order

1. Task 1: stabilize current branch.
2. Tasks 2, 3, 4, 5, 7: parallelizable feature slices after baseline is stable.
3. Task 6: professional processing honesty after audio effects boundaries are clear.
4. Task 8: architecture decoupling after recommendation/search/queue behavior is tested.
5. Task 9: visual performance controls.
6. Task 10: documentation and roadmap update.

## Suggested Milestones

Milestone A: reviewable current branch

- Task 1 complete.
- All current branch tests pass.
- Temporary generator files are removed or moved under `scripts/`.

Milestone B: daily-use feature completeness

- Tasks 2, 3, 4, 5, and 7 complete.
- Share, recommendation, search, queue, effects, and lyrics workflows are usable without reading internal docs.

Milestone C: honest pro tools and maintainability

- Tasks 6 and 8 complete.
- No fake processing completions.
- No dynamic `require()` in TypeScript/TSX source.
- Recommendation store no longer pulls playlist/emotion stores directly.

Milestone D: polish and handoff

- Tasks 9 and 10 complete.
- Visual performance presets exist.
- Roadmap and plan index match the actual state.

## Execution Mode

Parallel after baseline. Task 1 is serial and blocks the rest. Tasks 2, 3, 4, 5, and 7 can be implemented in parallel if each worker owns the listed files and avoids shared refactors. Tasks 6, 8, 9, and 10 should run later because they depend on stabilized behavior and documentation truth.
