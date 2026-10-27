import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useUIStore } from "@/store/uiStore";
import { PanelOrchestrator } from "./PanelOrchestrator";

const prefetchPanel = vi.hoisted(() => vi.fn());

vi.mock("@/components/shared/LazyPanel", () => ({
  createLazyPanelComponent: (name: string) => name,
  prefetchPanel,
  LazyPanel: ({ isOpen }: { isOpen: boolean }) => (isOpen ? <div data-panel-open="" /> : null),
}));

const initialState = useUIStore.getInitialState();

function markEntry(name: string): HTMLButtonElement {
  const entry = document.createElement("button");
  entry.type = "button";
  entry.setAttribute("data-panel-prefetch", name);
  entry.appendChild(document.createElement("span"));
  document.body.appendChild(entry);
  return entry;
}

describe("PanelOrchestrator prefetch strategy (S3-9)", () => {
  let container: HTMLDivElement;
  let root: Root;
  let mounted: boolean;

  const mount = async () => {
    root = createRoot(container);
    mounted = true;
    await act(async () => {
      root.render(<PanelOrchestrator />);
    });
  };

  const unmount = async () => {
    await act(async () => {
      root.unmount();
    });
    mounted = false;
  };

  beforeEach(() => {
    vi.useFakeTimers();
    // jsdom 默认没有 requestIdleCallback；显式清掉，保证 fallback 用例不随环境漂移。
    Reflect.deleteProperty(window, "requestIdleCallback");
    Reflect.deleteProperty(window, "cancelIdleCallback");
    useUIStore.setState(initialState, true);
    prefetchPanel.mockClear();
    container = document.createElement("div");
    document.body.appendChild(container);
    mounted = false;
  });

  afterEach(async () => {
    if (mounted) await unmount();
    container.remove();
    document.querySelectorAll("[data-panel-prefetch]").forEach((entry) => entry.remove());
    delete (window.navigator as Navigator & { connection?: unknown }).connection;
    Reflect.deleteProperty(window, "requestIdleCallback");
    Reflect.deleteProperty(window, "cancelIdleCallback");
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("prefetches only queue and search within 5s, and not before the idle window", async () => {
    await mount();

    await act(async () => {
      vi.advanceTimersByTime(2999);
    });
    expect(prefetchPanel).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(2001);
    });

    expect(prefetchPanel).toHaveBeenCalledTimes(2);
    expect(prefetchPanel.mock.calls.map(([name]) => name)).toEqual(["queue", "search"]);
  });

  it("schedules the idle prefetch through requestIdleCallback with a 2s timeout", async () => {
    const requestIdleCallback = vi.fn((callback: () => void, _options?: { timeout: number }) => {
      callback();
      return 1;
    });
    const cancelIdleCallback = vi.fn();
    Object.defineProperty(window, "requestIdleCallback", {
      configurable: true,
      value: requestIdleCallback,
    });
    Object.defineProperty(window, "cancelIdleCallback", {
      configurable: true,
      value: cancelIdleCallback,
    });

    await mount();

    expect(requestIdleCallback).toHaveBeenCalledWith(expect.any(Function), { timeout: 2000 });
    expect(prefetchPanel.mock.calls.map(([name]) => name)).toEqual(["queue", "search"]);

    await unmount();
    expect(cancelIdleCallback).toHaveBeenCalledWith(1);
  });

  it("does not prefetch when the connection reports saveData", async () => {
    Object.defineProperty(window.navigator, "connection", {
      configurable: true,
      value: { saveData: true },
    });

    await mount();
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });

    expect(prefetchPanel).not.toHaveBeenCalled();
  });

  it("prefetches a panel exactly once when a marked entry gets pointer intent", async () => {
    await mount();
    const entry = markEntry("settings");
    const child = entry.firstElementChild as HTMLElement;

    child.dispatchEvent(new MouseEvent("pointerover", { bubbles: true }));
    entry.dispatchEvent(new MouseEvent("pointerover", { bubbles: true }));

    expect(prefetchPanel).toHaveBeenCalledTimes(1);
    expect(prefetchPanel).toHaveBeenCalledWith("settings", expect.any(Function));
  });

  it("ignores an entry whose marker does not name a known panel", async () => {
    await mount();
    const entry = markEntry("not-a-panel");

    entry.dispatchEvent(new MouseEvent("pointerover", { bubbles: true }));

    expect(prefetchPanel).not.toHaveBeenCalled();
  });

  it("stops listening for intent and cancels the idle prefetch after unmount", async () => {
    await mount();
    const entry = markEntry("queue");

    await unmount();
    entry.dispatchEvent(new MouseEvent("pointerover", { bubbles: true }));
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });

    expect(prefetchPanel).not.toHaveBeenCalled();
  });
});
