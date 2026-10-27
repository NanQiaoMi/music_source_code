import { describe, expect, it } from "vitest";
import { createGestureEngine, type GestureEngine } from "../engine";
import {
  DEFAULT_GESTURE_TUNING,
  type GestureCommandId,
  type GestureFrameEvent,
  type GestureFrameResult,
  type GestureLandmark,
  type GestureLandmarks,
} from "../types";

type CommandEvent = Extract<GestureFrameEvent, { type: "command" }>;
type ModeEvent = Extract<GestureFrameEvent, { type: "mode" }>;
type PointerUpEvent = Extract<GestureFrameEvent, { type: "pointer_up" }>;
type DwellEvent = Extract<GestureFrameEvent, { type: "dwell" }>;

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

function commandsOf(events: GestureFrameEvent[]): CommandEvent[] {
  return events.filter((event): event is CommandEvent => event.type === "command");
}

function modesOf(events: GestureFrameEvent[]): ModeEvent[] {
  return events.filter((event): event is ModeEvent => event.type === "mode");
}

function pointerUpsOf(events: GestureFrameEvent[]): PointerUpEvent[] {
  return events.filter((event): event is PointerUpEvent => event.type === "pointer_up");
}

function dwellsOf(events: GestureFrameEvent[]): DwellEvent[] {
  return events.filter((event): event is DwellEvent => event.type === "dwell");
}

function processAt(
  engine: GestureEngine,
  landmarks: GestureLandmarks | null,
  timestamp: number
): GestureFrameResult {
  return engine.processFrame(landmarks, timestamp);
}

function runPalmPath(
  start: { x: number; y: number },
  steps: readonly { x: number; y: number }[]
): GestureCommandId[] {
  const engine = createGestureEngine();
  const commands: GestureCommandId[] = [];
  let timestamp = 0;
  for (const point of [start, ...steps]) {
    const result = engine.processFrame(
      makeHand({ x: point.x, y: point.y, posture: "open_palm" }),
      timestamp
    );
    for (const event of commandsOf(result.events)) commands.push(event.command);
    timestamp += 20;
  }
  return commands;
}

describe("手势引擎 - 跟踪与坐标映射", () => {
  it("没有手时返回 idle / 空光标 / 空事件", () => {
    const engine = createGestureEngine();
    const result = engine.processFrame(null, 0);
    expect(result.handPresent).toBe(false);
    expect(result.mode).toBe("idle");
    expect(result.cursor).toBeNull();
    expect(result.events).toHaveLength(0);
    expect(result.debug.pinchRatio).toBe(0);
  });

  it("手出现后发出 tracking 事件并进入 pointer 模式", () => {
    const engine = createGestureEngine();
    const result = engine.processFrame(makeHand({ posture: "point" }), 16);
    expect(result.handPresent).toBe(true);
    expect(result.posture).toBe("point");
    expect(result.mode).toBe("pointer");
    expect(result.events.some((event) => event.type === "tracking" && event.present)).toBe(true);
    expect(result.cursor?.x).toBeGreaterThanOrEqual(0);
    expect(result.cursor?.x).toBeLessThanOrEqual(1);
    expect(result.cursor?.y).toBeGreaterThanOrEqual(0);
    expect(result.cursor?.y).toBeLessThanOrEqual(1);
  });

  it("mirror 时屏幕 x = 1 - 原始 x，再按 activeRegion 重映射", () => {
    const region = DEFAULT_GESTURE_TUNING.activeRegion;
    const mirrored = processAt(createGestureEngine(), makeHand({ x: 0.3, y: 0.5 }), 0);
    const raw = processAt(createGestureEngine({ mirror: false }), makeHand({ x: 0.3, y: 0.5 }), 0);
    const mirroredExpected = (1 - (0.3 + 0.055) - region.xMin) / (region.xMax - region.xMin);
    const rawExpected = (0.3 + 0.055 - region.xMin) / (region.xMax - region.xMin);
    expect(mirrored.cursor?.x).toBeCloseTo(mirroredExpected, 3);
    expect(raw.cursor?.x).toBeCloseTo(rawExpected, 3);
    expect(mirrored.cursor?.x ?? 0).toBeGreaterThan(raw.cursor?.x ?? 0);
  });

  it("活跃区域外的坐标被 clamp 到屏幕内", () => {
    // mirror=true 下，原始坐标越小屏幕坐标越大。
    const tooRight = processAt(createGestureEngine(), makeHand({ x: -0.1, y: 0.5 }), 0);
    const tooLeft = processAt(createGestureEngine(), makeHand({ x: 0.95, y: 0.5 }), 0);
    expect(tooRight.cursor?.x).toBe(1);
    expect(tooLeft.cursor?.x).toBe(0);
  });

  it("姿态切换需要保持 postureHoldMs 才提交", () => {
    const engine = createGestureEngine();
    expect(processAt(engine, makeHand({ posture: "point" }), 0).posture).toBe("point");
    expect(processAt(engine, makeHand({ posture: "open_palm" }), 40).posture).toBe("point");
    expect(processAt(engine, makeHand({ posture: "open_palm" }), 100).posture).toBe("point");
    const committed = processAt(engine, makeHand({ posture: "open_palm" }), 140);
    expect(committed.posture).toBe("open_palm");
    expect(committed.mode).toBe("palm");
  });
});

