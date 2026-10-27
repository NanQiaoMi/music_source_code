/**
 * Storage registry — single source of truth for persisted localStorage keys.
 *
 * Introduced by S1-1 (2026-10-21). Purpose:
 * - make every persisted key explicit (owner / version / group / backup / quota policy)
 * - enable a consistency test that fails when a store adds/renames a persist key without registering it
 * - provide the input for backup slots (S1-2) and versioned hydration (S6-2)
 *
 * version semantics: target schema version for migration planning. Stores that never had a
 * zustand "version" start at 1; when the registry is wired into persist configs (S6-2) they
 * must provide migrate(0 -> 1). Do not bump a version without adding a migrate function and a
 * fixture test (docs/nbl/plans/2026-10-21-arch-perf-execution/S1-data-playback.md).
 */

export type StorageGroup = "playback" | "settings" | "library" | "ai" | "ui" | "transient";
export type QuotaPolicy = "prune" | "prune-then-memory" | "memory";

export interface StorageEntry {
  readonly key: string;
  readonly owner: string;
  readonly version: number;
  readonly group: StorageGroup;
  readonly backup: boolean;
  readonly quotaPolicy: QuotaPolicy;
  readonly pruneFields?: readonly string[];
}

export const STORAGE_REGISTRY: readonly StorageEntry[] = [
  {
    key: "mimi-ai-store",
    owner: "aiStore",
    version: 1,
    group: "ai",
    backup: false,
    quotaPolicy: "prune-then-memory",
  },
  {
    key: "audio-effects-store-v2",
    owner: "audioEffectsStore",
    version: 1,
    group: "playback",
    backup: false,
    quotaPolicy: "prune-then-memory",
  },
  {
    key: "audio-processing-store-v5",
    owner: "audioProcessingStore",
    version: 1,
    group: "playback",
    backup: false,
    quotaPolicy: "prune-then-memory",
  },
  {
    key: "mimi_audio_source_settings",
    owner: "audioSourceStore",
    version: 1,
    group: "playback",
    backup: false,
    quotaPolicy: "prune-then-memory",
  },
  {
    key: "audio-store-v4",
    owner: "audioStore",
    version: 1,
    group: "playback",
    backup: true,
    quotaPolicy: "prune-then-memory",
  },
  {
    key: "backup-restore-store-v4",
    owner: "backupRestoreStore",
    version: 1,
    group: "library",
    backup: false,
    quotaPolicy: "prune-then-memory",
  },
  {
    key: "crossfade-store-v5",
    owner: "crossfadeStore",
    version: 1,
    group: "playback",
    backup: false,
    quotaPolicy: "prune-then-memory",
  },
  {
    key: "dsd-processing-store-v5",
    owner: "dsdProcessingStore",
    version: 1,
    group: "settings",
    backup: false,
    quotaPolicy: "prune-then-memory",
  },
  {
    key: "vibe-emotion-store-v2",
    owner: "emotionStore",
    version: 1,
    group: "ai",
    backup: false,
    quotaPolicy: "prune-then-memory",
  },
  {
    key: "eq-store",
    owner: "eqStore",
    version: 1,
    group: "playback",
    backup: false,
    quotaPolicy: "prune-then-memory",
  },
  {
    key: "favorites-store",
    owner: "favoritesStore",
    version: 1,
    group: "library",
    backup: false,
    quotaPolicy: "prune-then-memory",
  },
  {
    key: "fingerprint-store-v5",
    owner: "fingerprintStore",
    version: 1,
    group: "settings",
    backup: false,
    quotaPolicy: "prune-then-memory",
  },
  {
    key: "format-conversion-store-v5",
    owner: "formatConversionStore",
    version: 1,
    group: "settings",
    backup: false,
    quotaPolicy: "prune-then-memory",
  },
  {
    key: "mimi-gesture-settings-v1",
    owner: "gestureSettingsStore",
    version: 1,
    group: "settings",
    backup: false,
    quotaPolicy: "prune-then-memory",
  },
  {
    key: "hires-store-v5",
    owner: "hiresStore",
    version: 1,
    group: "settings",
    backup: false,
    quotaPolicy: "prune-then-memory",
  },
  {
    key: "keyboard-shortcuts-store-v1",
    owner: "keyboardShortcutsStore",
    version: 1,
    group: "settings",
    backup: false,
    quotaPolicy: "prune-then-memory",
  },
  {
    key: "mimi-knowledge-storage-v3",
    owner: "knowledgeStore",
    version: 1,
    group: "ai",
    backup: false,
    quotaPolicy: "prune-then-memory",
  },
  {
    key: "library-health-store-v5",
    owner: "libraryHealthStore",
    version: 1,
    group: "library",
    backup: false,
    quotaPolicy: "prune-then-memory",
  },
  {
    key: "library-manager-store-v4",
    owner: "libraryManagerStore",
    version: 1,
    group: "settings",
    backup: true,
    quotaPolicy: "prune-then-memory",
  },
  {
    key: "mimi-liner-notes-store",
    owner: "linerNotesStore",
    version: 1,
    group: "ai",
    backup: false,
    quotaPolicy: "prune-then-memory",
  },
  {
    key: "journal-store-v1",
    owner: "listeningJournalStore",
    version: 1,
    group: "ai",
    backup: false,
    quotaPolicy: "prune-then-memory",
  },
  {
    key: "lyrics-cover-store-v4",
    owner: "lyricsCoverStore",
    version: 1,
    group: "library",
    backup: true,
    quotaPolicy: "prune-then-memory",
  },
  {
    key: "lyric-settings-storage",
    owner: "lyricSettingsStore",
    version: 1,
    group: "settings",
    backup: false,
    quotaPolicy: "prune-then-memory",
  },
  {
    key: "lyrics-search-storage",
    owner: "lyricsSearchStore",
    version: 1,
    group: "library",
    backup: false,
    quotaPolicy: "prune-then-memory",
  },
  {
    key: "metadata-editor-store-v5",
    owner: "metadataEditorStore",
    version: 1,
    group: "settings",
    backup: false,
    quotaPolicy: "prune-then-memory",
  },
  {
    key: "performance-v8-store",
    owner: "performanceV8Store",
    version: 1,
    group: "ui",
    backup: false,
    quotaPolicy: "prune-then-memory",
  },
  {
    key: "player-skin-store-v1",
    owner: "playerSkinStore",
    version: 1,
    group: "settings",
    backup: false,
    quotaPolicy: "prune-then-memory",
  },
  {
    key: "player-store",
    owner: "playerStore",
    version: 1,
    group: "playback",
    backup: true,
    quotaPolicy: "prune-then-memory",
  },
  {
    key: "playlist-group-store-v1",
    owner: "playlistGroupStore",
    version: 1,
    group: "library",
    backup: true,
    quotaPolicy: "prune-then-memory",
  },
  {
    key: "professional-mode-store-v5",
    owner: "professionalModeStore",
    version: 1,
    group: "settings",
    backup: false,
    quotaPolicy: "prune-then-memory",
  },
  {
    key: "queue-store-v5",
    owner: "queueStore",
    version: 1,
    group: "playback",
    backup: true,
    quotaPolicy: "prune-then-memory",
  },
  {
    key: "recommendation-storage",
    owner: "recommendationStore",
    version: 1,
    group: "ai",
    backup: true,
    quotaPolicy: "prune-then-memory",
  },
  {
    key: "smart-playlist-store-v4",
    owner: "smartPlaylistStore",
    version: 1,
    group: "library",
    backup: false,
    quotaPolicy: "prune-then-memory",
  },
  {
    key: "vibe_source_config_v1",
    owner: "sourceConfigStore",
    version: 1,
    group: "settings",
    backup: false,
    quotaPolicy: "prune-then-memory",
  },
  {
    key: "spectrum-store-v5",
    owner: "spectrumStore",
    version: 1,
    group: "settings",
    backup: false,
    quotaPolicy: "prune-then-memory",
  },
  {
    key: "stats-achievements-store-v4",
    owner: "statsAchievementsStore",
    version: 1,
    group: "library",
    backup: false,
    quotaPolicy: "prune",
  },
  {
    key: "track-cutting-store-v5",
    owner: "trackCuttingStore",
    version: 1,
    group: "settings",
    backup: false,
    quotaPolicy: "prune-then-memory",
  },
  {
    key: "ui-store-v2",
    owner: "uiStore",
    version: 2,
    group: "ui",
    backup: false,
    quotaPolicy: "prune-then-memory",
  },
  {
    key: "mimi_ai_agent_chat_store_v1",
    owner: "useAIAgentStore",
    version: 1,
    group: "ai",
    backup: false,
    quotaPolicy: "prune-then-memory",
  },
  {
    key: "mimi_datamanager_hub_store_v1",
    owner: "useDataManagerStore",
    version: 1,
    group: "settings",
    backup: false,
    quotaPolicy: "prune-then-memory",
  },
  {
    key: "mimi-user-account-storage",
    owner: "userAccountStore",
    version: 1,
    group: "settings",
    backup: false,
    quotaPolicy: "prune-then-memory",
  },
  {
    key: "visual-settings-v4",
    owner: "visualSettingsStore",
    version: 1,
    group: "settings",
    backup: true,
    quotaPolicy: "prune-then-memory",
  },
  {
    key: "waveform-store-v5",
    owner: "waveformStore",
    version: 1,
    group: "settings",
    backup: false,
    quotaPolicy: "prune-then-memory",
  },
] as const;

