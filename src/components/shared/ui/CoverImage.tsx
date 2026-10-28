"use client";

import Image from "next/image";
import { useState } from "react";
import type { HTMLAttributeReferrerPolicy } from "react";
import { featureFlags } from "@/lib/perf/featureFlags";

export const DEFAULT_COVER_SRC = "/default-cover.svg";

export type CoverImageSize = "xs" | "sm" | "md" | "lg" | "hero";

const DEFAULT_SIZES: Record<CoverImageSize, string> = {
  xs: "24px",
  sm: "36px",
  md: "48px",
  lg: "360px",
  hero: "100vw",
};

export interface CoverImageProps {
  src?: string | null;
  alt: string;
  size?: CoverImageSize;
  priority?: boolean;
  className?: string;
  sizes?: string;
  fill?: boolean;
  cachedSrc?: string | null;
  /** Remote cover hosts often reject hotlinks when a referrer is sent. */
  referrerPolicy?: HTMLAttributeReferrerPolicy;
  /** Optional low-res preview shown while the full cover loads. */
  blurDataURL?: string;
}

/**
 * Single entry point for cover art and thumbnails (S4-4).
 *
 * Rules: cachedSrc > src > /default-cover.svg; lazy unless priority; async decode;
 * data:/blob: URLs skip next/image optimization; a failed load falls back to the
 * default cover once; NEXT_PUBLIC_COVER_IMAGE_V2=off restores the plain wrapper.
 */
export function CoverImage({
  src,
  alt,
  size = "md",
  priority = false,
  className,
  sizes,
  fill = true,
  cachedSrc,
  referrerPolicy = "no-referrer",
  blurDataURL,
}: CoverImageProps) {
  const finalSrc = cachedSrc || src || DEFAULT_COVER_SRC;
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const displaySrc = failedSrc === finalSrc ? DEFAULT_COVER_SRC : finalSrc;
  const enhanced = featureFlags.coverImageV2;
  const unoptimized = displaySrc.startsWith("data:") || displaySrc.startsWith("blob:");

  return (
    <Image
      src={displaySrc}
      alt={alt}
      fill={fill}
      sizes={sizes ?? DEFAULT_SIZES[size]}
      className={className}
      loading={enhanced ? (priority ? "eager" : "lazy") : undefined}
      decoding={enhanced ? "async" : undefined}
      fetchPriority={enhanced ? (priority ? "high" : "auto") : undefined}
      referrerPolicy={enhanced ? referrerPolicy : undefined}
      placeholder={enhanced && blurDataURL ? "blur" : "empty"}
      blurDataURL={blurDataURL}
      unoptimized={unoptimized}
      onError={
        enhanced
          ? () => {
              if (displaySrc !== DEFAULT_COVER_SRC) setFailedSrc(finalSrc);
            }
          : undefined
      }
    />
  );
}
