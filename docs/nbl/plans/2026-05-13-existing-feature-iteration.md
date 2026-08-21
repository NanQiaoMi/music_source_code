# Existing Feature Iteration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the existing MIMI Music Player features more useful, reliable, and practical without redesigning the protected V7.0 core views.

**Architecture:** Iterate around existing Zustand stores, panel components, and utility modules. Prefer small functional improvements, persisted user preferences, data-backed UI states, focused tests, and graceful degradation for local-only music usage.

**Tech Stack:** Next.js 16, React 19, TypeScript strict mode, Zustand 5, Vitest/jsdom, Framer Motion, Canvas/WebGL visualization, Web Audio API.

---

## Scope And Guardrails

This plan updates existing functionality only. It does not replace Home View, Player View, fullscreen lyrics, localStorage schema, or IndexedDB data formats.

Primary outcomes:

- Playback queue is easier to control and harder to corrupt.
- Search, history, recommendations, and stats become practical daily-use tools.
- Lyrics, visualization, health check, and backup features expose clearer workflows.
- Existing panels share predictable loading, empty, error, and recovery states.
- Every slice has a targeted test command and can be committed independently.

Project constraints:

- Work from a non-master branch.
- Preserve existing persisted state keys unless a migration is explicitly included.
- Run targeted tests before each task commit.
- Run `npm run build` after every two to three tasks or before handoff.
- If pre-commit lint blocks on unrelated legacy rules, use `git commit --no-verify` only after targeted tests and build pass.

## File Map

Playback and queue:

- `src/store/audioStore.ts`: playback commands and cross-store current song sync.
- `src/store/queueStore.ts`: queue operations, play-through mode, persistence fallback.
- `src/components/player/QueuePanel.tsx`: queue UI, actions, current item visibility.
- `src/store/audioStore.test.ts`: playback sync regression tests.
- `src/store/queueStore.test.ts`: queue mutation and persistence tests.

Search and discovery:

- `src/store/searchStore.ts`: query, filters, paging, recent searches, history.
- `src/components/player/SearchPanel.tsx`: search UI and result actions.
- `src/utils/recommendationLogic.ts`: recommendation scoring.
- `src/store/recommendationStore.ts`: recommendation state and generation.
- `src/store/searchStore.test.ts`: search behavior tests.
- `src/utils/recommendationLogic.test.ts`: scoring tests.

Listening insights and stats:

- `src/utils/listeningInsights.ts`: reusable insight calculations.
- `src/components/library/ListeningHistory.tsx`: history rankings and summary.
- `src/components/widgets/StatsAchievementsPanel.tsx`: dashboard and achievement actions.
- `src/components/widgets/AuditoryGene.tsx`: practical listening profile fallback.
- `src/store/statsAchievementsStore.ts`: play records, stats, achievement progress.
- `src/utils/listeningInsights.test.ts`: insight unit tests.
- `src/store/statsAchievementsStore.test.ts`: stats store tests.

Lyrics:

- `src/components/lyrics/LyricVisualizer.tsx`: synced lyric display.
- `src/components/lyrics/LyricsSearchPanel.tsx`: search/import workflow.
- `src/components/lyrics/LyricsImportPanel.tsx`: manual import.
- `src/components/lyrics/LyricSettingsPanel.tsx`: readable lyric preferences.
- `src/store/lyricsSearchStore.ts`: search results and parsed lyrics.
- `src/store/lyricSettingsStore.ts`: persisted lyric display settings.

Visualization and animation:

- `src/components/visualization-v8/VisualizationViewV8.tsx`: fullscreen visualization shell.
- `src/components/visualization-v8/engines/RenderEngineManager.tsx`: Canvas/WebGL render loop.
- `src/components/visualization-v8/shared/VisualControlDrawer.tsx`: effect controls.
- `src/store/visualizationV8Store.ts`: active effect and params.
- `src/store/visualSettingsStore.ts`: visual preferences and performance settings.
- `src/store/performanceV8Store.ts`: FPS and quality config.

Library maintenance and backup:

- `src/components/library/LibraryHealthPanel.tsx`: health report UI.
- `src/components/library/BackupRestorePanel.tsx`: backup/restore workflow.
- `src/store/libraryHealthStore.ts`: library scan state.
- `src/store/healthCheckStore.ts`: health issue model.
- `src/store/backupRestoreStore.ts`: import/export state.
- `src/store/libraryHealthStore.test.ts`, `src/store/backupRestoreStore.test.ts`: regression tests.

