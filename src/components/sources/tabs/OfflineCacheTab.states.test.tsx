import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import type { CachedNetworkAudioMeta } from "@/services/networkAudioCache";

// 只替换读取缓存列表这一个函数，其余（统计、删除等）保持真实实现，
// 免得把 useNetworkAudioCache 的行为也一起换掉。
const getAllCachedAudioMeta = vi.fn<() => Promise<CachedNetworkAudioMeta[]>>();

vi.mock("@/services/networkAudioCache", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/networkAudioCache")>();
  return { ...actual, getAllCachedAudioMeta: () => getAllCachedAudioMeta() };
});

describe("OfflineCacheTab 状态", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    getAllCachedAudioMeta.mockReset();
    getAllCachedAudioMeta.mockResolvedValue([]);
  });

  afterEach(async () => {
    if (root) {
      await act(async () => {
        root.unmount();
      });
    }
    container?.remove();
  });

  /** 组件自己管加载态与失败态，必须 createRoot + act 才能跑挂载 effect；renderToStaticMarkup 不跑 effect。 */
  const mount = async () => {
    const { OfflineCacheTab } = await import("./OfflineCacheTab");
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root.render(<OfflineCacheTab />);
    });
  };

  it("还没有缓存歌曲时渲染空态", async () => {
    await mount();
    expect(container.innerHTML).toContain("还没有");
  });

  it("读取中显示读取提示而非空白", async () => {
    let release: (list: CachedNetworkAudioMeta[]) => void = () => undefined;
    getAllCachedAudioMeta.mockReturnValue(
      new Promise<CachedNetworkAudioMeta[]>((resolve) => {
        release = resolve;
      })
    );

    await mount();

    expect(container.innerHTML).toContain("正在读取本地 IndexedDB 缓存数据库");

    await act(async () => {
      release([]);
    });
  });

  it("读取失败渲染错误横幅与重试，且不把故障说成空库", async () => {
    getAllCachedAudioMeta.mockRejectedValue(new Error("IndexedDB 打不开"));

    await mount();

    expect(container.innerHTML).toContain("IndexedDB 打不开");
    expect(container.innerHTML).toContain("重试");
    // 关键：不能落回「还没有缓存的歌曲」，那是把读失败伪装成空库
    expect(container.innerHTML).not.toContain("还没有缓存的歌曲");
  });

  it("默认渲染不变", async () => {
    const { OfflineCacheTab } = await import("./OfflineCacheTab");
    const html = renderToStaticMarkup(<OfflineCacheTab />);
    expect(html).not.toContain("IndexedDB 打不开");
    expect(html).toContain("已缓存歌曲总数");
  });
});
