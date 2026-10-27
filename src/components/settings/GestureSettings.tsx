"use client";

import React, { useEffect, useState } from "react";
import {
  Activity,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Camera,
  Eye,
  Gauge,
  Hand,
  HandMetal,
  LoaderCircle,
  RotateCcw,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { GlassPanel, GlassSelect, GlassToggle } from "@/components/shared/Glass";
import { listGestureCameras } from "@/lib/gesture/camera";
import { useGestureStore } from "@/store/gestureStore";
import { useGestureSettingsStore } from "@/store/gestureSettingsStore";
import {
  GESTURE_ACTION_DEFINITIONS,
  GESTURE_COMMAND_DEFINITIONS,
  type GestureActionId,
  type GestureCameraDevice,
  type GestureCommandId,
  type GestureMode,
  type GesturePosture,
  type GestureStatus,
} from "@/lib/gesture/types";

interface GestureSettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

const STATUS_LABELS: Record<GestureStatus, string> = {
  idle: "未启动",
  loading_assets: "加载模型",
  requesting_camera: "请求摄像头",
  starting: "启动中",
  running: "运行中",
  paused: "已暂停",
  error: "运行异常",
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

const COMMAND_ICONS: Record<GestureCommandId, LucideIcon> = {
  swipe_left: ArrowLeft,
  swipe_right: ArrowRight,
  swipe_up: ArrowUp,
  swipe_down: ArrowDown,
  fist_hold: HandMetal,
};

const ACTION_OPTIONS = GESTURE_ACTION_DEFINITIONS.map((definition) => ({
  value: definition.id,
  label: definition.label,
}));

interface SectionProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  children: React.ReactNode;
}

function Section({ icon: Icon, title, description, children }: SectionProps) {
  return (
    <section className="space-y-3">
      <div className="flex items-start gap-2.5">
        <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] text-[#2997ff]">
          <Icon className="h-3.5 w-3.5" />
        </div>
        <div className="min-w-0">
          <h3 className="text-[13px] font-semibold tracking-tight text-white">{title}</h3>
          {description && (
            <p className="mt-0.5 text-[11px] leading-relaxed text-[#86868b]">{description}</p>
          )}
        </div>
      </div>
      <div className="pl-[34px]">{children}</div>
    </section>
  );
}

interface SwitchRowProps {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

function SwitchRow({ label, description, checked, onChange }: SwitchRowProps) {
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <div className="min-w-0">
        <div className="text-[13px] text-white/90">{label}</div>
        {description && (
          <div className="mt-0.5 text-[11px] leading-relaxed text-[#86868b]">{description}</div>
        )}
      </div>
      <GlassToggle checked={checked} onChange={onChange} />
    </div>
  );
}

interface RangeRowProps {
  label: string;
  description?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  valueLabel: string;
  onChange: (value: number) => void;
}

function RangeRow(props: RangeRowProps) {
  const { label, description, value, min, max, step, valueLabel, onChange } = props;

  return (
    <div className="space-y-1.5 py-1">
      <div className="flex items-baseline justify-between gap-2">
        <div className="min-w-0">
          <span className="text-[13px] text-white/90">{label}</span>
          {description && <span className="ml-2 text-[11px] text-[#86868b]">{description}</span>}
        </div>
        <span className="shrink-0 font-mono text-[12px] font-semibold text-[#2997ff]">
          {valueLabel}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        aria-label={label}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/15 accent-[#0071e3]"
      />
    </div>
  );
}

interface StatusCellProps {
  label: string;
  value: string;
}

function StatusCell({ label, value }: StatusCellProps) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-2.5 py-1.5">
      <div className="text-[10px] text-[#86868b]">{label}</div>
      <div className="truncate text-[12px] font-medium text-white/85">{value}</div>
    </div>
  );
}

/**
 * 隔空手势设置面板。
 *
 * 所有交互都即时写入 gestureSettingsStore（persist），不维护面板内的草稿状态；
 * 摄像头枚举失败只降级为可见中文提示，不抛错、不写 console。
 */
