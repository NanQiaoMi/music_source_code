import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EffectContext } from "./types";
import {
  sampleTextToPoints,
  updateQuantumParticleState,
  resolveKimiPalette,
  generateAccretionDiskPoints,
  createQuantumParticlePool,
  detectAudioEnergy,
  findKimiActiveLyricLineIndex,
  checkIsKimiInterlude,
  drawKimiQuantumGlow,
  KIMI_DEEP_BACKGROUND,
  KIMI_TITANIUM_BLUE,
  KIMI_AURORA_CYAN,
  KIMI_AURORA_VIOLET,
  KIMI_LIQUID_GOLD,
  type Point,
} from "./kimiQuantumGlow";

// Mock audio & player stores
const fixture = vi.hoisted(() => ({
  audio: {
    currentSong: {
      id: "kimi-song-1",
      title: "量子流光 · Kimi",
      artist: "MIMI Quantum Core",
      source: "local",
      duration: 210,
      lyrics:
        "[00:02.00]在深空彼岸交错的量子光流\n[00:07.50]引力透镜倒映着星云的轮廓\n[00:20.00][间奏]\n[00:32.00]凝聚成永恒的钛银与幽青",
      cover: "#67E8F9",
    },
    currentTime: 3.5,
    duration: 210,
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

function createMockEffectContext(width = 1280, height = 720): EffectContext {
  const properties = new Map<PropertyKey, unknown>();
  const ctx = new Proxy(
    {
      canvas: { width, height },
      measureText: (text: string) => ({ width: text.length * 20 }),
      createRadialGradient: () => ({ addColorStop: vi.fn() }),
      createLinearGradient: () => ({ addColorStop: vi.fn() }),
      getImageData: () => ({
        width: 100,
        height: 100,
        data: new Uint8ClampedArray(100 * 100 * 4),
      }),
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
    data: new Uint8Array(128).fill(30),
    params: {
      particleCount: 4500,
      bloomIntensity: 0.8,
      chromaticAberration: 0.5,
      sweepSpeed: 1.0,
    },
    time: 1.0,
    musicTime: 3.5,
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
    theme: { primary: 190, secondary: 160, accent: 270 },
    utils: { getThemeBaseHue: () => 190 },
  };
}

describe("kimiQuantumGlow 可视化特效模块", () => {
  beforeEach(() => {
    fixture.audio.currentTime = 3.5;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ==========================================
  // 1. 离屏文字点阵动态采样测试
  // ==========================================
  describe("sampleTextToPoints (离屏文字点阵动态采样)", () => {
    it("空文本或纯空格应安全返回空数组", () => {
      expect(sampleTextToPoints("", 800, 600)).toEqual([]);
      expect(sampleTextToPoints("   ", 800, 600)).toEqual([]);
      expect(sampleTextToPoints("\n\t  \r", 800, 600)).toEqual([]);
    });

    it("无效的画布尺寸（<=0）应安全返回空数组", () => {
      expect(sampleTextToPoints("极核流光", 0, 600)).toEqual([]);
      expect(sampleTextToPoints("极核流光", 800, -10)).toEqual([]);
    });

    it("正确从 customImageData 中采样高透明度像素点阵", () => {
      const imgW = 10;
      const imgH = 10;
      const data = new Uint8ClampedArray(imgW * imgH * 4);

      // 在 (2, 2) 与 (5, 5) 放置不透明像素 (alpha = 255)
      const idx1 = (2 * imgW + 2) * 4;
      data[idx1 + 3] = 255;
      const idx2 = (5 * imgW + 5) * 4;
      data[idx2 + 3] = 255;
      // 在 (7, 7) 放置低于阈值的半透明像素 (alpha = 50)
      const idx3 = (7 * imgW + 7) * 4;
      data[idx3 + 3] = 50;

      const points = sampleTextToPoints("测试", 100, 100, {
        step: 1,
        threshold: 120,
        customImageData: { width: imgW, height: imgH, data },
      });

      expect(points.length).toBe(2);
      expect(points[0]).toEqual({ x: 20, y: 20 });
      expect(points[1]).toEqual({ x: 50, y: 50 });
    });

    it("采样点数应严格受 maxPoints 阈值约束", () => {
      const imgW = 20;
      const imgH = 20;
      const data = new Uint8ClampedArray(imgW * imgH * 4).fill(255);

      const maxPoints = 15;
      const points = sampleTextToPoints("约束测试", 200, 200, {
        step: 1,
        maxPoints,
        customImageData: { width: imgW, height: imgH, data },
      });

      expect(points.length).toBeLessThanOrEqual(maxPoints);
    });

    it("支持全球 Unicode 字符、生僻汉字与英文排版，且坐标全部受边界保护", () => {
      const sampleTexts = [
        "Quantum Flow 96kHz",
        "极核流光 饕餮 燚 䲜",
        "こんにちは世界 • 안녕하세요",
        "✨🚀 Nova Star 123",
      ];

      for (const text of sampleTexts) {
        const points = sampleTextToPoints(text, 1280, 720, { step: 4 });
        expect(points.length).toBeGreaterThan(0);
        for (const pt of points) {
          expect(pt.x).toBeGreaterThanOrEqual(0);
          expect(pt.x).toBeLessThanOrEqual(1280);
          expect(pt.y).toBeGreaterThanOrEqual(0);
          expect(pt.y).toBeLessThanOrEqual(720);
        }
      }
    });
  });

  // ==========================================
  // 2. 量子粒子动力学与状态机测试
  // ==========================================
  describe("updateQuantumParticleState (量子粒子动力学)", () => {
    it("createQuantumParticlePool 能够创建指定数量并具有完整属性的粒子池", () => {
      const pool = createQuantumParticlePool(50, 800, 600);
      expect(pool.length).toBe(50);
      expect(pool[0]).toHaveProperty("id", 0);
      expect(pool[0]).toHaveProperty("vx");
      expect(pool[0]).toHaveProperty("vy");
      expect(pool[0]).toHaveProperty("baseSize");
      expect(pool[0]).toHaveProperty("renderSize");
      expect(pool[0]).toHaveProperty("alpha");
      expect(pool[0]).toHaveProperty("color");
      expect(pool[0]).toHaveProperty("glow");
    });

    it("attracting 状态下粒子加速向目标点锚点聚拢，且透明度上升", () => {
      const pool = createQuantumParticlePool(10, 800, 600);
      // 将粒子置于原点，目标置于 (400, 300)
      for (const p of pool) {
        p.x = 0;
        p.y = 0;
        p.vx = 0;
        p.vy = 0;
        p.alpha = 0.2;
      }
      const targets: Point[] = [{ x: 400, y: 300 }];

      const updated = updateQuantumParticleState(pool, targets, {
        state: "attracting",
        dt: 0.016,
        width: 800,
        height: 600,
        bassEnergy: 0.2,
        midTransient: 0.1,
      });

      for (const p of updated) {
        // 应产生朝向目标的正面速度
        expect(p.vx).toBeGreaterThan(0);
        expect(p.vy).toBeGreaterThan(0);
        expect(p.x).toBeGreaterThan(0);
        expect(p.y).toBeGreaterThan(0);
        expect(p.alpha).toBeGreaterThan(0.2);
      }
    });

    it("formed 状态下粒子紧密锚定并受到中频瞬态量子微震（Jitter）与扫光波驱动", () => {
      const pool = createQuantumParticlePool(5, 800, 600);
      const targets: Point[] = [{ x: 400, y: 300 }];
      for (const p of pool) {
        p.x = 400;
        p.y = 300;
        p.vx = 0;
        p.vy = 0;
      }

      // 测试凝结扫光波恰好经过粒子 x 坐标时的激发
      const sweepProgress = 0.45; // 对应 sweepX 约 400 附近
      const updated = updateQuantumParticleState(pool, targets, {
        state: "formed",
        dt: 0.016,
        width: 800,
        height: 600,
        bassEnergy: 0.1,
        midTransient: 0.8,
        sweepProgress,
      });

      for (const p of updated) {
        expect(p.glow).toBeGreaterThan(1.0);
      }
    });

    it("dissolving 状态下低频爆发导致粒子受中心向外径向推力并快速消退", () => {
      const pool = createQuantumParticlePool(8, 800, 600);
      const cx = 400;
      const cy = 300;
      // 将粒子布置在中心右下方 (450, 350)
      for (const p of pool) {
        p.x = cx + 50;
        p.y = cy + 50;
        p.vx = 0;
        p.vy = 0;
        p.alpha = 0.8;
      }

      const updated = updateQuantumParticleState(pool, [], {
        state: "dissolving",
        dt: 0.02,
        width: 800,
        height: 600,
        bassEnergy: 0.9,
        midTransient: 0.5,
        shockwaveForce: 0.8,
      });

      for (const p of updated) {
        // 径向向外推离中心
        expect(p.vx).toBeGreaterThan(0);
        // 透明度迅速消退衰减
        expect(p.alpha).toBeLessThan(0.8);
      }
    });

    it("低频能量（Bass）平滑驱动粒子尺寸呼吸膨胀", () => {
      const pool = createQuantumParticlePool(5, 800, 600);
      const baseSizes = pool.map((p) => p.baseSize);

      const updated = updateQuantumParticleState(pool, [{ x: 400, y: 300 }], {
        state: "formed",
        dt: 0.016,
        width: 800,
        height: 600,
        bassEnergy: 0.95,
        midTransient: 0.1,
      });

      for (let i = 0; i < updated.length; i++) {
        expect(updated[i].renderSize).toBeGreaterThan(baseSizes[i]);
      }
    });
  });

  // ==========================================
  // 3. 调色板与色彩映射系统测试
  // ==========================================
  describe("resolveKimiPalette (色彩体系与光影)", () => {
    it("常态低能量下使用冷峻双色调（钛银冷蓝 #67E8F9 与极光幽青 #34D399）", () => {
      const palette = resolveKimiPalette(0.2);
      expect(palette.background).toBe(KIMI_DEEP_BACKGROUND);
      expect(palette.primary.toLowerCase()).toBe(KIMI_TITANIUM_BLUE.toLowerCase());
      expect(palette.secondary.toLowerCase()).toBe(KIMI_AURORA_CYAN.toLowerCase());
      expect(palette.isHighEnergy).toBe(false);
      expect(palette.particleColors).toContain(KIMI_TITANIUM_BLUE);
      expect(palette.particleColors).toContain(KIMI_AURORA_CYAN);
    });

    it("高能量副歌状态下过渡至极光紫与流金体系", () => {
      const palette = resolveKimiPalette(0.95);
      expect(palette.isHighEnergy).toBe(true);
      expect(palette.energyRatio).toBeGreaterThan(0.5);
      expect(palette.accent.toLowerCase()).toBe(KIMI_LIQUID_GOLD.toLowerCase());
      expect(palette.particleColors).toContain(KIMI_AURORA_VIOLET);
      expect(palette.particleColors).toContain(KIMI_LIQUID_GOLD);
    });

    it("输入异常值或边界能量值时保持严格数值受限", () => {
      const paletteNeg = resolveKimiPalette(-1.5);
      expect(paletteNeg.energyRatio).toBe(0);
      expect(paletteNeg.isHighEnergy).toBe(false);

      const paletteOver = resolveKimiPalette(2.5);
      expect(paletteOver.energyRatio).toBe(1);
      expect(paletteOver.isHighEnergy).toBe(true);
    });
  });

  // ==========================================
  // 4. 间奏吸积盘几何生成测试
  // ==========================================
  describe("generateAccretionDiskPoints (双层引力透镜吸积盘)", () => {
    it("输入无效参数时安全返回空数组", () => {
      expect(generateAccretionDiskPoints(0, 800, 600, 0)).toEqual([]);
      expect(generateAccretionDiskPoints(100, 0, 600, 0)).toEqual([]);
      expect(generateAccretionDiskPoints(100, 800, -1, 0)).toEqual([]);
    });

    it("生成精确粒子数量的点阵，且全部处于画布边界之内", () => {
      const count = 200;
      const points = generateAccretionDiskPoints(count, 1280, 720, 1.5);
      expect(points.length).toBe(count);

      for (const pt of points) {
        expect(pt.x).toBeGreaterThanOrEqual(4);
        expect(pt.x).toBeLessThanOrEqual(1276);
        expect(pt.y).toBeGreaterThanOrEqual(4);
        expect(pt.y).toBeLessThanOrEqual(716);
      }
    });

    it("时间推进时吸积盘产生自旋角位移", () => {
      const pointsT1 = generateAccretionDiskPoints(50, 1280, 720, 0);
      const pointsT2 = generateAccretionDiskPoints(50, 1280, 720, 2.5);

      let deltaSum = 0;
      for (let i = 0; i < 50; i++) {
        deltaSum +=
          Math.abs(pointsT2[i].x - pointsT1[i].x) + Math.abs(pointsT2[i].y - pointsT1[i].y);
      }
      expect(deltaSum).toBeGreaterThan(10);
    });
  });

  // ==========================================
  // 5. 音频特征提取与间奏判断测试
  // ==========================================
  describe("音频特征与间奏判定辅助函数", () => {
    it("detectAudioEnergy 能从 FFT 数据提取低频、中频瞬态和高频", () => {
      const data = new Uint8Array(128).fill(0);
      // 模拟重低音
      for (let i = 0; i < 12; i++) data[i] = 200;
      // 模拟中频
      for (let i = 16; i < 48; i++) data[i] = 160;

      const features = detectAudioEnergy(data, 30, 20);
      expect(features.bassEnergy).toBeGreaterThan(0.7);
      expect(features.midTransient).toBeGreaterThan(0.5);
      expect(features.overallEnergy).toBeGreaterThan(0.3);
      expect(features.newBassAverage).toBeGreaterThan(30);
    });

    it("detectAudioEnergy 空数据时安全优雅回退", () => {
      const features = detectAudioEnergy(new Uint8Array(0), 20, 20);
      expect(features.bassEnergy).toBe(0);
      expect(features.midTransient).toBe(0);
      expect(features.overallEnergy).toBe(0);
    });

    it("findKimiActiveLyricLineIndex 正确根据当前播放秒数匹配行索引", () => {
      const lines = [
        { start: 2.0, text: "Line 1", ordinal: 0 },
        { start: 8.0, text: "Line 2", ordinal: 1 },
        { start: 16.0, text: "Line 3", ordinal: 2 },
      ];

      expect(findKimiActiveLyricLineIndex(lines, 0.5)).toBe(-1);
      expect(findKimiActiveLyricLineIndex(lines, 3.0)).toBe(0);
      expect(findKimiActiveLyricLineIndex(lines, 10.0)).toBe(1);
      expect(findKimiActiveLyricLineIndex(lines, 25.0)).toBe(2);
    });

    it("checkIsKimiInterlude 能够准确识别间奏文本标签与长间隔", () => {
      const lines = [
        { start: 2.0, text: "第一句歌词", ordinal: 0 },
        { start: 15.0, text: "[间奏]", ordinal: 1 },
        { start: 30.0, text: "第二句歌词", ordinal: 2 },
      ];

      // 文本含有 [间奏] 标签
      expect(checkIsKimiInterlude(lines, 1, 16.0)).toBe(true);

      // 第一句唱完后到间奏前的超长空隙
      expect(checkIsKimiInterlude(lines, 0, 8.0)).toBe(true);

      // 歌词刚唱响时不是间奏
      expect(checkIsKimiInterlude(lines, 0, 2.5)).toBe(false);
    });
  });

  // ==========================================
  // 6. 主渲染入口 drawKimiQuantumGlow 综合测试
  // ==========================================
  describe("drawKimiQuantumGlow (主渲染管线)", () => {
    it("能安全完成单帧完整绘制且不抛出任何异常", () => {
      const frame = createMockEffectContext();
      expect(() => drawKimiQuantumGlow(frame)).not.toThrow();
    });

    it("在歌词行更替时安全推进状态流转与粒子采样", () => {
      const frame = createMockEffectContext();

      // 第一句
      fixture.audio.currentTime = 3.0;
      frame.musicTime = 3.0;
      expect(() => drawKimiQuantumGlow(frame)).not.toThrow();

      // 第二句
      fixture.audio.currentTime = 9.0;
      frame.musicTime = 9.0;
      expect(() => drawKimiQuantumGlow(frame)).not.toThrow();
    });

    it("处于间奏阶段时安全绘制吸积盘并呼叫铭牌 HUD 流程", () => {
      const frame = createMockEffectContext();
      // 处于 22.0s 间奏时间点
      fixture.audio.currentTime = 22.0;
      frame.musicTime = 22.0;

      expect(() => drawKimiQuantumGlow(frame)).not.toThrow();
    });

    it("在无歌曲/无歌词/极端空状态下安全回退", () => {
      const frame = createMockEffectContext();
      // 模拟空歌曲
      const originalSong = fixture.audio.currentSong;
      fixture.audio.currentSong = null as unknown as typeof originalSong;

      expect(() => drawKimiQuantumGlow(frame)).not.toThrow();

      // 恢复
      fixture.audio.currentSong = originalSong;
    });
  });
});
