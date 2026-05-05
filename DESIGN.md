# Design System: mimimusic

## Core Aesthetic: Premium Glassmorphism
The design language is centered around transparency, depth, and material honesty. It uses high-saturation accents against deep, neutral backgrounds.

## Color Strategy: Full Palette
Vibe utilizes a sophisticated range of semantic colors for its audio visualizations, ensuring high contrast and clarity.

### Color Tokens (OKLCH)
- **Background (Primary)**: `oklch(0% 0.005 240)` - Deep Carbon
- **Background (Secondary)**: `oklch(15% 0.01 240)` - Elevated Surface
- **Text (Primary)**: `oklch(100% 0.005 240)` - Pure Signal
- **Accent (Purple)**: `oklch(60% 0.25 300)` - Aurora Primary
- **Accent (Pink)**: `oklch(65% 0.25 0)` - Neon Pulse
- **Accent (Cyan)**: `oklch(75% 0.2 200)` - Cyber Trace

## Typography
- **Primary Interface**: San Francisco (SF Pro Display / Text)
- **Data Visualization**: JetBrains Mono (for HUDs, coordinates, and technical data)
- **Hierarchy**:
  - H1: `2.5rem`, Bold, Tight tracking
  - Body: `0.875rem`, Regular, 1.5 line height
  - Data: `0.625rem`, Bold, Monospaced

## Motion
- **Inertia**: Camera movements should have high inertia (smooth ease-in-out-expo).
- **Pulse**: Visualizations should pulse with exponential decay.
- **Glitch**: Sharp, rapid offsets (≤50ms) for high-energy peaks.

## Components
- **Glass Card**: `backdrop-blur(20px) saturate(180%)`, thin border `rgba(255,255,255,0.1)`.
- **HUD Brackets**: Precision 0.5pt lines for technical framing.
- **Neural Tendrils**: Smooth Bezier paths with traveling data packets.
