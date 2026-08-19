"use client";

import React from "react";

export const MINERADIO_DISPERSION_FILTER_ID = "mineradio-liquid-glass-filter";

/**
 * 8-layer multi-step mimetic physical inner glow and outer diffusion shadows (Ultra-Transparent Crystal Liquid Glass):
 * 1. Top edge specular rim highlight (极细顶边超亮高光切线)
 * 2. Internal caustic refractive glow (内壁高亮焦散泛光)
 * 3. Bottom ambient bounce reflection (底部环境光透亮反弹边缘)
 * 4. Deep inner volumetric occlusion (轻透内凹深度遮蔽)
 * 5. Contact base shadow (极轻近场接触基底阴影)
 * 6. Near-field atmospheric dispersion (柔和近场微弥散)
 * 7. Mid-field volumetric drop (中场透光体积投影)
 * 8. Far-field ambient dark halo (远场环境柔和扩散晕)
 */
export const MINERADIO_LIQUID_GLASS_SHADOW_LAYERS = [
  "inset 0 1.5px 2px 0 rgba(255, 255, 255, 0.65)",
  "inset 0 0 24px 2px rgba(255, 255, 255, 0.14)",
  "inset 0 -1.5px 2px 0 rgba(255, 255, 255, 0.20)",
  "inset 0 12px 28px -10px rgba(0, 0, 0, 0.18)",
  "0 2px 4px 0 rgba(0, 0, 0, 0.12)",
  "0 10px 20px -2px rgba(0, 0, 0, 0.18)",
  "0 24px 48px -6px rgba(0, 0, 0, 0.25)",
  "0 40px 80px -12px rgba(0, 0, 0, 0.35)",
];

export const MINERADIO_LIQUID_GLASS_SHADOW = MINERADIO_LIQUID_GLASS_SHADOW_LAYERS.join(", ");

export const MINERADIO_LIQUID_GLASS_CLASS = "mineradio-liquid-glass";

export const MINERADIO_LIQUID_GLASS_STYLE: React.CSSProperties = {
  background: "linear-gradient(135deg, rgba(255, 255, 255, 0.14) 0%, rgba(255, 255, 255, 0.05) 40%, rgba(20, 20, 30, 0.22) 100%)",
  backdropFilter: "blur(48px) saturate(200%)",
  WebkitBackdropFilter: "blur(48px) saturate(200%)",
  border: "1px solid rgba(255, 255, 255, 0.28)",
  boxShadow: MINERADIO_LIQUID_GLASS_SHADOW,
};

export interface LiquidGlassFilterProps {
  /** SVG Filter DOM ID */
  filterId?: string;
  /** Red channel dispersion displacement scale (default: 180) */
  redScale?: number;
  /** Green channel dispersion displacement scale (default: 170) */
  greenScale?: number;
  /** Blue channel dispersion displacement scale (default: 160) */
  blueScale?: number;
  /** Dispersion center coordinate offset (default: -90) */
  centerOffset?: number;
  /** Procedural turbulence frequency (default: 0.015) */
  turbulenceFrequency?: number;
  /** Procedural turbulence octaves (default: 3) */
  turbulenceOctaves?: number;
  /** Random noise seed (default: 42) */
  seed?: number;
  /** Whether to inject the self-contained CSS styles */
  includeStyles?: boolean;
  /** Optional custom class name */
  className?: string;
}

