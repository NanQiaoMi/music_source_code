"use client";

import React, { useCallback, useMemo } from "react";

export const ControlGroup = ({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ComponentType<any>;
  children: React.ReactNode;
}) => (
  <div className="space-y-4">
    <div className="flex items-center gap-2 text-white/70 text-sm font-medium border-b border-white/5 pb-2">
      <Icon className="w-4 h-4" />
      {title}
    </div>
    <div className="space-y-4">{children}</div>
  </div>
);

export const GlassSlider = React.memo(
  ({
    value,
    min,
    max,
    step,
    onChange,
    label,
    icon: Icon,
  }: {
    value: number;
    min: number;
    max: number;
    step: number;
    onChange: (val: number) => void;
    label?: string;
    icon?: React.ComponentType<any>;
  }) => {
    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => onChange(parseFloat(e.target.value)),
      [onChange]
    );
    const progress = useMemo(() => {
      if (value == null || min == null || max == null || max === min) return 0;
      return ((value - min) / (max - min)) * 100;
    }, [value, min, max]);

    return (
      <div className="space-y-2">
        {label && (
          <div className="flex items-center justify-between text-xs text-white/50">
            <span>{label}</span>
            <span className="font-mono">{value != null ? value.toFixed(2) : "0.00"}</span>
          </div>
        )}
        <div className="flex items-center gap-3">
          {Icon && <Icon className="w-4 h-4 text-white/40" />}
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={value != null ? value : min}
            onChange={handleChange}
            className="flex-1 h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, rgba(255,255,255,0.5) ${progress}%, rgba(255,255,255,0.1) ${progress}%)`,
            }}
          />
        </div>
      </div>
    );
  }
);
