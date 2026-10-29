import type { PlaybackMachineState, PlaybackPhase } from "@/lib/audio/playbackStateMachine";
import { getPlaybackRuntimeSnapshot } from "@/store/actions/playbackRuntimeActions";
import { usePlaybackRuntimeStore } from "@/store/playbackRuntimeStore";

export interface PlaybackClockSnapshot {
  currentTime: number;
  duration: number;
  playbackRate: number;
  requestId: number;
  targetSongId: string | null;
  targetSource: string | null;
  activeDeckId: string | null;
  source: string | null;
  phase: PlaybackPhase;
}

export interface PlaybackClockScheduler {
  requestFrame: (callback: () => void) => number;
  cancelFrame: (handle: number) => void;
  isVisible: () => boolean;
}

const SERVER_SNAPSHOT: PlaybackClockSnapshot = {
  currentTime: 0,
  duration: 0,
  playbackRate: 1,
  requestId: 0,
  targetSongId: null,
  targetSource: null,
  activeDeckId: null,
  source: null,
  phase: "idle",
};

const MEDIA_EVENTS = [
  "timeupdate",
  "seeking",
  "seeked",
  "ratechange",
  "durationchange",
  "loadedmetadata",
] as const;

const defaultScheduler: PlaybackClockScheduler = {
  requestFrame: (callback) => {
    if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
      return window.requestAnimationFrame(callback);
    }
    return window.setTimeout(callback, 16);
  },
  cancelFrame: (handle) => {
    if (typeof window !== "undefined" && typeof window.cancelAnimationFrame === "function") {
      window.cancelAnimationFrame(handle);
    } else if (typeof window !== "undefined") {
      window.clearTimeout(handle);
    }
  },
  isVisible: () => typeof document === "undefined" || document.visibilityState !== "hidden",
};

function getFiniteCurrentTime(media: HTMLAudioElement): number {
  const time = media.currentTime;
  if (!Number.isFinite(time) || time < 0) return 0;
  return time;
}

function getFiniteDuration(media: HTMLAudioElement): number {
  const duration = media.duration;
  return Number.isFinite(duration) && duration > 0 ? duration : 0;
}

function getFinitePlaybackRate(media: HTMLAudioElement): number {
  const rate = media.playbackRate;
  return Number.isFinite(rate) && rate > 0 ? rate : 1;
}

function sourceIdentity(source: string): string {
  if (typeof window === "undefined") return source;
  try {
    return new URL(source, window.location.href).href;
  } catch {
    return source;
  }
}

export class PlaybackClock {
  private readonly scheduler: PlaybackClockScheduler;
  private readonly listeners = new Set<() => void>();
  private snapshot: PlaybackClockSnapshot = SERVER_SNAPSHOT;
  private media: HTMLAudioElement | null = null;
  private mediaEventListener: EventListener | null = null;
  private frameHandle: number | null = null;
  private pendingReset = false;
  private lastMediaSource: string | null = null;
  private visibilityListenerAttached = false;

