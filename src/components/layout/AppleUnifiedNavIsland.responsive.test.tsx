import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";

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
  it("renders all five quick buttons at 1440", async () => {
    stubViewport(1440);
    const html = await renderIsland();
    expect(html).toContain('title="全局搜索 (⌘K / Ctrl+K)"');
    expect(html).toContain('title="偏好设置"');
    expect(html).not.toContain('title="更多快捷操作"');
  });

  it("collapses to search + overflow at 1024", async () => {
    stubViewport(1024);
    const html = await renderIsland();
    expect(html).toContain('title="全局搜索 (⌘K / Ctrl+K)"');
    expect(html).toContain('title="更多快捷操作"');
    expect(html).not.toContain('title="偏好设置"');
    expect(html).not.toContain('title="隔空手势控制"');
  });
});
