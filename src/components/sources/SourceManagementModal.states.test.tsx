import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { useSourceConfigStore } from "@/store/sourceConfigStore";

const motionPreference = vi.hoisted(() => ({ reduce: false }));

vi.mock("framer-motion", async () => {
  const React = await import("react");
  type MotionProps = {
    children?: React.ReactNode;
    className?: string;
    style?: React.CSSProperties;
    title?: string;
    disabled?: boolean;
    onClick?: React.MouseEventHandler<HTMLElement>;
    whileHover?: unknown;
    whileTap?: unknown;
    initial?: unknown;
    animate?: unknown;
    exit?: unknown;
    transition?: unknown;
    layout?: unknown;
    layoutId?: unknown;
  };

  const MotionButton = ({
    whileHover: _whileHover,
    whileTap: _whileTap,
    initial: _initial,
    animate: _animate,
    exit: _exit,
    transition: _transition,
    layout: _layout,
    layoutId: _layoutId,
    ...props
  }: MotionProps) => React.createElement("button", props);

  const MotionDiv = ({
    whileHover: _whileHover,
    whileTap: _whileTap,
    initial,
    animate,
    exit,
    transition,
    layout,
    layoutId,
    ...props
  }: MotionProps) =>
    React.createElement("div", {
      ...props,
      "data-motion-initial": JSON.stringify(initial),
      "data-motion-animate": JSON.stringify(animate),
      "data-motion-exit": JSON.stringify(exit),
      "data-motion-transition": JSON.stringify(transition),
      "data-motion-layout": String(layout),
      "data-motion-layout-id": String(layoutId),
    });

  return {
    useReducedMotion: () => motionPreference.reduce,
    AnimatePresence: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    motion: {
      button: MotionButton,
      div: MotionDiv,
    },
  };
});

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  localStorage.clear();
  motionPreference.reduce = false;
  useSourceConfigStore.setState({
    isManagementModalOpen: true,
    activeManagementTab: "matrix",
  });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

async function renderModal() {
  const { SourceManagementModal } = await import("./SourceManagementModal");
  await act(async () => root.render(<SourceManagementModal />));
  return container.innerHTML;
}

describe("SourceManagementModal 三态接线", () => {
  it("同步失败时当前 Tab 显示错误态与重试入口", async () => {
    vi.spyOn(useSourceConfigStore.getState(), "syncBuiltinDesktopSources").mockRejectedValue(
      new Error("上游配置拉取失败")
    );
    const html = await renderModal();
    expect(html).toContain("上游配置拉取失败");
    expect(html).toContain("重试");
  });

  it("默认（同步成功）不显示错误态", async () => {
    vi.spyOn(useSourceConfigStore.getState(), "syncBuiltinDesktopSources").mockResolvedValue(
      undefined
    );
    const html = await renderModal();
    expect(html).not.toContain("重试");
  });
});

describe("SourceManagementModal 外观与可访问性", () => {
  it("使用可滚动的窄屏玻璃面板并提供可见键盘焦点和可命名关闭按钮", async () => {
    const html = await renderModal();

    expect(html).toContain("p-2.5 sm:p-4 lg:p-6");
    expect(html).toContain("max-h-[90dvh]");
    expect(html).toContain("min-h-0 overflow-y-auto");
    expect(html).toContain('aria-label="关闭音源管理"');
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain("from-cyan-500 to-blue-500");
    expect(html).toContain("focus-visible:ring-2");
  });

  it("尊重系统减少动态效果偏好并停用弹窗位移与缩放", async () => {
    motionPreference.reduce = true;
    vi.spyOn(useSourceConfigStore.getState(), "syncBuiltinDesktopSources").mockResolvedValue(
      undefined
    );
    await renderModal();

    const motionNodes = Array.from(
      container.querySelectorAll<HTMLElement>("[data-motion-initial]")
    );
    expect(motionNodes).toHaveLength(2);
    expect(motionNodes.every((node) => node.dataset.motionInitial === "false")).toBe(true);

    const modalMotion = motionNodes.find((node) => node.className.includes("max-w-4xl"));
    expect(modalMotion).toBeDefined();
    expect(JSON.parse(modalMotion?.dataset.motionAnimate || "{}")).toEqual({
      scale: 1,
      opacity: 1,
      y: 0,
    });
    expect(JSON.parse(modalMotion?.dataset.motionTransition || "{}")).toEqual({ duration: 0 });
    expect(container.querySelector(".source-management-motion-scope")).not.toBeNull();
    expect(container.querySelector('[data-motion-layout="true"]')).toBeNull();
  });

  it("减少动态效果时禁用自定义脚本开关的布局动画", async () => {
    motionPreference.reduce = true;
    vi.spyOn(useSourceConfigStore.getState(), "syncBuiltinDesktopSources").mockResolvedValue(
      undefined
    );
    useSourceConfigStore.setState({
      activeManagementTab: "lx_scripts",
      lxScripts: [
        {
          id: "motion-test",
          name: "Motion test",
          author: "test",
          version: "1",
          description: "",
          enabled: true,
          lastUpdated: 0,
          supportedActions: ["search"],
        },
      ],
    });

    await renderModal();

    expect(container.querySelector('[data-motion-layout="true"]')).toBeNull();
  });
});
