"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
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
  BookOpen,
  Disc3,
  Scissors,
  Waves,
  ChevronDown,
  Wrench,
  Dice1,
  Maximize2,
  Minimize2,
  Dna,
  MousePointer2,
} from "lucide-react";
import { useUIStore } from "@/store/uiStore";
import { usePlaylistStore } from "@/store/playlistStore";
import { useGestureStore } from "@/store/gestureStore";

import { Logo } from "@/components/layout/Logo";
import { AIToolbox } from "@/components/layout/AIToolbox";
import { HoverHub } from "@/components/layout/HoverHub";

/**
 * HeaderToolbar - The primary navigation and tool selection bar.
 *
 * Extracted from page.tsx to improve modularity and reduce main component size.
 * Uses centralized panel management from uiStore.
 */
export function HeaderToolbar() {
  const { currentView, openPanel, panels, isFullscreen, toggleFullscreen } = useUIStore();
  const { songs } = usePlaylistStore();
  const { isEnabled: isGestureEnabled, toggleGestureEnabled } = useGestureStore();

  const [showProfessionalTools, setShowProfessionalTools] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    new Set(["Mode and settings", "Audio tools", "Analysis tools"])
  );
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

  // Close professional tools dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        professionalToolsRef.current &&
        !professionalToolsRef.current.contains(event.target as Node)
      ) {
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

  return (
    <motion.header
      initial={{ opacity: 0, y: -10 }}
      animate={{
        opacity: currentView === "home" ? 1 : 0,
        y: currentView === "home" ? 0 : -10,
      }}
      transition={{
        duration: 0.4,
        ease: [0.23, 1, 0.32, 1],
        delay: currentView === "home" ? 0.05 : 0,
      }}
      className="absolute top-0 left-0 right-0 z-20 pt-14 pb-4 px-4 backdrop-blur-xl"
      style={{
        background: "rgba(0,0,0,0.5)",
        borderBottom: "1px solid var(--theme-border)",
        willChange: "transform, opacity",
      }}
    >
      <div className="flex items-center justify-between max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, x: -15 }}
          animate={{
            opacity: currentView === "home" ? 1 : 0,
            x: currentView === "home" ? 0 : -15,
          }}
          transition={{
            type: "spring",
            stiffness: 260,
            damping: 30,
            delay: currentView === "home" ? 0.08 : 0,
          }}
          className="flex items-center gap-2 min-w-0 flex-shrink-0"
        >
          <Logo size={46} className="drop-shadow-2xl flex-shrink-0" />
          <div className="flex flex-col justify-center min-w-0">
            <h1
              className="text-[26px] font-bold tracking-tight leading-tight whitespace-nowrap overflow-hidden text-ellipsis"
              style={{ color: "var(--theme-text-primary)" }}
            >
              Music Library
            </h1>
            <p
              className="text-[13px] font-medium opacity-60 whitespace-nowrap overflow-hidden text-ellipsis"
              style={{ color: "var(--theme-text-secondary)" }}
            >
              {songs.length > 0 ? `${songs.length} songs` : "Import music to begin"}
            </p>
          </div>
        </motion.div>

        <motion.nav
          initial={{ opacity: 0, x: 15 }}
          animate={{
            opacity: currentView === "home" ? 1 : 0,
            x: currentView === "home" ? 0 : 15,
          }}
          transition={{
            type: "spring",
            stiffness: 260,
            damping: 30,
            delay: currentView === "home" ? 0.08 : 0,
          }}
          className="flex items-center gap-1.5"
        >
          {/* 1. Essential Tools */}
          <button
            onClick={() => openPanel("search")}
            className="w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-200 hover:bg-white/10"
            style={{ color: "var(--theme-text-secondary)" }}
            title="Quick search"
          >
            <Search className="w-5 h-5" />
          </button>

          {/* 2. Interactive Shortcuts */}
          <button
            onClick={() => openPanel("keyboardShortcuts")}
            className="group relative w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-500"
            style={{
              background: panels.keyboardShortcuts ? "rgba(255, 255, 255, 0.1)" : "transparent",
              color: panels.keyboardShortcuts ? "white" : "var(--theme-text-secondary)",
            }}
            title="Keyboard shortcuts"
          >
            <motion.div
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              className="relative z-10"
            >
              <MousePointer2 className="w-[18px] h-[18px]" />
              {panels.keyboardShortcuts && (
                <motion.div
                  layoutId="shortcut-glow"
                  className="absolute inset-0 bg-white/20 blur-xl rounded-full -z-10"
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1.8 }}
                />
              )}
            </motion.div>
          </button>

          <button
            onClick={toggleGestureEnabled}
            className="group relative w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-500"
            style={{
              background: isGestureEnabled ? "rgba(255, 255, 255, 0.15)" : "transparent",
              color: isGestureEnabled ? "white" : "var(--theme-text-secondary)",
            }}
            title="Gesture control"
          >
            <motion.div
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              animate={
                isGestureEnabled
                  ? {
                      y: [0, -2, 0],
                      transition: { repeat: Infinity, duration: 2, ease: "easeInOut" },
                    }
                  : {}
              }
              className="relative z-10"
            >
              <Hand className="w-[18px] h-[18px]" />
              {isGestureEnabled && (
                <motion.div
                  layoutId="gesture-glow"
                  className="absolute inset-0 bg-white/20 blur-lg rounded-full -z-10"
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 0.8, scale: 1.5 }}
                />
              )}
            </motion.div>
          </button>

          <div className="w-[1px] h-6 bg-white/10 mx-1" />

          {/* 3. Lyric Hub */}
          <HoverHub
            label="Lyrics"
            accentColor="rgba(59, 130, 246, 0.5)"
            mainIcon={<Type className="w-[18px] h-[18px]" />}
            items={[
              {
                id: "lyricSettings",
                label: "Lyric style",
                icon: <Type className="w-4 h-4" />,
                action: () => openPanel("lyricSettings"),
              },
              {
                id: "lyricsSearch",
                label: "Online lyrics",
                icon: <Music className="w-4 h-4" />,
                action: () => openPanel("lyricsSearch"),
              },
              {
                id: "lyricsImport",
                label: "Import lyrics",
                icon: <FileText className="w-4 h-4" />,
                action: () => openPanel("lyricsImport"),
              },
              {
                id: "lyricsCoverEditor",
                label: "Cover editor",
                icon: <Edit3 className="w-4 h-4" />,
                action: () => openPanel("lyricsCoverEditor"),
              },
            ]}
          />

          {/* 4. Library Hub */}
          <HoverHub
            label="Library"
            accentColor="rgba(16, 185, 129, 0.5)"
            mainIcon={<Database className="w-[18px] h-[18px]" />}
            items={[
              {
                id: "libraryManager",
                label: "Music library",
                icon: <Database className="w-4 h-4" />,
                action: () => openPanel("libraryManager"),
              },
              {
                id: "smartPlaylist",
                label: "Smart playlists",
                icon: <ListOrdered className="w-4 h-4" />,
                action: () => openPanel("smartPlaylist"),
              },
              {
                id: "offlineCache",
                label: "Offline cache",
                icon: <Cloud className="w-4 h-4" />,
                action: () => openPanel("offlineCache"),
              },
              {
                id: "backupRestore",
                label: "Backup and restore",
                icon: <HardDrive className="w-4 h-4" />,
                action: () => openPanel("backupRestore"),
              },
            ]}
          />

          {/* 5. Inspiration Hub */}
          <HoverHub
            label="Discover"
            accentColor="rgba(245, 158, 11, 0.5)"
            mainIcon={<Sparkles className="w-[18px] h-[18px]" />}
            items={[
              {
                id: "dailyRecommendation",
                label: "Daily recommendations",
                icon: <Sparkles className="w-4 h-4" />,
                action: () => openPanel("dailyRecommendation"),
              },
              {
                id: "dnaJournal",
                label: "Listening DNA",
                icon: <Dna className="w-4 h-4" />,
                action: () => openPanel("dnaJournal"),
              },
              {
                id: "listeningHistory",
                label: "Listening history",
                icon: <TrendingUp className="w-4 h-4" />,
                action: () => openPanel("listeningHistory"),
              },
              {
                id: "listeningJournal",
                label: "Listening Journal",
                icon: <BookOpen className="w-4 h-4" />,
                action: () => openPanel("listeningJournal"),
              },
              {
                id: "statsAchievements",
                label: "Stats and badges",
                icon: <Award className="w-4 h-4" />,
                action: () => openPanel("statsAchievements"),
              },
              {
                id: "instantMix",
                label: "Instant mix",
                icon: <Dice1 className="w-4 h-4" />,
                action: () => openPanel("instantMix"),
              },
              {
                id: "smartMixSession",
                label: "Smart Mix",
                icon: <Sparkles className="w-4 h-4" />,
                action: () => openPanel("smartMixSession"),
              },
            ]}
          />

          <div className="w-[1px] h-6 bg-white/10 mx-1" />

          {/* 6. AI Hub (Existing AIToolbox) */}
          <AIToolbox />

          <div className="w-[1px] h-6 bg-white/10 mx-1" />

          {/* 7. System Suite */}
          <HoverHub
            label="Tools"
            accentColor="rgba(139, 92, 246, 0.5)"
            mainIcon={<Wrench className="w-[18px] h-[18px]" />}
            items={[
              {
                id: "settings",
                label: "Preferences",
                icon: <Settings className="w-4 h-4" />,
                action: () => openPanel("settings"),
              },
              {
                id: "playerSkins",
                label: "Player skins",
                icon: <Palette className="w-4 h-4" />,
                action: () => openPanel("playerSkins"),
              },
              {
                id: "sleepTimer",
                label: "Sleep timer",
                icon: <Moon className="w-4 h-4" />,
                action: () => openPanel("sleepTimer"),
              },
              {
                id: "share",
                label: "Share music",
                icon: <Share2 className="w-4 h-4" />,
                action: () => openPanel("share"),
              },
              {
                id: "keyboardShortcuts",
                label: "Keyboard shortcuts",
                icon: <span className="text-[10px] font-bold">?</span>,
                action: () => openPanel("keyboardShortcuts"),
              },
            ]}
          />

          <button
            onClick={toggleFullscreen}
            className="w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-200 hover:bg-white/10"
            style={{
              color: isFullscreen ? "#fff" : "var(--theme-text-secondary)",
              background: isFullscreen ? "rgba(255, 255, 255, 0.1)" : "transparent",
            }}
          >
            {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
          </button>

          {/* Professional Tools Dropdown */}
          <div className="relative" ref={professionalToolsRef}>
            <button
              onClick={() => setShowProfessionalTools(!showProfessionalTools)}
              className="w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-200 hover:bg-white/10"
              style={{
                background: showProfessionalTools ? "rgba(255, 255, 255, 0.2)" : "transparent",
                color: showProfessionalTools ? "#fff" : "var(--theme-text-secondary)",
                boxShadow: showProfessionalTools ? "0 0 15px rgba(255, 255, 255, 0.2)" : "none",
              }}
              title="Professional tools"
            >
              <Wrench className="w-[18px] h-[18px]" />
              <ChevronDown
                className={`w-3 h-3 ml-0.5 transition-transform duration-200 ${showProfessionalTools ? "rotate-180" : ""}`}
              />
            </button>

            <AnimatePresence>
              {showProfessionalTools && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{
                    duration: 0.25,
                    ease: [0.23, 1, 0.32, 1],
                  }}
                  style={{
                    transformOrigin: "top right",
                    willChange: "transform, opacity",
                  }}
                  className="absolute right-0 top-full mt-2 w-64 bg-black/70 backdrop-blur-3xl rounded-2xl border border-white/10 shadow-[0_20px_40px_rgba(0,0,0,0.4)] overflow-hidden z-50"
                >
                  <div className="p-2 space-y-1">
                    <div className="text-xs font-semibold text-white/50 px-3 py-2 uppercase tracking-wider">
                      Professional tools
                    </div>

                    {/* Mode and settings */}
                    <div>
                      <button
                        onClick={() => toggleGroup("Mode and settings")}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-white/10 transition-colors text-left"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-white/90">
                            Mode and settings
                          </span>
                        </div>
                        <ChevronDown
                          className={`w-4 h-4 text-white/50 transition-transform duration-200 ${expandedGroups.has("Mode and settings") ? "rotate-180" : ""}`}
                        />
                      </button>
                      <AnimatePresence>
                        {expandedGroups.has("Mode and settings") && (
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
                                  openPanel("professionalMode");
                                  setShowProfessionalTools(false);
                                }}
                                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/10 transition-colors text-left"
                              >
                                <span className="text-sm text-white/80">Professional mode</span>
                              </button>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Audio tools */}
                    <div>
                      <button
                        onClick={() => toggleGroup("Audio tools")}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-white/10 transition-colors text-left"
                      >
                        <div className="flex items-center gap-2">
                          <Disc3 className="w-4 h-4 text-pink-400" />
                          <span className="text-sm font-medium text-white/90">Audio tools</span>
                        </div>
                        <ChevronDown
                          className={`w-4 h-4 text-white/50 transition-transform duration-200 ${expandedGroups.has("Audio tools") ? "rotate-180" : ""}`}
                        />
                      </button>
                      <AnimatePresence>
                        {expandedGroups.has("Audio tools") && (
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
                                  openPanel("formatConverter");
                                  setShowProfessionalTools(false);
                                }}
                                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/10 transition-colors text-left"
                              >
                                <span className="text-sm text-white/80">Format converter</span>
                              </button>
                              <button
                                onClick={() => {
                                  openPanel("dsdConverter");
                                  setShowProfessionalTools(false);
                                }}
                                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/10 transition-colors text-left"
                              >
                                <span className="text-sm text-white/80">DSD converter</span>
                              </button>
                              <button
                                onClick={() => {
                                  openPanel("trackCutter");
                                  setShowProfessionalTools(false);
                                }}
                                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/10 transition-colors text-left"
                              >
                                <Scissors className="w-4 h-4 text-purple-400" />
                                <span className="text-sm text-white/80">Track cutter</span>
                              </button>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Analysis tools */}
                    <div>
                      <button
                        onClick={() => toggleGroup("Analysis tools")}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-white/10 transition-colors text-left"
                      >
                        <div className="flex items-center gap-2">
                          <Waves className="w-4 h-4 text-green-400" />
                          <span className="text-sm font-medium text-white/90">Analysis tools</span>
                        </div>
                        <ChevronDown
                          className={`w-4 h-4 text-white/50 transition-transform duration-200 ${expandedGroups.has("Analysis tools") ? "rotate-180" : ""}`}
                        />
                      </button>
                      <AnimatePresence>
                        {expandedGroups.has("Analysis tools") && (
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
                                  openPanel("crossfadeMixer");
                                  setShowProfessionalTools(false);
                                }}
                                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/10 transition-colors text-left"
                              >
                                <span className="text-sm text-white/80">Crossfade mixer</span>
                              </button>
                              <button
                                onClick={() => {
                                  openPanel("fingerprintScanner");
                                  setShowProfessionalTools(false);
                                }}
                                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/10 transition-colors text-left"
                              >
                                <span className="text-sm text-white/80">Audio fingerprint</span>
                              </button>
                              <button
                                onClick={() => {
                                  openPanel("libraryHealth");
                                  setShowProfessionalTools(false);
                                }}
                                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/10 transition-colors text-left"
                              >
                                <span className="text-sm text-white/80">Library health</span>
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
              background: "#fff",
              color: "#000",
              boxShadow: "0 0 20px rgba(255, 255, 255, 0.3)",
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
            Manage music
          </motion.a>
        </motion.nav>
      </div>
    </motion.header>
  );
}
