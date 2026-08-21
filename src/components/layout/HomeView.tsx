/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Disc3 } from "lucide-react";
import { useUIStore } from "@/store/uiStore";
import { usePlaylistGroupStore } from "@/store/playlistGroupStore";
import { useUserAccountStore } from "@/store/userAccountStore";
import { AppleDateTime } from "@/components/widgets/AppleDateTime";
import { MusicCardStack } from "@/components/player/MusicCardStack";
import { HeaderToolbar } from "./HeaderToolbar";

const APPLE_SPRING_CONFIG = {
  type: "spring" as const,
  stiffness: 400,
  damping: 35,
  mass: 1,
  bounce: 0,
};

export function HomeView() {
  const { currentView, openPanel, togglePanel } = useUIStore();
  const { groups } = usePlaylistGroupStore();
  const { userPlaylists } = useUserAccountStore();

  const totalPlaylistsCount = (groups?.length || 0) + (userPlaylists?.length || 0) + 2;

  // 绑定全局快捷键 ⌘L / Ctrl+L 唤出 3D 歌单架
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "l") {
        e.preventDefault();
        togglePanel("shelf3D");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [togglePanel]);

  return (
    <>
      {/* Apple 极简高奢时钟 */}
      <AnimatePresence>
        {currentView === "home" && (
          <motion.div
            initial={{ opacity: 0, y: -16, x: "-50%" }}
            animate={{ opacity: 1, y: 0, x: "-50%" }}
            exit={{ opacity: 0, y: -16, x: "-50%" }}
            transition={APPLE_SPRING_CONFIG}
            style={{
              zIndex: 10,
              top: "14%",
              left: "50%",
              position: "absolute",
            }}
            className="flex items-center justify-center scale-100 pointer-events-none"
          >
            <AppleDateTime />
          </motion.div>
        )}
      </AnimatePresence>

      {/* 主视图层 */}
      <motion.div
        className="absolute inset-0"
        initial={false}
        animate={{
          opacity: currentView === "home" ? 1 : 0,
          x: currentView === "home" ? 0 : -60,
          scale: currentView === "home" ? 1 : 0.94,
        }}
        transition={APPLE_SPRING_CONFIG}
        style={{
          pointerEvents: currentView === "home" ? "auto" : "none",
          visibility: currentView === "home" ? "visible" : "hidden",
          willChange: "transform, opacity",
          transform: "translateZ(0)",
          backfaceVisibility: "hidden",
          zIndex: 20,
        }}
      >
        <HeaderToolbar />

        {/* 1:1 实体黑胶 3D Cover Flow 唱片流动区 */}
        <div
          className="absolute inset-0 pt-28"
          style={{
            opacity: currentView === "home" ? 1 : 0,
            transform:
              currentView === "home" ? "translateY(0) scale(1)" : "translateY(30px) scale(0.97)",
            transition: "opacity 0.35s ease, transform 0.35s ease",
            transitionDelay: currentView === "home" ? "0.06s" : "0s",
            willChange: "transform, opacity",
          }}
        >
          <MusicCardStack />
        </div>

        {/* 底部 Apple 极简 3D 歌单架悬浮胶囊 */}
        {currentView === "home" && (
          <motion.div
            initial={{ opacity: 0, y: 20, x: "-50%" }}
            animate={{ opacity: 1, y: 0, x: "-50%" }}
            transition={{ delay: 0.3, duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
            className="absolute bottom-5 left-1/2 -translate-x-1/2 z-30 pointer-events-auto"
          >
            <motion.button
              whileHover={{ scale: 1.04, y: -2 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => openPanel("shelf3D")}
              className="h-8 px-3.5 rounded-full bg-white/[0.06] hover:bg-white/[0.14] border border-white/[0.08] backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.12)] flex items-center gap-2 text-white text-[11.5px] font-medium tracking-tight transition-all group"
            >
              <Disc3 className="w-3.5 h-3.5 text-[#2997ff] group-hover:rotate-180 transition-transform duration-700" />
              <span className="text-white/80 group-hover:text-white">3D 歌单架</span>
              <span className="px-1.5 py-0.2 rounded text-[9.5px] font-mono bg-white/10 text-white/50 group-hover:text-white/70">
                ⌘L
              </span>
              <span className="w-1 h-1 rounded-full bg-white/20" />
              <span className="text-white/40 group-hover:text-white/60 text-[10.5px]">
                {totalPlaylistsCount} 张歌单
              </span>
            </motion.button>
          </motion.div>
        )}
      </motion.div>
    </>
  );
}
