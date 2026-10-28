import { afterEach, describe, expect, it, vi } from "vitest";
import { drawHandwrittenDoodle } from "./handwrittenDoodles";
import { resolveHandwrittenPalette } from "./handwrittenPalette";
import type { HandwrittenDoodleKind, HandwrittenDoodleSpec } from "./handwrittenScene";

class CapturedPath {
  points: number[][] = [];

  moveTo(x: number, y: number) {
    this.points.push([x, y]);
  }

  lineTo(x: number, y: number) {
    this.points.push([x, y]);
  }

  quadraticCurveTo(_cx: number, _cy: number, x: number, y: number) {
    this.points.push([x, y]);
  }

  closePath() {}
}

const defaultSpec: HandwrittenDoodleSpec = {
  kind: "wave",
  x: 0.5,
  y: 0.5,
  scale: 1,
  rotation: 0,
  delay: 0,
  duration: 1,
  color: "ink",
  layer: "front",
  flip: false,
};

function renderPaths(
  unit: number,
  spec: HandwrittenDoodleSpec = defaultSpec,
  animation: { timeMs?: number; reducedMotion?: boolean } = {}
) {
  const paths: CapturedPath[] = [];
  const context = new Proxy(
    {},
    {
      get(_target, property) {
        if (property === "fill") {
          return (path?: CapturedPath) => {
            if (path) paths.push(path);
          };
        }
        return vi.fn();
      },
      set() {
        return true;
      },
    }
  ) as CanvasRenderingContext2D;

  drawHandwrittenDoodle(spec, {
    ctx: context,
    palette: resolveHandwrittenPalette(0),
    width: 1280,
    height: 720,
    unit,
    progress: 1,
    reducedMotion: animation.reducedMotion ?? true,
    ...(animation.timeMs === undefined ? {} : { timeMs: animation.timeMs }),
    quality: 0,
  });

  return paths;
}

/** 大插画（scale >= 1.2）会走水彩/排线/内层透光分支，需要更完整的假 ctx。 */
function renderLargeIllustration(kind: HandwrittenDoodleKind, spec: HandwrittenDoodleSpec) {
  const fillPaths: CapturedPath[] = [];
  let strokeCount = 0;
  let clipCount = 0;
  const gradient = { addColorStop: vi.fn() };
  const context = new Proxy(
    {},
    {
      get(_target, property) {
        if (property === "fill") {
          return (path?: CapturedPath) => {
            if (path) fillPaths.push(path);
          };
        }
        if (property === "stroke") {
          return () => {
            strokeCount += 1;
          };
        }
        if (property === "clip") {
          return () => {
            clipCount += 1;
          };
        }
        if (property === "createLinearGradient" || property === "createRadialGradient") {
          return () => gradient;
        }
        return vi.fn();
      },
      set() {
        return true;
      },
    }
  ) as CanvasRenderingContext2D;

  drawHandwrittenDoodle(spec, {
    ctx: context,
    palette: resolveHandwrittenPalette(0),
    width: 1920,
    height: 1080,
    unit: 220,
    progress: 1,
    reducedMotion: true,
    quality: 0,
  });

  return {
    fillPaths,
    strokes: () => strokeCount,
    clips: () => clipCount,
  };
}

afterEach(() => vi.unstubAllGlobals());

