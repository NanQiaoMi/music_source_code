"use client";

import React from "react";
import {
  Camera,
  CameraOff,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Hand,
  LoaderCircle,
  RefreshCw,
  Settings2,
  X,
} from "lucide-react";
import { useGestureStore } from "@/store/gestureStore";
import { useGestureSettingsStore } from "@/store/gestureSettingsStore";
import type { GestureMode, GesturePosture, GestureStatus } from "@/lib/gesture/types";

interface GestureHUDProps {
  /** 由 GestureController 持有并注入，HUD 只负责挂载节点与样式。 */
  videoRef: React.RefObject<HTMLVideoElement | null>;
  /** 骨骼覆盖层画布（640x480），CSS 显示为 200x150。 */
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  /** 错误卡片上的“重试”由 Controller 实现。 */
  onRetry: () => void;
  /** 打开设置面板由外层编排组件实现，HUD 不直接操作 uiStore。 */
  onOpenSettings: () => void;
}

const STATUS_LABELS: Record<GestureStatus, string> = {
  idle: "未启动",
  loading_assets: "正在加载模型",
  requesting_camera: "正在请求摄像头",
  starting: "正在启动识别",
  running: "运行中",
  paused: "已暂停",
  error: "运行异常",
};

const STATUS_DOT_CLASSES: Record<GestureStatus, string> = {
  idle: "bg-white/30",
  loading_assets: "bg-[#ffd60a] animate-pulse",
  requesting_camera: "bg-[#ffd60a] animate-pulse",
  starting: "bg-[#2997ff] animate-pulse",
  running: "bg-[#30d158]",
  paused: "bg-[#ffd60a]",
  error: "bg-[#ff453a]",
};

const POSTURE_LABELS: Record<GesturePosture, string> = {
  none: "未识别",
  unknown: "识别中",
  point: "食指指向",
  open_palm: "张开手掌",
  fist: "握拳",
};

const MODE_LABELS: Record<GestureMode, string> = {
  idle: "待机",
  pointer: "指针",
  pinch: "捏合",
  drag: "拖拽",
  palm: "手掌",
  fist: "握拳",
  cooldown: "冷却中",
};

const LOADING_STATUSES: readonly GestureStatus[] = [
  "loading_assets",
  "requesting_camera",
  "starting",
];

const CONTROL_BUTTON_CLASS =
  "flex flex-1 cursor-pointer items-center justify-center gap-1 rounded-lg border border-white/10 bg-white/[0.06] px-1.5 py-1 text-[10px] text-white/75 transition-colors hover:bg-white/[0.12]";

/** 媒体层不可见时的容器：0 尺寸 + 透明，只保证 video/canvas 一直在 DOM 内。 */
const MEDIA_HIDDEN_CLASS =
  "pointer-events-none absolute left-0 top-0 h-0 w-0 overflow-hidden opacity-0";
const MEDIA_VISIBLE_CLASS =
  "relative overflow-hidden rounded-xl border border-white/10 bg-black/40";

/**
 * 右上角手势 HUD。
 *
 * 约定：
 * - 根节点始终带 data-gesture-ignore，隔空指针桥会跳过整棵子树，避免光标误点 HUD；
 * - enabled=true 时 video/canvas 必须常驻 DOM（折叠、隐藏 HUD、错误态都只做视觉隐藏），
 *   否则 Controller 持有的 ref 会失效，重试时拿不到节点、摄像头流无人接管；
 * - 错误状态只通过可见中文文案反馈，不写 console、不用 alert。
 */
