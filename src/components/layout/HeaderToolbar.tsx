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
import { useMediaQuery } from "@/hooks/useMediaQuery";

export function HeaderToolbar() {
  const { currentView, openPanel } = useUIStore();
  const { songs } = usePlaylistStore();
  const { neteaseUser } = useUserAccountStore();
  const { openManagementModal } = useSourceConfigStore();
  // 岛的微按钮组在 <1320 收起（见 AppleUnifiedNavIsland），此时左侧计数也让位
  const isCompactHeader = useMediaQuery("(max-width: 1319px)");
  // 再窄一档才把右侧四个入口压成图标，尽量晚地丢掉文字标签
  const isVeryNarrow = useMediaQuery("(max-width: 1149px)");

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
      <div className="relative flex items-center max-w-[1800px] mx-auto w-full min-h-[44px] pointer-events-auto">
        {/* 左侧栏: Apple 磨砂高光 Logo 徽标胶囊。
            左右两栏都用 flex-1（basis 0）等分剩余空间，而**不是** shrink-0：
            只有两栏等宽，夹在中间的岛才落在窗口中线上。
            若左右各自按内容宽度（左 ~141、右 ~446），岛就只在「剩余空间」里居中，
            中心会固定左偏 (右宽−左宽)/2 —— 1780px 窗口下实测偏 152px，肉眼很明显。
            两侧 flex 项的 min-width 默认是 min-content，所以窄到放不下时
            会自动退回「在剩余空间里居中」，此时仍有各自的 min-content 兜底。 */}
        <div className="flex-1 flex items-center justify-start z-10">
          <div className="h-[36px] px-3 rounded-full bg-white/[0.06] hover:bg-white/[0.10] border border-white/[0.08] backdrop-blur-xl shadow-sm flex items-center gap-2 transition-all">
            <Logo size={22} className="shrink-0" />
            <div className="flex items-baseline gap-1.5 min-w-0">
              <span className="text-[13px] font-semibold text-white tracking-tight leading-none whitespace-nowrap">
                音乐库
              </span>
              {!isCompactHeader && (
                <span className="text-[11px] text-[#86868b] font-medium leading-none whitespace-nowrap">
                  {songs.length > 0 ? `${songs.length} 首歌曲` : "多平台云音乐已就绪"}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 中间栏: 悬浮玻璃岛。
            不回到 absolute left-1/2：绝对定位使它脱离文档流、与右侧集群互不让位，
            只要 岛右缘 > 右集群左缘 就必然重叠（实测 1280 重叠 180px、1024 重叠 162px，
            且「音源管理」按钮会被别的按钮盖住点不到）。留在文档流里由布局引擎保证永不重叠，
            居中则交给上面两栏的 flex-1 等宽来完成。 */}
        <div className="shrink-0 flex justify-center items-center z-20 pointer-events-auto px-2">
          <AppleUnifiedNavIsland />
        </div>

        {/* 右侧栏: AI 找歌 + 音源管理 + 多平台账号胶囊 + 管理曲库（等宽见左侧栏注释） */}
        <div className="flex-1 flex items-center justify-end gap-2.5 z-10">
          {/* AI 找歌助手入口（窄屏只留图标） */}
          <button
            type="button"
            onClick={() => openPanel("aiAgent")}
            className={`h-[36px] rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.08] shadow-sm flex items-center transition-all active:scale-[0.98] group shrink-0 ${
              isVeryNarrow ? "w-9 justify-center px-0" : "px-3 gap-1.5"
            }`}
            title="AI 找歌助手"
          >
            {!isVeryNarrow && (
              <div className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse shrink-0" />
            )}
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            {!isVeryNarrow && (
              <span className="text-[12px] font-medium text-white/90 group-hover:text-white whitespace-nowrap">
                AI 找歌
              </span>
            )}
          </button>

          {/* 音源管理中心入口（窄屏只留图标） */}
          <button
            type="button"
            onClick={() => openManagementModal()}
            className={`h-[36px] rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.08] shadow-sm flex items-center transition-all active:scale-[0.98] group shrink-0 ${
              isVeryNarrow ? "w-9 justify-center px-0" : "px-3 gap-1.5"
            }`}
            title="全网多音源矩阵与扩展管理中心"
          >
            {!isVeryNarrow && (
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse shrink-0" />
            )}
            <Radio className="w-3.5 h-3.5 text-cyan-400" />
            {!isVeryNarrow && (
              <span className="text-[12px] font-medium text-white/90 group-hover:text-white whitespace-nowrap">
                音源管理
              </span>
            )}
          </button>

          {/* Apple ID 风格多平台账号胶囊（窄屏只留头像） */}
          <button
            type="button"
            onClick={() => openPanel("accountCenter")}
            className={`h-[36px] rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.08] shadow-sm flex items-center transition-all active:scale-[0.98] group shrink-0 ${
              isVeryNarrow ? "w-9 justify-center px-0" : "px-3 gap-2"
            }`}
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
            {!isVeryNarrow && (
              <>
                <span className="text-[12px] font-medium text-white/90 group-hover:text-white max-w-[90px] md:max-w-[120px] truncate whitespace-nowrap">
                  {neteaseUser.nickname || "登录云音乐"}
                </span>
                {neteaseUser.isVip && (
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0">
                    VIP
                  </span>
                )}
              </>
            )}
          </button>

          {/* Apple 磨砂高光「管理曲库」胶囊（窄屏只留图标） */}
          <motion.a
            href="/data-manager"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={`h-[36px] rounded-full bg-white/[0.08] hover:bg-white/[0.16] border border-white/10 text-white text-[12px] font-medium flex items-center transition-all shadow-sm whitespace-nowrap shrink-0 ${
              isVeryNarrow ? "w-9 justify-center px-0" : "px-3.5 gap-1.5"
            }`}
            title="导入与管理曲库"
          >
            <Plus className="w-3.5 h-3.5" />
            {!isVeryNarrow && <span>管理曲库</span>}
          </motion.a>
        </div>
      </div>
    </motion.header>
  );
}
