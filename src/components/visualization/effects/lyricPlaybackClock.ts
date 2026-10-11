export interface LyricPlaybackClockState {
  initialized: boolean;
  lastReportedMusicTime: number;
  anchorMusicTime: number;
  lastAnchorFrameTime: number;
  lastDrawFrameTime: number;
  playbackRate: number;
  lastProjectedMusicTime: number;
  wasPlaying: boolean;
}

export interface LyricPlaybackClockInput {
  reportedMusicTime: number;
  frameTimeMs: number;
  isPlaying: boolean;
  playbackRate: number;
  duration?: number;
}

export interface LyricPlaybackClockTick {
  state: LyricPlaybackClockState;
  musicTime: number;
  discontinuity: boolean;
  visualReset: boolean;
}

const MAX_FRAME_GAP_SECONDS = 0.25;
const SEEK_DIVERGENCE_SECONDS = 0.45;

export const createLyricPlaybackClock = (): LyricPlaybackClockState => ({
  initialized: false,
  lastReportedMusicTime: 0,
  anchorMusicTime: 0,
  lastAnchorFrameTime: 0,
  lastDrawFrameTime: 0,
  playbackRate: 1,
  lastProjectedMusicTime: 0,
  wasPlaying: false,
});

const normalizeReportedTime = (value: number, fallback: number): number =>
  Number.isFinite(value) ? Math.max(0, value) : fallback;

const normalizePlaybackRate = (value: number): number =>
  Number.isFinite(value) && value > 0 ? value : 1;

const clampToDuration = (value: number, duration: number | undefined): number => {
  const nonNegative = Math.max(0, value);
  return Number.isFinite(duration) && duration !== undefined && duration > 0
    ? Math.min(nonNegative, duration)
    : nonNegative;
};

/**
 * Projects a store-reported song time between updates using the RAF clock.
 * Normal quarter-second store updates re-anchor without causing a seek. Pause
 * and rate changes preserve the current projection when the store is unchanged;
 * seeks and long frame gaps re-anchor from the latest reported media time.
 */
export const advanceLyricPlaybackClock = (
  previous: LyricPlaybackClockState,
  input: LyricPlaybackClockInput
): LyricPlaybackClockTick => {
  const frameTimeMs = Number.isFinite(input.frameTimeMs)
    ? Math.max(0, input.frameTimeMs)
    : previous.lastDrawFrameTime;
  const reportedMusicTime = normalizeReportedTime(
    input.reportedMusicTime,
    previous.lastReportedMusicTime
  );
  const playbackRate = normalizePlaybackRate(input.playbackRate);

  if (!previous.initialized) {
    const musicTime = clampToDuration(reportedMusicTime, input.duration);
    return {
      state: {
        initialized: true,
        lastReportedMusicTime: reportedMusicTime,
        anchorMusicTime: musicTime,
        lastAnchorFrameTime: frameTimeMs,
        lastDrawFrameTime: frameTimeMs,
        playbackRate,
        lastProjectedMusicTime: musicTime,
        wasPlaying: input.isPlaying,
      },
      musicTime,
      discontinuity: false,
      visualReset: false,
    };
  }

  const frameDeltaSeconds = Math.max(0, (frameTimeMs - previous.lastDrawFrameTime) / 1000);
  const storeTimeChanged = Math.abs(reportedMusicTime - previous.lastReportedMusicTime) > 0.001;
  const movedBackward = reportedMusicTime < previous.lastReportedMusicTime - 0.03;
  const playbackChanged = Math.abs(playbackRate - previous.playbackRate) > 0.001;
  const playingChanged = input.isPlaying !== previous.wasPlaying;
  const longFrameGap = frameDeltaSeconds > MAX_FRAME_GAP_SECONDS;

  const expectedMusicTime = previous.wasPlaying
    ? previous.anchorMusicTime +
      (Math.max(0, frameTimeMs - previous.lastAnchorFrameTime) / 1000) * previous.playbackRate
    : previous.anchorMusicTime;

  const reportDivergence = Math.abs(reportedMusicTime - expectedMusicTime);
  const isPausedSeek = !input.isPlaying && !playingChanged && storeTimeChanged;
  const isForwardSeek = storeTimeChanged && reportDivergence > SEEK_DIVERGENCE_SECONDS;
  const discontinuity =
    longFrameGap ||
    playbackChanged ||
    playingChanged ||
    movedBackward ||
    isPausedSeek ||
    isForwardSeek;
  const visualReset = longFrameGap || movedBackward || isPausedSeek || isForwardSeek;

  let musicTime: number;
  let anchorFrameTime: number;
  let anchorMusicTime: number;

  if (discontinuity) {
    const mustUseReportedTime =
      longFrameGap ||
      movedBackward ||
      isPausedSeek ||
      isForwardSeek ||
      (playingChanged && storeTimeChanged);
    musicTime = mustUseReportedTime ? reportedMusicTime : expectedMusicTime;
    anchorFrameTime = frameTimeMs;
    anchorMusicTime = musicTime;
  } else if (input.isPlaying) {
    if (storeTimeChanged) {
      musicTime = reportedMusicTime;
      anchorFrameTime = frameTimeMs;
      anchorMusicTime = reportedMusicTime;
    } else {
      musicTime = expectedMusicTime;
      anchorFrameTime = previous.lastAnchorFrameTime;
      anchorMusicTime = previous.anchorMusicTime;
    }
  } else {
    musicTime = previous.anchorMusicTime;
    anchorFrameTime = frameTimeMs;
    anchorMusicTime = musicTime;
  }

  musicTime = clampToDuration(musicTime, input.duration);
  anchorMusicTime = clampToDuration(anchorMusicTime, input.duration);

  return {
    state: {
      initialized: true,
      lastReportedMusicTime: reportedMusicTime,
      anchorMusicTime,
      lastAnchorFrameTime: anchorFrameTime,
      lastDrawFrameTime: frameTimeMs,
      playbackRate,
      lastProjectedMusicTime: musicTime,
      wasPlaying: input.isPlaying,
    },
    musicTime,
    discontinuity,
    visualReset,
  };
};
