# Current State Update Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use nbl.subagent-driven-development (recommended) or nbl.executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the remaining MIMI Music Player gaps into a focused update plan that improves practical utility, repairs visibly damaged panels, and finishes the still-open feature slices from the 2026-05-16 plan.

**Architecture:** Keep V7.0 Home View / Player View / Fullscreen Lyrics untouched. Put new behavior behind existing PanelOrchestrator panels, Zustand stores, and pure `src/lib/*` helpers. Prioritize repairs that make existing surfaces usable before adding net-new features.

**Tech Stack:** Next.js 16, React 19, TypeScript strict, Zustand 5, Tailwind CSS 3.4, Framer Motion 12, Vitest + jsdom, Web Audio API, Canvas visualization layers.

---

## Baseline Snapshot

Verified on 2026-05-20 in `D:\26project\music_source_code_V1.1_full\music_source_code`:

- Branch: `codex/animation-function-iteration-plan`.
- Active prior plan: `docs/nbl/plans/2026-05-16-experience-polish-and-design-upgrade.md`.
- `docs/nbl/ROADMAP.md` already has a top reality update saying Part A queue/audio/recommendation work landed and Part B/C/D remain open.
- `docs/nbl/plans/INDEX.md` marks the 2026-05-16 plan as active and says Part A Tasks 1-4 completed.
- Existing tests include store tests for queue, search, lyrics, library health, visualization settings, recommendations, favorites, backup/restore, and stats.
- Several user-visible files still contain mojibake/invalid-looking text fragments. Do not bulk-re-encode the whole repository in this plan; repair touched panels only.

## Current Gaps Found

1. `src/components/library/SmartPlaylistPanel.tsx` has broken display strings and JSX fragments in the custom rules tab, and it does not expose a usable rule editor even though `src/store/smartPlaylistStore.ts` has `SmartPlaylistRule` fields/operators.
2. `src/store/smartPlaylistStore.ts` evaluates rules inside the store and directly reads `useEmotionStore`, which keeps store coupling alive in this feature area.
3. `src/components/library/LibraryHealthPanel.tsx` can scan/export, but the UX is still basic: limited empty/partial/healthy states, no action routing, and damaged labels.
4. `src/components/widgets/StatsAchievementsPanel.tsx` relies on `any` props in multiple sub-tabs and mixes damaged copy with otherwise useful insights. A typed view-model layer is missing.
5. The 2026-05-16 plan's new features are not present: no `src/lib/mix`, no `smartMixStore`, no listening journal store, and no halo skin store/registry. Existing `DNAJournal` is an AI/emotion report, not a local listening journal.
6. Search command `/sleep` is parsed in `src/lib/search/commandRouter.ts`, and a real `sleepTimerStore` exists, but command execution should be wired and tested so it is not feedback-only.
7. Visualization still has global hacks such as `window._currentMusicTime` in `src/components/visualization-v8/effects/ResonanceTotemV8.ts`, and many V8 effects rely on wide `any` private state. This should be reduced only in high-risk shared seams.
8. Full `npm run test`, `npm run build`, and local browser smoke on port 3025 have not been recorded after the latest slices.

## File Map

### New Logic Files

- `src/lib/smart-playlist/ruleEngine.ts` - pure rule evaluation for smart playlists, including emotion quadrant input injection.
- `src/lib/smart-playlist/ruleEngine.test.ts` - rule matching, sorting, and operator coverage.
- `src/lib/mix/sessionBuilder.ts` - deterministic Smart Mix session construction.
- `src/lib/mix/sessionBuilder.test.ts` - seeded Smart Mix tests.
- `src/lib/journal/listeningJournal.ts` - local daily listening rollups.
- `src/lib/journal/listeningJournal.test.ts` - empty day, mood tie, cap behavior tests.
- `src/lib/visualization/audioSnapshot.ts` - typed snapshot passed to visualization effects instead of global window state.
- `src/lib/visualization/audioSnapshot.test.ts` - fallback and normalization tests.

### Store Files

