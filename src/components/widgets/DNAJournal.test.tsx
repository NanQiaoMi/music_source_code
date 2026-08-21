import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAIStore } from "@/store/aiStore";
import { useEmotionStore } from "@/store/emotionStore";
import { useKnowledgeStore } from "@/store/knowledgeStore";
import { useUIStore } from "@/store/uiStore";

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
  };

  const MotionButton = ({
    whileHover: _whileHover,
    whileTap: _whileTap,
    initial: _initial,
    animate: _animate,
    exit: _exit,
    transition: _transition,
    ...props
  }: MotionProps) => React.createElement("button", props);

  const MotionDiv = ({
    whileHover: _whileHover,
    whileTap: _whileTap,
    initial: _initial,
    animate: _animate,
    exit: _exit,
    transition: _transition,
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

const initialAIState = useAIStore.getInitialState();
const initialEmotionState = useEmotionStore.getInitialState();
const initialKnowledgeState = useKnowledgeStore.getInitialState();
const initialUIState = useUIStore.getInitialState();

describe("DNAJournal", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    useAIStore.setState(initialAIState, true);
    useEmotionStore.setState(initialEmotionState, true);
    useKnowledgeStore.setState(initialKnowledgeState, true);
    useUIStore.setState(initialUIState, true);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("renders readable empty-state copy and reports disabled AI clearly", async () => {
    const { DNAJournal } = await import("./DNAJournal");
    useAIStore.getState().setEnabled(false);

    await act(async () => {
      root.render(<DNAJournal />);
    });

    expect(container.textContent).toContain("听觉基因解构报告");
    expect(container.textContent).toContain("暂未建立神经连接");
    expect(container.textContent).toContain("开启初始化协议 (重新同步)");

    const generateButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("开启初始化协议")
    );

    await act(async () => {
      generateButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const toasts = useUIStore.getState().toasts;
    expect(toasts[toasts.length - 1]).toMatchObject({
      message: "AI 功能已暂停",
      type: "warning",
    });
  });
});
