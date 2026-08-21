import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PANEL_NAMES, useUIStore } from "@/store/uiStore";

vi.mock("@/components/shared/LazyPanel", () => ({
  createLazyPanelComponent: (name: string) => name,
  prefetchPanel: vi.fn(),
  LazyPanel: ({ name, isOpen }: { name: string; isOpen: boolean }) =>
    isOpen ? <section data-panel-name={name}>{name}</section> : null,
}));

const initialState = useUIStore.getInitialState();

describe("PanelOrchestrator", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    useUIStore.setState(initialState, true);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    vi.clearAllMocks();
  });

  it("renders the Listening DNA panel registered by the Discover menu", async () => {
    const { PanelOrchestrator } = await import("./PanelOrchestrator");

    useUIStore.getState().openPanel("dnaJournal");

    await act(async () => {
      root.render(<PanelOrchestrator />);
    });

    expect(container.querySelector('[data-panel-name="dnaJournal"]')).not.toBeNull();
  });
  it("renders the professional tools panel registered by floating feature buttons", async () => {
    const { PanelOrchestrator } = await import("./PanelOrchestrator");

    useUIStore.getState().openPanel("professionalTools");

    await act(async () => {
      root.render(<PanelOrchestrator />);
    });

    expect(container.querySelector('[data-panel-name="professionalTools"]')).not.toBeNull();
  });

  it("renders every panel registered in uiStore", async () => {
    const { PanelOrchestrator } = await import("./PanelOrchestrator");

    for (const panelName of PANEL_NAMES) {
      useUIStore.setState(initialState, true);
      useUIStore.getState().openPanel(panelName);

      await act(async () => {
        root.render(<PanelOrchestrator />);
      });

      expect(container.querySelector(`[data-panel-name="${panelName}"]`)).not.toBeNull();
    }
  });
});
