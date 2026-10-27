import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createGestureEngine } from "../engine";
import { GesturePointerBridge } from "../pointerBridge";
import { resolveGestureActionForCommand } from "../actions";
import {
  DEFAULT_GESTURE_BINDINGS,
  type GestureFrameEvent,
  type GestureFrameResult,
  type GestureLandmark,
  type GestureLandmarks,
} from "../types";

type PostureName = "point" | "open_palm" | "fist";

interface MakeHandOptions {
  x?: number;
  y?: number;
  scale?: number;
  posture?: PostureName;
  pinchRatio?: number;
}

function point(x: number, y: number): GestureLandmark {
  return { x, y, z: 0 };
}

function setFinger(
  points: GestureLandmark[],
  mcp: number,
  pip: number,
  dip: number,
  tip: number,
  extended: boolean,
  scale: number
): void {
  const base = points[mcp];
  if (extended) {
    points[pip] = point(base.x, base.y - 0.05 * scale);
    points[dip] = point(base.x, base.y - 0.09 * scale);
    points[tip] = point(base.x, base.y - 0.13 * scale);
  } else {
    points[pip] = point(base.x, base.y - 0.018 * scale);
    points[dip] = point(base.x + 0.008 * scale, base.y + 0.012 * scale);
    points[tip] = point(base.x, base.y + 0.002 * scale);
  }
}

/** 与 engine.test 同源的 21 点合成手，保证集成测试与单测使用同一套姿态语义。 */
function makeHand(options: MakeHandOptions = {}): GestureLandmarks {
  const x = options.x ?? 0.5;
  const y = options.y ?? 0.6;
  const scale = options.scale ?? 1;
  const posture = options.posture ?? "point";
  const points: GestureLandmark[] = Array.from({ length: 21 }, () => point(x, y));
  const at = (offsetX: number, offsetY: number): GestureLandmark =>
    point(x + offsetX * scale, y + offsetY * scale);

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
    if (current > 1e-9) {
      const ratio = (0.14 * scale * options.pinchRatio) / current;
      points[4] = point(
        indexTip.x + (thumbTip.x - indexTip.x) * ratio,
        indexTip.y + (thumbTip.y - indexTip.y) * ratio
      );
    }
  }

  return points;
}

const MIRROR = true;

function cursorVisible(result: GestureFrameResult): boolean {
  return (
    result.cursor !== null &&
    (result.mode === "pointer" || result.mode === "pinch" || result.mode === "drag")
  );
}

interface Harness {
  engine: ReturnType<typeof createGestureEngine>;
  bridge: GesturePointerBridge;
  feed: (landmarks: GestureLandmarks | null) => GestureFrameResult;
  events: GestureFrameEvent[];
  now: () => number;
}

function createHarness(options?: { handLostGraceMs?: number }): Harness {
  const engine = createGestureEngine({
    mirror: MIRROR,
    postureHoldMs: 0,
    handLostGraceMs: options?.handLostGraceMs ?? 80,
    maxFps: 120,
  });
  const bridge = new GesturePointerBridge();
  const events: GestureFrameEvent[] = [];
  let timestamp = 1_000;
  let lastCursor = { x: -1, y: -1 };

  const feed = (landmarks: GestureLandmarks | null): GestureFrameResult => {
    timestamp += 16;
    const result = engine.processFrame(landmarks, timestamp);
    if (result.cursor && cursorVisible(result)) {
      const moved =
        Math.abs(result.cursor.x - lastCursor.x) > 0.0008 ||
        Math.abs(result.cursor.y - lastCursor.y) > 0.0008;
      if (moved) {
        lastCursor = { x: result.cursor.x, y: result.cursor.y };
        bridge.moveTo(result.cursor.x, result.cursor.y);
      }
    }
    for (const event of result.events) {
      events.push(event);
      if (event.type === "pointer_down") bridge.press();
      if (event.type === "pointer_up") bridge.release({ click: event.click });
      if (event.type === "tracking" && !event.present) bridge.cancel();
    }
    return result;
  };

  return { engine, bridge, feed, events, now: () => timestamp };
}

const buttons: HTMLButtonElement[] = [];

function setupDom(): void {
  document.body.innerHTML = '<div id="root"><button id="action" type="button">播放</button></div>';
  buttons.length = 0;
  const button = document.getElementById("action") as HTMLButtonElement;
  buttons.push(button);
  Object.defineProperty(document, "elementFromPoint", {
    configurable: true,
    writable: true,
    value: () => button,
  });
}

function teardownDom(): void {
  Reflect.deleteProperty(document, "elementFromPoint");
  document.body.innerHTML = "";
}

