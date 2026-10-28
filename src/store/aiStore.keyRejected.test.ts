import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * 「密钥已失效」标记的行为。
 *
 * 关键前提：`noteChatKeyOutcome` 依赖模块级的「已提示过」集合做 toast 去重，
 * 所以每个用例都 resetModules 重新加载模块，避免用例之间串状态。
 */
const { toastWarning } = vi.hoisted(() => ({ toastWarning: vi.fn() }));

vi.mock("@/components/shared/GlassToast", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: toastWarning,
  },
}));

const CFG = "cfg-1";

function resp(
  ok: boolean,
  fallback: boolean | null
): { ok: boolean; headers: { get(): string | null } } {
  return {
    ok,
    headers: {
      get: () => (fallback === null ? null : fallback ? "1" : "0"),
    },
  };
}

let mod: typeof import("./aiStore");

function getConfig() {
  return mod.useAIStore.getState().configs.find((c) => c.id === CFG);
}

beforeEach(async () => {
  vi.resetModules();
  localStorage.clear();
  toastWarning.mockClear();
  mod = await import("./aiStore");
  mod.useAIStore.setState({
    configs: [
      {
        id: CFG,
        name: "测试端点",
        baseUrl: "https://token.sensenova.cn/v1",
        apiKey: "stale-key",
        model: "deepseek-v4-flash",
        status: "idle",
      },
    ],
    activeConfigId: CFG,
    isEnabled: true,
  });
});

describe("noteChatKeyOutcome", () => {
  it("服务端回退时打上标记并弹一次提示", () => {
    const handled = mod.noteChatKeyOutcome(CFG, resp(true, true));

    expect(handled).toBe(true);
    expect(getConfig()?.keyRejectedAt).toBeTypeOf("number");
    expect(toastWarning).toHaveBeenCalledTimes(1);
    expect(String(toastWarning.mock.calls[0][0])).toContain("密钥已失效");
  });

  it("同一配置重复回退不重复弹提示，也不覆盖首次时间戳", () => {
    mod.noteChatKeyOutcome(CFG, resp(true, true));
    const first = getConfig()?.keyRejectedAt;
    toastWarning.mockClear();

    const again = mod.noteChatKeyOutcome(CFG, resp(true, true));

    expect(again).toBe(false);
    expect(getConfig()?.keyRejectedAt).toBe(first);
    expect(toastWarning).not.toHaveBeenCalled();
  });

  it("200 但没有回退头（我们自己的 key 可用）→ 不打标记、不提示", () => {
    const handled = mod.noteChatKeyOutcome(CFG, resp(true, false));

    expect(handled).toBe(false);
    expect(getConfig()?.keyRejectedAt).toBeUndefined();
    expect(toastWarning).not.toHaveBeenCalled();
  });

  it("非 2xx → 不打标记，端点故障不能当成密钥失效", () => {
    const handled = mod.noteChatKeyOutcome(CFG, resp(false, true));

    expect(handled).toBe(false);
    expect(getConfig()?.keyRejectedAt).toBeUndefined();
    expect(toastWarning).not.toHaveBeenCalled();
  });

  it("拿不到回退头（直连上游）→ 不动状态", () => {
    const handled = mod.noteChatKeyOutcome(CFG, resp(true, null));

    expect(handled).toBe(false);
    expect(getConfig()?.keyRejectedAt).toBeUndefined();
  });

  it("配置不存在时不报错", () => {
    expect(() => mod.noteChatKeyOutcome("nope", resp(true, true))).not.toThrow();
    expect(toastWarning).not.toHaveBeenCalled();
  });

  it("响应残缺（没有 headers）时静默返回，绝不打断对话", () => {
    // 诊断旁路挂在对话主路径上，宁可漏标也不能抛错
    expect(mod.noteChatKeyOutcome(CFG, { ok: true } as never)).toBe(false);
    expect(mod.noteChatKeyOutcome(CFG, null)).toBe(false);
    expect(getConfig()?.keyRejectedAt).toBeUndefined();
    expect(toastWarning).not.toHaveBeenCalled();
  });
});

describe("失效标记的清除", () => {
  it("改了 apiKey 就清掉标记", () => {
    mod.noteChatKeyOutcome(CFG, resp(true, true));
    expect(getConfig()?.keyRejectedAt).toBeTypeOf("number");

    mod.useAIStore.getState().updateConfig(CFG, { apiKey: "brand-new-key" });

    expect(getConfig()?.keyRejectedAt).toBeUndefined();
    expect(getConfig()?.apiKey).toBe("brand-new-key");
  });

  it("改非密钥字段不清除标记", () => {
    mod.noteChatKeyOutcome(CFG, resp(true, true));

    mod.useAIStore.getState().updateConfig(CFG, { model: "other-model" });

    expect(getConfig()?.keyRejectedAt).toBeTypeOf("number");
    expect(getConfig()?.model).toBe("other-model");
  });

  it("写入相同的 apiKey 不算换密钥，标记保留", () => {
    mod.noteChatKeyOutcome(CFG, resp(true, true));

    mod.useAIStore.getState().updateConfig(CFG, { apiKey: "stale-key" });

    expect(getConfig()?.keyRejectedAt).toBeTypeOf("number");
  });

  it("换过密钥之后再次被拒，会重新提示", () => {
    mod.noteChatKeyOutcome(CFG, resp(true, true));
    expect(toastWarning).toHaveBeenCalledTimes(1);

    mod.useAIStore.getState().updateConfig(CFG, { apiKey: "another-key" });
    mod.noteChatKeyOutcome(CFG, resp(true, true));

    expect(toastWarning).toHaveBeenCalledTimes(2);
    expect(getConfig()?.keyRejectedAt).toBeTypeOf("number");
  });
});

describe("失效标记的持久化", () => {
  it("重水合后 keyRejectedAt 仍在——normalize 是逐字段重建的，漏登记就会丢", async () => {
    mod.noteChatKeyOutcome(CFG, resp(true, true));
    const stored = getConfig()?.keyRejectedAt;
    expect(stored).toBeTypeOf("number");

    vi.resetModules();
    const reloaded = await import("./aiStore");
    // S6-1: persisted stores no longer hydrate at import time; the bootstrap does it explicitly.
    await reloaded.useAIStore.persist.rehydrate();
    const cfg = reloaded.useAIStore.getState().configs.find((c) => c.id === CFG);

    expect(cfg?.keyRejectedAt).toBe(stored);
  });
});
