import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { VirtualCursor } from "./VirtualCursor";
import { useGestureStore } from "@/store/gestureStore";
import { useGestureSettingsStore } from "@/store/gestureSettingsStore";

describe("VirtualCursor", () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(() => {
    useGestureSettingsStore.setState({ showCursor: true });
    useGestureStore.setState({
      cursorVisible: true,
      cursor: { x: 0.3, y: 0.4 },
      pinching: false,
      dragging: false,
      dwell: null,
    });
  });

  afterEach(async () => {
    if (root) {
      await act(async () => {
        root?.unmount();
      });
    }
    container?.remove();
    container = null;
    root = null;
    useGestureStore.getState().resetRuntime();
    useGestureSettingsStore.setState({ showCursor: true });
  });

  async function renderCursor(): Promise<HTMLDivElement> {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root?.render(<VirtualCursor />);
    });
    return container;
  }

  it("updates position through CSS variables without a re-render", async () => {
    const element = await renderCursor();
    const node = element.querySelector("[data-gesture-ignore]") as HTMLDivElement | null;
    expect(node).not.toBeNull();
    if (!node) return;

    expect(node.style.getPropertyValue("--gesture-cursor-x")).toBe("30.000vw");
    expect(node.style.getPropertyValue("--gesture-cursor-y")).toBe("40.000vh");

    await act(async () => {
      useGestureStore.getState().setCursor(0.62, 0.71);
    });

    expect(node.style.getPropertyValue("--gesture-cursor-x")).toBe("62.000vw");
    expect(node.style.getPropertyValue("--gesture-cursor-y")).toBe("71.000vh");
    // 同一个 DOM 节点：高频移动不应触发 React 卸载/重挂载。
    expect(element.querySelector("[data-gesture-ignore]")).toBe(node);
  });

  it("does not render when the cursor is hidden", async () => {
    useGestureStore.setState({ cursorVisible: false });
    const element = await renderCursor();
    expect(element.querySelector("[data-gesture-ignore]")).toBeNull();
  });

  it("clamps cursor positions into the viewport", async () => {
    useGestureStore.setState({ cursor: { x: -1, y: 2 } });
    const element = await renderCursor();
    const node = element.querySelector("[data-gesture-ignore]") as HTMLDivElement | null;
    expect(node?.style.getPropertyValue("--gesture-cursor-x")).toBe("1.000vw");
    expect(node?.style.getPropertyValue("--gesture-cursor-y")).toBe("99.000vh");
  });
});
