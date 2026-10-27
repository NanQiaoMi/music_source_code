import type { PlaybackPhase } from "@/lib/audio/playbackStateMachine";

export const PLAYER3D_PRESENCE_MODE = "popLayout" as const;
export const PLAYER3D_TRACK_CHANGE_OFFSET = 5;
export const PLAYER3D_TRACK_CHANGE_TRANSITION = {
  type: "spring" as const,
  stiffness: 520,
  damping: 40,
  mass: 0.42,
  bounce: 0,
};

export function getPlayer3DTrackMotion(reducedMotion: boolean) {
  if (reducedMotion) {
    return {
      offset: 0,
      initial: false,
      exit: { opacity: 1, y: 0, pointerEvents: "none" as const },
      transition: { duration: 0 },
    };
  }

  return {
    offset: PLAYER3D_TRACK_CHANGE_OFFSET,
    initial: { opacity: 1, y: PLAYER3D_TRACK_CHANGE_OFFSET },
    exit: {
      opacity: 0,
      y: -PLAYER3D_TRACK_CHANGE_OFFSET,
      pointerEvents: "none" as const,
    },
    transition: PLAYER3D_TRACK_CHANGE_TRANSITION,
  };
}

const MINIMUM_AUDIO_AURA_OPACITY = 0.06;
const MAXIMUM_AUDIO_AURA_OPACITY = 0.24;
const MAXIMUM_AUDIO_COVER_SCALE = 1.012;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

export function isPlayer3DVisualsActive(phase: PlaybackPhase, reducedMotion: boolean): boolean {
  return phase === "playing" && !reducedMotion;
}

export function readPlayer3DAudioLevel(
  analyser: AnalyserNode | null,
  frequencyData: Uint8Array,
  alreadySampled = false
): number {
  if (
    !analyser ||
    frequencyData.length !== analyser.frequencyBinCount ||
    frequencyData.length === 0
  ) {
    return 0;
  }

  try {
    if (analyser.context.state !== "running") return 0;
    if (!alreadySampled) analyser.getByteFrequencyData(frequencyData as Uint8Array<ArrayBuffer>);
  } catch {
    return 0;
  }

  const sampleCount = Math.max(1, Math.floor(frequencyData.length * 0.35));
  let sampleTotal = 0;
  for (let index = 0; index < sampleCount; index += 1) {
    sampleTotal += frequencyData[index];
  }
  return sampleTotal / (sampleCount * 255);
}

export function getPlayer3DAuraOpacity(isActive: boolean, audioLevel: number): number {
  if (!isActive) return 0;
  return (
    MINIMUM_AUDIO_AURA_OPACITY +
    clamp01(audioLevel) * (MAXIMUM_AUDIO_AURA_OPACITY - MINIMUM_AUDIO_AURA_OPACITY)
  );
}

export function getPlayer3DCoverScale(isActive: boolean, audioLevel: number): number {
  return isActive ? 1 + clamp01(audioLevel) * (MAXIMUM_AUDIO_COVER_SCALE - 1) : 1;
}
