"use client";

import React from "react";

interface LoadingSkeletonProps {
  className?: string;
  count?: number;
  variant?: "card" | "line" | "circle" | "text-block";
}

export function LoadingSkeleton({
  className = "",
  count = 1,
  variant = "line",
}: LoadingSkeletonProps) {
  const items = Array.from({ length: count }, (_, i) => i);

  const variantStyles = {
    card: "h-24 rounded-2xl",
    line: "h-4 rounded-full",
    circle: "h-10 w-10 rounded-full",
    "text-block": "h-20 rounded-xl",
  };

  return (
    <div className={`space-y-3 ${className}`} role="status" aria-label="加载中">
      {items.map((i) => (
        <div
          key={i}
          className={`
            bg-white/[0.06] relative overflow-hidden
            ${variantStyles[variant]}
          `}
        >
          <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
        </div>
      ))}
    </div>
  );
}