import React from "react";
import { ChevronDown } from "lucide-react";
import { StatusDot, StatusKind } from "./StatusDot";

export interface SettingRowProps {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  /** 次要标签（如「需登录」「新晋」）。显式传入才出现 */
  badge?: string;
  status?: StatusKind;
  latencyMs?: number;
  /** 右侧控件（开关、下拉），渲染在整行按钮之外 */
  control?: React.ReactNode;
  /** 右侧纯文本/链接 */
  trailing?: React.ReactNode;
  /** 可展开：配合 expanded / onToggle / children */
  expandable?: boolean;
  expanded?: boolean;
  onToggle?: () => void;
  /** 悬停提示，用来承载被精简掉的描述 */
  description?: string;
  children?: React.ReactNode;
}

export function SettingRow({
  icon,
  title,
  subtitle,
  badge,
  status,
  latencyMs,
  control,
  trailing,
  expandable,
  expanded,
  onToggle,
  description,
  children,
}: SettingRowProps) {
  const interactive = Boolean(onToggle);
  /**
   * 状态位兜底：可交互行必须始终有点，否则开关右侧会空出一列；
   * 纯展示行只有真的给了状态/延迟才显示，免得给没有状态概念的行挂上「未测试」。
   */
  const dotStatus = status ?? (interactive || latencyMs != null ? "idle" : undefined);

  const body = (
    <>
      {icon && <span className="shrink-0 text-white/55">{icon}</span>}

      <span className="flex-1 min-w-0">
        <span className="flex items-center gap-2">
          <span
            className="text-[13.5px] font-medium text-white truncate"
            title={description ?? title}
          >
            {title}
          </span>
          {badge && (
            <span className="shrink-0 text-[10px] leading-none px-1.5 py-1 rounded border border-white/10 bg-white/[0.06] text-white/55">
              {badge}
            </span>
          )}
        </span>
        {subtitle && (
          <span className="block mt-0.5 text-[12px] text-white/40 truncate">{subtitle}</span>
        )}
      </span>

      {dotStatus && <StatusDot status={dotStatus} latencyMs={latencyMs} />}
      {trailing}

      {expandable && (
        <ChevronDown
          className={`w-4 h-4 text-white/35 shrink-0 transition-transform ${
            expanded ? "rotate-180" : ""
          }`}
        />
      )}
    </>
  );

  return (
    <div className="border-b border-white/[0.05] last:border-b-0">
      <div
        className={`flex items-center py-3 pr-4 ${
          interactive ? "transition-colors hover:bg-white/[0.04]" : ""
        }`}
      >
        {interactive ? (
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={expandable ? Boolean(expanded) : undefined}
            className="flex-1 min-w-0 flex items-center gap-3 pl-4 text-left"
          >
            {body}
          </button>
        ) : (
          <div className="flex-1 min-w-0 flex items-center gap-3 pl-4">{body}</div>
        )}

        {/* 控件自身通常就是 button：留在整行 button 里会触发 React 的嵌套告警，
            点一下开关还会连带把行展开。 */}
        {control && <div className="shrink-0">{control}</div>}
      </div>

      {expandable && expanded && <div className="px-4 pb-4 -mt-1">{children}</div>}
    </div>
  );
}
