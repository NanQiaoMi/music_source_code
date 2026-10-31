import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EffectContext } from "./types";
import {
  calculatePerspectiveScale,
  calculateDollyZ,
  calculateDoFBlur,
  calculateCinemascopeBars,
  formatLyricTimestamp,
  formatJapaneseAnimeLyric,
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
  spawnGoldDust,
  updateGoldDust,
  spawnForegroundBokeh,
  updateForegroundBokeh,
  drawTyndallGodRays,
  drawGoldDustLayer,
  drawForegroundBokehLayer,
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

describe("animeHandwrittenMV 次世代电影级动漫手书 MV 模块", () => {
  beforeEach(() => {
    fixture.audio.currentTime = 4;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ==========================================
  // 1. 35mm 虚拟广角镜头透视投影测试
  // ==========================================
  describe("35mm 虚拟广角透视投影模型 (calculatePerspectiveScale)", () => {
    it("焦点处 (relZ = 0) 比例恒为 1.0", () => {
      expect(calculatePerspectiveScale(0, 480)).toBeCloseTo(1.0, 5);
      expect(calculatePerspectiveScale(0, 900)).toBeCloseTo(1.0, 5);
    });

    it("远景处 (relZ = 800) 透视收缩至 0.375", () => {
      // 480 / (480 + 800) = 480 / 1280 = 0.375
      expect(calculatePerspectiveScale(800, 480)).toBeCloseTo(0.375, 4);
    });

    it("近景飞掠处 (relZ = -400) 透视放大至 6.0", () => {
      // 480 / (480 - 400) = 480 / 80 = 6.0
      expect(calculatePerspectiveScale(-400, 480)).toBeCloseTo(6.0, 4);
    });

    it("近裁剪边界与负无穷深度具有安全下界保护，不发生除以零", () => {
      const nearZero = calculatePerspectiveScale(-480, 480);
      expect(nearZero).toBeGreaterThan(0);
      expect(Number.isFinite(nearZero)).toBe(true);

      const deepNegative = calculatePerspectiveScale(-2000, 480);
      expect(deepNegative).toBeGreaterThan(0);
      expect(Number.isFinite(deepNegative)).toBe(true);
    });
  });

  // ==========================================
  // 2. 镜头推拉运动动力学与缓动曲线测试
  // ==========================================
  describe("镜头推拉运动动力学 (calculateDollyZ)", () => {
    it("入场阶段 (u in [0, 0.35]) 从 Z = 800px 经由 Quartic Ease Out 平稳刹车至 Z = 0", () => {
      expect(calculateDollyZ(0)).toBe(800);
      expect(calculateDollyZ(0.35)).toBeCloseTo(0, 5);

      // Quartic Ease Out 强阻尼特性验证：前 50% 时间消耗了绝大部分深度距离
      const zEarly = calculateDollyZ(0.175); // u = 0.175 (pIn = 0.5)
      // 1 - (1 - 0.5)^4 = 1 - 0.0625 = 0.9375 => Z = 800 * 0.0625 = 50
      expect(zEarly).toBeCloseTo(50, 1);
      expect(zEarly).toBeLessThan(800);
      expect(zEarly).toBeGreaterThan(0);
    });

    it("黄金焦点呼吸驻留阶段 (u in [0.35, 0.85]) 保持微小正弦起伏 (|Z| <= 1.5px)", () => {
      const zMid1 = calculateDollyZ(0.475);
      const zMid2 = calculateDollyZ(0.6);
      const zMid3 = calculateDollyZ(0.725);
      const zDwellEnd = calculateDollyZ(0.85);

      expect(Math.abs(zMid1)).toBeLessThanOrEqual(1.51);
      expect(Math.abs(zMid2)).toBeLessThanOrEqual(1.51);
      expect(Math.abs(zMid3)).toBeLessThanOrEqual(1.51);
      expect(zDwellEnd).toBeCloseTo(0, 4);
    });

    it("离场阶段 (u in [0.85, 1.0]) 经由 Cubic Ease In 加速穿透近裁剪面至 Z = -400px", () => {
      expect(calculateDollyZ(0.85)).toBeCloseTo(0, 4);

      const zExitMid = calculateDollyZ(0.925); // pOut = 0.5 => 0.5^3 = 0.125 => Z = -400 * 0.125 = -50
      expect(zExitMid).toBeCloseTo(-50, 1);

      expect(calculateDollyZ(1.0)).toBeCloseTo(-400, 4);
    });

    it("边界越界值安全钳制", () => {
      expect(calculateDollyZ(-0.5)).toBe(800);
      expect(calculateDollyZ(1.5)).toBe(-400);
    });
  });

  // ==========================================
  // 3. 光学焦外虚化量模型测试
  // ==========================================
  describe("光学焦外虚化量模型 (calculateDoFBlur)", () => {
    it("黄金焦点处 (Z = 0) 虚化量为 0（绝对锐利）", () => {
      expect(calculateDoFBlur(0)).toBe(0);
    });

    it("远景失焦 (Z > 0) 线性软化并封顶 14px", () => {
      expect(calculateDoFBlur(100)).toBeCloseTo(2.0, 3);
      expect(calculateDoFBlur(500)).toBeCloseTo(10.0, 3);
      expect(calculateDoFBlur(800)).toBe(14); // min(14, 800/50=16) => 14
      expect(calculateDoFBlur(1500)).toBe(14);
    });

    it("近景飞出散景爆开 (Z < 0) 快速扩散并封顶 24px", () => {
      expect(calculateDoFBlur(-150)).toBeCloseTo(10.0, 3);
      expect(calculateDoFBlur(-300)).toBeCloseTo(20.0, 3);
      expect(calculateDoFBlur(-400)).toBe(24); // min(24, 400/15=26.67) => 24
    });
  });

  // ==========================================
  // 4. 2.39:1 院线宽银幕遮幅与安全区测试
  // ==========================================
  describe("2.39:1 宽银幕遮幅与安全区计算 (calculateCinemascopeBars)", () => {
    it("16:9 标准视口计算出精确的上下黑边与安全区高度", () => {
      const bars = calculateCinemascopeBars(1280, 720, 2.39);
      expect(bars.active).toBe(true);
      expect(bars.aspectRatio).toBe(2.39);

      // targetHeight = 1280 / 2.39 ≈ 535.56
      // barHeight = (720 - 535.56) / 2 ≈ 92.22
      expect(bars.barHeight).toBeCloseTo(92.22, 1);
      expect(bars.safeTop).toBeCloseTo(92.22, 1);
      expect(bars.safeBottom).toBeCloseTo(720 - 92.22, 1);
      expect(bars.safeHeight).toBeCloseTo(535.56, 1);
      expect(bars.safeTop + bars.safeHeight + bars.barHeight).toBeCloseTo(720, 1);
    });

    it("原生 2.39:1 超宽屏视口无需黑边 (active = false)", () => {
      const bars = calculateCinemascopeBars(2390, 1000, 2.39);
      expect(bars.active).toBe(false);
      expect(bars.barHeight).toBe(0);
      expect(bars.safeHeight).toBe(1000);
    });

    it("异常尺寸（0 或负数）安全兜底无异常抛出", () => {
      const zero = calculateCinemascopeBars(0, 0, 2.39);
      expect(zero.active).toBe(false);
      expect(zero.barHeight).toBe(0);
    });
  });

  // ==========================================
  // 5. 时间戳与日系排版辅助函数测试
  // ==========================================
  describe("排版与元数据格式化 (formatLyricTimestamp / formatJapaneseAnimeLyric)", () => {
    it("正确生成毫秒级分秒时间戳 (如 01:42.80)", () => {
      expect(formatLyricTimestamp(0)).toBe("00:00.00");
      expect(formatLyricTimestamp(102.8)).toBe("01:42.80");
      expect(formatLyricTimestamp(65.12)).toBe("01:05.12");
      expect(formatLyricTimestamp(245.05)).toBe("04:05.05");
      expect(formatLyricTimestamp(-1)).toBe("00:00.00");
    });

    it("日系手书排版智能包裹「」主歌词且不重复", () => {
      expect(formatJapaneseAnimeLyric("白纸上飞舞的墨迹")).toBe("「白纸上飞舞的墨迹」");
      expect(formatJapaneseAnimeLyric("「已经有括号」")).toBe("「已经有括号」");
      expect(formatJapaneseAnimeLyric("『双书名号』")).toBe("『双书名号』");
      expect(formatJapaneseAnimeLyric("【间奏】")).toBe("【间奏】");
      expect(formatJapaneseAnimeLyric("   ")).toBe("");
    });
  });

  // ==========================================
  // 6. AE 连续摄像机插值与缓动测试
  // ==========================================
  describe("AE 连续摄像机与贝塞尔缓动 (calculateCameraTransitionEasing / calculateContinuousAECamera)", () => {
    it("SmootherStep 缓动方程单调递增且在端点平滑收敛", () => {
      expect(calculateCameraTransitionEasing(0)).toBe(0);
      expect(calculateCameraTransitionEasing(1)).toBe(1);
      expect(calculateCameraTransitionEasing(-0.2)).toBe(0);
      expect(calculateCameraTransitionEasing(1.5)).toBe(1);

      let prev = -0.001;
      for (let t = 0; t <= 1.0; t += 0.05) {
        const val = calculateCameraTransitionEasing(t);
        expect(val).toBeGreaterThanOrEqual(prev);
        prev = val;
      }

      expect(calculateCameraTransitionEasing(0.5)).toBeCloseTo(0.5, 4);
    });

    it("calculateContinuousAECamera 沿 Z 轴做平滑无跳变连续推进", () => {
      const depthStep = 600;
      const camStart = calculateContinuousAECamera(2, 0, false, { depthStep });
      const camMid = calculateContinuousAECamera(2, 0.5, false, { depthStep });
      const camEnd = calculateContinuousAECamera(2, 1.0, false, { depthStep });

      expect(camStart.cameraZ).toBe(1 * depthStep);
      expect(camMid.cameraZ).toBeCloseTo(1.5 * depthStep, 1);
      expect(camEnd.cameraZ).toBe(2 * depthStep);

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
  // 7. 温光扫过（Warm Light Sweep）时间窗口计算测试
  // ==========================================
  describe("温光扫过过渡计算 (resolveWarmLightSweep)", () => {
    it("在过渡时间窗口 (0..1) 内激活温光扫光，并在中段达到强度峰值", () => {
      const start = resolveWarmLightSweep(0, false, 0);
      const mid = resolveWarmLightSweep(0.5, false, 0);
      const end = resolveWarmLightSweep(1.0, false, 0);

      expect(start.active).toBe(true);
      expect(mid.active).toBe(true);
      expect(end.active).toBe(true);

      expect(mid.intensity).toBeGreaterThan(start.intensity);
      expect(mid.intensity).toBeGreaterThan(end.intensity);
      expect(mid.intensity).toBeCloseTo(1.0, 3);
      expect(mid.textGlowBoost).toBeGreaterThan(0.5);

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
  // 8. 多行歌词空间纵深连续排布测试
  // ==========================================
  describe("空间纵深连续排布 (calculateLyricZPositions)", () => {
    const lines = [
      { start: 2.0, text: "上一句歌词", ordinal: 0 },
      { start: 6.0, text: "当前焦点歌词", ordinal: 1 },
      { start: 12.0, text: "下一句远景歌词", ordinal: 2 },
      { start: 18.0, text: "更远处的歌词", ordinal: 3 },
    ];

    it("正确生成上一句、当前句与下一句的纵深层级，上一句向前飘出淡化，当前句聚焦，下一句呈景深远景", () => {
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

      expect(prev!.yOffset).toBeLessThan(0);
      expect(next!.scale).toBeLessThan(curr!.scale);
      expect(next!.opacity).toBeLessThan(curr!.opacity);
      expect(next!.opacity).toBeGreaterThan(0.15);

      expect(curr!.opacity).toBeGreaterThan(0.6);
      expect(curr!.inkGrowth).toBeGreaterThan(0.5);

      const itemsFocused = calculateLyricZPositions(lines, 1, 600, 1.0, {
        depthStep: 600,
        zoomScale: 1.8,
        focalDistance: 900,
      });
      const focusedCurr = itemsFocused.find((i) => i.isCurrent);
      const focusedNext = itemsFocused.find((i) => i.isNext);

      expect(focusedCurr!.scale).toBeCloseTo(1.0, 2);
      expect(focusedCurr!.opacity).toBeCloseTo(1.0, 2);
      expect(focusedNext!.scale).toBeCloseTo(0.6, 2);
    });

    it("空歌词或无效当前行安全返回空数组", () => {
      expect(calculateLyricZPositions([], 0, 0, 0.5)).toEqual([]);
      expect(calculateLyricZPositions(lines, -1, 0, 0.5)).toEqual([]);
    });
  });

  // ==========================================
  // 9. 中远景金尘与前景大散景粒子系统
  // ==========================================
  describe("四层多平面金尘与散景系统 (GoldDust & ForegroundBokeh)", () => {
    it("spawnGoldDust 生成 200+ 颗微粒且 Z 轴分布在 200~1200", () => {
      const dust = spawnGoldDust(240, 1920, 1080);
      expect(dust.length).toBe(240);

      for (const p of dust) {
        expect(p.z).toBeGreaterThanOrEqual(200);
        expect(p.z).toBeLessThanOrEqual(1200);
        expect(p.size).toBeGreaterThan(0);
      }
    });

    it("updateGoldDust 正确模拟布朗运动与空间回环", () => {
      const dust = spawnGoldDust(50, 1920, 1080);
      const updated = updateGoldDust(dust, 0.05, 1920, 1080, 100);
      expect(updated.length).toBe(50);
      expect(Number.isFinite(updated[0].x)).toBe(true);
      expect(Number.isFinite(updated[0].y)).toBe(true);
    });

    it("spawnForegroundBokeh 生成近景大散景且 Z 轴分布在 -100~-350", () => {
      const bokeh = spawnForegroundBokeh(7, 1920, 1080);
      expect(bokeh.length).toBe(7);

      for (const d of bokeh) {
        expect(d.z).toBeLessThanOrEqual(-100);
        expect(d.z).toBeGreaterThanOrEqual(-350);
        expect(d.radius).toBeGreaterThanOrEqual(30);
      }
    });

    it("updateForegroundBokeh 高速掠镜推进无异常", () => {
      const bokeh = spawnForegroundBokeh(5, 1920, 1080);
      const updated = updateForegroundBokeh(bokeh, 0.05, 1920, 1080);
      expect(updated.length).toBe(5);
    });
  });

  // ==========================================
  // 10. 45° 丁达尔光柱与层绘制执行测试
  // ==========================================
  describe("45° 晨曦丁达尔光柱与各图层独立绘制", () => {
    it("drawTyndallGodRays 成功调用渐变并绘制多道体积光", () => {
      const frame = createMockFrame(1280, 720);
      const palette = resolveAnimePalette(1);
      expect(() =>
        drawTyndallGodRays(frame.ctx, frame.width, frame.height, 1.0, 150, palette)
      ).not.toThrow();
    });

    it("drawGoldDustLayer 与 drawForegroundBokehLayer 顺利执行", () => {
      const frame = createMockFrame(1280, 720);
      const dust = spawnGoldDust(20, 1280, 720);
      const bokeh = spawnForegroundBokeh(4, 1280, 720);

      expect(() =>
        drawGoldDustLayer(frame.ctx, dust, frame.width / 2, frame.height / 2, 480)
      ).not.toThrow();

      expect(() =>
        drawForegroundBokehLayer(frame.ctx, bokeh, frame.width / 2, frame.height / 2, 480)
      ).not.toThrow();
    });
  });

  // ==========================================
  // 11. 音频瞬态重拍与调色板系统测试
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
  // 12. 抽帧定格与水彩墨滴微粒系统测试
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
  // 13. 主绘制管线集成测试 (drawAnimeHandwrittenMV)
  // ==========================================
  describe("主绘制入口 drawAnimeHandwrittenMV 全流程", () => {
    it("正常歌词与音频输入下完整执行绘制流程，无异常抛出", () => {
      const frame = createMockFrame(1280, 720);
      expect(() => drawAnimeHandwrittenMV(frame)).not.toThrow();
    });

    it("重拍瞬态爆发与高频微震顺利执行（含鼓点红蓝色散与镜头呼吸）", () => {
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

    it("支持各种个性化参数组合（zoomScale, frameRate, inkSplatter, colorScheme, ambientGlow, cinemascope）", () => {
      const frame = createMockFrame(1920, 1080);
      frame.params = {
        zoomScale: 2.2,
        frameRate: 24,
        inkSplatter: 1.5,
        colorScheme: 1, // 暮色群青
        ambientGlow: 1.2,
        cinemascope: true,
      };
      expect(() => drawAnimeHandwrittenMV(frame)).not.toThrow();
    });
  });
});
