/**
 * Ordered, idempotent hydration for every persisted Zustand store. Stores use
 * `skipHydration: true`, so nothing touches localStorage during module evaluation or
 * SSR; the client calls `hydrateStores()` once (later calls share the same promise).
 * Order comes from the storage registry: player -> queue -> audio -> UI -> business.
 */
import { setHydrationStatus } from "@/lib/hydrationStatus";
import {
  STORAGE_REGISTRY,
  getStorageEntryByKeyOrOwner,
  type StorageEntry,
} from "@/lib/storage/storageRegistry";
import { useAIStore } from "@/store/aiStore";
import { useAudioEffectsStore } from "@/store/audioEffectsStore";
import { useAudioProcessingStore } from "@/store/audioProcessingStore";
import { useAudioSourceStore } from "@/store/audioSourceStore";
import { setAudioPersistenceSuspended, useAudioStore } from "@/store/audioStore";
import { useBackupRestoreStore } from "@/store/backupRestoreStore";
import { useCrossfadeStore } from "@/store/crossfadeStore";
import { useDSDProcessingStore } from "@/store/dsdProcessingStore";
import { useEmotionStore } from "@/store/emotionStore";
import { useEQStore } from "@/store/eqStore";
import { useFavoritesStore } from "@/store/favoritesStore";
import { useFingerprintStore } from "@/store/fingerprintStore";
import { useFormatConversionStore } from "@/store/formatConversionStore";
import { useGestureSettingsStore } from "@/store/gestureSettingsStore";
import { useHiResStore } from "@/store/hiresStore";
import { useKeyboardShortcutsStore } from "@/store/keyboardShortcutsStore";
import { useKnowledgeStore } from "@/store/knowledgeStore";
import { useLibraryHealthStore } from "@/store/libraryHealthStore";
import { useLibraryManagerStore } from "@/store/libraryManagerStore";
import { useLinerNotesStore } from "@/store/linerNotesStore";
import { useListeningJournalStore } from "@/store/listeningJournalStore";
import { useLyricsCoverStore } from "@/store/lyricsCoverStore";
import { useLyricSettingsStore } from "@/store/lyricSettingsStore";
import { useLyricsSearchStore } from "@/store/lyricsSearchStore";
import { useMetadataEditorStore } from "@/store/metadataEditorStore";
import { usePerformanceV8Store } from "@/store/performanceV8Store";
import { usePlayerSkinStore } from "@/store/playerSkinStore";
import { usePlayerStore } from "@/store/playerStore";
import { usePlaylistGroupStore } from "@/store/playlistGroupStore";
import { useProfessionalModeStore } from "@/store/professionalModeStore";
import { useQueueStore } from "@/store/queueStore";
import { useRecommendationStore } from "@/store/recommendationStore";
import { useSmartPlaylistStore } from "@/store/smartPlaylistStore";
import { useSourceConfigStore } from "@/store/sourceConfigStore";
import { useSpectrumStore } from "@/store/spectrumStore";
import { useStatsAchievementsStore } from "@/store/statsAchievementsStore";
import { useTrackCuttingStore } from "@/store/trackCuttingStore";
import { useUIStore } from "@/store/uiStore";
import { useAIAgentStore } from "@/store/useAIAgentStore";
import { useDataManagerStore } from "@/store/useDataManagerStore";
import { useUserAccountStore } from "@/store/userAccountStore";
import { useVisualSettingsStore } from "@/store/visualSettingsStore";
import { useWaveformStore } from "@/store/waveformStore";

export const HYDRATION_PHASES = ["playback", "queue", "audioProjection", "ui", "business"] as const;
export type HydrationPhase = (typeof HYDRATION_PHASES)[number];

interface PersistStore {
  persist: { rehydrate: () => Promise<void> | void };
}

const STORES: Record<string, PersistStore> = {
  aiStore: useAIStore,
  audioEffectsStore: useAudioEffectsStore,
  audioProcessingStore: useAudioProcessingStore,
  audioSourceStore: useAudioSourceStore,
  audioStore: useAudioStore,
  backupRestoreStore: useBackupRestoreStore,
  crossfadeStore: useCrossfadeStore,
  dsdProcessingStore: useDSDProcessingStore,
  emotionStore: useEmotionStore,
  eqStore: useEQStore,
  favoritesStore: useFavoritesStore,
  fingerprintStore: useFingerprintStore,
  formatConversionStore: useFormatConversionStore,
  gestureSettingsStore: useGestureSettingsStore,
  hiresStore: useHiResStore,
  keyboardShortcutsStore: useKeyboardShortcutsStore,
  knowledgeStore: useKnowledgeStore,
  libraryHealthStore: useLibraryHealthStore,
  libraryManagerStore: useLibraryManagerStore,
  linerNotesStore: useLinerNotesStore,
  listeningJournalStore: useListeningJournalStore,
  lyricSettingsStore: useLyricSettingsStore,
  lyricsCoverStore: useLyricsCoverStore,
  lyricsSearchStore: useLyricsSearchStore,
  metadataEditorStore: useMetadataEditorStore,
  performanceV8Store: usePerformanceV8Store,
  playerSkinStore: usePlayerSkinStore,
  playerStore: usePlayerStore,
  playlistGroupStore: usePlaylistGroupStore,
  professionalModeStore: useProfessionalModeStore,
  queueStore: useQueueStore,
  recommendationStore: useRecommendationStore,
  smartPlaylistStore: useSmartPlaylistStore,
  sourceConfigStore: useSourceConfigStore,
  spectrumStore: useSpectrumStore,
  statsAchievementsStore: useStatsAchievementsStore,
  trackCuttingStore: useTrackCuttingStore,
  uiStore: useUIStore,
  useAIAgentStore: useAIAgentStore,
  useDataManagerStore: useDataManagerStore,
  userAccountStore: useUserAccountStore,
  visualSettingsStore: useVisualSettingsStore,
  waveformStore: useWaveformStore,
};

