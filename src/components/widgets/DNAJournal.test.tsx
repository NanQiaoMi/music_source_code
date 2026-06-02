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

    expect(container.textContent).toContain("Listening DNA Report");
    expect(container.textContent).toContain("No listening DNA yet");
    expect(container.textContent).toContain("Start DNA analysis");

    const generateButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Start DNA analysis")
    );

    await act(async () => {
      generateButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const toasts = useUIStore.getState().toasts;
    expect(toasts[toasts.length - 1]).toMatchObject({
      message: "AI analysis is disabled. Enable AI settings before generating Listening DNA.",
      type: "warning",
    });
  });
});
