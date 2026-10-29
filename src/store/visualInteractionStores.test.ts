import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Song } from "@/types/song";
import { setEmotionCallbacks, useEmotionStore } from "./emotionStore";
import { useGestureSettingsStore } from "./gestureSettingsStore";
import { useGestureStore } from "./gestureStore";
import { lyricPresets, useLyricSettingsStore } from "./lyricSettingsStore";
import { useVisualizationStore } from "./visualizationStore";

const saveSongEmotions = vi.fn();
const loadSongEmotions = vi.fn();

vi.mock("@/services/metadataStorage", () => ({
  saveSongEmotions: (...args: unknown[]) => saveSongEmotions(...args),
  loadSongEmotions: (...args: unknown[]) => loadSongEmotions(...args),
}));

vi.mock("@/components/shared/GlassToast", () => ({
  toast: {
    warning: vi.fn(),
  },
}));

function resetVisualStores() {
  localStorage.clear();
  saveSongEmotions.mockReset();
  loadSongEmotions.mockReset();
  loadSongEmotions.mockResolvedValue({});
  setEmotionCallbacks({
    getSongs: () => [],
    getAIConfig: () => ({ isEnabled: false, config: null }),
    onEmotionSaved: () => undefined,
  });

  useEmotionStore.setState(useEmotionStore.getInitialState(), true);
  useGestureStore.setState(useGestureStore.getInitialState(), true);
  useGestureSettingsStore.setState(useGestureSettingsStore.getInitialState(), true);
  useLyricSettingsStore.setState(useLyricSettingsStore.getInitialState(), true);
  useVisualizationStore.setState(useVisualizationStore.getInitialState(), true);
}

function createSong(id: string, title = `Song ${id}`): Song {
  return {
    id,
    title,
    artist: "Artist",
    duration: 180,
    source: "local",
    genre: "ambient",
  };
}