describe("手势端到端集成（engine → pointerBridge / actions）", () => {
  beforeEach(setupDom);
  afterEach(teardownDom);

  it("食指移动 + 捏合释放会在真实 DOM 上触发一次 click", () => {
    const harness = createHarness();
    const button = buttons[0];
    let clicks = 0;
    button.addEventListener("click", () => {
      clicks += 1;
    });

    // 先建立 pointer 模式并让指针桥获得 hover 目标。
    harness.feed(makeHand({ posture: "point", x: 0.5, y: 0.6 }));
    harness.feed(makeHand({ posture: "point", x: 0.52, y: 0.6 }));
    harness.feed(makeHand({ posture: "point", x: 0.54, y: 0.6 }));
    expect(harness.bridge.isPressed).toBe(false);

    // 捏合按下。
    harness.feed(makeHand({ posture: "point", x: 0.54, y: 0.6, pinchRatio: 0.12 }));
    expect(harness.bridge.isPressed).toBe(true);

    // 松开（回到未捏合姿态且停留时间 < 420ms）→ click。
    harness.feed(makeHand({ posture: "point", x: 0.54, y: 0.6, pinchRatio: 1.2 }));

    expect(harness.bridge.isPressed).toBe(false);
    expect(clicks).toBe(1);
    expect(harness.events.some((event) => event.type === "pointer_down")).toBe(true);
    const pointerUp = harness.events.find((event) => event.type === "pointer_up");
    expect(pointerUp).toMatchObject({ click: true });
  });

  it("张掌在屏幕上向左挥动 → swipe_left → 默认绑定 next_track", () => {
    const harness = createHarness();
    // mirror 下 raw x 递增 = 屏幕 x 递减 = 向左滑。
    for (let step = 0; step < 8; step += 1) {
      harness.feed(makeHand({ posture: "open_palm", x: 0.2 + step * 0.045, y: 0.55 }));
    }

    const commands = harness.events.filter((event) => event.type === "command");
    expect(commands).toHaveLength(1);
    const command = commands[0];
    if (command.type !== "command") throw new Error("unexpected event");
    expect(command.command).toBe("swipe_left");
    expect(resolveGestureActionForCommand(command.command, DEFAULT_GESTURE_BINDINGS)).toBe(
      "next_track"
    );
  });

  it("张掌向右挥动 → swipe_right → prev_track", () => {
    const harness = createHarness();
    for (let step = 0; step < 8; step += 1) {
      harness.feed(makeHand({ posture: "open_palm", x: 0.8 - step * 0.045, y: 0.55 }));
    }

    const commands = harness.events.filter((event) => event.type === "command");
    expect(commands).toHaveLength(1);
    const command = commands[0];
    if (command.type !== "command") throw new Error("unexpected event");
    expect(command.command).toBe("swipe_right");
    expect(resolveGestureActionForCommand(command.command, DEFAULT_GESTURE_BINDINGS)).toBe(
      "prev_track"
    );
  });

  it("握拳保持会先报进度、再且只发一次 fist_hold，默认绑定 toggle_play", () => {
    const harness = createHarness();
    let dwellSawProgress = false;
    for (let step = 0; step < 55; step += 1) {
      const result = harness.feed(makeHand({ posture: "fist", x: 0.5, y: 0.55 }));
      if (result.events.some((event) => event.type === "dwell" && event.progress > 0.2)) {
        dwellSawProgress = true;
      }
    }

    const commands = harness.events.filter((event) => event.type === "command");
    expect(dwellSawProgress).toBe(true);
    expect(commands).toHaveLength(1);
    const command = commands[0];
    if (command.type !== "command") throw new Error("unexpected event");
    expect(command.command).toBe("fist_hold");
    expect(resolveGestureActionForCommand(command.command, DEFAULT_GESTURE_BINDINGS)).toBe(
      "toggle_play"
    );
  });

  it("按住捏合时丢手会 cancel 而不是 click", () => {
    const harness = createHarness({ handLostGraceMs: 60 });
    let clicks = 0;
    buttons[0].addEventListener("click", () => {
      clicks += 1;
    });

    harness.feed(makeHand({ posture: "point", x: 0.5, y: 0.6 }));
    harness.feed(makeHand({ posture: "point", x: 0.5, y: 0.6, pinchRatio: 0.12 }));
    expect(harness.bridge.isPressed).toBe(true);

    for (let step = 0; step < 8; step += 1) harness.feed(null);

    expect(harness.bridge.isPressed).toBe(false);
    expect(clicks).toBe(0);
  });
});