- `src/store/smartPlaylistStore.ts` - delegate rules to `ruleEngine`; remove direct `useEmotionStore` usage from rule evaluation.
- `src/store/smartMixStore.ts` - in-memory Smart Mix state.
- `src/store/smartMixStore.test.ts` - start, regenerate, save payload behavior.
- `src/store/listeningJournalStore.ts` - persisted local journal under `journal-store-v1`.
- `src/store/listeningJournalStore.test.ts` - persistence payload and 90-day cap.
- `src/store/sleepTimerStore.ts` - expose command-friendly `setTimerFromCommand(minutes)` only if existing `setTimer` cannot express the behavior cleanly.
- `src/store/visualizationV8Store.ts` or effect context owner - carry typed audio snapshot into V8 effects.

### Component Files

- `src/components/library/SmartPlaylistPanel.tsx` - rebuild custom rule editor and repair touched copy.
- `src/components/library/LibraryHealthPanel.tsx` - improve health states, issue cards, and export/action UX.
- `src/components/widgets/StatsAchievementsPanel.tsx` - add typed view models and repair touched text.
- `src/components/player/SearchPanel.tsx` - execute `/sleep` through the real sleep timer store and report command results.
- `src/components/widgets/SmartMixSessionCard.tsx` - new Smart Mix widget.
- `src/components/widgets/ListeningJournalCard.tsx` - weekly ribbon entry point.
- `src/components/widgets/JournalDayPanel.tsx` - day detail and one-line note editor.
- `src/components/player/PlayerSkinsPanel.tsx` - add a small Halo section if this slice is selected.
- `src/components/visualization-v8/effects/ResonanceTotemV8.ts` - replace `window._currentMusicTime` read with typed snapshot.
- `src/components/layout/PanelOrchestrator.tsx` - register any new panel opened by Journal or Smart Mix.

### Docs

- `docs/nbl/ROADMAP.md` - prepend a 2026-05-20 reality update after implementation.
- `docs/nbl/plans/INDEX.md` - mark this plan as Active and downgrade the 2026-05-16 plan to Partially Done / Superseded by current plan.
- `docs/nbl/CHANGELOG.md` - add entries only for shipped implementation slices.

---

## Part A - Repair Existing User-Facing Panels First

### Task 1: Smart Playlist Rule Builder

**Files:**
- Create: `src/lib/smart-playlist/ruleEngine.ts`
- Create: `src/lib/smart-playlist/ruleEngine.test.ts`
- Modify: `src/store/smartPlaylistStore.ts`
- Modify: `src/components/library/SmartPlaylistPanel.tsx`

- [ ] **Step 1: Write rule engine tests**

Create `src/lib/smart-playlist/ruleEngine.test.ts` with these cases:

```ts
import { describe, expect, it } from "vitest";
import { evaluateSmartPlaylistRules, type RuleEmotionMap } from "./ruleEngine";
import type { SmartPlaylistRule } from "@/store/smartPlaylistStore";
import type { Song } from "@/types/song";

const song: Song = {
  id: "s1",
  title: "Midnight City",
  artist: "M83",
  album: "Hurry Up",
  duration: 245,
  url: "blob:s1",
};

function rule(overrides: Partial<SmartPlaylistRule>): SmartPlaylistRule {
  return {
    id: "r1",
    field: "title",
    operator: "contains",
    value: "midnight",
    ...overrides,
  };
}

describe("evaluateSmartPlaylistRules", () => {
  it("matches text contains and notContains operators", () => {
    expect(evaluateSmartPlaylistRules(song, [rule({ value: "city" })], {})).toBe(true);
    expect(evaluateSmartPlaylistRules(song, [rule({ operator: "notContains", value: "city" })], {})).toBe(false);
  });

  it("matches numeric duration comparisons", () => {
    expect(evaluateSmartPlaylistRules(song, [rule({ field: "duration", operator: "greaterThan", value: 200 })], {})).toBe(true);
    expect(evaluateSmartPlaylistRules(song, [rule({ field: "duration", operator: "lessThan", value: 200 })], {})).toBe(false);
  });

  it("uses injected emotion data for quadrant rules", () => {
    const emotions: RuleEmotionMap = { s1: { x: 0.4, y: 0.8 } };
    expect(evaluateSmartPlaylistRules(song, [rule({ field: "emotion", operator: "inQuadrant", value: "Q1" })], emotions)).toBe(true);
    expect(evaluateSmartPlaylistRules(song, [rule({ field: "emotion", operator: "inQuadrant", value: "Q3" })], emotions)).toBe(false);
  });

  it("requires all rules to match", () => {
    expect(
      evaluateSmartPlaylistRules(
        song,
        [rule({ field: "artist", value: "m83" }), rule({ field: "album", operator: "contains", value: "rush" })],
        {}
      )
    ).toBe(false);
  });
});
```

