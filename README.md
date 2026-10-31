# MIMI Music Player (Vibe Player) v0.2.1

> A high-performance audio player and visual workstation built with Next.js 16, React 19, Web Audio API, and Three.js.
> Features hardware-accelerated audio visualizers, an interactive 3D spatial vinyl shelf, 30-band graphic EQ, 17-node DSP effects chain, multi-format stream/local playback, and touchless air gesture control.

[English](README.md) | [简体中文](README_zh.md)

[![Next.js](https://img.shields.io/badge/Next.js-16.2-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.2-blue?style=flat-square&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4_Strict-3178C6?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Three.js](https://img.shields.io/badge/Three.js-0.183-black?style=flat-square&logo=three.js)](https://threejs.org/)
[![Framer Motion](https://img.shields.io/badge/Framer_Motion-12.38-black?style=flat-square&logo=framer)](https://www.framer.com/motion/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4_OKLCH-06B6D4?style=flat-square&logo=tailwindcss)](https://tailwindcss.com/)
[![Zustand](https://img.shields.io/badge/Zustand-5.0-orange?style=flat-square)](https://github.com/pmndrs/zustand)
[![Electron](https://img.shields.io/badge/Electron-41.1-47848F?style=flat-square&logo=electron)](https://www.electronjs.org/)
[![Tests](https://img.shields.io/badge/Vitest-1319%20passed-brightgreen?style=flat-square&logo=vitest)](https://vitest.dev/)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)

---

## Overview

MIMI Music Player is a web and desktop audio workstation engineered around three priorities: **high-fidelity audio processing**, **acoustically accurate visualizers**, and **low-friction fluid interaction**.

Unlike conventional web players that rely on random animations or fixed bottom bars, MIMI couples a singleton Web Audio pipeline directly to WebGL/Canvas shaders and dynamic island UI micro-interactions.

---

## Core Capabilities

### 1. Audio Pipeline & DSP Engine

- **Singleton Audio Architecture**: Global single-instance `AudioContext` with zero-allocation audio frame sharing. Built-in `AudioContextWatchdog` detects system suspension or hardware audio device switches and restores playback in 0ms.
- **30-Band Graphic Equalizer**: Covers 20 Hz to 20 kHz with ±12 dB gain adjustment per band across 30 Biquad filter nodes. Includes studio presets (Vocal, Bass Boost, Rock, Classical, Jazz, Hi-Res Flat).
- **17-Node Creative DSP Chain**:
  - Reverb (master convolution), Tape/Vinyl saturation, Stereo Widener, Chorus, Flanger, Phaser, Tremolo, Auto-Pan, MegaBass, Dynamic Exciter, Compressor, 3D Spatializer, and 8D Circular Surround.
  - Interactive **2D XY Pad** for real-time spatial modulation of room size and stereo width.
- **Gapless & Crossfade Mixer**: Configurable 0–15s track crossfading with logarithmic volume curve blending.
- **AB Loop Controller**: Precise millisecond-level loop point marking for music study and practice.
- **DSD & Hi-Res Decoding**: Native client-side parsing for DSF/DFF (DSD64/128/256), FLAC (24-bit/96kHz+), APE, WAV, OGG, and M4A.

### 2. Audio-Reactive Visual Suite (14+ Engines)

All visualizers run on live FFT analysis (2048-sample FFT, 60 FPS) with zero prerendered video:

| Engine                     | Description                                                                                                                                                                  |
| :------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Anime Handwritten MV**   | AE-style 3D continuous camera dolly with multiplane depth-of-field, warm light sweeps, film grain/vignette, live ink splatter, and lyric-synchronized respiratory animation. |
| **Cinematic Lyric Drift**  | Volumetric font lighting floating through depth planes with subtle subsurface scattering.                                                                                    |
| **Oriental Landscape**     | Layered mountain ranges modulated dynamically by low-frequency energy.                                                                                                       |
| **Cinematic Oriental Ink** | Canvas-based generative watercolor and ink dispersion driven by transient attacks.                                                                                           |
| **Silk Aurora**            | Navier-Stokes fluid velocity fields displaced by multi-band frequency pulses.                                                                                                |
| **Spatial Mesh 3D**        | WebGL 3D dynamic topology mesh with audio-reactive normal vector displacement and Fresnel sheen.                                                                             |
| **Cyberpunk Particles**    | 3,000+ charged point particles with electrostatic spring physics.                                                                                                            |
| **Organic Fluid**          | Mercury liquid sphere physics with real-time audio deformation and specular highlights.                                                                                      |
| **Aurora Wave**            | Multi-layer Gaussian wave interference bands simulating atmospheric aurorae.                                                                                                 |
| **Spectrum Ring**          | Circular radar beam dispersion mapping frequency bins onto radial polar coordinates.                                                                                         |
| **Nebula Field**           | 3D warp-drive starfield with speed scaling driven by bass transients.                                                                                                        |
| **Vinyl Groove**           | Microscopic 3D vinyl record simulation showing grooved track reflection and needle tracking.                                                                                 |
| **Cyber Matrix**           | Digital matrix rain reactive to high-frequency transients.                                                                                                                   |
| **Prism Pulse**            | Optical prism refraction splitting white light beams into chromatic dispersion pulses.                                                                                       |

### 3. Mineradio 3D Spatial Shelf (v0.2 SPATIAL)

- **Dual Viewing Modes**:
  - **Stage Mode**: Circular amphitheater arrangement highlighting the current active record.
  - **Side Mode**: 55° perspective cascade with mechanical gear stepping audio feedback.
- **Liquid Glass Rims**: Double-layered 36px rounded glass-edge illumination replacing sharp polygonal wireframes.
- **Seamless Trackpad/Wheel Scroll**: Native horizontal wheel scrolling (`onWheel` mapping) with hidden system scrollbars (`no-scrollbar`).
- **Tracklist Billboard**: Instant slide-up overlay displaying playlist metadata, duration, track lists, and batch actions.

### 4. Dynamic Island & Multi-Form Floating Player

Progressive disclosure interface adapting to different screen contexts:

```
[Level 1] Minimal Island (Live Equalizer Pill)
   ↓ (Click / Hover)
[Level 2] Island Controls (396px–440px Capsule, Permanent Micro-Lyrics, 0ms Buttons)
   ↓ (Expand)
[Level 3] Floating Card (Waveform/Spectrum Toggle, Halo Themes, Full Controls)
   ↓ (Fullscreen)
[Level 4] Fullscreen Stage (Dual-column Layout, Vinyl Physics, Dynamic Lyric Wall)
```

- **Safe-Zone Geometry**: Pill margins calibrated (`pl-3.5 pr-4.5`) to eliminate semicircular clipping on action buttons.
- **Physics Dragging**: Fluid drag-and-drop with spring physics and auto-docking to viewport boundaries.

### 5. Touchless Air Gesture Control (MediaPipe)

- **3D Hand Tracking**: 21-landmark skeletal hand tracking powered by `@mediapipe/tasks-vision`.
- **Gesture Mappings**:
  - Swipe Left / Right: Previous / Next track
  - Closed Fist: Instant mute & pause
  - Open Palm: Resume playback
  - Vertical Pinch/Drag: Smooth volume & scrub control
- **Zero-Cloud Privacy**: Video frames are processed entirely on-device via WebAssembly/WebGL and discarded immediately. No frames or biometric data ever leave the machine.

### 6. 2D Emotion Matrix & Acoustic Analysis

- **Valence × Energy Mapping**: Two-dimensional acoustic coordinate space mapping mood from melancholic to euphoric, and energy from serene to intense.
- **Box Selection Playback**: Drag-select any region on the coordinate canvas to instantly generate an adaptive mood playlist.
- **AI Liner Notes**: Automated acoustic analysis and contextual commentary generated per track.
- **Auditory Gene Profile**: Tracks aesthetic preferences over time across rhythm, brightness, and harmonic complexity.

### 7. Sources Hub & Library Management

- **Multi-Source Aggregation**: Unified search and playback with automatic stream fallback routing.
- **Local Library Import**: High-throughput file importing using background Web Workers for ID3v1/ID3v2, Vorbis, and FLAC metadata extraction.
- **IndexedDB Engine (`VibeMusicDB` v3)**: Structured binary storage for offline audio caching, stream preservation, and metadata indexing.
- **Smart Playlist Engine**: Declarative rule engine supporting multi-condition queries (e.g. `playCount > 10 AND genre == "Jazz"`).
- **Library Health Diagnostics**: Scans and identifies missing album art, broken audio URLs, and corrupted ID3 tags.

### 8. Lyrics & Social Poster Workshop

- **Bilingual Synchronized Lyrics**: Millisecond-accurate parser for merged Original, Translation, and Transliteration (Pinyin/Romaji) timecodes.
- **Syllable-Level Karaoke**: Smooth color-sweep text filling synchronized with playback clock.
- **Social Poster Workshop**: Generates 2x/3x high-resolution music quote cards (Vinyl, Polaroid, CD Jewel Case, Magazine Editorial) with one-click export.

---

## System Architecture

```text
┌────────────────────────────────────────────────────────────────────────────┐
│                         Presentation Layer (React 19)                      │
│  ┌───────────────┐  ┌──────────────────┐  ┌─────────────────────────────┐  │
│  │ Primary Views │  │ Feature Panels   │  │ Visualizers (V7 Engine)     │  │
│  │ (Home/Player/ │  │ (Queue/Search/   │  │ 14+ Canvas/WebGL Effects    │  │
│  │  Emotion3D)   │  │  Settings/EQ...) │  │ + Handwritten MV + Folia    │  │
│  └───────┬───────┘  └────────┬─────────┘  └──────────────┬──────────────┘  │
│          └───────────────────┼───────────────────────────┘                 │
├──────────────────────────────┴─────────────────────────────────────────────┤
│                     Apple Glass Component Design System                    │
│     GlassPanel | GlassDrawer | GlassModal | GlassCard | GlassSlider        │
│     LiquidGlassFilter | VirtualList | PanelErrorBoundary | LazyPanel       │
├────────────────────────────────────────────────────────────────────────────┤
│                       State Layer (Zustand 60 Stores)                      │
│  • Playback: playerStore, audioStore, queueStore, playbackRuntimeStore     │
│  • Audio/DSP: eqStore, audioEffectsStore, crossfadeStore, dsdProcessing    │
│  • AI/Emotion: emotionStore, aiStore, useAIAgentStore, linerNotesStore     │
│  • Library/Data: libraryManagerStore, playlistStore, backupRestoreStore    │
│  • UI/Shell: uiStore, visualSettingsStore, gestureSettingsStore            │
├────────────────────────────────────────────────────────────────────────────┤
│                       Logic, Services & Worker Layer                       │
│  ┌───────────────────┐  ┌───────────────────┐  ┌────────────────────────┐  │
│  │ Custom Hooks (19) │  │ Domain Services   │  │ Dedicated Web Workers  │  │
│  │ • useAudioPlayer  │  │ • MultiResolver   │  │ • conversion.worker.ts │  │
│  │ • useLyric        │  │ • BeatMapAnalyzer │  │ • dsd.worker.ts        │  │
│  │ • useGesture      │  │ • WorkerPool      │  │ • waveform.worker.ts   │  │
│  └───────────────────┘  └───────────────────┘  └────────────────────────┘  │
├────────────────────────────────────────────────────────────────────────────┤
│                       Core Audio Engine (Singleton)                        │
│   HTML5 Audio / Decoded Buffer → AudioContext Singleton                    │
│   → 30-Band EQ → 17 Effects Manager → Crossfade Mixer → Master Gain        │
│   → AnalyserNode (Fast Fourier Transform 2048-sample) → Destination        │
├────────────────────────────────────────────────────────────────────────────┤
│                       Infrastructure & Cross-Platform                      │
│   Next.js 16 (App Router) │ Electron 41 │ IndexedDB (VibeMusicDB)          │
│   LocalStorage │ Web Audio API │ WebRTC (MediaPipe) │ FastAPI Python Backend│
└────────────────────────────────────────────────────────────────────────────┘
```

---

## Keyboard Shortcuts

| Key                                         | Action                                        |
| :------------------------------------------ | :-------------------------------------------- |
| <kbd>Space</kbd>                            | Play / Pause                                  |
| <kbd>→</kbd> / <kbd>←</kbd>                 | Seek forward 5s / Seek backward 5s            |
| <kbd>↑</kbd> / <kbd>↓</kbd>                 | Volume +5% / Volume -5%                       |
| <kbd>Shift</kbd> + <kbd>→</kbd>             | Next track                                    |
| <kbd>Shift</kbd> + <kbd>←</kbd>             | Previous track                                |
| <kbd>M</kbd>                                | Toggle 3D Shelf Mode (Stage ↔ Side)           |
| <kbd>Q</kbd> or <kbd>⌘</kbd> + <kbd>L</kbd> | Toggle 3D Spatial Shelf Drawer                |
| <kbd>F</kbd>                                | Toggle Fullscreen Player                      |
| <kbd>V</kbd>                                | Enter / Exit Visualizer Theater               |
| <kbd>E</kbd>                                | Open 2D Emotion Matrix                        |
| <kbd>L</kbd>                                | Toggle Lyrics Floating Panel                  |
| <kbd>S</kbd>                                | Open Search Modal                             |
| <kbd>Esc</kbd>                              | Close active drawer, modal, or return to Home |

---

## Getting Started

### Prerequisites

- **Node.js**: `>= 20.11.0` (Node 20 LTS or Node 22 recommended)
- **npm**: `>= 10.0.0`
- **Python** _(Optional)_: `>= 3.10` (Only needed for local ModelScope acoustic feature extraction backend)

### 1. Clone Repository

```bash
git clone https://github.com/NanQiaoMi/music_source_code.git
cd music_source_code
```

### 2. Install Dependencies

```bash
npm install --legacy-peer-deps
```

### 3. Configure Environment _(Optional)_

```bash
cp .env.example .env.local
```

Fill in your optional LLM provider keys if you plan to use AI liner notes. Core playback and visualizers work without any keys.

### 4. Run Development Server

```bash
# Starts Next.js development server on http://localhost:3025
npm run dev
```

To run both frontend and the local Python FastAPI backend concurrently:

```bash
npm run dev:full
```

---

## Desktop Packaging

MIMI Music Player packages into native desktop applications via Electron:

```powershell
# Windows (PowerShell) - Builds portable EXE and NSIS installer
./scripts/build-desktop-win.ps1 -Clean
```

Or via standard npm scripts:

```bash
# Windows
npm run build:electron:win

# macOS
npm run build:electron:mac

# Linux
npm run build:electron:linux
```

Outputs are generated in `dist-electron/`.

---

## Code Quality & Verification

Every pull request and build must strictly pass the following zero-regression gates:

- **Strict TypeScript**: `tsconfig.json` strictly enforces `strict: true` and `ignoreBuildErrors: false`.
- **ESLint Clean**: Verified at `0 errors / 0 warnings` across all source files.
- **Automated Test Matrix**: 206 test suites, **1,319 unit tests passing** (Vitest + jsdom).

```bash
# Run unit tests
npm run test -- --run

# Run code linter
npm run lint

# Run TypeScript type check
npx tsc --noEmit --incremental false
```

---

## Contributing

Contributions, issues, and feature requests are welcome:

1. Fork the repository.
2. Create your feature branch (`git checkout -b feature/amazing-feature`).
3. Maintain zero ESLint warnings and ensure all tests pass (`npm run test -- --run`).
4. Commit your changes with standard conventional commit messages (`feat: ...`, `fix: ...`).
5. Push to the branch (`git push origin feature/amazing-feature`).
6. Open a Pull Request.

---

## License

This project is licensed under the [MIT License](LICENSE).

---

<div align="center">

**MIMI Music Player (Vibe Player)**  
_Developed with precision by 大咪小咪组_

</div>
