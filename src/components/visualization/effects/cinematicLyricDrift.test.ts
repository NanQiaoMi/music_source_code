import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Song } from "@/types/song";
import type { EffectContext } from "./types";
import type { InkGlyphInput, InkLineOptions } from "./handwrittenInk";
import { drawCinematicLyricDrift } from "./cinematicLyricDrift";

const fixture = vi.hoisted(() => ({
  audio: {
    currentSong: null as Song | null,
    currentTime: 0,
    duration: 16,
    isPlaying: false,
    isLoading: false,
    playbackRate: 1,
  },
  ink: vi.fn<(glyphs: InkGlyphInput[], options: InkLineOptions) => void>(),
}));

vi.mock("@/store/audioStore", () => ({ useAudioStore: { getState: () => fixture.audio } }));
vi.mock("@/store/playerStore", () => ({ usePlayerStore: { getState: () => fixture.audio } }));
vi.mock("./handwrittenInk", () => ({ drawHandwrittenInkLine: fixture.ink }));
vi.mock("./handwrittenDoodles", () => ({
  drawHandwrittenDoodle: vi.fn(),
  drawHandwrittenSeal: vi.fn(),
}));
vi.mock("./handwrittenPaper", () => ({
  applyHandwrittenCamera: vi.fn(),
  drawHandwrittenDust: vi.fn(),
  drawHandwrittenLightLeak: vi.fn(),
  drawHandwrittenPaperSurface: vi.fn(),
}));

function createFrame(width = 1600, height = 900): EffectContext {
  const properties = new Map<PropertyKey, unknown>();
  const ctx = new Proxy(
    {
      canvas: { width, height },
      measureText: (text: string) => ({
        width:
          Array.from(text).length *
          Number(String(properties.get("font")).match(/([\d.]+)px/)?.[1] ?? 32),
      }),
      createRadialGradient: () => ({ addColorStop: vi.fn() }),
      createLinearGradient: () => ({ addColorStop: vi.fn() }),
    },
    {
      get(target, property, receiver) {
        if (Reflect.has(target, property)) return Reflect.get(target, property, receiver);
        if (!properties.has(property)) properties.set(property, vi.fn());
        return properties.get(property);
      },
      set(_target, property, value) {
        properties.set(property, value);
        return true;
      },
    }
  ) as unknown as CanvasRenderingContext2D;
  return {
    ctx,
    width,
    height,
    data: new Uint8Array(128),
    params: {},
    time: 0,
    musicTime: 0,
    refs: {
      particles: { current: [] },
      nebulaStars: { current: [] },
      spectrumStars: { current: [] },
      matrixDrops: { current: [] },
      smoothBass: { current: 0 },
      smoothMid: { current: 0 },
      smoothTreble: { current: 0 },
      bokeh: { current: [] },
      shockwaves: { current: [] },
    },
    theme: { primary: 280, secondary: 320, accent: 150 },
    utils: { getThemeBaseHue: () => 280 },
  };
}

beforeEach(() => {
  fixture.ink.mockClear();
  fixture.audio.currentTime = 0;
  fixture.audio.currentSong = {
    id: "early-vertical-lyric",
    title: "时光书页",
    artist: "MIMI Studio",
    source: "local",
    duration: 16,
    lyrics: "[00:03.00]第一句还未到来\n[00:08.00]新的纸页",
  };
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: true }))
  );
});

afterEach(() => vi.unstubAllGlobals());

describe("handwritten renderer LRC boundaries", () => {
  it("keeps a long portrait lyric and its caption below the sketch without losing text", () => {
    const lyric = "这一页写着一段特别长特别长却依旧需要完整读清的中文歌词而且不能吞掉结尾标点。";
    fixture.audio.currentSong = {
      ...fixture.audio.currentSong!,
      id: "long-portrait",
      lyrics: `[00:00.00]${lyric}\n[00:10.00]下一页`,
      translationLyrics: "[00:00.00]A long line remains complete",
    };
    fixture.audio.currentTime = 3;
    const frame = createFrame(390, 844);
    frame.time = 3000;
    drawCinematicLyricDrift(frame);
    const glyphs = fixture.ink.mock.calls
      .filter(([, options]) => options.mode === "active")
      .flatMap(([items]) => items);
    const lyricGlyphs = glyphs.filter((glyph) => /[\p{Script=Han}。]/u.test(glyph.text));
    expect(lyricGlyphs.map((glyph) => glyph.text).join("")).toBe(lyric);
    expect(
      Math.min(...lyricGlyphs.map((glyph) => glyph.y - glyph.fontSize * 0.6))
    ).toBeGreaterThanOrEqual(844 * 0.48);
    expect(Math.max(...glyphs.map((glyph) => glyph.y + glyph.fontSize * 0.6))).toBeLessThanOrEqual(
      844 * 0.9
    );
  });

  it("keeps a vertical reduced-motion lyric in the future until its exact LRC start", () => {
    const frame = createFrame();
    drawCinematicLyricDrift(frame);
    const before = fixture.ink.mock.calls.filter(
      ([glyphs]) => glyphs.map((glyph) => glyph.text).join("") === "第一句还未到来"
    );
    expect(before).toHaveLength(1);
    expect(before[0]![1].mode).toBe("future");
    expect(before[0]![0].every((glyph) => glyph.reveal === 0)).toBe(true);

    fixture.ink.mockClear();
    fixture.audio.currentTime = 3;
    frame.time = 3000;
    frame.musicTime = 3;
    drawCinematicLyricDrift(frame);
    const atStart = fixture.ink.mock.calls.filter(
      ([glyphs]) => glyphs.map((glyph) => glyph.text).join("") === "第一句还未到来"
    );
    expect(atStart).toHaveLength(1);
    expect(atStart[0]![1].mode).toBe("active");
    expect(atStart[0]![0].every((glyph) => glyph.reveal === 1)).toBe(true);
  });
});
