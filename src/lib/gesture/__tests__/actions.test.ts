import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAudioStore } from "@/store/audioStore";
import { useGestureSettingsStore } from "@/store/gestureSettingsStore";
import { useUIStore } from "@/store/uiStore";
import { formatTime } from "@/utils/formatTime";
import {
  executeGestureAction,
  resolveGestureActionForCommand,
  type GestureAudioStoreLike,
  type GestureUIStoreLike,
} from "../actions";
import { createDefaultGestureBindings, type GestureBindings } from "../types";

function createAudioMock(overrides: Partial<GestureAudioStoreLike> = {}): GestureAudioStoreLike {
  return {
    isPlaying: false,
    isMuted: false,
    volume: 0.5,
    duration: 200,
    currentTime: 50,
    currentSong: { title: "测试歌曲" },
    queue: [{}],
    togglePlaybackIntent: vi.fn(),
    setVolume: vi.fn(),
    toggleMute: vi.fn(),
    nextSong: vi.fn(),
    prevSong: vi.fn(),
    seekTo: vi.fn(),
    ...overrides,
  };
}

function createUiMock(overrides: Partial<GestureUIStoreLike> = {}): GestureUIStoreLike {
  return {
    isFullscreenLyrics: false,
    toggleFullscreenLyrics: vi.fn(),
    ...overrides,
  };
}

