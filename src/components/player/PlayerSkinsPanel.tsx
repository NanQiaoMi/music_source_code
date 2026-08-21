"use client";

import React, { useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Palette,
  Check,
  Save,
  Download,
  Upload,
  Sparkles,
  Sun,
  Moon,
  Cloud,
  Flame,
  Leaf,
  Droplet,
  Zap,
  Trash2,
  Paintbrush,
  Disc,
  Layout,
  Plus
} from "lucide-react";
import {
  HALO_SKINS,
  getHaloRenderMode,
  getHaloSkin,
  paintHaloPreview,
  type HaloPaintContext,
} from "@/lib/skins/halo/haloSkins";
import { usePerformanceV8Store } from "@/store/performanceV8Store";
import { usePlayerSkinStore } from "@/store/playerSkinStore";
import { useVisualSettingsStore, type ThemeConfig } from "@/store/visualSettingsStore";
import { useUIStore } from "@/store/uiStore";

export interface PlayerSkin {
  id: string;
  name: string;
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  gradientType: "linear" | "radial" | "conic";
  isBuiltIn?: boolean;
}

const BUILT_IN_SKINS: PlayerSkin[] = [
  {
    id: "default",
    name: "默认紫罗兰",
    primary: "rgb(147, 51, 234)",
    secondary: "rgb(59, 130, 246)",
    accent: "rgb(236, 72, 153)",
    background: "rgb(15, 15, 35)",
    gradientType: "linear",
    isBuiltIn: true,
  },
  {
    id: "sunset",
    name: "落日余晖",
    primary: "rgb(251, 146, 60)",
    secondary: "rgb(251, 113, 133)",
    accent: "rgb(234, 179, 8)",
    background: "rgb(30, 20, 15)",
    gradientType: "linear",
    isBuiltIn: true,
  },
  {
    id: "ocean",
    name: "深海蓝调",
    primary: "rgb(14, 165, 233)",
    secondary: "rgb(6, 182, 212)",
    accent: "rgb(34, 211, 238)",
    background: "rgb(10, 25, 47)",
    gradientType: "linear",
    isBuiltIn: true,
  },
  {
    id: "forest",
    name: "森林秘境",
    primary: "rgb(34, 197, 94)",
    secondary: "rgb(16, 185, 129)",
    accent: "rgb(132, 204, 22)",
    background: "rgb(10, 30, 20)",
    gradientType: "linear",
    isBuiltIn: true,
  },
  {
    id: "fire",
    name: "烈焰红",
    primary: "rgb(239, 68, 68)",
    secondary: "rgb(220, 38, 38)",
    accent: "rgb(249, 115, 22)",
    background: "rgb(40, 10, 10)",
    gradientType: "linear",
    isBuiltIn: true,
  },
  {
    id: "mint",
    name: "薄荷清凉",
    primary: "rgb(20, 184, 166)",
    secondary: "rgb(6, 182, 212)",
    accent: "rgb(45, 212, 191)",
    background: "rgb(10, 30, 30)",
    gradientType: "radial",
    isBuiltIn: true,
  },
  {
    id: "aurora",
    name: "极光幻彩",
    primary: "rgb(139, 92, 246)",
    secondary: "rgb(236, 72, 153)",
    accent: "rgb(34, 211, 238)",
    background: "rgb(15, 10, 30)",
    gradientType: "conic",
    isBuiltIn: true,
  },
  {
    id: "neon",
    name: "霓虹夜城",
    primary: "rgb(236, 72, 153)",
    secondary: "rgb(139, 92, 246)",
    accent: "rgb(6, 182, 212)",
    background: "rgb(10, 10, 20)",
    gradientType: "linear",
    isBuiltIn: true,
  },
];

const SKINS_STORAGE_KEY = "player_custom_skins";

