// S6-12p: userAccountStore 的零 Zustand 依赖层：初始值、平台归一化、纯映射与纯
// URL 构造。store 仅保留状态与 action 编排，公共标识符仍由 store re-export。

import type { Song } from "@/types/song";
import type {
  CloudPlaylist,
  PlatformType,
  RawCloudPlaylist,
  RawPlaylistSong,
  UserAccountState,
  UserProfile,
} from "./types";

export const API_BASE = "";

export const defaultUserProfile: UserProfile = {
  loggedIn: false,
  vipType: 0,
  vipLevel: "none",
  isVip: false,
  isSvip: false,
  vipLabel: "未登录",
};

export function createInitialUserAccountState() {
  return {
    isAccountModalOpen: false,
    activePlatform: "netease" as PlatformType,

    neteaseCookie: "",
    qqCookie: "",
    kugouCookie: "",
    kuwoCookie: "",
    qishuiCookie: "",

    neteaseUser: defaultUserProfile,
    qqUser: defaultUserProfile,
    kugouUser: defaultUserProfile,
    kuwoUser: defaultUserProfile,
    qishuiUser: defaultUserProfile,

    userPlaylists: [] as CloudPlaylist[],
    isLoadingPlaylists: false,
    activePlaylistSongs: [] as Song[],
    isLoadingTracks: false,
    hasMoreTracks: false,
    trackTotalCount: 0,
    activePlaylistId: null,
    activePlaylistSource: "netease" as PlatformType,

    qrKey: null,
    qrImg: null,
    qrStatus: 801,
    qrCountdown: 120,
    isPollingQr: false,
    qrError: null,
  };
}

export type AccountGateState = Pick<
  UserAccountState,
  | "neteaseCookie"
  | "qqCookie"
  | "kugouCookie"
  | "kuwoCookie"
  | "qishuiCookie"
  | "neteaseUser"
  | "qqUser"
  | "kugouUser"
  | "kuwoUser"
  | "qishuiUser"
>;

/** 把平台别名归一成规范名；未知平台原样返回。 */
export function normalizePlatform(platform?: string): string {
  const norm = (platform || "").toLowerCase().trim();
  if (norm === "wy") return "netease";
  if (norm === "tx") return "qq";
  if (norm === "kg") return "kugou";
  if (norm === "kw") return "kuwo";
  return norm;
}

export function isLoggedInForPlatform(state: AccountGateState, platform?: string): boolean {
  if (!platform) return false;
  const norm = normalizePlatform(platform);
  if (norm === "local" || norm === "upload" || norm === "cached") return true;
  if (norm === "lx_custom" || norm === "lx") return true; // 洛雪扩展源由自身独立脚本开关控制

  if (norm === "netease") {
    return Boolean(
      state.neteaseUser?.loggedIn || (state.neteaseCookie && state.neteaseCookie.trim().length > 10)
    );
  }
  if (norm === "qq") {
    return Boolean(state.qqUser?.loggedIn || (state.qqCookie && state.qqCookie.trim().length > 5));
  }
  if (norm === "kugou") {
    return Boolean(
      state.kugouUser?.loggedIn || (state.kugouCookie && state.kugouCookie.trim().length > 5)
    );
  }
  if (norm === "kuwo") {
    return Boolean(
      state.kuwoUser?.loggedIn || (state.kuwoCookie && state.kuwoCookie.trim().length > 5)
    );
  }
  if (norm === "qishui") {
    return Boolean(
      state.qishuiUser?.loggedIn || (state.qishuiCookie && state.qishuiCookie.trim().length > 5)
    );
  }
  return false;
}

export function getCookieForPlatform(state: AccountGateState, platform?: string): string {
  if (!platform) return "";
  const norm = normalizePlatform(platform);
  if (norm === "netease") return state.neteaseCookie || "";
  if (norm === "qq") return state.qqCookie || "";
  if (norm === "kugou") return state.kugouCookie || "";
  if (norm === "kuwo") return state.kuwoCookie || "";
  if (norm === "qishui") return state.qishuiCookie || "";
  return "";
}

/** 会话过期时只重置对应用户的登录标记，其余气泡文案保持不变。 */
export function getSessionExpiredPatch(
  state: AccountGateState,
  platform: PlatformType | string
): Partial<UserAccountState> | null {
  const p = normalizePlatform(platform);
  if (p === "netease") {
    return { neteaseUser: { ...state.neteaseUser, loggedIn: false, vipLabel: "已过期" } };
  }
  if (p === "qq") {
    return { qqUser: { ...state.qqUser, loggedIn: false, vipLabel: "已过期" } };
  }
  if (p === "kugou") {
    return { kugouUser: { ...state.kugouUser, loggedIn: false, vipLabel: "已过期" } };
  }
  if (p === "kuwo") {
    return { kuwoUser: { ...state.kuwoUser, loggedIn: false, vipLabel: "已过期" } };
  }
  if (p === "qishui") {
    return { qishuiUser: { ...state.qishuiUser, loggedIn: false, vipLabel: "已过期" } };
  }
  return null;
}

/** 登录状态接口的原始返回项（字段可选，外部 JSON）。 */
export interface RawLoginStatus {
  loggedIn?: boolean;
  userId?: string | number;
  nickname?: string;
  avatarUrl?: string;
  avatar?: string;
  vipType?: number;
  vipLevel?: string;
  isVip?: boolean;
  isSvip?: boolean;
  vipLabel?: string;
  configured?: boolean;
}

