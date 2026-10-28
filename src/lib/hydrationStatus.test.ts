import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { useSpectrumStore } from "@/store/spectrumStore";
import { hydrateStores } from "./bootstrapStores";
import {
  getHydrationStatus,
  subscribeHydrationStatus,
  useHydrationStatus,
} from "./hydrationStatus";

function StatusProbe() {
  return createElement("span", null, useHydrationStatus());
}

describe("hydrationStatus", () => {
  it("starts idle before any hydration runs", () => {
    expect(getHydrationStatus()).toBe("idle");
  });

  it("reports hydrating while stores rehydrate, then ready", async () => {
    const seen: string[] = [];
    const unsubscribe = subscribeHydrationStatus(() => seen.push(getHydrationStatus()));

    const pending = hydrateStores();
    expect(getHydrationStatus()).toBe("hydrating");
    await expect(pending).resolves.toBeDefined();
    expect(getHydrationStatus()).toBe("ready");
    expect(seen).toEqual(["hydrating", "ready"]);

    unsubscribe();
    expect(getHydrationStatus()).toBe("ready");
  });

  it("stays ready and reuses the promise on repeated calls", async () => {
    const rehydrate = vi.spyOn(useSpectrumStore.persist, "rehydrate");
    const seen: string[] = [];
    const unsubscribe = subscribeHydrationStatus(() => seen.push(getHydrationStatus()));

    const first = hydrateStores();
    expect(hydrateStores()).toBe(first);
    await first;

    expect(getHydrationStatus()).toBe("ready");
    expect(seen).toEqual([]);
    expect(rehydrate).not.toHaveBeenCalled();
    unsubscribe();
  });

  it("keeps the SSR snapshot idle even when the client is ready", () => {
    expect(getHydrationStatus()).toBe("ready");
    expect(renderToStaticMarkup(createElement(StatusProbe))).toBe("<span>idle</span>");
  });

  it("reports error when a store rehydrate rejects", async () => {
    vi.resetModules();
    const playerStore = await import("@/store/playerStore");
    const bootstrap = await import("./bootstrapStores");
    const hydration = await import("./hydrationStatus");

    expect(hydration.getHydrationStatus()).toBe("idle");
    const rehydrate = vi
      .spyOn(playerStore.usePlayerStore.persist, "rehydrate")
      .mockRejectedValue(new Error("rehydrate failed"));
    const seen: string[] = [];
    hydration.subscribeHydrationStatus(() => seen.push(hydration.getHydrationStatus()));

    const pending = bootstrap.hydrateStores();
    expect(hydration.getHydrationStatus()).toBe("hydrating");
    await expect(pending).rejects.toThrow("rehydrate failed");
    expect(hydration.getHydrationStatus()).toBe("error");
    expect(seen).toEqual(["hydrating", "error"]);
    expect(rehydrate).toHaveBeenCalledTimes(1);
  });
});
