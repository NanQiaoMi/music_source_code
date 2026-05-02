// Design tokens — aligned with DESIGN.md OKLCH color system
// All components MUST import colors from here. Never hardcode hex.

export const color = {
  bg: {
    deep:     "oklch(0% 0.005 240)",
    elevated: "oklch(15% 0.01 240)",
    surface:  "oklch(20% 0.015 240)",
    hover:    "oklch(25% 0.02 240)",
  },
  text: {
    primary:   "oklch(100% 0.005 240)",
    secondary: "oklch(70% 0.01 240)",
    tertiary:  "oklch(50% 0.01 240)",
    disabled:  "oklch(35% 0.01 240)",
  },
  accent: {
    purple: "oklch(60% 0.25 300)",
    pink:   "oklch(65% 0.25 0)",
    cyan:   "oklch(75% 0.2 200)",
  },
  semantic: {
    success: "oklch(65% 0.2 145)",
    warning: "oklch(75% 0.2 85)",
    error:   "oklch(60% 0.25 25)",
    info:    "oklch(65% 0.15 250)",
  },
} as const;

// Glass parameters — aligned with DESIGN.md Glass Card spec
// backdrop-blur(20px) saturate(180%), thin border rgba(255,255,255,0.1)
export const glass = {
  panel: {
    blur:     "backdrop-blur-[20px]",
    saturate: "saturate-[180%]",
    bg:       "bg-white/[0.06]",
    border:   "border border-white/[0.10]",
    radius:   "rounded-2xl",
  },
  overlay: {
    blur:     "backdrop-blur-[32px]",
    saturate: "saturate-[200%]",
    bg:       "bg-black/60",
    border:   "border border-white/[0.08]",
    radius:   "rounded-2xl",
  },
  button: {
    bg:      "bg-white/[0.08]",
    bgHover: "hover:bg-white/[0.12]",
    border:  "border border-white/[0.06]",
    radius:  "rounded-xl",
  },
} as const;

// Typography — aligned with DESIGN.md hierarchy
export const typography = {
  h1:      "text-[2.5rem] font-bold tracking-tight",
  h2:      "text-xl font-semibold",
  h3:      "text-base font-medium",
  body:    "text-sm leading-relaxed",
  caption: "text-xs text-white/60",
  data:    "text-[10px] font-mono font-bold",
} as const;

export const spacing = {
  panel:   "p-6",
  section: "space-y-4",
  item:    "space-y-2",
  compact: "p-3",
} as const;

// Motion — aligned with DESIGN.md (Inertia: ease-in-out-expo)
export const motion = {
  transition: {
    default: { duration: 0.3, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
    fast:    { duration: 0.15, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
    slow:    { duration: 0.6, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
    spring:  { type: "spring" as const, damping: 25, stiffness: 200 },
  },
} as const;
