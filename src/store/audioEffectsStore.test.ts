import { beforeEach, describe, expect, it, vi } from "vitest";
import { BUILT_IN_EFFECT_PRESETS } from "@/lib/audio/effectsPresets";
import { useAudioEffectsStore } from "./audioEffectsStore";

vi.mock("@/lib/audio/AudioEffectsManager", () => ({
  getAudioEffectsManager: () => ({
    setEffectEnabled: vi.fn(),
    setEffectIntensity: vi.fn(),
    reset: vi.fn(),
  }),
}));

describe("audioEffectsStore", () => {
  beforeEach(() => {
    localStorage.clear();
    useAudioEffectsStore.setState({
      effects: useAudioEffectsStore.getInitialState().effects,
      isEnabled: true,
      activeScene: null,
      xyX: 0.5,
      xyY: 0.5,
      savedPresets: [],
      presets: BUILT_IN_EFFECT_PRESETS,
      activePresetId: null,
      lastPresetId: null,
      morphState: null,
      isMorphing: false,
      lfoEnabled: false,
      lfoSpeed: 0.5,
      lfoDepth: 0.3,
    });
  });

  it("applies a built-in preset and records safe persisted metadata", () => {
    useAudioEffectsStore.getState().morphTo("vocal-focus", 900);

    const state = useAudioEffectsStore.getState();
    expect(state.activePresetId).toBe("vocal-focus");
    expect(state.lastPresetId).toBe("vocal-focus");
    expect(state.morphState?.durationMs).toBe(900);
    expect(state.effects.reverb.enabled).toBe(true);

    const persisted = localStorage.getItem("audio-effects-store-v2");
    expect(persisted).not.toBeNull();
    expect(JSON.parse(persisted!).state.lastPresetId).toBe("vocal-focus");
  });

  it("updates morph amount without accepting values outside 0..1", () => {
    useAudioEffectsStore.getState().morphTo("clarity-boost", 800);

    useAudioEffectsStore.getState().setMorphT(-2);
    expect(useAudioEffectsStore.getState().morphState?.t).toBe(0);

    useAudioEffectsStore.getState().setMorphT(2);
    expect(useAudioEffectsStore.getState().morphState?.t).toBe(1);
    expect(useAudioEffectsStore.getState().activePresetId).toBe("clarity-boost");
  });

  it("ignores unknown preset ids", () => {
    useAudioEffectsStore.getState().morphTo("missing", 800);

    expect(useAudioEffectsStore.getState().activePresetId).toBeNull();
    expect(useAudioEffectsStore.getState().morphState).toBeNull();
  });
});
