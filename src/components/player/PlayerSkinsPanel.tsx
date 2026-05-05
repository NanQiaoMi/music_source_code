"use client";

import React, { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Palette,
  Check,
  RotateCcw,
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
} from "lucide-react";

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
  const [currentSkin, setCurrentSkin] = useState<PlayerSkin>(BUILT_IN_SKINS[0]);
  const [customSkins, setCustomSkins] = useState<PlayerSkin[]>([]);

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
      } catch (error) {
        console.error("Error deleting custom skin:", error);
      }
    },
    [customSkins]
  );

  const applySkin = useCallback((skin: PlayerSkin) => {
    setCurrentSkin(skin);
    document.documentElement.style.setProperty("--theme-primary", skin.primary);
    document.documentElement.style.setProperty("--theme-secondary", skin.secondary);
    document.documentElement.style.setProperty("--theme-accent", skin.accent);
    document.documentElement.style.setProperty("--theme-background", skin.background);
  }, []);

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

  const [showCustomEditor, setShowCustomEditor] = useState(false);
  const [customSkinDraft, setCustomSkinDraft] = useState<Partial<PlayerSkin>>({});

  React.useEffect(() => {
    loadCustomSkins();
  }, [loadCustomSkins]);

  const allSkins = [...builtInSkins, ...customSkins];

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
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-3xl max-h-[85vh] bg-gradient-to-br from-slate-900/90 to-slate-800/90 backdrop-blur-2xl rounded-3xl border border-white/20 shadow-2xl overflow-hidden flex flex-col"
      >
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSA2MCAwIEwgMCAwIDAgNjAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwwLjAzKSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-30 pointer-events-none" />

        <div className="relative z-10 flex flex-col h-full">
          <div className="flex items-center justify-between p-6 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-purple-500 flex items-center justify-center">
                <Palette className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-white text-xl font-semibold">播放器皮肤</h2>
                <p className="text-white/40 text-xs">自定义播放器外观主题</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowCustomEditor(true)}
                className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm flex items-center gap-2 transition-colors"
              >
                <Save className="w-4 h-4" />
                创建皮肤
              </button>
              <button
                onClick={onClose}
                className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 custom-scrollbar min-h-0">
            {showCustomEditor ? (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-white font-semibold">创建自定义皮肤</h3>
                  <button
                    onClick={() => {
                      setShowCustomEditor(false);
                      setCustomSkinDraft({});
                    }}
                    className="text-white/60 hover:text-white text-sm"
                  >
                    取消
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-white/60 text-sm mb-2 block">皮肤名称</label>
                    <input
                      type="text"
                      value={customSkinDraft.name || ""}
                      onChange={(e) =>
                        setCustomSkinDraft({ ...customSkinDraft, name: e.target.value })
                      }
                      placeholder="我的自定义皮肤"
                      className="w-full px-4 py-3 bg-white/5 rounded-xl text-white placeholder-white/40 outline-none focus:ring-2 focus:ring-purple-500/50"
                    />
                  </div>

                  <div>
                    <label className="text-white/60 text-sm mb-2 block">主题色</label>
                    <div className="flex flex-wrap gap-2">
                      {colorPresets.map((preset) => (
                        <button
                          key={preset.label}
                          onClick={() =>
                            setCustomSkinDraft({
                              ...customSkinDraft,
                              primary: preset.color,
                              secondary: preset.color,
                              accent: preset.color,
                            })
                          }
                          className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${
                            customSkinDraft.primary === preset.color
                              ? "ring-2 ring-white scale-110"
                              : ""
                          }`}
                          style={{ backgroundColor: preset.color }}
                          title={preset.label}
                        >
                          {customSkinDraft.primary === preset.color && (
                            <Check className="w-5 h-5 text-white" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-white/60 text-sm mb-2 block">背景色</label>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={customSkinDraft.background || "#0f0f23"}
                        onChange={(e) =>
                          setCustomSkinDraft({ ...customSkinDraft, background: e.target.value })
                        }
                        className="w-14 h-10 rounded-lg cursor-pointer bg-transparent"
                      />
                      <input
                        type="text"
                        value={customSkinDraft.background || ""}
                        onChange={(e) =>
                          setCustomSkinDraft({ ...customSkinDraft, background: e.target.value })
                        }
                        placeholder="rgb(15, 15, 35)"
                        className="flex-1 px-4 py-2 bg-white/5 rounded-xl text-white placeholder-white/40 text-sm outline-none focus:ring-2 focus:ring-purple-500/50"
                      />
                    </div>
                  </div>

                  <button
                    onClick={handleSaveCustomSkin}
                    disabled={!customSkinDraft.name || !customSkinDraft.primary}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white font-medium transition-all disabled:opacity-50"
                  >
                    保存皮肤
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="mb-6">
                  <h3 className="text-white font-semibold mb-4">内置皮肤</h3>
                  <div className="grid grid-cols-4 gap-3">
                    {builtInSkins.map((skin) => (
                      <button
                        key={skin.id}
                        onClick={() => handleApplySkin(skin)}
                        className={`relative p-3 rounded-xl transition-all ${
                          currentSkin.id === skin.id
                            ? "bg-white/20 ring-2 ring-white/50"
                            : "bg-white/5 hover:bg-white/10"
                        }`}
                      >
                        <div className="flex gap-1 mb-2">
                          <div
                            className="w-6 h-6 rounded"
                            style={{ backgroundColor: skin.primary }}
                          />
                          <div
                            className="w-6 h-6 rounded"
                            style={{ backgroundColor: skin.secondary }}
                          />
                          <div
                            className="w-6 h-6 rounded"
                            style={{ backgroundColor: skin.accent }}
                          />
                        </div>
                        <p className="text-white text-xs truncate">{skin.name}</p>
                        {currentSkin.id === skin.id && (
                          <div className="absolute top-2 right-2">
                            <Check className="w-4 h-4 text-white" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {customSkins.length > 0 && (
                  <div>
                    <h3 className="text-white font-semibold mb-4">自定义皮肤</h3>
                    <div className="grid grid-cols-4 gap-3">
                      {customSkins.map((skin) => (
                        <div
                          key={skin.id}
                          className={`relative p-3 rounded-xl ${
                            currentSkin.id === skin.id
                              ? "bg-white/20 ring-2 ring-white/50"
                              : "bg-white/5 hover:bg-white/10"
                          }`}
                        >
                          <button
                            onClick={() => handleApplySkin(skin)}
                            className="w-full text-left"
                          >
                            <div className="flex gap-1 mb-2">
                              <div
                                className="w-6 h-6 rounded"
                                style={{ backgroundColor: skin.primary }}
                              />
                              <div
                                className="w-6 h-6 rounded"
                                style={{ backgroundColor: skin.secondary }}
                              />
                              <div
                                className="w-6 h-6 rounded"
                                style={{ backgroundColor: skin.accent }}
                              />
                            </div>
                            <p className="text-white text-xs truncate">{skin.name}</p>
                          </button>
                          <button
                            onClick={() => deleteCustomSkin(skin.id)}
                            className="absolute top-2 right-2 w-6 h-6 rounded-full bg-red-500/50 hover:bg-red-500 flex items-center justify-center"
                          >
                            <X className="w-3 h-3 text-white" />
                          </button>
                          {currentSkin.id === skin.id && (
                            <div className="absolute top-2 left-2">
                              <Check className="w-4 h-4 text-white" />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};
