"use client";

import { useSyncExternalStore } from "react";
import { playbackClock } from "@/lib/audio/PlaybackClock";

/** Subscribe a view to the one shared media clock without persisting per-frame state. */
export function usePlaybackClock() {
  return useSyncExternalStore(
    playbackClock.subscribe,
    playbackClock.getSnapshot,
    playbackClock.getServerSnapshot
  );
}