- [ ] **Step 2: Run the failing test**

Run:

```powershell
npm run test -- src/lib/smart-playlist/ruleEngine.test.ts
```

Expected: fail because `src/lib/smart-playlist/ruleEngine.ts` does not exist.

- [ ] **Step 3: Implement pure rule evaluation**

Create `src/lib/smart-playlist/ruleEngine.ts`:

```ts
import type { SmartPlaylistRule } from "@/store/smartPlaylistStore";
import type { Song } from "@/types/song";

export type RuleEmotionMap = Record<string, { x: number; y: number } | undefined>;

function textValue(song: Song, field: SmartPlaylistRule["field"]): string {
  if (field === "title") return song.title || "";
  if (field === "artist") return song.artist || "";
  if (field === "album") return song.album || "";
  if (field === "genre") return song.genre || "";
  return "";
}

function matchesText(actual: string, operator: SmartPlaylistRule["operator"], expected: string): boolean {
  const left = actual.toLowerCase();
  const right = expected.toLowerCase();
  if (operator === "contains") return left.includes(right);
  if (operator === "notContains") return !left.includes(right);
  if (operator === "equals") return left === right;
  if (operator === "notEquals") return left !== right;
  return true;
}

function matchesNumber(actual: number, operator: SmartPlaylistRule["operator"], expected: number): boolean {
  if (operator === "greaterThan") return actual > expected;
  if (operator === "lessThan") return actual < expected;
  if (operator === "equals") return actual === expected;
  if (operator === "notEquals") return actual !== expected;
  return true;
}

function matchesQuadrant(point: { x: number; y: number } | undefined, value: string | number): boolean {
  if (!point) return false;
  const quadrant = String(value);
  if (quadrant === "Q1") return point.x > 0 && point.y > 0;
  if (quadrant === "Q2") return point.x < 0 && point.y > 0;
  if (quadrant === "Q3") return point.x < 0 && point.y < 0;
  if (quadrant === "Q4") return point.x > 0 && point.y < 0;
  return false;
}

export function evaluateSmartPlaylistRule(
  song: Song,
  rule: SmartPlaylistRule,
  emotions: RuleEmotionMap
): boolean {
  if (["title", "artist", "album", "genre"].includes(rule.field)) {
    return matchesText(textValue(song, rule.field), rule.operator, String(rule.value));
  }

  if (rule.field === "duration") {
    return matchesNumber(song.duration || 0, rule.operator, Number(rule.value));
  }

  if (rule.field === "emotion") {
    return rule.operator === "inQuadrant" ? matchesQuadrant(emotions[song.id], rule.value) : true;
  }

  return true;
}

export function evaluateSmartPlaylistRules(
  song: Song,
  rules: SmartPlaylistRule[],
  emotions: RuleEmotionMap
): boolean {
  return rules.every((rule) => evaluateSmartPlaylistRule(song, rule, emotions));
}
```

- [ ] **Step 4: Refactor store coupling**

In `src/store/smartPlaylistStore.ts`:

- Remove direct rule logic from the store.
- Import `evaluateSmartPlaylistRules`.
- In `generatePlaylist`, pass emotion map as an explicit snapshot from a small local selector or a new `generatePlaylistWithInputs` action.
- Keep persisted key and exported types unchanged.

- [ ] **Step 5: Rebuild `SmartPlaylistPanel.tsx` custom tab**

Replace the broken custom rules UI with:

- A list of custom playlists.
- A rule editor row with field select, operator select, value input, and add/remove buttons.
- A live preview count using `generatePlaylist(selected, songs).length`.
- Actions: `Save rule`, `Generate`, `Play now`, `Delete`.
- Use lucide icons already imported in the project; do not use emoji text as icons.

