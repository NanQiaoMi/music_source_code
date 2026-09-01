import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { createSafeStorage } from "@/lib/storage/safeStorage";
import { Song } from "@/types/song";

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

interface UserAccountState {
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
  fetchPlaylistTracks: (playlistId: string, source?: PlatformType, offset?: number, limit?: number) => Promise<Song[]>;
  fetchAllPlaylistTracks: (playlistId: string, source?: PlatformType) => Promise<Song[]>;
  loadMorePlaylistTracks: () => Promise<Song[]>;
}

const API_BASE = "";

const defaultUserProfile: UserProfile = {
  loggedIn: false,
  vipType: 0,
  vipLevel: "none",
  isVip: false,
  isSvip: false,
  vipLabel: "未登录",
};

export const useUserAccountStore = create<UserAccountState>()(
  persist(
    (set, get) => ({
      isAccountModalOpen: false,
      setIsAccountModalOpen: (open) => set({ isAccountModalOpen: open }),
      activePlatform: "netease",
      setActivePlatform: (platform) => set({ activePlatform: platform }),

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

      isPlatformLoggedIn: (platform?: string) => {
        if (!platform) return false;
        const norm = platform.toLowerCase().trim();
        if (norm === "local" || norm === "upload" || norm === "cached") return true;
        if (norm === "lx_custom" || norm === "lx") return true; // 洛雪扩展源由自身独立脚本开关控制

        const state = get();
        if (norm === "netease" || norm === "wy") {
          return Boolean(state.neteaseUser?.loggedIn || (state.neteaseCookie && state.neteaseCookie.trim().length > 10));
        }
        if (norm === "qq" || norm === "tx") {
          return Boolean(state.qqUser?.loggedIn || (state.qqCookie && state.qqCookie.trim().length > 5));
        }
        if (norm === "kugou" || norm === "kg") {
          return Boolean(state.kugouUser?.loggedIn || (state.kugouCookie && state.kugouCookie.trim().length > 5));
        }
        if (norm === "kuwo" || norm === "kw") {
          return Boolean(state.kuwoUser?.loggedIn || (state.kuwoCookie && state.kuwoCookie.trim().length > 5));
        }
        if (norm === "qishui") {
          return Boolean(state.qishuiUser?.loggedIn || (state.qishuiCookie && state.qishuiCookie.trim().length > 5));
        }
        return false;
      },

      getPlatformCookie: (platform?: string) => {
        if (!platform) return "";
        const norm = platform.toLowerCase().trim();
        const state = get();
        if (norm === "netease" || norm === "wy") return state.neteaseCookie || "";
        if (norm === "qq" || norm === "tx") return state.qqCookie || "";
        if (norm === "kugou" || norm === "kg") return state.kugouCookie || "";
        if (norm === "kuwo" || norm === "kw") return state.kuwoCookie || "";
        if (norm === "qishui") return state.qishuiCookie || "";
        return "";
      },

      handlePlatformSessionExpired: (platform: PlatformType | string, reason?: string) => {
        const norm = (platform || "").toLowerCase().trim();
        const p = (norm === "wy" ? "netease" : norm === "tx" ? "qq" : norm === "kg" ? "kugou" : norm === "kw" ? "kuwo" : norm) as PlatformType;
        console.warn(`[userAccountStore] Session expired for platform: ${p}, reason: ${reason || "401 Unauthorized"}`);
        const state = get();
        if (p === "netease") {
          set({ neteaseUser: { ...state.neteaseUser, loggedIn: false, vipLabel: "已过期" } });
        } else if (p === "qq") {
          set({ qqUser: { ...state.qqUser, loggedIn: false, vipLabel: "已过期" } });
        } else if (p === "kugou") {
          set({ kugouUser: { ...state.kugouUser, loggedIn: false, vipLabel: "已过期" } });
        } else if (p === "kuwo") {
          set({ kuwoUser: { ...state.kuwoUser, loggedIn: false, vipLabel: "已过期" } });
        } else if (p === "qishui") {
          set({ qishuiUser: { ...state.qishuiUser, loggedIn: false, vipLabel: "已过期" } });
        }
      },


      userPlaylists: [],
      isLoadingPlaylists: false,
      activePlaylistSongs: [],
      isLoadingTracks: false,
      hasMoreTracks: false,
      trackTotalCount: 0,
      activePlaylistId: null,
      activePlaylistSource: "netease",

      qrKey: null,
      qrImg: null,
      qrStatus: 801,
      qrCountdown: 120,
      isPollingQr: false,
      qrError: null,

      fetchLoginStatus: async () => {
        const { neteaseCookie, qqCookie, kugouCookie, kuwoCookie } = get();

        try {
          // 1. 网易云状态
          if (neteaseCookie) {
            const ncmRes = await fetch(`${API_BASE}/api/login/status`, {
              headers: { "x-netease-cookie": neteaseCookie },
            });
            if (ncmRes.ok) {
              const data = await ncmRes.json();
              set({
                neteaseUser: {
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
                },
              });
            }
          }

          // 2. QQ 音乐状态
          if (qqCookie) {
            const qqRes = await fetch(`${API_BASE}/api/qq/login/status`, {
              headers: { "x-qq-cookie": qqCookie },
            });
            if (qqRes.ok) {
              const data = await qqRes.json();
              set({
                qqUser: {
                  loggedIn: Boolean(data.loggedIn),
                  nickname: data.nickname || (data.loggedIn ? "QQ 音乐绿钻用户" : undefined),
                  avatarUrl: data.avatar || undefined,
                  isVip: Boolean(data.isVip),
                  vipLabel: data.vipLabel || "豪华绿钻",
                  hasCookie: true,
                },
              });
            }
          }

          // 3. 酷狗音乐状态
          if (kugouCookie) {
            const kugouRes = await fetch(`${API_BASE}/api/kugou/login/status`, {
              headers: { "x-kugou-cookie": kugouCookie },
            });
            if (kugouRes.ok) {
              const data = await kugouRes.json();
              set({
                kugouUser: {
                  loggedIn: Boolean(data.loggedIn),
                  nickname: data.nickname || (data.loggedIn ? "酷狗 VIP 用户" : undefined),
                  avatarUrl: data.avatar || undefined,
                  isVip: Boolean(data.isVip),
                  vipLabel: data.vipLabel || "豪华 VIP",
                  hasCookie: true,
                },
              });
            }
          }

          // 4. 酷我音乐状态
          if (kuwoCookie) {
            set({
              kuwoUser: {
                loggedIn: true,
                nickname: "酷我母带会员",
                isVip: true,
                vipLabel: "白金 VIP",
                hasCookie: true,
              },
            });
          }

          // 5. 汽水音乐状态
          const qishuiRes = await fetch(`${API_BASE}/api/qishui/status`);
          if (qishuiRes.ok) {
            const data = await qishuiRes.json();
            set({
              qishuiUser: {
                loggedIn: Boolean(data.configured || data.loggedIn),
                nickname: data.nickname || "汽水会员",
                vipLabel: data.configured ? "SpadeKey 已激活" : "未激活",
              },
            });
          }

          // 如果已登录，自动拉取歌单
          if (get().neteaseUser.loggedIn && get().userPlaylists.length === 0) {
            get().fetchUserPlaylists();
          }
        } catch (e) {
          console.warn("[userAccountStore] Failed to fetch login status:", e);
        }
      },

      generateNeteaseQr: async () => {
        try {
          set({ qrStatus: 801, qrCountdown: 120, isPollingQr: true, qrImg: null, qrError: null });
          const keyRes = await fetch(`${API_BASE}/api/login/qr/key?timestamp=${Date.now()}`);
          if (!keyRes.ok) {
            set({ qrError: "获取扫码 Key 失败，请重试", isPollingQr: false });
            return;
          }
          const keyData = await keyRes.json();
          const unikey = keyData.key || keyData.unikey;
          if (!unikey) {
            set({ qrError: "解析扫码 Key 异常", isPollingQr: false });
            return;
          }

          const createRes = await fetch(`${API_BASE}/api/login/qr/create?key=${encodeURIComponent(unikey)}&timestamp=${Date.now()}`);
          if (!createRes.ok) {
            set({ qrError: "生成二维码图片失败", isPollingQr: false });
            return;
          }
          const createData = await createRes.json();
          const imgUrl = createData.img || createData.qrimg || createData.data?.qrimg || "";

          set({
            qrKey: unikey,
            qrImg: imgUrl,
            qrStatus: 801,
            qrError: null,
          });
        } catch (e) {
          console.warn("[userAccountStore] generateNeteaseQr error:", e);
          set({ qrError: "网络连接失败，请点击刷新", isPollingQr: false });
        }
      },

      checkNeteaseQr: async () => {
        const { qrKey } = get();
        if (!qrKey) return { code: 800, message: "二维码未生成" };

        try {
          const res = await fetch(`${API_BASE}/api/login/qr/check?key=${encodeURIComponent(qrKey)}&timestamp=${Date.now()}`);
          if (!res.ok) return { code: 500, message: "网络异常" };
          const data = await res.json();
          const code = data.code || (data.status === "AUTHORIZED" ? 803 : data.status === "EXPIRED" ? 800 : 801);

          set({ qrStatus: code });

          if (code === 803) {
            set({ isPollingQr: false });
            if (data.cookie) {
              set({ neteaseCookie: data.cookie });
            }
            await get().fetchLoginStatus();
            await get().fetchUserPlaylists();
          } else if (code === 800) {
            set({ isPollingQr: false });
          }

          return { code, message: data.message || (code === 803 ? "授权成功" : code === 802 ? "待在手机上确认" : "等待扫码") };
        } catch (e) {
          return { code: 500, message: "检查状态失败" };
        }
      },

      stopQrPolling: () => {
        set({ isPollingQr: false });
      },

      loginWithCookie: async (platform, cookie) => {
        if (!cookie.trim()) return false;

        try {
          let url = `${API_BASE}/api/login/cookie`;
          if (platform === "qq") url = `${API_BASE}/api/qq/login/cookie`;
          else if (platform === "kugou") url = `${API_BASE}/api/kugou/login/cookie`;
          else if (platform === "kuwo") {
            set({
              kuwoCookie: cookie.trim(),
              kuwoUser: {
                loggedIn: true,
                nickname: "酷我母带会员",
                isVip: true,
                vipLabel: "白金 VIP",
                hasCookie: true,
              },
            });
            return true;
          }

          const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ cookie: cookie.trim() }),
          });

          if (!res.ok) return false;
          const data = await res.json();

          if (data.loggedIn || data.status === "ok") {
            if (platform === "netease") set({ neteaseCookie: cookie.trim() });
            else if (platform === "qq") set({ qqCookie: cookie.trim() });
            else if (platform === "kugou") set({ kugouCookie: cookie.trim() });

            await get().fetchLoginStatus();
            if (platform === "netease") {
              await get().fetchUserPlaylists();
            }
            return true;
          }
          return false;
        } catch (e) {
          console.warn(`[userAccountStore] loginWithCookie for ${platform} error:`, e);
          return false;
        }
      },

      logout: async (platform) => {
        try {
          let url = `${API_BASE}/api/logout`;
          if (platform === "qq") url = `${API_BASE}/api/qq/logout`;
          else if (platform === "kugou") url = `${API_BASE}/api/kugou/logout`;
          else if (platform === "qishui") url = `${API_BASE}/api/qishui/logout`;

          await fetch(url, { method: "POST" }).catch(() => {});
        } catch {}

        if (platform === "netease") set({ neteaseCookie: "", neteaseUser: defaultUserProfile, userPlaylists: [] });
        else if (platform === "qq") set({ qqCookie: "", qqUser: defaultUserProfile });
        else if (platform === "kugou") set({ kugouCookie: "", kugouUser: defaultUserProfile });
        else if (platform === "kuwo") set({ kuwoCookie: "", kuwoUser: defaultUserProfile });
        else if (platform === "qishui") set({ qishuiCookie: "", qishuiUser: defaultUserProfile });
      },

      fetchUserPlaylists: async () => {
        const { neteaseCookie, neteaseUser } = get();
        set({ isLoadingPlaylists: true });

        try {
          const res = await fetch(`${API_BASE}/api/user/playlists`, {
            headers: {
              "x-netease-cookie": neteaseCookie,
              "x-user-id": neteaseUser.userId || "",
            },
          });

          if (!res.ok) {
            set({ isLoadingPlaylists: false });
            return;
          }
          const data = await res.json();
          const list: CloudPlaylist[] = [];

          if (Array.isArray(data.playlists)) {
            data.playlists.forEach((pl: any, idx: number) => {
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

          set({ userPlaylists: list, isLoadingPlaylists: false });
        } catch (e) {
          console.warn("[userAccountStore] fetchUserPlaylists error:", e);
          set({ isLoadingPlaylists: false });
        }
      },

      fetchPlaylistTracks: async (playlistId: string, source: PlatformType = "netease", offset = 0, limit = 100) => {
        const { neteaseCookie } = get();
        set({ isLoadingTracks: true });

        try {
          let url = `${API_BASE}/api/playlist/tracks?id=${encodeURIComponent(playlistId)}&offset=${offset}&limit=${limit}`;
          if (source === "qq") url = `${API_BASE}/api/qq/playlist/tracks?id=${encodeURIComponent(playlistId)}&offset=${offset}&limit=${limit}`;
          else if (source === "kugou") url = `${API_BASE}/api/kugou/playlist/tracks?id=${encodeURIComponent(playlistId)}&offset=${offset}&limit=${limit}`;
          else if (source === "qishui") url = `${API_BASE}/api/qishui/playlist/tracks?id=${encodeURIComponent(playlistId)}&offset=${offset}&limit=${limit}`;

          const res = await fetch(url, {
            headers: {
              "x-netease-cookie": neteaseCookie,
            },
          });

          if (!res.ok) {
            set({ isLoadingTracks: false });
            return [];
          }
          const data = await res.json();
          const songs: Song[] = [];

          const rawList = data.songs || data.tracks || [];
          if (Array.isArray(rawList)) {
            rawList.forEach((s: any) => {
              const songId = String(s.id || s.songmid || s.hash || "");
              const songName = s.name || s.title || "";
              const artistName = s.artist || (Array.isArray(s.artists) ? s.artists.map((a: any) => a.name).join("/") : "未知歌手");

              if (songName) {
                songs.push({
                  id: songId,
                  title: songName,
                  artist: artistName,
                  album: s.album || s.albumName || "精选专辑",
                  duration: s.duration ? Math.round(s.duration > 1000 ? s.duration / 1000 : s.duration) : 240,
                  cover: s.cover || s.picUrl || s.albumPic || "/default-cover.svg",
                  source,
                  audioUrl: s.url || `https://music.163.com/song/media/outer/url?id=${songId}.mp3`,
                  format: "mp3",
                });
              }
            });
          }

          const hasMore = Boolean(data.hasMore);
          const total = data.trackCount || (offset + songs.length);
          const merged = offset === 0 ? songs : [...get().activePlaylistSongs, ...songs];

          set({
            activePlaylistId: playlistId,
            activePlaylistSource: source,
            activePlaylistSongs: merged,
            hasMoreTracks: hasMore,
            trackTotalCount: total,
            isLoadingTracks: false,
          });

          return songs;
        } catch (e) {
          console.warn("[userAccountStore] fetchPlaylistTracks error:", e);
          set({ isLoadingTracks: false });
          return [];
        }
      },

      fetchAllPlaylistTracks: async (playlistId: string, source: PlatformType = "netease") => {
        // First batch (up to 1000 songs)
        const firstBatch = await get().fetchPlaylistTracks(playlistId, source, 0, 1000);
        let allSongs = [...firstBatch];
        let offset = firstBatch.length;
        const total = get().trackTotalCount || firstBatch.length;

        // Loop to fetch remaining tracks if playlist has > 1000 songs
        while (offset < total && firstBatch.length > 0) {
          const nextBatch = await get().fetchPlaylistTracks(playlistId, source, offset, 1000);
          if (nextBatch.length === 0) break;
          allSongs = [...allSongs, ...nextBatch];
          offset += nextBatch.length;
        }

        return allSongs;
      },

      loadMorePlaylistTracks: async () => {
        const { activePlaylistId, activePlaylistSource, activePlaylistSongs, isLoadingTracks, hasMoreTracks } = get();
        if (!activePlaylistId || isLoadingTracks || !hasMoreTracks) return [];
        return get().fetchPlaylistTracks(activePlaylistId, activePlaylistSource, activePlaylistSongs.length, 100);
      },
    }),
    {
      name: "mimi-user-account-storage",
      storage: createJSONStorage(() => createSafeStorage("mimi-user-account-storage")),
      partialize: (state) => ({
        neteaseCookie: state.neteaseCookie,
        qqCookie: state.qqCookie,
        kugouCookie: state.kugouCookie,
        kuwoCookie: state.kuwoCookie,
        qishuiCookie: state.qishuiCookie,
        neteaseUser: state.neteaseUser,
        qqUser: state.qqUser,
        kugouUser: state.kugouUser,
        kuwoUser: state.kuwoUser,
        qishuiUser: state.qishuiUser,
        userPlaylists: Array.isArray(state.userPlaylists) ? state.userPlaylists.slice(0, 50) : [],
      }),
    }
  )
);

export function isPlatformLoggedIn(platform?: string): boolean {
  if (!platform) return false;
  return useUserAccountStore.getState().isPlatformLoggedIn(platform);
}

export function hasAnyPlatformLoggedIn(): boolean {
  return (
    isPlatformLoggedIn("netease") ||
    isPlatformLoggedIn("qq") ||
    isPlatformLoggedIn("kugou") ||
    isPlatformLoggedIn("kuwo") ||
    isPlatformLoggedIn("qishui")
  );
}

export function handlePlatformSessionExpired(platform: PlatformType | string, reason?: string): void {
  useUserAccountStore.getState().handlePlatformSessionExpired(platform, reason);
}


