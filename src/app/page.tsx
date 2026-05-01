"use client";

import { useState, useEffect, useRef } from "react";
import { MusicCardStack } from "@/components/MusicCardStack";
import { Player3D } from "@/components/Player3D";
import { VisualizationView } from "@/components/visualization/VisualizationView";
import { VisualizationViewV8 } from "@/components/visualization-v8/VisualizationViewV8";
import { QueuePanel } from "@/components/QueuePanel";
import { HistoryPanel } from "@/components/HistoryPanel";
import { SettingsPanel } from "@/components/SettingsPanel";
import { SleepTimerPanel } from "@/components/SleepTimerPanel";
import { SearchPanel } from "@/components/SearchPanel";
import { LyricSettingsPanel } from "@/components/LyricSettingsPanel";
import { GestureController } from "@/components/GestureController";
import { GestureFeedback } from "@/components/GestureFeedback";
import { VirtualCursor } from "@/components/VirtualCursor";
import { GlassToastContainer } from "@/components/GlassToast";
import { AudioEqualizer } from "@/components/AudioEqualizer";
import { VisualSettingsPanel } from "@/components/VisualSettings";
import EmotionMatrixView from "@/components/emotion/EmotionMatrixView";
import { GlassRadarWidget } from "@/components/GlassRadarWidget";
import { motion, AnimatePresence } from "framer-motion";
import { useUIStore } from "@/store/uiStore";
import { usePlaylistStore } from "@/store/playlistStore";
import { useGestureStore } from "@/store/gestureStore";
import { useVisualSettingsStore } from "@/store/visualSettingsStore";
import { useEmotionStore } from "@/store/emotionStore";
import { useDynamicTheme } from "@/hooks/useDynamicTheme";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import {
  Search,
  ListMusic,
  History,
  Settings,
  Moon,
  Hand,
  Type,
  Sparkles,
  TrendingUp,
  FileText,
  Cloud,
  Share2,
  Palette,
  Music,
  Database,
  Edit3,
  ListOrdered,
  HardDrive,
  Award,
  Disc3,
  Scissors,
  Waves,
  ChevronDown,
  Wrench,
  Dice1,
} from "lucide-react";
import { AppleDateTime } from "@/components/AppleDateTime";
import { KeyboardShortcutsHelp } from "@/components/KeyboardShortcutsHelp";
import { DailyRecommendation } from "@/components/DailyRecommendation";
import { ListeningHistory } from "@/components/ListeningHistory";
import { LyricsImportPanel } from "@/components/LyricsImportPanel";
import { OfflineCachePanel } from "@/components/OfflineCachePanel";
import { SharePanel } from "@/components/SharePanel";
import { PlayerSkinsPanel } from "@/components/PlayerSkinsPanel";
import LyricsSearchPanel from "@/components/LyricsSearchPanel";
import { LibraryManagerPanel } from "@/components/LibraryManagerPanel";
import { LyricsCoverEditor } from "@/components/LyricsCoverEditor";
import { SmartPlaylistPanel } from "@/components/SmartPlaylistPanel";
import { BackupRestorePanel } from "@/components/BackupRestorePanel";
import { StatsAchievementsPanel } from "@/components/StatsAchievementsPanel";
import { MusicLibrarySyncProvider } from "@/components/MusicLibrarySyncProvider";
import { FeatureButtonsContainer } from "@/components/features-v7/FeatureButtonsContainer";
import { InstantMix, InstantMixButton } from "@/components/InstantMix";
import { DesktopLyrics } from "@/components/features-v7/DesktopLyrics";
import { ProfessionalModeToggle, ProfessionalModePanel } from "@/components/ProfessionalModeToggle";
import FormatConverter from "@/components/FormatConverter";
import DSDConverter from "@/components/DSDConverter";
import TrackCutter from "@/components/TrackCutter";
import CrossfadeMixer from "@/components/CrossfadeMixer";
import { FingerprintScannerPanel } from "@/components/FingerprintScannerPanel";
import { LibraryHealthPanel } from "@/components/LibraryHealthPanel";
import { SmartRandomModal } from "@/components/shared/SmartRandomModal";

