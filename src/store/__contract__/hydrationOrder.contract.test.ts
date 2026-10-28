// S6-11 hydration-order contract: the plan and the real rehydrate sequence must stay
// playback(player) -> queue -> audio projection -> UI -> business, name every registered key
// exactly once, and make repeat hydrateStores() calls no-ops.
import { afterEach, describe, expect, it, vi } from "vitest";
import { HYDRATION_PHASES, buildHydrationPlan, hydrateStores } from "@/lib/bootstrapStores";
import { STORAGE_REGISTRY } from "@/lib/storage/storageRegistry";
import { STORE_BINDINGS } from "./storeBindings";

const PHASES: readonly string[] = HYDRATION_PHASES;
const FIRST_STEPS = [
  ["playerStore", "playback"],
  ["queueStore", "queue"],
  ["audioStore", "audioProjection"],
  ["audioEffectsStore", "audioProjection"],
  ["audioProcessingStore", "audioProjection"],
  ["audioSourceStore", "audioProjection"],
] as const;
type Rehydratable = { persist: { rehydrate: () => Promise<void> | void } };
const bindings = STORE_BINDINGS as unknown as Record<string, Rehydratable>;

afterEach(() => vi.restoreAllMocks());

describe("hydration order contract (S6-11)", () => {
  it("keeps phase order and the dependency-critical prefix stable", () => {
    const plan = buildHydrationPlan();
    expect(PHASES).toEqual(["playback", "queue", "audioProjection", "ui", "business"]);
    expect(plan.slice(0, FIRST_STEPS.length).map((step) => [step.owner, step.phase])).toEqual(
      FIRST_STEPS
    );
    const ranks = plan.map((step) => PHASES.indexOf(step.phase));
    expect(ranks).not.toContain(-1);
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    expect(plan.find((step) => step.owner === "visualSettingsStore")?.phase).toBe("ui");
    const firstUi = plan.findIndex((step) => step.phase === "ui");
    const firstBusiness = plan.findIndex((step) => step.phase === "business");
    expect(firstUi).toBeGreaterThan(0);
    expect(firstBusiness).toBeGreaterThan(firstUi);
  });

  it("names every registered key exactly once and is deterministic", () => {
    const plan = buildHydrationPlan();
    expect(plan).toHaveLength(STORAGE_REGISTRY.length);
    expect(new Set(plan.map((step) => step.owner)).size).toBe(plan.length);
    for (const entry of STORAGE_REGISTRY) {
      expect(
        plan.filter((step) => step.owner === entry.owner),
        entry.key
      ).toHaveLength(1);
    }
    expect(buildHydrationPlan()).toEqual(plan);
    expect(
      buildHydrationPlan(["aiStore", "player-store", "ui-store-v2"]).map((step) => step.owner)
    ).toEqual(["playerStore", "uiStore", "aiStore"]);
  });

  it("rehydrates in plan order and does not hydrate the same store twice", async () => {
    const owners = [
      "playerStore",
      "queueStore",
      "audioStore",
      "uiStore",
      "visualSettingsStore",
      "aiStore",
    ];
    const calls: string[] = [];
    for (const owner of owners) {
      vi.spyOn(bindings[owner].persist, "rehydrate").mockImplementation(async () => {
        calls.push(owner);
      });
    }

    const first = await hydrateStores({ owners });
    expect(calls).toEqual(owners);
    expect(first.hydrated).toEqual(owners);

    const second = await hydrateStores({ owners });
    expect(second.hydrated).toEqual([]);
    expect(calls).toEqual(owners);
  });
});