export const LiquidGlassFilter: React.FC<LiquidGlassFilterProps> = ({
  filterId = MINERADIO_DISPERSION_FILTER_ID,
  redScale = 180,
  greenScale = 170,
  blueScale = 160,
  centerOffset = -90,
  turbulenceFrequency = 0.015,
  turbulenceOctaves = 3,
  seed = 42,
  includeStyles = true,
  className = "",
}) => {
  const centerDelta = centerOffset / 30;

  return (
    <>
      {includeStyles && (
        <style
          dangerouslySetInnerHTML={{
            __html: `
              .${MINERADIO_LIQUID_GLASS_CLASS} {
                background: linear-gradient(135deg, rgba(255, 255, 255, 0.14) 0%, rgba(255, 255, 255, 0.05) 40%, rgba(20, 20, 30, 0.22) 100%) !important;
                backdrop-filter: blur(48px) saturate(200%) !important;
                -webkit-backdrop-filter: blur(48px) saturate(200%) !important;
                border: 1px solid rgba(255, 255, 255, 0.28) !important;
                box-shadow: ${MINERADIO_LIQUID_GLASS_SHADOW} !important;
              }
              .mineradio-glass-specular-glint {
                position: absolute;
                top: 0;
                left: 8%;
                right: 8%;
                height: 1px;
                background: linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.75) 50%, transparent 100%);
                pointer-events: none;
              }
            `,
          }}
        />
      )}

      {/* Off-screen SVG Displacement Map with 3-channel physical chromatic dispersion */}
      <svg
        id={`svg-${filterId}`}
        aria-hidden="true"
        className={`pointer-events-none absolute h-0 w-0 overflow-hidden opacity-0 ${className}`}
        style={{ position: "absolute", width: 0, height: 0 }}
      >
        <defs>
          <filter
            id={filterId}
            x="-20%"
            y="-20%"
            width="140%"
            height="140%"
            filterUnits="userSpaceOnUse"
            colorInterpolationFilters="sRGB"
          >
            {/* Procedural multi-frequency caustic noise map */}
            <feTurbulence
              type="fractalNoise"
              baseFrequency={turbulenceFrequency}
              numOctaves={turbulenceOctaves}
              seed={seed}
              result="noiseMap"
            />

            {/* Specular lighting map for realistic liquid surface tension */}
            <feSpecularLighting
              in="noiseMap"
              surfaceScale="2"
              specularConstant="1.2"
              specularExponent="20"
              lightingColor="#ffffff"
              result="specularRefraction"
            >
              <fePointLight x="150" y="80" z="220" />
            </feSpecularLighting>

            {/* Composite procedural map with specular lighting */}
            <feComposite
              in="noiseMap"
              in2="specularRefraction"
              operator="arithmetic"
              k1="0"
              k2="1"
              k3="0.4"
              k4="0"
              result="causticMap"
            />

            {/* --- Channel R (Red Wavefront Dispersion) --- */}
            <feDisplacementMap
              in="SourceGraphic"
              in2="causticMap"
              scale={redScale}
              xChannelSelector="R"
              yChannelSelector="B"
              result="dispRed"
            />
            <feOffset
              in="dispRed"
              dx={centerDelta * 1.0}
              dy="0"
              result="dispRedShifted"
            />
            <feMerge result="dispRedAligned">
              <feMergeNode in="SourceGraphic" />
              <feMergeNode in="dispRedShifted" />
            </feMerge>
            <feColorMatrix
              in="dispRedAligned"
              type="matrix"
              values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0"
              result="redPass"
            />

            {/* --- Channel G (Green Wavefront Dispersion) --- */}
            <feDisplacementMap
              in="SourceGraphic"
              in2="causticMap"
              scale={greenScale}
              xChannelSelector="R"
              yChannelSelector="B"
              result="dispGreen"
            />
            <feOffset
              in="dispGreen"
              dx={centerDelta * 0.5}
              dy="0"
              result="dispGreenShifted"
            />
            <feMerge result="dispGreenAligned">
              <feMergeNode in="SourceGraphic" />
              <feMergeNode in="dispGreenShifted" />
            </feMerge>
            <feColorMatrix
              in="dispGreenAligned"
              type="matrix"
              values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0"
              result="greenPass"
            />

            {/* --- Channel B (Blue Wavefront Dispersion) --- */}
            <feDisplacementMap
              in="SourceGraphic"
              in2="causticMap"
              scale={blueScale}
              xChannelSelector="R"
              yChannelSelector="B"
              result="dispBlue"
            />
            <feOffset
              in="dispBlue"
              dx="0"
              dy="0"
              result="dispBlueShifted"
            />
            <feMerge result="dispBlueAligned">
              <feMergeNode in="SourceGraphic" />
              <feMergeNode in="dispBlueShifted" />
            </feMerge>
            <feColorMatrix
              in="dispBlueAligned"
              type="matrix"
              values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0"
              result="bluePass"
            />

            {/* Composite the 3 dispersed channels via additive screen blend */}
            <feBlend in="redPass" in2="greenPass" mode="screen" result="rgBlend" />
            <feBlend in="rgBlend" in2="bluePass" mode="screen" result="chromaticDispersion" />

            {/* Final smooth subtle Gaussian anti-aliasing */}
            <feGaussianBlur in="chromaticDispersion" stdDeviation="0.4" result="finalLiquidOutput" />
          </filter>
        </defs>
      </svg>
    </>
  );
};

export default LiquidGlassFilter;