const APPLE_SPRING_CONFIG = {
  type: "spring" as const,
  stiffness: 400,
  damping: 35,
  mass: 1,
  bounce: 0
};

export default function Home() {
  const { currentView, setCurrentView, isTransitioning } = useUIStore();
  const { initializePlaylist, songs } = usePlaylistStore();
  const { isEnabled: isGestureEnabled, toggleGestureEnabled } = useGestureStore();
  const [mounted, setMounted] = useState(false);

  // UI Panels state
  const [showQueue, setShowQueue] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showSleepTimer, setShowSleepTimer] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showLyricSettings, setShowLyricSettings] = useState(false);
  const [showEQ, setShowEQ] = useState(false);
  const [showVisualSettings, setShowVisualSettings] = useState(false);
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false);
  const [showListeningHistory, setShowListeningHistory] = useState(false);
  const [showDailyRecommendation, setShowDailyRecommendation] = useState(false);
  const [showLyricsImport, setShowLyricsImport] = useState(false);
  const [showOfflineCache, setShowOfflineCache] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showPlayerSkins, setShowPlayerSkins] = useState(false);
  const [showLyricsSearch, setShowLyricsSearch] = useState(false);
  const [showLibraryManager, setShowLibraryManager] = useState(false);
  const [showLyricsCoverEditor, setShowLyricsCoverEditor] = useState(false);
  const [showSmartPlaylist, setShowSmartPlaylist] = useState(false);
  const [showBackupRestore, setShowBackupRestore] = useState(false);
  const [showStatsAchievements, setShowStatsAchievements] = useState(false);
  const [showProfessionalMode, setShowProfessionalMode] = useState(false);
  const [showFormatConverter, setShowFormatConverter] = useState(false);
  const [showDSDConverter, setShowDSDConverter] = useState(false);
  const [showTrackCutter, setShowTrackCutter] = useState(false);
  const [showCrossfadeMixer, setShowCrossfadeMixer] = useState(false);
  const [showFingerprintScanner, setShowFingerprintScanner] = useState(false);
  const [showLibraryHealth, setShowLibraryHealth] = useState(false);
  const [showProfessionalTools, setShowProfessionalTools] = useState(false);
  const [showInstantMix, setShowInstantMix] = useState(false);
  const [showSmartRandom, setShowSmartRandom] = useState(false);
  const [showEmotionMatrix, setShowEmotionMatrix] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(["模式与设置", "音频处理工具", "智能分析工具"]));
  const professionalToolsRef = useRef<HTMLDivElement>(null);

  const toggleGroup = (groupName: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupName)) {
        next.delete(groupName);
      } else {
        next.add(groupName);
      }
      return next;
    });
  };

  // Initialize dynamic theme
  useDynamicTheme();

  // Initialize keyboard shortcuts
  useKeyboardShortcuts();

  // Close professional tools dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (professionalToolsRef.current && !professionalToolsRef.current.contains(event.target as Node)) {
        setShowProfessionalTools(false);
      }
    };

    if (showProfessionalTools) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showProfessionalTools]);

  // Visual settings from store
  const { blurIntensity, animationSpeed } = useVisualSettingsStore();

  useEffect(() => {
    setMounted(true);
    initializePlaylist();
    useEmotionStore.getState().initializeEmotions();
  }, [initializePlaylist]);

  if (!mounted) {
    return null;
  }

  return (
    <main className="relative w-full h-full overflow-hidden bg-black fixed inset-0">
      <style jsx global>{`
        :root {
          --theme-primary: rgb(147, 51, 234);
          --theme-secondary: rgb(59, 130, 246);
          --theme-accent: rgb(236, 72, 153);
          --theme-complementary: rgb(72, 236, 153);
          --theme-background: rgb(15, 15, 35);
          --theme-surface: rgb(30, 30, 60);
          --theme-gradient: linear-gradient(
            135deg,
            rgb(147, 51, 234),
            rgb(59, 130, 246),
            rgb(236, 72, 153)
          );
          --blur-intensity: ${blurIntensity}px;
          --animation-speed: ${animationSpeed}s;
        }
      `}</style>

      {/* Dynamic theme gradient background */}
      <div
        className="absolute inset-0 transition-all"
        style={{
          background:
            "linear-gradient(135deg, var(--theme-background) 0%, rgba(0,0,0,0.8) 50%, var(--theme-surface) 100%)",
          transitionDuration: `${animationSpeed * 800}ms`,
          backdropFilter: `blur(${blurIntensity}px)`,
        }}
      />

      {/* Dynamic radial gradients */}
      <div
        className="absolute inset-0 transition-opacity duration-[800ms] ease-out"
        style={{
          background: "radial-gradient(ellipse at top, var(--theme-primary) 0%, transparent 60%)",
          opacity: 0.15,
        }}
      />
      <div
        className="absolute inset-0 transition-opacity duration-[800ms] ease-out"
        style={{
          background:
            "radial-gradient(ellipse at bottom right, var(--theme-secondary) 0%, transparent 50%)",
          opacity: 0.1,
        }}
      />

      {/* Complementary color glow - 顶部互补色光晕，优化边缘 */}
      <div
        className="absolute inset-0 transition-all duration-[800ms] ease-out pointer-events-none"
        style={{
          background: `
            radial-gradient(ellipse 120% 80% at 50% -20%, var(--theme-complementary) 0%, transparent 50%),
            radial-gradient(ellipse 80% 40% at 50% 0%, var(--theme-complementary) 0%, transparent 40%)
          `,
          opacity: 0.25,
        }}
      />

      {/* 额外的柔和光晕层，平滑边缘过渡 */}
      <div
        className="absolute inset-0 transition-all duration-[800ms] ease-out pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 150% 100% at 50% -30%, var(--theme-complementary) 0%, transparent 70%)",
          opacity: 0.1,
          filter: "blur(60px)",
        }}
      />

      {/* Dynamic accent glow */}
      <div
        className="absolute inset-0 transition-opacity duration-[800ms] ease-out pointer-events-none"
        style={{
          background: "radial-gradient(circle at 50% 50%, var(--theme-accent) 0%, transparent 70%)",
          opacity: 0.05,
        }}
      />

      {/* Subtle noise texture */}
      <div className="absolute inset-0 opacity-[0.03] bg-[url('https://grainy-gradients.vercel.app/noise.svg')]" />

      {/* Apple Style Date Time Display - Aligned with Library Header */}
      <div
        style={{
          opacity: currentView === "home" ? 1 : 0,
          transform:
            currentView === "home"
              ? "translateX(-50%) translateY(0)"
              : "translateX(-50%) translateY(-20px)",
          transition: "opacity 0.5s ease, transform 0.5s ease",
          transitionDelay: currentView === "home" ? "0.2s" : "0s",
          zIndex: 9999,
          top: "950px",
          left: "50%",
          position: "absolute",
        }}
        className="flex items-center justify-center scale-90"
      >
        <AppleDateTime />
      </div>
      {/* Gesture Controller */}
      <GestureController />

      {/* Gesture Feedback */}
      <GestureFeedback />

      {/* Home View - GPU Optimized */}
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
        }}
      >
        {/* Apple Music Style Header */}
        <header
          className="absolute top-0 left-0 right-0 z-20 pt-14 pb-4 px-8 backdrop-blur-xl"
          style={{
            opacity: currentView === "home" ? 1 : 0,
            transform: currentView === "home" ? "translateY(0)" : "translateY(-20px)",
            transition: "opacity 0.3s ease, transform 0.3s ease",
            transitionDelay: currentView === "home" ? "0.05s" : "0s",
            background: "rgba(0,0,0,0.5)",
            borderBottom: "1px solid var(--theme-border)",
          }}
        >
          <div className="flex items-center justify-between max-w-7xl mx-auto">
            <div
              style={{
                opacity: currentView === "home" ? 1 : 0,
                transform: currentView === "home" ? "translateX(0)" : "translateX(-15px)",
                transition: "opacity 0.3s ease, transform 0.3s ease",
                transitionDelay: currentView === "home" ? "0.08s" : "0s",
              }}
              className="w-[200px]"
            >
              <h1
                className="text-[28px] font-bold tracking-tight"
                style={{ color: "var(--theme-text-primary)" }}
              >
                资料库
              </h1>
              <p className="text-[15px] mt-0.5" style={{ color: "var(--theme-text-secondary)" }}>
                {songs.length > 0 ? `${songs.length} 首歌曲` : "导入音乐开始聆听"}
              </p>
            </div>

            <nav
              className="flex items-center gap-2"
              style={{
                opacity: currentView === "home" ? 1 : 0,
                transform: currentView === "home" ? "translateX(0)" : "translateX(15px)",
                transition: "opacity 0.3s ease, transform 0.3s ease",
                transitionDelay: currentView === "home" ? "0.08s" : "0s",
              }}
            >
              {/* Apple Music Style Toolbar Buttons */}
              <button
                onClick={toggleGestureEnabled}
                className="w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-200"
                style={{
                  background: isGestureEnabled ? "var(--theme-accent-pink)" : "transparent",
                  color: isGestureEnabled ? "#fff" : "var(--theme-text-secondary)",
                }}
                title={isGestureEnabled ? "手势控制已开启" : "手势控制已关闭"}
              >
                <Hand className="w-[18px] h-[18px]" />
              </button>

              <button
                onClick={() => setShowSearch(true)}
                className="w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-200 hover:bg-white/10"
                style={{ color: "var(--theme-text-secondary)" }}
                title="搜索"
              >
                <Search className="w-[18px] h-[18px]" />
              </button>

              <button
                onClick={() => setShowQueue(true)}
                className="w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-200 hover:bg-white/10"
                style={{ color: "var(--theme-text-secondary)" }}
                title="播放队列"
              >
                <ListMusic className="w-[18px] h-[18px]" />
              </button>

              <button
                onClick={() => setShowHistory(true)}
                className="w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-200 hover:bg-white/10"
                style={{ color: "var(--theme-text-secondary)" }}
                title="历史记录"
              >
                <History className="w-[18px] h-[18px]" />
              </button>

              <button
                onClick={() => setShowListeningHistory(true)}
                className="w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-200 hover:bg-white/10"
                style={{ color: "var(--theme-text-secondary)" }}
                title="听歌排行"
              >
                <TrendingUp className="w-[18px] h-[18px]" />
              </button>

              <button
                onClick={() => setShowDailyRecommendation(true)}
                className="w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-200 hover:bg-white/10"
                style={{ color: "var(--theme-text-secondary)" }}
                title="每日推荐"
              >
                <Sparkles className="w-[18px] h-[18px]" />
              </button>

              <InstantMixButton onClick={() => setShowInstantMix(true)} />

              <button
                onClick={() => setShowEmotionMatrix(true)}
                className="w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-200 hover:bg-white/10 group"
                style={{ 
                  color: showEmotionMatrix ? "var(--theme-accent-pink)" : "var(--theme-text-secondary)",
                  background: showEmotionMatrix ? "rgba(236, 72, 153, 0.1)" : "transparent"
                }}
                title="情绪资料库 (Emotion Matrix)"
              >
                <motion.div
                  whileHover={{ rotate: 10, scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                >
                  <Dice1 className="w-[18px] h-[18px]" />
                </motion.div>
              </button>

              <button
                onClick={() => setShowSleepTimer(true)}
                className="w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-200 hover:bg-white/10"
                style={{ color: "var(--theme-text-secondary)" }}
                title="睡眠定时"
              >
                <Moon className="w-[18px] h-[18px]" />
              </button>

              <button
                onClick={() => setShowSettings(true)}
                className="w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-200 hover:bg-white/10"
                style={{ color: "var(--theme-text-secondary)" }}
                title="设置"
              >
                <Settings className="w-[18px] h-[18px]" />
              </button>

              <button
                onClick={() => setShowLyricSettings(true)}
                className="w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-200 hover:bg-white/10"
                style={{ color: "var(--theme-text-secondary)" }}
                title="歌词设置"
              >
                <Type className="w-[18px] h-[18px]" />
              </button>

              <button
                onClick={() => setShowLyricsSearch(true)}
                className="w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-200 hover:bg-white/10"
                style={{ color: "var(--theme-text-secondary)" }}
                title="歌词搜索"
              >
                <Music className="w-[18px] h-[18px]" />
              </button>

              <button
                onClick={() => setShowLyricsImport(true)}
                className="w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-200 hover:bg-white/10"
                style={{ color: "var(--theme-text-secondary)" }}
                title="导入歌词"
              >
                <FileText className="w-[18px] h-[18px]" />
              </button>

              <button
                onClick={() => setShowOfflineCache(true)}
                className="w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-200 hover:bg-white/10"
                style={{ color: "var(--theme-text-secondary)" }}
                title="离线缓存"
              >
                <Cloud className="w-[18px] h-[18px]" />
              </button>

              <button
                onClick={() => setShowKeyboardShortcuts(true)}
                className="w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-200 hover:bg-white/10"
                style={{ color: "var(--theme-text-secondary)" }}
                title="快捷键帮助"
              >
                <span className="text-xs font-bold">?</span>
              </button>

              <button
                onClick={() => setShowShare(true)}
                className="w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-200 hover:bg-white/10"
                style={{ color: "var(--theme-text-secondary)" }}
                title="分享"
              >
                <Share2 className="w-[18px] h-[18px]" />
              </button>

              <button
                onClick={() => setShowPlayerSkins(true)}
                className="w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-200 hover:bg-white/10"
                style={{ color: "var(--theme-text-secondary)" }}
                title="播放器皮肤"
              >
                <Palette className="w-[18px] h-[18px]" />
              </button>

              <button
                onClick={() => setShowLibraryManager(true)}
                className="w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-200 hover:bg-white/10"
                style={{ color: "var(--theme-text-secondary)" }}
                title="音乐库管理"
              >
                <Database className="w-[18px] h-[18px]" />
              </button>

              <button
                onClick={() => setShowLyricsCoverEditor(true)}
                className="w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-200 hover:bg-white/10"
                style={{ color: "var(--theme-text-secondary)" }}
                title="歌词与封面"
              >
                <Edit3 className="w-[18px] h-[18px]" />
              </button>

              <button
                onClick={() => setShowSmartPlaylist(true)}
                className="w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-200 hover:bg-white/10"
                style={{ color: "var(--theme-text-secondary)" }}
                title="智能歌单"
              >
                <ListOrdered className="w-[18px] h-[18px]" />
              </button>

              <button
                onClick={() => setShowBackupRestore(true)}
                className="w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-200 hover:bg-white/10"
                style={{ color: "var(--theme-text-secondary)" }}
                title="数据备份"
              >
                <HardDrive className="w-[18px] h-[18px]" />
              </button>

              <button
                onClick={() => setShowStatsAchievements(true)}
                className="w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-200 hover:bg-white/10"
                style={{ color: "var(--theme-text-secondary)" }}
                title="统计与成就"
              >
                <Award className="w-[18px] h-[18px]" />
              </button>

              {/* Professional Tools Dropdown */}
              <div className="relative" ref={professionalToolsRef}>
                <button
                  onClick={() => setShowProfessionalTools(!showProfessionalTools)}
                  className="w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-200 hover:bg-white/10"
                  style={{
                    background: showProfessionalTools ? "var(--theme-accent-pink)" : "transparent",
                    color: showProfessionalTools ? "#fff" : "var(--theme-text-secondary)",
                  }}
                  title="专业工具箱"
                >
                  <Wrench className="w-[18px] h-[18px]" />
                  <ChevronDown className={`w-3 h-3 ml-0.5 transition-transform duration-200 ${showProfessionalTools ? "rotate-180" : ""}`} />
                </button>

                <AnimatePresence>
                  {showProfessionalTools && (
                    <motion.div
                      initial={{ opacity: 0, y: -10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -10, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 top-full mt-2 w-64 bg-white/10 backdrop-blur-xl rounded-xl border border-white/20 shadow-2xl overflow-hidden z-50"
                    >
                      <div className="p-2 space-y-1">
                        <div className="text-xs font-semibold text-white/50 px-3 py-2 uppercase tracking-wider">
                          专业功能
                        </div>

                        {/* 模式与设置 */}
                        <div>
                          <button
                            onClick={() => toggleGroup("模式与设置")}
                            className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-white/10 transition-colors text-left"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-white/90">模式与设置</span>
                            </div>
                            <ChevronDown className={`w-4 h-4 text-white/50 transition-transform duration-200 ${expandedGroups.has("模式与设置") ? "rotate-180" : ""}`} />
                          </button>
                          <AnimatePresence>
                            {expandedGroups.has("模式与设置") && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="overflow-hidden"
                              >
                                <div className="pl-4 pr-2 pb-1 space-y-1">
                                  <button
                                    onClick={() => {
                                      setShowProfessionalMode(true);
                                      setShowProfessionalTools(false);
                                    }}
                                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/10 transition-colors text-left"
                                  >
                                    <span className="text-sm text-white/80">专业模式</span>
                                  </button>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>

                        {/* 音频处理工具 */}
                        <div>
                          <button
                            onClick={() => toggleGroup("音频处理工具")}
                            className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-white/10 transition-colors text-left"
                          >
                            <div className="flex items-center gap-2">
                              <Disc3 className="w-4 h-4 text-pink-400" />
                              <span className="text-sm font-medium text-white/90">音频处理工具</span>
                            </div>
                            <ChevronDown className={`w-4 h-4 text-white/50 transition-transform duration-200 ${expandedGroups.has("音频处理工具") ? "rotate-180" : ""}`} />
                          </button>
                          <AnimatePresence>
                            {expandedGroups.has("音频处理工具") && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="overflow-hidden"
                              >
                                <div className="pl-4 pr-2 pb-1 space-y-1">
                                  <button
                                    onClick={() => {
                                      setShowFormatConverter(true);
                                      setShowProfessionalTools(false);
                                    }}
                                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/10 transition-colors text-left"
                                  >
                                    <span className="text-sm text-white/80">格式转换</span>
                                  </button>
                                  <button
                                    onClick={() => {
                                      setShowDSDConverter(true);
                                      setShowProfessionalTools(false);
                                    }}
                                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/10 transition-colors text-left"
                                  >
                                    <span className="text-sm text-white/80">DSD 转换</span>
                                  </button>
                                  <button
                                    onClick={() => {
                                      setShowTrackCutter(true);
                                      setShowProfessionalTools(false);
                                    }}
                                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/10 transition-colors text-left"
                                  >
                                    <Scissors className="w-4 h-4 text-purple-400" />
                                    <span className="text-sm text-white/80">整轨切割</span>
                                  </button>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>

                        {/* 智能分析工具 */}
                        <div>
                          <button
                            onClick={() => toggleGroup("智能分析工具")}
                            className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-white/10 transition-colors text-left"
                          >
                            <div className="flex items-center gap-2">
                              <Waves className="w-4 h-4 text-green-400" />
                              <span className="text-sm font-medium text-white/90">智能分析工具</span>
                            </div>
                            <ChevronDown className={`w-4 h-4 text-white/50 transition-transform duration-200 ${expandedGroups.has("智能分析工具") ? "rotate-180" : ""}`} />
                          </button>
                          <AnimatePresence>
                            {expandedGroups.has("智能分析工具") && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="overflow-hidden"
                              >
                                <div className="pl-4 pr-2 pb-1 space-y-1">
                                  <button
                                    onClick={() => {
                                      setShowCrossfadeMixer(true);
                                      setShowProfessionalTools(false);
                                    }}
                                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/10 transition-colors text-left"
                                  >
                                    <span className="text-sm text-white/80">交叉淡入淡出</span>
                                  </button>
                                  <button
                                    onClick={() => {
                                      setShowFingerprintScanner(true);
                                      setShowProfessionalTools(false);
                                    }}
                                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/10 transition-colors text-left"
                                  >
                                    <span className="text-sm text-white/80">音频指纹</span>
                                  </button>
                                  <button
                                    onClick={() => {
                                      setShowLibraryHealth(true);
                                      setShowProfessionalTools(false);
                                    }}
                                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/10 transition-colors text-left"
                                  >
                                    <span className="text-sm text-white/80">健康检查</span>
                                  </button>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Data Manager Link */}
              <motion.a
                href="/data-manager"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="ml-2 px-3.5 py-3.5 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-all whitespace-nowrap"
                style={{
                  background: "var(--theme-accent-pink)",
                  color: "#fff",
                }}
              >
                <svg className="w-3.5 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                  />
                </svg>
                管理音乐
              </motion.a>
            </nav>
          </div>
        </header>

        {/* Music Cards - Performance optimized */}
        <div
          className="absolute inset-0 pt-32"
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
      </motion.div>

      {/* Player View - GPU Optimized */}
      <motion.div
        className="absolute inset-0"
        initial={false}
        animate={{
          opacity: currentView === "player" ? 1 : 0,
          x: currentView === "player" ? 0 : 60,
          scale: currentView === "player" ? 1 : 0.94,
        }}
        transition={APPLE_SPRING_CONFIG}
        style={{
          pointerEvents: currentView === "player" ? "auto" : "none",
          visibility: currentView === "player" ? "visible" : "hidden",
          willChange: "transform, opacity",
          transform: "translateZ(0)",
          backfaceVisibility: "hidden",
        }}
      >
        <Player3D />
      </motion.div>

      {/* Emotion Matrix Modal */}
      <AnimatePresence>
        {showEmotionMatrix && (
          <EmotionMatrixView 
            isOpen={showEmotionMatrix} 
            onClose={() => setShowEmotionMatrix(false)} 
          />
        )}
      </AnimatePresence>

      {/* Visualization View - V8.0 更新 */}
      <VisualizationView />

      {/* Feature Buttons Container - V7.0 新增 */}
      <FeatureButtonsContainer
        onOpenFormatConverter={() => setShowFormatConverter(true)}
        onOpenTrackCutter={() => setShowTrackCutter(true)}
        onOpenFingerprintScanner={() => setShowFingerprintScanner(true)}
        onOpenDSDConverter={() => setShowDSDConverter(true)}
        onOpenCrossfadeMixer={() => setShowCrossfadeMixer(true)}
        onOpenLibraryHealth={() => setShowLibraryHealth(true)}
      />

      {/* Desktop Lyrics - Electron 桌面歌词 */}
      <DesktopLyrics />

      {/* Panels */}
      <QueuePanel isOpen={showQueue} onClose={() => setShowQueue(false)} />
      <HistoryPanel isOpen={showHistory} onClose={() => setShowHistory(false)} />
      <SettingsPanel
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        onOpenEQ={() => {
          setShowSettings(false);
          setShowEQ(true);
        }}
        onOpenVisualSettings={() => {
          setShowSettings(false);
          setShowVisualSettings(true);
        }}
      />
      <SleepTimerPanel isOpen={showSleepTimer} onClose={() => setShowSleepTimer(false)} />
      <SearchPanel isOpen={showSearch} onClose={() => setShowSearch(false)} />
      <LyricSettingsPanel isOpen={showLyricSettings} onClose={() => setShowLyricSettings(false)} />
      <AudioEqualizer isOpen={showEQ} onClose={() => setShowEQ(false)} />
      <VisualSettingsPanel
        isOpen={showVisualSettings}
        onClose={() => setShowVisualSettings(false)}
      />
      <KeyboardShortcutsHelp
        isOpen={showKeyboardShortcuts}
        onClose={() => setShowKeyboardShortcuts(false)}
      />
      <ListeningHistory
        isOpen={showListeningHistory}
        onClose={() => setShowListeningHistory(false)}
      />
      <DailyRecommendation
        isOpen={showDailyRecommendation}
        onClose={() => setShowDailyRecommendation(false)}
      />
      <LyricsImportPanel isOpen={showLyricsImport} onClose={() => setShowLyricsImport(false)} />
      <OfflineCachePanel isOpen={showOfflineCache} onClose={() => setShowOfflineCache(false)} />
      <SharePanel isOpen={showShare} onClose={() => setShowShare(false)} />
      <PlayerSkinsPanel isOpen={showPlayerSkins} onClose={() => setShowPlayerSkins(false)} />
      <LyricsSearchPanel isOpen={showLyricsSearch} onClose={() => setShowLyricsSearch(false)} />
      <LibraryManagerPanel
        isOpen={showLibraryManager}
        onClose={() => setShowLibraryManager(false)}
      />
      <LyricsCoverEditor
        isOpen={showLyricsCoverEditor}
        onClose={() => setShowLyricsCoverEditor(false)}
      />
      <SmartPlaylistPanel isOpen={showSmartPlaylist} onClose={() => setShowSmartPlaylist(false)} />
      <BackupRestorePanel isOpen={showBackupRestore} onClose={() => setShowBackupRestore(false)} />
      <StatsAchievementsPanel
        isOpen={showStatsAchievements}
        onClose={() => setShowStatsAchievements(false)}
      />
      <ProfessionalModePanel
        isOpen={showProfessionalMode}
        onClose={() => setShowProfessionalMode(false)}
      />
      <FormatConverter isOpen={showFormatConverter} onClose={() => setShowFormatConverter(false)} />
      <DSDConverter isOpen={showDSDConverter} onClose={() => setShowDSDConverter(false)} />
      <TrackCutter isOpen={showTrackCutter} onClose={() => setShowTrackCutter(false)} />
      <CrossfadeMixer isOpen={showCrossfadeMixer} onClose={() => setShowCrossfadeMixer(false)} />
      <FingerprintScannerPanel isOpen={showFingerprintScanner} onClose={() => setShowFingerprintScanner(false)} />
      <LibraryHealthPanel isOpen={showLibraryHealth} onClose={() => setShowLibraryHealth(false)} />
      <InstantMix isOpen={showInstantMix} onClose={() => setShowInstantMix(false)} />
      <SmartRandomModal
        isOpen={showSmartRandom}
        onClose={() => setShowSmartRandom(false)}
        currentSong={undefined}
      />

      {/* Toast notifications */}
      <GlassToastContainer />

      {/* Lightweight transition overlay - no blur for performance */}
      {isTransitioning && (
        <div
          className="absolute inset-0 bg-black/25 z-30 pointer-events-none"
          style={{
            opacity: 1,
            transition: "opacity 0.15s ease-out",
          }}
        />
      )}

      {/* Virtual Cursor */}
      <VirtualCursor />

      {/* Apple-style hint - only show on home view */}
      {currentView === "home" && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="absolute bottom-16 left-1/2 -translate-x-1/2 text-white/40 text-xs"
        >
          点击卡片播放音乐
        </motion.div>
      )}

      {/* Music Library Sync Provider */}
      <MusicLibrarySyncProvider />

      {/* Floating Emotion Radar Widget */}
      <div className="fixed bottom-8 right-8 z-[100]">
        <GlassRadarWidget />
      </div>
    </main>
  );
}
