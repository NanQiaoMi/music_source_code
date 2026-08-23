import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
  MusicSourceId,
  SingleSourceConfig,
  LXCustomScript,
  SourceHealthStatus,
  SourceCredentials,
  QualityTier,
  PresetScheme,
} from "@/types/sourceConfig";
import { LXRunner } from "@/lib/sources/lxRunner";

const DEFAULT_SOURCES: Record<MusicSourceId, SingleSourceConfig> = {
  netease: {
    id: "netease",
    name: "网易云音乐",
    badgeName: "网易云",
    badgeColor: "bg-rose-500/20 text-rose-300 border-rose-500/30",
    dotColor: "bg-rose-500",
    enabled: true,
    priority: 1,
    qualityPreference: "auto",
    customApiBase: "",
    customHeaders: {},
    credentials: {},
    health: { status: "untested", latencyMs: 0, lastChecked: 0 },
    description: "官方全网主流曲库，支持 WeAPI 扫码与 Cookie 绑定",
  },
  qq: {
    id: "qq",
    name: "QQ 音乐",
    badgeName: "QQ 音乐",
    badgeColor: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    dotColor: "bg-emerald-500",
    enabled: true,
    priority: 2,
    qualityPreference: "auto",
    customApiBase: "",
    customHeaders: {},
    credentials: {},
    health: { status: "untested", latencyMs: 0, lastChecked: 0 },
    description: "腾讯音乐海量版权曲库，覆盖主流流行与现场原版",
  },
  kugou: {
    id: "kugou",
    name: "酷狗音乐",
    badgeName: "酷狗",
    badgeColor: "bg-sky-500/20 text-sky-300 border-sky-500/30",
    dotColor: "bg-sky-500",
    enabled: true,
    priority: 3,
    qualityPreference: "auto",
    customApiBase: "",
    customHeaders: {},
    credentials: {},
    health: { status: "untested", latencyMs: 0, lastChecked: 0 },
    description: "海量长尾音轨、DJ 舞曲与原创新歌库",
  },
  kuwo: {
    id: "kuwo",
    name: "酷我音乐",
    badgeName: "酷我",
    badgeColor: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    dotColor: "bg-amber-500",
    enabled: true,
    priority: 4,
    qualityPreference: "auto",
    customApiBase: "",
    customHeaders: {},
    credentials: {},
    health: { status: "untested", latencyMs: 0, lastChecked: 0 },
    description: "高码率无损专用通道与经典老歌母带",
  },
  qishui: {
    id: "qishui",
    name: "汽水音乐",
    badgeName: "汽水",
    badgeColor: "bg-purple-500/20 text-purple-300 border-purple-500/30",
    dotColor: "bg-purple-500",
    enabled: true,
    priority: 5,
    qualityPreference: "auto",
    customApiBase: "",
    customHeaders: {},
    credentials: {},
    health: { status: "untested", latencyMs: 0, lastChecked: 0 },
    description: "抖音热歌潮流榜单与小众独立新声",
  },
  local: {
    id: "local",
    name: "本地母带",
    badgeName: "本地",
    badgeColor: "bg-orange-500/20 text-orange-300 border-orange-500/30",
    dotColor: "bg-orange-500",
    enabled: true,
    priority: 6,
    qualityPreference: "hires",
    customApiBase: "",
    customHeaders: {},
    credentials: {},
    health: { status: "normal", latencyMs: 1, lastChecked: Date.now() },
    description: "本地存储 DSD / FLAC / Hi-Res 无损母带音频库",
  },
  lx_custom: {
    id: "lx_custom",
    name: "洛雪扩展源",
    badgeName: "洛雪源",
    badgeColor: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
    dotColor: "bg-cyan-400",
    enabled: true,
    priority: 7,
    qualityPreference: "auto",
    customApiBase: "",
    customHeaders: {},
    credentials: {},
    health: { status: "untested", latencyMs: 0, lastChecked: 0 },
    description: "兼容洛雪 (LX Music) 自定义 JavaScript 扩展脚本与订阅源",
    isCustomScript: true,
  },
};

