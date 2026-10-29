/**
 * S7-9a OPFS audio blob store (spike, feature-flagged, default off).
 *
 * The IndexedDB cache keeps whole audio files as ArrayBuffers, so reading one
 * deserializes tens of MB onto the main thread; OPFS hands the same bytes back
 * through a file handle. This is a measurement vehicle, not a playback path:
 * nothing in the app imports it yet (migration is a BACKLOG/S8-6 item). No entry
 * point throws - each resolves to a result object, and when the flag is off or
 * OPFS is missing the call goes to the existing IndexedDB audio cache
 * (services/networkAudioCache, source = "opfs-fallback").
 *
 * Flag: NEXT_PUBLIC_ENABLE_OPFS=on|true -> featureFlags.opfsAudio (default false).
 */

import { featureFlags } from "@/lib/perf/featureFlags";
import {
  deleteCachedAudio,
  getAllCachedAudioMeta,
  getCachedAudio,
  makeCacheKey,
  saveCachedAudio,
} from "@/services/networkAudioCache";

/** Directory under the OPFS root; one file per audio id. */
export const OPFS_AUDIO_DIR = "mimi-audio";
/** Source namespace used when falling back to the IndexedDB audio cache. */
export const OPFS_AUDIO_SOURCE = "opfs-fallback";
const EXT = ".bin";
const QUOTA_NAMES = new Set(["QuotaExceededError", "NS_ERROR_DOM_QUOTA_REACHED"]);
const QUOTA_CODES = new Set([22, 1014]);

export type OpfsReason =
  | "flag-disabled"
  | "unsupported"
  | "quota"
  | "aborted"
  | "not-found"
  | "error";
export type OpfsBackend = "opfs" | "indexeddb";
export type OpfsResult<T> = ({ ok: true } & T) | { ok: false; reason: OpfsReason };
export type OpfsEntry = { id: string; bytes: number };
export interface OpfsAvailability {
  available: boolean;
  reason?: OpfsReason;
}
export interface OpfsStats {
  available: boolean;
  reason?: OpfsReason;
  backend: OpfsBackend;
  count: number;
  bytes: number;
  quotaBytes?: number;
  usageBytes?: number;
}

/** Structural subset of the OPFS handles, so tests can supply plain fakes. */
type AudioWritable = {
  write(data: Blob | ArrayBuffer): Promise<void>;
  close(): Promise<void>;
  abort(): Promise<void>;
};
type AudioFileHandle = { getFile(): Promise<File>; createWritable(): Promise<AudioWritable> };
type AudioDir = {
  getFileHandle(name: string, options?: { create?: boolean }): Promise<AudioFileHandle>;
  removeEntry(name: string, options?: { recursive?: boolean }): Promise<void>;
  values(): AsyncIterableIterator<{ kind: string; name: string }>;
};

const fileName = (id: string) => encodeURIComponent(id) + EXT;

function idFromFileName(name: string): string | null {
  if (!name.endsWith(EXT)) return null;
  try {
    return decodeURIComponent(name.slice(0, -EXT.length));
  } catch {
    return null;
  }
}

function classify(error: unknown): OpfsReason {
  const err = error as { name?: string; code?: number } | null;
  if (
    (err?.name && QUOTA_NAMES.has(err.name)) ||
    (typeof err?.code === "number" && QUOTA_CODES.has(err.code))
  ) {
    return "quota";
  }
  if (err?.name === "AbortError") return "aborted";
  if (err?.name === "NotFoundError") return "not-found";
  return "error";
}

/** Only these two fall back to IndexedDB; a broken or quota-hit OPFS is reported. */
const fallsBack = (reason?: OpfsReason) => reason === "flag-disabled" || reason === "unsupported";

async function audioDir(): Promise<AudioDir> {
  const root = await navigator.storage.getDirectory();
  return (await root.getDirectoryHandle(OPFS_AUDIO_DIR, { create: true })) as unknown as AudioDir;
}

export async function isOpfsAudioSupported(): Promise<OpfsAvailability> {
  if (!featureFlags.opfsAudio) return { available: false, reason: "flag-disabled" };
  if (typeof navigator === "undefined" || typeof navigator.storage?.getDirectory !== "function") {
    return { available: false, reason: "unsupported" };
  }
  try {
    await audioDir();
    return { available: true };
  } catch (error) {
    return { available: false, reason: classify(error) };
  }
}

// ---------- IndexedDB fallback (the existing audio cache) ----------

const toBlob = (data: ArrayBuffer | Blob, type?: string): Blob =>
  data instanceof Blob ? data : new Blob([data], { type: type || "audio/mpeg" });

async function writeViaIndexedDb(
  id: string,
  data: ArrayBuffer | Blob
): Promise<OpfsResult<{ bytes: number; backend: OpfsBackend }>> {
  const blob = toBlob(data);
  try {
    await saveCachedAudio({
      cacheKey: makeCacheKey(id, OPFS_AUDIO_SOURCE),
      songId: id,
      source: OPFS_AUDIO_SOURCE,
      title: id,
      artist: "",
      duration: 0,
      fileData: await blob.arrayBuffer(),
      fileType: blob.type || "audio/mpeg",
      originalUrl: "",
      cachedAt: Date.now(),
      lastPlayedAt: Date.now(),
      fileSize: blob.size,
    });
    // saveCachedAudio resolves even when the IDB write failed (legacy contract).
    return { ok: true, bytes: blob.size, backend: "indexeddb" };
  } catch (error) {
    return { ok: false, reason: classify(error) };
  }
}

