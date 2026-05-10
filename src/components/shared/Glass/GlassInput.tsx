"use client";

import React from "react";

interface GlassInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  className?: string;
  type?: "text" | "search" | "password" | "number";
  disabled?: boolean;
}

export function GlassInput({
  value,
  onChange,
  placeholder = "",
  label,
  className = "",
  type = "text",
  disabled = false,
}: GlassInputProps) {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-white/60 text-xs font-medium mb-1.5 px-1">{label}</label>
      )}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={`
          w-full
          bg-white/[0.06] border border-white/[0.10]
          backdrop-blur-[20px] saturate-[180%]
          rounded-xl px-4 py-2.5
          text-white text-sm
          placeholder:text-white/30
          outline-none
          transition-all duration-200
          focus:border-white/[0.25] focus:bg-white/[0.10]
          disabled:opacity-40 disabled:cursor-not-allowed
          ${className}
        `}
      />
    </div>
  );
}
