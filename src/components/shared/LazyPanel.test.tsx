import React, { act, useEffect } from "react";
import { createRoot, Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LazyPanel } from "./LazyPanel";
import type { LazyPanelComponent } from "./LazyPanel";
import {
  PANEL_LRU_CAPACITY,
  PanelKeepAlive,
  PanelRetentionProvider,
  usePanelDeactivate,
  usePanelLifecycle,
} from "./panelLifecycle";

interface MountLog {
  mounts: string[];
  unmounts: string[];
  deactivations: string[];
}

interface PanelProps {
  isOpen?: boolean;
  onClose?: () => void;
}

function createTestPanel(name: string, log: MountLog) {
  function TestPanel({ isOpen }: PanelProps) {
    const lifecycle = usePanelLifecycle();
    usePanelDeactivate(() => log.deactivations.push(name));

    useEffect(() => {
      log.mounts.push(name);
      return () => {
        log.unmounts.push(name);
      };
    }, []);

    return <div data-panel={name} data-active={lifecycle.active} data-open={Boolean(isOpen)} />;
  }

  return TestPanel;
}

interface HarnessProps {
  names: readonly string[];
  components: Record<string, LazyPanelComponent>;
  keepAlive: Record<string, PanelKeepAlive>;
  open: readonly string[];
  capacity?: number;
}

function Harness({ names, components, keepAlive, open, capacity }: HarnessProps) {
  const openLruPanels = open.filter((name) => (keepAlive[name] ?? "lru") === "lru");

  return (
    <PanelRetentionProvider lruPanels={openLruPanels} capacity={capacity}>
      {names.map((name) => (
        <LazyPanel
          key={name}
          name={name}
          isOpen={open.includes(name)}
          onClose={() => undefined}
          component={components[name]}
          keepAlive={keepAlive[name] ?? "lru"}
        />
      ))}
    </PanelRetentionProvider>
  );
}

