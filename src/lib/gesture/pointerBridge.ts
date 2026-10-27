/**
 * 手势指针桥：把手势识别的 0-1 归一化坐标翻译成真实浏览器事件。
 *
 * 为什么需要它：
 * - 现有 UI 大量使用 React 的 onPointerDown 与 onMouseDown / onClick，只派发其中一种会让另一类组件失效，
 *   因此这里始终成对派发 PointerEvent + 兼容 MouseEvent；
 * - 手动派发的 click 不会走浏览器默认行为（target 推导、焦点），这里显式补齐 LCA（最近公共祖先）与 focus；
 * - HUD / 设置面板等用户可交互浮层通过 [data-gesture-ignore] 排除，避免手势"点穿"自己。
 *
 * 事件约定：派发的所有事件均 bubbles + cancelable（便于 React 合成事件/全局监听捕获），
 * 鼠标事件带 button / buttons / detail，指针事件带 pointerId=1 / pointerType="mouse" / isPrimary=true。
 */

export interface GesturePointerBridgeOptions {
  doc?: Document;
  win?: Window;
  /** 两次 click 判定为双击的时间窗，默认 320ms（与 DEFAULT_GESTURE_TUNING.doubleClickWindowMs 一致）。 */
  doubleClickWindowMs?: number;
}

const POINTER_ID = 1;
const POINTER_TYPE = "mouse";
const DEFAULT_DOUBLE_CLICK_WINDOW_MS = 320;
const IGNORE_SELECTOR = "[data-gesture-ignore]";
const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface Point {
  x: number;
  y: number;
}

/** Window + 全局构造器：lib.dom 的 Window 接口本身不声明 MouseEvent/PointerEvent 构造器。 */
type DomWindow = Window & typeof globalThis;

interface EventOverrides {
  button?: number;
  buttons?: number;
  detail?: number;
  pressure?: number;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function isIgnoredElement(element: Element | null): boolean {
  if (!element) return false;
  return element.closest(IGNORE_SELECTOR) !== null;
}

function findCommonAncestor(from: Element, to: Element): Element | null {
  const ancestors = new Set<Element>();
  for (let node: Element | null = from; node; node = node.parentElement) {
    ancestors.add(node);
  }
  for (let node: Element | null = to; node; node = node.parentElement) {
    if (ancestors.has(node)) return node;
  }
  return null;
}

function findFocusableElement(element: Element | null): HTMLElement | null {
  if (!element) return null;
  const candidate = element.closest(FOCUSABLE_SELECTOR);
  if (!candidate) return null;
  return typeof (candidate as HTMLElement).focus === "function" ? (candidate as HTMLElement) : null;
}

function definePointerField(
  event: MouseEvent,
  key: "pointerId" | "pointerType" | "isPrimary",
  value: number | string | boolean
): void {
  Object.defineProperty(event, key, {
    configurable: true,
    enumerable: true,
    value,
    writable: false,
  });
}

/**
 * 手势指针桥。
 *
 * 使用方式（由手势控制器驱动）：
 * 1. pointer_move 事件 -> moveTo(x, y)；
 * 2. pointer_down 事件 -> press()；
 * 3. pointer_up 事件 -> release({ click })（click 由识别层判定，拖拽结束传 false）；
 * 4. 手丢失 / 切换模式 -> cancel()；组件卸载 -> dispose()。
 */
export class GesturePointerBridge {
  private readonly doc: Document;
  private readonly win: DomWindow;
  private readonly doubleClickWindowMs: number;

  private hoverTarget: Element | null = null;
  private pressedTarget: Element | null = null;
  private point: Point = { x: 0, y: 0 };
  private lastClickAt = 0;
  private disposed = false;

  constructor(options: GesturePointerBridgeOptions = {}) {
    const doc =
      options.doc ?? options.win?.document ?? (typeof document !== "undefined" ? document : null);
    if (!doc) {
      throw new Error("GesturePointerBridge 初始化失败：缺少可用的 document");
    }
    const win = (options.win ?? doc.defaultView) as DomWindow | null;
    if (!win) {
      throw new Error("GesturePointerBridge 初始化失败：缺少可用的 window");
    }

    this.doc = doc;
    this.win = win;
    this.doubleClickWindowMs = Math.max(
      0,
      options.doubleClickWindowMs ?? DEFAULT_DOUBLE_CLICK_WINDOW_MS
    );
  }

