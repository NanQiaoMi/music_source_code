import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("framer-motion", () => ({
  motion: new Proxy(
    {},
    {
      get: (_, prop: string) => {
        return ({ children, ...props }: any) => React.createElement(prop, props, children);
      },
    }
  ),
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

describe("VisualSettingsPanel", () => {
  it("renders performance preset controls and their current budget", async () => {
    const { usePerformanceV8Store } = await import("@/store/performanceV8Store");
    const { VisualSettingsPanel } = await import("./VisualSettings");

    usePerformanceV8Store.getState().setPerformancePreset("balanced");

    const html = renderToStaticMarkup(
      <VisualSettingsPanel isOpen={true} onClose={() => undefined} />
    );

    expect(html).toContain("渲染引擎性能档位");
    expect(html).toContain("电影画质");
    expect(html).toContain("均衡体验");
    expect(html).toContain("省电模式");
    expect(html).toContain("目标渲染帧率");
    expect(html).toContain("粒子计算预算");
  });
});
