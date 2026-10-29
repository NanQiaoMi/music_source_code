export type RehydrateHandle = () => void | Promise<void>;

interface PersistLike {
  persist?: {
    rehydrate?: () => void | Promise<void>;
  };
}

type StoreLoader = () => Promise<unknown>;

const explicitHandles = new Map<string, RehydrateHandle>();

/**
 * Register a store-specific rehydrate handle. Used by tests and by stores that cannot be
 * imported lazily from this module.
 */
export function registerRehydrateHandle(key: string, handle: RehydrateHandle): void {
  explicitHandles.set(key, handle);
}

export function clearRehydrateHandles(): void {
  explicitHandles.clear();
}

/**
 * Lazy store loaders. Dynamic imports avoid a static import cycle between
 * backupRestoreStore -> rehydrateRegisteredStores -> every persisted store.
 * Keys not listed here are treated as no-op when an explicit handle is absent.
 */
const STORE_LOADERS: Readonly<Record<string, StoreLoader>> = {
  "audio-store-v4": async () => (await import("@/store/audioStore")).useAudioStore,
  "player-store": async () => (await import("@/store/playerStore")).usePlayerStore,
  "queue-store-v5": async () => (await import("@/store/queueStore")).useQueueStore,
  "visual-settings-v4": async () =>
    (await import("@/store/visualSettingsStore")).useVisualSettingsStore,
  "mimi-gesture-settings-v1": async () =>
    (await import("@/store/gestureSettingsStore")).useGestureSettingsStore,
  "recommendation-storage": async () =>
    (await import("@/store/recommendationStore")).useRecommendationStore,
  "library-manager-store-v4": async () =>
    (await import("@/store/libraryManagerStore")).useLibraryManagerStore,
  "playlist-group-store-v1": async () =>
    (await import("@/store/playlistGroupStore")).usePlaylistGroupStore,
  "lyrics-cover-store-v4": async () =>
    (await import("@/store/lyricsCoverStore")).useLyricsCoverStore,
  "ui-store-v2": async () => (await import("@/store/uiStore")).useUIStore,
};

export const REHYDRATABLE_KEYS: readonly string[] = Object.keys(STORE_LOADERS);

interface RehydrateResult {
  ok: string[];
  failed: string[];
}

function readPersist(store: unknown): PersistLike["persist"] {
  if (typeof store !== "object" || store === null) return undefined;
  const candidate = store as PersistLike;
  return candidate.persist;
}

/**
 * Rehydrate zustand-persist stores after a backup restore.
 * Failures are collected instead of thrown so the restore report can show them.
 */
export async function rehydrateRegisteredStores(
  keys?: readonly string[]
): Promise<RehydrateResult> {
  const result: RehydrateResult = { ok: [], failed: [] };
  const targets = keys && keys.length > 0 ? Array.from(new Set(keys)) : [...REHYDRATABLE_KEYS];

  for (const key of targets) {
    const explicit = explicitHandles.get(key);
    if (explicit) {
      try {
        await explicit();
        result.ok.push(key);
      } catch {
        result.failed.push(key);
      }
      continue;
    }

    const loader = STORE_LOADERS[key];
    if (!loader) {
      result.ok.push(key);
      continue;
    }
    try {
      const store = await loader();
      const persist = readPersist(store);
      if (persist && typeof persist.rehydrate === "function") {
        await persist.rehydrate();
      }
      result.ok.push(key);
    } catch {
      result.failed.push(key);
    }
  }

  return result;
}
