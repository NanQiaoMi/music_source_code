/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  QrCode,
  KeyRound,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  LogOut,
  Sparkles,
  Music,
  Heart,
  ListMusic,
  ShieldCheck,
  Crown,
  Radio,
  ExternalLink,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import Image from "next/image";
import { useUserAccountStore, PlatformType } from "@/store/userAccountStore";
import { useAudioStore } from "@/store/audioStore";
import { useQueueStore } from "@/store/queueStore";
import { usePlaylistStore } from "@/store/playlistStore";
import { useIntegratedAudioPipeline } from "@/lib/audio/useIntegratedAudioPipeline";

interface MultiPlatformAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MultiPlatformAccountModal: React.FC<MultiPlatformAccountModalProps> = ({
  isOpen,
  onClose,
}) => {
  const {
    activePlatform,
    setActivePlatform,
    neteaseUser,
    qqUser,
    kugouUser,
    qishuiUser,
    userPlaylists,
    isLoadingPlaylists,
    qrImg,
    qrStatus,
    qrCountdown,
    qrError,
    isPollingQr,
    fetchLoginStatus,
    generateNeteaseQr,
    checkNeteaseQr,
    stopQrPolling,
    loginWithCookie,
    logout,
    fetchUserPlaylists,
    fetchPlaylistTracks,
  } = useUserAccountStore();

  const [cookieInput, setCookieInput] = useState("");
  const [showCookieDrawer, setShowCookieDrawer] = useState(false);
  const [cookieSubmitting, setCookieSubmitting] = useState(false);
  const [cookieError, setCookieError] = useState<string | null>(null);

  const { playTrackWithPipeline } = useIntegratedAudioPipeline();
  const setQueue = useQueueStore((state) => state.setQueue);

  // 轮询定时器 ref
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 挂载时刷新登录状态
  useEffect(() => {
    if (isOpen) {
      fetchLoginStatus();
    }
  }, [isOpen, fetchLoginStatus]);

  // 当切换到网易云且未登录时，自动生成二维码并开始轮询
  useEffect(() => {
    if (!isOpen) {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
      stopQrPolling();
      return;
    }

    if (activePlatform === "netease" && !neteaseUser.loggedIn) {
      generateNeteaseQr();
    }
  }, [isOpen, activePlatform, neteaseUser.loggedIn, generateNeteaseQr, stopQrPolling]);

  // 二维码轮询与倒计时
  useEffect(() => {
    if (!isPollingQr || !isOpen || activePlatform !== "netease" || neteaseUser.loggedIn) {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
      return;
    }

    // 倒计时
    countdownTimerRef.current = setInterval(() => {
      useUserAccountStore.setState((state) => {
        if (state.qrCountdown <= 1) {
          clearInterval(countdownTimerRef.current!);
          clearInterval(pollTimerRef.current!);
          return { qrCountdown: 0, qrStatus: 800, isPollingQr: false };
        }
        return { qrCountdown: state.qrCountdown - 1 };
      });
    }, 1000);

    // 轮询检查扫码状态 (每 2 秒一次)
    pollTimerRef.current = setInterval(async () => {
      const res = await checkNeteaseQr();
      if (res.code === 803) {
        clearInterval(pollTimerRef.current!);
        clearInterval(countdownTimerRef.current!);
      }
    }, 2000);

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    };
  }, [isPollingQr, isOpen, activePlatform, neteaseUser.loggedIn, checkNeteaseQr]);

  const handleCookieSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cookieInput.trim()) return;

    setCookieSubmitting(true);
    setCookieError(null);

    const success = await loginWithCookie(activePlatform, cookieInput.trim());
    setCookieSubmitting(false);

    if (success) {
      setCookieInput("");
      setShowCookieDrawer(false);
    } else {
      setCookieError("Cookie 无效或已过期，请检查后重试");
    }
  };

  const handlePlayEntirePlaylist = async (playlist: any) => {
    const initialSongs = await fetchPlaylistTracks(playlist.id, playlist.source, 0, 100);
    if (initialSongs.length > 0) {
      setQueue(initialSongs);
      useAudioStore.getState().playQueue(initialSongs, 0);
      usePlaylistStore.getState().importSongs(initialSongs);
      playTrackWithPipeline(initialSongs[0]);
      onClose();

      // 如果歌单曲目总数大于 100 首，在后台无感分批懒加载后续曲目
      const total = playlist.trackCount || 100;
      if (total > 100) {
        (async () => {
          let currentOffset = 100;
          while (currentOffset < total) {
            await new Promise((resolve) => setTimeout(resolve, 600));
            const nextBatch = await fetchPlaylistTracks(playlist.id, playlist.source, currentOffset, 100);
            if (!nextBatch || nextBatch.length === 0) break;

            const updatedQueue = [...useQueueStore.getState().queue, ...nextBatch];
            useQueueStore.getState().setQueue(updatedQueue);
            useAudioStore.setState({ queue: updatedQueue });
            usePlaylistStore.getState().importSongs(nextBatch);
            currentOffset += nextBatch.length;
          }
        })().catch(() => {});
      }
    }
  };

  if (!isOpen) return null;

  const currentPlatformUser =
    activePlatform === "netease"
      ? neteaseUser
      : activePlatform === "qq"
      ? qqUser
      : activePlatform === "kugou"
      ? kugouUser
      : qishuiUser;

  const platformMeta = {
    netease: {
      name: "网易云音乐",
      color: "from-red-500 to-rose-600",
      badge: "NETEASE",
      accent: "#e60026",
    },
    qq: {
      name: "QQ 音乐",
      color: "from-emerald-500 to-teal-600",
      badge: "TENCENT",
      accent: "#10b981",
    },
    kugou: {
      name: "酷狗音乐",
      color: "from-blue-500 to-cyan-600",
      badge: "KUGOU",
      accent: "#0071e3",
    },
    qishui: {
      name: "汽水音乐",
      color: "from-purple-500 to-indigo-600",
      badge: "QISHUI",
      accent: "#8b5cf6",
    },
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 md:p-8 bg-black/75 backdrop-blur-md select-none font-sans antialiased">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        transition={{ type: "spring", stiffness: 350, damping: 30, mass: 0.8 }}
        className="relative w-full max-w-[720px] bg-[#1c1c1e]/95 rounded-[28px] shadow-[0_32px_96px_rgba(0,0,0,0.7)] border border-white/[0.08] overflow-hidden flex flex-col max-h-[88vh] text-[#f5f5f7]"
      >
        {/* 顶部标题栏 (Apple Spacious Header) */}
        <div className="flex items-center justify-between px-8 py-6 border-b border-white/[0.06] bg-white/[0.02]">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#0071e3] to-[#2997ff] flex items-center justify-center text-white shadow-md shadow-[#0071e3]/30">
              <Crown className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-[18px] font-semibold text-white tracking-[-0.02em] leading-tight">
                多平台账号与云端资产
              </h3>
              <p className="text-[13px] text-[#86868b] mt-1 tracking-tight">
                网易云扫码秒登 · 个人歌单全量同步 · VIP 无损母带解锁
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭"
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white/70 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 平台切换 Squircle 药丸栏 (4 Platform Pills) */}
        <div className="px-8 pt-4 pb-1">
          <div className="grid grid-cols-4 gap-2.5 p-1.5 rounded-2xl bg-white/[0.04] border border-white/[0.04]">
            {(["netease", "qq", "kugou", "qishui"] as PlatformType[]).map((p) => {
              const meta = platformMeta[p];
              const isSelected = activePlatform === p;
              const isLogged =
                p === "netease"
                  ? neteaseUser.loggedIn
                  : p === "qq"
                  ? qqUser.loggedIn
                  : p === "kugou"
                  ? kugouUser.loggedIn
                  : qishuiUser.loggedIn;

              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => setActivePlatform(p)}
                  className={`relative p-2.5 rounded-xl text-left transition-all ${
                    isSelected
                      ? "bg-white/15 border border-white/10 shadow-sm"
                      : "hover:bg-white/5 border border-transparent"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div
                      className={`w-3 h-3 rounded-full bg-gradient-to-br ${meta.color} shadow-sm`}
                    />
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        isLogged ? "bg-[#34c759] animate-pulse" : "bg-white/20"
                      }`}
                    />
                  </div>
                  <div className="text-[13px] font-medium text-white mt-1.5 tracking-tight truncate">
                    {meta.name}
                  </div>
                  <div className="text-[10px] text-[#86868b] font-mono mt-0.5 truncate">
                    {isLogged ? "已连接" : "未登录"}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 主体滚动区 */}
        <div className="px-8 py-6 overflow-y-auto space-y-6 flex-1 text-left">
          {/* 已登录状态看板 */}
          {currentPlatformUser.loggedIn ? (
            <div className="space-y-6">
              {/* 用户信息卡片 (Apple ID Inset Group) */}
              <div className="p-6 rounded-[24px] bg-white/[0.04] border border-white/[0.06] flex items-center justify-between gap-5">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="relative w-14 h-14 rounded-full overflow-hidden bg-white/10 border-2 border-[#0071e3] shrink-0 shadow-md">
                    {currentPlatformUser.avatarUrl ? (
                      <Image
                        src={currentPlatformUser.avatarUrl}
                        alt="Avatar"
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white font-bold text-[18px]">
                        {currentPlatformUser.nickname?.slice(0, 1) || "U"}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="text-[17px] font-semibold text-white truncate tracking-tight">
                        {currentPlatformUser.nickname || "已登录用户"}
                      </h4>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        {currentPlatformUser.vipLabel || "VIP 会员"}
                      </span>
                    </div>
                    <p className="text-[12px] text-[#86868b] mt-1 font-mono">
                      {platformMeta[activePlatform].name} · 会话正常保持中
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => fetchUserPlaylists()}
                    className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
                    title="刷新歌单"
                  >
                    <RefreshCw
                      className={`w-4 h-4 ${isLoadingPlaylists ? "animate-spin" : ""}`}
                    />
                  </button>
                  <button
                    type="button"
                    onClick={() => logout(activePlatform)}
                    className="px-4 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 text-[12px] font-medium transition-colors flex items-center gap-1.5"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    退出
                  </button>
                </div>
              </div>

              {/* 云端歌单预览列表 */}
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <span className="text-[12px] font-semibold text-[#86868b] uppercase tracking-wider">
                    已同步云端歌单 ({userPlaylists.length})
                  </span>
                  {isLoadingPlaylists && (
                    <span className="text-[12px] text-[#2997ff] animate-pulse">
                      正在获取歌单...
                    </span>
                  )}
                </div>

                {userPlaylists.length === 0 ? (
                  <div className="p-8 rounded-[22px] bg-white/[0.02] border border-white/[0.04] text-center text-[13px] text-[#86868b]">
                    暂未拉取到歌单，点击上方刷新按钮重新获取
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-1">
                    {userPlaylists.map((pl) => (
                      <div
                        key={pl.id}
                        onClick={() => handlePlayEntirePlaylist(pl)}
                        className="p-3.5 rounded-[18px] bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.05] flex items-center gap-3.5 cursor-pointer transition-colors group"
                      >
                        <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-white/10 shrink-0">
                          <Image
                            src={pl.coverImgUrl}
                            alt={pl.name}
                            fill
                            className="object-cover"
                          />
                          {pl.isHeart && (
                            <div className="absolute inset-0 bg-rose-600/60 flex items-center justify-center text-white">
                              <Heart className="w-5 h-5 fill-white" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-[13px] font-medium text-white truncate tracking-tight group-hover:text-[#2997ff] transition-colors">
                            {pl.name}
                          </div>
                          <div className="text-[11px] text-[#86868b] font-mono mt-0.5">
                            {pl.trackCount} 首歌曲 · 点击即播
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-white/30 group-hover:text-white group-hover:translate-x-0.5 transition-all shrink-0" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* 未登录状态：扫码 / Cookie 登录 */
            <div className="space-y-6">
              {activePlatform === "netease" ? (
                /* 网易云动态扫码视窗 */
                <div className="flex flex-col items-center justify-center p-7 rounded-[24px] bg-white/[0.03] border border-white/[0.06] text-center space-y-4">
                  <div className="relative p-3 rounded-2xl bg-white shadow-xl">
                    {qrImg ? (
                      <div className="relative w-44 h-44">
                        <Image src={qrImg} alt="NetEase QR Code" fill className="object-contain" unoptimized />
                        {/* 过期遮罩 */}
                        {qrStatus === 800 && (
                          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm rounded-xl flex flex-col items-center justify-center text-white gap-2 p-2">
                            <AlertCircle className="w-6 h-6 text-amber-400" />
                            <span className="text-[12px] font-medium">二维码已失效</span>
                            <button
                              type="button"
                              onClick={() => generateNeteaseQr()}
                              className="px-3 py-1 rounded-full bg-[#0071e3] text-[11px] font-semibold"
                            >
                              点击刷新
                            </button>
                          </div>
                        )}
                        {/* 待确认遮罩 */}
                        {qrStatus === 802 && (
                          <div className="absolute inset-0 bg-[#0071e3]/85 backdrop-blur-sm rounded-xl flex flex-col items-center justify-center text-white gap-2 p-2 animate-pulse">
                            <CheckCircle2 className="w-7 h-7 text-white" />
                            <span className="text-[13px] font-semibold">请在手机上点击确认</span>
                          </div>
                        )}
                      </div>
                    ) : qrError ? (
                      <div className="w-44 h-44 flex flex-col items-center justify-center p-3 text-center gap-2">
                        <AlertCircle className="w-6 h-6 text-rose-400" />
                        <span className="text-[11px] text-zinc-700 font-medium">{qrError}</span>
                        <button
                          type="button"
                          onClick={() => generateNeteaseQr()}
                          className="px-3 py-1 rounded-full bg-[#0071e3] text-white text-[11px] font-semibold shadow-sm hover:bg-[#0077ed]"
                        >
                          点击重试
                        </button>
                      </div>
                    ) : (
                      <div className="w-44 h-44 flex flex-col items-center justify-center gap-2">
                        <RefreshCw className="w-6 h-6 text-black/40 animate-spin" />
                        <span className="text-[11px] text-black/40 font-mono">正在生成二维码...</span>
                      </div>
                    )}
                  </div>

                  <div>
                    <h4 className="text-[15px] font-semibold text-white tracking-tight">
                      使用网易云音乐 App 扫一扫
                    </h4>
                    <p className="text-[12px] text-[#86868b] mt-1">
                      {qrStatus === 802
                        ? "扫描成功，请在手机端授权登录"
                        : `二维码有效期剩余 ${qrCountdown} 秒 · 支持 VIP 高清母带权限`}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => generateNeteaseQr()}
                      className="flex items-center gap-1.5 text-[13px] text-[#2997ff] hover:underline"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      刷新二维码
                    </button>
                    <span className="text-white/20">|</span>
                    <button
                      type="button"
                      onClick={() => setShowCookieDrawer(!showCookieDrawer)}
                      className="flex items-center gap-1.5 text-[13px] text-[#86868b] hover:text-white"
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                      Cookie 快捷导入
                    </button>
                  </div>
                </div>
              ) : (
                /* 其他平台 (QQ/酷狗/汽水) Cookie 导入提示 */
                <div className="p-7 rounded-[24px] bg-white/[0.03] border border-white/[0.06] text-center space-y-4">
                  <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-white mx-auto">
                    <KeyRound className="w-6 h-6 text-[#2997ff]" />
                  </div>
                  <div>
                    <h4 className="text-[16px] font-semibold text-white tracking-tight">
                      {platformMeta[activePlatform].name} 凭证导入
                    </h4>
                    <p className="text-[13px] text-[#86868b] mt-1 max-w-md mx-auto">
                      粘贴您的 {platformMeta[activePlatform].name} 网页端 Cookie 即可同步个人歌单与 VIP
                      母带解析
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowCookieDrawer(true)}
                    className="px-6 py-2.5 rounded-full bg-[#0071e3] hover:bg-[#0077ed] text-white text-[13px] font-medium tracking-tight shadow-md"
                  >
                    输入 Cookie 凭证
                  </button>
                </div>
              )}

              {/* Cookie 抽屉表单 */}
              <AnimatePresence>
                {showCookieDrawer && (
                  <motion.form
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    onSubmit={handleCookieSubmit}
                    className="p-5 rounded-[22px] bg-white/[0.04] border border-white/[0.06] space-y-3 overflow-hidden"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] font-semibold text-[#86868b] uppercase tracking-wider">
                        粘贴 {platformMeta[activePlatform].name} Cookie
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowCookieDrawer(false)}
                        className="text-[12px] text-[#86868b] hover:text-white"
                      >
                        收起
                      </button>
                    </div>
                    <textarea
                      value={cookieInput}
                      onChange={(e) => setCookieInput(e.target.value)}
                      placeholder={
                        activePlatform === "netease"
                          ? "MUSIC_U=xxx; __csrf=xxx..."
                          : "uin=xxx; qm_keyst=xxx..."
                      }
                      rows={3}
                      className="w-full p-3 rounded-xl bg-black/40 border border-white/10 text-[12px] text-white font-mono focus:outline-none focus:border-[#0071e3]"
                    />
                    {cookieError && (
                      <p className="text-[12px] text-rose-400">{cookieError}</p>
                    )}
                    <button
                      type="submit"
                      disabled={cookieSubmitting || !cookieInput.trim()}
                      className="w-full py-2.5 rounded-xl bg-[#0071e3] hover:bg-[#0077ed] disabled:opacity-50 text-white text-[13px] font-semibold tracking-tight transition-colors"
                    >
                      {cookieSubmitting ? "正在验证..." : "确认登录并同步"}
                    </button>
                  </motion.form>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* 底部关闭栏 (Apple Spacious Footer) */}
        <div className="px-8 py-5 border-t border-white/[0.06] bg-white/[0.02] flex items-center justify-between">
          <span className="text-[12px] text-[#86868b]">
            安全提示：凭证仅保存在本地沙盒，绝不上报第三方
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-7 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white text-[14px] font-medium tracking-tight transition-colors"
          >
            关闭
          </button>
        </div>
      </motion.div>
    </div>
  );
};
