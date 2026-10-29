/**
 * Single open/upgrade entry point for the shared local-music IndexedDB.
 *
 * localMusicService (v1 `musicFiles`) and localMusicStorage (v2 `localMusic` /
 * `musicMetadata` / `offline_audios`) used to open the same database at two different
 * versions; the second open failed with VersionError, which was swallowed, so imported
 * `local://` songs silently disappeared. v3 keeps the v1/v2 schema verbatim: stores are
 * only created when missing, never deleted and never re-keyed.
 */

export const VIBE_MUSIC_DB_NAME = "VibeMusicDB";
export const VIBE_MUSIC_DB_VERSION = 3;

export interface VibeMusicStoreSpec {
  /** Real store name, kept verbatim from v1/v2 so existing records stay readable. */
  readonly name: string;
  readonly keyPath: string;
  /** Index name === key path; only created together with the store. */
  readonly indexes?: readonly string[];
}

export const VIBE_MUSIC_STORES = {
  musicFiles: { name: "musicFiles", keyPath: "id" },
  localMusic: { name: "localMusic", keyPath: "id" },
  musicMetadata: { name: "musicMetadata", keyPath: "id" },
  offlineAudios: {
    name: "offline_audios",
    keyPath: "songId",
    indexes: ["downloadedAt", "lastPlayedAt", "isPinned"],
  },
} as const satisfies Record<string, VibeMusicStoreSpec>;

const STORE_SPECS: readonly VibeMusicStoreSpec[] = Object.values(VIBE_MUSIC_STORES);

export type VibeMusicDbErrorCode =
  | "version-conflict"
  | "blocked"
  | "missing-store"
  | "quota"
  | "unknown";

export class VibeMusicDbError extends Error {
  readonly code: VibeMusicDbErrorCode;
  readonly cause?: unknown;

  constructor(code: VibeMusicDbErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = "VibeMusicDbError";
    this.code = code;
    this.cause = cause;
  }
}

export function classifyVibeMusicDbError(error: unknown): VibeMusicDbErrorCode {
  if (error instanceof VibeMusicDbError) return error.code;
  const candidate = error as { name?: string; code?: number } | null | undefined;
  if (candidate?.name === "VersionError") return "version-conflict";
  if (candidate?.name === "NotFoundError") return "missing-store";
  if (candidate?.name === "QuotaExceededError" || candidate?.code === 22) return "quota";
  if (candidate?.code === 1014) return "quota";
  return "unknown";
}

let dbPromise: Promise<IDBDatabase> | null = null;
let connection: IDBDatabase | null = null;

function closeActiveDb(): void {
  connection?.close();
  connection = null;
  dbPromise = null;
}

/** Only creates stores that are missing; existing stores and key paths are never touched. */
function createMissingStores(db: IDBDatabase): void {
  for (const spec of STORE_SPECS) {
    if (db.objectStoreNames.contains(spec.name)) continue;
    const store = db.createObjectStore(spec.name, { keyPath: spec.keyPath });
    for (const index of spec.indexes ?? []) {
      store.createIndex(index, index, { unique: false });
    }
  }
}

/** Opens (upgrading to v3 on first use) the shared database; concurrent callers share one connection. */
export function openVibeMusicDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new VibeMusicDbError("unknown", "IndexedDB is not available"));
  }

  const pending = new Promise<IDBDatabase>((resolve, reject) => {
    let settled = false;
    const fail = (error: VibeMusicDbError) => {
      if (settled) return;
      settled = true;
      dbPromise = null; // a failed open must not poison later retries
      reject(error);
    };

    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(VIBE_MUSIC_DB_NAME, VIBE_MUSIC_DB_VERSION);
    } catch (error) {
      fail(new VibeMusicDbError(classifyVibeMusicDbError(error), "open() threw", error));
      return;
    }

    request.onupgradeneeded = () => createMissingStores(request.result);
    request.onblocked = () => {
      console.warn("[VibeMusicDB] upgrade blocked by another open connection");
      fail(new VibeMusicDbError("blocked", "Upgrade blocked by another connection; retry later"));
    };
    request.onerror = () => {
      const error = request.error;
      fail(
        new VibeMusicDbError(
          classifyVibeMusicDbError(error),
          `Failed to open ${VIBE_MUSIC_DB_NAME} v${VIBE_MUSIC_DB_VERSION}`,
          error
        )
      );
    };
    request.onsuccess = () => {
      const db = request.result;
      if (settled) {
        db.close();
        return;
      }
      // Another tab wants to upgrade: release the connection so it is not blocked.
      db.onversionchange = () => {
        console.warn("[VibeMusicDB] versionchange received; closing connection");
        closeActiveDb();
      };
      connection = db;
      settled = true;
      resolve(db);
    };
  });

  dbPromise = pending;
  void pending.catch(() => undefined); // callers may only await a later open
  return pending;
}

/** Test-only: close the cached connection and drop the singleton. */
export function resetVibeMusicDbForTests(): void {
  closeActiveDb();
}