Shared interaction polish:

- `src/store/uiStore.ts`: panel orchestration and toast actions.
- `src/components/layout/PanelOrchestrator.tsx`: panel rendering.
- `src/components/shared/Glass/EmptyState.tsx`: empty state.
- `src/components/shared/Glass/LoadingSkeleton.tsx`: loading state.
- `src/components/shared/Glass/GlassButton.tsx`: consistent actions.
- `src/components/settings/KeyboardShortcutsSettings.tsx`: configurable shortcuts.
- `src/components/settings/SettingsPanel.tsx`: settings grouping.

---

## Task 1: Stabilize Playback Queue Controls

**User value:** The user can understand what will play next, recover from large queues, and choose repeat/shuffle/play-through behavior without surprises.

**Files:**

- Modify: `src/store/queueStore.ts`
- Modify: `src/store/audioStore.ts`
- Modify: `src/components/player/QueuePanel.tsx`
- Test: `src/store/queueStore.test.ts`
- Test: `src/store/audioStore.test.ts`

- [ ] **Step 1: Add queue invariant tests**

Add tests covering these exact behaviors:

```ts
it("keeps currentIndex within queue bounds after removing the current song", () => {
  const songs = [createMockSong("a"), createMockSong("b"), createMockSong("c")];
  const store = useQueueStore.getState();

  store.setQueue(songs);
  store.setCurrentIndex(2);
  store.removeFromQueue("c");

  expect(useQueueStore.getState().currentIndex).toBe(1);
  expect(useQueueStore.getState().queue.map((song) => song.id)).toEqual(["a", "b"]);
});

it("persists a minimized queue when cover data is too large", () => {
  const song = { ...createMockSong("large"), cover: `data:image/png;base64,${"x".repeat(2000)}` };

  useQueueStore.getState().setQueue([song]);

  const stored = JSON.parse(localStorage.getItem("queue-store") || "{}");
  expect(stored.state.queue[0].cover).toBe("");
});
```

Run: `npm test -- --run src/store/queueStore.test.ts src/store/audioStore.test.ts`

Expected: tests fail only where the missing behavior has not been implemented.

- [ ] **Step 2: Implement queue bounds and explicit play-through state**

Update `removeFromQueue`, `clearQueue`, `setCurrentIndex`, and persistence fallback so that:

- `currentIndex` never points past the last item.
- `playThroughMode` remains persisted.
- large cover data is stripped before localStorage write.
- current song is cleared when the queue becomes empty in play-through mode.

- [ ] **Step 3: Improve QueuePanel actions**

In `src/components/player/QueuePanel.tsx`, add:

- a visible current item marker.
- `Play next`, `Remove`, and `Clear played` actions.
- an empty state using `src/components/shared/Glass/EmptyState.tsx`.
- disabled states for actions that cannot run.

- [ ] **Step 4: Verify**

Run:

```bash
npm test -- --run src/store/queueStore.test.ts src/store/audioStore.test.ts
npm run build
```

Expected:

- queue tests pass.
- build passes.
- no queue action creates an out-of-range index.

- [ ] **Step 5: Commit**

```bash
git add src/store/queueStore.ts src/store/audioStore.ts src/components/player/QueuePanel.tsx src/store/queueStore.test.ts src/store/audioStore.test.ts
git commit --no-verify -m "feat: stabilize playback queue controls"
```

---

## Task 2: Make Search A Practical Library Command Center

**User value:** Search becomes useful for finding, filtering, and acting on songs, not just displaying a list.

**Files:**

- Modify: `src/store/searchStore.ts`
- Modify: `src/components/player/SearchPanel.tsx`
- Test: `src/store/searchStore.test.ts`

- [ ] **Step 1: Add search ranking tests**

Add tests:

```ts
it("ranks exact title matches before artist and album matches", () => {
  const songs = [
    createSong({ id: "artist", title: "Other", artist: "Ocean", album: "Blue" }),
    createSong({ id: "title", title: "Ocean", artist: "Someone", album: "Blue" }),
    createSong({ id: "album", title: "Track", artist: "Someone", album: "Ocean" }),
  ];

  useSearchStore.getState().setQuery("Ocean");
  useSearchStore.getState().search(songs);

  expect(useSearchStore.getState().results.map((song) => song.id)).toEqual([
    "title",
    "artist",
    "album",
  ]);
});
```

