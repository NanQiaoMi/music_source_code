// S6-12k: store-free AI config types, defaults and pure helpers live here so aiStore.ts
// stays inside the 400-line store budget (scripts/check-store-budgets.mjs). The store
// re-exports the public AIConfig type, DEFAULT_SENSENOVA_CONFIGS and AI_STORE_KEY, so its
// public surface is unchanged.

export interface AIConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  name: string;
  id: string;
  lastTested?: number;
  status: "idle" | "testing" | "online" | "offline";
  /**
   * 调用方填的 key 被上游拒绝、由服务端环境变量密钥顶上的时刻。
   * 只表示「这把 key 已失效」，不表示端点不通——端点状态仍看 `status`。
   * 用户改了 `apiKey` 会清掉。
   */
  keyRejectedAt?: number;
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

// 这里刻意不预置任何 apiKey：本模块是客户端代码，写在这里的密钥会被打包进前端
// 并发送到浏览器，等同于公开。密钥应由服务端从环境变量读取（/api/ai/chat 已支持），
// 或由用户在 AI 设置里自行填写。
export const DEFAULT_SENSENOVA_CONFIGS: Array<Omit<AIConfig, "id"> & { id: string }> = [
  {
    id: "sensenova-deepseek-v4-flash",
    name: "DeepSeek-V4 Flash (超快主通道 - 推荐)",
    providerId: "sensenova",
    baseUrl: "https://token.sensenova.cn/v1",
    apiKey: "",
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
    apiKey: "",
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
    apiKey: "",
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
    apiKey: "",
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
    apiKey: "",
    model: "kimi-k3",
    temperature: 0.7,
    topP: 1.0,
    maxTokens: 2048,
    timeout: 30000,
    stream: true,
    status: "idle",
  },
];

export interface AIState {
  configs: AIConfig[];
  activeConfigId: string | null;

  isEnabled: boolean;
  enableAutoFallback: boolean;

  // Actions
  addConfig: (
    config: Omit<AIConfig, "id" | "status"> & { id?: string; status?: AIConfig["status"] }
  ) => string;
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

export type PersistedAIState = Pick<
  AIState,
  "configs" | "activeConfigId" | "isEnabled" | "enableAutoFallback"
>;

export const AI_STORE_KEY = "mimi-ai-store";
export const AI_STORE_VERSION = 1;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function extractModelIds(payload: unknown): string[] {
  if (!isRecord(payload) || !Array.isArray(payload.data)) return [];

  return payload.data
    .map((model) => (isRecord(model) ? model.id : null))
    .filter((id): id is string => typeof id === "string" && id.trim().length > 0);
}

export function isAIConfigStatus(value: unknown): value is AIConfig["status"] {
  return value === "idle" || value === "testing" || value === "online" || value === "offline";
}

export function normalizePersistedAIConfig(value: unknown): AIConfig | null {
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
  if (typeof value.keyRejectedAt === "number" && Number.isFinite(value.keyRejectedAt)) {
    config.keyRejectedAt = value.keyRejectedAt;
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

export function normalizePersistedAIState(value: unknown): PersistedAIState | null {
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
