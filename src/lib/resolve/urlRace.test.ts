import { describe, it, expect, vi, afterEach } from "vitest";
import { firstUsable, takeWithin } from "./urlRace";

const delay = <T>(ms: number, value: T): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(value), ms));

afterEach(() => {
  vi.useRealTimers();
});

describe("firstUsable", () => {
  it("返回空列表时直接为 null，不悬挂", async () => {
    await expect(firstUsable([])).resolves.toBeNull();
    await expect(firstUsable([null, undefined])).resolves.toBeNull();
  });

  it("返回第一个给出可用 url 的结果，即便它不是最先 resolve 的", async () => {
    const result = await firstUsable([
      delay(40, null),
      delay(10, { url: "http://b", source: "b" }),
      delay(5, null),
    ]);
    expect(result?.url).toBe("http://b");
  });

  it("全部落空（null）时返回 null", async () => {
    await expect(firstUsable([delay(1, null), delay(2, null)])).resolves.toBeNull();
  });

  it("一条分支 reject 不影响其他分支", async () => {
    const result = await firstUsable([
      Promise.reject(new Error("boom")),
      delay(5, { url: "http://ok" }),
    ]);
    expect(result?.url).toBe("http://ok");
  });

  it("全部 reject 时返回 null 而不是抛出", async () => {
    await expect(
      firstUsable([Promise.reject(new Error("a")), Promise.reject(new Error("b"))])
    ).resolves.toBeNull();
  });

  it("忽略 url 为空的结果", async () => {
    await expect(firstUsable([delay(1, { url: "" }), delay(1, null)])).resolves.toBeNull();
  });
});

describe("takeWithin", () => {
  it("分支在预算内返回时原样带回结果", async () => {
    const result = await takeWithin(delay(5, { url: "http://fast" }), 200);
    expect(result?.url).toBe("http://fast");
  });

  it("分支超过预算时返回 null（这正是不让慢分支挡住后继分支的关键）", async () => {
    vi.useFakeTimers();
    const pending = takeWithin(delay(10_000, { url: "http://slow" }), 50);
    await vi.advanceTimersByTimeAsync(60);
    await expect(pending).resolves.toBeNull();
  });

  it("预算为 0 或分支为空时立即为 null", async () => {
    await expect(takeWithin(delay(1, { url: "http://x" }), 0)).resolves.toBeNull();
    await expect(takeWithin(null, 100)).resolves.toBeNull();
    await expect(takeWithin(undefined, 100)).resolves.toBeNull();
  });

  it("分支 reject 时返回 null", async () => {
    await expect(takeWithin(Promise.reject(new Error("boom")), 200)).resolves.toBeNull();
  });
});
