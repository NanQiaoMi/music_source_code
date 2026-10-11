export type PlaybackMediaEventType = "playing" | "waiting" | "pause" | "ended";

export interface PlaybackMediaSnapshot {
  paused: boolean;
  ended: boolean;
  readyState: number;
  hasError: boolean;
  shouldPlay: boolean;
}

/**
 * Media events are queued by the browser and do not carry the request generation
 * that created them. Validate the element's live state before accepting one so a
 * stale event for a reused deck cannot overwrite the current playback phase.
 */
export function shouldAcceptPlaybackMediaEvent(
  type: PlaybackMediaEventType,
  media: PlaybackMediaSnapshot
): boolean {
  if (media.hasError) return false;

  switch (type) {
    case "playing":
      return !media.paused && !media.ended && media.readyState >= 2;
    case "waiting":
      return media.shouldPlay && !media.paused && !media.ended && media.readyState < 3;
    case "pause":
      return media.paused;
    case "ended":
      return media.ended;
  }
}
