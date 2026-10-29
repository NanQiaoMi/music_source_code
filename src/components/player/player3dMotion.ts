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

export interface Player3DFrameLoopPolicyInput {
  /** 当前播放阶段（只有 confirmed playing 才需要采样）。 */
  phase: PlaybackPhase;
  reducedMotion: boolean;
  /**
   * Player3D 常驻挂载，切视图只改 visibility（PlayerView.tsx），组件并不会卸载。
   * 因此必须显式传入当前是否处于播放页，否则 Home 页也会跑满 60fps 采样循环。
   */
  isPlayerViewActive: boolean;
}

/**
 * Player3D 音频采样 rAF 循环是否应该运行。
 *
 * 在 isPlayer3DVisualsActive 的播放状态之上叠加视图门控：离开播放页立即停表，
 * 回到播放页时组件 effect 依赖变化会重启并同步排第一帧（<100ms 恢复采样）。
 * 纯函数，便于在 player3dMotion.test.ts 里覆盖四种组合。
 */
export function shouldRunPlayer3DFrameLoop(input: Player3DFrameLoopPolicyInput): boolean {
  return isPlayer3DVisualsActive(input.phase, input.reducedMotion) && input.isPlayerViewActive;
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