Run: `npm test -- --run src/store/searchStore.test.ts`

- [ ] **Step 2: Implement ranked search**

In `src/store/searchStore.ts`, compute a numeric score:

- exact title match: `100`
- title starts with query: `80`
- title contains query: `60`
- artist exact or starts with query: `50`
- album contains query: `30`
- genre, if present on the song object: `20`

Sort by score descending, then title ascending.

- [ ] **Step 3: Add actionable result commands**

In `src/components/player/SearchPanel.tsx`, expose actions on each result:

- play now
- add to queue
- play next
- open album/artist filter by setting search type

Use icon buttons from `lucide-react` and existing button styling. Do not add a landing page or explanatory card.

- [ ] **Step 4: Add practical filters**

Add UI for:

- duration range: short, medium, long
- source: local, remote, all if the song source exists
- recently searched chips

Persist only recent searches, not raw results.

- [ ] **Step 5: Verify**

Run:

```bash
npm test -- --run src/store/searchStore.test.ts
npm run build
```

Expected:

- ranked order is deterministic.
- clearing search resets page to `1`.
- result actions do not mutate search history unexpectedly.

- [ ] **Step 6: Commit**

```bash
git add src/store/searchStore.ts src/components/player/SearchPanel.tsx src/store/searchStore.test.ts
git commit --no-verify -m "feat: improve library search workflow"
```

---

## Task 3: Turn Recommendations Into A Real Daily Workflow

**User value:** Recommendations explain why a song is suggested and provide immediate actions.

**Files:**

- Modify: `src/utils/recommendationLogic.ts`
- Modify: `src/store/recommendationStore.ts`
- Modify: `src/components/widgets/DailyRecommendation.tsx`
- Test: `src/utils/recommendationLogic.test.ts`
- Test: `src/store/recommendationStore.test.ts`

- [ ] **Step 1: Add reason-code tests**

Add tests for recommendation reasons:

```ts
it("adds reason codes for matching artist, genre, and replay pattern", () => {
  const result = scoreSongForRecommendation(candidateSong, {
    recentSongs: [recentSong],
    topArtists: ["Candidate Artist"],
    topGenres: ["Electronic"],
    skippedSongIds: new Set(),
  });

  expect(result.reasons).toEqual(
    expect.arrayContaining(["artist-match", "genre-match", "replay-friendly"])
  );
});
```

- [ ] **Step 2: Return explainable recommendation objects**

Use this shape from recommendation logic:

```ts
export interface RecommendationReason {
  code: "artist-match" | "genre-match" | "fresh-discovery" | "replay-friendly" | "skip-avoidance";
  label: string;
  weight: number;
}

export interface ScoredRecommendation {
  song: Song;
  score: number;
  reasons: RecommendationReason[];
}
```

Keep `Song` unchanged.

- [ ] **Step 3: Update recommendation store**

Store:

- `recommendations: ScoredRecommendation[]`
- `lastGeneratedAt: number`
- `dismissedSongIds: string[]`

Actions:

- `dismissRecommendation(songId)`
- `refreshRecommendations(songs, context)`
- `clearDismissedRecommendations()`

- [ ] **Step 4: Update DailyRecommendation UI**

Show:

- top reason chips.
- play now.
- add to queue.
- dismiss.
- refresh.

Empty state: "先导入音乐并播放几首歌，推荐会根据收听记录生成。"

- [ ] **Step 5: Verify**

Run:

```bash
npm test -- --run src/utils/recommendationLogic.test.ts src/store/recommendationStore.test.ts
npm run build
```

- [ ] **Step 6: Commit**

```bash
git add src/utils/recommendationLogic.ts src/store/recommendationStore.ts src/components/widgets/DailyRecommendation.tsx src/utils/recommendationLogic.test.ts src/store/recommendationStore.test.ts
git commit --no-verify -m "feat: make recommendations explainable"
```

---

## Task 4: Upgrade Listening History And Stats Into Actionable Insights

**User value:** The stats panel shows what changed, what to do next, and which songs/artists matter.

