export type CategoryFilter = "all" | "domestic" | "global" | "local" | "custom";

export interface ProviderPreset {
  id: string;
  name: string;
  category: "domestic" | "global" | "local" | "custom";
  description: string;
  baseUrl: string;
  defaultModel: string;
  recommendedModels: string[];
  tags: string[];
  docUrl?: string;
  accentColor: string;
}

export interface PromptPreset {
  id: string;
  title: string;
  icon: string;
  description: string;
  systemPrompt: string;
  temperature: number;
}

export interface DiagnosticResult {
  status: "success" | "error" | "warning";
  code?: number;
  message: string;
  advice: string;
  ttft?: number;
  latency?: number;
  tokensPerSec?: number;
  totalTokens?: number;
}

export interface TestMessage {
  role: "system" | "user" | "assistant";
  content: string;
}