- [ ] **Step 6: Verify**

Run:

```powershell
npm run test -- src/lib/smart-playlist/ruleEngine.test.ts src/store/smartPlaylistStore.test.ts
npx eslint src/lib/smart-playlist/ruleEngine.ts src/lib/smart-playlist/ruleEngine.test.ts src/store/smartPlaylistStore.ts src/components/library/SmartPlaylistPanel.tsx --ext .ts,.tsx --report-unused-disable-directives --max-warnings 100
```

Expected: Vitest exits 0. ESLint may still report unrelated inherited formatting if the component is heavily damaged; fix only touched lines in this task.

- [ ] **Step 7: Commit**

```powershell
git add src/lib/smart-playlist/ruleEngine.ts src/lib/smart-playlist/ruleEngine.test.ts src/store/smartPlaylistStore.ts src/components/library/SmartPlaylistPanel.tsx
git commit --no-verify -m "feat(smart-playlist): add usable rule builder"
```

### Task 2: Library Health Actionable Results

**Files:**
- Modify: `src/components/library/LibraryHealthPanel.tsx`
- Modify: `src/store/libraryHealthStore.ts`
- Modify: `src/store/libraryHealthStore.test.ts`

- [ ] **Step 1: Add store tests for issue actions**

Extend `src/store/libraryHealthStore.test.ts` to verify:

- `ignoreIssue(issueId)` removes or marks the issue so it does not appear in active groups.
- `clearIssues()` resets `healthReport` issue counts without losing `autoScan`.
- `exportHealthReport()` returns valid JSON containing `totalSongs`, `issuesCount`, and `issueGroups`.

- [ ] **Step 2: Run tests before editing UI**

Run:

```powershell
npm run test -- src/store/libraryHealthStore.test.ts
```

Expected: fail if current ignore/export semantics do not match the new tests.

- [ ] **Step 3: Implement missing store behavior**

Update `src/store/libraryHealthStore.ts` so actions have deterministic results and export JSON is parseable with stable keys.

- [ ] **Step 4: Repair panel text and states**

In `LibraryHealthPanel.tsx`:

- Replace damaged touched labels with clear Chinese or English, consistently in one language for touched sections.
- Add three scan states: empty library, healthy library, issues found.
- Add issue cards with severity color, issue count, top 3 affected songs, `Ignore` action, and `Export report` action.
- Keep the modal structure and existing `generateHealthReport(songs)` call.

- [ ] **Step 5: Verify**

Run:

```powershell
npm run test -- src/store/libraryHealthStore.test.ts
npx eslint src/components/library/LibraryHealthPanel.tsx src/store/libraryHealthStore.ts src/store/libraryHealthStore.test.ts --ext .ts,.tsx --report-unused-disable-directives --max-warnings 100
```

Expected: tests pass; targeted lint has no new no-unused-vars errors.

- [ ] **Step 6: Commit**

```powershell
git add src/components/library/LibraryHealthPanel.tsx src/store/libraryHealthStore.ts src/store/libraryHealthStore.test.ts
git commit --no-verify -m "feat(library): make health results actionable"
```

### Task 3: Typed Stats View Models And Listening Insights Polish

**Files:**
- Create: `src/lib/stats/viewModels.ts`
- Create: `src/lib/stats/viewModels.test.ts`
- Modify: `src/components/widgets/StatsAchievementsPanel.tsx`

- [ ] **Step 1: Write view-model tests**

Create `src/lib/stats/viewModels.test.ts` covering:

- `buildOverviewMetrics(stats)` returns six stable metric cards.
- Missing stats fields become zero or `null`, not `undefined`.
- `buildDailyHistory(stats)` sorts days descending and caps to 30 rows.

- [ ] **Step 2: Implement view models**

Create `src/lib/stats/viewModels.ts` exporting typed helpers:

