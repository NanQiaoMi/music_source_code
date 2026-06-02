import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AnimationPreset, AnimationTrack } from "@/lib/visualization/animationTypes";
import type { EffectPlugin, EffectPreset } from "@/lib/visualization/types";
import type { LyricLine } from "@/services/lyricsSearchService";
import type { Song } from "@/types/song";
import { setEmotionCallbacks, useEmotionStore } from "./emotionStore";
import { useAnimationStore } from "./animationStore";
import { useGestureStore } from "./gestureStore";
import { lyricPresets, useLyricSettingsStore } from "./lyricSettingsStore";
import { usePresetStore } from "./presetStore";
import { useTotemStore } from "./totemStore";
import { useVisualizationStore } from "./visualizationStore";
import { useVisualizationV8Store } from "./visualizationV8Store";

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
  useAnimationStore.setState(useAnimationStore.getInitialState(), true);
  useGestureStore.setState(useGestureStore.getInitialState(), true);
  useLyricSettingsStore.setState(useLyricSettingsStore.getInitialState(), true);
  usePresetStore.setState(usePresetStore.getInitialState(), true);
  useTotemStore.setState(useTotemStore.getInitialState(), true);
  useVisualizationStore.setState(useVisualizationStore.getInitialState(), true);
  useVisualizationV8Store.setState(useVisualizationV8Store.getInitialState(), true);
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

function createEffectPlugin(id = "effect-a"): EffectPlugin {
  return {
    id,
    name: "Effect A",
    category: "spectrum",
    description: "Test effect",
    preferredEngine: "canvas",
    parameters: [
      { id: "speed", name: "Speed", type: "number", mode: "basic", default: 1 },
      { id: "enabled", name: "Enabled", type: "boolean", mode: "professional", default: true },
    ],
    init: vi.fn(),
    render: vi.fn(),
    resize: vi.fn(),
    destroy: vi.fn(),
  };
}