describe("handwritten doodle geometry cache", () => {
  it("different actual unit sizes bake distinct geometry even when they round alike", () => {
    vi.stubGlobal("Path2D", CapturedPath);
    const spec = {
      kind: "wave" as const,
      x: 0.5,
      y: 0.5,
      scale: 1,
      rotation: 0,
      delay: 0,
      duration: 1,
      color: "ink" as const,
      layer: "front" as const,
      flip: false,
    };

    const first = renderPaths(72.1, spec);
    const second = renderPaths(72.4, spec);

    expect(first).toHaveLength(2);
    expect(second).toHaveLength(2);
    expect(second[1]).not.toBe(first[1]);
    expect(second[1]?.points).not.toEqual(first[1]?.points);
  });

  it("same spec and unit reuse the baked path", () => {
    vi.stubGlobal("Path2D", CapturedPath);
    const spec = {
      kind: "wave" as const,
      x: 0.5,
      y: 0.5,
      scale: 1,
      rotation: 0,
      delay: 0,
      duration: 1,
      color: "ink" as const,
      layer: "front" as const,
      flip: false,
    };

    const first = renderPaths(72.25, spec);
    const second = renderPaths(72.25, spec);

    expect(second[1]).toBe(first[1]);
  });

  it("tapers both ends of an open cached line into a fine pen finish", () => {
    vi.stubGlobal("Path2D", CapturedPath);
    const paths = renderPaths(72, { ...defaultSpec, kind: "arrow" });
    const firstStroke = paths[1]!;
    const endpointOnLeft = firstStroke.points[12]!;
    const endpointOnRight = firstStroke.points[13]!;

    expect(endpointOnLeft[0]).toBeCloseTo(endpointOnRight[0]!);
    expect(endpointOnLeft[1]).toBeCloseTo(endpointOnRight[1]!);
  });

  it("draws sprig leaves as varied, smoothly sampled closed silhouettes", () => {
    vi.stubGlobal("Path2D", CapturedPath);
    const paths = renderPaths(220, { ...defaultSpec, kind: "sprig" });

    // One stem and five leaf outlines are each drawn as a faint edge plus ink.
    expect(paths).toHaveLength(12);
    const leafPaths = paths.slice(2).filter((_, index) => index % 2 === 0);
    expect(leafPaths).toHaveLength(5);
    expect(leafPaths.every((path) => path.points.length >= 40)).toBe(true);

    const bounds = leafPaths.map((path) => {
      const xs = path.points.map(([x]) => x!);
      const ys = path.points.map(([, y]) => y!);
      return {
        width: Math.max(...xs) - Math.min(...xs),
        height: Math.max(...ys) - Math.min(...ys),
      };
    });
    expect(
      new Set(bounds.map(({ width, height }) => `${width.toFixed(1)}:${height.toFixed(1)}`)).size
    ).toBeGreaterThan(2);
  });

  it("renders each wheat grain as a smooth, varied pointed kernel", () => {
    vi.stubGlobal("Path2D", CapturedPath);
    const paths = renderPaths(220, { ...defaultSpec, kind: "wheat" });

    expect(paths).toHaveLength(26);
    const grainPaths = paths.slice(2).filter((_, index) => index % 2 === 0);
    expect(grainPaths).toHaveLength(12);
    expect(grainPaths.every((path) => path.points.length >= 40)).toBe(true);

    const bounds = grainPaths.map((path) => {
      const xs = path.points.map(([x]) => x!);
      const ys = path.points.map(([, y]) => y!);
      return `${(Math.max(...xs) - Math.min(...xs)).toFixed(1)}:${(Math.max(...ys) - Math.min(...ys)).toFixed(1)}`;
    });
    expect(new Set(bounds).size).toBeGreaterThan(3);
  });

  it("lays watercolor, hatching and pane glow inside a large illustration", () => {
    vi.stubGlobal("Path2D", CapturedPath);
    const spec: HandwrittenDoodleSpec = { ...defaultSpec, kind: "window", scale: 2.4 };
    const result = renderLargeIllustration("window", spec);

    // 水彩底色 + 2 团沉积 + 内层透光 + 若干描边，说明大插画走了完整材质分支。
    expect(result.fillPaths.length).toBeGreaterThanOrEqual(4);
    expect(result.clips()).toBeGreaterThanOrEqual(1);
    // 排线路径会合并成一个 Path2D 再 stroke（每帧 1–2 次），描边走 fill 快路径。
    expect(result.strokes()).toBeGreaterThanOrEqual(1);
  });

  it("replays the cached large-illustration ink paths for the same spec", () => {
    vi.stubGlobal("Path2D", CapturedPath);
    const spec: HandwrittenDoodleSpec = { ...defaultSpec, kind: "window", scale: 2.4 };
    const first = renderLargeIllustration("window", spec);
    const second = renderLargeIllustration("window", spec);

    expect(first.fillPaths.length).toBe(second.fillPaths.length);
    // 正式的勾线路径走几何缓存：同一个 spec 对象第二次绘制应复用同一个 Path2D。
    expect(second.fillPaths[second.fillPaths.length - 1]).toBe(
      first.fillPaths[first.fillPaths.length - 1]
    );
  });

  it("replays identical points for a sharp-cornered large illustration", () => {
    vi.stubGlobal("Path2D", CapturedPath);
    // window 走逐笔锐角（外框/窗棂/窗台是直线，叶片/山弧保持平滑），
    // 同一 spec 重复绘制所有填充点列必须完全一致。
    const spec: HandwrittenDoodleSpec = { ...defaultSpec, kind: "window", scale: 2.4 };
    const first = renderLargeIllustration("window", spec);
    const second = renderLargeIllustration("window", spec);
    const firstPoints = JSON.stringify(first.fillPaths.map((path) => path.points));
    const secondPoints = JSON.stringify(second.fillPaths.map((path) => path.points));
    expect(secondPoints).toBe(firstPoints);
  });

  it("keeps a finished doodle on its settled path across animation time", () => {
    vi.stubGlobal("Path2D", CapturedPath);
    const spec = { ...defaultSpec, kind: "wave" as const };
    const first = renderPaths(72, spec, { timeMs: 100, reducedMotion: false });
    const second = renderPaths(72, spec, { timeMs: 200, reducedMotion: false });

    expect(first).toHaveLength(2);
    expect(second).toHaveLength(2);
    expect(second[1]).toBe(first[1]);
  });
});