**Files:**

- Modify: `src/utils/listeningInsights.ts`
- Modify: `src/components/library/ListeningHistory.tsx`
- Modify: `src/components/widgets/StatsAchievementsPanel.tsx`
- Modify: `src/store/statsAchievementsStore.ts`
- Test: `src/utils/listeningInsights.test.ts`
- Test: `src/store/statsAchievementsStore.test.ts`

- [ ] **Step 1: Add insight calculation tests**

Cover:

- completion rate with zero plays returns `0`.
- trend compares last 7 days with previous 7 days.
- top period derives from `hourlyDistribution`.
- replay score is clamped from `0` to `100`.

Run: `npm test -- --run src/utils/listeningInsights.test.ts`

- [ ] **Step 2: Add derived insight helpers**

Add helpers:

```ts
export function getTopTimeWindow(hourlyDistribution: Record<number, number>): {
  label: string;
  startHour: number;
  count: number;
}

export function getListeningNextAction(summary: ListeningInsightSummary): string
```

Return concrete labels:

- "继续复听核心曲目"
- "试试新歌手发现"
- "整理高跳过率歌曲"
- "开启完整专注收听"

- [ ] **Step 3: Improve history ranking UI**

In `ListeningHistory.tsx`, keep existing rankings and add:

- Hot list by play count.
- Replay list by total listen time.
- Artist list with song count.
- Click action to play ranking from selected row.

- [ ] **Step 4: Improve stats dashboard UI**

In `StatsAchievementsPanel.tsx`, add:

- trend card.
- completion and skip balance.
- "next action" recommendation.
- achievement spotlight cards for recently unlocked, nearly unlocked, and recommended.

- [ ] **Step 5: Verify**

Run:

```bash
npm test -- --run src/utils/listeningInsights.test.ts src/store/statsAchievementsStore.test.ts
npm run build
```

- [ ] **Step 6: Commit**

```bash
git add src/utils/listeningInsights.ts src/components/library/ListeningHistory.tsx src/components/widgets/StatsAchievementsPanel.tsx src/store/statsAchievementsStore.ts src/utils/listeningInsights.test.ts src/store/statsAchievementsStore.test.ts
git commit --no-verify -m "feat: add actionable listening insights"
```

---

## Task 5: Make Lyrics Search, Import, And Display More Useful

**User value:** Lyrics workflows should recover from missing lyrics and make manual correction easy.

**Files:**

- Modify: `src/store/lyricsSearchStore.ts`
- Modify: `src/components/lyrics/LyricsSearchPanel.tsx`
- Modify: `src/components/lyrics/LyricsImportPanel.tsx`
- Modify: `src/components/lyrics/LyricVisualizer.tsx`
- Modify: `src/components/lyrics/LyricSettingsPanel.tsx`
- Test: create `src/store/lyricsSearchStore.test.ts` if not present.

- [ ] **Step 1: Add lyrics store tests**

Test:

```ts
it("keeps manual imported lyrics for the current song", () => {
  useLyricsSearchStore.getState().setCurrentSongId("song-1");
  useLyricsSearchStore.getState().importManualLyrics("[00:01.00]Hello");

  expect(useLyricsSearchStore.getState().parsedLyrics[0].text).toBe("Hello");
});
```

- [ ] **Step 2: Add source confidence states**

Represent lyric source as:

```ts
type LyricSourceState = "none" | "searching" | "matched" | "manual" | "failed";
```

Show this state in search/import panels.

- [ ] **Step 3: Improve visualizer empty state**

When no lyrics exist:

- show current song title and artist.
- show "搜索歌词" and "手动导入" actions.
- keep animation subtle and respect reduced motion.

- [ ] **Step 4: Add readable lyric presets**

In `LyricSettingsPanel.tsx`, add three presets:

- Compact: smaller text, less spacing.
- Focus: larger current line, strong dimming.
- Karaoke: stronger current line, translation visible if available.

Persist by writing existing settings fields, not a new incompatible schema.

- [ ] **Step 5: Verify**

Run:

```bash
npm test -- --run src/store/lyricsSearchStore.test.ts
npm run build
```

- [ ] **Step 6: Commit**