  /** 当前悬停目标；指针位于 [data-gesture-ignore] 区域时为 null。 */
  get target(): Element | null {
    return this.hoverTarget;
  }

  /** 是否处于按下（拖拽）会话中。 */
  get isPressed(): boolean {
    return this.pressedTarget !== null;
  }

  /**
   * 把 0-1 归一化坐标映射到视口 client 坐标并更新悬停状态。
   * 目标变化时派发 pointerover/enter + mouseover/enter，离开时派发 out/leave；每帧派发 move。
   */
  moveTo(normalizedX: number, normalizedY: number): void {
    if (this.disposed) return;
    if (!Number.isFinite(normalizedX) || !Number.isFinite(normalizedY)) return;

    this.point = this.toClientPoint(normalizedX, normalizedY);
    const rawTarget = this.elementFromPoint();
    const nextTarget = isIgnoredElement(rawTarget) ? null : rawTarget;

    if (nextTarget !== this.hoverTarget) {
      this.leaveHoverTarget();
      this.hoverTarget = nextTarget;
      if (nextTarget) this.enterHoverTarget(nextTarget);
    }

    if (this.hoverTarget) {
      this.dispatchPointerPair("pointermove", "mousemove", this.hoverTarget, {
        button: -1,
        buttons: this.isPressed ? 1 : 0,
        pressure: this.isPressed ? 0.5 : 0,
      });
    }
  }

  /** 在当前悬停目标上按下：派发 pointerdown + mousedown，并聚焦可聚焦祖先元素。 */
  press(): void {
    if (this.disposed || this.pressedTarget) return;
    const target = this.hoverTarget ?? this.resolveHoverTargetAtPoint();
    if (!target) return;

    this.pressedTarget = target;
    this.dispatchPointerPair("pointerdown", "mousedown", target, {
      button: 0,
      buttons: 1,
      pressure: 0.5,
    });
    this.focusElement(target);
  }

  /**
   * 结束按下会话：派发 pointerup + mouseup。
   * click 是否派发由调用方决定（识别层根据位移/时长给出 click 标记）；默认 true 便于直接点按。
   * click 的 target 取 down/up 最近公共祖先；双击窗口内第二次 click 追加 dblclick。
   */
  release(options: { click?: boolean } = {}): void {
    if (this.disposed) return;
    const downTarget = this.pressedTarget;
    if (!downTarget) return;

    const rawUpTarget = this.elementFromPoint();
    const releasedOverIgnored = isIgnoredElement(rawUpTarget);
    const upTarget = rawUpTarget && !releasedOverIgnored ? rawUpTarget : downTarget;
    this.pressedTarget = null;

    this.dispatchPointerPair("pointerup", "mouseup", upTarget, { button: 0, buttons: 0 });

    const shouldClick = options.click ?? true;
    if (!shouldClick || releasedOverIgnored) {
      this.lastClickAt = 0;
      return;
    }

    this.dispatchClick(downTarget, upTarget);
  }

  /**
   * 取消当前按下会话（例如手丢失 / 切换模式）：
   * 派发 pointercancel + pointerup，并补一个 mouseup，避免只监听鼠标事件的拖拽组件卡在拖拽态；不触发 click。
   */
  cancel(): void {
    if (this.disposed) return;
    const downTarget = this.pressedTarget;
    this.pressedTarget = null;
    this.lastClickAt = 0;
    if (!downTarget) return;

    downTarget.dispatchEvent(this.createPointerEvent("pointercancel", { button: 0, buttons: 0 }));
    this.dispatchPointerPair("pointerup", "mouseup", downTarget, { button: 0, buttons: 0 });
  }

  /** 释放桥接器：取消按下会话、离开悬停目标，之后所有调用为空操作。 */
  dispose(): void {
    if (this.disposed) return;
    this.cancel();
    this.leaveHoverTarget();
    this.hoverTarget = null;
    this.lastClickAt = 0;
    this.disposed = true;
  }

  // ---- 内部：坐标与命中 ----

  private toClientPoint(normalizedX: number, normalizedY: number): Point {
    const width = Math.max(1, this.win.innerWidth || this.doc.documentElement?.clientWidth || 0);
    const height = Math.max(1, this.win.innerHeight || this.doc.documentElement?.clientHeight || 0);
    return {
      x: Math.min(width - 1, Math.max(0, Math.round(clamp01(normalizedX) * width))),
      y: Math.min(height - 1, Math.max(0, Math.round(clamp01(normalizedY) * height))),
    };
  }