// Dependency-critical stores; everything else falls back to registry order by group.
const FIXED_PHASES: Partial<Record<string, HydrationPhase>> = {
  playerStore: "playback",
  queueStore: "queue",
  audioStore: "audioProjection",
  uiStore: "ui",
  visualSettingsStore: "ui",
};

export interface HydrationStep {
  readonly owner: string;
  readonly phase: HydrationPhase;
}

export interface HydrateStoresOptions {
  /** Owner names (store files) or persisted keys; used by tests and targeted hydration. */
  readonly owners?: readonly string[];
}

export interface HydrateStoresResult {
  readonly phases: Record<HydrationPhase, number>;
  readonly hydrated: readonly string[];
}

function phaseFor(entry: StorageEntry): HydrationPhase {
  const fixed = FIXED_PHASES[entry.owner];
  if (fixed) return fixed;
  if (entry.group === "playback") return "audioProjection";
  if (entry.group === "ui") return "ui";
  return "business";
}

export function buildHydrationPlan(owners?: readonly string[]): HydrationStep[] {
  const entries = owners
    ? owners.map((name) => {
        const entry = getStorageEntryByKeyOrOwner(name);
        if (!entry) throw new Error(`[bootstrapStores] unknown storage key/owner: ${name}`);
        return entry;
      })
    : [...STORAGE_REGISTRY];

  return entries
    .map((entry) => ({ owner: entry.owner, phase: phaseFor(entry) }))
    .sort(
      (a, b) =>
        HYDRATION_PHASES.indexOf(a.phase) - HYDRATION_PHASES.indexOf(b.phase) ||
        // audioStore carries the playback projection, so hydrate it before other audio stores.
        Number(a.owner !== "audioStore") - Number(b.owner !== "audioStore")
    );
}

const hydratedOwners = new Set<string>();
let hydrationPromise: Promise<HydrateStoresResult> | null = null;

async function runHydration(plan: readonly HydrationStep[]): Promise<HydrateStoresResult> {
  const phases: Record<HydrationPhase, number> = {
    playback: 0,
    queue: 0,
    audioProjection: 0,
    ui: 0,
    business: 0,
  };
  const hydrated: string[] = [];

  // Never touch localStorage during SSR / prerender.
  if (typeof window === "undefined") return { phases, hydrated };

  // 水合顺序不变；仅暂停 audioStore 的中间写盘，避免默认进度覆盖其待读取快照。
  setAudioPersistenceSuspended(true);
  try {
    for (const step of plan) {
      if (hydratedOwners.has(step.owner)) continue;
      const startedAt = performance.now();
      await STORES[step.owner].persist.rehydrate();
      phases[step.phase] += performance.now() - startedAt;
      hydratedOwners.add(step.owner);
      hydrated.push(step.owner);
    }
  } finally {
    setAudioPersistenceSuspended(false);
  }

  return { phases, hydrated };
}

async function hydrateAllWithStatus(plan: readonly HydrationStep[]): Promise<HydrateStoresResult> {
  setHydrationStatus("hydrating");
  try {
    const result = await runHydration(plan);
    setHydrationStatus("ready");
    return result;
  } catch (error) {
    // Allow a retry after failure; hydratedOwners still prevents double hydration.
    hydrationPromise = null;
    setHydrationStatus("error");
    throw error;
  }
}

export function hydrateStores(options: HydrateStoresOptions = {}): Promise<HydrateStoresResult> {
  // Owner-scoped calls are partial hydrations (tests/targeted); they leave global status alone.
  if (options.owners) {
    return Promise.resolve().then(() => runHydration(buildHydrationPlan(options.owners)));
  }

  hydrationPromise ??= hydrateAllWithStatus(buildHydrationPlan());
  return hydrationPromise;
}

// Fail fast when the registry grows without a store binding (scan test covers the reverse).
for (const entry of STORAGE_REGISTRY) {
  if (!STORES[entry.owner])
    throw new Error(`[bootstrapStores] missing store binding: ${entry.owner}`);
}
