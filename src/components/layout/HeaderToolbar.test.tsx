import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { HeaderToolbar } from "./HeaderToolbar";

const mocks = vi.hoisted(() => ({
  openPanel: vi.fn(),
  toggleFullscreen: vi.fn(),
  toggleGestureEnabled: vi.fn(),
  setCurrentView: vi.fn(),
}));

vi.mock("@/store/uiStore", () => ({
  useUIStore: () => ({
    currentView: "home",
    openPanel: mocks.openPanel,
    panels: {
      keyboardShortcuts: false,
    },
    isFullscreen: false,
    toggleFullscreen: mocks.toggleFullscreen,
    setCurrentView: mocks.setCurrentView,
  }),
}));

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
});
