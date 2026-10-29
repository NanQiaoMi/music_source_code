// S6-12p: userAccountStore 仅保留状态与 action 编排；类型、默认值、平台归一化、
// 纯映射与 URL 构造已迁至 ./userAccount/{types,helpers}.ts。
// 公共类型仍从此处 re-export，persist name/version/partialize 保持不变。
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { createSafeStorage } from "@/lib/storage/safeStorage";
import type { PlatformType, UserAccountState } from "./userAccount/types";
import {
  API_BASE,
  createInitialUserAccountState,
  createKuwoUser,
  defaultUserProfile,
  getCookieForPlatform,
  getSessionExpiredPatch,
  isLoggedInForPlatform,
  mapCloudPlaylists,
  mapKugouUser,
  mapNeteaseUser,
  mapPlaylistSongs,
  mapQqUser,
  mapQishuiUser,
  normalizePlatform,
  resolveLoginCookieUrl,
  resolveLogoutUrl,
  resolvePlaylistTracksUrl,
} from "./userAccount/helpers";

export type { CloudPlaylist, PlatformType, UserProfile } from "./userAccount/types";

export const useUserAccountStore = create<UserAccountState>()(
  persist(
    (set, get) => ({
      ...createInitialUserAccountState(),

      setIsAccountModalOpen: (open) => set({ isAccountModalOpen: open }),
      setActivePlatform: (platform) => set({ activePlatform: platform }),

      isPlatformLoggedIn: (platform?: string) => isLoggedInForPlatform(get(), platform),

      getPlatformCookie: (platform?: string) => getCookieForPlatform(get(), platform),

      handlePlatformSessionExpired: (platform, reason) => {
        const p = normalizePlatform(platform);
        console.warn(
          `[userAccountStore] Session expired for platform: ${p}, reason: ${reason || "401 Unauthorized"}`
        );
        const patch = getSessionExpiredPatch(get(), platform);
        if (patch) set(patch);
      },

      fetchLoginStatus: async () => {
        const { neteaseCookie, qqCookie, kugouCookie, kuwoCookie } = get();

        try {
          // 1. 网易云状态
          if (neteaseCookie) {
            const ncmRes = await fetch(`${API_BASE}/api/login/status`, {
              headers: { "x-netease-cookie": neteaseCookie },
            });
            if (ncmRes.ok) {
              set({ neteaseUser: mapNeteaseUser(await ncmRes.json()) });
            }
          }

          // 2. QQ 音乐状态
          if (qqCookie) {
            const qqRes = await fetch(`${API_BASE}/api/qq/login/status`, {
              headers: { "x-qq-cookie": qqCookie },
            });
            if (qqRes.ok) {
              set({ qqUser: mapQqUser(await qqRes.json()) });
            }
          }

          // 3. 酷狗音乐状态
          if (kugouCookie) {
            const kugouRes = await fetch(`${API_BASE}/api/kugou/login/status`, {
              headers: { "x-kugou-cookie": kugouCookie },
            });
            if (kugouRes.ok) {
              set({ kugouUser: mapKugouUser(await kugouRes.json()) });
            }
          }

          // 4. 酷我音乐状态
          if (kuwoCookie) {
            set({ kuwoUser: createKuwoUser() });
          }

          // 5. 汽水音乐状态
          const qishuiRes = await fetch(`${API_BASE}/api/qishui/status`);
          if (qishuiRes.ok) {
            set({ qishuiUser: mapQishuiUser(await qishuiRes.json()) });
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

          const createRes = await fetch(
            `${API_BASE}/api/login/qr/create?key=${encodeURIComponent(unikey)}&timestamp=${Date.now()}`
          );
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
          const res = await fetch(
            `${API_BASE}/api/login/qr/check?key=${encodeURIComponent(qrKey)}&timestamp=${Date.now()}`
          );
          if (!res.ok) return { code: 500, message: "网络异常" };
          const data = await res.json();
          const code =
            data.code ||
            (data.status === "AUTHORIZED" ? 803 : data.status === "EXPIRED" ? 800 : 801);

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

          return {
            code,
            message:
              data.message ||
              (code === 803 ? "授权成功" : code === 802 ? "待在手机上确认" : "等待扫码"),
          };
        } catch (_e) {
          return { code: 500, message: "检查状态失败" };
        }
      },

      stopQrPolling: () => {
        set({ isPollingQr: false });
      },

      loginWithCookie: async (platform, cookie) => {
        if (!cookie.trim()) return false;

        try {
          if (platform === "kuwo") {
            set({
              kuwoCookie: cookie.trim(),
              kuwoUser: createKuwoUser(),
            });
            return true;
          }

          const res = await fetch(resolveLoginCookieUrl(platform), {
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
          await fetch(resolveLogoutUrl(platform), { method: "POST" }).catch(() => {});
        } catch {
          // 登录态上报失败不影响本地会话
        }

        if (platform === "netease")
          set({ neteaseCookie: "", neteaseUser: defaultUserProfile, userPlaylists: [] });
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
          set({ userPlaylists: mapCloudPlaylists(data), isLoadingPlaylists: false });
        } catch (e) {
          console.warn("[userAccountStore] fetchUserPlaylists error:", e);
          set({ isLoadingPlaylists: false });
        }
      },

      fetchPlaylistTracks: async (playlistId, source = "netease", offset = 0, limit = 100) => {
        const { neteaseCookie } = get();
        set({ isLoadingTracks: true });

        try {
          const res = await fetch(resolvePlaylistTracksUrl(playlistId, source, offset, limit), {
            headers: {
              "x-netease-cookie": neteaseCookie,
            },
          });

          if (!res.ok) {
            set({ isLoadingTracks: false });
            return [];
          }
          const data = await res.json();
          const songs = mapPlaylistSongs(data.songs || data.tracks || [], source);

          const hasMore = Boolean(data.hasMore);
          const total = data.trackCount || offset + songs.length;
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

      fetchAllPlaylistTracks: async (playlistId, source = "netease") => {
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
        const {
          activePlaylistId,
          activePlaylistSource,
          activePlaylistSongs,
          isLoadingTracks,
          hasMoreTracks,
        } = get();
        if (!activePlaylistId || isLoadingTracks || !hasMoreTracks) return [];
        return get().fetchPlaylistTracks(
          activePlaylistId,
          activePlaylistSource,
          activePlaylistSongs.length,
          100
        );
      },
    }),
    {
      skipHydration: true,
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

export function handlePlatformSessionExpired(
  platform: PlatformType | string,
  reason?: string
): void {
  useUserAccountStore.getState().handlePlatformSessionExpired(platform, reason);
}
