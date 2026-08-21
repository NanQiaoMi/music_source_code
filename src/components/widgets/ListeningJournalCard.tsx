"use client";

import React, { useMemo } from "react";
import { BookOpen, CalendarDays } from "lucide-react";
import { useListeningJournalStore } from "@/store/listeningJournalStore";
import { useUIStore } from "@/store/uiStore";

export function ListeningJournalCard() {
  const days = useListeningJournalStore((state) => state.days);
  const getWeek = useListeningJournalStore((state) => state.getWeek);
  const setSelectedDate = useListeningJournalStore((state) => state.setSelectedDate);
  const openPanel = useUIStore((state) => state.openPanel);
  const week = useMemo(() => getWeek(), [getWeek, days]);
  const totalMinutes = week.reduce((sum, day) => sum + day.totalMinutes, 0);
  const activeDays = week.filter((day) => day.totalMinutes > 0).length;

  const openDay = (date: string) => {
    setSelectedDate(date);
    openPanel("listeningJournal");
  };

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.06] p-5 shadow-xl backdrop-blur-xl">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-200">
            <BookOpen className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">听歌日记</h3>
            <p className="text-sm text-white/50">
              本地七天笔记、心情和听歌深度记录。
            </p>
          </div>
        </div>
        <div className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/55">
          {activeDays}/7 天活跃
        </div>
      </div>

      <div
        className="mb-4 grid grid-cols-7 gap-2"
        role="list"
        aria-label="Seven-day listening journal"
      >
        {week.map((day) => {
          const intensity = Math.min(1, day.totalMinutes / 120);
          return (
            <button
              key={day.date}
              type="button"
              onClick={() => openDay(day.date)}
              className="group flex min-h-20 flex-col items-center justify-between rounded-xl border border-white/10 bg-black/20 p-2 text-center transition-colors hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-cyan-300/60"
              aria-label={`${day.date}: ${day.totalMinutes} minutes${day.dominantMood ? `, ${day.dominantMood}` : ""}`}
            >
              <span className="text-[10px] text-white/35">{day.date.slice(5)}</span>
              <span
                className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-white"
                style={{ backgroundColor: `rgba(34, 211, 238, ${0.16 + intensity * 0.5})` }}
              >
                {day.totalMinutes}
              </span>
              <span className="truncate text-[10px] text-white/40">
                {day.dominantMood || "笔记"}
              </span>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => openDay(week[week.length - 1]?.date)}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-sm text-white/70 transition-colors hover:bg-white/15 hover:text-white"
      >
        <CalendarDays className="h-4 w-4" />
        打开今日日记 - {totalMinutes} 本周分钟
      </button>
    </section>
  );
}
