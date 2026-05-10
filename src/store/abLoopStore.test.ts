import { describe, it, expect, beforeEach } from "vitest";
import { useABLoopStore } from "@/store/abLoopStore";

describe("ABLoop", () => {
  beforeEach(() => {
    useABLoopStore.setState({
      isEnabled: false,
      pointA: null,
      pointB: null,
      loopCount: 0,
    });
  });

  it("设置 A/B 点后可以启用循环", () => {
    const store = useABLoopStore.getState();
    store.setPointA(10);
    store.setPointB(30);
    store.enableLoop();
    expect(useABLoopStore.getState().isEnabled).toBe(true);
  });

  it("A 点大于 B 点时不能启用循环", () => {
    const store = useABLoopStore.getState();
    store.setPointA(30);
    store.setPointB(10);
    store.enableLoop();
    expect(useABLoopStore.getState().isEnabled).toBe(false);
  });

  it("清除 A 点后自动禁用循环", () => {
    const store = useABLoopStore.getState();
    store.setPointA(10);
    store.setPointB(30);
    store.enableLoop();
    store.clearPointA();
    expect(useABLoopStore.getState().isEnabled).toBe(false);
    expect(useABLoopStore.getState().pointA).toBeNull();
  });

  it("loopCount 初始为 0", () => {
    expect(useABLoopStore.getState().loopCount).toBe(0);
  });

  it("incrementLoopCount 递增 loopCount", () => {
    const store = useABLoopStore.getState();
    store.incrementLoopCount();
    expect(useABLoopStore.getState().loopCount).toBe(1);
    store.incrementLoopCount();
    expect(useABLoopStore.getState().loopCount).toBe(2);
  });

  it("resetLoopCount 归零 loopCount", () => {
    useABLoopStore.setState({ loopCount: 5 });
    useABLoopStore.getState().resetLoopCount();
    expect(useABLoopStore.getState().loopCount).toBe(0);
  });
});
