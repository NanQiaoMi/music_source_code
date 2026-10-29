/**
 * 手势动作执行层。
 *
 * 设计约束：
 * - 只通过 store 的公共状态/方法执行动作（默认 useAudioStore / useUiShellStore / useGestureSettingsStore 的 getState()），
 *   模块顶层不调用 getState，避免 Next.js 服务端导入阶段触碰浏览器状态；
 * - 依赖通过 GestureActionDeps 注入，便于单元测试与控制器复用；
 * - 只返回 GestureActionOutcome 供反馈 UI 展示，不在此处 pushEvent（是否反馈由控制器决定）。
 */

import { useAudioStore } from "@/store/audioStore";
import { useGestureSettingsStore } from "@/store/gestureSettingsStore";
import { useUiShellStore } from "@/store/uiShellStore";
import { formatTime } from "@/utils/formatTime";
import {
  findGestureActionDefinition,
  findGestureCommandDefinition,
  type GestureActionId,
  type GestureActionOutcome,
  type GestureBindings,
  type GestureCommandId,
  type GestureFeedbackTone,
} from "./types";

/** 动作层需要的音频 store 子集（useAudioStore.getState() 的返回值满足该结构）。 */
export interface GestureAudioStoreLike {
  isPlaying: boolean;
  isMuted: boolean;
  volume: number;
  duration: number;
  currentTime: number;
  currentSong: { title?: string } | null;
  queue: readonly unknown[];
  togglePlaybackIntent: () => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  nextSong: () => void;
  prevSong: () => void;
  seekTo: (time: number) => void;
}

export interface GestureUIStoreLike {
  isFullscreenLyrics: boolean;
  toggleFullscreenLyrics: () => void;
}

export interface GestureSettingsStoreLike {
  volumeStep: number;
}

/**
 * 依赖注入。默认全部使用真实 store，测试可替换为内存 mock。
 * getNow 预留给需要统一时基的动作扩展（当前动作判定不依赖时间）。
 */
export interface GestureActionDeps {
  getAudioStore?: () => GestureAudioStoreLike;
  getUiStore?: () => GestureUIStoreLike;
  getSettingsStore?: () => GestureSettingsStoreLike;
  getNow?: () => number;
  /** 覆盖音量步进（0.01 - 0.2）；不传则读取手势设置 store。 */
  volumeStep?: number;
  /** 快进/快退步长（秒），默认 10。 */
  seekStepSeconds?: number;
}

const DEFAULT_VOLUME_STEP = 0.05;
const MIN_VOLUME_STEP = 0.01;
const MAX_VOLUME_STEP = 0.2;
const DEFAULT_SEEK_STEP_SECONDS = 10;
const MIN_SEEK_STEP_SECONDS = 1;
const MAX_SEEK_STEP_SECONDS = 120;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function describeErrorSummary(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return "未知错误";
}

function buildOutcome(
  action: GestureActionId,
  ok: boolean,
  detail: string | undefined,
  tone: GestureFeedbackTone
): GestureActionOutcome {
  return {
    ok,
    action,
    label: findGestureActionDefinition(action).label,
    detail,
    tone,
  };
}

interface ResolvedGestureActionDeps {
  audio: GestureAudioStoreLike;
  ui: GestureUIStoreLike;
  volumeStep: number;
  seekStepSeconds: number;
}

function normalizeVolumeStep(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_VOLUME_STEP;
  return clamp(value, MIN_VOLUME_STEP, MAX_VOLUME_STEP);
}

function normalizeSeekStep(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) return DEFAULT_SEEK_STEP_SECONDS;
  return clamp(value, MIN_SEEK_STEP_SECONDS, MAX_SEEK_STEP_SECONDS);
}

function readSettingsVolumeStep(deps: GestureActionDeps): number {
  if (deps.volumeStep !== undefined) return normalizeVolumeStep(deps.volumeStep);
  const getSettingsStore = deps.getSettingsStore ?? (() => useGestureSettingsStore.getState());
  return normalizeVolumeStep(getSettingsStore().volumeStep);
}

