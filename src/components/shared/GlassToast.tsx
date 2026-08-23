"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useUIStore, ToastMessage } from "@/store/uiStore";
import { CheckCircle, XCircle, Info, AlertTriangle, X } from "lucide-react";

const ToastIcon: React.FC<{ type: ToastMessage["type"] }> = ({ type }) => {
  const iconClass = "w-4 h-4 shrink-0";

  switch (type) {
    case "success":
      return <CheckCircle className={`${iconClass} text-emerald-400`} />;
    case "error":
      return <XCircle className={`${iconClass} text-rose-400`} />;
    case "warning":
      return <AlertTriangle className={`${iconClass} text-amber-400`} />;
    case "info":
    default:
      return <Info className={`${iconClass} text-cyan-400`} />;
  }
};

const ToastItem: React.FC<{ toast: ToastMessage }> = ({ toast }) => {
  const removeToast = useUIStore((state) => state.removeToast);

  const borderColors: Record<ToastMessage["type"], string> = {
    success: "border-emerald-500/40 shadow-emerald-500/15",
    error: "border-rose-500/40 shadow-rose-500/15",
    warning: "border-amber-500/40 shadow-amber-500/15",
    info: "border-cyan-500/40 shadow-cyan-500/15",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -16, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -16, scale: 0.95 }}
      transition={{ type: "spring", damping: 25, stiffness: 350 }}
      className={`relative flex items-center gap-3 px-4 py-3 bg-[#0c0f1d]/90 backdrop-blur-2xl rounded-2xl border shadow-2xl pointer-events-auto select-none ${
        borderColors[toast.type] || "border-white/20"
      }`}
    >
      <ToastIcon type={toast.type} />

      <span className="text-white text-xs font-medium tracking-wide flex-1 max-w-sm">
        {toast.message}
      </span>

      <button
        type="button"
        onClick={() => removeToast(toast.id)}
        className="w-5 h-5 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/60 hover:text-white transition-colors cursor-pointer shrink-0"
      >
        <X className="w-3 h-3" />
      </button>
    </motion.div>
  );
};

export const GlassToastContainer: React.FC = () => {
  const toasts = useUIStore((state) => state.toasts);

  return (
    <div className="fixed top-6 right-6 z-[999999] space-y-2 pointer-events-none flex flex-col items-end">
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} />
        ))}
      </AnimatePresence>
    </div>
  );
};

// 单独调用的 Toast 函数
export const toast = {
  success: (message: string, duration?: number) => {
    useUIStore.getState().showToast(message, "success", duration);
  },
  error: (message: string, duration?: number) => {
    useUIStore.getState().showToast(message, "error", duration);
  },
  info: (message: string, duration?: number) => {
    useUIStore.getState().showToast(message, "info", duration);
  },
  warning: (message: string, duration?: number) => {
    useUIStore.getState().showToast(message, "warning", duration);
  },
};

// Hook 版本的 Toast
export const useGlassToast = () => {
  const showToast = useUIStore((state) => state.showToast);
  return {
    showToast: (
      message: string,
      type: "success" | "error" | "warning" | "info" = "info",
      duration?: number
    ) => {
      showToast(message, type, duration);
    },
  };
};
