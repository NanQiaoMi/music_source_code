import React from "react";

export interface SettingSectionProps {
  /** 分组标题，小字号 + 大字距，对应 Apple 系统设置的组头 */
  title?: string;
  description?: string;
  /** 组头右侧动作（如「全部测速」） */
  action?: React.ReactNode;
  children: React.ReactNode;
}

export function SettingSection({ title, description, action, children }: SettingSectionProps) {
  const hasHeader = Boolean(title || description || action);
  return (
    <section className="mb-7 last:mb-0">
      {hasHeader && (
        <div className="flex items-end justify-between gap-3 px-1 mb-2">
          <div className="min-w-0">
            {title && (
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">
                {title}
              </h3>
            )}
            {description && (
              <p className="mt-1 text-[12px] leading-relaxed text-white/35">{description}</p>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      <div className="rounded-2xl bg-white/[0.04] border border-white/[0.07] overflow-hidden">
        {children}
      </div>
    </section>
  );
}