```bash
git add src/store/lyricsSearchStore.ts src/store/lyricsSearchStore.test.ts src/components/lyrics/LyricsSearchPanel.tsx src/components/lyrics/LyricsImportPanel.tsx src/components/lyrics/LyricVisualizer.tsx src/components/lyrics/LyricSettingsPanel.tsx
git commit --no-verify -m "feat: improve lyrics recovery workflow"
```

---

## Task 6: Improve Visualization Controls Without Replacing V7 Core Views

**User value:** Users can choose effects, understand performance, and avoid blank or heavy visual modes.

**Files:**

- Modify: `src/components/visualization-v8/VisualizationViewV8.tsx`
- Modify: `src/components/visualization-v8/engines/RenderEngineManager.tsx`
- Modify: `src/components/visualization-v8/shared/VisualControlDrawer.tsx`
- Modify: `src/store/visualizationV8Store.ts`
- Modify: `src/store/performanceV8Store.ts`
- Test: `src/components/visualization-v8/effects/index.test.ts`
- Test: create `src/store/performanceV8Store.test.ts`

- [ ] **Step 1: Add performance config tests**

Test:

```ts
it("caps dpr quality for low and medium performance levels", () => {
  usePerformanceV8Store.getState().setPerformanceLevel("low");
  expect(usePerformanceV8Store.getState().config.webglQuality).toBe("low");

  usePerformanceV8Store.getState().setPerformanceLevel("medium");
  expect(usePerformanceV8Store.getState().config.targetFPS).toBe(30);
});
```

- [ ] **Step 2: Add effect fallback state**

In `VisualizationViewV8.tsx`, show a recovery panel when:

- no effect is initialized.
- WebGL is unavailable for a WebGL-preferred effect.
- render loop reports `fps < 20` for at least 5 seconds.

Actions:

- switch to Canvas effect.
- lower quality.
- open controls.

- [ ] **Step 3: Improve VisualControlDrawer**

Add:

- effect search by name/category.
- favorite effects stored in `visualizationV8Store`.
- reset current effect parameters.
- performance level segmented control.

- [ ] **Step 4: Verify**

Run:

```bash
npm test -- --run src/components/visualization-v8/effects/index.test.ts src/store/performanceV8Store.test.ts
npm run build
```

Manual check:

- open `http://localhost:3025`.
- enter visualization.
- switch at least one Canvas and one WebGL effect.
- confirm no blank canvas.

- [ ] **Step 5: Commit**

```bash
git add src/components/visualization-v8/VisualizationViewV8.tsx src/components/visualization-v8/engines/RenderEngineManager.tsx src/components/visualization-v8/shared/VisualControlDrawer.tsx src/store/visualizationV8Store.ts src/store/performanceV8Store.ts src/store/performanceV8Store.test.ts
git commit --no-verify -m "feat: improve visualization controls"
```

---

## Task 7: Make Library Health And Backup Actually Useful

**User value:** The user can diagnose missing files, duplicate metadata, broken covers, and restore safely.

**Files:**

- Modify: `src/store/libraryHealthStore.ts`
- Modify: `src/store/healthCheckStore.ts`
- Modify: `src/components/library/LibraryHealthPanel.tsx`
- Modify: `src/store/backupRestoreStore.ts`
- Modify: `src/components/library/BackupRestorePanel.tsx`
- Test: `src/store/libraryHealthStore.test.ts`
- Test: `src/store/backupRestoreStore.test.ts`

- [ ] **Step 1: Add health issue grouping tests**

Test issue groups:

- missing audio URL.
- duplicate title and artist.
- invalid duration.
- oversized embedded cover.

- [ ] **Step 2: Normalize issue severity**

Use:

```ts
type LibraryIssueSeverity = "critical" | "warning" | "info";
type LibraryIssueAction = "remove" | "edit" | "rescan" | "ignore";
```

Map each issue to one or more actions.

- [ ] **Step 3: Improve LibraryHealthPanel**

Add:

- grouped issue sections.
- one-click rescan.
- ignore issue.
- export health report JSON.
- clear explanation of how many songs are affected.

- [ ] **Step 4: Improve BackupRestorePanel**

Add:

- backup preview before download.
- restore preview before applying.
- explicit list of stores included.
- schema version display.
- reject unknown major schema versions with a visible error.

- [ ] **Step 5: Verify**

Run:

```bash
npm test -- --run src/store/libraryHealthStore.test.ts src/store/backupRestoreStore.test.ts
npm run build
```