export const usePlayerSkins = () => {
  const activeBaseSkinId = usePlayerSkinStore((state) => state.activeBaseSkinId);
  const setActiveBaseSkinId = usePlayerSkinStore((state) => state.setActiveBaseSkinId);
  const { setThemeColors, setIsDynamicTheme } = useUIStore();
  const [customSkins, setCustomSkins] = useState<PlayerSkin[]>([]);

  const currentSkin = useMemo(
    () =>
      [...BUILT_IN_SKINS, ...customSkins].find((skin) => skin.id === activeBaseSkinId) ??
      BUILT_IN_SKINS[0],
    [activeBaseSkinId, customSkins]
  );

  const applySkinVariables = useCallback(
    (skin: PlayerSkin) => {
      document.documentElement.style.setProperty("--theme-primary", skin.primary);
      document.documentElement.style.setProperty("--theme-secondary", skin.secondary);
      document.documentElement.style.setProperty("--theme-accent", skin.accent);
      document.documentElement.style.setProperty("--theme-background", skin.background);

      setThemeColors({
        primary: skin.primary,
        secondary: skin.secondary,
        accent: skin.accent,
        background: skin.background,
        surface: skin.background,
        complementary: skin.secondary,
        gradient: [skin.primary, skin.secondary, skin.accent],
        text: "rgb(255, 255, 255)",
        textMuted: "rgba(255, 255, 255, 0.6)",
      });
    },
    [setThemeColors]
  );

  const loadCustomSkins = useCallback(() => {
    try {
      const stored = localStorage.getItem(SKINS_STORAGE_KEY);
      if (stored) {
        setCustomSkins(JSON.parse(stored));
      }
    } catch (error) {
      console.error("Error loading custom skins:", error);
    }
  }, []);

  const saveCustomSkin = useCallback(
    (skin: PlayerSkin) => {
      try {
        const newCustomSkins = [...customSkins, { ...skin, id: `custom_${Date.now()}` }];
        setCustomSkins(newCustomSkins);
        localStorage.setItem(SKINS_STORAGE_KEY, JSON.stringify(newCustomSkins));
      } catch (error) {
        console.error("Error saving custom skin:", error);
      }
    },
    [customSkins]
  );

  const deleteCustomSkin = useCallback(
    (skinId: string) => {
      try {
        const newCustomSkins = customSkins.filter((s) => s.id !== skinId);
        setCustomSkins(newCustomSkins);
        localStorage.setItem(SKINS_STORAGE_KEY, JSON.stringify(newCustomSkins));
        // Reset if active skin is deleted
        if (activeBaseSkinId === skinId) {
          setActiveBaseSkinId(BUILT_IN_SKINS[0].id);
        }
      } catch (error) {
        console.error("Error deleting custom skin:", error);
      }
    },
    [customSkins, activeBaseSkinId, setActiveBaseSkinId]
  );

  const applySkin = useCallback(
    (skin: PlayerSkin) => {
      setActiveBaseSkinId(skin.id);
      setIsDynamicTheme(false);
      applySkinVariables(skin);
    },
    [setActiveBaseSkinId, setIsDynamicTheme, applySkinVariables]
  );

  React.useEffect(() => {
    applySkinVariables(currentSkin);
  }, [currentSkin, applySkinVariables]);

  return {
    currentSkin,
    customSkins,
    builtInSkins: BUILT_IN_SKINS,
    loadCustomSkins,
    saveCustomSkin,
    deleteCustomSkin,
    applySkin,
  };
};

interface PlayerSkinsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PlayerSkinsPanel: React.FC<PlayerSkinsPanelProps> = ({ isOpen, onClose }) => {
  const {
    currentSkin,
    customSkins,
    builtInSkins,
    loadCustomSkins,
    saveCustomSkin,
    deleteCustomSkin,
    applySkin,
  } = usePlayerSkins();

  const [activeTab, setActiveTab] = useState<"skins" | "halo" | "themes">("skins");
  const [showCustomEditor, setShowCustomEditor] = useState(false);
  const [customSkinDraft, setCustomSkinDraft] = useState<Partial<PlayerSkin>>({});

  const activeHaloId = usePlayerSkinStore((state) => state.activeHaloId);
  const setActiveHaloId = usePlayerSkinStore((state) => state.setActiveHaloId);

