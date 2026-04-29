"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useUIStore, ToastMessage } from "@/store/uiStore";
import { CheckCircle, XCircle, Info, AlertTriangle, X } from "lucide-react";

const ToastIcon: React.FC<{ type: ToastMessage["type"] }> = ({ type }) => {
  const iconClass = "w-5 h-5";

  switch (type) {
    case "success":
      return <CheckCircle className={`${iconClass} text-green-400`} />;
    case "error":
      return <XCircle className={`${iconClass} text-red-400`} />;
    case "warning":
      return <AlertTriangle className={`${iconClass} text-yellow-400`} />;
    case "info":
    default:
      return <Info className={`${iconClass} text-blue-400`} />;
  }
};

const ToastItem: React.FC<{ toast: ToastMessage }> = ({ toast }) => {
  const removeToast = useUIStore((state) => state.removeToast);

  return (
    <motion.div
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.95 }}
      transition={{ type: "spring", damping: 25, stiffness: 300 }}
      className="relative flex items-center gap-3 px-4 py-3 bg-white/10 backdrop-blur-2xl rounded-2xl border border-white/20 shadow-xl pointer-events-auto"
      style={{
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
      }}
    >
      <ToastIcon type={toast.type} />

      <span className="text-white font-medium flex-1">{toast.message}</span>

      <button
        onClick={() => removeToast(toast.id)}
        className="w-6 h-6 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/60 hover:text-white transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </motion.div>
  );
};

export const GlassToastContainer: React.FC = () => {
  const toasts = useUIStore((state) => state.toasts);

  return (
    <div className="fixed top-4 right-4 z-[9999] space-y-2 pointer-events-none">
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