export const STORAGE_KEYS: ReadonlySet<string> = new Set(
  STORAGE_REGISTRY.map((entry) => entry.key)
);

export const BACKUP_KEYS: readonly string[] = STORAGE_REGISTRY.filter((entry) => entry.backup).map(
  (entry) => entry.key
);

export const STORAGE_KEY_BY_OWNER: ReadonlyMap<string, string> = new Map(
  STORAGE_REGISTRY.map((entry) => [entry.owner, entry.key])
);

/**
 * Non-zustand bare keys that live in the same localStorage namespace but are not managed by a
 * store. They are deliberately excluded from backup/versioning until S6-2 decides their owner.
 */
export const EXTERNAL_KEYS: readonly string[] = [
  "mimimusic_active_view",
  "mimimusic_offline_downloads",
  "visualization-v8-store",
] as const;

const KEY_PATTERN = /^[a-z0-9][a-z0-9_-]*$/;
const GROUP_VALUES: readonly StorageGroup[] = [
  "playback",
  "settings",
  "library",
  "ai",
  "ui",
  "transient",
];

export function getStorageEntry(key: string): StorageEntry | undefined {
  return STORAGE_REGISTRY.find((entry) => entry.key === key);
}

export function getStorageKeyForOwner(owner: string): string | undefined {
  return STORAGE_KEY_BY_OWNER.get(owner);
}

export function assertStorageRegistryIntegrity(): void {
  const seenKeys = new Set<string>();
  const seenOwners = new Set<string>();
  for (const entry of STORAGE_REGISTRY) {
    if (!KEY_PATTERN.test(entry.key)) throw new Error("invalid storage key format: " + entry.key);
    if (seenKeys.has(entry.key)) throw new Error("duplicate storage key: " + entry.key);
    if (seenOwners.has(entry.owner)) throw new Error("duplicate storage owner: " + entry.owner);
    if (!Number.isInteger(entry.version) || entry.version < 1) {
      throw new Error("invalid version for " + entry.key + ": " + entry.version);
    }
    if (!GROUP_VALUES.includes(entry.group)) {
      throw new Error("invalid group for " + entry.key + ": " + entry.group);
    }
    if (EXTERNAL_KEYS.includes(entry.key)) {
      throw new Error("external key must not be registered as store key: " + entry.key);
    }
    seenKeys.add(entry.key);
    seenOwners.add(entry.owner);
  }
}

assertStorageRegistryIntegrity();
