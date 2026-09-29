import React from "react";

export type StatusKind = "ok" | "warn" | "error" | "idle";

const TONE: Record<StatusKind, { dot: string; text: string; label: string }> = {
  ok: {
    dot: "bg-emerald-400 shadow-[0_0_6px_rgba(52,199,89,0.75)]",
    text: "text-emerald-300",
    label: "正常",
  },
  warn: {
    dot: "bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.75)]",
    text: "text-amber-300",
    label: "需处理",
  },
  error: {
    dot: "bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.75)]",
    text: "text-rose-300",
    label: "异常",
  },
  idle: { dot: "bg-white/30", text: "text-white/40", label: "未测试" },
};

export interface StatusDotProps {
  status: StatusKind;
  /** 覆盖默认文案（如「需登录」） */
  label?: string;
  /** 只要圆点不要文字 */
  showLabel?: boolean;
  /** 有值时优先显示延迟，替代状态文案 */
  latencyMs?: number;
}

export function StatusDot({ status, label, showLabel = true, latencyMs }: StatusDotProps) {
  const tone = TONE[status];
  const text = label ?? (latencyMs != null ? `${latencyMs}ms` : tone.label);
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[11px] font-medium tabular-nums ${tone.text}`}
      data-status={status}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${tone.dot}`} />
      {showLabel && <span>{text}</span>}
    </span>
  );
}