export function mapNeteaseUser(data: RawLoginStatus): UserProfile {
  return {
    loggedIn: Boolean(data.loggedIn),
    userId: data.userId ? String(data.userId) : undefined,
    nickname: data.nickname || (data.loggedIn ? "网易云音乐人" : undefined),
    avatarUrl: data.avatarUrl || data.avatar || undefined,
    vipType: data.vipType,
    vipLevel: data.vipLevel,
    isVip: Boolean(data.isVip),
    isSvip: Boolean(data.isSvip),
    vipLabel: data.vipLabel || (data.isSvip ? "黑胶 SVIP" : data.isVip ? "黑胶 VIP" : "标准会员"),
    hasCookie: true,
  };
}

export function mapQqUser(data: RawLoginStatus): UserProfile {
  return {
    loggedIn: Boolean(data.loggedIn),
    nickname: data.nickname || (data.loggedIn ? "QQ 音乐绿钻用户" : undefined),
    avatarUrl: data.avatar || undefined,
    isVip: Boolean(data.isVip),
    vipLabel: data.vipLabel || "豪华绿钻",
    hasCookie: true,
  };
}

export function mapKugouUser(data: RawLoginStatus): UserProfile {
  return {
    loggedIn: Boolean(data.loggedIn),
    nickname: data.nickname || (data.loggedIn ? "酷狗 VIP 用户" : undefined),
    avatarUrl: data.avatar || undefined,
    isVip: Boolean(data.isVip),
    vipLabel: data.vipLabel || "豪华 VIP",
    hasCookie: true,
  };
}

/** 酷我 cookie 登录视为母带会员（本地固定态，无远端校验）。 */
export function createKuwoUser(): UserProfile {
  return {
    loggedIn: true,
    nickname: "酷我母带会员",
    isVip: true,
    vipLabel: "白金 VIP",
    hasCookie: true,
  };
}

export function mapQishuiUser(data: RawLoginStatus): UserProfile {
  return {
    loggedIn: Boolean(data.configured || data.loggedIn),
    nickname: data.nickname || "汽水会员",
    vipLabel: data.configured ? "SpadeKey 已激活" : "未激活",
  };
}

export function mapCloudPlaylists(data: { playlists?: RawCloudPlaylist[] }): CloudPlaylist[] {
  const list: CloudPlaylist[] = [];
  if (Array.isArray(data.playlists)) {
    data.playlists.forEach((pl, idx) => {
      list.push({
        id: String(pl.id),
        name: pl.name || "未命名歌单",
        coverImgUrl: pl.coverImgUrl || pl.cover || "/default-cover.svg",
        trackCount: pl.trackCount || pl.songCount || 0,
        playCount: pl.playCount || 0,
        isHeart: idx === 0 || pl.name?.includes("喜欢的音乐") || pl.specialType === 5,
        source: "netease",
        description: pl.description || "",
      });
    });
  }
  return list;
}

export function mapPlaylistSongs(rawList: RawPlaylistSong[], source: PlatformType): Song[] {
  const songs: Song[] = [];
  if (Array.isArray(rawList)) {
    rawList.forEach((s: RawPlaylistSong) => {
      const songId = String(s.id || s.songmid || s.hash || "");
      const songName = s.name || s.title || "";
      const artistName =
        s.artist ||
        (Array.isArray(s.artists)
          ? s.artists.map((a: { name?: string }) => a.name).join("/")
          : "未知歌手");

      if (songName) {
        songs.push({
          id: songId,
          title: songName,
          artist: artistName,
          album: s.album || s.albumName || "精选专辑",
          duration: s.duration
            ? Math.round(s.duration > 1000 ? s.duration / 1000 : s.duration)
            : 240,
          cover: s.cover || s.picUrl || s.albumPic || "/default-cover.svg",
          source,
          audioUrl: s.url || `https://music.163.com/song/media/outer/url?id=${songId}.mp3`,
          format: "mp3",
        });
      }
    });
  }
  return songs;
}

export function resolveLoginCookieUrl(platform: PlatformType): string {
  if (platform === "qq") return `${API_BASE}/api/qq/login/cookie`;
  if (platform === "kugou") return `${API_BASE}/api/kugou/login/cookie`;
  return `${API_BASE}/api/login/cookie`;
}

export function resolveLogoutUrl(platform: PlatformType): string {
  if (platform === "qq") return `${API_BASE}/api/qq/logout`;
  if (platform === "kugou") return `${API_BASE}/api/kugou/logout`;
  if (platform === "qishui") return `${API_BASE}/api/qishui/logout`;
  return `${API_BASE}/api/logout`;
}

export function resolvePlaylistTracksUrl(
  playlistId: string,
  source: PlatformType,
  offset: number,
  limit: number
): string {
  const query = `id=${encodeURIComponent(playlistId)}&offset=${offset}&limit=${limit}`;
  if (source === "qq") return `${API_BASE}/api/qq/playlist/tracks?${query}`;
  if (source === "kugou") return `${API_BASE}/api/kugou/playlist/tracks?${query}`;
  if (source === "qishui") return `${API_BASE}/api/qishui/playlist/tracks?${query}`;
  return `${API_BASE}/api/playlist/tracks?${query}`;
}