  /** jsdom 没有布局实现 elementFromPoint：做能力检测，缺失时返回 null（测试可自行 stub）。 */
  private elementFromPoint(): Element | null {
    if (typeof this.doc.elementFromPoint !== "function") return null;
    try {
      return this.doc.elementFromPoint(this.point.x, this.point.y) ?? null;
    } catch {
      return null;
    }
  }

  private resolveHoverTargetAtPoint(): Element | null {
    const target = this.elementFromPoint();
    return isIgnoredElement(target) ? null : target;
  }

  // ---- 内部：hover 生命周期 ----

  private leaveHoverTarget(): void {
    const target = this.hoverTarget;
    if (!target) return;
    this.dispatchPointerPair("pointerout", "mouseout", target, { button: -1, buttons: 0 });
    this.dispatchPointerPair("pointerleave", "mouseleave", target, { button: -1, buttons: 0 });
  }

  private enterHoverTarget(target: Element): void {
    this.dispatchPointerPair("pointerover", "mouseover", target, { button: -1, buttons: 0 });
    this.dispatchPointerPair("pointerenter", "mouseenter", target, { button: -1, buttons: 0 });
  }

  // ---- 内部：焦点与 click ----

  /** 聚焦目标最近的可聚焦祖先；返回实际聚焦元素（没有则返回 null）。 */
  private focusElement(target: Element | null): HTMLElement | null {
    const focusable = findFocusableElement(target);
    if (!focusable) return null;
    try {
      focusable.focus({ preventScroll: true });
    } catch {
      // 个别只读/自定义元素 focus 会抛错，焦点失败不应中断事件派发。
    }
    return focusable;
  }

  private dispatchClick(downTarget: Element, upTarget: Element): void {
    const clickTarget = findCommonAncestor(downTarget, upTarget) ?? upTarget;
    if (isIgnoredElement(clickTarget)) return;

    if (!this.focusElement(clickTarget)) {
      this.focusElement(upTarget);
    }

    const now = Date.now();
    const isDoubleClick =
      this.lastClickAt > 0 && now - this.lastClickAt <= this.doubleClickWindowMs;

    clickTarget.dispatchEvent(
      this.createMouseEvent("click", {
        button: 0,
        buttons: 0,
        detail: isDoubleClick ? 2 : 1,
      })
    );

    if (isDoubleClick) {
      clickTarget.dispatchEvent(
        this.createMouseEvent("dblclick", { button: 0, buttons: 0, detail: 2 })
      );
      this.lastClickAt = 0;
      return;
    }

    this.lastClickAt = now;
  }

  // ---- 内部：事件构造与派发 ----

  private createMouseEvent(type: string, overrides: EventOverrides = {}): MouseEvent {
    const MouseEventCtor = this.win.MouseEvent;
    return new MouseEventCtor(type, {
      bubbles: true,
      cancelable: true,
      clientX: this.point.x,
      clientY: this.point.y,
      button: overrides.button ?? 0,
      buttons: overrides.buttons ?? 0,
      detail: overrides.detail ?? 0,
    });
  }

  private createPointerEvent(type: string, overrides: EventOverrides = {}): MouseEvent {
    const PointerEventCtor = this.win.PointerEvent;
    if (typeof PointerEventCtor === "function") {
      return new PointerEventCtor(type, {
        bubbles: true,
        cancelable: true,
        clientX: this.point.x,
        clientY: this.point.y,
        button: overrides.button ?? 0,
        buttons: overrides.buttons ?? 0,
        detail: overrides.detail ?? 0,
        pointerId: POINTER_ID,
        pointerType: POINTER_TYPE,
        isPrimary: true,
        width: 1,
        height: 1,
        pressure: overrides.pressure ?? 0,
      });
    }

    // jsdom / 老浏览器没有 PointerEvent：用 MouseEvent 兜底并补齐 pointer 字段。
    const fallback = this.createMouseEvent(type, overrides);
    definePointerField(fallback, "pointerId", POINTER_ID);
    definePointerField(fallback, "pointerType", POINTER_TYPE);
    definePointerField(fallback, "isPrimary", true);
    return fallback;
  }

  private dispatchPointerPair(
    pointerType: string,
    mouseType: string,
    target: Element,
    overrides: EventOverrides = {}
  ): void {
    target.dispatchEvent(this.createPointerEvent(pointerType, overrides));
    target.dispatchEvent(this.createMouseEvent(mouseType, overrides));
  }
}