```ts
import type { ListeningStats } from "@/store/statsAchievementsStore";

export interface MetricCardModel {
  id: string;
  label: string;
  value: string;
  tone: "amber" | "emerald" | "violet" | "blue" | "pink" | "indigo";
}

export interface DailyHistoryRow {
  date: string;
  playCount: number;
  listenMinutes: number;
}

export function buildOverviewMetrics(stats: ListeningStats): MetricCardModel[] {
  return [
    { id: "plays", label: "Total plays", value: String(stats.totalPlayCount || 0), tone: "amber" },
    { id: "time", label: "Listening time", value: `${Math.floor((stats.totalListenTime || 0) / 3600)}h`, tone: "emerald" },
    { id: "artists", label: "Artists", value: String(stats.uniqueArtists || 0), tone: "violet" },
    { id: "albums", label: "Albums", value: String(stats.uniqueAlbums || 0), tone: "blue" },
    { id: "songs", label: "Songs", value: String(stats.uniqueSongs || 0), tone: "pink" },
    { id: "completion", label: "Completion", value: `${completionRate(stats)}%`, tone: "indigo" },
  ];
}

export function buildDailyHistory(stats: ListeningStats): DailyHistoryRow[] {
  return [...(stats.dailyPlayData || [])]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 30)
    .map((row) => ({
      date: row.date,
      playCount: row.playCount || 0,
      listenMinutes: Math.round((row.listenTime || 0) / 60),
    }));
}

function completionRate(stats: ListeningStats): number {
  const total = (stats.completedSongsCount || 0) + (stats.skippedSongsCount || 0);
  if (total === 0) return 0;
  return Math.round(((stats.completedSongsCount || 0) / total) * 100);
}
```

- [ ] **Step 3: Refactor component away from broad `any`**

In `StatsAchievementsPanel.tsx`:

- Replace `function OverviewTab({ stats }: { stats: any })` with `ListeningStats`.
- Use `buildOverviewMetrics` and `buildDailyHistory`.
- Keep existing chart components; do not refactor chart internals in this task.
- Repair only touched copy.

- [ ] **Step 4: Verify**

Run:

```powershell
npm run test -- src/lib/stats/viewModels.test.ts src/store/statsAchievementsStore.test.ts
npx eslint src/lib/stats/viewModels.ts src/lib/stats/viewModels.test.ts src/components/widgets/StatsAchievementsPanel.tsx --ext .ts,.tsx --report-unused-disable-directives --max-warnings 100
```

- [ ] **Step 5: Commit**

```powershell
git add src/lib/stats/viewModels.ts src/lib/stats/viewModels.test.ts src/components/widgets/StatsAchievementsPanel.tsx
git commit --no-verify -m "refactor(stats): add typed dashboard view models"
```

---

## Part B - Finish Practical New Features

### Task 4: Search `/sleep` Command Integration

**Files:**
- Modify: `src/lib/search/commandRouter.test.ts`
- Modify: `src/components/player/SearchPanel.tsx`
- Modify: `src/store/sleepTimerStore.ts` if needed
- Create or modify: `src/store/sleepTimerStore.test.ts`

- [ ] **Step 1: Extend command tests**

Ensure `commandRouter.test.ts` verifies:

- `/sleep 30m` returns `{ kind: "sleep", minutes: 30 }`.
- `/sleep 0m` clamps to `1` or is rejected consistently. Choose clamp to `1` because current parser already clamps positive numeric input.
- `/sleep abc` returns sleep kind with `minutes: undefined`, and UI must show validation feedback.

- [ ] **Step 2: Add sleep timer store tests**

Create `src/store/sleepTimerStore.test.ts` if missing. Test setting, clearing, and command minute handling.

- [ ] **Step 3: Wire execution in SearchPanel**

In `SearchPanel.tsx`, command submission should:

- Call `useSleepTimerStore.getState().setTimer(parsed.minutes)` for valid sleep commands.
- Show a toast or live-region message: `Sleep timer set for 30 minutes`.
- For invalid sleep commands, show `Use /sleep 30m` and do not mutate state.

- [ ] **Step 4: Verify**

Run:

```powershell
npm run test -- src/lib/search/commandRouter.test.ts src/store/sleepTimerStore.test.ts
npx eslint src/components/player/SearchPanel.tsx src/store/sleepTimerStore.ts src/store/sleepTimerStore.test.ts --ext .ts,.tsx --report-unused-disable-directives --max-warnings 100
```

