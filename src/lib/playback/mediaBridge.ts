import { useAudioStore } from "@/store/audioStore";
import { usePlayerStore } from "@/store/playerStore";
import { getPlaybackRuntimeSnapshot } from "@/store/actions/playbackRuntimeActions";
import { flushAllThrottledStorages } from "@/lib/storage/throttledPersist";

/**
 * PlaybackMediaBridge
 *
 * 唯一的媒体事件订阅层：同一个 HTMLAudioElement 无论被多少个 useAudioPlayer
 * 实例挂载，原生监听都只注册一次（12 个事件）。多实例通过引用计数共享原生
 * 监听；事件只分发给"当前活动"的 handler 栈顶（最后挂载的实例），卸载旧实例
 * 不会剥离新实例的监听，全部释放后才移除原生监听。
 *
 * S1-6a：bridge 核心 + 单元测试（hook 接入在 S1-6b 完成）。
 */
export const MEDIA_EVENT_NAMES = [
  "timeupdate",
  "loadedmetadata",
  "durationchange",
  "loadstart",
  "canplay",
  "waiting",
  "playing",
  "play",
  "pause",
  "ended",
  "error",
  "ratechange",
] as const;

export type MediaEventName = (typeof MEDIA_EVENT_NAMES)[number];

export interface MediaSnapshot {
  currentTime: number;
  duration: number;
  buffered: number;
  isPlaying: boolean;
  isLoading: boolean;
  error: { message: string; code?: string } | null;
  requestId: number;
  deckId: string;
  source: string;
}

export interface MediaBridgeHandlers {
  onEnded?: (snapshot: MediaSnapshot) => void;
  onError?: (error: { message: string; code?: string }, snapshot: MediaSnapshot) => void;
  onPlaying?: () => void;
  onWaiting?: () => void;
  onTimeUpdate?: (currentTime: number) => void;
  onLoadedMetadata?: () => void;
  onDurationChange?: () => void;
  onLoadStart?: () => void;
  onCanPlay?: () => void;
  onPlay?: () => void;
  onPause?: () => void;
  onRateChange?: () => void;
  /** Optional teardown for timers/refs owned by a handler bundle. */
  onRelease?: () => void;
  /** Only the active element (primary deck) should write progress to stores. */
  isActive?: () => boolean;
}

const TIMEUPDATE_THROTTLE_MS = 250;

function emptySnapshot(): MediaSnapshot {
  return {
    currentTime: 0,
    duration: 0,
    buffered: 0,
    isPlaying: false,
    isLoading: false,
    error: null,
    requestId: 0,
    deckId: "",
    source: "",
  };
}

let snapshot: MediaSnapshot = emptySnapshot();
const subscribers = new Set<() => void>();

function notify(): void {
  for (const subscriber of subscribers) {
    try {
      subscriber();
    } catch {
      // subscribers must not break media event dispatch
    }
  }
}

function updateSnapshot(patch: Partial<MediaSnapshot>): void {
  snapshot = { ...snapshot, ...patch };
  notify();
}

function runtimeOwnerPatch(): Partial<MediaSnapshot> {
  const runtime = getPlaybackRuntimeSnapshot();
  return {
    requestId: runtime.requestId,
    deckId: runtime.activeDeckId ?? "",
    source: runtime.activeSource ?? "",
  };
}

function bufferedSeconds(audio: HTMLAudioElement): number {
  try {
    return audio.buffered.length > 0 ? audio.buffered.end(audio.buffered.length - 1) : 0;
  } catch {
    return 0;
  }
}

interface MediaEntry {
  stack: MediaBridgeHandlers[];
  lastTimeUpdateAt: number;
  listeners: Array<{ type: MediaEventName; handler: () => void }>;
}

const entries = new Map<HTMLAudioElement, MediaEntry>();

function topHandlers(audio: HTMLAudioElement): MediaBridgeHandlers | undefined {
  const entry = entries.get(audio);
  return entry?.stack[entry.stack.length - 1];
}

