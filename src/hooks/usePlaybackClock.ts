"use client";

import { useCallback, useRef, useSyncExternalStore } from "react";
import {
  getPlaybackClockServerSnapshot,
  getPlaybackClockSnapshot,
  subscribePlaybackClock,
  type PlaybackClockSnapshot,
} from "@/lib/playback/playbackClock";

type EqualityFn<T> = (previous: T, next: T) => boolean;

/**
 * 订阅 PlaybackClock 的一个切片：只有 selector 结果变化时才重渲染，
 * 因此 isPlaying/isLoading 消费方不会被 250ms 的 currentTime 更新带着重绘。
 */
export function usePlaybackClock<T>(
  selector: (snapshot: PlaybackClockSnapshot) => T,
  isEqual: EqualityFn<T> = Object.is
): T {
  const cacheRef = useRef<{
    snapshot: PlaybackClockSnapshot;
    selector: (snapshot: PlaybackClockSnapshot) => T;
    value: T;
  } | null>(null);

  const getSelected = useCallback(() => {
    const current = getPlaybackClockSnapshot();
    const cached = cacheRef.current;
    if (cached && cached.snapshot === current && cached.selector === selector) {
      return cached.value;
    }

    const next = selector(current);
    if (cached && isEqual(cached.value, next)) {
      cacheRef.current = { snapshot: current, selector, value: cached.value };
      return cached.value;
    }
    cacheRef.current = { snapshot: current, selector, value: next };
    return next;
  }, [isEqual, selector]);

  const getServerSelected = useCallback(
    () => selector(getPlaybackClockServerSnapshot()),
    [selector]
  );

  return useSyncExternalStore(subscribePlaybackClock, getSelected, getServerSelected);
}
