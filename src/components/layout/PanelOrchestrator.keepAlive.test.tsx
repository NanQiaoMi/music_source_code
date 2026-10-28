import { describe, expect, it } from "vitest";
import { PANEL_NAMES } from "@/store/panelStore";
import { FACTORIES, KEEPALIVE_CONFIG } from "./PanelOrchestrator";

const configEntries = Object.entries(KEEPALIVE_CONFIG);

describe("PanelOrchestrator keepAlive config", () => {
  it("covers every panel registered in panelStore and every factory exactly once", () => {
    expect(Object.keys(KEEPALIVE_CONFIG).sort()).toEqual([...PANEL_NAMES].sort());
    expect(Object.keys(KEEPALIVE_CONFIG).sort()).toEqual(Object.keys(FACTORIES).sort());
    expect(Object.keys(FACTORIES)).toHaveLength(43);
    expect(configEntries).toHaveLength(43);
  });

  it("keeps the three expensive panels on the always tier", () => {
    const always = configEntries.filter(([, tier]) => tier === "always").map(([name]) => name);

    expect(always.sort()).toEqual(["eq", "shelf3D", "visualSettings"]);
  });

  it("marks one-shot tools as never and never overlaps always", () => {
    const never = configEntries.filter(([, tier]) => tier === "never").map(([name]) => name);
    const always = configEntries.filter(([, tier]) => tier === "always").map(([name]) => name);

    expect(never.sort()).toEqual([
      "audioSourceManager",
      "crossfadeMixer",
      "dataManager",
      "dsdConverter",
      "fingerprintScanner",
      "formatConverter",
      "libraryHealth",
      "trackCutter",
    ]);
    expect(never.filter((name) => always.includes(name))).toEqual([]);
  });

  it("uses the lru tier for the remaining panels", () => {
    const lru = configEntries.filter(([, tier]) => tier === "lru").map(([name]) => name);

    expect(lru).toHaveLength(32);
    expect(lru).not.toContain("shelf3D");
    expect(lru).not.toContain("dataManager");
  });
});
