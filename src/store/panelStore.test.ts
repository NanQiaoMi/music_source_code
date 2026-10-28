// S6-6b panelStore: 面板开合语义（open/close/toggle/closeAll）、PANEL_NAMES 注册表与
// 全屏面板互斥。跨 store 的兼容转发与持久化格式在 uiStore.facade.test.ts。
import { beforeEach, describe, expect, it } from "vitest";
import { createDefaultPanels, FULLSCREEN_PANELS, PANEL_NAMES, usePanelStore } from "./panelStore";

const initialPanelState = usePanelStore.getInitialState();

describe("panelStore (S6-6b)", () => {
  beforeEach(() => {
    usePanelStore.setState(initialPanelState, true);
    localStorage.clear();
  });

  it("opens and closes a panel", () => {
    usePanelStore.getState().openPanel("queue");
    expect(usePanelStore.getState().panels.queue).toBe(true);
    expect(usePanelStore.getState().isPanelOpen("queue")).toBe(true);

    usePanelStore.getState().closePanel("queue");
    expect(usePanelStore.getState().panels.queue).toBe(false);
    expect(usePanelStore.getState().isPanelOpen("queue")).toBe(false);
  });

  it("toggles a panel on and off", () => {
    usePanelStore.getState().togglePanel("search");
    expect(usePanelStore.getState().panels.search).toBe(true);

    usePanelStore.getState().togglePanel("search");
    expect(usePanelStore.getState().panels.search).toBe(false);
  });

  it("closes all panels", () => {
    const store = usePanelStore.getState();
    store.openPanel("queue");
    store.openPanel("search");
    store.openPanel("playerSkins");

    usePanelStore.getState().closeAllPanels();

    expect(Object.values(usePanelStore.getState().panels).every((isOpen) => !isOpen)).toBe(true);
  });

  it("keeps fullscreen panels mutually exclusive while preserving non-fullscreen panels", () => {
    const store = usePanelStore.getState();
    store.openPanel("queue");
    store.openPanel("emotionMatrix");

    expect(usePanelStore.getState().panels.queue).toBe(true);
    expect(usePanelStore.getState().panels.emotionMatrix).toBe(true);

    usePanelStore.getState().openPanel("share");

    expect(usePanelStore.getState().panels.queue).toBe(true);
    expect(usePanelStore.getState().panels.emotionMatrix).toBe(false);
    expect(usePanelStore.getState().panels.share).toBe(true);
  });

  it("keeps opening an already-open fullscreen panel idempotent", () => {
    usePanelStore.getState().openPanel("share");
    usePanelStore.getState().openPanel("share");

    expect(usePanelStore.getState().panels.share).toBe(true);
    expect(usePanelStore.getState().panels.emotionMatrix).toBe(false);
  });

  it("registers every panel exactly once with a closed default", () => {
    const defaults = createDefaultPanels();

    expect(PANEL_NAMES).toHaveLength(43);
    expect(new Set(PANEL_NAMES).size).toBe(PANEL_NAMES.length);
    expect(Object.keys(defaults).sort()).toEqual([...PANEL_NAMES].sort());
    expect(Object.values(defaults).every((isOpen) => !isOpen)).toBe(true);
    expect(FULLSCREEN_PANELS.every((name) => PANEL_NAMES.includes(name))).toBe(true);
    expect(usePanelStore.getState().panels).toEqual(defaults);
  });

  it("keeps the shelf3D aliases equivalent to the panel actions", () => {
    const store = usePanelStore.getState();

    store.openPanel("emotionMatrix");
    store.openShelf3D();
    expect(usePanelStore.getState().panels.shelf3D).toBe(true);
    // shelf3D 也是全屏面板：别名走的是同一条互斥语义。
    expect(usePanelStore.getState().panels.emotionMatrix).toBe(false);

    store.toggleShelf3D();
    expect(usePanelStore.getState().panels.shelf3D).toBe(false);

    store.setIsShelf3DOpen(true);
    expect(usePanelStore.getState().panels.shelf3D).toBe(true);

    usePanelStore.getState().closeShelf3D();
    expect(usePanelStore.getState().panels.shelf3D).toBe(false);
  });
});
