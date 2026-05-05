"use client";

import React from "react";
import { motion } from "framer-motion";

interface LogoProps {
  className?: string;
  size?: number;
}

export function Logo({ className = "", size = 32 }: LogoProps) {
  return (
    <motion.div
      className={`relative flex items-center justify-center ${className}`}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 200 200"
        width={size}
        height={size}
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <filter id="softShadowLogo" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="12" stdDeviation="15" floodColor="#1A237E" floodOpacity="0.08" />
          </filter>
          
          <filter id="glowLogo" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge>
              <feMergeNode in="blur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>

          <linearGradient id="bgGradLogo" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#F3E5F5"/>
            <stop offset="50%" stopColor="#E0F7FA"/>
            <stop offset="100%" stopColor="#E8EAF6"/>
          </linearGradient>

          <linearGradient id="catBlueLogo" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#FFFFFF"/>
            <stop offset="100%" stopColor="#81D4FA"/>
          </linearGradient>

          <linearGradient id="catDarkLogo" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#FFB74D"/>
            <stop offset="100%" stopColor="#F57C00"/>
          </linearGradient>
          
          <linearGradient id="silverLogo" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFFFFF"/>
            <stop offset="100%" stopColor="#90A4AE"/>
          </linearGradient>
        </defs>

        <rect width="200" height="200" rx="45" fill="url(#bgGradLogo)"/>
        <ellipse cx="100" cy="170" rx="65" ry="10" fill="#90A4AE" opacity="0.2" filter="blur(8px)"/>

        <path d="M 140 145 Q 175 150 175 110 Q 175 90 160 85" fill="none" stroke="url(#catDarkLogo)" strokeWidth="18" strokeLinecap="round" filter="url(#softShadowLogo)"/>
        <path d="M 50 150 Q 25 150 25 120 Q 25 105 35 95" fill="none" stroke="url(#catBlueLogo)" strokeWidth="16" strokeLinecap="round" filter="url(#softShadowLogo)"/>

        <g filter="url(#softShadowLogo)">
          <rect x="80" y="80" width="75" height="85" rx="37.5" fill="url(#catDarkLogo)"/>
          <path d="M 95 80 Q 98 40 105 40 Q 112 40 120 65 Z" fill="url(#catDarkLogo)"/>
          <path d="M 130 65 Q 138 40 145 40 Q 152 40 155 80 Z" fill="url(#catDarkLogo)"/>
          <path d="M 102 65 Q 105 50 108 50 Q 111 50 115 62 Z" fill="#FF8A80" opacity="0.7"/>
          <path d="M 135 62 Q 139 50 142 50 Q 145 50 148 65 Z" fill="#FF8A80" opacity="0.7"/>
          <circle cx="125" cy="95" r="38" fill="url(#catDarkLogo)"/>
          <path d="M 87 95 A 38 38 0 0 1 163 95 A 36 36 0 0 0 87 95 Z" fill="#FFFFFF" opacity="0.3"/>
          <rect x="123" y="60" width="4" height="15" rx="2" fill="#E65100" opacity="0.4"/>
          <rect x="113" y="64" width="4" height="12" rx="2" fill="#E65100" opacity="0.4" transform="rotate(-15 115 70)"/>
          <rect x="133" y="64" width="4" height="12" rx="2" fill="#E65100" opacity="0.4" transform="rotate(15 135 70)"/>
          <ellipse cx="125" cy="110" rx="16" ry="12" fill="#FFF8E1"/>
          <circle cx="125" cy="104" r="3" fill="#EF5350"/>
          <path d="M 125 107 Q 120 114 116 110 M 125 107 Q 130 114 134 110" fill="none" stroke="#795548" strokeWidth="2.5" strokeLinecap="round"/>
          <circle cx="110" cy="95" r="6" fill="#3E2723"/>
          <circle cx="140" cy="95" r="6" fill="#3E2723"/>
          <circle cx="108" cy="92" r="2.5" fill="#FFFFFF"/>
          <circle cx="113" cy="97" r="1" fill="#FFFFFF"/>
          <circle cx="138" cy="92" r="2.5" fill="#FFFFFF"/>
          <circle cx="143" cy="97" r="1" fill="#FFFFFF"/>
          <ellipse cx="100" cy="106" rx="8" ry="5" fill="#FF8A80" opacity="0.5" filter="blur(3px)"/>
          <ellipse cx="150" cy="106" rx="8" ry="5" fill="#FF8A80" opacity="0.5" filter="blur(3px)"/>
        </g>

        <g filter="url(#softShadowLogo)">
          <rect x="35" y="100" width="75" height="65" rx="37.5" fill="url(#catBlueLogo)"/>
          <path d="M 45 90 Q 48 55 55 55 Q 62 55 70 80 Z" fill="url(#catBlueLogo)"/>
          <path d="M 75 80 Q 83 55 90 55 Q 97 55 100 90 Z" fill="url(#catBlueLogo)"/>
          <path d="M 52 82 Q 55 68 58 68 Q 61 68 64 80 Z" fill="#FCE4EC" opacity="0.9"/>
          <path d="M 78 80 Q 82 68 85 68 Q 88 68 92 82 Z" fill="#FCE4EC" opacity="0.9"/>
          <circle cx="72.5" cy="108" r="36" fill="url(#catBlueLogo)"/>
          <path d="M 36.5 108 A 36 36 0 0 1 108.5 108 A 34 34 0 0 0 36.5 108 Z" fill="#FFFFFF" opacity="0.7"/>
          <ellipse cx="72.5" cy="122" rx="16" ry="11" fill="#FFFFFF"/>
          <circle cx="72.5" cy="116" r="3" fill="#EF5350"/>
          <path d="M 72.5 119 Q 68 125 64 121 M 72.5 119 Q 77 125 81 121" fill="none" stroke="#546E7A" strokeWidth="2" strokeLinecap="round"/>
          <path d="M 53 110 Q 59 104 65 110 M 80 110 Q 86 104 92 110" fill="none" stroke="#455A64" strokeWidth="3" strokeLinecap="round"/>
          <ellipse cx="51" cy="116" rx="10" ry="7" fill="#FF8A80" opacity="0.6" filter="blur(3px)"/>
          <ellipse cx="94" cy="116" rx="10" ry="7" fill="#FF8A80" opacity="0.6" filter="blur(3px)"/>
        </g>

        <g filter="url(#softShadowLogo)">
          <path d="M 30 110 A 45 45 0 0 1 115 110" fill="none" stroke="url(#silverLogo)" strokeWidth="7" strokeLinecap="round"/>
          <rect x="110" y="95" width="12" height="30" rx="6" fill="#FFFFFF"/>
          <rect x="106" y="98" width="6" height="24" rx="3" fill="#CFD8DC"/> 
          <rect x="23" y="95" width="12" height="30" rx="6" fill="#FFFFFF"/>
          <rect x="33" y="98" width="6" height="24" rx="3" fill="#CFD8DC"/> 
        </g>

        <rect x="45" y="148" width="22" height="13" rx="6.5" fill="#FFFFFF" filter="url(#softShadowLogo)"/>
        <path d="M 51 151 L 51 158 M 58 151 L 58 158" stroke="#B3E5FC" strokeWidth="2.5" strokeLinecap="round"/>

        <g filter="url(#softShadowLogo)">
          <path d="M 110 135 L 94 142" fill="none" stroke="url(#catDarkLogo)" strokeWidth="15" strokeLinecap="round"/>
          <path d="M 108 131 L 93 138" fill="none" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" opacity="0.4"/>
          <path d="M 94 140 L 96 138 M 90 143 L 92 141" stroke="#4E342E" strokeWidth="1.5" strokeLinecap="round" opacity="0.5"/>
        </g>

        <g filter="url(#glowLogo)">
          <path d="M 40 45 C 40 45 32 37 32 32 C 32 27 40 27 40 32 C 40 27 48 27 48 32 C 48 37 40 45 40 45 Z" fill="#FF8A80" opacity="0.8"/>
          <path d="M 140 30 L 140 15 L 148 20" fill="none" stroke="#18FFFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" opacity="0.7"/>
          <circle cx="137.5" cy="30" r="4" fill="#18FFFF" opacity="0.7"/>
        </g>
        <circle cx="85" cy="40" r="2" fill="#FFFFFF" opacity="0.8" filter="url(#glowLogo)"/>
        <circle cx="155" cy="50" r="1.5" fill="#FFFFFF" opacity="0.6"/>
      </svg>
    </motion.div>
  );
}
