/* eslint-disable @typescript-eslint/no-explicit-any */
// 测试桩（React/Store mock、部分状态对象）用宽松类型是刻意的，收紧只会引入与被测逻辑无关的噪音
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
    const { visualRuntime } = await import("@/runtime/visualRuntime");
    const { VisualSettingsPanel } = await import("./VisualSettings");

    // S6-8c：性能档唯一 owner 是 runtime；面板读取其只读投影。
    visualRuntime.setQuality("medium");

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