async function readViaIndexedDb(
  id: string
): Promise<OpfsResult<{ blob: Blob; bytes: number; backend: OpfsBackend }>> {
  try {
    const record = await getCachedAudio(id, OPFS_AUDIO_SOURCE);
    if (!record) return { ok: false, reason: "not-found" };
    const blob = toBlob(record.fileData, record.fileType);
    return { ok: true, blob, bytes: blob.size, backend: "indexeddb" };
  } catch (error) {
    return { ok: false, reason: classify(error) };
  }
}

// ---------- Public API ----------

export async function writeAudio(
  id: string,
  data: ArrayBuffer | Blob,
  options: { signal?: AbortSignal } = {}
): Promise<OpfsResult<{ bytes: number; backend: OpfsBackend }>> {
  const availability = await isOpfsAudioSupported();
  if (!availability.available) {
    if (fallsBack(availability.reason)) return writeViaIndexedDb(id, data);
    return { ok: false, reason: availability.reason ?? "error" };
  }
  const bytes = data instanceof Blob ? data.size : data.byteLength;
  let writable: AudioWritable | null = null;
  const onAbort = () => {
    void writable?.abort().catch(() => {});
  };
  try {
    const handle = await (await audioDir()).getFileHandle(fileName(id), { create: true });
    writable = await handle.createWritable();
    if (options.signal) {
      if (options.signal.aborted) throw new DOMException("Aborted", "AbortError");
      options.signal.addEventListener("abort", onAbort, { once: true });
    }
    await writable.write(data);
    await writable.close();
    return { ok: true, bytes, backend: "opfs" };
  } catch (error) {
    await writable?.abort().catch(() => {});
    return { ok: false, reason: classify(error) };
  } finally {
    options.signal?.removeEventListener("abort", onAbort);
  }
}

export async function readAudio(
  id: string
): Promise<OpfsResult<{ blob: Blob; bytes: number; backend: OpfsBackend }>> {
  const availability = await isOpfsAudioSupported();
  if (!availability.available) {
    if (fallsBack(availability.reason)) return readViaIndexedDb(id);
    return { ok: false, reason: availability.reason ?? "error" };
  }
  try {
    const handle = await (await audioDir()).getFileHandle(fileName(id));
    const file = await handle.getFile();
    return { ok: true, blob: file, bytes: file.size, backend: "opfs" };
  } catch (error) {
    const reason = classify(error);
    // Entries cached before the flag was enabled still live in IndexedDB.
    return reason === "not-found" ? readViaIndexedDb(id) : { ok: false, reason };
  }
}

/** Clears both stores so a flag flip cannot resurrect a stale blob. */
export async function deleteAudio(id: string): Promise<OpfsResult<{ backend: OpfsBackend }>> {
  const availability = await isOpfsAudioSupported();
  if (availability.available) {
    try {
      await (await audioDir()).removeEntry(fileName(id));
    } catch (error) {
      const reason = classify(error);
      if (reason !== "not-found") return { ok: false, reason };
    }
  } else if (!fallsBack(availability.reason)) {
    return { ok: false, reason: availability.reason ?? "error" };
  }
  await deleteCachedAudio(makeCacheKey(id, OPFS_AUDIO_SOURCE)).catch(() => {});
  return { ok: true, backend: availability.available ? "opfs" : "indexeddb" };
}

export async function listAudio(): Promise<
  OpfsResult<{ entries: OpfsEntry[]; backend: OpfsBackend }>
> {
  const availability = await isOpfsAudioSupported();
  if (!availability.available) {
    if (!fallsBack(availability.reason)) {
      return { ok: false, reason: availability.reason ?? "error" };
    }
    const metas = await getAllCachedAudioMeta().catch(() => []);
    const entries = metas
      .filter((meta) => meta.source === OPFS_AUDIO_SOURCE)
      .map((meta) => ({ id: meta.songId, bytes: meta.fileSize ?? 0 }))
      .sort((a, b) => a.id.localeCompare(b.id));
    return { ok: true, entries, backend: "indexeddb" };
  }
  try {
    const dir = await audioDir();
    const entries: OpfsEntry[] = [];
    for await (const handle of dir.values()) {
      if (handle.kind !== "file") continue;
      const id = idFromFileName(handle.name);
      if (!id) continue;
      const file = await (handle as unknown as AudioFileHandle).getFile();
      entries.push({ id, bytes: file.size });
    }
    entries.sort((a, b) => a.id.localeCompare(b.id));
    return { ok: true, entries, backend: "opfs" };
  } catch (error) {
    return { ok: false, reason: classify(error) };
  }
}

export async function getStats(): Promise<OpfsStats> {
  const listed = await listAudio();
  if (!listed.ok) {
    return { available: false, reason: listed.reason, backend: "opfs", count: 0, bytes: 0 };
  }
  const stats: OpfsStats = {
    available: listed.backend === "opfs",
    backend: listed.backend,
    count: listed.entries.length,
    bytes: listed.entries.reduce((sum, entry) => sum + entry.bytes, 0),
  };
  if (stats.available && typeof navigator.storage?.estimate === "function") {
    try {
      const estimate = await navigator.storage.estimate();
      stats.quotaBytes = estimate.quota;
      stats.usageBytes = estimate.usage;
    } catch {
      // estimate() is best-effort: quota numbers stay undefined.
    }
  }
  return stats;
}
