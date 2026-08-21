/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useUIStore } from "@/store/uiStore";

interface DateTimeSnapshot {
  time: {
    hours: string;
    minutes: string;
  };
  dateStr: string;
}

const EMPTY_DATE_TIME: DateTimeSnapshot = {
  time: { hours: "--", minutes: "--" },
  dateStr: "",
};

const formatTime = (date: Date) => {
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  return { hours, minutes };
};

const formatDate = (date: Date) => {
  const weekday = date.toLocaleDateString("zh-CN", { weekday: "long" });
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${month}月${day}日 ${weekday}`;
};

const getDateTimeSnapshot = (): DateTimeSnapshot => {
  const now = new Date();
  return {
    time: formatTime(now),
    dateStr: formatDate(now),
  };
};

export const AppleDateTime: React.FC = () => {
  const isNavMenuOpen = useUIStore((state) => state.isNavMenuOpen);
  const [dateTime, setDateTime] = useState<DateTimeSnapshot>(EMPTY_DATE_TIME);

  useEffect(() => {
    const updateDateTime = () => {
      const next = getDateTimeSnapshot();
      setDateTime((prev) => {
        if (
          prev.time.hours === next.time.hours &&
          prev.time.minutes === next.time.minutes &&
          prev.dateStr === next.dateStr
        ) {
          return prev;
        }
        return next;
      });
    };
    const timeout = window.setTimeout(updateDateTime, 0);
    const interval = window.setInterval(updateDateTime, 1000);

    return () => {
      window.clearTimeout(timeout);
      window.clearInterval(interval);
    };
  }, []);

  const { time, dateStr } = dateTime;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{
        opacity: isNavMenuOpen ? 0.08 : 1,
        scale: isNavMenuOpen ? 0.96 : 1,
        filter: isNavMenuOpen ? "blur(3px)" : "blur(0px)",
      }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className="flex flex-col items-center justify-center select-none font-sans"
    >
      {/* 统一高奢极细数字时钟 */}
      <div className="flex items-baseline justify-center tracking-[-0.04em]">
        <span className="text-[76px] font-extralight text-white/90 drop-shadow-[0_4px_24px_rgba(255,255,255,0.15)]">
          {time.hours}
        </span>

        <motion.span
          animate={{ opacity: [0.2, 0.7, 0.2] }}
          transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
          className="text-[64px] font-thin text-white/40 mx-2 select-none"
        >
          :
        </motion.span>

        <span className="text-[76px] font-extralight text-white/90 drop-shadow-[0_4px_24px_rgba(255,255,255,0.15)]">
          {time.minutes}
        </span>
      </div>

      {/* 精致日期与渐变微细线 */}
      <div className="mt-1 flex items-center gap-4">
        <div className="h-[1px] w-8 bg-gradient-to-l from-white/20 to-transparent" />
        <span className="text-[12px] font-medium tracking-[0.2em] text-white/50 uppercase">
          {dateStr}
        </span>
        <div className="h-[1px] w-8 bg-gradient-to-r from-white/20 to-transparent" />
      </div>
    </motion.div>
  );
};
