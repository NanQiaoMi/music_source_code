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
  
  // Actions
  addConfig: (config: Omit<AIConfig, "id" | "status">) => void;
  removeConfig: (id: string) => void;
  updateConfig: (id: string, updates: Partial<AIConfig>) => void;
  setActiveConfig: (id: string | null) => void;
  
  // Test logic
  testConfig: (id: string) => Promise<boolean>;
  fetchModels: (id: string) => Promise<string[]>;
}

export const useAIStore = create<AIState>()(
  persist(
    (set, get) => ({
      configs: [],
      activeConfigId: null,

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

      testConfig: async (id) => {
        const config = get().configs.find((c) => c.id === id);
        if (!config) return false;

        get().updateConfig(id, { status: "testing" });

        try {
          const baseUrl = config.baseUrl.replace(/\/$/, "");
          const url = baseUrl.endsWith("/v1") ? `${baseUrl}/models` : `${baseUrl}/v1/models`;
          const response = await fetch(url, {
            method: "GET",
            headers: {
              Authorization: `Bearer ${config.apiKey}`,
            },
          });

          if (response.ok) {
            get().updateConfig(id, { status: "online", lastTested: Date.now() });
            return true;
          } else {
            throw new Error("API response not OK");
          }
        } catch (error) {
          get().updateConfig(id, { status: "offline", lastTested: Date.now() });
          return false;
        }
      },

      fetchModels: async (id) => {
        const config = get().configs.find((c) => c.id === id);
        if (!config) return [];

        try {
          const baseUrl = config.baseUrl.replace(/\/$/, "");
          const url = baseUrl.endsWith("/v1") ? `${baseUrl}/models` : `${baseUrl}/v1/models`;
          const response = await fetch(url, {
            method: "GET",
            headers: {
              Authorization: `Bearer ${config.apiKey}`,
            },
          });

          if (!response.ok) return [];

          const data = await response.json();
          const models = data.data.map((m: any) => m.id);
          return models;
        } catch (error) {
          console.error("Failed to fetch models:", error);
          return [];
        }
      },
    }),
    {
      name: "mimi-ai-store",
    }
  )
);
