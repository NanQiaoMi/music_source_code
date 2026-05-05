"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { DataManager } from "@/components/library/DataManager";
import { LocalMusicManager } from "@/components/library/LocalMusicManager";
import { GlassCard } from "@/components/shared/Glass/GlassCard";
import { usePlaylistStore } from "@/store/playlistStore";
import { useAudioStore } from "@/store/audioStore";
import { useUIStore } from "@/store/uiStore";
import {
  Search,
  Plus,
  Settings,
  ChevronDown,
  Home,
  Music2,
  ListMusic,
  Upload,
  Database,
} from "lucide-react";

type TabType = "local" | "data";

const formatTime = (seconds: number): string => {
  if (isNaN(seconds) || seconds < 0) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

interface MiniPlayerProps {
  onClose: () => void;
}

const MiniPlayer: React.FC<MiniPlayerProps> = ({ onClose }) => {
  const currentSong = useAudioStore(state => state.currentSong);
  const isPlaying = useAudioStore(state => state.isPlaying);
  const currentTime = useAudioStore(state => state.currentTime);
  const duration = useAudioStore(state => state.duration);
  const setIsPlaying = useAudioStore(state => state.setIsPlaying);
  const seekTo = useAudioStore(state => state.seekTo);
  const { setCurrentView } = useUIStore();

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  if (!currentSong) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.95 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="relative w-80 overflow-hidden"
      style={{
        background: "rgba(0, 0, 0, 0.4)",
        backdropFilter: "blur(32px) saturate(180%)",
        borderRadius: "20px",
        border: "1px solid rgba(255, 255, 255, 0.1)",
        boxShadow: "0 20px 40px rgba(0, 0, 0, 0.3)",
      }}
    >
      <div className="p-4">
        <div className="flex items-center gap-3 mb-3">
          <motion.div
            className="relative w-12 h-12 rounded-lg overflow-hidden shadow-md flex-shrink-0 cursor-pointer"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setCurrentView("player")}
          >
            <Image
              src={currentSong.cover}
              alt={currentSong.title}
              fill
              className="object-cover"
              unoptimized
            />
          </motion.div>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold tracking-tight text-white truncate">
              {currentSong.title}
            </p>
            <p className="text-xs text-white/50 truncate">{currentSong.artist}</p>
          </div>

          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="w-8 h-8 rounded-full bg-white text-black flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-transform"
          >
            {isPlaying ? (
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
              </svg>
            ) : (
              <svg className="w-3 h-3 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>
        </div>

        <div
          className="h-1 bg-white/20 rounded-full overflow-hidden cursor-pointer"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const percentage = x / rect.width;
            seekTo(percentage * duration);
          }}
        >
          <motion.div
            className="h-full bg-white/60 rounded-full"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="flex justify-between mt-1 text-[10px] text-white/40">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>
    </motion.div>
  );
};

interface BottomTimeDisplayProps {
  currentTime: number;
  isPlaying: boolean;
}

const BottomTimeDisplay: React.FC<BottomTimeDisplayProps> = ({ currentTime, isPlaying }) => {
  const [displayTime, setDisplayTime] = useState(currentTime);

  useEffect(() => {
    setDisplayTime(currentTime);
  }, [currentTime]);

  const formatDisplayTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <motion.div
      className="flex flex-col items-center"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
    >
      <div
        className="text-5xl font-light tracking-widest text-white/70 tabular-nums"
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {formatDisplayTime(displayTime)}
      </div>
      <div className="flex items-center gap-2 mt-2">
        <motion.div
          className="w-1.5 h-1.5 rounded-full bg-white/40"
          animate={{ scale: isPlaying ? [1, 1.3, 1] : 1 }}
          transition={{ repeat: Infinity, duration: 1 }}
        />
        <span className="text-xs text-white/40 tracking-wide">
          {isPlaying ? "播放中" : "已暂停"}
        </span>
      </div>
    </motion.div>
  );
};

