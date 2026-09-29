import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { useMediaQuery } from "./useMediaQuery";

function stubViewport(width: number) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((query: string) => {
      const max = /max-width:\s*(\d+)/.exec(query);
      const matches = max ? width <= Number(max[1]) : false;
      return { matches, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() };
    })
  );
}

function Probe({ query }: { query: string }) {
  const matches = useMediaQuery(query);
  return <span data-matches={String(matches)} />;
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

describe("useMediaQuery", () => {
  it("is true when the viewport satisfies a max-width query", async () => {
    stubViewport(1024);
    await act(async () => root.render(<Probe query="(max-width: 1199px)" />));
    expect(container.querySelector("[data-matches]")?.getAttribute("data-matches")).toBe("true");
  });

  it("is false above the breakpoint", async () => {
    stubViewport(1280);
    await act(async () => root.render(<Probe query="(max-width: 1199px)" />));
    expect(container.querySelector("[data-matches]")?.getAttribute("data-matches")).toBe("false");
  });
});