  const {
    customThemes,
    exportCurrentTheme,
    importTheme,
    applyTheme,
    deleteCustomTheme,
    getBuiltInThemes,
  } = useVisualSettingsStore();
  const { config: performanceConfig } = usePerformanceV8Store();

  const [builtInThemes] = useState<ThemeConfig[]>(() => getBuiltInThemes());

  React.useEffect(() => {
    loadCustomSkins();
  }, [loadCustomSkins]);

  const handleExportTheme = () => {
    const json = exportCurrentTheme("自定义主题");
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "theme.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportTheme = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = ev.target?.result as string;
        const success = importTheme(text);
        if (!success) {
          alert("导入失败：无效的主题文件");
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const handleApplySkin = (skin: PlayerSkin) => {
    applySkin(skin);
  };

  const handleSaveCustomSkin = () => {
    if (customSkinDraft.name && customSkinDraft.primary && customSkinDraft.background) {
      const newSkin: PlayerSkin = {
        id: `custom_${Date.now()}`,
        name: customSkinDraft.name,
        primary: customSkinDraft.primary,
        secondary: customSkinDraft.secondary || customSkinDraft.primary,
        accent: customSkinDraft.accent || customSkinDraft.primary,
        background: customSkinDraft.background,
        gradientType: customSkinDraft.gradientType || "linear",
        isBuiltIn: false,
      };
      saveCustomSkin(newSkin);
      setShowCustomEditor(false);
      setCustomSkinDraft({});
    }
  };

  const activeHalo = getHaloSkin(activeHaloId);
  const haloRenderMode = getHaloRenderMode({
    targetFps: performanceConfig.targetFPS,
    reducedMotion:
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true,
  });

  const colorPresets = [
    { icon: Sparkles, color: "rgb(147, 51, 234)", label: "紫色" },
    { icon: Sun, color: "rgb(251, 146, 60)", label: "橙色" },
    { icon: Flame, color: "rgb(239, 68, 68)", label: "红色" },
    { icon: Leaf, color: "rgb(34, 197, 94)", label: "绿色" },
    { icon: Droplet, color: "rgb(14, 165, 233)", label: "蓝色" },
    { icon: Moon, color: "rgb(139, 92, 246)", label: "靛蓝" },
    { icon: Cloud, color: "rgb(236, 72, 153)", label: "粉色" },
    { icon: Zap, color: "rgb(234, 179, 8)", label: "黄色" },
  ];

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xl"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 10 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 10 }}
          transition={{ type: "spring", damping: 25, stiffness: 200 }}
          onClick={(e) => e.stopPropagation()}
          className="relative flex w-[900px] h-[600px] max-w-[95vw] max-h-[90vh] bg-[#1a1a1f]/80 backdrop-blur-3xl rounded-[32px] border border-white/10 shadow-[0_32px_80px_rgba(0,0,0,0.5)] overflow-hidden"
        >
          {/* Subtle noise texture */}
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] pointer-events-none mix-blend-overlay" />

          {/* Sidebar */}
          <div className="w-[220px] shrink-0 border-r border-white/5 bg-white/[0.02] flex flex-col pt-8 pb-6 px-4">
            <h2 className="text-xl font-bold text-white px-3 mb-6 tracking-wide">外观设置</h2>
            <div className="space-y-1">
              <SidebarItem
                icon={<Paintbrush className="w-4 h-4" />}
                label="播放器皮肤"
                isActive={activeTab === "skins"}
                onClick={() => setActiveTab("skins")}
              />
              <SidebarItem
                icon={<Disc className="w-4 h-4" />}
                label="光晕动效 (Halo)"
                isActive={activeTab === "halo"}
                onClick={() => setActiveTab("halo")}
              />
              <SidebarItem
                icon={<Layout className="w-4 h-4" />}
                label="应用主题"
                isActive={activeTab === "themes"}
                onClick={() => setActiveTab("themes")}
              />
            </div>

            <div className="mt-auto">
              <button
                onClick={onClose}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-white/60 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-4 h-4" />
                <span className="text-sm font-medium">关闭面板</span>
              </button>
            </div>
          </div>

          {/* Content Area */}
          <div className="flex-1 relative overflow-y-auto custom-scrollbar p-8">
            <AnimatePresence mode="wait">
              {activeTab === "skins" && (
                <motion.div
                  key="skins"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-10"
                >
                  {/* Built-in Skins */}
                  <section>
                    <div className="mb-5 flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-white/90">精选皮肤</h3>
                      {!showCustomEditor && (
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => setShowCustomEditor(true)}
                          className="flex items-center gap-2 text-sm text-purple-400 hover:text-purple-300 font-medium"
                        >
                          <Plus className="w-4 h-4" />
                          自定义皮肤
                        </motion.button>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-4 gap-4">
                      {builtInSkins.map((skin) => (
                        <SkinCard
                          key={skin.id}
                          skin={skin}
                          isActive={currentSkin.id === skin.id}
                          onClick={() => handleApplySkin(skin)}
                        />
                      ))}
                    </div>
                  </section>

                  {/* Halo Light Packs */}
                  <section className="pt-4 border-t border-white/5">
                    <div className="mb-4 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-purple-400" />
                        <h3 className="text-lg font-semibold text-white/90">Halo 光晕音效与动态光环</h3>
                      </div>
                      <HaloPreviewCanvas skin={activeHalo} renderMode={haloRenderMode} />
                    </div>
                    <div className="grid grid-cols-4 gap-3">
                      {HALO_SKINS.map((halo) => (
                        <motion.button
                          key={halo.id}
                          whileHover={{ scale: 1.03 }}
                          whileTap={{ scale: 0.97 }}
                          onClick={() => setActiveHaloId(halo.id)}
                          className={`p-3.5 rounded-2xl border text-left transition-all ${
                            activeHalo.id === halo.id
                              ? "border-white/30 bg-white/10 shadow-md"
                              : "border-white/5 bg-white/[0.02] hover:bg-white/[0.06]"
                          }`}
                        >
                          <div className="w-6 h-1 rounded-full mb-2" style={{ background: halo.accent }} />
                          <h4 className="text-sm font-medium text-white">{halo.name}</h4>
                          <p className="text-xs text-white/40 truncate">{halo.description}</p>
                        </motion.button>
                      ))}
                    </div>
                  </section>

                  {/* Custom Skins */}
                  {customSkins.length > 0 && (
                    <section>
                      <h3 className="text-lg font-semibold text-white/90 mb-5">我的皮肤</h3>
                      <div className="grid grid-cols-4 gap-4">
                        {customSkins.map((skin) => (
                          <SkinCard
                            key={skin.id}
                            skin={skin}
                            isActive={currentSkin.id === skin.id}
                            onClick={() => handleApplySkin(skin)}
                            onDelete={() => deleteCustomSkin(skin.id)}
                            isCustom
                          />
                        ))}
                      </div>
                    </section>
                  )}

                  {/* Custom Skin Editor Popover */}
                  <AnimatePresence>
                    {showCustomEditor && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="bg-white/5 border border-white/10 rounded-[24px] p-6 mt-6 backdrop-blur-md">
                          <div className="flex items-center justify-between mb-6">
                            <h3 className="text-white font-semibold flex items-center gap-2">
                              <Palette className="w-5 h-5 text-purple-400" />
                              调配新皮肤
                            </h3>
                            <button
                              onClick={() => {
                                setShowCustomEditor(false);
                                setCustomSkinDraft({});
                              }}
                              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 transition-colors"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>

                          <div className="space-y-5">
                            <div>
                              <label className="text-white/60 text-sm font-medium mb-2 block">皮肤名称</label>
                              <input
                                type="text"
                                value={customSkinDraft.name || ""}
                                onChange={(e) =>
                                  setCustomSkinDraft({ ...customSkinDraft, name: e.target.value })
                                }
                                placeholder="输入皮肤名称..."
                                className="w-full px-4 py-3 bg-black/20 rounded-xl border border-white/5 text-white placeholder-white/30 outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50 transition-all"
                              />
                            </div>

                            <div>
                              <label className="text-white/60 text-sm font-medium mb-2 block">主题调色板</label>
                              <div className="flex flex-wrap gap-3">
                                {colorPresets.map((preset) => (
                                  <motion.button
                                    whileHover={{ scale: 1.1 }}
                                    whileTap={{ scale: 0.9 }}
                                    key={preset.label}
                                    onClick={() =>
                                      setCustomSkinDraft({
                                        ...customSkinDraft,
                                        primary: preset.color,
                                        secondary: preset.color,
                                        accent: preset.color,
                                      })
                                    }
                                    className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg transition-shadow ${
                                      customSkinDraft.primary === preset.color
                                        ? "ring-2 ring-white ring-offset-2 ring-offset-[#1a1a1f]"
                                        : "hover:shadow-xl"
                                    }`}
                                    style={{ backgroundColor: preset.color }}
                                    title={preset.label}
                                  >
                                    {customSkinDraft.primary === preset.color && (
                                      <Check className="w-5 h-5 text-white" />
                                    )}
                                  </motion.button>
                                ))}
                              </div>
                            </div>

                            <div>
                              <label className="text-white/60 text-sm font-medium mb-2 block">深色背景底色</label>
                              <div className="flex gap-3">
                                <div className="relative">
                                  <input
                                    type="color"
                                    value={customSkinDraft.background || "#0f0f23"}
                                    onChange={(e) =>
                                      setCustomSkinDraft({ ...customSkinDraft, background: e.target.value })
                                    }
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                  />
                                  <div 
                                    className="w-12 h-12 rounded-xl border-2 border-white/20 shadow-inner"
                                    style={{ backgroundColor: customSkinDraft.background || "#0f0f23" }}
                                  />
                                </div>
                                <input
                                  type="text"
                                  value={customSkinDraft.background || ""}
                                  onChange={(e) =>
                                    setCustomSkinDraft({ ...customSkinDraft, background: e.target.value })
                                  }
                                  placeholder="如: rgb(15, 15, 35) 或 #0f0f23"
                                  className="flex-1 px-4 py-3 bg-black/20 rounded-xl border border-white/5 text-white placeholder-white/30 text-sm outline-none focus:border-purple-500/50 transition-all"
                                />
                              </div>
                            </div>

                            <motion.button
                              whileHover={{ scale: 1.01 }}
                              whileTap={{ scale: 0.99 }}
                              onClick={handleSaveCustomSkin}
                              disabled={!customSkinDraft.name || !customSkinDraft.primary}
                              className="w-full py-3.5 mt-2 rounded-xl bg-white text-black font-semibold shadow-[0_0_20px_rgba(255,255,255,0.3)] transition-all disabled:opacity-50 disabled:shadow-none hover:bg-white/90"
                            >
                              保存并应用皮肤
                            </motion.button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}

              {activeTab === "halo" && (
                <motion.div
                  key="halo"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-8 h-full flex flex-col"
                >
                  <div className="flex-shrink-0 flex items-center justify-center p-12 bg-black/20 rounded-[32px] border border-white/5 relative overflow-hidden group">
                     {/* Breathing animated background behind halo */}
                     <motion.div 
                        className="absolute inset-0 bg-gradient-to-br opacity-20"
                        style={{ 
                          backgroundImage: `radial-gradient(circle at center, ${activeHalo.accent} 0%, transparent 70%)`
                        }}
                        animate={{ opacity: [0.1, 0.3, 0.1] }}
                        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                     />
                     <div className="relative z-10 transform scale-150 drop-shadow-2xl">
                       <HaloPreviewCanvas skin={activeHalo} renderMode={haloRenderMode} />
                     </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 flex-1">
                    {HALO_SKINS.map((halo) => (
                      <motion.button
                        key={halo.id}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setActiveHaloId(halo.id)}
                        className={`relative p-5 rounded-2xl border text-left transition-all overflow-hidden ${
                          activeHalo.id === halo.id
                            ? "border-white/30 bg-white/10 shadow-[0_8px_32px_rgba(255,255,255,0.05)]"
                            : "border-white/5 bg-white/[0.02] hover:bg-white/[0.06]"
                        }`}
                      >
                        <div
                          className="w-8 h-1 rounded-full mb-4"
                          style={{ background: halo.accent }}
                        />
                        <h4 className="text-base font-medium text-white mb-1">{halo.name}</h4>
                        <p className="text-sm text-white/50">{halo.description}</p>
                        
                        {activeHalo.id === halo.id && (
                          <div className="absolute top-5 right-5">
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-md"
                            >
                              <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                            </motion.div>
                          </div>
                        )}
                      </motion.button>
                    ))}
                  </div>
                </motion.div>
              )}

              {activeTab === "themes" && (
                <motion.div
                  key="themes"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-8"
                >
                  <div className="flex gap-4 mb-2">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleExportTheme}
                      className="flex-1 py-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 text-white text-sm font-medium flex items-center justify-center gap-2 transition-all shadow-sm"
                    >
                      <Download className="w-4 h-4" />
                      导出当前主题
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleImportTheme}
                      className="flex-1 py-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 text-white text-sm font-medium flex items-center justify-center gap-2 transition-all shadow-sm"
                    >
                      <Upload className="w-4 h-4" />
                      导入外部主题
                    </motion.button>
                  </div>

                  <div>
                    <h4 className="text-white/80 text-sm font-medium mb-4 flex items-center gap-2">
                      <Layout className="w-4 h-4" />
                      系统内置主题
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                      {builtInThemes.map((theme) => (
                        <motion.button
                          key={theme.name}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => applyTheme(theme)}
                          className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.08] transition-all text-left group"
                        >
                          <div className="flex gap-2 mb-3">
                            <div className="w-6 h-6 rounded-full shadow-sm" style={{ backgroundColor: theme.colors.primary }} />
                            <div className="w-6 h-6 rounded-full shadow-sm" style={{ backgroundColor: theme.colors.secondary }} />
                            <div className="w-6 h-6 rounded-full shadow-sm" style={{ backgroundColor: theme.colors.accent }} />
                            <div className="w-6 h-6 rounded-full shadow-sm border border-white/10" style={{ backgroundColor: theme.colors.surface }} />
                            <div className="w-6 h-6 rounded-full shadow-sm border border-white/10" style={{ backgroundColor: theme.colors.background }} />
                          </div>
                          <p className="text-white text-sm font-medium">{theme.name}</p>
                        </motion.button>
                      ))}
                    </div>
                  </div>

                  {customThemes.length > 0 && (
                    <div>
                      <h4 className="text-white/80 text-sm font-medium mb-4">我保存的主题</h4>
                      <div className="space-y-3">
                        {customThemes.map((theme) => (
                          <div
                            key={theme.name}
                            className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.03] border border-white/5 group hover:bg-white/[0.06] transition-all"
                          >
                            <div className="flex items-center gap-4">
                              <div className="flex -space-x-2">
                                <div className="w-8 h-8 rounded-full border-2 border-[#1a1a1f]" style={{ backgroundColor: theme.colors.primary }} />
                                <div className="w-8 h-8 rounded-full border-2 border-[#1a1a1f]" style={{ backgroundColor: theme.colors.secondary }} />
                                <div className="w-8 h-8 rounded-full border-2 border-[#1a1a1f]" style={{ backgroundColor: theme.colors.accent }} />
                              </div>
                              <span className="text-white font-medium">{theme.name}</span>
                            </div>
                            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => applyTheme(theme)}
                                className="px-4 py-1.5 rounded-xl bg-white text-black text-sm font-medium hover:bg-white/90 transition-colors shadow-sm"
                              >
                                应用
                              </button>
                              <button
                                onClick={() => deleteCustomTheme(theme.name)}
                                className="w-8 h-8 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 flex items-center justify-center transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

// Extracted Sub-components for Cleaner Code

function SidebarItem({ icon, label, isActive, onClick }: { icon: React.ReactNode, label: string, isActive: boolean, onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-3 rounded-2xl transition-all duration-300 relative ${
        isActive ? "text-white bg-white/10" : "text-white/60 hover:text-white/90 hover:bg-white/5"
      }`}
    >
      {isActive && (
        <motion.div 
          layoutId="sidebar-active-indicator"
          className="absolute left-0 top-1/4 bottom-1/4 w-1 bg-white rounded-r-full"
        />
      )}
      <div className={`${isActive ? "text-white" : ""}`}>
        {icon}
      </div>
      <span className="text-sm font-medium tracking-wide">{label}</span>
    </button>
  );
}

function SkinCard({ skin, isActive, onClick, onDelete, isCustom }: { skin: PlayerSkin, isActive: boolean, onClick: () => void, onDelete?: () => void, isCustom?: boolean }) {
  return (
    <motion.div
      data-player-skin-id={skin.id}
      whileHover={{ scale: 1.03, y: -2 }}
      whileTap={{ scale: 0.97 }}
      className="relative group cursor-pointer"
      onClick={onClick}
    >
      {isActive && (
        <motion.div 
          className="absolute -inset-2 rounded-3xl opacity-20 blur-xl"
          style={{ backgroundColor: skin.primary }}
          animate={{ opacity: [0.15, 0.3, 0.15], scale: [0.95, 1.05, 0.95] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        />
      )}
      <div className={`relative h-full p-4 rounded-[20px] transition-all duration-300 border backdrop-blur-md overflow-hidden ${
        isActive 
          ? "bg-white/15 border-white/30 shadow-[0_8px_32px_rgba(0,0,0,0.2)]" 
          : "bg-white/[0.04] border-white/10 hover:bg-white/[0.08] hover:border-white/20"
      }`}>
        
        {/* Abstract background blobs for visual flair */}
        <div className="absolute top-[-20%] right-[-20%] w-[80%] h-[80%] rounded-full opacity-20 blur-2xl pointer-events-none" style={{ backgroundColor: skin.primary }} />
        <div className="absolute bottom-[-20%] left-[-20%] w-[60%] h-[60%] rounded-full opacity-20 blur-xl pointer-events-none" style={{ backgroundColor: skin.secondary }} />

        <div className="flex gap-1.5 mb-6 relative z-10">
          <div className="w-8 h-8 rounded-full shadow-lg" style={{ backgroundColor: skin.primary }} />
          <div className="w-8 h-8 rounded-full shadow-lg -ml-3" style={{ backgroundColor: skin.secondary }} />
          <div className="w-8 h-8 rounded-full shadow-lg -ml-3 border border-white/20" style={{ backgroundColor: skin.accent }} />
        </div>
        
        <p className="text-white text-sm font-medium tracking-wide relative z-10">{skin.name}</p>

        {isActive && (
          <motion.div 
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="absolute top-3 right-3 w-6 h-6 bg-white rounded-full flex items-center justify-center shadow-md z-10"
          >
            <Check className="w-3.5 h-3.5 text-black stroke-[3]" />
          </motion.div>
        )}

        {isCustom && onDelete && (
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="absolute top-3 right-3 w-6 h-6 rounded-full bg-red-500/80 hover:bg-red-500 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity z-10"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        )}
      </div>
    </motion.div>
  );
}

function HaloPreviewCanvas({
  skin,
  renderMode,
}: {
  skin: (typeof HALO_SKINS)[number];
  renderMode: ReturnType<typeof getHaloRenderMode>;
}) {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);

  React.useEffect(() => {
    const context = canvasRef.current?.getContext("2d");
    if (!context) return;

    paintHaloPreview(context as unknown as HaloPaintContext, skin, {
      currentTime: 0,
      level: 0.72,
      renderMode,
    });
  }, [renderMode, skin]);

  return (
    <canvas
      ref={canvasRef}
      width={120}
      height={120}
      className="h-32 w-32 rounded-full shadow-[0_0_40px_rgba(255,255,255,0.1)] border border-white/10"
      aria-label={`${skin.name} halo preview`}
    />
  );
}
