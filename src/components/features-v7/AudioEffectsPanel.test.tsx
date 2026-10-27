import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("framer-motion", () => {
  const Motion = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  return {
    AnimatePresence: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
    motion: { div: Motion, span: Motion },
  };
});

const storeState = vi.hoisted(() => {
  const visibleEffects = [
    ["reverb", "Reverb"],
    ["stereoWidener", "Stereo Widener"],
    ["megaBass", "Mega Bass"],
    ["autoPan", "Auto Pan"],
    ["vinyl", "Vinyl"],
    ["phaser", "Phaser"],
  ] as const;

  const effects: Record<string, unknown> = {};
  for (const [id, name] of visibleEffects) {
    effects[id] = {
      id,
      name,
      category: "Spatial",
      description: "",
      enabled: true,
      intensity: 0.4,
    };
  }

  return {
    effects,
    setEffectIntensity: vi.fn(),
    commitEffectIntensity: vi.fn(),
  };
});

vi.mock("@/store/audioEffectsStore", () => ({
  EFFECT_SCENES: [],
  useAudioEffectsStore: () => ({
    effects: storeState.effects,
    isEnabled: true,
    setIsEnabled: vi.fn(),
    toggleEffect: vi.fn(),
    setEffectIntensity: storeState.setEffectIntensity,
    commitEffectIntensity: storeState.commitEffectIntensity,
    resetAllEffects: vi.fn(),
    activeScene: null,
    applyScene: vi.fn(),
    clearScene: vi.fn(),
    randomize: vi.fn(),
    shuffleIntensity: vi.fn(),
    savedPresets: [],
    savePreset: vi.fn(),
    loadPreset: vi.fn(),
    deletePreset: vi.fn(),
    presets: [],
    activePresetId: null,
    morphState: null,
    morphTo: vi.fn(),
    setMorphT: vi.fn(),
  }),
}));

let frames: FrameRequestCallback[] = [];
let nextFrameId = 0;
let container: HTMLDivElement;
let root: Root;

async function renderPanel(): Promise<HTMLInputElement> {
  const { AudioEffectsPanel } = await import("./AudioEffectsPanel");
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);

  await act(async () => {
    root.render(<AudioEffectsPanel isOpen={true} onClose={() => undefined} />);
  });

  const effectsTab = Array.from(container.querySelectorAll("button")).find(
    (button) => button.textContent === "Effects"
  );
  await act(async () => {
    effectsTab?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });

  return container.querySelector('input[aria-label="Reverb intensity"]') as HTMLInputElement;
}

function setRangeValue(input: HTMLInputElement, value: number): void {
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setValue?.call(input, String(value));
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

function runFrame(): void {
  const pending = frames;
  frames = [];
  pending.forEach((callback) => callback(0));
}

describe("AudioEffectsPanel S2-2 intensity slider", () => {
  beforeEach(() => {
    frames = [];
    nextFrameId = 0;
    storeState.setEffectIntensity.mockClear();
    storeState.commitEffectIntensity.mockClear();

    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      frames.push(callback);
      nextFrameId += 1;
      return nextFrameId;
    });
    vi.stubGlobal("cancelAnimationFrame", (frameId: number) => {
      frames[frameId - 1] = () => undefined;
    });
  });

  afterEach(async () => {
    await act(async () => root?.unmount());
    document.body.innerHTML = "";
    vi.unstubAllGlobals();
  });

  it("coalesces continuous input events into one store write per frame", async () => {
    const slider = await renderPanel();

    await act(async () => {
      setRangeValue(slider, 0.5);
      setRangeValue(slider, 0.61);
      setRangeValue(slider, 0.72);
    });

    expect(storeState.setEffectIntensity).not.toHaveBeenCalled();
    expect(frames).toHaveLength(1);

    await act(async () => {
      runFrame();
    });

    expect(storeState.setEffectIntensity).toHaveBeenCalledTimes(1);
    expect(storeState.setEffectIntensity).toHaveBeenCalledWith("reverb", 0.72);
  });

  it("flushes on pointer-up, commits once, and cancels the pending frame", async () => {
    const slider = await renderPanel();

    await act(async () => {
      setRangeValue(slider, 0.8);
      slider.dispatchEvent(new Event("pointerup", { bubbles: true }));
    });

    expect(storeState.setEffectIntensity).toHaveBeenCalledTimes(1);
    expect(storeState.setEffectIntensity).toHaveBeenCalledWith("reverb", 0.8);
    expect(storeState.commitEffectIntensity).toHaveBeenCalledWith("reverb");

    await act(async () => {
      runFrame();
    });
    expect(storeState.setEffectIntensity).toHaveBeenCalledTimes(1);
  });
});
