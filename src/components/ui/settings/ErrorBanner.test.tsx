import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ErrorBanner } from "./ErrorBanner";

describe("ErrorBanner", () => {
  it("renders the message", () => {
    const html = renderToStaticMarkup(<ErrorBanner message="音源配置拉取失败" />);
    expect(html).toContain("音源配置拉取失败");
  });

  it("omits the retry button when no handler is given", () => {
    const html = renderToStaticMarkup(<ErrorBanner message="出错了" />);
    expect(html).not.toContain("重试");
  });

  it("renders the retry button and extra actions when provided", () => {
    const html = renderToStaticMarkup(
      <ErrorBanner message="出错了" onRetry={() => undefined}>
        <button type="button">恢复默认</button>
      </ErrorBanner>
    );
    expect(html).toContain("重试");
    expect(html).toContain("恢复默认");
  });
});
