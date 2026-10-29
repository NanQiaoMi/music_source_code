import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { LXCustomScript, MusicSourceId, ResolutionMode } from "@/types/sourceConfig";
import { LXRunner } from "@/lib/sources/lxRunner";
import { isPlatformLoggedIn } from "@/store/userAccountStore";

import {
  DEFAULT_BUILTIN_LX_SCRIPTS,
  DEFAULT_SOURCES,
  PRESET_SCHEMES,
  type RawBuiltinSource,
  type SourceConfigState,
} from "./sourceConfig/helpers";

export { DEFAULT_BUILTIN_LX_SCRIPTS, PRESET_SCHEMES };

export const useSourceConfigStore = create<SourceConfigState>()(
  persist(
    (set, get) => ({
      sources: { ...DEFAULT_SOURCES },
      lxScripts: DEFAULT_BUILTIN_LX_SCRIPTS,
      activePreset: "high_quality",
      resolutionMode: "hybrid_racing",
      isManagementModalOpen: false,
      activeManagementTab: "matrix",

      setResolutionMode: (mode: ResolutionMode) => set({ resolutionMode: mode }),

      isSourceUsable: (id) => {
        if (id === "local") return true;
        if (id === "lx_custom") {
          const state = get();
          return Boolean(
            state.sources.lx_custom?.enabled && state.lxScripts.some((s) => s.enabled)
          );
        }
        const state = get();
        const source = state.sources[id];
        return Boolean(source?.enabled && isPlatformLoggedIn(id));
      },

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
          if (
            typeof window === "undefined" ||
            !window.location?.origin ||
            window.location.origin === "null"
          )
            return;
          const origin = window.location.origin;
          const res = await fetch(`${origin}/api/sources/builtin`);
          if (!res.ok) {
            throw new Error(`音源配置拉取失败 (HTTP ${res.status})`);
          }
          const data = await res.json();
          if (!data || !Array.isArray(data.sources)) {
            throw new Error("音源配置响应格式异常");
          }

          data.sources.forEach((builtin: RawBuiltinSource) => {
            if (builtin.content) {
              LXRunner.cacheScriptCode(builtin.id, builtin.content);
            }
          });

          set((state) => {
            const existingMap = new Map(state.lxScripts.map((s) => [s.id, s]));
            const updatedList: LXCustomScript[] = [...state.lxScripts];

            data.sources.forEach((builtin: RawBuiltinSource) => {
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
        } catch (e) {
          // 保留诊断日志，但不再吞错：调用方需要知道同步失败以给出重试入口
          console.warn("[sourceConfigStore] syncBuiltinDesktopSources error:", e);
          throw e;
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
          lxScripts: lxScripts.map(({ scriptContent: _scriptContent, ...meta }) => meta),
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
      skipHydration: true,
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
        lxScripts: state.lxScripts.map(({ scriptContent: _scriptContent, ...meta }) => meta),
        activePreset: state.activePreset,
        resolutionMode: state.resolutionMode,
      }),
    }
  )
);

export function isSourceUsable(sourceId: MusicSourceId): boolean {
  return useSourceConfigStore.getState().isSourceUsable(sourceId);
}
