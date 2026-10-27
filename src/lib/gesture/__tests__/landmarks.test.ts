import { describe, expect, it } from "vitest";
import {
  classifyPosture,
  fingerExtensionRatio,
  fingerExtensionScore,
  handScale,
  isFingerCurled,
  isFingerExtended,
  mirrorAndMapPoint,
  palmCenter,
  palmOpenness,
  pinchRatio,
} from "../landmarks";
import { DEFAULT_GESTURE_TUNING, type GestureLandmark, type GestureLandmarks } from "../types";

type PostureName = "point" | "open_palm" | "fist";

interface MakeHandOptions {
  x?: number;
  y?: number;
  scale?: number;
  posture?: PostureName;
  /** 精确指定 pinchRatio（拇指尖 / 食指尖距离除以 handScale）。 */
  pinchRatio?: number;
}

function createPoint(x: number, y: number): GestureLandmark {
  return { x, y, z: 0 };
}

function setFinger(
  points: GestureLandmark[],
  mcpIndex: number,
  pipIndex: number,
  dipIndex: number,
  tipIndex: number,
  extended: boolean,
  scale: number
): void {
  const mcp = points[mcpIndex];
  if (extended) {
    points[pipIndex] = createPoint(mcp.x, mcp.y - 0.05 * scale);
    points[dipIndex] = createPoint(mcp.x, mcp.y - 0.09 * scale);
    points[tipIndex] = createPoint(mcp.x, mcp.y - 0.13 * scale);
  } else {
    points[pipIndex] = createPoint(mcp.x, mcp.y - 0.018 * scale);
    points[dipIndex] = createPoint(mcp.x + 0.008 * scale, mcp.y + 0.012 * scale);
    points[tipIndex] = createPoint(mcp.x, mcp.y + 0.002 * scale);
  }
}

/** 21 点合成手：腕关节 0 在 (x, y)，手指朝画面上方（y 变小）伸展。 */
function makeHand(options: MakeHandOptions = {}): GestureLandmarks {
  const x = options.x ?? 0.5;
  const y = options.y ?? 0.6;
  const scale = options.scale ?? 1;
  const posture = options.posture ?? "point";
  const points: GestureLandmark[] = Array.from({ length: 21 }, () => createPoint(x, y));
  const at = (offsetX: number, offsetY: number): GestureLandmark =>
    createPoint(x + offsetX * scale, y + offsetY * scale);

  points[0] = at(0, 0);
  points[1] = at(0.075, -0.03);
  if (posture === "open_palm") {
    points[2] = at(0.115, -0.055);
    points[3] = at(0.15, -0.085);
    points[4] = at(0.175, -0.115);
  } else {
    points[2] = at(0.1, -0.025);
    points[3] = at(0.075, -0.005);
    points[4] = at(0.05, 0.005);
  }

  points[5] = at(0.055, -0.13);
  points[9] = at(0, -0.14);
  points[13] = at(-0.055, -0.13);
  points[17] = at(-0.105, -0.115);

  const open = posture === "open_palm";
  setFinger(points, 5, 6, 7, 8, open || posture === "point", scale);
  setFinger(points, 9, 10, 11, 12, open, scale);
  setFinger(points, 13, 14, 15, 16, open, scale);
  setFinger(points, 17, 18, 19, 20, open, scale);

  if (typeof options.pinchRatio === "number") {
    const indexTip = points[8];
    const thumbTip = points[4];
    const current = Math.hypot(indexTip.x - thumbTip.x, indexTip.y - thumbTip.y);
    const target = 0.14 * scale * options.pinchRatio;
    if (current > 1e-9) {
      // 真实捏合是拇指主动靠近食指，食指保持伸展，因此固定食指尖、只移动拇指尖。
      const ratio = target / current;
      points[4] = createPoint(
        indexTip.x + (thumbTip.x - indexTip.x) * ratio,
        indexTip.y + (thumbTip.y - indexTip.y) * ratio
      );
    }
  }

  return points;
}

const REGION = DEFAULT_GESTURE_TUNING.activeRegion;

describe("handScale", () => {
  it("使用腕关节 0 到中指 MCP 9 的距离", () => {
    expect(handScale(makeHand())).toBeCloseTo(0.14, 6);
    expect(handScale(makeHand({ scale: 2 }))).toBeCloseTo(0.28, 6);
  });

  it("空数组等非法输入返回 0", () => {
    expect(handScale([])).toBe(0);
  });
});

describe("pinchRatio", () => {
  it("未捏合时大于退出阈值", () => {
    const ratio = pinchRatio(makeHand({ posture: "point" }));
    expect(ratio).toBeGreaterThan(DEFAULT_GESTURE_TUNING.pinchExitRatio);
  });

  it("按 handScale 归一化，手放大后比例不变", () => {
    const small = pinchRatio(makeHand({ posture: "point", pinchRatio: 0.25 }));
    const large = pinchRatio(makeHand({ posture: "point", pinchRatio: 0.25, scale: 2.4 }));
    expect(small).toBeCloseTo(0.25, 2);
    expect(large).toBeCloseTo(0.25, 2);
  });
});

