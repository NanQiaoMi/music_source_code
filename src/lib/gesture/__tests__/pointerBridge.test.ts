import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GesturePointerBridge } from "../pointerBridge";

interface PointerFields {
  pointerId?: number;
  pointerType?: string;
  isPrimary?: boolean;
}

type PointerEventLike = MouseEvent & PointerFields;

const EVENT_TYPES = [
  "pointerover",
  "pointerenter",
  "pointerout",
  "pointerleave",
  "pointermove",
  "mouseover",
  "mouseenter",
  "mouseout",
  "mouseleave",
  "mousemove",
  "pointerdown",
  "mousedown",
  "pointerup",
  "mouseup",
  "pointercancel",
  "click",
  "dblclick",
] as const;

let hitTarget: Element | null = null;
let recordedEvents: Event[] = [];
let recorder: ((event: Event) => void) | null = null;

function resetDom(): void {
  document.body.innerHTML = [
    '<div id="root">',
    '  <button id="button" type="button">播放</button>',
    '  <div id="card"><span id="text">歌词</span></div>',
    '  <div id="draggable"><span id="drag-handle">拖动</span></div>',
    '  <div id="ignored" data-gesture-ignore>',
    '    <button id="ignored-button" type="button">忽略</button>',
    "  </div>",
    '  <input id="search" type="text" />',
    "</div>",
  ].join("");
  hitTarget = null;
}

function installHitTesting(): void {
  Object.defineProperty(document, "elementFromPoint", {
    configurable: true,
    writable: true,
    value: () => hitTarget,
  });
}

function uninstallHitTesting(): void {
  Reflect.deleteProperty(document, "elementFromPoint");
}

function startRecording(): void {
  recordedEvents = [];
  recorder = (event: Event) => {
    recordedEvents.push(event);
  };
  for (const type of EVENT_TYPES) document.addEventListener(type, recorder);
}

function stopRecording(): void {
  if (!recorder) return;
  for (const type of EVENT_TYPES) document.removeEventListener(type, recorder);
  recorder = null;
}

function getElement(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (!element) throw new Error("测试 DOM 缺少 #" + id);
  return element;
}

function listEvents(type: string, target?: Element | null): Event[] {
  return recordedEvents.filter(
    (event) => event.type === type && (target === undefined || event.target === target)
  );
}

function getEvent(type: string, target?: Element | null): Event {
  const event = listEvents(type, target)[0];
  expect(event, "缺少事件 " + type).toBeDefined();
  return event as Event;
}

function clickOnce(bridge: GesturePointerBridge): void {
  bridge.press();
  bridge.release();
}

beforeEach(() => {
  resetDom();
  installHitTesting();
  startRecording();
});