export const GestureSettings: React.FC<GestureSettingsProps> = ({ isOpen, onClose }) => {
  const enabled = useGestureSettingsStore((state) => state.enabled);
  const showHud = useGestureSettingsStore((state) => state.showHud);
  const showPreview = useGestureSettingsStore((state) => state.showPreview);
  const showSkeleton = useGestureSettingsStore((state) => state.showSkeleton);
  const showCursor = useGestureSettingsStore((state) => state.showCursor);
  const showDebugStats = useGestureSettingsStore((state) => state.showDebugStats);
  const sensitivity = useGestureSettingsStore((state) => state.sensitivity);
  const pointerSmoothing = useGestureSettingsStore((state) => state.pointerSmoothing);
  const volumeStep = useGestureSettingsStore((state) => state.volumeStep);
  const cameraDeviceId = useGestureSettingsStore((state) => state.cameraDeviceId);
  const bindings = useGestureSettingsStore((state) => state.bindings);
  const setEnabled = useGestureSettingsStore((state) => state.setEnabled);
  const update = useGestureSettingsStore((state) => state.update);
  const setBinding = useGestureSettingsStore((state) => state.setBinding);
  const resetSettings = useGestureSettingsStore((state) => state.resetSettings);

  const status = useGestureStore((state) => state.status);
  const error = useGestureStore((state) => state.error);
  const cameraActive = useGestureStore((state) => state.cameraActive);
  const modelReady = useGestureStore((state) => state.modelReady);
  const backend = useGestureStore((state) => state.backend);
  const handPresent = useGestureStore((state) => state.handPresent);
  const posture = useGestureStore((state) => state.posture);
  const mode = useGestureStore((state) => state.mode);
  const fps = useGestureStore((state) => state.fps);

  const [cameras, setCameras] = useState<GestureCameraDevice[]>([]);
  const [cameraLoading, setCameraLoading] = useState(true);
  const [cameraUnavailable, setCameraUnavailable] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    listGestureCameras()
      .then((devices) => {
        if (cancelled) return;
        setCameras(devices);
        setCameraUnavailable(devices.length === 0);
        setCameraLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setCameraUnavailable(true);
        setCameraLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const backendLabel = backend === "local" ? "本地模型" : backend === "cdn" ? "CDN 模型" : "未加载";
  const cameraOptions = [
    { value: "", label: cameraLoading ? "正在检测可用摄像头…" : "自动（默认摄像头）" },
    ...cameras.map((camera, index) => ({
      value: camera.deviceId,
      label: camera.label || "摄像头 " + String(index + 1),
    })),
  ];

  return (
    <GlassPanel position="right" size="md" isOpen={isOpen} onClose={onClose} title="隔空手势">
      <div className="space-y-6 px-5 py-4 text-white">
        <Section
          icon={ShieldCheck}
          title="隐私说明"
          description="手势识别完全在你的设备本地完成，摄像头数据不离开本机。"
        >
          <ul className="space-y-1 text-[11px] leading-relaxed text-[#86868b]">
            <li>· 摄像头画面仅用于实时关键点计算，不会录制、保存或上传任何画面。</li>
            <li>· 手势判定与光标位置都在本地内存中完成，关闭手势后立即停止读取摄像头。</li>
            <li>· 仅首次加载模型时可能从 CDN 下载模型文件，不涉及你的画面数据。</li>
          </ul>
        </Section>

        <Section
          icon={Hand}
          title="手势控制"
          description="开启后使用摄像头识别手势；随时可按 ESC 或 G 关闭。"
        >
          <SwitchRow
            label="隔空手势总开关"
            description="关闭后释放摄像头，并隐藏 HUD、光标与动作反馈。"
            checked={enabled}
            onChange={setEnabled}
          />
        </Section>

        <Section
          icon={Activity}
          title="实时状态"
          description="状态与帧率实时刷新，可用于排查权限或性能问题。"
        >
          <div className="grid grid-cols-2 gap-2">
            <StatusCell label="识别状态" value={STATUS_LABELS[status]} />
            <StatusCell label="手部" value={handPresent ? "已识别" : "未识别"} />
            <StatusCell label="模型" value={modelReady ? "已就绪" : "未加载"} />
            <StatusCell label="模型来源" value={backendLabel} />
            <StatusCell label="摄像头" value={cameraActive ? "已开启" : "未开启"} />
            <StatusCell label="姿态" value={POSTURE_LABELS[posture]} />
            <StatusCell label="模式" value={MODE_LABELS[mode]} />
            <StatusCell label="帧率" value={String(fps) + " FPS"} />
          </div>
          {error && (
            <div className="mt-2 rounded-xl border border-[#ff453a]/30 bg-[#ff453a]/10 px-3 py-2 text-[11px] leading-relaxed text-[#ff8a80]">
              {error.message}
              {error.hint ? "（" + error.hint + "）" : ""}
            </div>
          )}
        </Section>

        <Section
          icon={SlidersHorizontal}
          title="灵敏度与步进"
          description="灵敏度越高越容易触发；指针平滑越高越稳，但延迟会略微增加。"
        >
          <RangeRow
            label="识别灵敏度"
            value={sensitivity}
            min={0.5}
            max={2}
            step={0.05}
            valueLabel={"x" + sensitivity.toFixed(2)}
            onChange={(value) => update({ sensitivity: value })}
          />
          <RangeRow
            label="指针平滑"
            value={pointerSmoothing}
            min={0}
            max={1}
            step={0.01}
            valueLabel={String(Math.round(pointerSmoothing * 100)) + "%"}
            onChange={(value) => update({ pointerSmoothing: value })}
          />
          <RangeRow
            label="音量步进"
            value={volumeStep}
            min={0.01}
            max={0.2}
            step={0.01}
            valueLabel={String(Math.round(volumeStep * 100)) + "%"}
            onChange={(value) => update({ volumeStep: value })}
          />
        </Section>

        <Section
          icon={Camera}
          title="摄像头"
          description="优先使用系统默认摄像头；有多个摄像头时可手动指定。"
        >
          {cameraLoading && (
            <div className="mb-2 flex items-center gap-1.5 text-[11px] text-[#86868b]">
              <LoaderCircle className="h-3 w-3 animate-spin" />
              正在检测可用摄像头…
            </div>
          )}
          {cameraUnavailable && (
            <div className="mb-2 rounded-xl border border-[#ffd60a]/30 bg-[#ffd60a]/10 px-3 py-2 text-[11px] leading-relaxed text-[#ffd60a]">
              摄像头列表不可用，请检查系统摄像头权限后重新打开本面板。
            </div>
          )}
          <GlassSelect
            value={cameraDeviceId ?? ""}
            options={cameraOptions}
            onChange={(value) => update({ cameraDeviceId: value === "" ? null : value })}
            disabled={cameraLoading || cameraUnavailable}
          />
          <p className="mt-1.5 text-[10px] text-[#86868b]">
            切换摄像头后会在下一次开启手势时生效。
          </p>
        </Section>

        <Section
          icon={Gauge}
          title="命令手势绑定"
          description="为每个命令手势指定动作；选择「不绑定」只保留检测，不执行操作。"
        >
          <div className="space-y-2.5">
            {GESTURE_COMMAND_DEFINITIONS.map((command) => {
              const CommandIcon = COMMAND_ICONS[command.id];
              return (
                <div
                  key={command.id}
                  className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5"
                >
                  <div className="flex items-center gap-2">
                    <CommandIcon className="h-3.5 w-3.5 shrink-0 text-[#2997ff]" />
                    <div className="min-w-0 flex-1">
                      <div className="text-[12px] font-medium text-white/90">{command.label}</div>
                      <div className="mt-0.5 text-[10px] leading-relaxed text-[#86868b]">
                        {command.description}
                      </div>
                    </div>
                  </div>
                  <div className="mt-2">
                    <GlassSelect
                      value={bindings[command.id]}
                      options={ACTION_OPTIONS}
                      onChange={(value) => setBinding(command.id, value as GestureActionId)}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Section>

        <Section
          icon={Eye}
          title="显示与调试"
          description="控制 HUD、摄像头预览、手部骨骼与虚拟光标的可见性。"
        >
          <div className="space-y-1">
            <SwitchRow
              label="悬浮 HUD"
              description="右上角显示手势状态、摄像头预览与快捷键提示。"
              checked={showHud}
              onChange={(checked) => update({ showHud: checked })}
            />
            <SwitchRow
              label="HUD 摄像头预览"
              description="在 HUD 中显示镜像后的摄像头画面。"
              checked={showPreview}
              onChange={(checked) => update({ showPreview: checked })}
            />
            <SwitchRow
              label="HUD 手部骨骼"
              description="在预览画面上叠加 21 个手部关键点。"
              checked={showSkeleton}
              onChange={(checked) => update({ showSkeleton: checked })}
            />
            <SwitchRow
              label="虚拟光标"
              description="手势指向时在屏幕上显示跟随光标。"
              checked={showCursor}
              onChange={(checked) => update({ showCursor: checked })}
            />
            <SwitchRow
              label="HUD 诊断信息"
              description="显示帧率、姿态、模式与模型来源，便于调参。"
              checked={showDebugStats}
              onChange={(checked) => update({ showDebugStats: checked })}
            />
          </div>
        </Section>

        <div className="border-t border-white/[0.08] pt-4">
          <button
            type="button"
            onClick={resetSettings}
            className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-white/[0.12] bg-white/[0.06] px-3 py-2 text-[12px] text-white/80 transition-colors hover:bg-white/[0.12]"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            恢复默认设置
          </button>
        </div>
      </div>
    </GlassPanel>
  );
};
