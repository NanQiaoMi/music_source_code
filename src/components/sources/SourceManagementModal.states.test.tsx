import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { useSourceConfigStore } from "@/store/sourceConfigStore";

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
    initial: _initial,
    animate: _animate,
    exit: _exit,
    transition: _transition,
    layout: _layout,
    layoutId: _layoutId,
    ...props
  }: MotionProps) => React.createElement("div", props);

  return {
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
});
