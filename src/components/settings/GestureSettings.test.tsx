/* eslint-disable @typescript-eslint/no-explicit-any */
// 测试桩（framer-motion mock、React 内部快照替换）用宽松类型是刻意的，收紧只会引入与被测逻辑无关的噪音
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { GestureSettings } from "./GestureSettings";
import { useGestureStore } from "@/store/gestureStore";
import { useGestureSettingsStore } from "@/store/gestureSettingsStore";
import { createDefaultGestureSettings } from "@/lib/gesture/types";

vi.mock("framer-motion", () => ({
  motion: new Proxy(
    {},
    {
      get: (_, prop: string) => {
        return ({ children, ...props }: any) => React.createElement(prop, props, children);
      },
    }
  ),
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

// renderToStaticMarkup 下 useSyncExternalStore 取的是 server 快照（getInitialState），
// 测试里临时回落到 client 快照，才能用 setState 构造被测状态。
const reactiveReact = React as unknown as {
  useSyncExternalStore: (
    subscribe: (onStoreChange: () => void) => () => void,
    getSnapshot: () => unknown,
    getServerSnapshot?: () => unknown
  ) => unknown;
};
const originalUseSyncExternalStore = reactiveReact.useSyncExternalStore;

function renderSettings(): string {
  return renderToStaticMarkup(<GestureSettings isOpen={true} onClose={() => undefined} />);
}

describe("GestureSettings", () => {
  beforeEach(() => {
    useGestureStore.getState().resetRuntime();
    useGestureSettingsStore.setState(createDefaultGestureSettings());
    reactiveReact.useSyncExternalStore = (_subscribe, getSnapshot) => getSnapshot();
  });

  afterEach(() => {
    reactiveReact.useSyncExternalStore = originalUseSyncExternalStore;
    useGestureStore.getState().resetRuntime();
  });

  it("关闭面板时不渲染内容", () => {
    const html = renderToStaticMarkup(<GestureSettings isOpen={false} onClose={() => undefined} />);

    expect(html).toBe("");
  });

  it("展示隐私说明、总开关、实时状态、滑杆、摄像头与显示开关", () => {
    const html = renderSettings();

    expect(html).toContain("隔空手势");
    expect(html).toContain("隐私说明");
    expect(html).toContain("不会录制、保存或上传任何画面");
    expect(html).toContain("隔空手势总开关");
    expect(html).toContain("实时状态");
    expect(html).toContain("识别状态");
    expect(html).toContain("模型");
    expect(html).toContain("摄像头");
    expect(html).toContain("灵敏度与步进");
    expect(html).toContain("识别灵敏度");
    expect(html).toContain("指针平滑");
    expect(html).toContain("音量步进");
    expect(html).toContain("命令手势绑定");
    expect(html).toContain("显示与调试");
    expect(html).toContain("悬浮 HUD");
    expect(html).toContain("虚拟光标");
    expect(html).toContain("HUD 诊断信息");
    expect(html).toContain("恢复默认设置");
  });

  it("渲染 5 个命令手势与含「不绑定」的动作下拉", () => {
    const html = renderSettings();

    expect(html).toContain("张开手掌左滑");
    expect(html).toContain("张开手掌右滑");
    expect(html).toContain("张开手掌上滑");
    expect(html).toContain("张开手掌下滑");
    expect(html).toContain("握拳停顿");
    expect(html).toContain("下一首");
    expect(html).toContain("不绑定");
  });

  it("实时状态渲染运行中的模型、手部与帧率", () => {
    useGestureStore.setState({
      status: "running",
      handPresent: true,
      modelReady: true,
      cameraActive: true,
      backend: "local",
      posture: "point",
      mode: "pointer",
      fps: 30,
    });
    useGestureSettingsStore.setState({ enabled: true, showHud: true });

    const html = renderSettings();

    expect(html).toContain("运行中");
    expect(html).toContain("已识别");
    expect(html).toContain("已就绪");
    expect(html).toContain("本地模型");
    expect(html).toContain("食指指向");
    expect(html).toContain("指针");
    expect(html).toContain("30 FPS");
  });

  it("运行错误时展示中文错误与提示", () => {
    useGestureStore.setState({
      status: "error",
      error: {
        code: "model_load_failed",
        message: "手势模型加载失败。",
        recoverable: true,
        hint: "请检查网络后重试。",
      },
    });

    const html = renderSettings();

    expect(html).toContain("运行异常");
    expect(html).toContain("手势模型加载失败。");
    expect(html).toContain("请检查网络后重试。");
  });
});
