import React from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { GestureHUD } from "./GestureHUD";
import { useGestureStore } from "@/store/gestureStore";
import { useGestureSettingsStore } from "@/store/gestureSettingsStore";
import { createDefaultGestureSettings } from "@/lib/gesture/types";

const videoRef = { current: null } as React.RefObject<HTMLVideoElement | null>;
const canvasRef = { current: null } as React.RefObject<HTMLCanvasElement | null>;

function renderHud(): string {
  return renderToStaticMarkup(
    <GestureHUD
      videoRef={videoRef}
      canvasRef={canvasRef}
      onRetry={() => undefined}
      onOpenSettings={() => undefined}
    />
  );
}

// renderToStaticMarkup 下 useSyncExternalStore 取的是 server 快照（getInitialState），
// 测试里临时让它回落到 client 快照，才能用 setState 构造被测状态。
const reactiveReact = React as unknown as {
  useSyncExternalStore: (
    subscribe: (onStoreChange: () => void) => () => void,
    getSnapshot: () => unknown,
    getServerSnapshot?: () => unknown
  ) => unknown;
};
const originalUseSyncExternalStore = reactiveReact.useSyncExternalStore;

function useLiveServerSnapshots(): void {
  reactiveReact.useSyncExternalStore = (subscribe, getSnapshot) => getSnapshot();
}

describe("GestureHUD", () => {
  beforeEach(() => {
    useGestureStore.getState().resetRuntime();
    useGestureSettingsStore.setState(createDefaultGestureSettings());
    useLiveServerSnapshots();
  });

  afterEach(() => {
    reactiveReact.useSyncExternalStore = originalUseSyncExternalStore;
  });

  it("关闭总开关时不渲染节点；隐藏 HUD 时仅保留不可见的媒体层", () => {
    expect(renderHud()).toBe("");

    useGestureSettingsStore.setState({ enabled: true, showHud: false });
    const hiddenHud = renderHud();

    // showHud=false 时不渲染任何可见 UI，但 video/canvas 必须继续挂载给 Controller 用
    expect(hiddenHud).not.toContain("隔空手势");
    expect(hiddenHud).not.toContain("关闭手势");
    expect(hiddenHud).toContain("<video");
    expect(hiddenHud).toContain("<canvas");
  });

  it("运行中展示状态、摄像头预览、画布与快捷键提示", () => {
    useGestureSettingsStore.setState({ enabled: true, showHud: true });
    useGestureStore.setState({
      status: "running",
      handPresent: true,
      modelReady: true,
      cameraActive: true,
      backend: "local",
      fps: 30,
      posture: "point",
      mode: "pointer",
    });

    const html = renderHud();

    expect(html).toContain("隔空手势");
    expect(html).toContain("运行中 · 已识别到手");
    expect(html).toContain("关闭手势");
    expect(html).toContain("ESC / G 关闭");
    expect(html).toContain("摄像头预览");
    expect(html).toContain("<video");
    expect(html).toContain("<canvas");
    expect(html).toContain('width="640"');
    expect(html).toContain('height="480"');
    expect(html).toContain("scaleX(-1)");
    expect(html).toContain('data-gesture-ignore="true"');
  });

  it("未识别到手时给出对应文案，并渲染折叠态但不卸载视频节点", () => {
    useGestureSettingsStore.setState({ enabled: true, showHud: true });
    useGestureStore.setState({ status: "running", handPresent: false });

    expect(renderHud()).toContain("运行中 · 未识别到手");

    useGestureSettingsStore.setState({ hudCollapsed: true });
    const collapsed = renderHud();

    expect(collapsed).toContain("隔空手势");
    expect(collapsed).not.toContain("ESC / G 关闭");
    expect(collapsed).not.toContain("关闭手势");
    // 折叠后 video/canvas 仍需挂载，否则 Controller 的 ref 会失效
    expect(collapsed).toContain("<video");
    expect(collapsed).toContain("<canvas");
  });

  it("错误状态渲染中文错误信息、提示与重试/设置入口", () => {
    useGestureSettingsStore.setState({ enabled: true, showHud: true });
    useGestureStore.setState({
      status: "error",
      error: {
        code: "permission_denied",
        message: "摄像头权限被拒绝，无法启动手势识别。",
        recoverable: true,
        hint: "请在系统设置的隐私权限中允许摄像头访问后重试。",
      },
    });

    const html = renderHud();

    expect(html).toContain("手势识别不可用");
    expect(html).toContain("摄像头权限被拒绝，无法启动手势识别。");
    expect(html).toContain("请在系统设置的隐私权限中允许摄像头访问后重试。");
    expect(html).toContain("重试");
    expect(html).toContain("打开设置");
    expect(html).toContain('data-gesture-ignore="true"');
    // 错误态下媒体节点也必须常驻，否则点“重试”时 session 拿不到 video/canvas ref
    expect(html).toContain("<video");
    expect(html).toContain("<canvas");
  });

  it("开启诊断后展示帧率、姿态、模式与模型来源", () => {
    useGestureSettingsStore.setState({ enabled: true, showHud: true, showDebugStats: true });
    useGestureStore.setState({
      status: "running",
      handPresent: true,
      modelReady: true,
      cameraActive: true,
      backend: "local",
      fps: 27,
      posture: "open_palm",
      mode: "palm",
    });

    const html = renderHud();

    expect(html).toContain("27 FPS");
    expect(html).toContain("张开手掌");
    expect(html).toContain("手掌");
    expect(html).toContain("已就绪");
    expect(html).toContain("本地模型");
  });
});
