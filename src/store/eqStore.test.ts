import { beforeEach, describe, expect, it, vi } from "vitest";
import { useEQStore } from "./eqStore";

describe("eqStore", () => {
  beforeEach(() => {
    useEQStore.setState({
      isEQEnabled: true,
      eqBands: new Array(30).fill(0),
      eqPresets: [],
      selectedPresetId: null,
    });
    localStorage.clear();
  });

  it("toggleEQ flips the enabled state", () => {
    const store = useEQStore.getState();

    store.toggleEQ();
    expect(useEQStore.getState().isEQEnabled).toBe(false);

    store.toggleEQ();
    expect(useEQStore.getState().isEQEnabled).toBe(true);
  });

  it("setEQBand updates only the targeted band", () => {
    const store = useEQStore.getState();

    store.setEQBand(3, 4.5);

    const { eqBands } = useEQStore.getState();
    expect(eqBands[3]).toBe(4.5);
    expect(eqBands[2]).toBe(0);
    expect(eqBands[4]).toBe(0);
  });

  it("resetEQ restores all bands to zero", () => {
    const store = useEQStore.getState();

    store.setEQBand(0, 1.5);
    store.setEQBand(10, -2);
    store.resetEQ();

    expect(useEQStore.getState().eqBands).toEqual(new Array(30).fill(0));
  });

  it("savePreset stores the current bands and selects the new preset", () => {
    vi.spyOn(Date, "now").mockReturnValue(12345);
    const store = useEQStore.getState();

    store.setEQBand(1, 2.5);
    store.savePreset("Vocal Boost");

    const state = useEQStore.getState();
    expect(state.eqPresets).toHaveLength(1);
    expect(state.eqPresets[0]).toEqual({
      id: "eq-12345",
      name: "Vocal Boost",
      bands: expect.arrayContaining([0, 2.5]),
    });
    expect(state.eqPresets[0].bands[1]).toBe(2.5);
    expect(state.selectedPresetId).toBe("eq-12345");
  });

  it("loadPreset restores preset bands and selection", () => {
    useEQStore.setState({
      eqBands: new Array(30).fill(0),
      eqPresets: [
        {
          id: "preset-1",
          name: "Warm",
          bands: Array.from({ length: 30 }, (_, index) => index - 15),
        },
      ],
      selectedPresetId: null,
    });

    useEQStore.getState().loadPreset("preset-1");

    const state = useEQStore.getState();
    expect(state.selectedPresetId).toBe("preset-1");
    expect(state.eqBands).toEqual(Array.from({ length: 30 }, (_, index) => index - 15));
  });

  it("loadPreset ignores unknown preset ids", () => {
    useEQStore.setState({
      eqBands: Array.from({ length: 30 }, (_, index) => index),
      eqPresets: [],
      selectedPresetId: "existing",
    });

    useEQStore.getState().loadPreset("missing");

    const state = useEQStore.getState();
    expect(state.selectedPresetId).toBe("existing");
    expect(state.eqBands).toEqual(Array.from({ length: 30 }, (_, index) => index));
  });

  it("deletePreset removes the preset and clears selection when needed", () => {
    useEQStore.setState({
      eqPresets: [
        { id: "preset-1", name: "One", bands: new Array(30).fill(1) },
        { id: "preset-2", name: "Two", bands: new Array(30).fill(2) },
      ],
      selectedPresetId: "preset-1",
    });

    useEQStore.getState().deletePreset("preset-1");

    const state = useEQStore.getState();
    expect(state.eqPresets).toHaveLength(1);
    expect(state.eqPresets[0].id).toBe("preset-2");
    expect(state.selectedPresetId).toBeNull();
  });
});
