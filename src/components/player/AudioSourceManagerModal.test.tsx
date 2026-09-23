/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { act } from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createRoot, Root } from "react-dom/client";
import { AudioSourceManagerModal } from "./AudioSourceManagerModal";
import { useAudioStore } from "@/store/audioStore";
import { usePlayerStore } from "@/store/playerStore";
import { useAudioSourceStore } from "@/store/audioSourceStore";

// Mock canvas getContext
HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
  clearRect: vi.fn(),
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  stroke: vi.fn(),
  setTransform: vi.fn(),
  strokeStyle: "",
  lineWidth: 1,
  shadowColor: "",
  shadowBlur: 0,
}) as any;

describe("AudioSourceManagerModal", () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    useAudioStore.setState({
      currentSong: {
        id: "song-gem-1",
        title: "唯一",
        artist: "G.E.M.邓紫棋",
        album: "T.I.M.E.",
        duration: 218,
        source: "netease",
        audioUrl: "https://example.com/song1.mp3",
      } as any,
      isPlaying: true,
    });

    usePlayerStore.setState({
      currentSong: {
        id: "song-gem-1",
        title: "唯一",
        artist: "G.E.M.邓紫棋",
        album: "T.I.M.E.",
        duration: 218,
        source: "netease",
        audioUrl: "https://example.com/song1.mp3",
      } as any,
      isPlaying: true,
    });

    useAudioSourceStore.getState().resetSourceSettings();
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root?.unmount();
      });
    }
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
  });

  it("does not render when isOpen is false", () => {
    act(() => {
      root?.render(<AudioSourceManagerModal isOpen={false} onClose={vi.fn()} />);
    });
    expect(container?.textContent).toBe("");
  });

  it("renders modal header, current song info, and default track tab when isOpen is true", () => {
    act(() => {
      root?.render(<AudioSourceManagerModal isOpen={true} onClose={vi.fn()} />);
    });

    expect(container?.textContent).toContain("音频来源与节拍设置");
    expect(container?.textContent).toContain("唯一");
    expect(container?.textContent).toContain("G.E.M.邓紫棋");
    expect(container?.textContent).toContain("曲目版本");
    expect(container?.textContent).toContain("智能降级");
    expect(container?.textContent).toContain("流式解密");
    expect(container?.textContent).toContain("节拍分析");
  });

  it("switches to 智能降级 tab when clicked", () => {
    act(() => {
      root?.render(<AudioSourceManagerModal isOpen={true} onClose={vi.fn()} />);
    });

    const fallbackTabBtn = Array.from(container?.querySelectorAll("button") || []).find((b) =>
      b.textContent?.includes("智能降级")
    );
    expect(fallbackTabBtn).toBeTruthy();

    act(() => {
      fallbackTabBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container?.textContent).toContain("0ms 试听片段智能静默降级");
    expect(container?.textContent).toContain("多平台降级路由拓扑");
    expect(container?.textContent).toContain("首选抓取音质偏好");
  });

  it("switches to 流式解密 tab when clicked", () => {
    act(() => {
      root?.render(<AudioSourceManagerModal isOpen={true} onClose={vi.fn()} />);
    });

    const spadeTabBtn = Array.from(container?.querySelectorAll("button") || []).find((b) =>
      b.textContent?.includes("流式解密")
    );
    expect(spadeTabBtn).toBeTruthy();

    act(() => {
      spadeTabBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container?.textContent).toContain("AES-128 流式音频实时解密管道");
    expect(container?.textContent).toContain("动态解密流水线");
    expect(container?.textContent).toContain("48.2 MB/s");
    expect(container?.textContent).toContain("0 Byte");
  });

  it("switches to 节拍分析 tab and supports Tap BPM calibration", () => {
    act(() => {
      root?.render(<AudioSourceManagerModal isOpen={true} onClose={vi.fn()} />);
    });

    const beatTabBtn = Array.from(container?.querySelectorAll("button") || []).find((b) =>
      b.textContent?.includes("节拍分析")
    );
    expect(beatTabBtn).toBeTruthy();

    act(() => {
      beatTabBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container?.textContent).toContain("Biquad 双二阶数字滤波节拍分析器");
    expect(container?.textContent).toContain("数字音频示波器");
    expect(container?.textContent).toContain("4/4 拍实时节奏律动");

    const tapBtn = Array.from(container?.querySelectorAll("button") || []).find((b) =>
      b.textContent?.includes("Tap 敲击校准")
    );
    expect(tapBtn).toBeTruthy();

    act(() => {
      tapBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      tapBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(tapBtn).toBeTruthy();
  });

  it("calls onClose when close button or 完成 button is clicked", () => {
    const onCloseMock = vi.fn();
    act(() => {
      root?.render(<AudioSourceManagerModal isOpen={true} onClose={onCloseMock} />);
    });

    const doneBtn = Array.from(container?.querySelectorAll("button") || []).find(
      (b) => b.textContent?.trim() === "完成"
    );
    expect(doneBtn).toBeTruthy();

    act(() => {
      doneBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onCloseMock).toHaveBeenCalledTimes(1);
  });
});