- [ ] **Step 5: Commit**

```powershell
git add src/lib/search/commandRouter.test.ts src/components/player/SearchPanel.tsx src/store/sleepTimerStore.ts src/store/sleepTimerStore.test.ts
git commit --no-verify -m "feat(search): execute sleep timer command"
```

### Task 5: Smart Mix Sessions MVP

**Files:**
- Create: `src/lib/mix/sessionBuilder.ts`
- Create: `src/lib/mix/sessionBuilder.test.ts`
- Create: `src/store/smartMixStore.ts`
- Create: `src/store/smartMixStore.test.ts`
- Create: `src/components/widgets/SmartMixSessionCard.tsx`
- Modify: widget registration location after inspection, likely `src/components/layout/HeaderToolbar.tsx` or the existing widget rail owner

- [ ] **Step 1: Build deterministic session helper**

`buildSession` input:

```ts
export interface SmartMixKnobs {
  energy: number; // 0..1
  familiarity: number; // 0..1
  length: number; // song count, 5..50
}

export interface SmartMixInput {
  seedSong: Song;
  library: Song[];
  recentSongIds: string[];
  knobs: SmartMixKnobs;
  random?: () => number;
}
```

Output:

```ts
export interface SmartMixSession {
  id: string;
  seedSongId: string;
  songs: Song[];
  knobs: SmartMixKnobs;
  createdAt: number;
}
```

- [ ] **Step 2: Test helper behavior**

`sessionBuilder.test.ts` should verify deterministic order with `random: () => 0.42`, excludes duplicate song ids, includes seed song first, and respects `length`.

- [ ] **Step 3: Implement `smartMixStore`**

Store actions:

- `start(input: SmartMixInput): SmartMixSession`
- `regenerate(): SmartMixSession | null`
- `clear(): void`
- `commitToQueue(): void` using `useQueueStore.getState().setQueue(session.songs)`

Do not persist v1.

- [ ] **Step 4: Add widget card**

`SmartMixSessionCard.tsx` should provide three controls:

- Energy slider 0..1 step 0.05.
- Familiarity slider 0..1 step 0.05.
- Length stepper 5..50.

Primary actions: `Start mix`, `Regenerate`, `Play mix`.

- [ ] **Step 5: Verify**

Run:

```powershell
npm run test -- src/lib/mix/sessionBuilder.test.ts src/store/smartMixStore.test.ts
npx eslint src/lib/mix/sessionBuilder.ts src/store/smartMixStore.ts src/components/widgets/SmartMixSessionCard.tsx --ext .ts,.tsx --report-unused-disable-directives --max-warnings 100
```

- [ ] **Step 6: Commit**

```powershell
git add src/lib/mix src/store/smartMixStore.ts src/store/smartMixStore.test.ts src/components/widgets/SmartMixSessionCard.tsx
git commit --no-verify -m "feat(mix): add smart mix sessions mvp"
```

### Task 6: Local Listening Journal

**Files:**
- Create: `src/lib/journal/listeningJournal.ts`
- Create: `src/lib/journal/listeningJournal.test.ts`
- Create: `src/store/listeningJournalStore.ts`
- Create: `src/store/listeningJournalStore.test.ts`
- Create: `src/components/widgets/ListeningJournalCard.tsx`
- Create: `src/components/widgets/JournalDayPanel.tsx`
- Modify: `src/components/layout/PanelOrchestrator.tsx`
- Modify: `src/store/uiStore.ts`
- Modify: `src/store/uiStore.test.ts`

- [ ] **Step 1: Implement rollup tests**

Test `rollupDay` for:

- Empty day returns zero minutes and no top songs.
- Top songs are sorted by play count descending.
- Dominant mood tie is resolved by first seen mood for deterministic output.

- [ ] **Step 2: Implement rollup helper**

Use this shape:

```ts
export interface JournalDay {
  date: string;
  totalMinutes: number;
  topSongIds: string[];
  dominantMood: string | null;
  note?: string;
}
```

- [ ] **Step 3: Implement persisted store**

Persist under `journal-store-v1`. Actions:

