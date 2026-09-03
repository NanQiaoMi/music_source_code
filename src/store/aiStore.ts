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
  // Enhanced attributes
  providerId?: string;
  latency?: number;
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  timeout?: number;
  systemPrompt?: string;
  customHeaders?: Record<string, string>;
  stream?: boolean;
}

export const DEFAULT_SENSENOVA_CONFIGS: Array<Omit<AIConfig, "id"> & { id: string }> = [
  {
    id: "sensenova-deepseek-v4-flash",
    name: "DeepSeek-V4 Flash (超快主通道 - 推荐)",
    providerId: "sensenova",
    baseUrl: "https://token.sensenova.cn/v1",
    apiKey: "sk-qN2X1XYkazEHkVi7tdTUvUEKkoBHp7kY",
    model: "deepseek-v4-flash",
    temperature: 0.85,
    topP: 1.0,
    maxTokens: 2048,
    timeout: 30000,
    stream: true,
    status: "idle",
  },
  {
    id: "sensenova-deepseek-v4-pro",
    name: "DeepSeek-V4 Pro (深度高质备用1)",
    providerId: "sensenova",
    baseUrl: "https://token.sensenova.cn/v1",
    apiKey: "sk-F83DUjX1CcogKgbi6VCk4qMA8UYsPH16",
    model: "deepseek-v4-pro",
    temperature: 0.85,
    topP: 1.0,
    maxTokens: 2048,
    timeout: 30000,
    stream: true,
    status: "idle",
  },
  {
    id: "sensenova-mimidemimi",
    name: "SenseNova 6.8 (备用通道2 - mimidemimi)",
    providerId: "sensenova",
    baseUrl: "https://token.sensenova.cn/v1",
    apiKey: "sk-deijjmIMBW7NuHwPd6qt2eOE4UPPknjF",
    model: "sensenova-6.8-flash-lite",
    temperature: 0.7,
    topP: 1.0,
    maxTokens: 2048,
    timeout: 30000,
    stream: true,
    status: "idle",
  },
  {
    id: "sensenova-maomaodemaomao",
    name: "SenseNova 6.8 (备用通道3 - MAOMAODEMAOMAO)",
    providerId: "sensenova",
    baseUrl: "https://token.sensenova.cn/v1",
    apiKey: "sk-3i5hCE1SC7aQpKOQnJg1L9lktkJ1NcaL",
    model: "sensenova-6.8-flash-lite",
    temperature: 0.7,
    topP: 1.0,
    maxTokens: 2048,
    timeout: 30000,
    stream: true,
    status: "idle",
  },
  {
    id: "sensenova-kimi-k3",
    name: "Kimi-K3 (备用4 - MIMIDEMIMI2)",
    providerId: "sensenova",
    baseUrl: "https://token.sensenova.cn/v1",
    apiKey: "sk-6zoL2AmkiwjiIAetIdwTBNdpkjZaemnB",
    model: "kimi-k3",
    temperature: 0.7,
    topP: 1.0,
    maxTokens: 2048,
    timeout: 30000,
    stream: true,
    status: "idle",
  },
];

interface AIState {
  configs: AIConfig[];
  activeConfigId: string | null;

  isEnabled: boolean;
  enableAutoFallback: boolean;

  // Actions
  addConfig: (config: Omit<AIConfig, "id" | "status"> & { id?: string; status?: AIConfig["status"] }) => string;
  removeConfig: (id: string) => void;
  updateConfig: (id: string, updates: Partial<AIConfig>) => void;
  duplicateConfig: (id: string) => string | null;
  setActiveConfig: (id: string | null) => void;
  toggleEnabled: () => void;
  setEnabled: (enabled: boolean) => void;
  toggleAutoFallback: () => void;
  setAutoFallback: (enabled: boolean) => void;
  importConfigs: (imported: AIConfig[], mode: "merge" | "overwrite") => void;
  resetToDefaultConfigs: () => void;

  // Candidate pool & fallback resolver
  getOrderedConfigPool: (primaryId?: string | null) => AIConfig[];

  // Test logic
  testConfig: (id: string) => Promise<boolean>;
  fetchModels: (id: string) => Promise<string[]>;
}

type PersistedAIState = Pick<
  AIState,
  "configs" | "activeConfigId" | "isEnabled" | "enableAutoFallback"
>;

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
  if (typeof value.providerId === "string") {
    config.providerId = value.providerId;
  }
  if (typeof value.latency === "number" && Number.isFinite(value.latency)) {
    config.latency = value.latency;
  }
  if (typeof value.temperature === "number" && Number.isFinite(value.temperature)) {
    config.temperature = value.temperature;
  }
  if (typeof value.topP === "number" && Number.isFinite(value.topP)) {
    config.topP = value.topP;
  }
  if (typeof value.maxTokens === "number" && Number.isFinite(value.maxTokens)) {
    config.maxTokens = value.maxTokens;
  }
  if (typeof value.timeout === "number" && Number.isFinite(value.timeout)) {
    config.timeout = value.timeout;
  }
  if (typeof value.systemPrompt === "string") {
    config.systemPrompt = value.systemPrompt;
  }
  if (isRecord(value.customHeaders)) {
    const headers: Record<string, string> = {};
    for (const [k, v] of Object.entries(value.customHeaders)) {
      if (typeof v === "string") headers[k] = v;
    }
    config.customHeaders = headers;
  }
  if (typeof value.stream === "boolean") {
    config.stream = value.stream;
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
    enableAutoFallback:
      typeof value.enableAutoFallback === "boolean" ? value.enableAutoFallback : true,
  };
}

