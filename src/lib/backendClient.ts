export interface BackendStatus {
  status: "disabled" | "external" | "starting" | "ready" | "stopping" | "error";
  baseUrl: string | null;
  error: string | null;
}

export interface BackendCapability {
  id: string;
  available: boolean;
  endpoint: string;
  reason?: string;
}

export class BackendApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly capability?: string;

  constructor(message: string, status: number, details?: { code?: string; capability?: string }) {
    super(message);
    this.name = "BackendApiError";
    this.status = status;
    this.code = details?.code;
    this.capability = details?.capability;
  }
}

const DEFAULT_BACKEND_URL = "http://localhost:8000";

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}

async function getBackendBaseUrl(): Promise<string> {
  if (typeof window !== "undefined" && window.electronAPI) {
    const status = await window.electronAPI.getBackendStatus();
    if (!status?.baseUrl) {
      throw new BackendApiError(status?.error || "本地后端尚未启动", 503);
    }
    return normalizeBaseUrl(status.baseUrl);
  }

  return normalizeBaseUrl(
    typeof process !== "undefined" && process.env.NEXT_PUBLIC_BACKEND_URL
      ? process.env.NEXT_PUBLIC_BACKEND_URL
      : DEFAULT_BACKEND_URL
  );
}

async function parseResponse<T>(response: Response): Promise<T> {
  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    if (!response.ok) {
      throw new BackendApiError(`后端请求失败（HTTP ${response.status}）`, response.status);
    }
    throw new BackendApiError("后端返回了无法解析的数据", 502);
  }

  if (!response.ok) {
    const body = payload as {
      error_message?: string;
      detail?: string;
      code?: string;
      capability?: string;
    };
    throw new BackendApiError(
      body.error_message || body.detail || `后端请求失败（HTTP ${response.status}）`,
      response.status,
      { code: body.code, capability: body.capability }
    );
  }

  return payload as T;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let baseUrl: string;
  try {
    baseUrl = await getBackendBaseUrl();
  } catch (error) {
    if (error instanceof BackendApiError) throw error;
    throw new BackendApiError("无法读取本地后端状态", 503);
  }

  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, init);
  } catch {
    throw new BackendApiError("无法连接本地后端，请检查后端状态", 503);
  }

  return parseResponse<T>(response);
}

export async function getBackendHealth(): Promise<Record<string, unknown>> {
  return request<Record<string, unknown>>("/api/health");
}

export async function getBackendCapabilities(): Promise<Record<string, BackendCapability>> {
  const response = await request<{ capabilities: Record<string, BackendCapability> }>(
    "/api/capabilities"
  );
  return response.capabilities;
}

export async function processAudio(file: File, modelId: string): Promise<Record<string, unknown>> {
  const formData = new FormData();
  formData.append("file", file);
  return request<Record<string, unknown>>(
    `/api/audio/process?model_id=${encodeURIComponent(modelId)}`,
    { method: "POST", body: formData }
  );
}

export async function synthesizeSpeech(
  text: string,
  modelId: string
): Promise<Record<string, unknown>> {
  return request<Record<string, unknown>>("/api/tts/synthesize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, model_id: modelId }),
  });
}

export async function processVision(file: File, modelId: string): Promise<Record<string, unknown>> {
  const formData = new FormData();
  formData.append("file", file);
  return request<Record<string, unknown>>(
    `/api/vision/process?model_id=${encodeURIComponent(modelId)}`,
    { method: "POST", body: formData }
  );
}

export function getBackendErrorMessage(error: unknown, fallback = "后端处理失败"): string {
  if (typeof error === "string" && error.trim()) return error;
  if (error instanceof BackendApiError) {
    if (error.code === "CAPABILITY_UNAVAILABLE" || error.status === 501) {
      return "该能力当前不可用：请先在设置中准备对应模型。";
    }
    return error.message;
  }
  return fallback;
}

export const backendClient = {
  getHealth: getBackendHealth,
  getCapabilities: getBackendCapabilities,
  processAudio,
  synthesizeSpeech,
  processVision,
};
