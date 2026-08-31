import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface AIConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  name: string;
  id: string;
  lastTested?: number;
  status: "idle" | "testing" | "online" | "offline";
}

interface AIState {
  configs: AIConfig[];
  activeConfigId: string | null;

  isEnabled: boolean;

  // Actions
  addConfig: (config: Omit<AIConfig, "id" | "status">) => void;
  removeConfig: (id: string) => void;
  updateConfig: (id: string, updates: Partial<AIConfig>) => void;
  setActiveConfig: (id: string | null) => void;
  toggleEnabled: () => void;
  setEnabled: (enabled: boolean) => void;

  // Test logic
  testConfig: (id: string) => Promise<boolean>;
  fetchModels: (id: string) => Promise<string[]>;
}

type PersistedAIState = Pick<AIState, "configs" | "activeConfigId" | "isEnabled">;

export const AI_STORE_KEY = "mimi-ai-store";
const AI_STORE_VERSION = 1;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function extractModelIds(payload: unknown): string[] {
  if (!isRecord(payload) || !Array.isArray(payload.data)) return [];

  return payload.data
    .map((model) => (isRecord(model) ? model.id : null))
    .filter((id): id is string => typeof id === "string" && id.trim().length > 0);
}

function isAIConfigStatus(value: unknown): value is AIConfig["status"] {
  return value === "idle" || value === "testing" || value === "online" || value === "offline";
}

function normalizePersistedAIConfig(value: unknown): AIConfig | null {
  if (
    !isRecord(value) ||
    typeof value.baseUrl !== "string" ||
    typeof value.apiKey !== "string" ||
    typeof value.model !== "string" ||
    typeof value.name !== "string" ||
    typeof value.id !== "string"
  ) {
    return null;
  }

  const config: AIConfig = {
    baseUrl: value.baseUrl,
    apiKey: value.apiKey,
    model: value.model,
    name: value.name,
    id: value.id,
    status: isAIConfigStatus(value.status) ? value.status : "idle",
  };

  if (typeof value.lastTested === "number" && Number.isFinite(value.lastTested)) {
    config.lastTested = value.lastTested;
  }

  return config;
}

function normalizePersistedAIState(value: unknown): PersistedAIState | null {
  if (!isRecord(value) || !Array.isArray(value.configs)) return null;

  const normalizedConfigs = value.configs
    .map(normalizePersistedAIConfig)
    .filter((config): config is AIConfig => config !== null);
  if (normalizedConfigs.length !== value.configs.length) return null;

  const requestedActiveConfigId =
    typeof value.activeConfigId === "string" ? value.activeConfigId : null;

  return {
    configs: normalizedConfigs,
    activeConfigId:
      requestedActiveConfigId &&
      normalizedConfigs.some((config) => config.id === requestedActiveConfigId)
        ? requestedActiveConfigId
        : null,
    isEnabled: typeof value.isEnabled === "boolean" ? value.isEnabled : true,
  };
}

export const useAIStore = create<AIState>()(
  persist(
    (set, get) => ({
      configs: [],
      activeConfigId: null,
      isEnabled: true,

      addConfig: (config) => {
        const id = Math.random().toString(36).substring(2, 11);
        set((state) => ({
          configs: [...state.configs, { ...config, id, status: "idle" }],
        }));
      },

      removeConfig: (id) => {
        set((state) => ({
          configs: state.configs.filter((c) => c.id !== id),
          activeConfigId: state.activeConfigId === id ? null : state.activeConfigId,
        }));
      },

      updateConfig: (id, updates) => {
        set((state) => ({
          configs: state.configs.map((c) => (c.id === id ? { ...c, ...updates } : c)),
        }));
      },

      setActiveConfig: (id) => set({ activeConfigId: id }),

      toggleEnabled: () => set((state) => ({ isEnabled: !state.isEnabled })),

      setEnabled: (enabled) => set({ isEnabled: enabled }),

      testConfig: async (id) => {
        const config = get().configs.find((c) => c.id === id);
        if (!config) return false;

        get().updateConfig(id, { status: "testing" });

        try {
          const isBrowser = typeof window !== "undefined";
          let ok = false;

          if (isBrowser) {
            // 在浏览器中通过服务端代理进行连通性测试
            const response = await fetch("/api/ai/chat", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                baseUrl: config.baseUrl,
                apiKey: config.apiKey,
                model: config.model || "deepseek-v4-flash",
                messages: [{ role: "user", content: "hi" }],
                max_tokens: 5,
              }),
            });
            ok = response.ok;
          } else {
            const baseUrl = config.baseUrl.replace(/\/$/, "");
            const url = baseUrl.endsWith("/v1") ? `${baseUrl}/models` : `${baseUrl}/v1/models`;
            const response = await fetch(url, {
              method: "GET",
              headers: {
                Authorization: `Bearer ${config.apiKey}`,
              },
            });
            ok = response.ok;
          }

          if (ok) {
            get().updateConfig(id, { status: "online", lastTested: Date.now() });
            return true;
          } else {
            throw new Error("API response not OK");
          }
        } catch {
          get().updateConfig(id, { status: "offline", lastTested: Date.now() });
          return false;
        }
      },

      fetchModels: async (id) => {
        const config = get().configs.find((c) => c.id === id);
        if (!config) return [];

        try {
          const isBrowser = typeof window !== "undefined";
          let data: unknown;

          if (isBrowser) {
            const response = await fetch("/api/ai/models", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                baseUrl: config.baseUrl,
                apiKey: config.apiKey,
              }),
            });
            if (!response.ok) return [];
            data = await response.json();
          } else {
            const baseUrl = config.baseUrl.replace(/\/$/, "");
            const url = baseUrl.endsWith("/v1") ? `${baseUrl}/models` : `${baseUrl}/v1/models`;
            const response = await fetch(url, {
              method: "GET",
              headers: {
                Authorization: `Bearer ${config.apiKey}`,
              },
            });
            if (!response.ok) return [];
            data = await response.json();
          }

          return extractModelIds(data);
        } catch (error) {
          console.warn("Failed to fetch models:", error);
          return [];
        }
      },
    }),
    {
      name: AI_STORE_KEY,
      version: AI_STORE_VERSION,
      partialize: (state): PersistedAIState => ({
        configs: state.configs,
        activeConfigId: state.activeConfigId,
        isEnabled: state.isEnabled,
      }),
      migrate: (persistedState, version) => {
        if (version > AI_STORE_VERSION) {
          throw new Error(
            `Cannot migrate AI store version ${version} to older version ${AI_STORE_VERSION}`
          );
        }

        const normalizedState = normalizePersistedAIState(persistedState);
        if (!normalizedState) {
          throw new Error(`Cannot migrate malformed AI store version ${version}`);
        }

        return normalizedState;
      },
      merge: (persistedState, currentState) => {
        const normalizedState = normalizePersistedAIState(persistedState);
        return normalizedState ? { ...currentState, ...normalizedState } : currentState;
      },
    }
  )
);
