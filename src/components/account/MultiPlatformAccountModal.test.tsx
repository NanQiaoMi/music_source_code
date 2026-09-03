import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MultiPlatformAccountModal } from "./MultiPlatformAccountModal";
import { useUserAccountStore } from "@/store/userAccountStore";

vi.mock("@/lib/audio/useIntegratedAudioPipeline", () => ({
  useIntegratedAudioPipeline: () => ({
    playTrackWithPipeline: vi.fn(),
  }),
}));

vi.mock("@/store/audioStore", () => ({
  useAudioStore: {
    getState: vi.fn(() => ({
      playQueue: vi.fn(),
    })),
    setState: vi.fn(),
  },
}));

vi.mock("@/store/queueStore", () => ({
  useQueueStore: Object.assign(
    (selector: any) => selector({ setQueue: vi.fn(), queue: [] }),
    {
      getState: () => ({ setQueue: vi.fn(), queue: [] }),
      setState: vi.fn(),
    }
  ),
}));

const mockAccountState = {
  activePlatform: "netease",
  neteaseUser: {
    loggedIn: true,
    nickname: "猫猫的小毛毛呀",
    avatarUrl: "https://example.com/avatar.jpg",
    vipLabel: "黑胶 SVIP",
  },
  qqUser: { loggedIn: false },
  kugouUser: { loggedIn: false },
  kuwoUser: { loggedIn: false },
  qishuiUser: { loggedIn: false },
  userPlaylists: [
    {
      id: "pl-1",
      name: "我喜欢的音乐",
      trackCount: 929,
      playCount: 10000,
      coverImgUrl: "https://example.com/cover1.jpg",
      source: "netease",
      isHeart: true,
    },
    {
      id: "pl-2",
      name: "剪辑用",
      trackCount: 65,
      playCount: 500,
      coverImgUrl: "https://example.com/cover2.jpg",
      source: "netease",
      isHeart: false,
    },
  ],
  isLoadingPlaylists: false,
  qrImg: null,
  qrStatus: 801,
  qrCountdown: 120,
  qrError: null,
  isPollingQr: false,
  fetchLoginStatus: vi.fn(),
  generateNeteaseQr: vi.fn(),
  checkNeteaseQr: vi.fn(),
  stopQrPolling: vi.fn(),
  loginWithCookie: vi.fn(),
  logout: vi.fn(),
  fetchUserPlaylists: vi.fn(),
  fetchPlaylistTracks: vi.fn(),
  setActivePlatform: vi.fn(),
};

vi.mock("@/store/userAccountStore", () => ({
  useUserAccountStore: Object.assign(
    () => mockAccountState,
    {
      getState: () => mockAccountState,
      setState: vi.fn(),
    }
  ),
}));

describe("MultiPlatformAccountModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders modal header, user info, and playlists when open", () => {
    const html = renderToStaticMarkup(<MultiPlatformAccountModal isOpen={true} onClose={vi.fn()} />);

    expect(html).toContain("多平台账号与云端资产");
    expect(html).toContain("云端直连");
    expect(html).toContain("猫猫的小毛毛呀");
    expect(html).toContain("黑胶 SVIP");
    expect(html).toContain("已同步云端歌单");
    expect(html).toContain("我喜欢的音乐");
    expect(html).toContain("剪辑用");
    expect(html).toContain("安全提示：凭据仅保存在本地沙盒，绝不上报第三方");
    expect(html).toContain("关闭");
  });

  it("returns null when isOpen is false", () => {
    const html = renderToStaticMarkup(<MultiPlatformAccountModal isOpen={false} onClose={vi.fn()} />);
    expect(html).toBe("");
  });
});
