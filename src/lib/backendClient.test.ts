import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  BackendApiError,
  getBackendCapabilities,
  getBackendErrorMessage,
  getBackendHealth,
  processAudio,
  synthesizeSpeech,
} from "./backendClient";

const configuredUrl = "http://backend.test:8765";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("backendClient", () => {
  const originalBackendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_BACKEND_URL = configuredUrl;
    delete window.electronAPI;
  });

  afterEach(() => {
    if (originalBackendUrl === undefined) {
      delete process.env.NEXT_PUBLIC_BACKEND_URL;
    } else {
      process.env.NEXT_PUBLIC_BACKEND_URL = originalBackendUrl;
    }
    vi.unstubAllGlobals();
    delete window.electronAPI;
  });

  it("reads capabilities from the configured development backend", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        capabilities: {
          audio_processing: {
            id: "audio_processing",
            available: false,
            endpoint: "/api/audio/process",
          },
        },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(getBackendCapabilities()).resolves.toEqual({
      audio_processing: {
        id: "audio_processing",
        available: false,
        endpoint: "/api/audio/process",
      },
    });
    expect(fetchMock).toHaveBeenCalledWith(`${configuredUrl}/api/capabilities`, undefined);
  });

  it("sends audio uploads as FormData without overriding its content type", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ success: true }));
    vi.stubGlobal("fetch", fetchMock);
    const file = new File(["audio"], "sample.wav", { type: "audio/wav" });

    await processAudio(file, "model / one");

    expect(fetchMock).toHaveBeenCalledWith(
      `${configuredUrl}/api/audio/process?model_id=model%20%2F%20one`,
      expect.objectContaining({ method: "POST" })
    );
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.body).toBeInstanceOf(FormData);
    expect(init.headers).toBeUndefined();
  });

  it("sends speech requests as JSON", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ success: true }));
    vi.stubGlobal("fetch", fetchMock);

    await synthesizeSpeech("你好", "sambert-zh");

    expect(fetchMock).toHaveBeenCalledWith(`${configuredUrl}/api/tts/synthesize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "你好", model_id: "sambert-zh" }),
    });
  });

  it("preserves structured unavailable capability errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(
          {
            success: false,
            code: "CAPABILITY_UNAVAILABLE",
            capability: "speech_synthesis",
            error_message: "Speech synthesis is not bundled.",
          },
          501
        )
      )
    );

    await expect(getBackendHealth()).rejects.toMatchObject({
      name: "BackendApiError",
      status: 501,
      code: "CAPABILITY_UNAVAILABLE",
      capability: "speech_synthesis",
    } satisfies Partial<BackendApiError>);
  });

  it("reports malformed successful responses as a gateway error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("not-json", { status: 200 })));

    await expect(getBackendHealth()).rejects.toMatchObject({
      status: 502,
      message: "后端返回了无法解析的数据",
    } satisfies Partial<BackendApiError>);
  });

  it("reports network failures and maps unavailable messages for the UI", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Network error")));

    await expect(getBackendHealth()).rejects.toMatchObject({
      status: 503,
    } satisfies Partial<BackendApiError>);
    expect(getBackendErrorMessage(new BackendApiError("not bundled", 501))).toBe(
      "该能力当前不可用：请先在设置中准备对应模型。"
    );
  });
});