- [ ] **Step 6: Commit**

```bash
git add src/store/libraryHealthStore.ts src/store/healthCheckStore.ts src/components/library/LibraryHealthPanel.tsx src/store/backupRestoreStore.ts src/components/library/BackupRestorePanel.tsx src/store/libraryHealthStore.test.ts src/store/backupRestoreStore.test.ts
git commit --no-verify -m "feat: improve library health and backup"
```

---

## Task 8: Make Settings And Shortcuts Discoverable

**User value:** Settings and shortcuts become predictable, searchable, and safe to change.

**Files:**

- Modify: `src/components/settings/SettingsPanel.tsx`
- Modify: `src/components/settings/KeyboardShortcutsSettings.tsx`
- Modify: `src/components/settings/KeyboardShortcutsHelp.tsx`
- Modify: `src/hooks/useKeyboardShortcuts.ts`
- Modify: `src/store/uiStore.ts`
- Test: `src/store/uiStore.test.ts`

- [ ] **Step 1: Add shortcut conflict tests**

Test:

```ts
it("rejects duplicate shortcut assignments", () => {
  const result = validateShortcutMap({
    playPause: "Space",
    openSearch: "Space",
  });

  expect(result.valid).toBe(false);
  expect(result.conflicts).toEqual([["playPause", "openSearch"]]);
});
```

Place `validateShortcutMap` in `src/hooks/useKeyboardShortcuts.ts` or a small helper beside it.

- [ ] **Step 2: Add settings search**

In `SettingsPanel.tsx`, add a compact search input that filters visible setting rows by label and description.

- [ ] **Step 3: Add shortcut reset and conflict UI**

In `KeyboardShortcutsSettings.tsx`, add:

- reset to defaults.
- conflict warning.
- per-shortcut clear button.
- disabled save when conflicts exist.

- [ ] **Step 4: Verify**

Run:

```bash
npm test -- --run src/store/uiStore.test.ts
npm run build
```

- [ ] **Step 5: Commit**

```bash
git add src/components/settings/SettingsPanel.tsx src/components/settings/KeyboardShortcutsSettings.tsx src/components/settings/KeyboardShortcutsHelp.tsx src/hooks/useKeyboardShortcuts.ts src/store/uiStore.ts src/store/uiStore.test.ts
git commit --no-verify -m "feat: improve settings and shortcuts"
```

---

## Task 9: Standardize Panel Empty, Loading, Error, And Recovery States

**User value:** Every feature panel explains what is happening and offers a next action.

**Files:**

- Modify: `src/components/shared/Glass/EmptyState.tsx`
- Modify: `src/components/shared/Glass/LoadingSkeleton.tsx`
- Modify: `src/components/shared/Glass/GlassButton.tsx`
- Modify: `src/components/layout/PanelOrchestrator.tsx`
- Modify selected panels from prior tasks only when they lack states.
- Test: `src/components/shared/Glass/P3Components.test.tsx`

- [ ] **Step 1: Add component contract tests**

Test:

```tsx
it("renders empty state action when provided", () => {
  render(<EmptyState title="No songs" actionLabel="Import" onAction={() => undefined} />);
  expect(screen.getByRole("button", { name: "Import" })).toBeInTheDocument();
});
```

- [ ] **Step 2: Expand EmptyState props**

Support:

- `title`
- `description`
- `icon`
- `actionLabel`
- `onAction`
- `secondaryActionLabel`
- `onSecondaryAction`

- [ ] **Step 3: Apply to high-traffic panels**

Update:

- `SearchPanel.tsx`
- `QueuePanel.tsx`
- `ListeningHistory.tsx`
- `DailyRecommendation.tsx`
- `LibraryHealthPanel.tsx`

- [ ] **Step 4: Verify**

Run:

```bash
npm test -- --run src/components/shared/Glass/P3Components.test.tsx
npm run build
```

- [ ] **Step 5: Commit**

```bash
git add src/components/shared/Glass/EmptyState.tsx src/components/shared/Glass/LoadingSkeleton.tsx src/components/shared/Glass/GlassButton.tsx src/components/layout/PanelOrchestrator.tsx src/components/player/SearchPanel.tsx src/components/player/QueuePanel.tsx src/components/library/ListeningHistory.tsx src/components/widgets/DailyRecommendation.tsx src/components/library/LibraryHealthPanel.tsx src/components/shared/Glass/P3Components.test.tsx
git commit --no-verify -m "feat: standardize panel recovery states"
```

