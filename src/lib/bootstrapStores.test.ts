import { describe, expect, it, vi } from "vitest";
import { STORAGE_REGISTRY } from "@/lib/storage/storageRegistry";
import { useAIStore } from "@/store/aiStore";
import { useAudioStore } from "@/store/audioStore";
import { usePlayerStore } from "@/store/playerStore";
import { useQueueStore } from "@/store/queueStore";
import { useSpectrumStore } from "@/store/spectrumStore";
import { useUIStore } from "@/store/uiStore";
import { HYDRATION_PHASES, buildHydrationPlan, hydrateStores } from "./bootstrapStores";

const phaseRank = (phase: string) => (HYDRATION_PHASES as readonly string[]).indexOf(phase);

describe("bootstrapStores hydration", () => {
  it("plans every registry key exactly once in phase order (player -> queue -> audio -> ui -> business)", () => {
    const plan = buildHydrationPlan();

    expect(plan).toHaveLength(STORAGE_REGISTRY.length);
    expect(new Set(plan.map((step) => step.owner)).size).toBe(STORAGE_REGISTRY.length);
    expect(plan.map((step) => step.phase)).toEqual(
      [...plan.map((step) => step.phase)].sort((a, b) => phaseRank(a) - phaseRank(b))
    );
    expect(plan[0]).toMatchObject({ owner: "playerStore", phase: "playback" });
    expect(plan[1]).toMatchObject({ owner: "queueStore", phase: "queue" });
    expect(plan[2]).toMatchObject({ owner: "audioStore", phase: "audioProjection" });
  });

  it("rehydrates in dependency order and accepts both owner names and storage keys", async () => {
    const calls: string[] = [];
    const targets: Array<[string, { persist: { rehydrate: () => Promise<void> | void } }]> = [
      ["playerStore", usePlayerStore],
      ["queueStore", useQueueStore],
      ["audioStore", useAudioStore],
      ["uiStore", useUIStore],
      ["aiStore", useAIStore],
    ];
    for (const [owner, store] of targets) {
      vi.spyOn(store.persist, "rehydrate").mockImplementation(async () => {
        calls.push(owner);
      });
    }

    const result = await hydrateStores({
      owners: ["player-store", "queueStore", "audio-store-v4", "uiStore", "aiStore"],
    });

    expect(calls).toEqual(["playerStore", "queueStore", "audioStore", "uiStore", "aiStore"]);
    expect(result.hydrated).toEqual(calls);
  });

  it("hydrates unchanged stores once across repeated calls", async () => {
    const rehydrate = vi.spyOn(useSpectrumStore.persist, "rehydrate");
    const first = hydrateStores();
    const second = hydrateStores();

    expect(second).toBe(first);
    const result = await first;
    expect(result.hydrated).not.toContain("playerStore");
    expect(result.hydrated).toHaveLength(STORAGE_REGISTRY.length - 5);
    expect(rehydrate).toHaveBeenCalledTimes(1);

    expect(hydrateStores()).toBe(first);
    await hydrateStores();
    expect(rehydrate).toHaveBeenCalledTimes(1);
  });

  it("rejects unknown keys/owners instead of hydrating silently", async () => {
    await expect(hydrateStores({ owners: ["not-a-store"] })).rejects.toThrow(
      /unknown storage key\/owner/
    );
  });
});
