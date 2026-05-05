"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";

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

export const AppleDateTime: React.FC = () => {
  const [time, setTime] = useState<{ hours: string; minutes: string } | null>(null);
  const [dateStr, setDateStr] = useState<string>("");
  const [mounted, setMounted] = useState(false);

  const updateDateTime = useCallback(() => {
    const now = new Date();
    setTime(formatTime(now));
    setDateStr(formatDate(now));
  }, []);

  useEffect(() => {
    setMounted(true);
    updateDateTime();
    const interval = setInterval(updateDateTime, 1000);
    return () => clearInterval(interval);
  }, [updateDateTime]);

  if (!mounted || !time) return null;

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center select-none"
    >
      <div className="flex items-baseline gap-2">
        <span 
          className="text-9xl font-light tracking-tighter text-white/90 italic"
          style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
        >
          {time.hours}
        </span>
        
        <motion.span 
          animate={{ opacity: [0.1, 0.4, 0.1] }}
          transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
          className="text-6xl font-extralight text-white/10 mx-2"
        >
          /
        </motion.span>

        <span 
          className="text-9xl font-light tracking-tighter text-white/90"
          style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
        >
          {time.minutes}
        </span>
      </div>

      <div className="mt-10 flex items-center gap-6">
        <div className="h-[1px] w-12 bg-gradient-to-l from-white/10 to-transparent" />
        <span 
          className="text-xs font-black tracking-[0.5em] text-white/30 uppercase italic"
          style={{ fontFamily: 'system-ui' }}
        >
          {dateStr}
        </span>
        <div className="h-[1px] w-12 bg-gradient-to-r from-white/10 to-transparent" />
      </div>
    </motion.div>
  );
};
