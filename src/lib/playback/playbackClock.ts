/**
 * S6-4：播放进度的唯一外部快照（PlaybackClock）。
 *
 * 数据源不变：mediaBridge/useAudioPlayer 的 timeupdate 以 250ms 节流写 audioStore
 * （S6-3 的进度权威），本模块只把同一批写入投影成外部 store 快照，不新增写路径、
 * 不改写频率与节流语义。audioStore 仍保留同名字段作为兼容投影，供尚未迁移的
 * 面板/服务读取；组件/hooks/lib 的进度读点统一走这里。
 *
 * 注意：不要在服务端读 audioStore。服务端/水合首帧固定返回 0/false，
 * 客户端订阅到第一次 store 写入后自然追平。
 */
import { useAudioStore } from "@/store/audioStore";

export interface PlaybackClockSnapshot {
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  isLoading: boolean;
}

type PlaybackClockSource = Pick<
  PlaybackClockSnapshot,
  "currentTime" | "duration" | "isPlaying" | "isLoading"
>;

type AudioStoreLike = {
  getState?: () => PlaybackClockSource;
  subscribe?: (listener: (state: PlaybackClockSource) => void) => () => void;
};

export const PLAYBACK_CLOCK_SERVER_SNAPSHOT: PlaybackClockSnapshot = Object.freeze({
  currentTime: 0,
  duration: 0,
  isPlaying: false,
  isLoading: false,
});

let snapshot: PlaybackClockSnapshot = PLAYBACK_CLOCK_SERVER_SNAPSHOT;
let bridgeInstalled = false;
const listeners = new Set<() => void>();

function finiteTime(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0;
}

function project(source: PlaybackClockSource): PlaybackClockSnapshot {
  return {
    currentTime: finiteTime(source.currentTime),
    duration: finiteTime(source.duration),
    isPlaying: source.isPlaying === true,
    isLoading: source.isLoading === true,
  };
}

function sameSnapshot(a: PlaybackClockSnapshot, b: PlaybackClockSnapshot): boolean {
  return (
    a.currentTime === b.currentTime &&
    a.duration === b.duration &&
    a.isPlaying === b.isPlaying &&
    a.isLoading === b.isLoading
  );
}

function commit(next: PlaybackClockSnapshot): void {
  if (sameSnapshot(snapshot, next)) return;
  snapshot = next;
  listeners.forEach((listener) => listener());
}

function audioStore(): AudioStoreLike {
  return useAudioStore as unknown as AudioStoreLike;
}

function installBridge(): void {
  if (bridgeInstalled || typeof window === "undefined") return;
  const store = audioStore();
  // 测试里会 mock 成只读对象或纯 selector 函数；缺 subscribe 时保持惰性读取。
  if (typeof store.getState !== "function" || typeof store.subscribe !== "function") return;
  bridgeInstalled = true;
  snapshot = project(store.getState());
  store.subscribe((state) => commit(project(state)));
}

/** 桥未安装时（单测 mock）按需读取当前源，避免进度快照永远停在 0。 */
function readLiveSource(): PlaybackClockSnapshot {
  const store = audioStore();
  if (typeof store.getState !== "function") return snapshot;
  const live = project(store.getState());
  if (!sameSnapshot(snapshot, live)) snapshot = live;
  return snapshot;
}

export function getPlaybackClockSnapshot(): PlaybackClockSnapshot {
  if (!bridgeInstalled) {
    installBridge();
    if (!bridgeInstalled) return readLiveSource();
  }
  return snapshot;
}

export function getPlaybackClockServerSnapshot(): PlaybackClockSnapshot {
  return PLAYBACK_CLOCK_SERVER_SNAPSHOT;
}

export function subscribePlaybackClock(listener: () => void): () => void {
  installBridge();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export const playbackClock = {
  subscribe: subscribePlaybackClock,
  getSnapshot: getPlaybackClockSnapshot,
  getServerSnapshot: getPlaybackClockServerSnapshot,
};

// 客户端启动时接上现有进度写路径；服务端保持固定 SSR 默认值。
if (typeof window !== "undefined") installBridge();
