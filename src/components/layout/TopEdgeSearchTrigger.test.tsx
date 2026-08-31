import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { TopEdgeSearchTrigger } from "./TopEdgeSearchTrigger";
import { useUIStore } from "@/store/uiStore";

describe("TopEdgeSearchTrigger", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    useUIStore.setState({
      panels: {
        ...useUIStore.getState().panels,
        search: false,
      },
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

  it("does not open search panel when mouse moves at top edge (prevent accidental popup)", async () => {
    await act(async () => {
      root.render(<TopEdgeSearchTrigger />);
    });

    expect(useUIStore.getState().panels.search).toBe(false);

    // Trigger mousemove at clientY = 10
    await act(async () => {
      window.dispatchEvent(
        new MouseEvent("mousemove", {
          clientY: 10,
          bubbles: true,
        })
      );
    });

    expect(useUIStore.getState().panels.search).toBe(false);
  });

  it("does not open search panel when mouse moves below top 15px", async () => {
    await act(async () => {
      root.render(<TopEdgeSearchTrigger />);
    });

    expect(useUIStore.getState().panels.search).toBe(false);

    await act(async () => {
      window.dispatchEvent(
        new MouseEvent("mousemove", {
          clientY: 50,
          bubbles: true,
        })
      );
    });

    expect(useUIStore.getState().panels.search).toBe(false);
  });

  it("renders safe non-intrusive sensor element", async () => {
    await act(async () => {
      root.render(<TopEdgeSearchTrigger />);
    });

    const sensor = container.querySelector('[data-testid="top-edge-search-sensor"]');
    expect(sensor).not.toBeNull();
  });

  it("opens search panel on touch pull-down from top edge", async () => {
    await act(async () => {
      root.render(<TopEdgeSearchTrigger />);
    });

    expect(useUIStore.getState().panels.search).toBe(false);

    // Touch start near top (clientY = 20)
    const touchStart = new TouchEvent("touchstart", {
      touches: [{ clientY: 20 } as unknown as Touch],
      bubbles: true,
    });
    await act(async () => {
      window.dispatchEvent(touchStart);
    });

    // Touch move down (clientY = 80 => delta 60px > 50px)
    const touchMove = new TouchEvent("touchmove", {
      touches: [{ clientY: 80 } as unknown as Touch],
      bubbles: true,
    });
    await act(async () => {
      window.dispatchEvent(touchMove);
    });

    expect(useUIStore.getState().panels.search).toBe(true);
  });
});
