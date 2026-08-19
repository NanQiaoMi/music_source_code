"use client";

import React from "react";

export const MINERADIO_DISPERSION_FILTER_ID = "mineradio-liquid-glass-filter";

/**
 * 8-layer multi-step mimetic physical inner glow and outer diffusion shadows:
 * 1. Top edge specular rim highlight (极细顶边高光切线)
 * 2. Internal caustic refractive glow (内壁焦散泛光)
 * 3. Bottom ambient bounce reflection (底部环境光反弹边缘)
 * 4. Deep inner volumetric occlusion (内凹深度遮蔽阴影)
 * 5. Contact base shadow (近场接触基底阴影)
 * 6. Near-field atmospheric dispersion (近场柔和弥散阴影)
 * 7. Mid-field volumetric drop (中场深层体积投影)
 * 8. Far-field ambient dark halo (远场超大空间沉浸扩散底光)
 */
export const MINERADIO_LIQUID_GLASS_SHADOW_LAYERS = [
  "inset 0 1.5px 2px 0 rgba(255, 255, 255, 0.45)",
  "inset 0 0 24px 2px rgba(255, 255, 255, 0.08)",
  "inset 0 -1.5px 2px 0 rgba(255, 255, 255, 0.12)",
  "inset 0 12px 28px -10px rgba(0, 0, 0, 0.5)",
  "0 2px 4px 0 rgba(0, 0, 0, 0.35)",
  "0 10px 20px -2px rgba(0, 0, 0, 0.45)",
  "0 24px 48px -6px rgba(0, 0, 0, 0.65)",
  "0 40px 80px -12px rgba(0, 0, 0, 0.75)",
];

export const MINERADIO_LIQUID_GLASS_SHADOW = MINERADIO_LIQUID_GLASS_SHADOW_LAYERS.join(", ");

export const MINERADIO_LIQUID_GLASS_CLASS = "mineradio-liquid-glass";

export const MINERADIO_LIQUID_GLASS_STYLE: React.CSSProperties = {
  background: "rgba(10, 10, 15, 0.82)",
  backdropFilter: "blur(48px) saturate(190%)",
  WebkitBackdropFilter: "blur(48px) saturate(190%)",
  border: "1px solid rgba(255, 255, 255, 0.18)",
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
                background: rgba(10, 10, 15, 0.82);
                backdrop-filter: blur(48px) saturate(190%);
                -webkit-backdrop-filter: blur(48px) saturate(190%);
                border: 1px solid rgba(255, 255, 255, 0.18);
                box-shadow: ${MINERADIO_LIQUID_GLASS_SHADOW};
              }
              .mineradio-glass-specular-glint {
                position: absolute;
                top: 0;
                left: 10%;
                right: 10%;
                height: 1px;
                background: linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.45) 50%, transparent 100%);
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
            {/* 1. Procedural liquid turbulence noise */}
            <feTurbulence
              type="fractalNoise"
              baseFrequency={`${turbulenceFrequency} ${turbulenceFrequency}`}
              numOctaves={turbulenceOctaves}
              seed={seed}
              result="liquidNoise"
            />

            {/* 2. Non-linear displacement curve */}
            <feComponentTransfer in="liquidNoise" result="dispMap">
              <feFuncR type="gamma" amplitude={1} exponent={1.5} offset={0} />
              <feFuncG type="gamma" amplitude={1} exponent={1.5} offset={0} />
              <feFuncB type="gamma" amplitude={1} exponent={1.5} offset={0} />
            </feComponentTransfer>

            {/* 3. Red Channel Physical Chromatic Dispersion (Scale: 180) */}
            <feDisplacementMap
              in="SourceGraphic"
              in2="dispMap"
              scale={redScale}
              xChannelSelector="R"
              yChannelSelector="G"
              result="dispRed"
            />
            <feColorMatrix
              in="dispRed"
              type="matrix"
              values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0"
              result="redOnly"
            />

            {/* 4. Green Channel Physical Chromatic Dispersion (Scale: 170) */}
            <feDisplacementMap
              in="SourceGraphic"
              in2="dispMap"
              scale={greenScale}
              xChannelSelector="R"
              yChannelSelector="G"
              result="dispGreen"
            />
            <feColorMatrix
              in="dispGreen"
              type="matrix"
              values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0"
              result="greenOnly"
            />

            {/* 5. Blue Channel Physical Chromatic Dispersion (Scale: 160) */}
            <feDisplacementMap
              in="SourceGraphic"
              in2="dispMap"
              scale={blueScale}
              xChannelSelector="R"
              yChannelSelector="G"
              result="dispBlue"
            />
            <feColorMatrix
              in="dispBlue"
              type="matrix"
              values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0"
              result="blueOnly"
            />

            {/* 6. Dispersion Center Offset (-90) */}
            <feOffset in="SourceGraphic" dx={centerDelta} dy={centerDelta} result="centerCore" />

            {/* 7. Chromatic Recombination & Optical Dispersion Blending */}
            <feBlend mode="screen" in="redOnly" in2="greenOnly" result="blendRG" />
            <feBlend mode="screen" in="blendRG" in2="blueOnly" result="chromaticDispersion" />

            {/* 8. Specular Liquid Surface Glint */}
            <feGaussianBlur in="dispMap" stdDeviation="1.5" result="smoothDisplacement" />
            <feSpecularLighting
              in="smoothDisplacement"
              surfaceScale={2}
              specularConstant={1.2}
              specularExponent={28}
              lightingColor="#ffffff"
              result="specularGlint"
            >
              <fePointLight x={-500} y={-800} z={400} />
            </feSpecularLighting>
            <feComposite in="specularGlint" in2="SourceGraphic" operator="in" result="specularMasked" />

            {/* 9. Final Multi-pass Composite */}
            <feMerge>
              <feMergeNode in="chromaticDispersion" />
              <feMergeNode in="specularMasked" />
            </feMerge>
          </filter>
        </defs>
      </svg>
    </>
  );
};
