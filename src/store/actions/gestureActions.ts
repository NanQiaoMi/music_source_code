/**
 * S6-9d：手势会话（useGestureSession）的 store 命令式入口。
 *
 * 手势检测循环（rAF / 摄像头回调）每帧都要读「此刻」设置与运行时状态；
 * selector 化会让每帧检测触发 React 重渲染，因此保留命令式读取并收口到动作层。
 */
import { useGestureSettingsStore } from "@/store/gestureSettingsStore";
import { useGestureStore } from "@/store/gestureStore";

export const getGestureSettingsSnapshot = () => useGestureSettingsStore.getState();

export const getGestureBindings = () => useGestureSettingsStore.getState().bindings;

export const getGestureRuntimeSnapshot = () => useGestureStore.getState();
