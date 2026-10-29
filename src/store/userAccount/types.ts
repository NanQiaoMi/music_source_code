// S6-12p: userAccountStore 的零 Zustand 依赖类型层，逐字迁出以便 store 本体留在
// 400 行预算内（scripts/check-store-budgets.mjs）。store 继续 re-export 公共类型。

import type { Song } from "@/types/song";

export interface UserProfile {
  loggedIn: boolean;
  userId?: string;
  nickname?: string;
  avatarUrl?: string;
  vipType?: number;
  vipLevel?: string;
  isVip?: boolean;
  isSvip?: boolean;
  vipLabel?: string;
  hasCookie?: boolean;
}

export type PlatformType = "netease" | "qq" | "kugou" | "kuwo" | "qishui";

export interface CloudPlaylist {
  id: string;
  name: string;
  coverImgUrl: string;
  trackCount: number;
  playCount: number;
  isHeart: boolean;
  source: PlatformType;
  description?: string;
}

export interface UserAccountState {
  // 弹窗状态
  isAccountModalOpen: boolean;
  setIsAccountModalOpen: (open: boolean) => void;
  activePlatform: PlatformType;
  setActivePlatform: (platform: PlatformType) => void;

  // 各平台凭证 (持久化沙盒)
  neteaseCookie: string;
  qqCookie: string;
  kugouCookie: string;
  kuwoCookie: string;
  qishuiCookie: string;

  // 各平台账号信息
  neteaseUser: UserProfile;
  qqUser: UserProfile;
  kugouUser: UserProfile;
  kuwoUser: UserProfile;
  qishuiUser: UserProfile;

  // 云端歌单
  userPlaylists: CloudPlaylist[];
  isLoadingPlaylists: boolean;
  activePlaylistSongs: Song[];
  isLoadingTracks: boolean;
  hasMoreTracks: boolean;
  trackTotalCount: number;
  activePlaylistId: string | null;
  activePlaylistSource: PlatformType;

  // 二维码状态
  qrKey: string | null;
  qrImg: string | null;
  qrStatus: number; // 800: 过期, 801: 等待扫码, 802: 待确认, 803: 成功
  qrCountdown: number;
  isPollingQr: boolean;
  qrError: string | null;

  // 门禁与状态鉴权方法
  isPlatformLoggedIn: (platform?: string) => boolean;
  getPlatformCookie: (platform?: string) => string;
  handlePlatformSessionExpired: (platform: PlatformType | string, reason?: string) => void;

  // 方法
  fetchLoginStatus: () => Promise<void>;
  generateNeteaseQr: () => Promise<void>;
  checkNeteaseQr: () => Promise<{ code: number; message: string }>;
  stopQrPolling: () => void;
  loginWithCookie: (platform: PlatformType, cookie: string) => Promise<boolean>;
  logout: (platform: PlatformType) => Promise<void>;
  fetchUserPlaylists: () => Promise<void>;
  fetchPlaylistTracks: (
    playlistId: string,
    source?: PlatformType,
    offset?: number,
    limit?: number
  ) => Promise<Song[]>;
  fetchAllPlaylistTracks: (playlistId: string, source?: PlatformType) => Promise<Song[]>;
  loadMorePlaylistTracks: () => Promise<Song[]>;
}

/** 云歌单接口的原始返回项（外部 JSON，字段可选） */
export interface RawCloudPlaylist {
  id?: string | number;
  name?: string;
  coverImgUrl?: string;
  cover?: string;
  trackCount?: number;
  songCount?: number;
  playCount?: number;
  specialType?: number;
  description?: string;
}

/** 歌单曲目接口的原始返回项（外部 JSON，字段可选） */
export interface RawPlaylistSong {
  id?: string | number;
  songmid?: string;
  hash?: string;
  name?: string;
  title?: string;
  artist?: string;
  artists?: { name?: string }[];
  album?: string;
  albumName?: string;
  duration?: number;
  cover?: string;
  picUrl?: string;
  albumPic?: string;
  url?: string;
}
