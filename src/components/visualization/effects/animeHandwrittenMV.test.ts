import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EffectContext } from "./types";
import {
  calculateCameraTransitionEasing,
  calculateCameraZoom,
  calculateContinuousAECamera,
  resolveWarmLightSweep,
  calculateLyricZPositions,
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
    params: {
      zoomScale: 1.8,
      frameRate: 12,
      inkSplatter: 1.0,
      colorScheme: 0,
      ambientGlow: 0.8,
    },
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

describe("animeHandwrittenMV 次世代动漫手书 MV 模块", () => {
  beforeEach(() => {
    fixture.audio.currentTime = 4;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ==========================================
  // 1. AE 连续摄像机插值与缓动测试
  // ==========================================
  describe("AE 连续摄像机与贝塞尔缓动 (calculateCameraTransitionEasing / calculateContinuousAECamera)", () => {
    it("SmootherStep 缓动方程单调递增且在端点平滑收敛", () => {
      expect(calculateCameraTransitionEasing(0)).toBe(0);
      expect(calculateCameraTransitionEasing(1)).toBe(1);
      expect(calculateCameraTransitionEasing(-0.2)).toBe(0);
      expect(calculateCameraTransitionEasing(1.5)).toBe(1);

      // 单调递增性验证
      let prev = -0.001;
      for (let t = 0; t <= 1.0; t += 0.05) {
        const val = calculateCameraTransitionEasing(t);
        expect(val).toBeGreaterThanOrEqual(prev);
        prev = val;
      }

      // 中点对称
      expect(calculateCameraTransitionEasing(0.5)).toBeCloseTo(0.5, 4);
    });

    it("calculateContinuousAECamera 沿 Z 轴做平滑无跳变连续推进", () => {
      const depthStep = 600;
      const camStart = calculateContinuousAECamera(2, 0, false, { depthStep });
      const camMid = calculateContinuousAECamera(2, 0.5, false, { depthStep });
      const camEnd = calculateContinuousAECamera(2, 1.0, false, { depthStep });

      // 推进过程单调递增无突变
      expect(camStart.cameraZ).toBe(1 * depthStep); // 前一行深度
      expect(camMid.cameraZ).toBeCloseTo(1.5 * depthStep, 1);
      expect(camEnd.cameraZ).toBe(2 * depthStep); // 目标行聚焦深度

      expect(camMid.cameraZ).toBeGreaterThan(camStart.cameraZ);
      expect(camEnd.cameraZ).toBeGreaterThan(camMid.cameraZ);
    });

    it("间奏模式下摄像机优雅回退至全景广角 (zoom = 1.0)", () => {
      const camInterlude = calculateContinuousAECamera(1, 0.5, true, { zoomScale: 2.0 });
      expect(camInterlude.isInterlude).toBe(true);
      expect(camInterlude.zoom).toBe(1.0);
    });

    it("经典缩放插值方程兼容性测试 (calculateCameraZoom)", () => {
      expect(calculateCameraZoom(0, false)).toBe(1.0);
      expect(calculateCameraZoom(0.15, false)).toBeCloseTo(1.8, 4);
      expect(calculateCameraZoom(1.0, false)).toBeCloseTo(1.1, 4);
      expect(calculateCameraZoom(0, true)).toBe(1.1);
      expect(calculateCameraZoom(1.0, true)).toBe(1.0);
    });
  });

  // ==========================================
  // 2. 温光扫过（Warm Light Sweep）时间窗口计算测试
  // ==========================================
  describe("温光扫过过渡计算 (resolveWarmLightSweep)", () => {
    it("在过渡时间窗口 (0..1) 内激活温光扫光，并在中段达到强度峰值", () => {
      const start = resolveWarmLightSweep(0, false, 0);
      const mid = resolveWarmLightSweep(0.5, false, 0);
      const end = resolveWarmLightSweep(1.0, false, 0);

      expect(start.active).toBe(true);
      expect(mid.active).toBe(true);
      expect(end.active).toBe(true);

      // 峰值出现在过渡中段
      expect(mid.intensity).toBeGreaterThan(start.intensity);
      expect(mid.intensity).toBeGreaterThan(end.intensity);
      expect(mid.intensity).toBeCloseTo(1.0, 3);
      expect(mid.textGlowBoost).toBeGreaterThan(0.5);

      // 光弧从左侧扫向右侧
      expect(start.sweepX).toBeCloseTo(-0.2, 2);
      expect(mid.sweepX).toBeCloseTo(0.5, 2);
      expect(end.sweepX).toBeCloseTo(1.2, 2);
    });

    it("间奏模式或越界进度时温光扫光处于非活动状态", () => {
      const interludeSweep = resolveWarmLightSweep(0.5, true, 0);
      expect(interludeSweep.active).toBe(false);
      expect(interludeSweep.intensity).toBe(0);

      const outOfBounds = resolveWarmLightSweep(1.5, false, 0);
      expect(outOfBounds.active).toBe(false);
    });
  });

  // ==========================================
  // 3. 多行歌词空间纵深连续排布与无裁切测试
  // ==========================================
  describe("空间纵深连续排布 (calculateLyricZPositions)", () => {
    const lines = [
      { start: 2.0, text: "上一句歌词", ordinal: 0 },
      { start: 6.0, text: "当前焦点歌词", ordinal: 1 },
      { start: 12.0, text: "下一句远景歌词", ordinal: 2 },
      { start: 18.0, text: "更远处的歌词", ordinal: 3 },
    ];

    it("正确生成上一句、当前句与下一句的纵深层级，上一句向前飘出淡化，当前句聚焦，下一句呈景深远景", () => {
      // 1. 模拟摄像机正在向 line 1 (当前句) 推进中，进度 0.5
      const cameraZMid = 0.5 * 600;
      const itemsMid = calculateLyricZPositions(lines, 1, cameraZMid, 0.5, {
        depthStep: 600,
        zoomScale: 1.8,
        focalDistance: 900,
      });

      expect(itemsMid.length).toBeGreaterThanOrEqual(3);

      const prev = itemsMid.find((i) => i.isPrevious);
      const curr = itemsMid.find((i) => i.isCurrent);
      const next = itemsMid.find((i) => i.isNext);

      expect(prev).toBeDefined();
      expect(curr).toBeDefined();
      expect(next).toBeDefined();

      // 上一句随镜头推近放大并飘向视野上方
      expect(prev!.yOffset).toBeLessThan(0);

      // 下一句在景深远处微弱可见 (约 0.5x - 0.6x 比例，且小于当前句)
      expect(next!.scale).toBeLessThan(curr!.scale);
      expect(next!.opacity).toBeLessThan(curr!.opacity);
      expect(next!.opacity).toBeGreaterThan(0.15); // 景深微弱可见

      // 当前句在黄金聚焦位逐步显现
      expect(curr!.opacity).toBeGreaterThan(0.6);
      expect(curr!.inkGrowth).toBeGreaterThan(0.5);

      // 2. 模拟摄像机已完全对焦当前句 line 1 (cameraZ = 600, progress = 1.0)
      const itemsFocused = calculateLyricZPositions(lines, 1, 600, 1.0, {
        depthStep: 600,
        zoomScale: 1.8,
        focalDistance: 900,
      });
      const focusedCurr = itemsFocused.find((i) => i.isCurrent);
      const focusedNext = itemsFocused.find((i) => i.isNext);

      // 当前句达到 1.0 黄金聚焦比例与最高透明度
      expect(focusedCurr!.scale).toBeCloseTo(1.0, 2);
      expect(focusedCurr!.opacity).toBeCloseTo(1.0, 2);

      // 下一句以黄金 0.60x 比例在景深远处微弱可见
      expect(focusedNext!.scale).toBeCloseTo(0.6, 2);
    });

    it("空歌词或无效当前行安全返回空数组", () => {
      expect(calculateLyricZPositions([], 0, 0, 0.5)).toEqual([]);
      expect(calculateLyricZPositions(lines, -1, 0, 0.5)).toEqual([]);
    });
  });

  // ==========================================
  // 4. 音频瞬态重拍检测与调色板测试
  // ==========================================
  describe("音频瞬态重拍与调色板系统", () => {
    it("音频瞬态重拍检测触发 isBeat = true", () => {
      const kickData = new Uint8Array(64);
      for (let i = 1; i <= 8; i++) kickData[i] = 200;

      const result = detectAudioTransient(kickData, 35, {
        thresholdMultiplier: 1.25,
        minEnergy: 35,
      });
      expect(result.isBeat).toBe(true);
      expect(result.energy).toBe(200);
      expect(result.intensity).toBeGreaterThan(0.5);
    });

    it("调色板映射系统正确支持 4 种方案并解析封面自适应色", () => {
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

      const p3Light = resolveAnimePalette(3, "#FFD700");
      expect(p3Light.dark).toBe(false);

      const p3Dark = resolveAnimePalette(3, "#1A202C");
      expect(p3Dark.dark).toBe(true);
    });
  });

  // ==========================================
  // 5. 抽帧定格与水彩墨滴微粒系统测试
  // ==========================================
  describe("抽帧定格与水彩墨滴微粒物理系统", () => {
    it("12fps / 24fps 抽帧定格将时间离散化", () => {
      expect(calculateSteppedTime(0.04, 12)).toBe(0);
      expect(calculateSteppedTime(0.084, 12)).toBeCloseTo(1 / 12, 5);
      expect(calculateSteppedFrame(0.09, 12)).toBe(1);
      expect(calculateSteppedFrame(0.042, 24)).toBe(1);
    });

    it("漫画蘸水笔微抖具有确定性与幅值控制", () => {
      const j1 = calculatePenJitter(42, 8, 2.0);
      const j2 = calculatePenJitter(42, 8, 2.0);
      const j3 = calculatePenJitter(42, 9, 2.0);

      expect(j1.x).toBe(j2.x);
      expect(j1.y).toBe(j2.y);
      expect(Math.abs(j1.x)).toBeLessThanOrEqual(2.0);
      expect(j1.x).not.toBe(j3.x);
    });

    it("水彩墨滴微粒生成与步进消亡", () => {
      const burst = spawnInkSplatter(100, 100, 8, ["#1E1A18"], 1.0);
      expect(burst).toHaveLength(8);

      const updated = updateInkParticles(burst, 0.05);
      expect(updated.length).toBeLessThanOrEqual(8);

      const dead = updateInkParticles(burst, 10.0);
      expect(dead).toHaveLength(0);
    });

    it("歌词行查找与间奏判定辅助函数", () => {
      const lines = [
        { start: 2.0, text: "句1", ordinal: 0 },
        { start: 8.0, text: "句2", ordinal: 1 },
        { start: 20.0, text: "[间奏]", ordinal: 2 },
      ];

      expect(findActiveLyricLineIndex(lines, 1.0)).toBe(-1);
      expect(findActiveLyricLineIndex(lines, 5.0)).toBe(0);
      expect(findActiveLyricLineIndex(lines, 10.0)).toBe(1);

      expect(checkIsInterlude(lines, -1, 0)).toBe(true);
      expect(checkIsInterlude(lines, 0, 5.0)).toBe(false);
      expect(checkIsInterlude(lines, 2, 22.0)).toBe(true);
    });
  });

  // ==========================================
  // 6. 主绘制管线集成测试 (drawAnimeHandwrittenMV)
  // ==========================================
  describe("主绘制入口 drawAnimeHandwrittenMV 全流程", () => {
    it("正常歌词与音频输入下完整执行绘制流程，无异常抛出", () => {
      const frame = createMockFrame(1280, 720);
      expect(() => drawAnimeHandwrittenMV(frame)).not.toThrow();
    });

    it("重拍瞬态爆发与高频微震顺利执行", () => {
      const frame = createMockFrame(1280, 720);
      frame.data = new Uint8Array(128).fill(220);
      expect(() => drawAnimeHandwrittenMV(frame)).not.toThrow();
    });

    it("间奏或待机模式下顺利渲染全景信纸光晕与唱片铭牌", () => {
      fixture.audio.currentSong = {
        ...fixture.audio.currentSong,
        lyrics: "",
      };
      const frame = createMockFrame(1280, 720);
      expect(() => drawAnimeHandwrittenMV(frame)).not.toThrow();
    });

    it("支持各种个性化参数组合（zoomScale, frameRate, inkSplatter, colorScheme, ambientGlow）", () => {
      const frame = createMockFrame(1920, 1080);
      frame.params = {
        zoomScale: 2.2,
        frameRate: 24,
        inkSplatter: 1.5,
        colorScheme: 1, // 暮色群青
        ambientGlow: 1.2,
      };
      expect(() => drawAnimeHandwrittenMV(frame)).not.toThrow();
    });
  });
});
