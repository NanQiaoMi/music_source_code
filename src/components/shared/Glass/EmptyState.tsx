"use client";

import React from "react";
import { motion } from "framer-motion";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className = "",
}: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex flex-col items-center justify-center py-16 px-6 text-center ${className}`}
    >
      {icon && (
        <div className="text-white/20 mb-4">
          {icon}
        </div>
      )}
      <h3 className="text-white/60 text-base font-medium mb-1">{title}</h3>
      {description && (
        <p className="text-white/30 text-sm max-w-xs">{description}</p>
      )}
      {action && (
        <div className="mt-5">{action}</div>
      )}
    </motion.div>
  );
}