describe("手势引擎 - 捏合 / 点击 / 拖动", () => {
  it("捏合进入与退出使用不同阈值（滞后）", () => {
    const engine = createGestureEngine();
    processAt(engine, makeHand({ posture: "point" }), 0);
    const enter = processAt(engine, makeHand({ posture: "point", pinchRatio: 0.35 }), 100);
    expect(enter.pinching).toBe(true);
    expect(enter.mode).toBe("pinch");
    expect(enter.events.some((event) => event.type === "pointer_down")).toBe(true);

    const between = processAt(engine, makeHand({ posture: "point", pinchRatio: 0.5 }), 150);
    expect(between.pinching).toBe(true);
    expect(between.events.some((event) => event.type === "pointer_up")).toBe(false);

    const exit = processAt(engine, makeHand({ posture: "point", pinchRatio: 0.6 }), 200);
    expect(exit.pinching).toBe(false);
    expect(exit.mode).toBe("pointer");
    const up = pointerUpsOf(exit.events)[0];
    expect(up?.click).toBe(true);
    expect(up?.durationMs).toBe(100);
  });

  it("捏合只在 point 姿态下启动", () => {
    const engine = createGestureEngine();
    const result = processAt(engine, makeHand({ posture: "open_palm", pinchRatio: 0.35 }), 0);
    expect(result.pinching).toBe(false);
    expect(result.mode).toBe("palm");
  });

  it("短捏合且未移动判定 click=true", () => {
    const engine = createGestureEngine();
    processAt(engine, makeHand({ posture: "point" }), 0);
    processAt(engine, makeHand({ posture: "point", pinchRatio: 0.35 }), 100);
    const held = processAt(engine, makeHand({ posture: "point", pinchRatio: 0.35 }), 150);
    expect(held.pinching).toBe(true);
    const release = processAt(engine, makeHand({ posture: "point", pinchRatio: 0.6 }), 200);
    const up = pointerUpsOf(release.events)[0];
    expect(up?.click).toBe(true);
    expect(up?.durationMs).toBe(100);
    expect(release.pinching).toBe(false);
  });

  it("超过 pinchClickMaxMs 的捏合不判定 click", () => {
    const engine = createGestureEngine();
    processAt(engine, makeHand({ posture: "point" }), 0);
    processAt(engine, makeHand({ posture: "point", pinchRatio: 0.35 }), 100);
    processAt(engine, makeHand({ posture: "point", pinchRatio: 0.35 }), 300);
    const release = processAt(engine, makeHand({ posture: "point", pinchRatio: 0.6 }), 650);
    const up = pointerUpsOf(release.events)[0];
    expect(up?.click).toBe(false);
    expect(up?.durationMs).toBe(550);
  });

  it("移动超过容差进入 drag 模式且松开 click=false", () => {
    const engine = createGestureEngine();
    processAt(engine, makeHand({ x: 0.5, posture: "point" }), 0);
    processAt(engine, makeHand({ x: 0.5, posture: "point", pinchRatio: 0.35 }), 20);
    const modeEvents: ModeEvent[] = [];
    const positions = [0.6, 0.7, 0.8, 0.9];
    for (let index = 0; index < positions.length; index += 1) {
      const result = processAt(
        engine,
        makeHand({ x: positions[index], posture: "point", pinchRatio: 0.35 }),
        40 + index * 20
      );
      modeEvents.push(...modesOf(result.events));
    }
    expect(modeEvents.some((event) => event.mode === "drag")).toBe(true);
    const release = processAt(engine, makeHand({ x: 0.9, posture: "point", pinchRatio: 0.6 }), 140);
    expect(release.pinching).toBe(false);
    const up = pointerUpsOf(release.events)[0];
    expect(up?.click).toBe(false);
    expect(up?.durationMs).toBe(120);
  });

  it("pointer 模式移动会下发 pointer_move，且事件顺序稳定", () => {
    const engine = createGestureEngine();
    processAt(engine, makeHand({ x: 0.4, posture: "point" }), 0);
    const moved = processAt(engine, makeHand({ x: 0.5, posture: "point" }), 16);
    expect(moved.events.some((event) => event.type === "pointer_move")).toBe(true);

    const pinchEngine = createGestureEngine();
    processAt(pinchEngine, makeHand({ posture: "point" }), 0);
    const down = processAt(pinchEngine, makeHand({ posture: "point", pinchRatio: 0.35 }), 100);
    expect(down.events.map((event) => event.type)).toEqual(["mode", "pointer_down"]);
    const up = processAt(pinchEngine, makeHand({ posture: "point", pinchRatio: 0.6 }), 200);
    expect(up.events.map((event) => event.type)).toEqual(["pointer_up", "mode"]);
  });
});

