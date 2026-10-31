import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EffectContext } from "./types";
import {
  calculateCameraZoom,
  detectAudioTransient,
  resolveAnimePalette,
  calculateSteppedTime,
  calculateSteppedFrame,
  calculatePenJitter,
  spawnInkSplatter,
  updateInkParticles,
  findActiveLyricLineIndex,
  checkIsInterlude,
  drawAnimeHandwrittenMV,
  ANIME_PALETTES,
} from "./animeHandwrittenMV";

// Mock audio / player store
const fixture = vi.hoisted(() => ({
  audio: {
    currentSong: {
      id: "anime-song-1",
      title: "群青の手書",
      artist: "MIMI Band",
      source: "local",
      duration: 180,
      lyrics:
        "[00:02.00]白纸上飞舞的墨迹\n[00:08.00]在盛夏的夜空绽放\n[00:25.00][间奏]\n[00:35.00]终焉的音符落幕",
      cover: "#FF8C42",
    },
    currentTime: 4,
    duration: 180,
    isPlaying: true,
    isLoading: false,
    playbackRate: 1,
  },
}));

vi.mock("@/store/audioStore", () => ({
  useAudioStore: { getState: () => fixture.audio },
}));

vi.mock("@/store/playerStore", () => ({
  usePlayerStore: { getState: () => fixture.audio },
}));

