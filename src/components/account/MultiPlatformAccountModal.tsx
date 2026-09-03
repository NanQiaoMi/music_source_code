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
  Play,
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
    kuwoUser,
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
      : activePlatform === "kuwo"
      ? kuwoUser
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
    kuwo: {
      name: "酷我音乐",
      color: "fro  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 md:p-7 bg-black/80 backdrop-blur-xl select-none font-sans antialiased overflow-hidden">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 14 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 14 }}
        transition={{ type: "spring", stiffness: 360, damping: 32, mass: 0.8 }}
        className="relative w-full max-w-[760px] bg-[#0c0d14]/92 rounded-[32px] shadow-[0_32px_120px_rgba(0,0,0,0.85),inset_0_1px_0_rgba(255,255,255,0.15)] border border-white/[0.12] backdrop-blur-3xl overflow-hidden flex flex-col max-h-[90vh] text-[#f5f5f7] transform-gpu will-change-transform"
      >
        {/* 顶部环境光与平台强调漫反射 */}
        <div className="absolute top-0 inset-x-0 h-48 overflow-hidden pointer-events-none z-0">
          <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[540px] h-[280px] bg-gradient-to-b from-white/[0.08] via-white/[0.02] to-transparent blur-3xl rounded-full" />
          <div
            className="absolute -top-20 left-1/2 -translate-x-1/2 w-[460px] h-[220px] blur-[90px] rounded-full transition-all duration-700 opacity-30"
            style={{ backgroundColor: platformMeta[activePlatform].accent }}
          />
        </div>

        {/* 顶部标题栏 (Apple Liquid Glass Header) */}
        <div className="relative z-10 flex items-center justify-between px-7 pt-6 pb-5 border-b border-white/[0.08] bg-black/20 backdrop-blur-2xl shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="relative w-11 h-11 rounded-2xl bg-gradient-to-br from-white/[0.12] to-white/[0.04] border border-white/[0.16] flex items-center justify-center text-white shadow-[0_4px_20px_rgba(0,0,0,0.3)] shrink-0">
              <Crown className="w-5 h-5 text-amber-300 drop-shadow-[0_2px_8px_rgba(245,158,11,0.5)]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-[18px] font-bold text-white tracking-tight">
                  多平台账号与云端资产
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white/[0.08] text-white/70 border border-white/[0.12] shadow-sm">
                  云端直连
                </span>
              </div>
              <p className="text-[12.5px] text-white/50 mt-0.5 tracking-tight">
                网易云扫码秒登 · 个人歌单全量同步 · VIP 无损母带解锁
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭"
            className="w-8 h-8 rounded-full bg-white/[0.06] hover:bg-white/[0.14] border border-white/[0.08] text-white/60 hover:text-white flex items-center justify-center transition-all active:scale-95 shadow-sm"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 平台切换 Segmented 胶囊栏 (5 Platform Floating Pills) */}
        <div className="relative z-10 px-7 pt-4 pb-2 shrink-0">
          <div className="grid grid-cols-5 gap-2 p-1.5 rounded-2xl bg-black/35 border border-white/[0.08] backdrop-blur-2xl">
            {(["netease", "qq", "kugou", "kuwo", "qishui"] as PlatformType[]).map((p) => {
              const meta = platformMeta[p];
              const isSelected = activePlatform === p;
              const isLogged =
                p === "netease"
                  ? neteaseUser.loggedIn
                  : p === "qq"
                  ? qqUser.loggedIn
                  : p === "kugou"
                  ? kugouUser.loggedIn
                  : p === "kuwo"
                  ? kuwoUser.loggedIn
                  : qishuiUser.loggedIn;

              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => setActivePlatform(p)}
                  className={`group relative p-2.5 rounded-xl text-left transition-all duration-200 cursor-pointer select-none ${
                    isSelected
                      ? "bg-white/[0.12] border border-white/[0.20] shadow-[0_4px_20px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.22)] scale-[1.01]"
                      : "hover:bg-white/[0.05] border border-transparent hover:border-white/[0.06]"
                  }`}
                >
                  {/* 激活时的品牌下微光 */}
                  {isSelected && (
                    <div
                      className="absolute inset-x-2 bottom-0 h-[1.5px] rounded-full blur-[1px]"
                      style={{ backgroundColor: meta.accent }}
                    />
                  )}

                  <div className="flex items-center justify-between">
                    <div
                      className={`w-2.5 h-2.5 rounded-full bg-gradient-to-br ${meta.color} shadow-[0_0_6px_rgba(255,255,255,0.2)]`}
                    />
                    <span
                      className={`w-1.5 h-1.5 rounded-full transition-all ${
                        isLogged
                          ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)] animate-pulse"
                          : "bg-white/20"
                      }`}
                    />
                  </div>
                  <div className="text-[12.5px] font-semibold text-white mt-1.5 tracking-tight truncate group-hover:text-white">
                    {meta.name}
                  </div>
                  <div
                    className={`text-[10px] font-mono mt-0.5 truncate transition-colors ${
                      isLogged ? "text-emerald-400/90 font-medium" : "text-white/40"
                    }`}
                  >
                    {isLogged ? "已连接" : "未登录"}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 主体滚动区 */}
        <div className="relative z-10 px-7 py-5 overflow-y-auto space-y-5 flex-1 text-left custom-scrollbar [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/20 hover:[&::-webkit-scrollbar-thumb]:bg-white/35 [&::-webkit-scrollbar-track]:bg-transparent">
          {/* 已登录状态看板 */}
          {currentPlatformUser.loggedIn ? (
            <div className="space-y-5">
              {/* 用户信息卡片 (Apple ID Inset Glass Card) */}
              <div className="relative overflow-hidden p-5 rounded-[26px] bg-gradient-to-b from-white/[0.07] to-white/[0.02] border border-white/[0.12] shadow-[0_8px_32px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.15)] flex items-center justify-between gap-4 backdrop-blur-2xl">
                {/* 装饰背光 */}
                <div
                  className="absolute -left-12 -top-12 w-48 h-48 rounded-full blur-3xl opacity-20 pointer-events-none"
                  style={{ backgroundColor: platformMeta[activePlatform].accent }}
                />

                <div className="flex items-center gap-4 min-w-0 z-10">
                  <div className="relative w-14 h-14 rounded-full p-[2px] bg-gradient-to-tr from-amber-300 via-amber-500 to-amber-200 shadow-[0_0_18px_rgba(245,158,11,0.35)] shrink-0">
                    <div className="relative w-full h-full rounded-full overflow-hidden bg-white/10">
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
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="text-[17px] font-bold text-white truncate tracking-tight">
                        {currentPlatformUser.nickname || "已登录用户"}
                      </h4>
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-gradient-to-r from-amber-400/25 via-amber-300/35 to-amber-500/25 text-amber-200 border border-amber-400/40 shadow-[0_0_12px_rgba(251,191,36,0.25)]">
                        <Sparkles className="w-2.5 h-2.5 text-amber-300" />
                        <span>{currentPlatformUser.vipLabel || "黑胶 SVIP"}</span>
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11.5px] text-white/55 font-mono mt-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
                      <span>{platformMeta[activePlatform].name} · 会话正常保持中</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 z-10">
                  <button
                    type="button"
                    onClick={() => fetchUserPlaylists()}
                    className="w-9 h-9 rounded-xl bg-white/[0.06] hover:bg-white/[0.14] border border-white/[0.1] text-white/70 hover:text-white flex items-center justify-center transition-all active:scale-95 shadow-sm"
                    title="刷新歌单"
                  >
                    <RefreshCw
                      className={`w-4 h-4 ${isLoadingPlaylists ? "animate-spin" : ""}`}
                    />
                  </button>
                  <button
                    type="button"
                    onClick={() => logout(activePlatform)}
                    className="px-3.5 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 hover:text-rose-200 border border-rose-500/25 text-[12px] font-medium transition-all active:scale-95 flex items-center gap-1.5 shadow-sm"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>退出</span>
                  </button>
                </div>
              </div>

              {/* 云端歌单预览列表 */}
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <ListMusic className="w-4 h-4 text-white/60" />
                    <span className="text-[13px] font-semibold text-white/85 tracking-tight">
                      已同步云端歌单
                    </span>
                    <span className="px-2 py-0.2 rounded-full text-[10.5px] font-mono bg-white/[0.08] text-white/70 border border-white/[0.1]">
                      {userPlaylists.length}
                    </span>
                  </div>
                  {isLoadingPlaylists && (
                    <span className="flex items-center gap-1.5 text-[11.5px] text-[#2997ff] animate-pulse">
                      <RefreshCw className="w-3 h-3 animate-spin" />
                      <span>正在同步歌单...</span>
                    </span>
                  )}
                </div>

                {userPlaylists.length === 0 ? (
                  <div className="p-8 rounded-[24px] bg-white/[0.02] border border-white/[0.05] text-center text-[13px] text-white/40">
                    暂未拉取到歌单，点击上方刷新按钮重新获取
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[340px] overflow-y-auto pr-1.5 custom-scrollbar [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/20 hover:[&::-webkit-scrollbar-thumb]:bg-white/35 [&::-webkit-scrollbar-track]:bg-transparent">
                    {userPlaylists.map((pl) => (
                      <div
                        key={pl.id}
                        onClick={() => handlePlayEntirePlaylist(pl)}
                        className="group relative p-3 rounded-2xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.06] hover:border-white/[0.16] shadow-[0_4px_16px_rgba(0,0,0,0.2)] hover:shadow-[0_8px_28px_rgba(0,0,0,0.4)] transition-all duration-200 flex items-center gap-3.5 cursor-pointer backdrop-blur-xl overflow-hidden hover:-translate-y-0.5 active:scale-[0.99]"
                      >
                        {/* 歌单封面与播放悬浮浮层 */}
                        <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-black/40 border border-white/10 shrink-0 shadow-md group-hover:shadow-lg transition-all">
                          {pl.isHeart ? (
                            <div className="w-full h-full bg-gradient-to-br from-rose-500 via-rose-600 to-red-600 shadow-[0_0_16px_rgba(225,29,72,0.4)] flex items-center justify-center text-white">
                              <Heart className="w-5 h-5 fill-white drop-shadow-md" />
                            </div>
                          ) : (
                            <>
                              <Image
                                src={pl.coverImgUrl}
                                alt={pl.name}
                                fill
                                className="object-cover"
                              />
                              <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity duration-200">
                                <Play className="w-4 h-4 text-white fill-white ml-0.5 drop-shadow" />
                              </div>
                            </>
                          )}
                        </div>

                        {/* 歌单标题与曲目总数 */}
                        <div className="min-w-0 flex-1">
                          <div className="text-[13px] font-semibold text-white/90 group-hover:text-white truncate tracking-tight transition-colors">
                            {pl.name}
                          </div>
                          <div className="text-[11px] text-white/45 font-mono mt-0.5 flex items-center gap-1.5">
                            <span>{pl.trackCount} 首歌曲</span>
                            <span className="w-1 h-1 rounded-full bg-white/20" />
                            <span className="text-white/40 group-hover:text-white/70 transition-colors">
                              点击即播
                            </span>
                          </div>
                        </div>

                        {/* 右侧交互指示箭头 */}
                        <ChevronRight className="w-4 h-4 text-white/25 group-hover:text-white group-hover:translate-x-0.5 transition-all shrink-0" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* 未登录状态：扫码 / Cookie 登录 */
            <div className="space-y-5">
              {activePlatform === "netease" ? (
                /* 网易云动态扫码视窗 */
                <div className="flex flex-col items-center justify-center p-7 rounded-[28px] bg-white/[0.03] border border-white/[0.08] text-center space-y-4 shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
                  <div className="relative p-3.5 rounded-2xl bg-white shadow-2xl">
                    {qrImg ? (
                      <div className="relative w-44 h-44">
                        <Image
                          src={qrImg}
                          alt="NetEase QR Code"
                          fill
                          className="object-contain"
                          unoptimized
                        />
                        {/* 过期遮罩 */}
                        {qrStatus === 800 && (
                          <div className="absolute inset-0 bg-black/85 backdrop-blur-sm rounded-xl flex flex-col items-center justify-center text-white gap-2 p-2">
                            <AlertCircle className="w-6 h-6 text-amber-400" />
                            <span className="text-[12px] font-medium">二维码已失效</span>
                            <button
                              type="button"
                              onClick={() => generateNeteaseQr()}
                              className="px-3 py-1 rounded-full bg-[#0071e3] hover:bg-[#0077ed] text-white text-[11px] font-semibold transition-colors"
                            >
                              点击刷新
                            </button>
                          </div>
                        )}
                        {/* 待确认遮罩 */}
                        {qrStatus === 802 && (
                          <div className="absolute inset-0 bg-[#0071e3]/90 backdrop-blur-sm rounded-xl flex flex-col items-center justify-center text-white gap-2 p-2 animate-pulse">
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
                        <span className="text-[11px] text-black/40 font-mono">
                          正在生成二维码...
                        </span>
                      </div>
                    )}
                  </div>

                  <div>
                    <h4 className="text-[15.5px] font-semibold text-white tracking-tight">
                      使用网易云音乐 App 扫一扫
                    </h4>
                    <p className="text-[12px] text-white/50 mt-1">
                      {qrStatus === 802
                        ? "扫描成功，请在手机端授权登录"
                        : `二维码有效期剩余 ${qrCountdown} 秒 · 支持 VIP 高清母带权限`}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => generateNeteaseQr()}
                      className="flex items-center gap-1.5 text-[12.5px] text-[#2997ff] hover:text-[#52adff] transition-colors"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>刷新二维码</span>
                    </button>
                    <span className="text-white/20">|</span>
                    <button
                      type="button"
                      onClick={() => setShowCookieDrawer(!showCookieDrawer)}
                      className="flex items-center gap-1.5 text-[12.5px] text-white/50 hover:text-white transition-colors"
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                      <span>Cookie 快捷导入</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* 其他平台 (QQ/酷狗/酷我/汽水) Cookie 导入提示 */
                <div className="p-8 rounded-[28px] bg-white/[0.03] border border-white/[0.08] text-center space-y-4 shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
                  <div className="w-13 h-13 rounded-2xl bg-white/[0.08] border border-white/[0.12] flex items-center justify-center text-white mx-auto shadow-sm">
                    <KeyRound className="w-6 h-6 text-[#2997ff]" />
                  </div>
                  <div>
                    <h4 className="text-[16px] font-semibold text-white tracking-tight">
                      {platformMeta[activePlatform].name} 凭证导入
                    </h4>
                    <p className="text-[12.5px] text-white/50 mt-1 max-w-md mx-auto leading-relaxed">
                      粘贴您的 {platformMeta[activePlatform].name} 网页端 Cookie 即可同步个人歌单与
                      VIP 母带解析
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowCookieDrawer(true)}
                    className="px-6 py-2.5 rounded-full bg-[#0071e3] hover:bg-[#0077ed] text-white text-[13px] font-semibold tracking-tight shadow-md transition-all active:scale-95"
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
                    className="p-5 rounded-[24px] bg-white/[0.04] border border-white/[0.08] space-y-3 overflow-hidden shadow-xl backdrop-blur-xl"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] font-semibold text-white/60 uppercase tracking-wider">
                        粘贴 {platformMeta[activePlatform].name} Cookie
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowCookieDrawer(false)}
                        className="text-[12px] text-white/40 hover:text-white transition-colors"
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
                          : activePlatform === "qq"
                          ? "uin=xxx; qm_keyst=xxx..."
                          : activePlatform === "kugou"
                          ? "KuGou=xxx; kg_mid=xxx..."
                          : activePlatform === "kuwo"
                          ? "kw_token=xxx; Hm_lvt_xxx..."
                          : "session_id=xxx; token=xxx..."
                      }
                      rows={3}
                      className="w-full p-3 rounded-xl bg-black/40 border border-white/10 text-[12px] text-white font-mono focus:outline-none focus:border-[#0071e3] transition-colors"
                    />
                    {cookieError && (
                      <p className="text-[12px] text-rose-400 font-medium">{cookieError}</p>
                    )}
                    <button
                      type="submit"
                      disabled={cookieSubmitting || !cookieInput.trim()}
                      className="w-full py-2.5 rounded-xl bg-[#0071e3] hover:bg-[#0077ed] disabled:opacity-50 text-white text-[13px] font-semibold tracking-tight transition-all active:scale-95 shadow-md"
                    >
                      {cookieSubmitting ? "正在验证..." : "确认登录并同步"}
                    </button>
                  </motion.form>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* 底部关闭栏 (Apple Spacious Liquid Glass Footer) */}
        <div className="relative z-10 px-7 py-4.5 border-t border-white/[0.08] bg-black/25 backdrop-blur-2xl flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-[12px] text-white/50">
            <ShieldCheck className="w-4 h-4 text-emerald-400/90 shrink-0 shadow-[0_0_8px_rgba(52,211,153,0.3)]" />
            <span>安全提示：凭据仅保存在本地沙盒，绝不上报第三方</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 rounded-full bg-white/[0.08] hover:bg-white/[0.16] border border-white/[0.12] hover:border-white/[0.22] text-white text-[13px] font-medium tracking-tight transition-all active:scale-95 shadow-sm"
          >
            关闭
          </button>
        </div>
      </motion.div>
    </div>
  );                {cookieSubmitting ? "正在验证..." : "确认登录并同步"}
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
