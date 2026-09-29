import { describe, it, expect, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { useSourceConfigStore } from "@/store/sourceConfigStore";
import type { MusicSourceId, SingleSourceConfig } from "@/types/sourceConfig";

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

const MINIMAL_PROPS = {
  sourceList: [] as SingleSourceConfig[],
  isDiagnosing: false,
  diagnoseMessage: null as string | null,
  onRunDiagnose: () => undefined,
};

describe("DiagnosticsTab 状态", () => {
  beforeEach(() => {
    localStorage.clear();
    useSourceConfigStore.setState({ sources: {} as never });
  });

  it("还没有音源时渲染空态与引导动作", async () => {
    const { DiagnosticsTab } = await import("./DiagnosticsTab");
    const html = renderToStaticMarkup(<DiagnosticsTab {...MINIMAL_PROPS} />);
    expect(html).toContain("还没有");
    expect(html).toContain("恢复默认");
  });

  it("加载中渲染骨架而非空白", async () => {
    const { DiagnosticsTab } = await import("./DiagnosticsTab");
    const html = renderToStaticMarkup(<DiagnosticsTab {...MINIMAL_PROPS} loading />);
    expect(html).toContain("data-skeleton");
  });

  it("加载失败渲染错误态与重试", async () => {
    const { DiagnosticsTab } = await import("./DiagnosticsTab");
    const html = renderToStaticMarkup(
      <DiagnosticsTab {...MINIMAL_PROPS} error="诊断服务不可用" onRetry={() => undefined} />
    );
    expect(html).toContain("诊断服务不可用");
    expect(html).toContain("重试");
  });

  it("默认（无三态 props）渲染不变，Task 7 的进度条逻辑不受影响", async () => {
    const { DiagnosticsTab } = await import("./DiagnosticsTab");
    const html = renderToStaticMarkup(
      <DiagnosticsTab
        {...MINIMAL_PROPS}
        sourceList={[makeSource("netease", "网易云音乐")]}
        isDiagnosing
        progress={0.42}
      />
    );
    expect(html).not.toContain("data-skeleton");
    expect(html).toContain("多音源全链路健康体检仪");
    expect(html).toContain('aria-valuenow="42"');
    expect(html).toContain("网易云音乐");
  });
});