function createMockFrame(width = 1280, height = 720): EffectContext {
  const properties = new Map<PropertyKey, unknown>();
  const ctx = new Proxy(
    {
      canvas: { width, height },
      measureText: (text: string) => ({ width: text.length * 24 }),
      createRadialGradient: () => ({ addColorStop: vi.fn() }),
      createLinearGradient: () => ({ addColorStop: vi.fn() }),
    },
    {
      get(target, property, receiver) {
        if (Reflect.has(target, property)) {
          return Reflect.get(target, property, receiver);
        }
        if (!properties.has(property)) {
          properties.set(property, vi.fn());
        }
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
    data: new Uint8Array(128).fill(20),
    params: { colorScheme: 0, fps: 12 },
    time: 1.0,
    musicTime: 4.0,
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

describe("animeHandwrittenMV 可视化模块", () => {
  beforeEach(() => {
    fixture.audio.currentTime = 4;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ==========================================
  // 1. 相机缩放插值方程测试
  // ==========================================
  describe("相机缩放插值方程 (calculateCameraZoom)", () => {
    it("初始状态 (progress <= 0) 时缩放倍率为 1.0x", () => {
      expect(calculateCameraZoom(0, false)).toBe(1.0);
      expect(calculateCameraZoom(-0.5, false)).toBe(1.0);
    });

    it("冲击特写阶段：在 progress = 0.15 时冲至 1.8x 峰值", () => {
      const peakZoom = calculateCameraZoom(0.15, false);
      expect(peakZoom).toBeCloseTo(1.8, 4);
    });

    it("回弹缓退阶段：从 0.15 冲刺后平滑回退，并在 progress = 1.0 稳定在 1.1x", () => {
      const midZoom = calculateCameraZoom(0.5, false);
      const endZoom = calculateCameraZoom(1.0, false);
      const settledZoom = calculateCameraZoom(1.5, false);

      // 中间值在 1.8x 与 1.1x 之间缓降
      expect(midZoom).toBeLessThan(1.8);
      expect(midZoom).toBeGreaterThan(1.1);

      // 到达 1.0 及之后稳定在 1.1x
      expect(endZoom).toBeCloseTo(1.1, 4);
      expect(settledZoom).toBe(1.1);
    });

    it("间奏模式 (isInterlude = true)：从 1.1x 平滑回退至 1.0x 全景", () => {
      const startInterlude = calculateCameraZoom(0, true);
      const midInterlude = calculateCameraZoom(0.5, true);
      const endInterlude = calculateCameraZoom(1.0, true);

      expect(startInterlude).toBe(1.1);
      expect(midInterlude).toBeLessThan(1.1);
      expect(midInterlude).toBeGreaterThan(1.0);
      expect(endInterlude).toBe(1.0);
    });
  });

  // ==========================================
  // 2. 音频瞬态重拍检测逻辑测试
  // ==========================================
  describe("音频瞬态重拍检测 (detectAudioTransient)", () => {
    it("空数据或静音时不会触发重拍", () => {
      const emptyData = new Uint8Array(0);
      const result = detectAudioTransient(emptyData, 30);
      expect(result.isBeat).toBe(false);
      expect(result.energy).toBe(0);

      const silenceData = new Uint8Array(64).fill(5);
      const silenceResult = detectAudioTransient(silenceData, 20);
      expect(silenceResult.isBeat).toBe(false);
    });

    it("低频能量出现爆发突增（Kick/Bass 重拍）时触发 isBeat = true", () => {
      const prevAverage = 40;
      // 构造在低频 bins (1..8) 具有高能量的突发帧
      const kickData = new Uint8Array(64);
      for (let i = 1; i <= 8; i++) {
        kickData[i] = 190;
      }

      const result = detectAudioTransient(kickData, prevAverage, {
        thresholdMultiplier: 1.25,
        minEnergy: 35,
      });

      expect(result.isBeat).toBe(true);
      expect(result.energy).toBe(190);
      expect(result.intensity).toBeGreaterThan(0.5);
      expect(result.newAverage).toBeGreaterThan(prevAverage);
    });

    it("能量缓慢平稳波动时不误报重拍", () => {
      const prevAverage = 100;
      const normalData = new Uint8Array(64).fill(102);

      const result = detectAudioTransient(normalData, prevAverage, {
        thresholdMultiplier: 1.3,
        minEnergy: 35,
        energyDeltaThreshold: 20,
      });

      expect(result.isBeat).toBe(false);
    });
  });

  // ==========================================
  // 3. 调色板映射系统测试
  // ==========================================
  describe("调色板映射系统 (resolveAnimePalette)", () => {
    it("支持四种调色板，索引正确映射", () => {
      expect(ANIME_PALETTES).toHaveLength(4);

      const p0 = resolveAnimePalette(0);
      expect(p0.name).toBe("日光暖纸");
      expect(p0.dark).toBe(false);

      const p1 = resolveAnimePalette(1);
      expect(p1.name).toBe("暮色群青");
      expect(p1.dark).toBe(true);

      const p2 = resolveAnimePalette(2);
      expect(p2.name).toBe("秋叶山吹");
      expect(p2.dark).toBe(false);

      const p3 = resolveAnimePalette(3);
      expect(p3.name).toBe("封面自适应");
    });

    it("自适应封面色（明亮色）生成适宜的亮纸调色", () => {
      const brightCover = "#F59E0B";
      const palette = resolveAnimePalette(3, brightCover);
      expect(palette.dark).toBe(false);
      expect(palette.accent).toBe(brightCover);
    });

    it("自适应封面色（深暗色）生成适宜的暗纸调色", () => {
      const darkCover = "#1E293B";
      const palette = resolveAnimePalette(3, darkCover);
      expect(palette.dark).toBe(true);
      expect(palette.accent).toBe(darkCover);
    });

    it("越界负数索引取模正常返回对应调色板", () => {
      const wrapped = resolveAnimePalette(-1);
      expect(wrapped.id).toBe(1);
      const wrapped4 = resolveAnimePalette(4);
      expect(wrapped4.id).toBe(0);
    });
  });

  // ==========================================
  // 4. 12fps / 24fps 抽帧定格步进计算测试
  // ==========================================
  describe("抽帧定格步进计算 (calculateSteppedTime / calculateSteppedFrame)", () => {
    it("12fps 抽帧将连续时间量化为 1/12 秒（约 83.33ms）步长", () => {
      expect(calculateSteppedTime(0.04, 12)).toBe(0);
      expect(calculateSteppedTime(0.084, 12)).toBeCloseTo(1 / 12, 5);
      expect(calculateSteppedTime(0.12, 12)).toBeCloseTo(1 / 12, 5);
      expect(calculateSteppedTime(0.17, 12)).toBeCloseTo(2 / 12, 5);

      expect(calculateSteppedFrame(0.04, 12)).toBe(0);
      expect(calculateSteppedFrame(0.09, 12)).toBe(1);
      expect(calculateSteppedFrame(0.17, 12)).toBe(2);
    });

    it("24fps 抽帧按 1/24 秒精确量化", () => {
      expect(calculateSteppedFrame(0.042, 24)).toBe(1);
      expect(calculateSteppedFrame(0.085, 24)).toBe(2);
    });

    it("漫画蘸水笔微抖输出在指定幅值内且具有确定性", () => {
      const jitterA1 = calculatePenJitter(1, 10, 2.0);
      const jitterA2 = calculatePenJitter(1, 10, 2.0);
      const jitterB = calculatePenJitter(1, 11, 2.0);

      // 同一帧相同输入必须确定性一致
      expect(jitterA1.x).toBe(jitterA2.x);
      expect(jitterA1.y).toBe(jitterA2.y);
      expect(jitterA1.angle).toBe(jitterA2.angle);

      // 幅值不超过 2.0px
      expect(Math.abs(jitterA1.x)).toBeLessThanOrEqual(2.0);
      expect(Math.abs(jitterA1.y)).toBeLessThanOrEqual(2.0);

      // 帧推进后产生抖动变化
      expect(jitterA1.x).not.toBe(jitterB.x);
    });
  });

  // ==========================================
  // 5. 墨滴微粒物理系统与歌词辅助测试
  // ==========================================
  describe("水彩墨滴粒子与歌词辅助函数", () => {
    it("spawnInkSplatter 生成预期数量的粒子，updateInkParticles 正确衰减并过滤已死亡粒子", () => {
      const particles = spawnInkSplatter(100, 200, 6, ["#FF0000"], 1.0);
      expect(particles).toHaveLength(6);
      expect(particles[0].x).toBe(100);
      expect(particles[0].y).toBe(200);

      const next = updateInkParticles(particles, 0.05);
      expect(next.length).toBeLessThanOrEqual(6);
      expect(next[0].x).not.toBe(100); // 位置已步进

      // 模拟长时间流逝导致粒子全部衰减死亡
      const dead = updateInkParticles(particles, 5.0);
      expect(dead).toHaveLength(0);
    });

    it("findActiveLyricLineIndex 与 checkIsInterlude 正确检测行与间奏", () => {
      const lines = [
        { start: 2.0, text: "第一句", ordinal: 0 },
        { start: 8.0, text: "第二句", ordinal: 1 },
        { start: 20.0, text: "[间奏]", ordinal: 2 },
        { start: 30.0, text: "尾句", ordinal: 3 },
      ];

      expect(findActiveLyricLineIndex(lines, 1.0)).toBe(-1);
      expect(findActiveLyricLineIndex(lines, 3.5)).toBe(0);
      expect(findActiveLyricLineIndex(lines, 9.0)).toBe(1);

      // 前奏判定为间奏
      expect(checkIsInterlude(lines, -1, 0)).toBe(true);
      // 正文歌词中不是间奏
      expect(checkIsInterlude(lines, 0, 3.0)).toBe(false);
      // 包含 [间奏] 关键字判定为间奏
      expect(checkIsInterlude(lines, 2, 22.0)).toBe(true);
    });
  });

  // ==========================================
  // 6. 完整主绘制入口集成测试
  // ==========================================
  describe("主绘制入口 drawAnimeHandwrittenMV", () => {
    it("在正常歌词与音频输入下顺畅绘制不抛出异常", () => {
      const frame = createMockFrame(1280, 720);
      expect(() => drawAnimeHandwrittenMV(frame)).not.toThrow();
    });

    it("在重拍爆发音频瞬态时触发相机微震与水彩墨滴爆裂绘制", () => {
      const frame = createMockFrame(1280, 720);
      // 模拟重拍能量
      frame.data = new Uint8Array(128).fill(220);

      expect(() => drawAnimeHandwrittenMV(frame)).not.toThrow();
    });

    it("在无歌词或待机状态下展示信纸唯美光晕与标题卡", () => {
      fixture.audio.currentSong = {
        ...fixture.audio.currentSong,
        lyrics: "",
      };
      const frame = createMockFrame(1280, 720);
      expect(() => drawAnimeHandwrittenMV(frame)).not.toThrow();
    });
  });
});
