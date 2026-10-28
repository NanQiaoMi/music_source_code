/* eslint-disable @typescript-eslint/no-explicit-any */
// 测试桩（framer-motion mock、React 内部快照替换）用宽松类型是刻意的，收紧只会引入与被测逻辑无关的噪音
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { GestureFeedback } from "./GestureFeedback";
import { useGestureStore } from "@/store/gestureStore";
import { useAudioStore } from "@/store/audioStore";
import { usePlayerStore } from "@/store/playerStore";

vi.mock("framer-motion", () => ({
  motion: new Proxy(
    {},
    {
      get: (_, prop: string) => {
        return ({ children, ...props }: any) => React.createElement(prop, props, children);
      },
    }
  ),
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

// S6-4: isPlaying 读 PlaybackClock；静态渲染下 useSyncExternalStore 固定取 server 快照，
// 这里让 hook 直接读当前 client 快照，断言组件对 clock 状态的反应。
vi.mock("@/hooks/usePlaybackClock", async () => {
  const { getPlaybackClockSnapshot } = await import("@/lib/playback/playbackClock");
  return {
    usePlaybackClock: (
      selector: (snapshot: ReturnType<typeof getPlaybackClockSnapshot>) => unknown
    ) => selector(getPlaybackClockSnapshot()),
  };
});

// renderToStaticMarkup 下 useSyncExternalStore 取的是 server 快照（getInitialState），
// 测试里临时回落到 client 快照，才能用 setState 构造被测状态。
const reactiveReact = React as unknown as {
  useSyncExternalStore: (
    subscribe: (onStoreChange: () => void) => () => void,
    getSnapshot: () => unknown,
    getServerSnapshot?: () => unknown
  ) => unknown;
};
const originalUseSyncExternalStore = reactiveReact.useSyncExternalStore;

function renderFeedback(): string {
  return renderToStaticMarkup(<GestureFeedback />);
}

describe("GestureFeedback", () => {
  beforeEach(() => {
    useGestureStore.getState().resetRuntime();
    useAudioStore.setState({ volume: 0.6, isPlaying: false, currentSong: null });
    reactiveReact.useSyncExternalStore = (_subscribe, getSnapshot) => getSnapshot();
  });

  afterEach(() => {
    reactiveReact.useSyncExternalStore = originalUseSyncExternalStore;
    useGestureStore.getState().resetRuntime();
  });

  it("没有手势事件时不渲染任何反馈节点", () => {
    expect(renderFeedback()).toBe("");
  });

  it("动作 toast 展示图标、标题与细节文案", () => {
    useGestureStore.getState().pushEvent({
      action: "next_track",
      command: "swipe_left",
      label: "下一首",
      detail: "已切换到下一首",
      tone: "success",
    });

    const html = renderFeedback();

    expect(html).toContain("下一首");
    expect(html).toContain("已切换到下一首");
    expect(html).toContain('role="status"');
  });

  it("音量动作展示音量条，数值来自 playerStore（audioStore 兼容投影）", () => {
    usePlayerStore.getState().setVolume(0.42);
    useGestureStore.getState().pushEvent({
      action: "volume_up",
      command: "swipe_up",
      label: "音量增加",
      detail: "音量 +5%",
      tone: "info",
    });

    const html = renderFeedback();

    expect(html).toContain("音量");
    expect(html).toContain("42%");
  });

  it("播放切换动作展示播放徽标与当前歌曲", () => {
    useAudioStore.setState({
      isPlaying: true,
      currentSong: {
        id: "song-1",
        title: "测试歌曲",
        artist: "测试歌手",
        duration: 200,
        source: "local",
      },
    });
    useGestureStore.getState().pushEvent({
      action: "toggle_play",
      command: "fist_hold",
      label: "播放 / 暂停",
      tone: "success",
    });

    const html = renderFeedback();

    expect(html).toContain("播放中");
    expect(html).toContain("测试歌曲");
  });

  it("握拳蓄力时渲染进度环与中文手势名", () => {
    useGestureStore.setState({ dwell: { command: "fist_hold", progress: 0.42 } });

    const html = renderFeedback();

    expect(html).toContain("握拳停顿");
    expect(html).toContain("42%");
    expect(html).toContain("<svg");
    expect(html).toContain("stroke-dasharray");
  });
});