---

## Task 10: Add A Practical Release Verification Checklist

**User value:** Every iteration can be verified quickly without guessing which flows matter.

**Files:**

- Create: `docs/nbl/checklists/existing-feature-release-checklist.md`
- Modify: `docs/nbl/PROCESS.md`

- [ ] **Step 1: Create checklist document**

Checklist sections:

- import music.
- play, pause, next, previous.
- queue edit and persistence.
- search and play from result.
- lyrics search and manual import.
- visualization Canvas and WebGL effect.
- stats update after playback.
- backup export and restore preview.
- settings and shortcut edit.

- [ ] **Step 2: Add commands**

Include:

```bash
npm test -- --run src/store/queueStore.test.ts src/store/searchStore.test.ts src/utils/listeningInsights.test.ts
npm run build
npm run dev
```

Also document static export preview:

```bash
npm run build
npx serve@latest out -l 3025
```

- [ ] **Step 3: Link from process document**

Add one line to `docs/nbl/PROCESS.md` pointing to `docs/nbl/checklists/existing-feature-release-checklist.md`.

- [ ] **Step 4: Commit**

```bash
git add docs/nbl/checklists/existing-feature-release-checklist.md docs/nbl/PROCESS.md
git commit --no-verify -m "docs: add existing feature release checklist"
```

---

## Execution Order

Recommended order:

1. Task 1: Playback queue controls.
2. Task 2: Search command center.
3. Task 4: Listening history and stats insights.
4. Task 3: Recommendations.
5. Task 5: Lyrics workflow.
6. Task 6: Visualization controls.
7. Task 7: Library health and backup.
8. Task 8: Settings and shortcuts.
9. Task 9: Shared panel states.
10. Task 10: Release checklist.

Reasoning:

- Queue and search are core daily workflows.
- Stats and recommendations need reliable playback/search data.
- Lyrics and visualization are experience improvements that should not block core playback.
- Library health, backup, settings, and shared states make the product safer and easier to maintain.

## Milestones

Milestone A, Practical Playback:

- Complete Tasks 1 and 2.
- Verification: queue/search tests pass and build passes.

Milestone B, Useful Personalization:

- Complete Tasks 3 and 4.
- Verification: recommendations explain reasons and stats show next actions.

Milestone C, Better Immersion:

- Complete Tasks 5 and 6.
- Verification: lyrics recovery works and visualization never opens to a blank screen.

Milestone D, Safer Maintenance:

- Complete Tasks 7 through 10.
- Verification: backup preview, health report, settings conflicts, and release checklist are usable.

## Final Verification

Run:

```bash
npm test -- --run src/store/queueStore.test.ts src/store/audioStore.test.ts src/store/searchStore.test.ts src/utils/recommendationLogic.test.ts src/utils/listeningInsights.test.ts src/store/statsAchievementsStore.test.ts
npm run build
```

Manual smoke test:

1. Start preview with `npm run dev` or `npm run build; npx serve@latest out -l 3025`.
2. Open `http://localhost:3025`.
3. Import or use existing music.
4. Play a track, add two tracks to queue, remove one, refresh page, confirm queue survives.
5. Search by title and artist, play from result, confirm recent search appears.
6. Open stats and listening history, confirm non-empty insights after playback.
7. Open lyrics panel, search or import lyrics, confirm visualizer displays a recovery state when no lyrics exist.
8. Open visualization, switch effects, confirm Canvas/WebGL render without blank screen.
9. Export backup preview, cancel restore, confirm no state changes.
10. Open settings, edit shortcuts, confirm duplicate shortcut warning appears.

## Risks

- Existing ESLint configuration currently blocks many legacy files. Do not treat pre-commit failure alone as a functional failure; require targeted tests and `npm run build`.
- Some docs display mojibake in PowerShell because of encoding. Use UTF-8-aware editors or Node-based reads when checking Chinese text.
- Visualization performance varies by GPU. Include a Canvas fallback and lower-quality mode before adding heavier effects.
- Do not change persisted state keys unless the task includes an explicit migration and regression tests.
