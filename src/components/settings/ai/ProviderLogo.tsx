"use client";

import React from "react";
import { Sparkles, Server, Cpu, Bot } from "lucide-react";

interface ProviderLogoProps {
  providerId?: string;
  className?: string;
  size?: number;
}

export const ProviderLogo: React.FC<ProviderLogoProps> = ({
  providerId = "custom",
  className = "w-5 h-5",
  size = 20,
}) => {
  const normalized = providerId.toLowerCase();

  if (normalized.includes("deepseek")) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
      >
        <path
          d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM17.2 14.5C16.8 15.6 15.6 16.5 14.1 16.8C12.4 17.1 10.7 16.6 9.5 15.4L11 13.9C11.7 14.6 12.7 14.9 13.7 14.7C14.5 14.5 15.1 14 15.3 13.3C15.6 12.4 15 11.6 14.1 11.4L12.3 11C10.4 10.6 9.1 8.9 9.5 7C9.9 5.3 11.4 4.1 13.1 4C14.7 3.9 16.2 4.6 17.1 5.7L15.6 7.2C15 6.5 14.1 6.1 13.2 6.2C12.4 6.3 11.8 6.9 11.6 7.6C11.3 8.5 11.9 9.3 12.8 9.5L14.6 9.9C16.6 10.3 17.8 12.4 17.2 14.5Z"
          fill="url(#deepseek-grad)"
        />
        <defs>
          <linearGradient id="deepseek-grad" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
            <stop stopColor="#0066FF" />
            <stop offset="1" stopColor="#00D2FF" />
          </linearGradient>
        </defs>
      </svg>
    );
  }

  if (normalized.includes("sensenova")) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
      >
        <circle cx="12" cy="12" r="10" stroke="url(#sensenova-grad)" strokeWidth="2.5" />
        <path
          d="M8 12C8 9.79 9.79 8 12 8C14.21 8 16 9.79 16 12C16 14.21 14.21 16 12 16"
          stroke="url(#sensenova-grad)"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <circle cx="12" cy="12" r="2" fill="#00E599" />
        <defs>
          <linearGradient id="sensenova-grad" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
            <stop stopColor="#00B96B" />
            <stop offset="1" stopColor="#00E599" />
          </linearGradient>
        </defs>
      </svg>
    );
  }

  if (normalized.includes("siliconflow")) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
      >
        <rect x="3" y="3" width="18" height="18" rx="6" fill="url(#sf-grad)" />
        <path
          d="M7 15C9 17 12 17 14 15L17 9C15 7 12 7 10 9L7 15Z"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <defs>
          <linearGradient id="sf-grad" x1="3" y1="3" x2="21" y2="21" gradientUnits="userSpaceOnUse">
            <stop stopColor="#7C3AED" />
            <stop offset="1" stopColor="#C084FC" />
          </linearGradient>
        </defs>
      </svg>
    );
  }

  if (normalized.includes("qwen") || normalized.includes("dashscope") || normalized.includes("aliyun")) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
      >
        <path
          d="M12 2L3 7V17L12 22L21 17V7L12 2Z"
          fill="url(#qwen-grad)"
          stroke="#FF8C00"
          strokeWidth="1"
        />
        <path
          d="M12 6L7 9V15L12 18L17 15V9L12 6Z"
          fill="#1C1C1E"
          stroke="white"
          strokeWidth="1.5"
        />
        <circle cx="12" cy="12" r="2.5" fill="#FF6A00" />
        <defs>
          <linearGradient id="qwen-grad" x1="3" y1="2" x2="21" y2="22" gradientUnits="userSpaceOnUse">
            <stop stopColor="#FF6A00" />
            <stop offset="1" stopColor="#FFB300" />
          </linearGradient>
        </defs>
      </svg>
    );
  }

  if (normalized.includes("moonshot") || normalized.includes("kimi")) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
      >
        <circle cx="12" cy="12" r="10" fill="#1C1C1E" />
        <path
          d="M12 3C7.03 3 3 7.03 3 12C3 16.97 7.03 21 12 21C9.5 18.5 8 15 8 12C8 9 9.5 5.5 12 3Z"
          fill="url(#moonshot-grad)"
        />
        <circle cx="15.5" cy="8.5" r="1.5" fill="#10A37F" />
        <defs>
          <linearGradient id="moonshot-grad" x1="3" y1="3" x2="12" y2="21" gradientUnits="userSpaceOnUse">
            <stop stopColor="#10A37F" />
            <stop offset="1" stopColor="#34D399" />
          </linearGradient>
        </defs>
      </svg>
    );
  }

  if (normalized.includes("zhipu") || normalized.includes("glm")) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
      >
        <circle cx="12" cy="12" r="9" stroke="url(#zhipu-grad)" strokeWidth="2" />
        <circle cx="8" cy="10" r="2.5" fill="#3B82F6" />
        <circle cx="16" cy="10" r="2.5" fill="#60A5FA" />
        <circle cx="12" cy="16" r="2.5" fill="#2563EB" />
        <path d="M8 10L16 10L12 16Z" stroke="white" strokeWidth="1.2" strokeLinejoin="round" />
        <defs>
          <linearGradient id="zhipu-grad" x1="3" y1="3" x2="21" y2="21" gradientUnits="userSpaceOnUse">
            <stop stopColor="#2563EB" />
            <stop offset="1" stopColor="#38BDF8" />
          </linearGradient>
        </defs>
      </svg>
    );
  }

  if (normalized.includes("openai")) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
      >
        <path
          d="M20.5 9.5C20.1 7.2 18.2 5.5 15.9 5.3C15.4 3.7 14 2.5 12.3 2.2C10.3 1.8 8.4 2.8 7.5 4.5C5.8 4.7 4.3 5.9 3.8 7.6C3.1 9.4 3.7 11.5 5.1 12.7C4.7 14.4 5.3 16.2 6.6 17.3C7.9 18.5 9.8 18.9 11.4 18.3C12.1 19.8 13.7 20.8 15.4 20.7C17.4 20.6 19.1 19.2 19.6 17.3C20.8 16.2 21.3 14.5 20.9 12.8C21.2 11.7 21 10.6 20.5 9.5Z"
          stroke="#10A37F"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="12" cy="12" r="2.5" fill="#10A37F" />
      </svg>
    );
  }

  if (normalized.includes("claude") || normalized.includes("anthropic")) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
      >
        <rect x="2" y="2" width="20" height="20" rx="6" fill="#D97706" />
        <path
          d="M12 6V18M6 12H18M7.75 7.75L16.25 16.25M16.25 7.75L7.75 16.25"
          stroke="white"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  if (normalized.includes("gemini") || normalized.includes("google")) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
      >
        <path
          d="M12 2C12 7.52 7.52 12 2 12C7.52 12 12 16.48 12 22C12 16.48 16.48 12 22 12C16.48 12 12 7.52 12 2Z"
          fill="url(#gemini-grad)"
        />
        <defs>
          <linearGradient id="gemini-grad" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
            <stop stopColor="#4285F4" />
            <stop offset="0.33" stopColor="#9B72CB" />
            <stop offset="0.66" stopColor="#D96570" />
            <stop offset="1" stopColor="#10A37F" />
          </linearGradient>
        </defs>
      </svg>
    );
  }

  if (normalized.includes("groq")) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
      >
        <rect x="3" y="3" width="18" height="18" rx="6" fill="#F97316" />
        <path
          d="M13 6L7 14H12L11 18L17 10H12L13 6Z"
          fill="white"
          stroke="white"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (normalized.includes("openrouter")) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
      >
        <rect x="3" y="3" width="18" height="18" rx="5" fill="#6366F1" />
        <path
          d="M7 9L12 6L17 9M7 15L12 18L17 15"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="12" cy="12" r="2" fill="white" />
      </svg>
    );
  }

  if (normalized.includes("ollama")) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
      >
        <circle cx="12" cy="12" r="10" fill="#27272A" stroke="#52525B" strokeWidth="1" />
        <circle cx="9" cy="10" r="1.5" fill="white" />
        <circle cx="15" cy="10" r="1.5" fill="white" />
        <path
          d="M9 14C10 15.5 14 15.5 15 14"
          stroke="white"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  if (normalized.includes("lmstudio")) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
      >
        <rect x="3" y="3" width="18" height="18" rx="5" fill="#0284C7" />
        <path
          d="M8 8V16H16M8 12H14"
          stroke="white"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  return (
    <div
      className={`rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white shadow-sm ${className}`}
      style={{ width: size, height: size }}
    >
      <Sparkles className="w-3.5 h-3.5" />
    </div>
  );
};
