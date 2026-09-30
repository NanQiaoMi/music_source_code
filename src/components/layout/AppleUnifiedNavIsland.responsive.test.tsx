import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("framer-motion", async () => {
  const React = await import("react");
  const keep = (Tag: string) =>
    function PlainFallback({ children, ...rest }: Record<string, unknown>) {
      return React.createElement(Tag, rest, children as React.ReactNode);
    };
  return {
    AnimatePresence: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    motion: { div: keep("div"), button: keep("button"), header: keep("header"), a: keep("a") },
  };
});

function stubViewport(width: number) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((q: string) => {
      const m = /max-width:\s*(\d+)/.exec(q);
      return {
        matches: m ? width <= Number(m[1]) : false,
        media: q,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      };
    })
  );
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

async function renderIsland() {
  const { AppleUnifiedNavIsland } = await import("./AppleUnifiedNavIsland");
  await act(async () => root.render(<AppleUnifiedNavIsland />));
  return container.innerHTML;
}

describe("AppleUnifiedNavIsland responsive quick buttons", () => {
  it("renders all five quick buttons at 1800", async () => {
    stubViewport(1800);
    const html = await renderIsland();
    expect(html).toContain('title="全局搜索 (⌘K / Ctrl+K)"');
    expect(html).toContain('title="偏好设置"');
    expect(html).not.toContain('title="更多快捷操作"');
  });

  // 断点值由「岛要在窗口居中」倒推（见 headerBreakpoints.ts），边界两侧都钉一下，
  // 免得以后有人凭感觉把数字调小又悄悄让顶栏失去居中能力。
  it("keeps quick buttons inline at 1680 (boundary)", async () => {
    stubViewport(1680);
    expect(await renderIsland()).not.toContain('title="更多快捷操作"');
  });

  it("collapses at 1679 (boundary)", async () => {
    stubViewport(1679);
    expect(await renderIsland()).toContain('title="更多快捷操作"');
  });

  it("collapses to search + overflow at 1024", async () => {
    stubViewport(1024);
    const html = await renderIsland();
    expect(html).toContain('title="全局搜索 (⌘K / Ctrl+K)"');
    expect(html).toContain('title="更多快捷操作"');
    expect(html).not.toContain('title="偏好设置"');
    expect(html).not.toContain('title="隔空手势控制"');
  });

  it("closes the overflow menu on Escape and on outside click", async () => {
    stubViewport(1024);
    await renderIsland();

    const more = Array.from(container.querySelectorAll("button")).find(
      (b) => b.getAttribute("title") === "更多快捷操作"
    );
    expect(more).toBeTruthy();

    // 展开：菜单项出现（窄屏下内联按钮已被收起，故可作为唯一判据）
    await act(async () => {
      more!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(container.innerHTML).toContain('title="偏好设置"');

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(container.innerHTML).not.toContain('title="偏好设置"');

    // 再展开，点岛外收起
    await act(async () => {
      more!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(container.innerHTML).toContain('title="偏好设置"');

    await act(async () => {
      document.body.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    });
    expect(container.innerHTML).not.toContain('title="偏好设置"');
  });
});