export const useAIStore = create<AIState>()(
  persist(
    (set, get) => ({
      configs: [],
      activeConfigId: null,
      isEnabled: true,
      enableAutoFallback: true,

      addConfig: (config) => {
        const id = config.id || Math.random().toString(36).substring(2, 11);
        const newEntry: AIConfig = {
          temperature: 0.7,
          topP: 1.0,
          maxTokens: 2048,
          timeout: 30000,
          stream: true,
          ...config,
          id,
          status: config.status || "idle",
        };
        set((state) => ({
          configs: [...state.configs, newEntry],
          activeConfigId: state.activeConfigId || id,
        }));
        return id;
      },

      removeConfig: (id) => {
        set((state) => {
          const remaining = state.configs.filter((c) => c.id !== id);
          return {
            configs: remaining,
            activeConfigId:
              state.activeConfigId === id ? (remaining[0]?.id ?? null) : state.activeConfigId,
          };
        });
      },

      duplicateConfig: (id) => {
        const target = get().configs.find((c) => c.id === id);
        if (!target) return null;
        const newId = Math.random().toString(36).substring(2, 11);
        const duplicated: AIConfig = {
          ...target,
          id: newId,
          name: `${target.name} (副本)`,
          status: "idle",
          lastTested: undefined,
          latency: undefined,
        };
        set((state) => ({
          configs: [...state.configs, duplicated],
        }));
        return newId;
      },

      updateConfig: (id, updates) => {
        set((state) => ({
          configs: state.configs.map((c) => (c.id === id ? { ...c, ...updates } : c)),
        }));
      },

      setActiveConfig: (id) => set({ activeConfigId: id }),

      toggleEnabled: () => set((state) => ({ isEnabled: !state.isEnabled })),

      setEnabled: (enabled) => set({ isEnabled: enabled }),

      toggleAutoFallback: () =>
        set((state) => ({ enableAutoFallback: !state.enableAutoFallback })),

      setAutoFallback: (enabled) => set({ enableAutoFallback: enabled }),

      resetToDefaultConfigs: () => {
        set({
          configs: DEFAULT_SENSENOVA_CONFIGS,
          activeConfigId: DEFAULT_SENSENOVA_CONFIGS[0].id,
          isEnabled: true,
          enableAutoFallback: true,
        });
      },

      getOrderedConfigPool: (primaryId) => {
        const state = get();
        // 筛选出拥有有效 Base URL 和 API Key 的可用端点候选池
        let validConfigs = state.configs.filter(
          (c) => !!c.baseUrl?.trim() && !!c.apiKey?.trim()
        );
        if (validConfigs.length === 0) {
          // 若暂无已配置端点，使用商汤官方预设多 Key 容灾池
          validConfigs = DEFAULT_SENSENOVA_CONFIGS;
        }

        const targetPrimaryId = primaryId || state.activeConfigId;
        const primary =
          validConfigs.find((c) => c.id === targetPrimaryId) || validConfigs[0];
        const others = validConfigs.filter((c) => c.id !== primary.id);

        // 排序规则：优先已测试连通在线(online)，其次网络延迟(latency)最低者优先
        others.sort((a, b) => {
          if (a.status === "online" && b.status !== "online") return -1;
          if (b.status === "online" && a.status !== "online") return 1;
          if (typeof a.latency === "number" && typeof b.latency === "number") {
            return a.latency - b.latency;
          }
          return 0;
        });

        return [primary, ...others];
      },

      importConfigs: (imported, mode) => {
        const sanitized = imported
          .map(normalizePersistedAIConfig)
          .filter((c): c is AIConfig => c !== null);
        if (sanitized.length === 0) return;

        set((state) => {
          if (mode === "overwrite") {
            return {
              configs: sanitized,
              activeConfigId: sanitized[0]?.id ?? null,
            };
          }
          // merge: replace by id if exists, otherwise append
          const map = new Map<string, AIConfig>();
          for (const item of state.configs) {
            map.set(item.id, item);
          }
          for (const item of sanitized) {
            map.set(item.id, item);
          }
          const merged = Array.from(map.values());
          return {
            configs: merged,
            activeConfigId: state.activeConfigId || merged[0]?.id || null,
          };
        });
      },

      testConfig: async (id) => {
        const config = get().configs.find((c) => c.id === id);
        if (!config) return false;

        get().updateConfig(id, { status: "testing" });
        const startTime = typeof performance !== "undefined" ? performance.now() : Date.now();

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

          const endTime = typeof performance !== "undefined" ? performance.now() : Date.now();
          const latency = Math.max(1, Math.round(endTime - startTime));

          if (ok) {
            get().updateConfig(id, { status: "online", lastTested: Date.now(), latency });
            return true;
          } else {
            throw new Error("API response not OK");
          }
        } catch {
          const endTime = typeof performance !== "undefined" ? performance.now() : Date.now();
          const latency = Math.max(1, Math.round(endTime - startTime));
          get().updateConfig(id, { status: "offline", lastTested: Date.now(), latency });
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
        enableAutoFallback: state.enableAutoFallback,
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
