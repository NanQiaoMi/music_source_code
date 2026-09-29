import { describe, it, expect, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { useSourceConfigStore } from "@/store/sourceConfigStore";

describe("BackupTab 状态", () => {
  beforeEach(() => {
    localStorage.clear();
    useSourceConfigStore.setState({ sources: {} as never });
  });

  it("空配置（没有任何音源）时渲染空态与引导动作", async () => {
    const { BackupTab } = await import("./BackupTab");
    const html = renderToStaticMarkup(<BackupTab />);
    expect(html).toContain("还没有");
    expect(html).toContain("恢复默认");
  });

  it("加载中渲染骨架而非空白", async () => {
    const { BackupTab } = await import("./BackupTab");
    const html = renderToStaticMarkup(<BackupTab loading />);
    expect(html).toContain("data-skeleton");
  });

  it("加载失败渲染错误态与重试", async () => {
    const { BackupTab } = await import("./BackupTab");
    const html = renderToStaticMarkup(
      <BackupTab error="预设方案拉取失败" onRetry={() => undefined} />
    );
    expect(html).toContain("预设方案拉取失败");
    expect(html).toContain("重试");
  });

  it("默认（无三态 props）渲染不变", async () => {
    const { BackupTab } = await import("./BackupTab");
    useSourceConfigStore.getState().resetToDefaults();
    const html = renderToStaticMarkup(<BackupTab />);
    expect(html).not.toContain("data-skeleton");
    expect(html).not.toContain("预设方案拉取失败");
    expect(html).toContain("开箱即用预设方案");
    expect(html).toContain("配置备份与导入导出");
  });
});
