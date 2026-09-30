import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { HeaderToolbar } from "./HeaderToolbar";

const mocks = vi.hoisted(() => ({
  openPanel: vi.fn(),
  toggleFullscreen: vi.fn(),
  toggleGestureEnabled: vi.fn(),
  setCurrentView: vi.fn(),
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
}));

// 用 Object.assign 挂上 getState：导航岛在 effect 里会调 useUIStore.getState()，
// 而 SSR（renderToStaticMarkup）不跑 effect，只 mock 成普通函数时只有客户端渲染才会炸。
vi.mock("@/store/uiStore", () => {
  const state = {
    currentView: "home",
    openPanel: mocks.openPanel,
    panels: {
      keyboardShortcuts: false,
    },
    isFullscreen: false,
    toggleFullscreen: mocks.toggleFullscreen,
    setCurrentView: mocks.setCurrentView,
    setIsNavMenuOpen: vi.fn(),
  };
  return { useUIStore: Object.assign(() => state, { getState: () => state }) };
});

vi.mock("@/store/playlistStore", () => ({
  usePlaylistStore: () => ({
    songs: [{ id: "1", title: "Song 1" }],
  }),
}));

vi.mock("@/store/userAccountStore", () => ({
  useUserAccountStore: () => ({
    neteaseUser: {
      userId: 12345,
      nickname: "猫猫的小毛毛呀",
      avatarUrl: "https://example.com/avatar.jpg",
      isVip: true,
      vipType: 11,
      cloudSongCount: 128,
    },
  }),
}));

vi.mock("@/store/gestureStore", () => ({
  useGestureStore: () => ({
    isEnabled: false,
    toggleGestureEnabled: mocks.toggleGestureEnabled,
  }),
}));

vi.mock("@/components/layout/Logo", () => ({
  Logo: () => <div data-testid="logo" />,
}));

describe("HeaderToolbar", () => {
  beforeEach(() => {
    mocks.openPanel.mockClear();
    mocks.toggleFullscreen.mockClear();
    mocks.toggleGestureEnabled.mockClear();
    mocks.setCurrentView.mockClear();
    mocks.push.mockClear();
  });

  it("renders header toolbar with logo, library count, and user account capsule", () => {
    const html = renderToStaticMarkup(<HeaderToolbar />);

    expect(html).toContain("音乐库");
    expect(html).toContain("1 首歌曲");
    expect(html).toContain("猫猫的小毛毛呀");
    expect(html).toContain("VIP");
    expect(html).toContain("管理曲库");
    expect(html).toContain("多平台账号与云端资产");
  });

  // 右侧四个入口在 <1600 压成图标圈，是为了让导航岛能落在窗口中线上
  // （算法见 headerBreakpoints.ts）。边界两侧都钉住，避免有人顺手调小这个数。
  describe("右侧集群的文字标签档位", () => {
    let container: HTMLDivElement;
    let root: Root;

    const stubViewport = (width: number) =>
      vi.stubGlobal(
        "matchMedia",
        vi.fn().mockImplementation((q: string) => {
          const m = /max-width:\s*(\d+)/.exec(q);
          return {
            matches: m ? width <= Number(m[1]) : false,
            media: q,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
          };
        })
      );

    const renderAt = async (width: number) => {
      stubViewport(width);
      container = document.createElement("div");
      document.body.appendChild(container);
      root = createRoot(container);
      await act(async () => root.render(<HeaderToolbar />));
      return container.innerHTML;
    };

    afterEach(async () => {
      await act(async () => root?.unmount());
      container?.remove();
      vi.unstubAllGlobals();
    });

    it("keeps text labels at 1600", async () => {
      const html = await renderAt(1600);
      expect(html).toContain(">管理曲库<");
      expect(html).toContain(">音源管理<");
    });

    it("falls back to icon-only at 1599, keeping the title for hover", async () => {
      const html = await renderAt(1599);
      // 用 >标签< 形式判定：title 属性里本来就含「管理曲库」这几个字
      expect(html).not.toContain(">管理曲库<");
      expect(html).not.toContain(">音源管理<");
      expect(html).toContain('title="导入与管理曲库"');
      expect(html).toContain('title="全网多音源矩阵与扩展管理中心"');
    });
  });

  describe("library manager navigation", () => {
    let container: HTMLDivElement;
    let root: Root;

    beforeEach(() => {
      vi.stubGlobal(
        "matchMedia",
        vi.fn().mockImplementation((media: string) => ({
          matches: false,
          media,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        }))
      );
    });

    afterEach(async () => {
      await act(async () => root?.unmount());
      container?.remove();
      vi.unstubAllGlobals();
    });

    it("uses client navigation without allowing a document navigation", async () => {
      container = document.createElement("div");
      document.body.appendChild(container);
      root = createRoot(container);

      await act(async () => root.render(<HeaderToolbar />));

      const entry = container.querySelector<HTMLAnchorElement>('a[title="导入与管理曲库"]');
      expect(entry).not.toBeNull();
      const hrefBeforeClick = window.location.href;
      const click = new MouseEvent("click", { bubbles: true, cancelable: true });

      await act(async () => entry?.dispatchEvent(click));

      expect(mocks.push).toHaveBeenCalledWith("/data-manager");
      expect(click.defaultPrevented).toBe(true);
      expect(window.location.href).toBe(hrefBeforeClick);
    });
  });
});