  constructor(scheduler: PlaybackClockScheduler = defaultScheduler) {
    this.scheduler = scheduler;
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    this.ensureFrameLoop();
    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0) this.stopFrameLoop();
    };
  };

  getSnapshot = (): PlaybackClockSnapshot => this.snapshot;

  getServerSnapshot = (): PlaybackClockSnapshot => SERVER_SNAPSHOT;

  attach(
    media: HTMLAudioElement,
    requestId: number,
    targetSongId: string | null,
    deckId: string,
    source: string
  ): void {
    const nextSource = sourceIdentity(source);
    const runtime = getPlaybackRuntimeSnapshot();
    const requestedTargetSource =
      runtime.requestId === requestId ? runtime.targetSource : this.snapshot.targetSource;
    const isSameTrack =
      this.snapshot.targetSongId === targetSongId &&
      this.snapshot.targetSource === requestedTargetSource &&
      (this.snapshot.source === nextSource || this.lastMediaSource === nextSource);
    const isSameBinding =
      this.media === media &&
      this.snapshot.requestId === requestId &&
      this.snapshot.activeDeckId === deckId &&
      this.snapshot.source === nextSource;

    if (isSameBinding) {
      this.refreshFromMedia();
      this.ensureFrameLoop();
      return;
    }

    this.detachMedia();
    this.media = media;
    this.lastMediaSource = nextSource;
    this.pendingReset = !isSameTrack;
    this.addVisibilityListener();
    this.mediaEventListener = (event: Event) => {
      if (this.media !== media) return;
      if (event.type === "loadedmetadata") this.pendingReset = false;
      this.refreshFromMedia();
    };
    MEDIA_EVENTS.forEach((eventName) => {
      media.addEventListener(eventName, this.mediaEventListener as EventListener);
    });

    this.updateSnapshot({
      currentTime: isSameTrack ? this.snapshot.currentTime : 0,
      duration: isSameTrack ? this.snapshot.duration : 0,
      playbackRate: getFinitePlaybackRate(media),
      requestId,
      targetSongId,
      targetSource: this.snapshot.targetSource,
      activeDeckId: deckId,
      source: nextSource,
      phase: runtime.requestId === requestId ? runtime.phase : "loading",
    });
    this.refreshFromMedia();
    this.ensureFrameLoop();
  }

  syncRuntime(runtime: PlaybackMachineState): void {
    const currentTargetSame =
      runtime.targetSongId === this.snapshot.targetSongId &&
      runtime.targetSource === this.snapshot.targetSource;
    const activeBindingMatches =
      runtime.requestId === this.snapshot.requestId &&
      runtime.activeDeckId === this.snapshot.activeDeckId &&
      runtime.activeSource === this.snapshot.source &&
      runtime.targetSongId === this.snapshot.targetSongId;

    if (!activeBindingMatches) {
      const preserveTime = currentTargetSame;
      this.detachMedia();
      this.pendingReset = !preserveTime;
      this.updateSnapshot({
        currentTime: preserveTime ? this.snapshot.currentTime : 0,
        duration: preserveTime ? this.snapshot.duration : 0,
        playbackRate: preserveTime ? this.snapshot.playbackRate : 1,
        requestId: runtime.requestId,
        targetSongId: runtime.targetSongId,
        targetSource: runtime.targetSource,
        activeDeckId: runtime.activeDeckId,
        source: runtime.activeSource,
        phase: runtime.phase,
      });
    } else if (runtime.phase !== this.snapshot.phase) {
      this.updateSnapshot({ ...this.snapshot, phase: runtime.phase });
      this.refreshFromMedia();
    }

    if (runtime.phase !== "playing") this.stopFrameLoop();
    else this.ensureFrameLoop();
  }

  refreshFromMedia(): void {
    const media = this.media;
    if (!media) return;

    const activeSource = this.snapshot.source;
    const currentSource = media.currentSrc ? sourceIdentity(media.currentSrc) : null;
    const elementSource = media.src ? sourceIdentity(media.src) : null;
    // currentSrc can expose the final URL after HTTP redirects. Keep the
    // requested src as a valid ownership match in that case.
    const sourceIsCurrent = currentSource === activeSource || elementSource === activeSource;

    if (!sourceIsCurrent || this.pendingReset) {
      this.updateSnapshot({
        ...this.snapshot,
        currentTime: 0,
        duration: 0,
        playbackRate: getFinitePlaybackRate(media),
      });
      return;
    }

    const duration = getFiniteDuration(media);
    const currentTime = getFiniteCurrentTime(media);
    this.updateSnapshot({
      ...this.snapshot,
      currentTime: duration > 0 ? Math.min(currentTime, duration) : currentTime,
      duration,
      playbackRate: getFinitePlaybackRate(media),
    });
  }

  resync(): void {
    this.refreshFromMedia();
    this.ensureFrameLoop();
  }

  handleVisibilityChange(): void {
    if (!this.scheduler.isVisible()) {
      this.stopFrameLoop();
      return;
    }
    this.resync();
  }

  dispose(): void {
    this.detachMedia();
    this.removeVisibilityListener();
    this.listeners.clear();
  }

  private updateSnapshot(next: PlaybackClockSnapshot): void {
    const previous = this.snapshot;
    const unchanged =
      previous.currentTime === next.currentTime &&
      previous.duration === next.duration &&
      previous.playbackRate === next.playbackRate &&
      previous.requestId === next.requestId &&
      previous.targetSongId === next.targetSongId &&
      previous.targetSource === next.targetSource &&
      previous.activeDeckId === next.activeDeckId &&
      previous.source === next.source &&
      previous.phase === next.phase;
    if (unchanged) return;

    this.snapshot = next;
    this.listeners.forEach((listener) => listener());
  }

  private ensureFrameLoop(): void {
    if (
      this.frameHandle !== null ||
      !this.media ||
      this.snapshot.phase !== "playing" ||
      this.listeners.size === 0 ||
      !this.scheduler.isVisible()
    ) {
      return;
    }
    this.frameHandle = this.scheduler.requestFrame(this.tick);
  }

  private stopFrameLoop(): void {
    if (this.frameHandle === null) return;
    this.scheduler.cancelFrame(this.frameHandle);
    this.frameHandle = null;
  }

  private tick = (): void => {
    this.frameHandle = null;
    if (
      !this.media ||
      this.snapshot.phase !== "playing" ||
      this.listeners.size === 0 ||
      !this.scheduler.isVisible()
    ) {
      return;
    }
    this.refreshFromMedia();
    this.ensureFrameLoop();
  };

  private detachMedia(): void {
    this.stopFrameLoop();
    if (this.media && this.mediaEventListener) {
      MEDIA_EVENTS.forEach((eventName) => {
        this.media?.removeEventListener(eventName, this.mediaEventListener as EventListener);
      });
    }
    this.media = null;
    this.mediaEventListener = null;
    this.removeVisibilityListener();
  }

  private addVisibilityListener(): void {
    if (this.visibilityListenerAttached || typeof document === "undefined") return;
    document.addEventListener("visibilitychange", this.onDocumentVisibilityChange);
    this.visibilityListenerAttached = true;
  }

  private removeVisibilityListener(): void {
    if (!this.visibilityListenerAttached || typeof document === "undefined") return;
    document.removeEventListener("visibilitychange", this.onDocumentVisibilityChange);
    this.visibilityListenerAttached = false;
  }

  private onDocumentVisibilityChange = (): void => {
    this.handleVisibilityChange();
  };
}

export const playbackClock = new PlaybackClock();

usePlaybackRuntimeStore.subscribe((runtime) => playbackClock.syncRuntime(runtime));
playbackClock.syncRuntime(getPlaybackRuntimeSnapshot());