describe("手势引擎 - 张掌滑动", () => {
  it("mirror 下四个方向都能触发对应 command", () => {
    expect(
      runPalmPath({ x: 0.2, y: 0.5 }, [
        { x: 0.3, y: 0.5 },
        { x: 0.4, y: 0.5 },
      ])
    ).toEqual(["swipe_left"]);
    expect(
      runPalmPath({ x: 0.8, y: 0.5 }, [
        { x: 0.7, y: 0.5 },
        { x: 0.6, y: 0.5 },
      ])
    ).toEqual(["swipe_right"]);
    expect(
      runPalmPath({ x: 0.5, y: 0.8 }, [
        { x: 0.5, y: 0.7 },
        { x: 0.5, y: 0.6 },
      ])
    ).toEqual(["swipe_up"]);
    expect(
      runPalmPath({ x: 0.5, y: 0.2 }, [
        { x: 0.5, y: 0.3 },
        { x: 0.5, y: 0.4 },
      ])
    ).toEqual(["swipe_down"]);
  });

  it("point 姿态快速移动不会误触发滑动 command", () => {
    const engine = createGestureEngine();
    processAt(engine, makeHand({ x: 0.2, posture: "point" }), 0);
    const moved = processAt(engine, makeHand({ x: 0.8, posture: "point" }), 20);
    expect(commandsOf(moved.events)).toHaveLength(0);
  });

  it("单帧内最多下发一条 command", () => {
    const engine = createGestureEngine();
    processAt(engine, makeHand({ x: 0.2, y: 0.5, posture: "open_palm" }), 0);
    const jump = processAt(engine, makeHand({ x: 0.8, y: 0.5, posture: "open_palm" }), 20);
    const commands = commandsOf(jump.events);
    expect(commands).toHaveLength(1);
    expect(commands[0]?.command).toBe("swipe_left");
  });

  it("滑动触发后进入 command cooldown，冷却结束后可再次触发", () => {
    const engine = createGestureEngine();
    const commands: GestureCommandId[] = [];
    const collect = (result: GestureFrameResult): void => {
      for (const event of commandsOf(result.events)) commands.push(event.command);
    };

    for (const [index, x] of [0.2, 0.3].entries()) {
      collect(processAt(engine, makeHand({ x, y: 0.5, posture: "open_palm" }), index * 20));
    }
    expect(commands).toEqual(["swipe_left"]);

    for (const [index, x] of [0.4, 0.5, 0.6, 0.7, 0.8].entries()) {
      const cooling = processAt(
        engine,
        makeHand({ x, y: 0.5, posture: "open_palm" }),
        40 + index * 20
      );
      expect(cooling.mode).toBe("cooldown");
      collect(cooling);
    }
    expect(commands).toEqual(["swipe_left"]);

    for (const still of [200, 300, 400, 500, 600, 700, 740]) {
      collect(processAt(engine, makeHand({ x: 0.8, y: 0.5, posture: "open_palm" }), still));
    }
    expect(commands).toEqual(["swipe_left"]);

    collect(processAt(engine, makeHand({ x: 0.7, y: 0.5, posture: "open_palm" }), 760));
    collect(processAt(engine, makeHand({ x: 0.6, y: 0.5, posture: "open_palm" }), 780));
    expect(commands).toEqual(["swipe_left", "swipe_right"]);
  });
});

