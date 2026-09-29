import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SourceHealthSummary, HealthRow } from "./SourceHealthSummary";

const base: HealthRow[] = [
  { id: "netease", name: "网易云音乐", status: "ok", latencyMs: 88 },
  { id: "qq", name: "QQ 音乐", status: "warn", latencyMs: null },
  { id: "kuwo", name: "酷我音乐", status: "error", latencyMs: null },
];

describe("SourceHealthSummary", () => {
  it("aggregates counts into one line", () => {
    const html = renderToStaticMarkup(
      <SourceHealthSummary sources={base} onRunDiagnose={() => undefined} />
    );
    expect(html).toContain("1 在线");
    expect(html).toContain("1 需处理");
    expect(html).toContain("1 异常");
  });

  it("renders per-source latency inline", () => {
    const html = renderToStaticMarkup(
      <SourceHealthSummary sources={base} onRunDiagnose={() => undefined} />
    );
    expect(html).toContain("88ms");
  });

  it("shows a running state while diagnosing", () => {
    const html = renderToStaticMarkup(
      <SourceHealthSummary sources={base} isDiagnosing onRunDiagnose={() => undefined} />
    );
    expect(html).toContain("测速中");
  });

  it("shows an idle hint when nothing has been probed", () => {
    const html = renderToStaticMarkup(
      <SourceHealthSummary
        sources={[{ id: "netease", name: "网易云音乐", status: "idle", latencyMs: null }]}
        onRunDiagnose={() => undefined}
      />
    );
    expect(html).toContain("尚未测速");
  });
});