function createListeners(audio: HTMLAudioElement): MediaEntry["listeners"] {
  const entry: MediaEntry = { stack: [], lastTimeUpdateAt: 0, listeners: [] };

  const onTimeUpdate = () => {
    const handlers = topHandlers(audio);
    const isActive = handlers?.isActive ? handlers.isActive() : true;
    if (!isActive) return;

    const currentTime = audio.currentTime;
    if (!Number.isFinite(currentTime)) return;

    const now = Date.now();
    const shouldPersist = now - entry.lastTimeUpdateAt >= TIMEUPDATE_THROTTLE_MS;
    if (shouldPersist) {
      entry.lastTimeUpdateAt = now;
      useAudioStore.setState({ currentTime });
      usePlayerStore.setState({ currentTime });
      updateSnapshot({
        ...runtimeOwnerPatch(),
        currentTime,
        duration: Number.isFinite(audio.duration) ? audio.duration : 0,
        buffered: bufferedSeconds(audio),
      });
    }

    // 原生事件频率仍驱动 AB 循环/预取；仅 store 写入被节流。
    handlers?.onTimeUpdate?.(currentTime);
  };

  const onEnded = () => {
    updateSnapshot({ ...runtimeOwnerPatch(), isPlaying: false, isLoading: false });
    topHandlers(audio)?.onEnded?.(snapshot);
    // S2-2：播完立即补写挂起进度，避免 trailing 窗口内丢最后一次播放位置
    flushAllThrottledStorages();
  };

  const onError = () => {
    const mediaError = audio.error;
    const error = {
      message: mediaError?.message || "Media error",
      code: mediaError ? String(mediaError.code) : undefined,
    };
    updateSnapshot({ ...runtimeOwnerPatch(), error, isLoading: false });
    topHandlers(audio)?.onError?.(error, snapshot);
  };

  const onPlaying = () => {
    updateSnapshot({ ...runtimeOwnerPatch(), isPlaying: true, isLoading: false });
    topHandlers(audio)?.onPlaying?.();
  };

  const onWaiting = () => {
    updateSnapshot({ ...runtimeOwnerPatch(), isLoading: true });
    topHandlers(audio)?.onWaiting?.();
  };

  const onLoadedMetadata = () => {
    updateSnapshot({
      ...runtimeOwnerPatch(),
      duration: Number.isFinite(audio.duration) ? audio.duration : 0,
      currentTime: Number.isFinite(audio.currentTime) ? audio.currentTime : 0,
      buffered: bufferedSeconds(audio),
    });
    topHandlers(audio)?.onLoadedMetadata?.();
  };

  const onDurationChange = () => {
    updateSnapshot({
      ...runtimeOwnerPatch(),
      duration: Number.isFinite(audio.duration) ? audio.duration : 0,
    });
    topHandlers(audio)?.onDurationChange?.();
  };

  const onLoadStart = () => {
    updateSnapshot({ ...runtimeOwnerPatch(), isLoading: true, error: null });
    topHandlers(audio)?.onLoadStart?.();
  };

  const onCanPlay = () => {
    updateSnapshot({ ...runtimeOwnerPatch(), isLoading: false });
    topHandlers(audio)?.onCanPlay?.();
  };

  const onPlay = () => {
    updateSnapshot({ ...runtimeOwnerPatch(), isPlaying: true });
    topHandlers(audio)?.onPlay?.();
  };

  const onPause = () => {
    updateSnapshot({ ...runtimeOwnerPatch(), isPlaying: false, isLoading: false });
    topHandlers(audio)?.onPause?.();
    // S2-2：暂停（含系统媒体键）后立即落盘，恢复精度不依赖 trailing 窗口
    flushAllThrottledStorages();
  };

  const onRateChange = () => {
    topHandlers(audio)?.onRateChange?.();
  };

  return [
    { type: "timeupdate", handler: onTimeUpdate },
    { type: "loadedmetadata", handler: onLoadedMetadata },
    { type: "durationchange", handler: onDurationChange },
    { type: "loadstart", handler: onLoadStart },
    { type: "canplay", handler: onCanPlay },
    { type: "waiting", handler: onWaiting },
    { type: "playing", handler: onPlaying },
    { type: "play", handler: onPlay },
    { type: "pause", handler: onPause },
    { type: "ended", handler: onEnded },
    { type: "error", handler: onError },
    { type: "ratechange", handler: onRateChange },
  ];
}

export const playbackMediaBridge = {
  /**
   * Attach a handler bundle to an audio element. Native listeners are registered
   * only on the first attach; returns an idempotent release function.
   */
  attach(audio: HTMLAudioElement, handlers: MediaBridgeHandlers): () => void {
    let entry = entries.get(audio);
    if (!entry) {
      entry = { stack: [], lastTimeUpdateAt: 0, listeners: createListeners(audio) };
      entries.set(audio, entry);
      for (const { type, handler } of entry.listeners) {
        audio.addEventListener(type, handler);
      }
    }

    entry.stack.push(handlers);
    let released = false;

    return () => {
      if (released) return;
      released = true;

      const currentEntry = entries.get(audio);
      if (!currentEntry) return;

      const index = currentEntry.stack.lastIndexOf(handlers);
      if (index >= 0) currentEntry.stack.splice(index, 1);
      handlers.onRelease?.();

      if (currentEntry.stack.length === 0) {
        for (const { type, handler } of currentEntry.listeners) {
          audio.removeEventListener(type, handler);
        }
        entries.delete(audio);
      }
    };
  },

  getSnapshot(): MediaSnapshot {
    return snapshot;
  },

  subscribe(listener: () => void): () => void {
    subscribers.add(listener);
    return () => {
      subscribers.delete(listener);
    };
  },

  getServerSnapshot(): MediaSnapshot {
    return emptySnapshot();
  },

  attachCount(): number {
    let count = 0;
    for (const entry of entries.values()) count += entry.stack.length;
    return count;
  },

  disposeForTests(): void {
    for (const [audio, entry] of entries) {
      for (const { type, handler } of entry.listeners) {
        audio.removeEventListener(type, handler);
      }
    }
    entries.clear();
    subscribers.clear();
    snapshot = emptySnapshot();
  },
};