function createDeps(
  audio: GestureAudioStoreLike,
  ui: GestureUIStoreLike
): { getAudioStore: () => GestureAudioStoreLike; getUiStore: () => GestureUIStoreLike } {
  return {
    getAudioStore: () => audio,
    getUiStore: () => ui,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("resolveGestureActionForCommand", () => {
  it("返回命令手势当前绑定的动作", () => {
    const bindings = {
      ...createDefaultGestureBindings(),
      swipe_left: "toggle_mute",
    } satisfies GestureBindings;

    expect(resolveGestureActionForCommand("swipe_left", bindings)).toBe("toggle_mute");
    expect(resolveGestureActionForCommand("fist_hold", bindings)).toBe("toggle_play");
  });

  it("绑定缺失时回退到默认动作", () => {
    const bindings = {
      ...createDefaultGestureBindings(),
      swipe_up: undefined,
    } as unknown as GestureBindings;

    expect(resolveGestureActionForCommand("swipe_up", bindings)).toBe("volume_up");
  });

  it("绑定 none 时保持 none", () => {
    const bindings = { ...createDefaultGestureBindings(), swipe_down: "none" } as GestureBindings;
    expect(resolveGestureActionForCommand("swipe_down", bindings)).toBe("none");
  });
});

describe("executeGestureAction 音量", () => {
  it("volume_up 按步进增加并输出整数百分比", () => {
    const audio = createAudioMock({ volume: 0.5 });
    const ui = createUiMock();

    const outcome = executeGestureAction("volume_up", {
      ...createDeps(audio, ui),
      volumeStep: 0.1,
    });

    expect(outcome.ok).toBe(true);
    expect(outcome.tone).toBe("success");
    expect(outcome.action).toBe("volume_up");
    expect(outcome.detail).toBe("音量 60%");
    expect(audio.setVolume).toHaveBeenCalledWith(0.6);
  });

  it("volume_down 按步进减少", () => {
    const audio = createAudioMock({ volume: 0.5 });

    const outcome = executeGestureAction("volume_down", {
      ...createDeps(audio, createUiMock()),
      volumeStep: 0.05,
    });

    expect(outcome.detail).toBe("音量 45%");
    expect(audio.setVolume).toHaveBeenCalledWith(0.45);
  });

  it("音量限制在 0-1 区间", () => {
    const loud = createAudioMock({ volume: 0.98 });
    const loudOutcome = executeGestureAction("volume_up", {
      ...createDeps(loud, createUiMock()),
      volumeStep: 0.1,
    });
    expect(loudOutcome.detail).toBe("音量 100%");
    expect(loud.setVolume).toHaveBeenCalledWith(1);

    const quiet = createAudioMock({ volume: 0.03 });
    const quietOutcome = executeGestureAction("volume_down", {
      ...createDeps(quiet, createUiMock()),
      volumeStep: 0.1,
    });
    expect(quietOutcome.detail).toBe("音量 0%");
    expect(quiet.setVolume).toHaveBeenCalledWith(0);
  });
});

describe("executeGestureAction 播放控制", () => {
  it("空队列时 next/prev 返回 error 且不切歌", () => {
    const audio = createAudioMock({ queue: [] });

    const nextOutcome = executeGestureAction("next_track", createDeps(audio, createUiMock()));
    expect(nextOutcome.ok).toBe(false);
    expect(nextOutcome.tone).toBe("error");
    expect(nextOutcome.detail).toContain("队列为空");
    expect(audio.nextSong).not.toHaveBeenCalled();

    const prevOutcome = executeGestureAction("prev_track", createDeps(audio, createUiMock()));
    expect(prevOutcome.ok).toBe(false);
    expect(audio.prevSong).not.toHaveBeenCalled();
  });

  it("队列非空时调用 nextSong / prevSong", () => {
    const audio = createAudioMock({ queue: [{}] });

    const nextOutcome = executeGestureAction("next_track", createDeps(audio, createUiMock()));
    expect(nextOutcome.ok).toBe(true);
    expect(nextOutcome.detail).toBe("已切换到下一首");
    expect(audio.nextSong).toHaveBeenCalledTimes(1);

    const prevOutcome = executeGestureAction("prev_track", createDeps(audio, createUiMock()));
    expect(prevOutcome.ok).toBe(true);
    expect(prevOutcome.detail).toBe("已切换到上一首");
    expect(audio.prevSong).toHaveBeenCalledTimes(1);
  });

  it("没有当前歌曲时 toggle_play 返回 error", () => {
    const audio = createAudioMock({ currentSong: null });

    const outcome = executeGestureAction("toggle_play", createDeps(audio, createUiMock()));

    expect(outcome.ok).toBe(false);
    expect(outcome.tone).toBe("error");
    expect(outcome.detail).toBe("当前没有可播放的歌曲");
    expect(audio.togglePlaybackIntent).not.toHaveBeenCalled();
  });

  it("toggle_play 根据当前播放状态给出反馈", () => {
    const playing = createAudioMock({ isPlaying: true });
    const pausedOutcome = executeGestureAction("toggle_play", createDeps(playing, createUiMock()));
    expect(pausedOutcome.ok).toBe(true);
    expect(pausedOutcome.detail).toBe("已暂停");
    expect(playing.togglePlaybackIntent).toHaveBeenCalledTimes(1);

    const paused = createAudioMock({ isPlaying: false });
    const playOutcome = executeGestureAction("toggle_play", createDeps(paused, createUiMock()));
    expect(playOutcome.detail).toBe("继续播放");
    expect(paused.togglePlaybackIntent).toHaveBeenCalledTimes(1);
  });

  it("toggle_mute 根据静音状态给出反馈", () => {
    const audio = createAudioMock({ isMuted: false });
    const muteOutcome = executeGestureAction("toggle_mute", createDeps(audio, createUiMock()));
    expect(muteOutcome.ok).toBe(true);
    expect(muteOutcome.detail).toBe("已静音");
    expect(audio.toggleMute).toHaveBeenCalledTimes(1);

    const muted = createAudioMock({ isMuted: true });
    const unmuteOutcome = executeGestureAction("toggle_mute", createDeps(muted, createUiMock()));
    expect(unmuteOutcome.detail).toBe("已取消静音");
  });
});

describe("executeGestureAction 进度与歌词", () => {
  it("seek_forward 按步长前进并输出格式化时间", () => {
    const audio = createAudioMock({ currentTime: 50, duration: 200 });

    const outcome = executeGestureAction("seek_forward", {
      ...createDeps(audio, createUiMock()),
      seekStepSeconds: 10,
    });

    expect(outcome.ok).toBe(true);
    expect(audio.seekTo).toHaveBeenCalledWith(60);
    expect(outcome.detail).toBe("快进到 " + formatTime(60));
  });

  it("seek_backward 在开头处夹紧到 0", () => {
    const audio = createAudioMock({ currentTime: 5, duration: 200 });

    const outcome = executeGestureAction("seek_backward", {
      ...createDeps(audio, createUiMock()),
      seekStepSeconds: 10,
    });

    expect(outcome.ok).toBe(true);
    expect(audio.seekTo).toHaveBeenCalledWith(0);
    expect(outcome.detail).toBe("快退到 0:00");
  });

  it("seek 在结尾处夹紧到 duration", () => {
    const audio = createAudioMock({ currentTime: 195, duration: 200 });

    executeGestureAction("seek_forward", {
      ...createDeps(audio, createUiMock()),
      seekStepSeconds: 10,
    });

    expect(audio.seekTo).toHaveBeenCalledWith(200);
  });

  it("duration 未知时 seek 返回 error", () => {
    const audio = createAudioMock({ duration: 0 });

    const outcome = executeGestureAction("seek_forward", createDeps(audio, createUiMock()));

    expect(outcome.ok).toBe(false);
    expect(outcome.tone).toBe("error");
    expect(outcome.detail).toContain("时长未知");
    expect(audio.seekTo).not.toHaveBeenCalled();
  });

  it("toggle_lyrics 切换全屏歌词并给出反馈", () => {
    const entering = createUiMock({ isFullscreenLyrics: false });
    const enterOutcome = executeGestureAction(
      "toggle_lyrics",
      createDeps(createAudioMock(), entering)
    );
    expect(enterOutcome.ok).toBe(true);
    expect(enterOutcome.detail).toBe("已进入全屏歌词");
    expect(entering.toggleFullscreenLyrics).toHaveBeenCalledTimes(1);

    const leaving = createUiMock({ isFullscreenLyrics: true });
    const leaveOutcome = executeGestureAction(
      "toggle_lyrics",
      createDeps(createAudioMock(), leaving)
    );
    expect(leaveOutcome.detail).toBe("已退出全屏歌词");
  });

  it("none 动作返回 info 且不触碰 store", () => {
    const audio = createAudioMock();
    const ui = createUiMock();

    const outcome = executeGestureAction("none", createDeps(audio, ui));

    expect(outcome.ok).toBe(true);
    expect(outcome.tone).toBe("info");
    expect(outcome.action).toBe("none");
    expect(outcome.label).toBe("不绑定");
    expect(audio.setVolume).not.toHaveBeenCalled();
    expect(ui.toggleFullscreenLyrics).not.toHaveBeenCalled();
  });
});

describe("executeGestureAction 异常兜底", () => {
  it("store 方法抛错时返回 error outcome 而不向上抛", () => {
    const audio = createAudioMock({
      nextSong: vi.fn(() => {
        throw new Error("播放器崩溃");
      }),
    });

    const outcome = executeGestureAction("next_track", createDeps(audio, createUiMock()));

    expect(outcome.ok).toBe(false);
    expect(outcome.tone).toBe("error");
    expect(outcome.detail).toContain("动作执行失败");
    expect(outcome.detail).toContain("播放器崩溃");
  });
});

describe("默认依赖（真实 store）", () => {
  beforeEach(() => {
    useAudioStore.setState({
      volume: 0.5,
      currentSong: null,
      isPlaying: false,
      isMuted: false,
      queue: [],
      duration: 180,
      currentTime: 0,
    });
    useUIStore.setState({ isFullscreenLyrics: false });
  });

  it("不注入依赖时读取 useAudioStore 执行音量动作", () => {
    const outcome = executeGestureAction("volume_up", { volumeStep: 0.1 });

    expect(outcome.ok).toBe(true);
    expect(outcome.detail).toBe("音量 60%");
    expect(useAudioStore.getState().volume).toBeCloseTo(0.6, 10);
  });

  it("不注入依赖时默认音量步进取自手势设置 store", () => {
    const settings = useGestureSettingsStore.getState();
    const outcome = executeGestureAction("volume_down");

    expect(outcome.ok).toBe(true);
    const expected = Math.max(0, 0.5 - settings.volumeStep);
    expect(useAudioStore.getState().volume).toBeCloseTo(expected, 10);
  });

  it("不注入依赖时无歌曲的 toggle_play 返回 error", () => {
    const outcome = executeGestureAction("toggle_play");
    expect(outcome.ok).toBe(false);
    expect(outcome.detail).toContain("没有可播放的歌曲");
  });
});
