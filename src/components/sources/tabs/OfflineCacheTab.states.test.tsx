import { describe, it, expect, afterEach } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";

describe("OfflineCacheTab 状态", () => {
  let container: HTMLDivElement;
  let root: Root;

  afterEach(async () => {
    if (root) {
      await act(async () => {
        root.unmount();
      });
    }
    container?.remove();
  });

  // 空态由组件自己的 cachedSongs 推导，且要等挂载 effect 拉完 IndexedDB 才能判定，
  // 所以这里用 createRoot + act，renderToStaticMarkup 不跑 effect。
  it("还没有缓存歌曲时渲染空态", async () => {
    const { OfflineCacheTab } = await import("./OfflineCacheTab");
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root.render(<OfflineCacheTab />);
    });

    expect(container.innerHTML).toContain("还没有");
  });

  it("加载中渲染骨架而非空白", async () => {
    const { OfflineCacheTab } = await import("./OfflineCacheTab");
    const html = renderToStaticMarkup(<OfflineCacheTab loading />);
    expect(html).toContain("data-skeleton");
  });

  it("加载失败渲染错误态与重试", async () => {
    const { OfflineCacheTab } = await import("./OfflineCacheTab");
    const html = renderToStaticMarkup(
      <OfflineCacheTab error="离线缓存读取失败" onRetry={() => undefined} />
    );
    expect(html).toContain("离线缓存读取失败");
    expect(html).toContain("重试");
  });

  it("默认（无三态 props）渲染不变", async () => {
    const { OfflineCacheTab } = await import("./OfflineCacheTab");
    const html = renderToStaticMarkup(<OfflineCacheTab />);
    expect(html).not.toContain("data-skeleton");
    expect(html).not.toContain("离线缓存读取失败");
    expect(html).toContain("已缓存歌曲总数");
  });
});
