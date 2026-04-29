"use client";

import React, { useState, useEffect, useCallback } from "react";

const formatTime = (date: Date) => {
  const hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, "0");
  return `${hours}:${minutes}`;
};

const formatDate = (date: Date, lang: string = "en-US") => {
  const weekday = date.toLocaleDateString(lang, { weekday: "long" });
  const month = date.toLocaleDateString(lang, { month: "long" });
  const day = date.getDate();
  return `${weekday} ${month} ${day}`;
};

export const AppleDateTime: React.FC = () => {
  const [time, setTime] = useState<string>("");
  const [dateStr, setDateStr] = useState<string>("");

  const updateDateTime = useCallback(() => {
    const now = new Date();
    setTime(formatTime(now));
    setDateStr(formatDate(now));
  }, []);

  useEffect(() => {
    updateDateTime();

    const updateInterval = () => {
      const now = new Date();
      const millisecondsToNextMinute = (60 - now.getSeconds()) * 1000 - now.getMilliseconds();

      const timeout = setTimeout(() => {
        updateDateTime();
        updateInterval();
      }, millisecondsToNextMinute);

      return timeout;
    };

    let timeout: NodeJS.Timeout | undefined;
    const firstTimeout = setTimeout(
      () => {
        updateDateTime();
        timeout = updateInterval();
      },
      (60 - new Date().getSeconds()) * 1000 - new Date().getMilliseconds()
    );

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        updateDateTime();
        if (firstTimeout) clearTimeout(firstTimeout);
        if (timeout) clearTimeout(timeout);
        timeout = updateInterval();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      if (firstTimeout) clearTimeout(firstTimeout);
      if (timeout) clearTimeout(timeout);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [updateDateTime]);

  return (
    <div className="flex flex-col items-center justify-center">
      <div
        className="text-5xl font-light tracking-tight"
        style={{
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", sans-serif',
          color: "rgba(255, 255, 255, 0.95)",
          textShadow: "0 2px 20px rgba(0, 0, 0, 0.3)",
          letterSpacing: "-0.5px",
        }}
      >
        {time}
      </div>
      <div
        className="text-xl font-medium mt-1"
        style={{
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", sans-serif',
          color: "rgba(255, 255, 255, 0.75)",
          textShadow: "0 1px 10px rgba(0, 0, 0, 0.2)",
          letterSpacing: "-0.2px",
        }}
      >
        {dateStr}
      </div>
    </div>
  );
};
