import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setHydrationStatus } from "@/lib/hydrationStatus";
import { useRestoreAfterHydration } from "./useRestoreAfterHydration";

function RestoreProbe({ onRestore }: { onRestore: () => void }) {
  useRestoreAfterHydration(onRestore);
  return createElement("span", null, "default-ui");
}

describe("useRestoreAfterHydration", () => {
  let container: HTMLDivElement;
  let root: Root | undefined;

  beforeEach(() => {
    setHydrationStatus("idle");
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(async () => {
    await act(async () => root?.unmount());
    root = undefined;
    container.remove();
    setHydrationStatus("idle");
  });

  async function renderProbe(onRestore: () => void) {
    root = createRoot(container);
    await act(async () => root?.render(createElement(RestoreProbe, { onRestore })));
  }

  it("does not restore while idle or hydrating", async () => {
    const restore = vi.fn();
    await renderProbe(restore);

    expect(restore).not.toHaveBeenCalled();

    await act(async () => setHydrationStatus("hydrating"));
    expect(restore).not.toHaveBeenCalled();
    expect(container.textContent).toBe("default-ui");
  });

  it("restores once after hydration becomes ready", async () => {
    const restore = vi.fn();
    await renderProbe(restore);

    await act(async () => setHydrationStatus("hydrating"));
    await act(async () => setHydrationStatus("ready"));

    expect(restore).toHaveBeenCalledTimes(1);
  });

  it("also restores once when mounted after hydration is already ready", async () => {
    setHydrationStatus("ready");
    const restore = vi.fn();
    await renderProbe(restore);

    expect(restore).toHaveBeenCalledTimes(1);
  });

  it("does not restore twice when ready is reached again or the callback changes", async () => {
    const first = vi.fn();
    await renderProbe(first);

    await act(async () => setHydrationStatus("ready"));
    expect(first).toHaveBeenCalledTimes(1);

    const second = vi.fn();
    await act(async () => root?.render(createElement(RestoreProbe, { onRestore: second })));
    await act(async () => setHydrationStatus("hydrating"));
    await act(async () => setHydrationStatus("ready"));

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).not.toHaveBeenCalled();
  });

  it("skips restore on error but keeps rendering the default UI", async () => {
    const restore = vi.fn();
    await renderProbe(restore);

    await act(async () => setHydrationStatus("error"));

    expect(restore).not.toHaveBeenCalled();
    expect(container.textContent).toBe("default-ui");
  });

  it("is SSR-safe: server snapshot stays idle and effects never run", () => {
    setHydrationStatus("ready");
    const restore = vi.fn();

    const markup = renderToStaticMarkup(createElement(RestoreProbe, { onRestore: restore }));

    expect(markup).toContain("default-ui");
    expect(restore).not.toHaveBeenCalled();
  });
});