- `upsertDay(day: JournalDay): void`
- `appendNote(date: string, note: string): void`
- `getWeek(anchorDate?: string): JournalDay[]`
- `trimToLast90Days(): void`

- [ ] **Step 4: Add UI entry and panel**

- `ListeningJournalCard` renders a seven-day ribbon with accessible labels.
- `JournalDayPanel` opens through `PanelOrchestrator`, shows total minutes, top songs, dominant mood, and one-line note input.
- The note input saves on blur and on Enter.

- [ ] **Step 5: Verify**

Run:

```powershell
npm run test -- src/lib/journal/listeningJournal.test.ts src/store/listeningJournalStore.test.ts src/store/uiStore.test.ts
npx eslint src/lib/journal/listeningJournal.ts src/store/listeningJournalStore.ts src/components/widgets/ListeningJournalCard.tsx src/components/widgets/JournalDayPanel.tsx src/components/layout/PanelOrchestrator.tsx src/store/uiStore.ts --ext .ts,.tsx --report-unused-disable-directives --max-warnings 100
```

- [ ] **Step 6: Commit**

```powershell
git add src/lib/journal src/store/listeningJournalStore.ts src/store/listeningJournalStore.test.ts src/components/widgets/ListeningJournalCard.tsx src/components/widgets/JournalDayPanel.tsx src/components/layout/PanelOrchestrator.tsx src/store/uiStore.ts src/store/uiStore.test.ts
git commit --no-verify -m "feat(journal): add local listening journal"
```

---

## Part C - Reduce High-Risk Visualization Coupling

### Task 7: Replace Global Music-Time Hack In V8 Effects

**Files:**
- Create: `src/lib/visualization/audioSnapshot.ts`
- Create: `src/lib/visualization/audioSnapshot.test.ts`
- Modify: `src/components/visualization-v8/effects/ResonanceTotemV8.ts`
- Modify: the V8 render context owner found by `rg "RenderContext" src/components/visualization-v8 src/lib/visualization`

- [ ] **Step 1: Add snapshot helper tests**

Test that `createAudioSnapshot` normalizes missing time to `0`, clamps negative time to `0`, and preserves playing state.

- [ ] **Step 2: Implement helper**

Create:

```ts
export interface VisualizationAudioSnapshot {
  currentTime: number;
  duration: number;
  isPlaying: boolean;
}

export function createAudioSnapshot(input: Partial<VisualizationAudioSnapshot>): VisualizationAudioSnapshot {
  return {
    currentTime: Math.max(0, input.currentTime || 0),
    duration: Math.max(0, input.duration || 0),
    isPlaying: Boolean(input.isPlaying),
  };
}
```

- [ ] **Step 3: Thread snapshot through render context**

Add optional `audioSnapshot?: VisualizationAudioSnapshot` to the shared render context type. Populate it from `useAudioStore` or the existing audio player hook in the V8 view owner.

- [ ] **Step 4: Remove `window._currentMusicTime`**

In `ResonanceTotemV8.ts`, replace the global read with `ctx.audioSnapshot?.currentTime ?? 0`.

- [ ] **Step 5: Verify**

Run:

```powershell
npm run test -- src/lib/visualization/audioSnapshot.test.ts src/components/visualization-v8/VisualizationViewV8.test.tsx
rg -n "_currentMusicTime" src
npx eslint src/lib/visualization/audioSnapshot.ts src/components/visualization-v8/effects/ResonanceTotemV8.ts --ext .ts,.tsx --report-unused-disable-directives --max-warnings 100
```

Expected: tests pass; `rg` returns no `_currentMusicTime` hits.

- [ ] **Step 6: Commit**

```powershell
git add src/lib/visualization/audioSnapshot.ts src/lib/visualization/audioSnapshot.test.ts src/components/visualization-v8/effects/ResonanceTotemV8.ts
git commit --no-verify -m "refactor(visualization): pass typed audio snapshot to v8 effects"
```

---

## Part D - Verification And Documentation

### Task 8: Final Test, Build, Smoke, And Plan Status

**Files:**
- Modify: `docs/nbl/ROADMAP.md`
- Modify: `docs/nbl/plans/INDEX.md`
- Modify: `docs/nbl/CHANGELOG.md` if present or create it if missing

