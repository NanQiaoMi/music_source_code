"use client";

import React from "react";
import { ChevronDown } from "lucide-react";

interface GlassSelectOption {
  value: string;
  label: string;
}

interface GlassSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: GlassSelectOption[];
  label?: string;
  className?: string;
  disabled?: boolean;
}

export function GlassSelect({
  value,
  onChange,
  options,
  label,
  className = "",
  disabled = false,
}: GlassSelectProps) {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-white/60 text-xs font-medium mb-1.5 px-1">
          {label}
        </label>
      )}
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={`
            w-full appearance-none
            bg-white/[0.06] border border-white/[0.10]
            backdrop-blur-[20px] saturate-[180%]
            rounded-xl px-4 py-2.5 pr-10
            text-white text-sm
            outline-none
            transition-all duration-200
            focus:border-white/[0.25] focus:bg-white/[0.10]
            disabled:opacity-40 disabled:cursor-not-allowed
            ${className}
          `}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} className="bg-gray-900 text-white">
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none" />
      </div>
    </div>
  );
}