import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAIStore } from "@/store/aiStore";
import { AISettingsPanel } from "../AISettingsPanel";

vi.mock("framer-motion", async () => {
  const React = await import("react");
  type MotionProps = {
    children?: React.ReactNode;
    className?: string;
    style?: React.CSSProperties;
    title?: string;
    disabled?: boolean;
    onClick?: React.MouseEventHandler<HTMLElement>;
    whileHover?: unknown;
    whileTap?: unknown;
    initial?: unknown;
    animate?: unknown;
    exit?: unknown;
    transition?: unknown;
    layout?: unknown;
    layoutId?: unknown;
  };

  const MotionButton = ({
    whileHover: _whileHover,
    whileTap: _whileTap,
    initial: _initial,
    animate: _animate,
    exit: _exit,
    transition: _transition,
    layout: _layout,
    layoutId: _layoutId,
    ...props
  }: MotionProps) => React.createElement("button", props);

  const MotionDiv = ({
    whileHover: _whileHover,
    whileTap: _whileTap,
    initial: _initial,
    animate: _animate,
    exit: _exit,
    transition: _transition,
    layout: _layout,
    layoutId: _layoutId,
    ...props
  }: MotionProps) => React.createElement("div", props);

  return {
    AnimatePresence: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    motion: {
      button: MotionButton,
      div: MotionDiv,
    },
  };
});

describe("AISettingsPanel", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    localStorage.clear();
    useAIStore.setState({
      configs: [
        {
          id: "cfg-1",
          name: "SenseNova API",
          providerId: "sensenova",
          baseUrl: "https://token.sensenova.cn/v1",
          apiKey: "sk-sensenova-test",
          model: "SenseChat-5",
          status: "online",
          latency: 280,
          temperature: 0.7,
          topP: 1.0,
          maxTokens: 2048,
          timeout: 30000,
          stream: true,
        },
        {
          id: "cfg-2",
          name: "DeepSeek Official",
          providerId: "deepseek",
          baseUrl: "https://api.deepseek.com/v1",
          apiKey: "sk-deepseek-test",
          model: "deepseek-chat",
          status: "idle",
          temperature: 0.6,
        },
      ],
      activeConfigId: "cfg-1",
      isEnabled: true,
    });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    vi.restoreAllMocks();
  });

  it("renders when isOpen is true and shows configured endpoints", async () => {
    await act(async () => {
      root.render(<AISettingsPanel isOpen={true} onClose={() => {}} />);
    });

    expect(container.textContent).toContain("AI 模型与接口设置");
    expect(container.textContent).toContain("SenseNova API");
    expect(container.textContent).toContain("DeepSeek Official");
    expect(container.textContent).toContain("280ms");
    expect(container.textContent).toContain("当前主模型");
  });

  it("does not render when isOpen is false", async () => {
    await act(async () => {
      root.render(<AISettingsPanel isOpen={false} onClose={() => {}} />);
    });

    expect(container.textContent).toBe("");
  });

  it("switches tabs between Connection, Parameters, Playground, and Network", async () => {
    await act(async () => {
      root.render(<AISettingsPanel isOpen={true} onClose={() => {}} />);
    });

    const paramTabButton = Array.from(container.querySelectorAll("button")).find((btn) =>
      btn.textContent?.includes("参数与人设")
    );
    expect(paramTabButton).toBeTruthy();

    await act(async () => {
      paramTabButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("模型生成动力学参数");
    expect(container.textContent).toContain("音乐场景专属 Prompt 预设人设");
  });
});