export const PRESET_SCHEMES: PresetScheme[] = [
  {
    id: "high_quality",
    name: "全网高音质 Hi-Res 模式",
    description: "优先拉取 FLAC 与 320kbps 无损音轨，开启全平台抢答",
    config: {
      netease: { enabled: true, qualityPreference: "flac", priority: 1 },
      qq: { enabled: true, qualityPreference: "flac", priority: 2 },
      kuwo: { enabled: true, qualityPreference: "flac", priority: 3 },
      kugou: { enabled: true, qualityPreference: "320k", priority: 4 },
      local: { enabled: true, qualityPreference: "hires", priority: 5 },
      qishui: { enabled: true, qualityPreference: "320k", priority: 6 },
      lx_custom: { enabled: true, qualityPreference: "flac", priority: 7 },
    },
  },
  {
    id: "fast_traffic_saving",
    name: "极速省流秒开模式",
    description: "优先 128kbps 标准流畅音频，极速抢答，低流量消耗",
    config: {
      netease: { enabled: true, qualityPreference: "128k", priority: 1 },
      qq: { enabled: true, qualityPreference: "128k", priority: 2 },
      kugou: { enabled: true, qualityPreference: "128k", priority: 3 },
      kuwo: { enabled: true, qualityPreference: "128k", priority: 4 },
      qishui: { enabled: true, qualityPreference: "128k", priority: 5 },
      local: { enabled: false, qualityPreference: "auto", priority: 6 },
      lx_custom: { enabled: false, qualityPreference: "128k", priority: 7 },
    },
  },
  {
    id: "pure_local_master",
    name: "纯本地母带发烧模式",
    description: "仅启用本地母带与高清私有音源，免受网络波动干扰",
    config: {
      local: { enabled: true, qualityPreference: "hires", priority: 1 },
      netease: { enabled: false, qualityPreference: "auto", priority: 2 },
      qq: { enabled: false, qualityPreference: "auto", priority: 3 },
      kugou: { enabled: false, qualityPreference: "auto", priority: 4 },
      kuwo: { enabled: false, qualityPreference: "auto", priority: 5 },
      qishui: { enabled: false, qualityPreference: "auto", priority: 6 },
      lx_custom: { enabled: false, qualityPreference: "auto", priority: 7 },
    },
  },
];

interface SourceConfigState {
  sources: Record<MusicSourceId, SingleSourceConfig>;
  lxScripts: LXCustomScript[];
  activePreset: string | null;
  isManagementModalOpen: boolean;
  activeManagementTab: "matrix" | "lx_scripts" | "diagnostics" | "backup" | "offline_cache";

  // Actions
  toggleSource: (id: MusicSourceId) => void;
  setSourceConfig: (id: MusicSourceId, partial: Partial<SingleSourceConfig>) => void;
  setSourceQuality: (id: MusicSourceId, quality: QualityTier) => void;
  setSourcePriority: (id: MusicSourceId, priority: number) => void;
  setSourceCredentials: (id: MusicSourceId, creds: Partial<SourceCredentials>) => void;
  setSourceHealth: (id: MusicSourceId, health: SourceHealthStatus) => void;
  updateAllHealth: (healthMap: Record<MusicSourceId, SourceHealthStatus>) => void;

  // LX Custom Scripts
  addLXScript: (script: Omit<LXCustomScript, "id" | "lastUpdated">) => string;
  updateLXScript: (id: string, partial: Partial<LXCustomScript>) => void;
  removeLXScript: (id: string) => void;
  toggleLXScript: (id: string) => void;
  syncBuiltinDesktopSources: () => Promise<void>;

  // Preset & Backup
  applyPreset: (presetId: string) => void;
  exportConfigJson: () => string;
  importConfigJson: (jsonStr: string) => boolean;
  resetToDefaults: () => void;

  // UI Modal
  openManagementModal: (initialTab?: "matrix" | "lx_scripts" | "diagnostics" | "backup" | "offline_cache") => void;
  closeManagementModal: () => void;
  setActiveManagementTab: (tab: "matrix" | "lx_scripts" | "diagnostics" | "backup" | "offline_cache") => void;
}

