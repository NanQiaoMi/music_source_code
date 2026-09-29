import { describe, it, expect, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { useSourceConfigStore } from "@/store/sourceConfigStore";
import type { MusicSourceId, SingleSourceConfig } from "@/types/sourceConfig";

/** 最小可用的音源条目：用于「非空 sourceList」用例，验证默认渲染仍是完整矩阵 */
const makeSource = (id: MusicSourceId, name: string): SingleSourceConfig => ({
  id,
  name,
  badgeName: name,
  badgeColor: "bg-white/10 text-white/70 border-white/20",
  dotColor: "bg-white/30",
  enabled: true,
  priority: 1,
  qualityPreference: "auto",
  customApiBase: "",
  customHeaders: {},
  credentials: {},
  health: { status: "untested", latencyMs: 0, lastChecked: 0 },
  description: "",
});

describe("SourceMatrixTab 状态", () => {
  beforeEach(() => {
    localStorage.clear();
    useSourceConfigStore.setState({ sources: {} as never });
  });

  it("无任何音源时渲染空态与引导动作", async () => {
    const { SourceMatrixTab } = await import("./SourceMatrixTab");
    const html = renderToStaticMarkup(
      <SourceMatrixTab sourceList={[]} isDiagnosing={false} onRunDiagnose={() => undefined} />
    );
    expect(html).toContain("还没有可用音源");
    expect(html).toContain("恢复默认");
  });

  it("加载中渲染骨架而非空白", async () => {
    const { SourceMatrixTab } = await import("./SourceMatrixTab");
    const html = renderToStaticMarkup(
      <SourceMatrixTab
        sourceList={[]}
        isDiagnosing={false}
        onRunDiagnose={() => undefined}
        loading
      />
    );
    expect(html).toContain("data-skeleton");
  });

  it("加载失败渲染错误态与重试", async () => {
    const { SourceMatrixTab } = await import("./SourceMatrixTab");
    const html = renderToStaticMarkup(
      <SourceMatrixTab
        sourceList={[]}
        isDiagnosing={false}
        onRunDiagnose={() => undefined}
        error="上游配置拉取失败"
        onRetry={() => undefined}
      />
    );
    expect(html).toContain("上游配置拉取失败");
    expect(html).toContain("重试");
  });

  it("错误以横幅呈现，且不遮挡已有内容", async () => {
    const { SourceMatrixTab } = await import("./SourceMatrixTab");
    const html = renderToStaticMarkup(
      <SourceMatrixTab
        sourceList={[makeSource("netease", "网易云音乐")]}
        isDiagnosing={false}
        onRunDiagnose={() => undefined}
        error="上游配置拉取失败"
        onRetry={() => undefined}
      />
    );
    expect(html).toContain("上游配置拉取失败");
    expect(html).toContain("重试");
    // 关键：内容仍在，没有被错误卡片替换掉
    expect(html).toContain("官方音源");
  });

  it("默认（无三态 props）渲染不变", async () => {
    const { SourceMatrixTab } = await import("./SourceMatrixTab");
    const html = renderToStaticMarkup(
      <SourceMatrixTab
        sourceList={[makeSource("netease", "网易云音乐")]}
        isDiagnosing={false}
        onRunDiagnose={() => undefined}
      />
    );
    expect(html).not.toContain("data-skeleton");
    expect(html).not.toContain("上游配置拉取失败");
    expect(html).toContain("网易云音乐");
    expect(html).toContain("核心播放链路模式");
  });
});