describe("手势引擎 - 握拳 dwell", () => {
  it("dwell 进度递增，到时间只触发一次 fist_hold", () => {
    const engine = createGestureEngine();
    const events: GestureFrameEvent[] = [];
    for (let index = 0; index <= 7; index += 1) {
      const result = processAt(engine, makeHand({ posture: "fist" }), index * 100);
      events.push(...result.events);
    }
    for (const still of [800, 900, 1400, 1500]) {
      const result = processAt(engine, makeHand({ posture: "fist" }), still);
      events.push(...result.events);
    }

    const commands = commandsOf(events);
    expect(commands).toHaveLength(1);
    expect(commands[0]?.command).toBe("fist_hold");

    const progresses = dwellsOf(events).map((event) => event.progress);
    expect(progresses.length).toBeGreaterThanOrEqual(6);
    expect(progresses[progresses.length - 1]).toBe(1);
    expect(progresses.every((value, index) => index === 0 || value >= progresses[index - 1])).toBe(
      true
    );
  });

  it("松开后重新握拳可以再次触发", () => {
    const engine = createGestureEngine();
    const commands: GestureCommandId[] = [];
    const collect = (result: GestureFrameResult): void => {
      for (const event of commandsOf(result.events)) commands.push(event.command);
    };

    for (let index = 0; index <= 7; index += 1) {
      collect(processAt(engine, makeHand({ posture: "fist" }), index * 100));
    }
    expect(commands).toHaveLength(1);

    collect(processAt(engine, makeHand({ posture: "open_palm" }), 1600));
    collect(processAt(engine, makeHand({ posture: "open_palm" }), 1700));
    for (const time of [1800, 1900, 2000, 2100, 2200, 2300, 2400, 2500, 2600]) {
      collect(processAt(engine, makeHand({ posture: "fist" }), time));
    }
    expect(commands).toEqual(["fist_hold", "fist_hold"]);
  });
});

