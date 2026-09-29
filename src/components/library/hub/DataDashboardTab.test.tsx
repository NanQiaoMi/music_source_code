import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

describe("DataDashboardTab 主角指标", () => {
  it("把存储配额做成首屏主角（含单位与配额上限）", async () => {
    const { DataDashboardTab } = await import("./DataDashboardTab");
    const html = renderToStaticMarkup(<DataDashboardTab onNavigateTab={() => {}} />);
    expect(html).toContain("已用存储");
    expect(html).toMatch(/\d+(\.\d+)?\s*(KB|MB|GB|B)/);
    expect(html).toContain("配额");
  });

  it("四类主角指标各自成组，不再平铺同级", async () => {
    const { DataDashboardTab } = await import("./DataDashboardTab");
    const html = renderToStaticMarkup(<DataDashboardTab onNavigateTab={() => {}} />);
    for (const t of ["存储与配额", "音质与编码", "云端账号", "曲库健康"]) {
      expect(html).toContain(t);
    }
  });

  it("分组标题使用统一的组头样式", async () => {
    const { DataDashboardTab } = await import("./DataDashboardTab");
    const html = renderToStaticMarkup(<DataDashboardTab onNavigateTab={() => {}} />);
    expect(html).toContain("tracking-[0.14em]");
  });
});