describe("visual interaction stores", () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    resetVisualStores();
  });

  it("clamps saved emotion coordinates, updates initialized points, searches, and persists safe emotion fields", async () => {
    vi.useFakeTimers();
    const onEmotionSaved = vi.fn();
    setEmotionCallbacks({ onEmotionSaved });
    loadSongEmotions.mockResolvedValue({ tagged: { x: -0.4, y: 0.7, description: "warm" } });

    await useEmotionStore.getState().initializeEmotions();
    useEmotionStore
      .getState()
      .initializePoints([createSong("tagged", "Warm Light"), createSong("plain", "Plain")]);
    useEmotionStore.getState().saveSongEmotion("plain", 3, -2, "edge");
    useEmotionStore.getState().setSearchQuery("warm");
    useEmotionStore.getState().setSelectedIds(["tagged"]);
    useEmotionStore.getState().setSelectedIds((previous) => [...previous, "plain"]);
    useEmotionStore.getState().setSelectionMode("lasso");
    useEmotionStore.getState().setLassoPath([{ x: 0, y: 0 }]);
    useEmotionStore.getState().clearSelection();

    expect(useEmotionStore.getState().emotionMap.plain).toMatchObject({
      x: 1,
      y: -1,
      description: "edge",
    });
    expect(useEmotionStore.getState().points.find((point) => point.id === "plain")?.isTagged).toBe(
      true
    );
    expect(useEmotionStore.getState().searchResults).toEqual(["tagged"]);
    expect(useEmotionStore.getState().selectedIds).toEqual([]);
    expect(useEmotionStore.getState().calculateDistance("tagged", "plain")).toBeGreaterThan(0);
    expect(useEmotionStore.getState().getQuadrantStats()).toMatchObject({
      q2: 1,
      q4: 1,
      untagged: 0,
    });

    vi.advanceTimersByTime(1000);
    await vi.runOnlyPendingTimersAsync();
    expect(saveSongEmotions).toHaveBeenCalledWith(
      expect.objectContaining({ plain: expect.any(Object) })
    );
    expect(onEmotionSaved).toHaveBeenCalledWith("plain");

    const persisted = localStorage.getItem("vibe-emotion-store-v2");
    expect(persisted).not.toBeNull();
    const parsed = JSON.parse(persisted!);
    expect(parsed.state.emotionMap.plain.x).toBe(1);
    expect(parsed.state.points).toBeUndefined();
  });

  it("manages classic visualization presets without mutating other effect settings", () => {
    vi.spyOn(Date, "now").mockReturnValue(12345);
    const store = useVisualizationStore.getState();

    store.setCurrentEffect("auroraWave");
    store.updateEffectSettings("auroraWave", { speed: 2, colorIntensity: 0.4 });
    store.savePreset("Aurora custom");
    store.updateEffectSettings("auroraWave", { speed: 9 });
    store.loadPreset("preset-12345");
    store.toggleSongInfo();
    store.toggleReactToMusic();

    const state = useVisualizationStore.getState();
    expect(state.currentEffect).toBe("auroraWave");
    expect(state.currentPresetId).toBe("preset-12345");
    expect(state.effectSettings.auroraWave).toMatchObject({ speed: 2, colorIntensity: 0.4 });
    expect(state.effectSettings.spatialMesh.blurIntensity).toBe(120);
    expect(state.showSongInfo).toBe(false);
    expect(state.reactToMusic).toBe(false);

    store.deletePreset("preset-12345");
    expect(useVisualizationStore.getState().currentPresetId).toBeNull();
  });

  it("clamps lyric settings, applies presets, resets defaults, and persists preferences", () => {
    const store = useLyricSettingsStore.getState();

    store.setFontSize(99);
    store.setLineHeight(0.2);
    store.setFontWeight(1200);
    store.setOpacity(0.1);
    store.setAnimationSpeed(4);
    store.setAnimationIntensity(9);
    store.setTextShadowBlur(90);
    store.setTextStrokeWidth(12);

    expect(useLyricSettingsStore.getState()).toMatchObject({
      fontSize: 24,
      lineHeight: 1,
      fontWeight: 900,
      opacity: 0.5,
      animationSpeed: 2,
      animationIntensity: 1.5,
      textShadowBlur: 50,
      textStrokeWidth: 5,
    });

    store.applyPreset(lyricPresets[0]);
    expect(useLyricSettingsStore.getState().fontSize).toBe(16);
    store.resetSettings();
    expect(useLyricSettingsStore.getState().alignment).toBe("center");

    const persisted = localStorage.getItem("lyric-settings-storage");
    expect(persisted).not.toBeNull();
  });

  it("persists gesture settings and resets only transient gesture runtime fields", () => {
    const settings = useGestureSettingsStore.getState();
    settings.setEnabled(true);
    settings.update({ sensitivity: 1.5, volumeStep: 0.1 });
    settings.setBinding("swipe_left", "volume_up");

    const store = useGestureStore.getState();
    store.setCursor(0.2, 0.8);
    store.setHandPresent(true);
    store.setMode("pointer");
    store.setDwell({ command: "fist_hold", progress: 0.5 });
    const event = store.pushEvent({
      action: "next_track",
      command: "swipe_left",
      label: "下一首",
      detail: "Song A",
      tone: "success",
    });

    expect(event.seq).toBe(1);
    expect(useGestureStore.getState()).toMatchObject({
      lastEvent: { seq: 1, action: "next_track", label: "下一首" },
      eventSeq: 1,
      cursor: { x: 0.2, y: 0.8 },
    });

    store.resetRuntime();

    expect(useGestureStore.getState()).toMatchObject({
      cursor: { x: 0.5, y: 0.5 },
      handPresent: false,
      mode: "idle",
      dwell: null,
      lastEvent: null,
      eventSeq: 1,
    });
    expect(useGestureSettingsStore.getState()).toMatchObject({
      enabled: true,
      sensitivity: 1.5,
      volumeStep: 0.1,
      bindings: { swipe_left: "volume_up" },
    });
    expect(localStorage.getItem("mimi-gesture-settings-v1")).not.toBeNull();
  });
});
