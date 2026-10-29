// S6-5: eqStore is the only EQ owner. audioStore must expose no EQ state/actions, and legacy
// audio-store-v4 EQ settings must keep migrating into eq-store v2 without data loss.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { useAudioStore } from "./audioStore";
import { DEFAULT_EQ_PRESETS, useEQStore } from "./eqStore";

const EQ_MIRROR_KEYS = [
  "eqBands",
  "currentEQPreset",
  "isEQEnabled",
  "customEQPresets",
  "setEQBands",
  "setCurrentEQPreset",
  "setIsEQEnabled",
  "saveCustomEQPreset",
  "loadEQPreset",
] as const;

function resetEQStore(): void {
  useEQStore.setState({
    isEQEnabled: true,
    eqBands: new Array(30).fill(0),
    currentEQPreset: "flat",
    customEQPresets: {},
    eqPresets: [],
    selectedPresetId: null,
  });
}

function persistedEnvelope(key: string): { state?: Record<string, unknown>; version?: number } {
  const raw = localStorage.getItem(key);
  return raw ? (JSON.parse(raw) as { state?: Record<string, unknown>; version?: number }) : {};
}

describe("eq ownership (S6-5)", () => {
  beforeEach(() => {
    localStorage.clear();
    resetEQStore();
    useAudioStore.setState({ currentSong: null, currentTime: 0 });
  });

  it("audioStore exposes no EQ writable state or actions", () => {
    const state = useAudioStore.getState() as unknown as Record<string, unknown>;
    for (const key of EQ_MIRROR_KEYS) {
      expect(Object.prototype.hasOwnProperty.call(state, key)).toBe(false);
    }
  });

  it("AudioEqualizer reads EQ state from eqStore only", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/components/audio/AudioEqualizer.tsx"),
      "utf8"
    );
    expect(source).toContain('from "@/store/eqStore"');
    expect(source).not.toContain('from "@/store/audioStore"');
  });

  it("loadEQPreset owns both bands and the selected preset", () => {
    useEQStore.getState().loadEQPreset("rock");

    const eq = useEQStore.getState();
    expect(eq.currentEQPreset).toBe("rock");
    expect(eq.eqBands).toBe(DEFAULT_EQ_PRESETS.rock);
    const audio = useAudioStore.getState() as unknown as Record<string, unknown>;
    expect(audio.eqBands).toBeUndefined();
    expect(audio.currentEQPreset).toBeUndefined();
  });

  it("migrates legacy audio-store-v4 EQ fields into eq-store v2", async () => {
    localStorage.setItem(
      "eq-store",
      JSON.stringify({
        state: {
          isEQEnabled: false,
          eqBands: new Array(30).fill(1),
          eqPresets: [],
          selectedPresetId: null,
        },
        version: 1,
      })
    );
    localStorage.setItem(
      "audio-store-v4",
      JSON.stringify({
        state: {
          eqBands: new Array(30).fill(9),
          isEQEnabled: true,
          currentEQPreset: "rock",
          customEQPresets: { warm: [1, 2, 3] },
        },
        version: 0,
      })
    );

    await useEQStore.persist.rehydrate();

    const eq = useEQStore.getState();
    // eq-store values win; only fields missing from the pre-v2 payload come from audio-store-v4.
    expect(eq.eqBands).toEqual(new Array(30).fill(1));
    expect(eq.isEQEnabled).toBe(false);
    expect(eq.currentEQPreset).toBe("rock");
    expect(eq.customEQPresets).toEqual({ warm: [1, 2, 3] });
  });

  it("persists EQ settings under eq-store v2", () => {
    useEQStore.getState().loadEQPreset("jazz");

    const envelope = persistedEnvelope("eq-store");
    expect(envelope.version).toBe(2);
    expect(envelope.state?.currentEQPreset).toBe("jazz");
    expect(envelope.state?.eqBands).toEqual(DEFAULT_EQ_PRESETS.jazz);
  });
});