function createEffectPreset(id = "preset-a"): EffectPreset {
  return {
    id,
    name: "Preset A",
    description: "A test preset",
    effectId: "effect-a",
    tags: ["test"],
    author: "MIMI",
    createdAt: 1,
    updatedAt: 1,
    isSystem: false,
    isFavorite: false,
    parameters: { speed: 1 },
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
    store.toggleFullscreen();
    store.toggleSongInfo();
    store.toggleReactToMusic();

    const state = useVisualizationStore.getState();
    expect(state.currentEffect).toBe("auroraWave");
    expect(state.currentPresetId).toBe("preset-12345");
    expect(state.effectSettings.auroraWave).toMatchObject({ speed: 2, colorIntensity: 0.4 });
    expect(state.effectSettings.spatialMesh.blurIntensity).toBe(120);
    expect(state.isFullscreen).toBe(true);
    expect(state.showSongInfo).toBe(false);
    expect(state.reactToMusic).toBe(false);

    store.deletePreset("preset-12345");
    expect(useVisualizationStore.getState().currentPresetId).toBeNull();
  });

  it("registers V8 effects once, resets default parameters, caps favorites, and persists runtime-safe fields", () => {
    const store = useVisualizationV8Store.getState();
    const effect = createEffectPlugin("effect-a");

    store.registerEffect(effect);
    store.registerEffect(effect);
    store.updateEffectSettings("effect-a", { speed: 4, extra: "custom" });
    store.resetEffectSettings("effect-a");
    for (let i = 0; i < 14; i++) {
      store.toggleFavoriteEffect(`effect-${i}`);
    }
    store.setCurrentEffect("effect-a");
    store.setCurrentEngine("webgl");
    store.setParameterMode("expert");

    const state = useVisualizationV8Store.getState();
    expect(state.effects).toHaveLength(1);
    expect(state.effectSettings["effect-a"]).toEqual({ speed: 1, enabled: true });
    expect(state.favoriteEffects).toHaveLength(12);
    expect(state.favoriteEffects[0]).toBe("effect-13");

    const persisted = localStorage.getItem("visualization-v8-store");
    expect(persisted).not.toBeNull();
    const parsed = JSON.parse(persisted!);
    expect(parsed.state.currentEngine).toBe("webgl");
    expect(parsed.state.effects).toBeUndefined();
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

  it("updates gesture feedback state and resets only transient gesture recognition fields", () => {
    const store = useGestureStore.getState();

    store.toggleGestureEnabled();
    store.setCursorPosition(0.2, 0.8);
    store.setLastGesture("heart");
    store.setGestureTriggered(true);
    store.setGestureIntensity(0.9);
    store.setShowVolumePanel(true);
    store.setVolumePanelValue(0.7);
    store.setShowSeekPreview(true);
    store.setSeekPreviewTime(42);
    store.setSeekPreviewLyric("chorus");
    store.resetGesture();

    expect(useGestureStore.getState()).toMatchObject({
      isEnabled: true,
      cursorPosition: { x: 0.2, y: 0.8 },
      lastGesture: null,
      gestureTriggered: false,
      gestureIntensity: 0,
      showVolumePanel: true,
      volumePanelValue: 0.7,
      showSeekPreview: true,
      seekPreviewTime: 42,
      seekPreviewLyric: "chorus",
    });
  });

  it("sorts animation keyframes, applies presets, and resets timeline state", () => {
    const track: AnimationTrack = {
      id: "track-1",
      parameterId: "speed",
      name: "Speed",
      enabled: true,
      interpolation: "linear",
      keyframes: [],
    };
    const preset: AnimationPreset = {
      id: "preset-1",
      name: "Preset",
      description: "Animation preset",
      syncMode: "timeline",
      tracks: [{ ...track, keyframes: [{ id: "preset-k", time: 1, value: 2 }] }],
    };
    const store = useAnimationStore.getState();

    store.addTrack(track);
    store.addKeyframe("track-1", { id: "late", time: 4, value: 4 });
    store.addKeyframe("track-1", { id: "early", time: 1, value: 1 });
    store.updateKeyframe("track-1", "late", { time: 0.5 });
    store.setCurrentTime(7);
    store.setIsPlaying(true);

    expect(useAnimationStore.getState().tracks[0].keyframes.map((keyframe) => keyframe.id)).toEqual(
      ["late", "early"]
    );

    store.applyPreset(preset);
    expect(useAnimationStore.getState()).toMatchObject({
      syncMode: "timeline",
      currentTime: 0,
      isPlaying: false,
    });

    store.reset();
    expect(useAnimationStore.getState().tracks).toEqual([]);
    expect(useAnimationStore.getState().syncMode).toBe("audio");
  });

  it("extracts and activates resonance totem keywords within their timing window", () => {
    const lyrics: LyricLine[] = [
      { time: 0, text: "Freedom rings" },
      { time: 2, text: "quiet" },
      { time: 8, text: "Burst again" },
    ];
    const store = useTotemStore.getState();

    store.initializeForSong(lyrics);
    expect(useTotemStore.getState().allKeywords.map((keyword) => keyword.text)).toEqual([
      "Freedom",
      "Burst",
    ]);

    store.updateActiveKeywords(1);
    expect(useTotemStore.getState().activeKeywords.map((keyword) => keyword.text)).toEqual([
      "Freedom",
    ]);

    const texture = {} as ImageBitmap;
    store.addPreloadedTexture("Freedom", texture);
    expect(useTotemStore.getState().preloadedTextures.Freedom).toBe(texture);

    store.clear();
    expect(useTotemStore.getState().allKeywords).toEqual([]);
  });

  it("manages V8 preset CRUD, export payloads, and system preset loading", () => {
    vi.spyOn(Date, "now").mockReturnValue(99);
    const store = usePresetStore.getState();
    const preset = createEffectPreset("preset-a");

    store.addPreset(preset);
    store.setCurrentPreset("preset-a");
    store.toggleFavorite("preset-a");
    store.updatePreset("preset-a", { name: "Renamed" });

    const exported = JSON.parse(store.exportPreset("preset-a"));
    expect(exported).toMatchObject({
      version: "1.0",
      type: "single",
      metadata: { name: "Renamed", author: "MIMI" },
    });
    expect(usePresetStore.getState().presets[0]).toMatchObject({
      name: "Renamed",
      isFavorite: true,
      updatedAt: 99,
    });

    expect(store.exportPreset("missing")).toBe("");
    store.deletePreset("preset-a");
    expect(usePresetStore.getState().currentPresetId).toBeNull();

    store.loadSystemPresets();
    expect(usePresetStore.getState().presets.every((item) => item.isSystem)).toBe(true);
  });
});