export default function DataManagerPage() {
  const { initializePlaylist } = usePlaylistStore();
  const currentSong = useAudioStore(state => state.currentSong);
  const isPlaying = useAudioStore(state => state.isPlaying);
  const currentTime = useAudioStore(state => state.currentTime);
  const duration = useAudioStore(state => state.duration);
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>("local");
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showMiniPlayer, setShowMiniPlayer] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    initializePlaylist();
  }, [initializePlaylist]);

  useEffect(() => {
    if (currentSong) {
      setShowMiniPlayer(true);
    }
  }, [currentSong]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMoreMenu(false);
      }
    };

    if (showMoreMenu) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showMoreMenu]);

  if (!mounted) {
    return null;
  }

  return (
    <div className="relative min-h-screen bg-[#050505] overflow-hidden font-sans text-white">
      {/* Dynamic Background */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-purple-900/20 blur-[120px] mix-blend-screen" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-blue-900/20 blur-[120px] mix-blend-screen" />
        <div className="absolute top-[30%] right-[20%] w-[30%] h-[30%] rounded-full bg-pink-900/10 blur-[100px] mix-blend-screen" />
        <div className="absolute inset-0 bg-black/40 backdrop-blur-[100px]" />
      </div>

      <div className="relative z-10 h-screen flex flex-col">
        <header className="flex-shrink-0 px-8 pt-8 pb-4">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between"
          >
            <div className="flex items-center gap-4">
              <Link
                href="/"
                className="w-11 h-11 rounded-full bg-white/5 backdrop-blur-2xl border border-white/10 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/15 hover:scale-105 transition-all shadow-lg"
              >
                <Home className="w-5 h-5" />
              </Link>

              <div className="w-px h-6 bg-white/10" />

              <h1 className="text-3xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white to-white/60">
                资料库
              </h1>
            </div>

            <div className="flex items-center gap-3">
              <button
                className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-xl border border-white/10 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/20 transition-all"
                title="搜索"
              >
                <Search className="w-5 h-5" />
              </button>

              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setShowMoreMenu(!showMoreMenu)}
                  className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-xl border border-white/10 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/20 transition-all"
                >
                  <MoreIcon />
                </button>

                <AnimatePresence>
                  {showMoreMenu && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 top-full mt-2 w-56 overflow-hidden"
                      style={{
                        background: "rgba(30, 30, 30, 0.8)",
                        backdropFilter: "blur(40px) saturate(200%)",
                        borderRadius: "16px",
                        border: "1px solid rgba(255, 255, 255, 0.05)",
                      }}
                    >
                      <div className="p-2">
                        <MenuItem icon={<Music2 className="w-4 h-4" />} label="导入音乐" />
                        <MenuItem icon={<ListMusic className="w-4 h-4" />} label="创建播放列表" />
                        <MenuItem icon={<Settings className="w-4 h-4" />} label="设置" />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        </header>

        <div className="flex-1 overflow-hidden px-8 pb-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="h-full flex flex-col"
          >
            <div className="flex gap-2 mb-4 flex-shrink-0">
              <TabButton
                active={activeTab === "local"}
                onClick={() => setActiveTab("local")}
                icon={<Music2 className="w-4 h-4" />}
                label="本地音乐"
              />
              <TabButton
                active={activeTab === "data"}
                onClick={() => setActiveTab("data")}
                icon={<Database className="w-4 h-4" />}
                label="数据管理"
              />
            </div>

            <div
              className="flex-1 overflow-hidden rounded-3xl relative shadow-2xl"
              style={{
                background: "rgba(255, 255, 255, 0.03)",
                backdropFilter: "blur(40px) saturate(150%)",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.1), 0 20px 40px rgba(0, 0, 0, 0.5)",
              }}
            >
              <div className="h-full overflow-y-auto custom-scrollbar p-6 min-h-0 relative z-10">
                {activeTab === "local" ? <LocalMusicManager /> : <DataManager />}
              </div>
            </div>
          </motion.div>
        </div>

        <footer className="flex-shrink-0 px-8 pb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex items-center justify-between"
          >
            <AnimatePresence>
              {showMiniPlayer && currentSong && (
                <MiniPlayer onClose={() => setShowMiniPlayer(false)} />
              )}
            </AnimatePresence>

            {!showMiniPlayer && (
              <div className="text-sm text-white/30">
                {currentSong ? (
                  <span>正在播放: {currentSong.title}</span>
                ) : (
                  <span>选择音乐开始播放</span>
                )}
              </div>
            )}

            <div className="flex-1" />

            <BottomTimeDisplay currentTime={currentTime} isPlaying={isPlaying} />

            <div className="flex-1" />
          </motion.div>
        </footer>
      </div>
    </div>
  );
}

const MoreIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
  </svg>
);

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}

const TabButton: React.FC<TabButtonProps> = ({ active, onClick, icon, label }) => (
  <motion.button
    onClick={onClick}
    className={`
      px-5 py-2.5 rounded-xl flex items-center gap-2 transition-all duration-200
      ${
        active
          ? "bg-white text-black font-semibold"
          : "bg-white/10 text-white/70 hover:bg-white/20 hover:text-white"
      }
    `}
    whileTap={{ scale: 0.97 }}
  >
    {icon}
    <span className="text-sm">{label}</span>
  </motion.button>
);

interface MenuItemProps {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
}

const MenuItem: React.FC<MenuItemProps> = ({ icon, label, onClick }) => (
  <button
    onClick={onClick}
    className="w-full flex items-center gap-3 px-4 py-3 text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition-all text-sm"
  >
    {icon}
    <span>{label}</span>
  </button>
);