"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import { X, RefreshCw, AlertTriangle } from "lucide-react";

interface Props {
  children: ReactNode;
  panelName?: string;
  onClose?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * PanelErrorBoundary - Isolates each panel so a crash in one
 * doesn't bring down the entire application.
 * 
 * Shows a friendly fallback UI with a retry button instead of
 * crashing the whole page.
 */
export class PanelErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(
      `[PanelErrorBoundary] ${this.props.panelName || "Unknown"} crashed:`,
      error,
      errorInfo
    );
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  handleClose = () => {
    this.setState({ hasError: false, error: null });
    this.props.onClose?.();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-8 bg-black/60 backdrop-blur-md">
          <div className="relative w-full max-w-md bg-[#1a1a2e]/90 backdrop-blur-xl rounded-3xl border border-white/10 shadow-2xl p-8 text-center">
            {/* Close button */}
            <button
              onClick={this.handleClose}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/40 hover:text-white transition-all"
            >
              <X size={16} />
            </button>

            {/* Error icon */}
            <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
              <AlertTriangle size={32} className="text-red-400" />
            </div>

            {/* Title */}
            <h3 className="text-white font-bold text-lg mb-2">
              模块加载异常
            </h3>

            {/* Panel name */}
            {this.props.panelName && (
              <p className="text-white/30 text-xs uppercase tracking-widest mb-4 font-mono">
                {this.props.panelName}
              </p>
            )}

            {/* Error message */}
            <p className="text-white/50 text-sm mb-6 leading-relaxed">
              此功能模块发生了意外错误，但不会影响其他功能的正常使用。
            </p>

            {/* Error detail (collapsed) */}
            <details className="mb-6 text-left">
              <summary className="text-white/30 text-xs cursor-pointer hover:text-white/50 transition-colors">
                查看错误详情
              </summary>
              <pre className="mt-2 p-3 bg-black/40 rounded-xl text-red-400/70 text-[10px] font-mono overflow-auto max-h-32 border border-white/5">
                {this.state.error?.message || "Unknown error"}
              </pre>
            </details>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={this.handleClose}
                className="flex-1 py-3 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 text-sm font-medium transition-all border border-white/5"
              >
                关闭面板
              </button>
              <button
                onClick={this.handleRetry}
                className="flex-1 py-3 px-4 rounded-xl bg-white text-black text-sm font-bold flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                <RefreshCw size={14} />
                重新加载
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