afterEach(() => {
  stopRecording();
  uninstallHitTesting();
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

describe("moveTo 悬停事件", () => {
  it("首次移动派发 pointerover/enter + mouseover/enter/move，坐标映射到视口", () => {
    const bridge = new GesturePointerBridge({ doc: document, win: window });
    const button = getElement("button");
    hitTarget = button;

    bridge.moveTo(0.5, 0.5);

    expect(bridge.target).toBe(button);
    expect(listEvents("pointerover", button)).toHaveLength(1);
    expect(listEvents("pointerenter", button)).toHaveLength(1);
    expect(listEvents("mouseover", button)).toHaveLength(1);
    expect(listEvents("mouseenter", button)).toHaveLength(1);
    expect(listEvents("pointermove", button)).toHaveLength(1);
    expect(listEvents("mousemove", button)).toHaveLength(1);

    const move = getEvent("pointermove", button) as PointerEventLike;
    expect(move.clientX).toBe(512);
    expect(move.clientY).toBe(384);
    expect(move.bubbles).toBe(true);
    expect(move.cancelable).toBe(true);
    expect(move.pointerId).toBe(1);
    expect(move.pointerType).toBe("mouse");
    expect(move.isPrimary).toBe(true);
  });

  it("移动到新元素时旧目标收到 out/leave，新目标收到 over/enter/move", () => {
    const bridge = new GesturePointerBridge({ doc: document, win: window });
    const button = getElement("button");
    const card = getElement("card");

    hitTarget = button;
    bridge.moveTo(0.5, 0.5);
    recordedEvents = [];

    hitTarget = card;
    bridge.moveTo(0.6, 0.6);

    expect(bridge.target).toBe(card);
    expect(listEvents("pointerout", button)).toHaveLength(1);
    expect(listEvents("pointerleave", button)).toHaveLength(1);
    expect(listEvents("mouseout", button)).toHaveLength(1);
    expect(listEvents("mouseleave", button)).toHaveLength(1);
    expect(listEvents("pointerover", card)).toHaveLength(1);
    expect(listEvents("pointerenter", card)).toHaveLength(1);
    expect(listEvents("pointermove", card)).toHaveLength(1);
  });

  it("命中 [data-gesture-ignore] 及其子元素时跳过并清空悬停目标", () => {
    const bridge = new GesturePointerBridge({ doc: document, win: window });
    const button = getElement("button");
    const ignored = getElement("ignored");
    const ignoredButton = getElement("ignored-button");

    hitTarget = button;
    bridge.moveTo(0.5, 0.5);
    recordedEvents = [];

    hitTarget = ignored;
    bridge.moveTo(0.5, 0.5);
    expect(bridge.target).toBeNull();
    expect(listEvents("pointerout", button)).toHaveLength(1);
    expect(listEvents("pointerover", ignored)).toHaveLength(0);

    recordedEvents = [];
    hitTarget = ignoredButton;
    bridge.moveTo(0.52, 0.52);
    expect(bridge.target).toBeNull();
    expect(recordedEvents).toHaveLength(0);
  });

  it("非法坐标与越界坐标安全处理", () => {
    const bridge = new GesturePointerBridge({ doc: document, win: window });
    const button = getElement("button");
    hitTarget = button;

    bridge.moveTo(Number.NaN, 0.5);
    expect(recordedEvents).toHaveLength(0);

    bridge.moveTo(2, -1);
    const move = getEvent("pointermove", button) as PointerEventLike;
    expect(move.clientX).toBe(1023);
    expect(move.clientY).toBe(0);
  });
});

describe("press / release / click", () => {
  it("press 派发 pointerdown + mousedown 并聚焦，release 派发 up 与 click", () => {
    const bridge = new GesturePointerBridge({ doc: document, win: window });
    const button = getElement("button");
    hitTarget = button;
    bridge.moveTo(0.5, 0.5);
    recordedEvents = [];

    bridge.press();
    expect(bridge.isPressed).toBe(true);
    expect(getEvent("pointerdown", button).bubbles).toBe(true);
    expect((getEvent("pointerdown", button) as PointerEventLike).pointerId).toBe(1);
    expect((getEvent("pointerdown", button) as MouseEvent).button).toBe(0);
    expect((getEvent("pointerdown", button) as MouseEvent).buttons).toBe(1);
    expect((getEvent("mousedown", button) as MouseEvent).button).toBe(0);
    expect(document.activeElement).toBe(button);

    bridge.release();
    expect(bridge.isPressed).toBe(false);
    expect(listEvents("pointerup", button)).toHaveLength(1);
    expect(listEvents("mouseup", button)).toHaveLength(1);

    const click = getEvent("click", button) as MouseEvent;
    expect(click.detail).toBe(1);
    expect(click.button).toBe(0);
    expect(click.bubbles).toBe(true);
    expect(click.cancelable).toBe(true);
  });

  it("release({ click: false }) 不派发 click（拖拽结束）", () => {
    const bridge = new GesturePointerBridge({ doc: document, win: window });
    const draggable = getElement("draggable");
    const card = getElement("card");
    hitTarget = draggable;
    bridge.moveTo(0.4, 0.4);
    bridge.press();

    hitTarget = card;
    bridge.moveTo(0.7, 0.7);
    recordedEvents = [];

    bridge.release({ click: false });

    expect(bridge.isPressed).toBe(false);
    expect(listEvents("click")).toHaveLength(0);
    expect(listEvents("mouseup", card)).toHaveLength(1);
    expect(listEvents("pointerup", card)).toHaveLength(1);
  });

  it("click 目标取 down/up 最近公共祖先", () => {
    const bridge = new GesturePointerBridge({ doc: document, win: window });
    const root = getElement("root");
    const text = getElement("text");
    const button = getElement("button");

    hitTarget = text;
    bridge.moveTo(0.3, 0.3);
    bridge.press();

    hitTarget = button;
    bridge.moveTo(0.6, 0.6);
    recordedEvents = [];

    bridge.release();

    const click = getEvent("click") as MouseEvent;
    expect(click.target).toBe(root);
    expect(document.activeElement).toBe(button);
  });

  it("320ms 内第二次 click 追加 dblclick，超时不追加", () => {
    const bridge = new GesturePointerBridge({ doc: document, win: window });
    const button = getElement("button");
    hitTarget = button;
    bridge.moveTo(0.5, 0.5);
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(1_000);

    clickOnce(bridge);
    expect(listEvents("click")).toHaveLength(1);
    expect(listEvents("dblclick")).toHaveLength(0);

    nowSpy.mockReturnValue(1_200);
    clickOnce(bridge);
    expect(listEvents("click")).toHaveLength(2);
    expect(listEvents("dblclick")).toHaveLength(1);
    expect((listEvents("dblclick")[0] as MouseEvent).detail).toBe(2);

    recordedEvents = [];
    nowSpy.mockReturnValue(2_000);
    clickOnce(bridge);
    nowSpy.mockReturnValue(2_400);
    clickOnce(bridge);
    expect(listEvents("click")).toHaveLength(2);
    expect(listEvents("dblclick")).toHaveLength(0);
  });

  it("cancel 派发 pointercancel + pointerup/mouseup，不触发 click", () => {
    const bridge = new GesturePointerBridge({ doc: document, win: window });
    const button = getElement("button");
    hitTarget = button;
    bridge.moveTo(0.5, 0.5);
    bridge.press();
    recordedEvents = [];

    bridge.cancel();

    expect(bridge.isPressed).toBe(false);
    expect(listEvents("pointercancel", button)).toHaveLength(1);
    expect(listEvents("pointerup", button)).toHaveLength(1);
    expect(listEvents("mouseup", button)).toHaveLength(1);
    expect(listEvents("click")).toHaveLength(0);

    bridge.release();
    expect(listEvents("pointerup", button)).toHaveLength(1);
  });

  it("在忽略区域上 press/release 不派发任何鼠标会话事件", () => {
    const bridge = new GesturePointerBridge({ doc: document, win: window });
    hitTarget = getElement("ignored-button");
    bridge.moveTo(0.5, 0.5);
    recordedEvents = [];

    bridge.press();
    expect(bridge.isPressed).toBe(false);
    expect(listEvents("pointerdown")).toHaveLength(0);
    expect(listEvents("mousedown")).toHaveLength(0);

    bridge.release();
    expect(listEvents("click")).toHaveLength(0);
  });

  it("可聚焦输入框在 press 时获得焦点", () => {
    const bridge = new GesturePointerBridge({ doc: document, win: window });
    const search = getElement("search");
    hitTarget = search;
    bridge.moveTo(0.5, 0.5);

    bridge.press();

    expect(document.activeElement).toBe(search);
  });
});

describe("PointerEvent 兜底", () => {
  it("window.PointerEvent 缺失时用 MouseEvent 并补齐 pointer 字段", () => {
    const pointerEventDescriptor = Object.getOwnPropertyDescriptor(window, "PointerEvent");
    Reflect.deleteProperty(window, "PointerEvent");
    try {
      const bridge = new GesturePointerBridge({ doc: document, win: window });
      const button = getElement("button");
      hitTarget = button;
      bridge.moveTo(0.5, 0.5);
      bridge.press();
      bridge.release();

      const down = getEvent("pointerdown", button);
      expect(down).toBeInstanceOf(MouseEvent);
      const fallback = down as PointerEventLike;
      expect(fallback.pointerId).toBe(1);
      expect(fallback.pointerType).toBe("mouse");
      expect(fallback.isPrimary).toBe(true);
    } finally {
      if (pointerEventDescriptor) {
        Object.defineProperty(window, "PointerEvent", pointerEventDescriptor);
      }
    }
  });
});

describe("dispose", () => {
  it("释放时离开悬停目标，之后所有调用为空操作", () => {
    const bridge = new GesturePointerBridge({ doc: document, win: window });
    const button = getElement("button");
    hitTarget = button;
    bridge.moveTo(0.5, 0.5);
    recordedEvents = [];

    bridge.dispose();

    expect(bridge.target).toBeNull();
    expect(bridge.isPressed).toBe(false);
    expect(listEvents("pointerout", button)).toHaveLength(1);
    expect(listEvents("pointerleave", button)).toHaveLength(1);

    recordedEvents = [];
    hitTarget = getElement("card");
    bridge.moveTo(0.8, 0.8);
    bridge.press();
    bridge.release();
    expect(recordedEvents).toHaveLength(0);
  });

  it("按下状态中释放会补发 cancel 事件", () => {
    const bridge = new GesturePointerBridge({ doc: document, win: window });
    const button = getElement("button");
    hitTarget = button;
    bridge.moveTo(0.5, 0.5);
    bridge.press();

    bridge.dispose();

    expect(listEvents("pointercancel", button)).toHaveLength(1);
    expect(listEvents("pointerup", button)).toHaveLength(1);
  });
});