describe("手势引擎 - 丢手 / 重连 / observeOnly / 时间戳", () => {
  it("丢手宽限期内保留捏合，超过宽限期取消并发出 tracking=false", () => {
    const engine = createGestureEngine();
    processAt(engine, makeHand({ posture: "point" }), 0);
    processAt(engine, makeHand({ posture: "point", pinchRatio: 0.35 }), 100);

    const grace = processAt(engine, null, 200);
    expect(grace.handPresent).toBe(false);
    expect(grace.pinching).toBe(true);
    expect(grace.events.some((event) => event.type === "tracking")).toBe(false);

    const lost = processAt(engine, null, 500);
    expect(lost.pinching).toBe(false);
    expect(lost.mode).toBe("idle");
    expect(lost.cursor).toBeNull();
    expect(lost.events.some((event) => event.type === "tracking" && !event.present)).toBe(true);
    const up = pointerUpsOf(lost.events)[0];
    expect(up?.click).toBe(false);
  });

  it("丢手后重新出现恢复 tracking 与 pointer 模式", () => {
    const engine = createGestureEngine();
    processAt(engine, makeHand({ posture: "point" }), 0);
    processAt(engine, null, 400);
    const reconnect = processAt(engine, makeHand({ posture: "point" }), 600);
    expect(reconnect.handPresent).toBe(true);
    expect(reconnect.posture).toBe("point");
    expect(reconnect.mode).toBe("pointer");
    expect(reconnect.events.some((event) => event.type === "tracking" && event.present)).toBe(true);
    expect(processAt(engine, makeHand({ posture: "point" }), 700).mode).toBe("pointer");
  });

  it("observeOnly 下更新状态但不下发 pointer / command / dwell 事件", () => {
    const engine = createGestureEngine({ observeOnly: true });
    const first = processAt(engine, makeHand({ posture: "point" }), 0);
    expect(first.mode).toBe("pointer");
    const pinch = processAt(engine, makeHand({ posture: "point", pinchRatio: 0.35 }), 100);
    expect(pinch.pinching).toBe(true);
    expect(pinch.events.every((event) => event.type === "tracking" || event.type === "mode")).toBe(
      true
    );

    const palmEngine = createGestureEngine({ observeOnly: true });
    processAt(palmEngine, makeHand({ x: 0.2, y: 0.5, posture: "open_palm" }), 0);
    const swipe = processAt(palmEngine, makeHand({ x: 0.3, y: 0.5, posture: "open_palm" }), 20);
    expect(swipe.events.some((event) => event.type === "command")).toBe(false);
    expect(swipe.events.every((event) => event.type === "tracking" || event.type === "mode")).toBe(
      true
    );
  });

  it("乱序 / 重复 / 非法时间戳不崩溃且不重复触发命令", () => {
    const engine = createGestureEngine({ dwellMs: 100, commandCooldownMs: 200 });
    const frames: { landmarks: GestureLandmarks | null; timestamp: number }[] = [
      { landmarks: makeHand({ posture: "fist" }), timestamp: 0 },
      { landmarks: makeHand({ posture: "fist" }), timestamp: 100 },
      { landmarks: makeHand({ posture: "fist" }), timestamp: 100 },
      { landmarks: makeHand({ posture: "fist" }), timestamp: 50 },
      { landmarks: makeHand({ posture: "fist" }), timestamp: Number.NaN },
      { landmarks: makeHand({ posture: "fist" }), timestamp: Number.POSITIVE_INFINITY },
      { landmarks: null, timestamp: Number.NEGATIVE_INFINITY },
    ];
    const results = frames.map((frame) => engine.processFrame(frame.landmarks, frame.timestamp));

    expect(results.every((result) => Number.isFinite(result.timestamp))).toBe(true);
    expect(results.every((result) => Number.isFinite(result.debug.pinchRatio))).toBe(true);
    for (let index = 1; index < results.length; index += 1) {
      expect(results[index].timestamp).toBeGreaterThanOrEqual(results[index - 1].timestamp);
      expect(commandsOf(results[index].events).length).toBeLessThanOrEqual(1);
    }
    const commandCount = results.reduce(
      (total, result) => total + commandsOf(result.events).length,
      0
    );
    expect(commandCount).toBe(1);
  });

  it("reset 清空跟踪状态，可重新开始", () => {
    const engine = createGestureEngine();
    processAt(engine, makeHand({ posture: "point" }), 0);
    engine.reset();
    const idle = processAt(engine, null, 0);
    expect(idle.mode).toBe("idle");
    expect(idle.handPresent).toBe(false);
    const reconnect = processAt(engine, makeHand({ posture: "point" }), 16);
    expect(reconnect.events.some((event) => event.type === "tracking" && event.present)).toBe(true);
    expect(reconnect.mode).toBe("pointer");
  });
});

describe("手势引擎 - debug 指标", () => {
  it("输出 pinchRatio / palmOpenness / pointerSpeed / posture", () => {
    const engine = createGestureEngine();
    const open = processAt(engine, makeHand({ posture: "open_palm" }), 0);
    expect(open.debug.palmOpenness).toBeGreaterThan(0.9);
    expect(open.debug.pinchRatio).toBeGreaterThan(DEFAULT_GESTURE_TUNING.pinchExitRatio);
    expect(open.debug.posture).toBe("open_palm");

    const moving = createGestureEngine();
    processAt(moving, makeHand({ x: 0.3, posture: "point" }), 0);
    const moved = processAt(moving, makeHand({ x: 0.6, posture: "point" }), 16);
    expect(moved.debug.pointerSpeed).toBeGreaterThan(0);

    const pinch = createGestureEngine();
    processAt(pinch, makeHand({ posture: "point" }), 0);
    const pinched = processAt(pinch, makeHand({ posture: "point", pinchRatio: 0.35 }), 100);
    expect(pinched.debug.pinchRatio).toBeCloseTo(0.35, 2);
  });
});
