/**
 * PlaybackRequestCoordinator (S1-8a)
 *
 * 播放请求的唯一协调点：每次开始新的播放请求先 abort 上一个；旧请求的
 * signal 保持 aborted 状态，调用方用 isCurrent/throwIfAborted 丢弃旧结果，
 * 保证同一时刻只有 1 个 in-flight 请求。
 */
export interface PlaybackRequestInput {
  songId: string;
  source: string;
}

export interface PlaybackRequestToken {
  id: number;
  songId: string;
  source: string;
  controller: AbortController;
  startedAt: number;
}

/** 统一用标准 AbortError 作为 abort reason：fetch 等下游据此识别"取消"而不是"失败"。 */
function createAbortError(message: string): DOMException {
  return new DOMException(message, "AbortError");
}

export class PlaybackRequestCoordinator {
  private nextId = 1;
  private current: PlaybackRequestToken | null = null;

  begin(input: PlaybackRequestInput): PlaybackRequestToken {
    const previous = this.current;
    if (previous) {
      previous.controller.abort(createAbortError("Playback request superseded"));
    }

    const token: PlaybackRequestToken = {
      id: this.nextId++,
      songId: input.songId,
      source: input.source,
      controller: new AbortController(),
      startedAt: Date.now(),
    };
    this.current = token;
    return token;
  }

  complete(token: PlaybackRequestToken): void {
    if (this.current && this.current.id === token.id) {
      this.current = null;
    }
  }

  abortAll(reason = "aborted"): void {
    this.current?.controller.abort(createAbortError(reason));
    this.current = null;
  }

  isCurrent(token: PlaybackRequestToken): boolean {
    return (
      this.current !== null && this.current.id === token.id && !token.controller.signal.aborted
    );
  }

  signalOf(token: PlaybackRequestToken): AbortSignal {
    return token.controller.signal;
  }

  inFlight(): number {
    if (!this.current) return 0;
    return this.current.controller.signal.aborted ? 0 : 1;
  }
}

export const playbackRequestCoordinator = new PlaybackRequestCoordinator();

export function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw createAbortError("The operation was aborted");
  }
}

/** abort 不是错误：调用方据此静默退出（不写 store、不弹 toast、不打 warn）。 */
export function isAbortError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { name?: unknown }).name === "AbortError"
  );
}

/**
 * AbortSignal.any 的 polyfill：父 signal 或超时任一触发即 abort。
 * 超时返回的 signal.reason 为 DOMException("TimeoutError")。
 */
export function combineSignals(signal: AbortSignal | undefined, timeoutMs: number): AbortSignal {
  const AnySignal = (AbortSignal as unknown as { any?: (signals: AbortSignal[]) => AbortSignal })
    .any;
  if (typeof AnySignal === "function") {
    return AnySignal([signal, AbortSignal.timeout(timeoutMs)].filter(Boolean) as AbortSignal[]);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort(new DOMException("The operation timed out", "TimeoutError"));
  }, timeoutMs);

  const onAbort = () => {
    clearTimeout(timeoutId);
    controller.abort(signal?.reason);
  };

  if (signal) {
    if (signal.aborted) {
      clearTimeout(timeoutId);
      controller.abort(signal.reason);
    } else {
      signal.addEventListener("abort", onAbort, { once: true });
      controller.signal.addEventListener(
        "abort",
        () => {
          clearTimeout(timeoutId);
          signal.removeEventListener("abort", onAbort);
        },
        { once: true }
      );
    }
  }

  return controller.signal;
}
