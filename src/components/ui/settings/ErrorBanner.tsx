import React from "react";

export interface ErrorBannerProps {
  /** 面向用户的失败原因。 */
  message: string;
  /** 「重试」回调。缺省时不渲染重试按钮。 */
  onRetry?: () => void;
  /** 额外动作按钮（如音源矩阵页的「恢复默认」），渲染在重试按钮之后。 */
  children?: React.ReactNode;
}

/**
 * 音源管理各 Tab 共用的「非阻断」错误横幅。
 *
 * 刻意不做成整块错误页：上游同步失败时，本地 store 里已有的音源/脚本/缓存数据
 * 仍然可用，横幅只挂在正常内容之上补充提示，不替换内容。
 */
export function ErrorBanner({ message, onRetry, children }: ErrorBannerProps) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-500/25 bg-rose-500/[0.06] px-4 py-2.5">
      <span className="text-[12.5px] text-rose-200">{message}</span>
      <div className="flex gap-2 shrink-0">
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="h-7 px-3 rounded-full bg-white/10 hover:bg-white/20 text-[12px] text-white transition-colors"
          >
            重试
          </button>
        )}
        {children}
      </div>
    </div>
  );
}
