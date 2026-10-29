/**
 * Playback phase marks (S0-6b): browser-only first-sound measurement
 * (intent → source-ready → playing → first-sound). Marks use the User Timing API
 * (`mimi:playback:<kind>`), mirror into a small in-memory timeline, and notify
 * listeners via `CustomEvent("mimi:playback-mark")`. Disabled in production and
 * never throws outside a browser — measurement must never affect playback.
 */
export type PlaybackMarkKind = "intent" | "source-ready" | "playing" | "first-sound";

export interface PlaybackMarkDetail {
  songId?: string;
  source?: string;
}

export interface PlaybackMarkEntry extends PlaybackMarkDetail {
  kind: PlaybackMarkKind;
  /** User Timing mark name, e.g. `mimi:playback:intent`. */
  name: string;
  /** `performance.now()` timestamp in milliseconds. */
  at: number;
}

export const PLAYBACK_MARK_PREFIX = "mimi:playback:";
export const PLAYBACK_MARK_EVENT = "mimi:playback-mark";

const MAX_ENTRIES = 64;
const IS_PRODUCTION = process.env.NODE_ENV === "production";

let entries: PlaybackMarkEntry[] = [];
let firstSoundSeen = false;

function canMark(): boolean {
  return (
    !IS_PRODUCTION &&
    typeof window !== "undefined" &&
    typeof performance !== "undefined" &&
    typeof performance.mark === "function"
  );
}

/** Record one playback phase mark. No-op (never throws) outside a browser. */
export function markPlayback(kind: PlaybackMarkKind, detail: PlaybackMarkDetail = {}): void {
  if (!canMark()) return;
  try {
    const at = performance.now();
    if (kind === "intent") {
      firstSoundSeen = false;
    } else if (kind === "first-sound") {
      // 每次 intent 只认第一声，pause/resume 不重复计入。
      if (firstSoundSeen) return;
      firstSoundSeen = true;
    }
    const entry: PlaybackMarkEntry = {
      ...detail,
      kind,
      name: `${PLAYBACK_MARK_PREFIX}${kind}`,
      at,
    };
    performance.mark(entry.name);
    entries.push(entry);
    if (entries.length > MAX_ENTRIES) entries = entries.slice(-MAX_ENTRIES);
    window.dispatchEvent(new CustomEvent(PLAYBACK_MARK_EVENT, { detail: entry }));
  } catch {
    // 测量不得影响播放：任何环境异常都吞掉。
  }
}

/** In-memory timeline of the most recent marks (oldest → newest). */
export function getPlaybackMarks(): readonly PlaybackMarkEntry[] {
  return entries;
}

export function resetPlaybackMarks(): void {
  entries = [];
  firstSoundSeen = false;
}

/** Latest request's intent → first-sound, falling back to its first playing. */
export function getFirstSoundMs(): number | null {
  let intentIndex = -1;
  for (let i = entries.length - 1; i >= 0; i -= 1) {
    if (entries[i].kind === "intent") {
      intentIndex = i;
      break;
    }
  }
  if (intentIndex < 0) return null;
  const intentAt = entries[intentIndex].at;
  let playingAt: number | null = null;
  for (let i = intentIndex + 1; i < entries.length; i += 1) {
    const entry = entries[i];
    if (entry.kind === "first-sound") return Math.max(0, entry.at - intentAt);
    if (entry.kind === "playing" && playingAt === null) playingAt = entry.at;
  }
  return playingAt === null ? null : Math.max(0, playingAt - intentAt);
}