export const GestureHUD: React.FC<GestureHUDProps> = ({
  videoRef,
  canvasRef,
  onRetry,
  onOpenSettings,
}) => {
  const enabled = useGestureSettingsStore((state) => state.enabled);
  const showHud = useGestureSettingsStore((state) => state.showHud);
  const showPreview = useGestureSettingsStore((state) => state.showPreview);
  const showSkeleton = useGestureSettingsStore((state) => state.showSkeleton);
  const showDebugStats = useGestureSettingsStore((state) => state.showDebugStats);
  const hudCollapsed = useGestureSettingsStore((state) => state.hudCollapsed);
  const update = useGestureSettingsStore((state) => state.update);
  const setEnabled = useGestureSettingsStore((state) => state.setEnabled);

  const status = useGestureStore((state) => state.status);
  const error = useGestureStore((state) => state.error);
  const cameraActive = useGestureStore((state) => state.cameraActive);
  const modelReady = useGestureStore((state) => state.modelReady);
  const backend = useGestureStore((state) => state.backend);
  const handPresent = useGestureStore((state) => state.handPresent);
  const posture = useGestureStore((state) => state.posture);
  const mode = useGestureStore((state) => state.mode);
  const fps = useGestureStore((state) => state.fps);
  const dwell = useGestureStore((state) => state.dwell);

  // 关闭总开关后整棵 UI（含媒体层）都不再需要
  if (!enabled) return null;

  const showError = status === "error";
  const loading = LOADING_STATUSES.indexOf(status) >= 0;
  const previewVisible = showHud && !showError && !hudCollapsed && showPreview;
  const handLabel = handPresent ? "已识别到手" : "未识别到手";
  const statusText = status === "running" ? "运行中 · " + handLabel : STATUS_LABELS[status];
  const dwellProgress = Math.round(Math.min(1, Math.max(0, dwell?.progress ?? 0)) * 100);
  const backendLabel = backend === "local" ? "本地模型" : backend === "cdn" ? "CDN 模型" : "未知";

  return (
    <div
      data-gesture-ignore="true"
      className={
        showHud
          ? "pointer-events-auto fixed right-4 top-4 z-[9990] select-none rounded-2xl border text-white shadow-[0_16px_48px_rgba(0,0,0,0.45)] backdrop-blur-2xl " +
            (showError
              ? "w-[252px] border-[#ff453a]/30 bg-[#1c1c1e]/80 p-3"
              : "w-[224px] border-white/[0.10] bg-white/[0.04]")
          : "pointer-events-none hidden"
      }
    >
      {showHud && !showError && (
        <div className="flex items-center gap-2 px-3 pb-2 pt-2.5">
          <span className={"h-2 w-2 shrink-0 rounded-full " + STATUS_DOT_CLASSES[status]} />
          <Hand className="h-4 w-4 shrink-0 text-white/70" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[12px] font-semibold tracking-tight">隔空手势</div>
            <div className="truncate text-[10px] text-[#86868b]">{statusText}</div>
          </div>
          {loading && <LoaderCircle className="h-3.5 w-3.5 shrink-0 animate-spin text-[#2997ff]" />}
          <button
            type="button"
            onClick={onOpenSettings}
            aria-label="手势设置"
            className="cursor-pointer rounded-full p-1 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
          >
            <Settings2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => update({ hudCollapsed: !hudCollapsed })}
            aria-label={hudCollapsed ? "展开手势面板" : "折叠手势面板"}
            aria-expanded={!hudCollapsed}
            className="cursor-pointer rounded-full p-1 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
          >
            {hudCollapsed ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronUp className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      )}

      {showHud && showError && (
        <>
          <div className="flex items-start gap-2">
            <div className="mt-0.5 rounded-full bg-[#ff453a]/15 p-1.5 text-[#ff453a]">
              <CameraOff className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-semibold tracking-tight">手势识别不可用</div>
              <p className="mt-1 text-[11px] leading-relaxed text-white/85">
                {error?.message ?? "手势识别服务未能启动。"}
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-[#86868b]">
                {error?.hint ?? "请允许摄像头权限，或检查摄像头是否被其他程序占用后重试。"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setEnabled(false)}
              aria-label="关闭隔空手势"
              className="cursor-pointer rounded-full p-1 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={onRetry}
              className="flex flex-1 cursor-pointer items-center justify-center gap-1 rounded-xl bg-[#0071e3] px-2 py-1.5 text-[11px] font-medium text-white transition-opacity hover:opacity-90"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              重试
            </button>
            <button
              type="button"
              onClick={onOpenSettings}
              className="flex flex-1 cursor-pointer items-center justify-center gap-1 rounded-xl border border-white/15 bg-white/[0.08] px-2 py-1.5 text-[11px] text-white/85 transition-colors hover:bg-white/[0.14]"
            >
              <Settings2 className="h-3.5 w-3.5" />
              打开设置
            </button>
          </div>
        </>
      )}

      {/* 媒体层：无论 HUD 是否展开、是否错误、是否显示 HUD，都常驻 DOM */}
      <div className={previewVisible ? "px-3" : MEDIA_HIDDEN_CLASS}>
        <div className={MEDIA_VISIBLE_CLASS}>
          <video
            ref={videoRef}
            className="h-[150px] w-[200px] object-cover"
            style={{ transform: "scaleX(-1)" }}
            playsInline
            muted
            aria-label="摄像头预览"
          />
          <canvas
            ref={canvasRef}
            width={640}
            height={480}
            aria-hidden="true"
            className={
              showSkeleton && previewVisible
                ? "pointer-events-none absolute left-0 top-0 h-[150px] w-[200px] object-cover"
                : "pointer-events-none absolute left-0 top-0 hidden h-[150px] w-[200px] object-cover"
            }
            style={{ transform: "scaleX(-1)" }}
          />
          {!cameraActive && previewVisible && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/55 text-[10px] text-white/70">
              <CameraOff className="h-4 w-4" />
              摄像头未开启
            </div>
          )}
        </div>
      </div>

      {showHud && !showError && !hudCollapsed && (
        <div className="space-y-2 px-3 pb-3 pt-2.5">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => update({ showPreview: !showPreview })}
              aria-label={showPreview ? "隐藏摄像头预览" : "显示摄像头预览"}
              aria-pressed={showPreview}
              className={
                CONTROL_BUTTON_CLASS +
                (showPreview ? " border-[#0071e3]/60 bg-[#0071e3]/20 text-[#2997ff]" : "")
              }
            >
              {showPreview ? <Camera className="h-3 w-3" /> : <CameraOff className="h-3 w-3" />}
              预览
            </button>
            <button
              type="button"
              onClick={() => update({ showSkeleton: !showSkeleton })}
              aria-label={showSkeleton ? "隐藏手部骨骼" : "显示手部骨骼"}
              aria-pressed={showSkeleton}
              className={
                CONTROL_BUTTON_CLASS +
                (showSkeleton ? " border-[#0071e3]/60 bg-[#0071e3]/20 text-[#2997ff]" : "")
              }
            >
              {showSkeleton ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
              骨骼
            </button>
          </div>

          {dwell && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10px] text-[#86868b]">
                <span>握拳停顿</span>
                <span className="font-mono text-[#2997ff]">{dwellProgress}%</span>
              </div>
              <div className="h-1 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-[#0071e3]"
                  style={{ width: dwellProgress + "%" }}
                />
              </div>
            </div>
          )}

          {showDebugStats && (
            <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 rounded-xl bg-white/[0.03] p-2 font-mono text-[10px] text-[#86868b]">
              <span>帧率</span>
              <span className="text-right text-white/70">{fps} FPS</span>
              <span>姿态</span>
              <span className="text-right text-white/70">{POSTURE_LABELS[posture]}</span>
              <span>模式</span>
              <span className="text-right text-white/70">{MODE_LABELS[mode]}</span>
              <span>模型</span>
              <span className="text-right text-white/70">{modelReady ? "已就绪" : "加载中"}</span>
              <span>摄像头</span>
              <span className="text-right text-white/70">{cameraActive ? "已开启" : "未开启"}</span>
              <span>来源</span>
              <span className="text-right text-white/70">{backendLabel}</span>
            </div>
          )}

          <button
            type="button"
            onClick={() => setEnabled(false)}
            className="flex w-full cursor-pointer items-center justify-center gap-1 rounded-lg border border-[#ff453a]/25 bg-[#ff453a]/[0.12] px-2 py-1.5 text-[11px] text-[#ff8a80] transition-colors hover:bg-[#ff453a]/20"
            aria-label="关闭隔空手势"
          >
            <X className="h-3 w-3" />
            关闭手势
          </button>

          <p className="text-center text-[10px] leading-relaxed text-[#86868b]">
            ESC / G 关闭 · C 摄像头 · S 骨骼
          </p>
        </div>
      )}
    </div>
  );
};
