import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { AppleUnifiedNavIsland } from "./AppleUnifiedNavIsland";

const mocks = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
}));

vi.mock("framer-motion", () => ({
  /* eslint-disable @typescript-eslint/no-explicit-any */
  motion: new Proxy(
    {},
    {
      get: (_, prop: string) => {
        return ({ children, _animate, _transition, ...props }: any) => {
          return React.createElement(prop, props, children);
        };
      },
    }
  ),
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

describe("AppleUnifiedNavIsland search avoidance", () => {
  it("renders with data-search-avoidance='idle' when search panel is closed", () => {
    const html = renderToStaticMarkup(<AppleUnifiedNavIsland isSearchOpen={false} />);
    expect(html).toContain("音源与舞台");
    expect(html).toContain('data-search-avoidance="idle"');
  });

  it("renders with data-search-avoidance='shifted' when search panel is opened", () => {
    const html = renderToStaticMarkup(<AppleUnifiedNavIsland isSearchOpen={true} />);
    expect(html).toContain("音源与舞台");
    expect(html).toContain('data-search-avoidance="shifted"');
  });

  it("renders with data-search-avoidance='toast-avoidance' when toast is active and search is closed", () => {
    const html = renderToStaticMarkup(
      <AppleUnifiedNavIsland isSearchOpen={false} hasActiveToast={true} />
    );
    expect(html).toContain("音源与舞台");
    expect(html).toContain('data-search-avoidance="toast-avoidance"');
  });
});

describe("AppleUnifiedNavIsland library navigation", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    mocks.push.mockClear();
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockImplementation((media: string) => ({
        matches: false,
        media,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }))
    );
  });

  afterEach(async () => {
    await act(async () => root?.unmount());
    container?.remove();
    vi.unstubAllGlobals();
  });

  it("opens the library manager with client navigation", async () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => root.render(<AppleUnifiedNavIsland />));

    const libraryHub = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("曲库与发现")
    );
    expect(libraryHub).toBeDefined();

    await act(async () =>
      libraryHub?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }))
    );

    const managerEntry = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("音乐库管理器")
    );
    expect(managerEntry).toBeDefined();
    const hrefBeforeClick = window.location.href;

    await act(async () =>
      managerEntry?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }))
    );

    expect(mocks.push).toHaveBeenCalledWith("/data-manager");
    expect(window.location.href).toBe(hrefBeforeClick);
  });
});
