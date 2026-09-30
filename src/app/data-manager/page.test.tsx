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

vi.mock("@/components/shared/LazyPanel", () => ({
  createLazyPanelComponent: (name: string) => name,
  LazyPanel: ({ name, isOpen, onClose }: { name: string; isOpen: boolean; onClose: () => void }) =>
    isOpen ? (
      <section role="dialog" aria-label="播放队列" data-panel-name={name}>
        <button type="button" onClick={onClose}>
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

  it("opens and closes the reusable queue panel when the dock changes queue state", async () => {
    await act(async () => root.render(<DataManagerPage />));

    await act(async () => useUIStore.getState().openPanel("queue"));

    expect(container.querySelector('[role="dialog"][aria-label="播放队列"]')).not.toBeNull();
    expect(container.querySelector('[data-panel-name="dataManagerQueue"]')).not.toBeNull();

    await act(async () => {
      container.querySelector<HTMLButtonElement>("button")?.click();
    });

    expect(useUIStore.getState().panels.queue).toBe(false);
    expect(container.querySelector('[role="dialog"][aria-label="播放队列"]')).toBeNull();
  });
});
