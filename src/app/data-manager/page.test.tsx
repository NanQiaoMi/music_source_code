import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useUIStore } from "@/store/uiStore";
import DataManagerPage from "./page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/components/library/UnifiedDataManagerHub", () => ({
  UnifiedDataManagerHub: () => <main data-testid="library-manager" />,
}));

vi.mock("@/components/player/QueuePanel", () => ({
  QueuePanel: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) =>
    isOpen ? (
      <section role="dialog" aria-label="播放队列" data-testid="loaded-queue-panel">
        <button type="button" aria-label="关闭队列" onClick={onClose}>
          关闭队列
        </button>
      </section>
    ) : null,
}));

describe("/data-manager queue panel host", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    useUIStore.setState(useUIStore.getInitialState(), true);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it("lazy loads the QueuePanel on the manager route and resets queue state when closed", async () => {
    await act(async () => root.render(<DataManagerPage />));

    await act(async () => useUIStore.getState().openPanel("queue"));
    await act(async () => new Promise((resolve) => setTimeout(resolve, 50)));

    expect(
      container.querySelector('[data-testid="loaded-queue-panel"]'),
      container.innerHTML
    ).not.toBeNull();
    expect(container.querySelector('[role="dialog"][aria-label="播放队列"]')).not.toBeNull();

    await act(async () => {
      container.querySelector<HTMLButtonElement>('[aria-label="关闭队列"]')?.click();
    });

    expect(useUIStore.getState().panels.queue).toBe(false);
    expect(container.querySelector('[data-testid="loaded-queue-panel"]')).toBeNull();
  });
});