describe("LazyPanel lifecycle", () => {
  let container: HTMLDivElement;
  let root: Root;
  let log: MountLog;
  let lazyLoads: Record<string, number>;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    log = { mounts: [], unmounts: [], deactivations: [] };
    lazyLoads = {};
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  function mountedPanels(): string[] {
    return Array.from(container.querySelectorAll<HTMLElement>("[data-panel]"))
      .map((element) => element.dataset.panel ?? "")
      .sort();
  }

  async function renderHarness(
    names: readonly string[],
    options: {
      keepAlive?: Record<string, PanelKeepAlive>;
      initialOpen?: readonly string[];
      capacity?: number;
    } = {}
  ) {
    const keepAlive = Object.fromEntries(
      names.map((name) => [name, options.keepAlive?.[name] ?? "lru"])
    ) as Record<string, PanelKeepAlive>;
    const components = Object.fromEntries(
      names.map((name) => [
        name,
        React.lazy(async () => {
          lazyLoads[name] = (lazyLoads[name] ?? 0) + 1;
          return { default: createTestPanel(name, log) };
        }),
      ])
    ) as Record<string, LazyPanelComponent>;

    const show = async (open: readonly string[]) => {
      await act(async () => {
        root.render(
          <Harness
            names={names}
            components={components}
            keepAlive={keepAlive}
            open={open}
            capacity={options.capacity}
          />
        );
      });
    };

    await show(options.initialOpen ?? []);

    return { show };
  }

  it("unmounts a never panel immediately when it closes", async () => {
    const { show } = await renderHarness(["a"], {
      keepAlive: { a: "never" },
      initialOpen: ["a"],
    });
    expect(mountedPanels()).toEqual(["a"]);

    await show([]);

    expect(mountedPanels()).toEqual([]);
    expect(log.unmounts).toEqual(["a"]);

    await show(["a"]);

    expect(mountedPanels()).toEqual(["a"]);
    expect(log.mounts).toEqual(["a", "a"]);
    expect(lazyLoads.a).toBe(1);
  });

  it("keeps only the most recently opened lru panels mounted", async () => {
    const { show } = await renderHarness(["a", "b", "c", "d"]);

    await show(["a"]);
    expect(mountedPanels()).toEqual(["a"]);

    await show(["b"]);
    expect(mountedPanels()).toEqual(["a", "b"]);

    await show(["c"]);
    expect(mountedPanels()).toEqual(["b", "c"]);

    await show(["d"]);
    expect(mountedPanels()).toEqual(["c", "d"]);
    expect(log.unmounts).toEqual(["a", "b"]);
  });

  it("keeps always panels mounted after close", async () => {
    const { show } = await renderHarness(["a"], {
      keepAlive: { a: "always" },
      initialOpen: ["a"],
    });

    await show([]);

    expect(mountedPanels()).toEqual(["a"]);
    expect(container.querySelector('[data-panel="a"]')?.getAttribute("data-active")).toBe("false");
    expect(log.unmounts).toEqual([]);

    await show(["a"]);
    await show([]);

    expect(log.mounts).toEqual(["a"]);
  });

  it("notifies a mounted child of deactivation once per close", async () => {
    const { show } = await renderHarness(["a"], {
      keepAlive: { a: "always" },
    });

    expect(log.deactivations).toEqual([]);

    await show(["a"]);
    expect(log.deactivations).toEqual([]);

    await show([]);
    expect(log.deactivations).toEqual(["a"]);
    expect(container.querySelector('[data-panel="a"]')?.getAttribute("data-active")).toBe("false");

    await show(["a"]);
    await show([]);

    expect(log.deactivations).toEqual(["a", "a"]);
  });

  it("never evicts active panels, even past the lru capacity", async () => {
    const { show } = await renderHarness(["a", "b", "c", "d"]);

    await show(["a", "b", "c", "d"]);
    expect(mountedPanels()).toEqual(["a", "b", "c", "d"]);

    await show([]);

    expect(mountedPanels()).toEqual(["c", "d"]);
    expect(mountedPanels()).toHaveLength(PANEL_LRU_CAPACITY);
    for (const panel of Array.from(container.querySelectorAll<HTMLElement>("[data-panel]"))) {
      expect(panel.dataset.active).toBe("false");
    }
  });

  it("bounds mounted panels while opening ten panels sequentially, then reclaims", async () => {
    const names = Array.from({ length: 10 }, (_, index) => `panel-${index}`);
    const { show } = await renderHarness(names);

    let peakMounted = 0;
    for (const name of names) {
      await show([name]);
      peakMounted = Math.max(peakMounted, mountedPanels().length);
      expect(mountedPanels().length).toBeLessThanOrEqual(PANEL_LRU_CAPACITY + 1);
    }

    expect(peakMounted).toBeGreaterThan(0);
    expect(mountedPanels()).toHaveLength(PANEL_LRU_CAPACITY);

    await show([]);

    expect(mountedPanels()).toHaveLength(PANEL_LRU_CAPACITY);
    expect(mountedPanels()).not.toContain(names[0]);
    expect(peakMounted).toBeLessThanOrEqual(PANEL_LRU_CAPACITY + 1);
  });

  it("reclaims at least 80% of ten opened panels after closing all", async () => {
    const names = Array.from({ length: 10 }, (_, index) => `panel-${index}`);
    const { show } = await renderHarness(names);

    await show(names);
    const before = mountedPanels().length;
    expect(before).toBe(10);

    await show([]);
    const after = mountedPanels().length;

    expect(after).toBe(PANEL_LRU_CAPACITY);
    expect((before - after) / before).toBeGreaterThanOrEqual(0.8);
  });

  it("reclaims every never-tier panel after closing all", async () => {
    const names = Array.from({ length: 10 }, (_, index) => `tool-${index}`);
    const { show } = await renderHarness(names, {
      keepAlive: Object.fromEntries(names.map((name) => [name, "never"])) as Record<
        string,
        PanelKeepAlive
      >,
    });

    await show(names);
    expect(mountedPanels()).toHaveLength(10);

    await show([]);
    expect(mountedPanels()).toEqual([]);
  });

  it("retains panels in LRU order when a panel is reopened", async () => {
    const { show } = await renderHarness(["a", "b", "c"]);

    await show(["a"]);
    await show(["b"]);
    await show(["c"]);
    expect(mountedPanels()).toEqual(["b", "c"]);

    await show(["a"]);
    expect(mountedPanels()).toEqual(["a", "c"]);
    expect(log.unmounts).toEqual(["a", "b"]);

    await show([]);
    expect(mountedPanels()).toEqual(["a", "c"]);
  });

  it("remounts an evicted panel through its Suspense boundary", async () => {
    const { show } = await renderHarness(["a", "b", "c"]);

    await show(["a"]);
    await show(["b"]);
    await show(["c"]);
    expect(mountedPanels()).toEqual(["b", "c"]);

    await show(["a"]);

    expect(mountedPanels()).toEqual(["a", "c"]);
    expect(log.mounts.filter((name) => name === "a")).toHaveLength(2);
    expect(lazyLoads.a).toBe(1);
  });
});
