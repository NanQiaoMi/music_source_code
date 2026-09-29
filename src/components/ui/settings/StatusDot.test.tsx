import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { StatusDot } from "./StatusDot";

describe("StatusDot", () => {
  it("renders the default label for each status", () => {
    expect(renderToStaticMarkup(<StatusDot status="ok" />)).toContain("正常");
    expect(renderToStaticMarkup(<StatusDot status="warn" />)).toContain("需处理");
    expect(renderToStaticMarkup(<StatusDot status="error" />)).toContain("异常");
    expect(renderToStaticMarkup(<StatusDot status="idle" />)).toContain("未测试");
  });

  it("prefers latency over the status label when provided", () => {
    const html = renderToStaticMarkup(<StatusDot status="ok" latencyMs={128} />);
    expect(html).toContain("128ms");
    expect(html).not.toContain("正常");
  });

  it("allows an explicit label to win", () => {
    expect(renderToStaticMarkup(<StatusDot status="warn" label="需登录" />)).toContain("需登录");
  });

  it("hides the label but keeps the dot when asked", () => {
    const html = renderToStaticMarkup(<StatusDot status="ok" showLabel={false} />);
    expect(html).not.toContain("正常");
    expect(html).toContain("rounded-full");
  });
});
