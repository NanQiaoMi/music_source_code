/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React from "react";
import { motion } from "framer-motion";
import { Crown, Plus, Radio, Sparkles } from "lucide-react";
import Image from "next/image";
import { useUIStore } from "@/store/uiStore";
import { usePlaylistStore } from "@/store/playlistStore";
import { useUserAccountStore } from "@/store/userAccountStore";
import { useSourceConfigStore } from "@/store/sourceConfigStore";

import { Logo } from "@/components/layout/Logo";
import { AppleUnifiedNavIsland } from "@/components/layout/AppleUnifiedNavIsland";

export function HeaderToolbar() {
  const { currentView, openPanel } = useUIStore();
  const { songs } = usePlaylistStore();
  const { neteaseUser } = useUserAccountStore();
  const { openManagementModal } = useSourceConfigStore();

  return (
    <motion.header
      initial={{ opacity: 0, y: -8 }}
      animate={{
        opacity: currentView === "home" ? 1 : 0,
        y: currentView === "home" ? 0 : -8,
      }}
      transition={{ duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
      className="absolute top-0 left-0 right-0 z-50 pt-3 pb-3 px-4 md:px-6 select-none font-sans antialiased pointer-events-none"
      style={{ willChange: "transform, opacity" }}
    >
      <div className="relative flex items-center justify-between max-w-[1800px] mx-auto w-full min-h-[44px] pointer-events-auto">
        {/* 左侧栏: Apple 磨砂高光 Logo 徽标胶囊 */}
        <div className="flex items-center justify-start shrink-0 min-w-0 z-10">
          <div className="h-[36px] px-3 rounded-full bg-white/[0.06] hover:bg-white/[0.10] border border-white/[0.08] backdrop-blur-xl shadow-sm flex items-center gap-2 transition-all">
            <Logo size={22} className="shrink-0" />
            <div className="flex items-baseline gap-1.5 min-w-0">
              <span className="text-[13px] font-semibold text-white tracking-tight leading-none whitespace-nowrap">
                音乐库
              </span>
              <span className="text-[11px] text-[#86868b] font-medium leading-none whitespace-nowrap">
                {songs.length > 0 ? `${songs.length} 首歌曲` : "多平台云音乐已就绪"}
              </span>
            </div>
          </div>
        </div>

        {/* 中间栏: 绝对居中在视口中央的悬浮玻璃岛 (绝对几何对称) */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 flex justify-center items-center pointer-events-auto">
          <AppleUnifiedNavIsland />
        </div>

        {/* 右侧栏: AI 找歌 + 音源管理 + 多平台账号胶囊 + 管理曲库 */}
        <div className="flex items-center justify-end gap-2.5 shrink-0 z-10 ml-auto">
          {/* AI 找歌助手入口 */}
          <button
            type="button"
            onClick={() => openPanel("aiAgent")}
            className="h-[36px] px-3 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.08] shadow-sm flex items-center gap-1.5 transition-all active:scale-[0.98] group shrink-0"
            title="AI 找歌助手"
          >
            <div className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse shrink-0" />
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            <span className="text-[12px] font-medium text-white/90 group-hover:text-white whitespace-nowrap">
              AI 找歌
            </span>
          </button>

          {/* 音源管理中心入口 */}
          <button
            type="button"
            onClick={() => openManagementModal()}
            className="h-[36px] px-3 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.08] shadow-sm flex items-center gap-1.5 transition-all active:scale-[0.98] group shrink-0"
            title="全网多音源矩阵与扩展管理中心"
          >
            <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse shrink-0" />
            <Radio className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-[12px] font-medium text-white/90 group-hover:text-white whitespace-nowrap">
              音源管理
            </span>
          </button>

          {/* Apple ID 风格多平台账号胶囊 */}
          <button
            type="button"
            onClick={() => openPanel("accountCenter")}
            className="h-[36px] px-3 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.08] shadow-sm flex items-center gap-2 transition-all active:scale-[0.98] group shrink-0"
            title="多平台账号与云端资产"
          >
            {neteaseUser.avatarUrl ? (
              <div className="relative w-5 h-5 rounded-full overflow-hidden border border-[#0071e3] shrink-0">
                <Image src={neteaseUser.avatarUrl} alt="Avatar" fill className="object-cover" />
              </div>
            ) : (
              <div className="w-5 h-5 rounded-full bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center text-white shrink-0 shadow-sm">
                <Crown className="w-3 h-3" />
              </div>
            )}
            <span className="text-[12px] font-medium text-white/90 group-hover:text-white max-w-[90px] md:max-w-[120px] truncate whitespace-nowrap">
              {neteaseUser.nickname || "登录云音乐"}
            </span>
            {neteaseUser.isVip && (
              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0">
                VIP
              </span>
            )}
          </button>

          {/* Apple 磨砂高光「管理曲库」胶囊 */}
          <motion.a
            href="/data-manager"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="h-[36px] px-3.5 rounded-full bg-white/[0.08] hover:bg-white/[0.16] border border-white/10 text-white text-[12px] font-medium flex items-center gap-1.5 transition-all shadow-sm whitespace-nowrap shrink-0"
            title="导入与管理曲库"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>管理曲库</span>
          </motion.a>
        </div>
      </div>
    </motion.header>
  );
}