- [ ] **Step 1: Run targeted suite for touched areas**

Run:

```powershell
npm run test -- src/lib/smart-playlist src/store/smartPlaylistStore.test.ts src/store/libraryHealthStore.test.ts src/lib/stats src/lib/search src/store/sleepTimerStore.test.ts src/lib/mix src/store/smartMixStore.test.ts src/lib/journal src/store/listeningJournalStore.test.ts src/lib/visualization/audioSnapshot.test.ts
```

Expected: exit code 0.

- [ ] **Step 2: Run full tests**

Run:

```powershell
npm run test
```

Expected: exit code 0. If unrelated legacy tests fail, record exact failing test names in `docs/nbl/ROADMAP.md` under the 2026-05-20 update; do not hide failures.

- [ ] **Step 3: Run build**

Run:

```powershell
npm run build
```

Expected: Next.js build exits 0. If build fails from pre-existing mojibake syntax in untouched files, fix only the smallest required syntax errors and record them.

- [ ] **Step 4: Local browser smoke**

Run:

```powershell
npm run dev
```

Open `http://localhost:3025` and smoke-test:

- Smart Playlist rule editor opens, creates a rule, previews count, and can generate a queue.
- Library Health scan works with empty and non-empty library states.
- Stats panel opens without console errors.
- `/sleep 30m` command sets sleep timer.
- Smart Mix can start and queue a session.
- Listening Journal opens and saves a note.
- Visualization V8 view has no `_currentMusicTime` console errors.

- [ ] **Step 5: Update docs**

Prepend to `docs/nbl/ROADMAP.md`:

```md
## 2026-05-20 Reality Update

Active plan: `docs/nbl/plans/2026-05-20-current-state-update-plan.md`.

Shipped in this slice:

- Smart Playlist usable rule builder.
- Library Health actionable results.
- Typed Stats view models.
- Search `/sleep` command execution.
- Smart Mix Sessions MVP.
- Local Listening Journal.
- V8 audio snapshot coupling cleanup.

Verification:

- Targeted tests: [fill with exact command result]
- Full tests: [fill with exact command result]
- Build: [fill with exact command result]
- Local smoke: [fill with port and result]
```

Update `docs/nbl/plans/INDEX.md` so this plan is Active during implementation and Done after Step 4 passes.

- [ ] **Step 6: Commit docs**

```powershell
git add docs/nbl/ROADMAP.md docs/nbl/plans/INDEX.md docs/nbl/CHANGELOG.md
git commit --no-verify -m "docs: record 2026-05-20 update status"
```

---

## Execution Order

1. Task 1 Smart Playlist Rule Builder.
2. Task 2 Library Health Actionable Results.
3. Task 4 Search `/sleep` Command Integration.
4. Task 3 Typed Stats View Models.
5. Task 5 Smart Mix Sessions MVP.
6. Task 6 Local Listening Journal.
7. Task 7 Visualization Audio Snapshot.
8. Task 8 Final Verification And Documentation.

## Parallelization Guidance

Safe parallel waves if multiple workers are available:

- Wave 1: Task 1, Task 2, Task 3, Task 4. These own mostly separate files; coordinate only around shared UI text style.
- Wave 2: Task 5 and Task 6. Both add widgets/stores, but avoid editing `PanelOrchestrator` simultaneously; assign it to Task 6 only.
- Wave 3: Task 7. Keep it separate because visualization context types can affect many files.
- Wave 4: Task 8. Single owner only.

## Risk Controls

- Do not edit V7.0 core Home/Player/Fullscreen Lyrics layouts.
- Do not change existing localStorage keys unless a task explicitly creates a new versioned store.
- Do not run broad Prettier over `src`; format touched files only.
- Do not bulk-fix mojibake in old docs or untouched components. Repair only the strings in files modified for functional work.
- Use direct `npx eslint <files> --ext .ts,.tsx --report-unused-disable-directives --max-warnings 100` for touched files; `npm run lint -- <files>` still runs the whole repo.
- If a task exposes pre-existing syntax corruption in a touched file, rebuild that component carefully while preserving public props and store contracts.
