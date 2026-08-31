import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AppleUnifiedNavIsland } from "./AppleUnifiedNavIsland";
import { useUIStore } from "@/store/uiStore";

vi.mock("framer-motion", () => ({
  /* eslint-disable @typescript-eslint/no-explicit-any */
  motion: new Proxy(
    {},
    {
      get: (_, prop: string) => {
        return ({ children, animate, transition, ...props }: any) => {
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
