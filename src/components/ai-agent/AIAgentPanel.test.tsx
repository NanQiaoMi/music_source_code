import React, { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { AIAgentPanel } from "./AIAgentPanel";
import { useAIAgentStore } from "@/store/useAIAgentStore";
import { useAIStore } from "@/store/aiStore";

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

vi.mock("next/image", () => ({
  default: ({ src, alt, ...props }: any) => <img src={src} alt={alt} {...props} />,
}));

describe("AIAgentPanel", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.clearAllMocks();
    useAIAgentStore.getState().clearMessages();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("renders nothing when isOpen is false", async () => {
    await act(async () => {
      root.render(<AIAgentPanel isOpen={false} onClose={() => undefined} />);
    });
    expect(container.innerHTML).toBe("");
  });

  it("renders AIAgentPanel with greeting and suggested prompt pills when open", async () => {
    await act(async () => {
      root.render(<AIAgentPanel isOpen={true} onClose={() => undefined} />);
    });

    expect(container.textContent).toContain("AI 找歌助手");
    expect(container.textContent).toContain("MIMI 音乐找歌助手");
    expect(container.textContent).toContain("灵感探索矩阵");
    expect(container.textContent).toContain("歌词寻歌");
    expect(container.textContent).toContain("深夜心情");
    expect(container.textContent).toContain("Enter 发送 / Shift+Enter 换行");
  });

  it("renders user messages and assistant song results", async () => {
    useAIAgentStore.setState({
      messages: [
        {
          id: "msg_user",
          role: "user",
          content: "我想听晴天",
          timestamp: 1000,
        },
        {
          id: "msg_assistant",
          role: "assistant",
          content: "找到以下歌曲：",
          timestamp: 2000,
          songResults: [
            {
              song: {
                id: "song_jay",
                title: "晴天",
                artist: "周杰伦",
                album: "叶惠美",
                duration: 269,
                source: "netease",
              },
              source: "netease",
              canPlay: true,
              canDownload: true,
            },
          ],
        },
      ],
    });

    await act(async () => {
      root.render(<AIAgentPanel isOpen={true} onClose={() => undefined} />);
    });

    expect(container.textContent).toContain("我想听晴天");
    expect(container.textContent).toContain("找到以下歌曲：");
    expect(container.textContent).toContain("晴天");
    expect(container.textContent).toContain("周杰伦");
    expect(container.textContent).toContain("叶惠美");
    expect(container.textContent).toContain("网易云");
  });

  it("renders warning banner when no active AI config is available", async () => {
    useAIStore.setState({
      configs: [],
      activeConfigId: null,
      isEnabled: true,
    });

    await act(async () => {
      root.render(<AIAgentPanel isOpen={true} onClose={() => undefined} />);
    });

    expect(container.textContent).toContain("尚未配置 API Key");
    expect(container.textContent).toContain("配置端点");
  });
});