describe("手指伸展度", () => {
  it("point 只有食指伸展，其余三指收拢", () => {
    const hand = makeHand({ posture: "point" });
    expect(isFingerExtended(hand, "index")).toBe(true);
    expect(isFingerCurled(hand, "middle")).toBe(true);
    expect(isFingerCurled(hand, "ring")).toBe(true);
    expect(isFingerCurled(hand, "pinky")).toBe(true);
  });

  it("open_palm 五指全部伸展", () => {
    const hand = makeHand({ posture: "open_palm" });
    expect(isFingerExtended(hand, "thumb")).toBe(true);
    expect(isFingerExtended(hand, "index")).toBe(true);
    expect(isFingerExtended(hand, "middle")).toBe(true);
    expect(isFingerExtended(hand, "ring")).toBe(true);
    expect(isFingerExtended(hand, "pinky")).toBe(true);
  });

  it("fist 四指全部收拢", () => {
    const hand = makeHand({ posture: "fist" });
    expect(isFingerExtended(hand, "index")).toBe(false);
    expect(isFingerCurled(hand, "middle")).toBe(true);
  });

  it("伸展度分数落在 0-1 且伸展高于收拢", () => {
    const open = makeHand({ posture: "open_palm" });
    const fist = makeHand({ posture: "fist" });
    const extendedScore = fingerExtensionScore(open, "index");
    const curledScore = fingerExtensionScore(fist, "index");
    expect(extendedScore).toBeGreaterThan(0.9);
    expect(curledScore).toBeLessThan(0.1);
    expect(fingerExtensionRatio(open, "index")).toBeGreaterThan(
      fingerExtensionRatio(fist, "index")
    );
  });
});

describe("palmOpenness", () => {
  it("张掌接近 1、握拳接近 0、point 居中", () => {
    const open = palmOpenness(makeHand({ posture: "open_palm" }));
    const fist = palmOpenness(makeHand({ posture: "fist" }));
    const point = palmOpenness(makeHand({ posture: "point" }));
    expect(open).toBeGreaterThan(0.9);
    expect(fist).toBeLessThan(0.1);
    expect(point).toBeGreaterThan(fist);
    expect(point).toBeLessThan(open);
    expect(point).toBeGreaterThan(0.05);
  });
});

describe("classifyPosture", () => {
  it("识别 point / open_palm / fist", () => {
    expect(classifyPosture(makeHand({ posture: "point" }))).toBe("point");
    expect(classifyPosture(makeHand({ posture: "open_palm" }))).toBe("open_palm");
    expect(classifyPosture(makeHand({ posture: "fist" }))).toBe("fist");
  });

  it("非典型组合返回 unknown", () => {
    // 复制成可变数组：GestureLandmarks 是只读契约，测试内部构造非典型组合。
    const hand: GestureLandmark[] = [...makeHand({ posture: "point" })];
    const middleMcp = hand[9];
    hand[10] = createPoint(middleMcp.x, middleMcp.y - 0.05);
    hand[11] = createPoint(middleMcp.x, middleMcp.y - 0.09);
    hand[12] = createPoint(middleMcp.x, middleMcp.y - 0.13);
    expect(classifyPosture(hand)).toBe("unknown");
  });

  it("非法输入返回 unknown", () => {
    expect(classifyPosture([])).toBe("unknown");
  });
});

describe("palmCenter", () => {
  it("返回腕关节与四个 MCP 的均值", () => {
    const center = palmCenter(makeHand({ x: 0.4, y: 0.5 }));
    expect(center.x).toBeGreaterThan(0.35);
    expect(center.x).toBeLessThan(0.45);
    expect(center.y).toBeLessThan(0.5);
    expect(Number.isFinite(center.z)).toBe(true);
  });
});

describe("mirrorAndMapPoint", () => {
  it("mirror 时屏幕 x = 1 - 原始 x，再按 activeRegion 重映射", () => {
    const mapped = mirrorAndMapPoint({ x: 0.3, y: 0.3 }, { mirror: true, activeRegion: REGION });
    expect(mapped.x).toBeCloseTo((0.7 - REGION.xMin) / (REGION.xMax - REGION.xMin), 5);
    expect(mapped.y).toBeCloseTo((0.3 - REGION.yMin) / (REGION.yMax - REGION.yMin), 5);
  });

  it("mirror=false 保持原始方向", () => {
    const mapped = mirrorAndMapPoint({ x: 0.3, y: 0.5 }, { mirror: false, activeRegion: REGION });
    expect(mapped.x).toBeCloseTo(0.2143, 3);
    expect(mapped.y).toBeCloseTo(0.5, 5);
  });

  it("activeRegion 边界映射到 0 / 1", () => {
    const left = mirrorAndMapPoint(
      { x: REGION.xMin, y: REGION.yMin },
      { mirror: false, activeRegion: REGION }
    );
    const right = mirrorAndMapPoint(
      { x: REGION.xMax, y: REGION.yMax },
      { mirror: false, activeRegion: REGION }
    );
    expect(left.x).toBeCloseTo(0, 5);
    expect(left.y).toBeCloseTo(0, 5);
    expect(right.x).toBeCloseTo(1, 5);
    expect(right.y).toBeCloseTo(1, 5);
  });

  it("超出画面或区域的坐标被 clamp 到 0-1", () => {
    const outside = mirrorAndMapPoint({ x: -1, y: 2 }, { mirror: false, activeRegion: REGION });
    expect(outside.x).toBe(0);
    expect(outside.y).toBe(1);
    const mirroredLow = mirrorAndMapPoint({ x: 5, y: -5 }, { mirror: true, activeRegion: REGION });
    expect(mirroredLow.x).toBe(0);
    expect(mirroredLow.y).toBe(0);
    const mirroredHigh = mirrorAndMapPoint({ x: -5, y: 5 }, { mirror: true, activeRegion: REGION });
    expect(mirroredHigh.x).toBe(1);
    expect(mirroredHigh.y).toBe(1);
  });
});