function resolveDeps(deps: GestureActionDeps): ResolvedGestureActionDeps {
  const getAudioStore = deps.getAudioStore ?? (() => useAudioStore.getState());
  const getUiStore = deps.getUiStore ?? (() => useUiShellStore.getState());
  return {
    audio: getAudioStore(),
    ui: getUiStore(),
    volumeStep: readSettingsVolumeStep(deps),
    seekStepSeconds: normalizeSeekStep(deps.seekStepSeconds),
  };
}

/**
 * 执行一个手势动作。
 *
 * - 返回结构固定为 GestureActionOutcome：ok=false + tone="error" 表示不可执行（队列为空 / 无歌曲 / 时长未知）；
 * - action="none" 返回 ok=true + tone="info"，控制器可据此跳过反馈；
 * - 真实 store 方法抛错时兜底为 error outcome，不让异常打断识别循环。
 */
export function executeGestureAction(
  actionId: GestureActionId,
  deps: GestureActionDeps = {}
): GestureActionOutcome {
  const resolved = resolveDeps(deps);
  const { audio, ui } = resolved;

  try {
    switch (actionId) {
      case "none":
        return buildOutcome("none", true, "该手势未绑定动作", "info");

      case "next_track":
      case "prev_track": {
        if (audio.queue.length === 0) {
          return buildOutcome(actionId, false, "播放队列为空，无法切换歌曲", "error");
        }
        if (actionId === "next_track") {
          audio.nextSong();
          return buildOutcome(actionId, true, "已切换到下一首", "success");
        }
        audio.prevSong();
        return buildOutcome(actionId, true, "已切换到上一首", "success");
      }

      case "volume_up":
      case "volume_down": {
        const delta = actionId === "volume_up" ? resolved.volumeStep : -resolved.volumeStep;
        const nextVolume = clamp(audio.volume + delta, 0, 1);
        audio.setVolume(nextVolume);
        return buildOutcome(
          actionId,
          true,
          "音量 " + Math.round(nextVolume * 100) + "%",
          "success"
        );
      }

      case "toggle_play": {
        if (!audio.currentSong) {
          return buildOutcome(actionId, false, "当前没有可播放的歌曲", "error");
        }
        const wasPlaying = audio.isPlaying;
        audio.togglePlaybackIntent();
        return buildOutcome(actionId, true, wasPlaying ? "已暂停" : "继续播放", "success");
      }

      case "toggle_mute": {
        const wasMuted = audio.isMuted;
        audio.toggleMute();
        return buildOutcome(actionId, true, wasMuted ? "已取消静音" : "已静音", "success");
      }

      case "seek_forward":
      case "seek_backward": {
        if (!Number.isFinite(audio.duration) || audio.duration <= 0) {
          return buildOutcome(actionId, false, "当前歌曲时长未知，无法调节进度", "error");
        }
        const baseTime = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
        const direction = actionId === "seek_forward" ? 1 : -1;
        const targetTime = clamp(
          baseTime + direction * resolved.seekStepSeconds,
          0,
          audio.duration
        );
        audio.seekTo(targetTime);
        const prefix = actionId === "seek_forward" ? "快进到 " : "快退到 ";
        return buildOutcome(actionId, true, prefix + formatTime(targetTime), "success");
      }

      case "toggle_lyrics": {
        const wasFullscreen = ui.isFullscreenLyrics;
        ui.toggleFullscreenLyrics();
        return buildOutcome(
          actionId,
          true,
          wasFullscreen ? "已退出全屏歌词" : "已进入全屏歌词",
          "success"
        );
      }

      default:
        return buildOutcome(actionId, false, "未知的手势动作", "error");
    }
  } catch (error) {
    return buildOutcome(actionId, false, "动作执行失败：" + describeErrorSummary(error), "error");
  }
}

/**
 * 根据命令手势的绑定表解析要执行的动作。
 * 绑定缺失（旧版本持久化数据）时回退到该命令的默认动作，保证手势可用。
 */
export function resolveGestureActionForCommand(
  command: GestureCommandId,
  bindings: GestureBindings
): GestureActionId {
  const bound = bindings?.[command];
  if (bound) return bound;
  return findGestureCommandDefinition(command).defaultAction;
}