export const DEFAULT_BUILTIN_LX_SCRIPTS: LXCustomScript[] = [
  {
    id: "exclusive_v4",
    name: "[独家音源] v4.0 (洛雪科技)",
    author: "洛雪科技",
    version: "4.0.0",
    description: "独家 v4.0 逆向音源，支持全平台 (wy/tx/kg/kw/mg) 无损母带",
    scriptUrl: "/api/sources/builtin?id=exclusive_v4",
    enabled: true,
    lastUpdated: Date.now(),
    supportedActions: ["search", "songUrl", "lyric", "pic"],
  },
  {
    id: "aggregate_special_v9",
    name: "全豆要[聚合音源] 9.3特供版",
    author: "全豆要 / DeepSeek优化",
    version: "9.3.0",
    description: "聚合 星海/溯音/念心/长青/汽水VIP 等多链路自动回退，全平台 24bit/FLAC/320k",
    scriptUrl: "/api/sources/builtin?id=aggregate_special_v9",
    enabled: true,
    lastUpdated: Date.now(),
    supportedActions: ["search", "songUrl", "lyric", "pic"],
  },
  {
    id: "yecao_v1",
    name: "野草🌾 音源 v1.0",
    author: "野草",
    version: "1.0.0",
    description: "野草专属 API 节点，支持 wy/tx/kw/kg 128k/320k/flac 解析",
    scriptUrl: "/api/sources/builtin?id=yecao_v1",
    enabled: true,
    lastUpdated: Date.now(),
    supportedActions: ["search", "songUrl", "lyric", "pic"],
  },
  {
    id: "yehua_v1",
    name: "野花🌷 音源 v1.0",
    author: "野花",
    version: "1.0.0",
    description: "野花专属 API 节点，高可用全网主流曲库解析",
    scriptUrl: "/api/sources/builtin?id=yehua_v1",
    enabled: true,
    lastUpdated: Date.now(),
    supportedActions: ["search", "songUrl", "lyric", "pic"],
  },
  {
    id: "lx-builtin-default",
    name: "Six-Audio 开源六音公共解析源",
    author: "LX Community",
    version: "2.1.0",
    description: "内置开源多音源聚合解析通道，支持标准与高品音质",
    scriptUrl: "https://raw.githubusercontent.com/lyswhut/lx-music-desktop/master/custom_source.js",
    enabled: false,
    lastUpdated: Date.now(),
    supportedActions: ["search", "songUrl", "lyric", "pic"],
  },
];

export const useSourceConfigStore = create<SourceConfigState>()(
  persist(
    (set, get) => ({
      sources: { ...DEFAULT_SOURCES },
      lxScripts: DEFAULT_BUILTIN_LX_SCRIPTS,
      activePreset: "high_quality",
      isManagementModalOpen: false,
      activeManagementTab: "matrix",

      toggleSource: (id) => {
        set((state) => {
          const current = state.sources[id];
          if (!current) return state;
          return {
            sources: {
              ...state.sources,
              [id]: { ...current, enabled: !current.enabled },
            },
          };
        });
      },

      setSourceConfig: (id, partial) => {
        set((state) => {
          const current = state.sources[id];
          if (!current) return state;
          return {
            sources: {
              ...state.sources,
              [id]: { ...current, ...partial },
            },
          };
        });
      },

      setSourceQuality: (id, qualityPreference) => {
        set((state) => {
          const current = state.sources[id];
          if (!current) return state;
          return {
            sources: {
              ...state.sources,
              [id]: { ...current, qualityPreference },
            },
          };
        });
      },

      setSourcePriority: (id, priority) => {
        set((state) => {
          const current = state.sources[id];
          if (!current) return state;
          return {
            sources: {
              ...state.sources,
              [id]: { ...current, priority },
            },
          };
        });
      },

      setSourceCredentials: (id, creds) => {
        set((state) => {
          const current = state.sources[id];
          if (!current) return state;
          return {
            sources: {
              ...state.sources,
              [id]: {
                ...current,
                credentials: { ...current.credentials, ...creds },
              },
            },
          };
        });
      },

      setSourceHealth: (id, health) => {
        set((state) => {
          const current = state.sources[id];
          if (!current) return state;
          return {
            sources: {
              ...state.sources,
              [id]: { ...current, health },
            },
          };
        });
      },

      updateAllHealth: (healthMap) => {
        set((state) => {
          const nextSources = { ...state.sources };
          Object.entries(healthMap).forEach(([id, health]) => {
            const sid = id as MusicSourceId;
            if (nextSources[sid]) {
              nextSources[sid] = { ...nextSources[sid], health };
            }
          });
          return { sources: nextSources };
        });
      },

      addLXScript: (script) => {
        const id = `lx-script-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const newScript: LXCustomScript = {
          ...script,
          id,
          lastUpdated: Date.now(),
        };
        set((state) => ({
          lxScripts: [...state.lxScripts, newScript],
        }));
        return id;
      },

      updateLXScript: (id, partial) => {
        set((state) => ({
          lxScripts: state.lxScripts.map((item) =>
            item.id === id ? { ...item, ...partial, lastUpdated: Date.now() } : item
          ),
        }));
      },

      removeLXScript: (id) => {
        set((state) => ({
          lxScripts: state.lxScripts.filter((item) => item.id !== id),
        }));
      },

      toggleLXScript: (id) => {
        set((state) => ({
          lxScripts: state.lxScripts.map((item) =>
            item.id === id ? { ...item, enabled: !item.enabled } : item
          ),
        }));
      },

      syncBuiltinDesktopSources: async () => {
        try {
          const res = await fetch("/api/sources/builtin");
          if (!res.ok) return;
          const data = await res.json();
          if (data && Array.isArray(data.sources)) {
            data.sources.forEach((builtin: any) => {
              if (builtin.content) {
                LXRunner.cacheScriptCode(builtin.id, builtin.content);
              }
            });

            set((state) => {
              const existingMap = new Map(state.lxScripts.map((s) => [s.id, s]));
              const updatedList: LXCustomScript[] = [...state.lxScripts];

              data.sources.forEach((builtin: any) => {
                const existing = existingMap.get(builtin.id);
                if (existing) {
                  existing.name = builtin.name;
                  existing.version = builtin.version;
                  existing.description = builtin.description;
                  existing.author = builtin.author;
                  existing.lastUpdated = Date.now();
                } else {
                  updatedList.push({
                    id: builtin.id,
                    name: builtin.name,
                    author: builtin.author,
                    version: builtin.version,
                    description: builtin.description,
                    scriptUrl: `/api/sources/builtin?id=${builtin.id}`,
                    enabled: true,
                    lastUpdated: Date.now(),
                    supportedActions: ["search", "songUrl", "lyric", "pic"],
                  });
                }
              });

              return { lxScripts: updatedList };
            });
          }
        } catch (e) {
          console.warn("[sourceConfigStore] syncBuiltinDesktopSources error:", e);
        }
      },

      applyPreset: (presetId) => {
        const preset = PRESET_SCHEMES.find((p) => p.id === presetId);
        if (!preset) return;

        set((state) => {
          const nextSources = { ...state.sources };
          Object.entries(preset.config).forEach(([sid, cfg]) => {
            const id = sid as MusicSourceId;
            if (nextSources[id]) {
              nextSources[id] = {
                ...nextSources[id],
                enabled: cfg.enabled,
                qualityPreference: cfg.qualityPreference,
                priority: cfg.priority,
              };
            }
          });
          return { sources: nextSources, activePreset: presetId };
        });
      },

      exportConfigJson: () => {
        const { sources, lxScripts, activePreset } = get();
        const exportData = {
          version: "1.0.0",
          timestamp: Date.now(),
          activePreset,
          sources,
          lxScripts: lxScripts.map(({ scriptContent, ...meta }) => meta),
        };
        return JSON.stringify(exportData, null, 2);
      },

      importConfigJson: (jsonStr) => {
        try {
          const data = JSON.parse(jsonStr);
          if (data && typeof data === "object" && data.sources) {
            set((state) => ({
              sources: { ...state.sources, ...data.sources },
              lxScripts: Array.isArray(data.lxScripts) ? data.lxScripts : state.lxScripts,
              activePreset: data.activePreset || state.activePreset,
            }));
            return true;
          }
          return false;
        } catch {
          return false;
        }
      },

      resetToDefaults: () => {
        set({
          sources: { ...DEFAULT_SOURCES },
          activePreset: "high_quality",
        });
      },

      openManagementModal: (initialTab = "matrix") => {
        set({ isManagementModalOpen: true, activeManagementTab: initialTab });
      },

      closeManagementModal: () => {
        set({ isManagementModalOpen: false });
      },

      setActiveManagementTab: (activeManagementTab) => {
        set({ activeManagementTab });
      },
    }),
    {
      name: "vibe_source_config_v1",
      storage: createJSONStorage(() => ({
        getItem: (name) => {
          try {
            return localStorage.getItem(name);
          } catch {
            return null;
          }
        },
        setItem: (name, value) => {
          try {
            localStorage.setItem(name, value);
          } catch (e) {
            console.warn("[safeLocalStorage] setItem failed or quota exceeded:", e);
          }
        },
        removeItem: (name) => {
          try {
            localStorage.removeItem(name);
          } catch {
            // ignore
          }
        },
      })),
      partialize: (state) => ({
        sources: state.sources,
        lxScripts: state.lxScripts.map(({ scriptContent, ...meta }) => meta),
        activePreset: state.activePreset,
      }),
    }
  )
);
