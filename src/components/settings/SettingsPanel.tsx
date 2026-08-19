"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { useAudioStore } from "@/store/audioStore";
import { useUIStore } from "@/store/uiStore";
import { GlassPanel } from "@/components/shared/Glass";
import { Wrench, Activity, Repeat, Sliders, Type } from "lucide-react";

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenEQ: () => void;
  onOpenVisualSettings?: () => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  isOpen,
  onClose,
  onOpenEQ,
  onOpenVisualSettings: _onOpenVisualSettings,
}) => {
  const volume = useAudioStore((state) => state.volume);
  const setVolume = useAudioStore((state) => state.setVolume);
  const playbackRate = useAudioStore((state) => state.playbackRate);
  const setPlaybackRate = useAudioStore((state) => state.setPlaybackRate);
  const isMuted = useAudioStore((state) => state.isMuted);
  const toggleMute = useAudioStore((state) => state.toggleMute);
  const bassBoost = useAudioStore((state) => state.bassBoost);
  const setBassBoost = useAudioStore((state) => state.setBassBoost);
  const trebleBoost = useAudioStore((state) => state.trebleBoost);
  const setTrebleBoost = useAudioStore((state) => state.setTrebleBoost);
  const vocalEnhance = useAudioStore((state) => state.vocalEnhance);
  const setVocalEnhance = useAudioStore((state) => state.setVocalEnhance);
  const surroundSound = useAudioStore((state) => state.surroundSound);
  const setSurroundSound = useAudioStore((state) => state.setSurroundSound);
  const stereoEnhance = useAudioStore((state) => state.stereoEnhance);
  const setStereoEnhance = useAudioStore((state) => state.setStereoEnhance);

  const openPanel = useUIStore((state) => state.openPanel);
  const setCurrentView = useUIStore((state) => state.setCurrentView);

  const [fadeInOut, setFadeInOut] = useState(true);
  const [autoPause, setAutoPause] = useState(false);
  const [settingsSearch, setSettingsSearch] = useState("");

  const speedOptions = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];
  const hasSearch = settingsSearch.trim().length > 0;
  const matchesSetting = (keywords: string) =>
    !hasSearch || keywords.toLowerCase().includes(settingsSearch.trim().toLowerCase());

  return (
    <GlassPanel
      position="left"
      size="sm"
      isOpen={isOpen}
      onClose={onClose}
      title="控制与设置中心"
      footer={
        <div className="flex flex-col items-center gap-0.5 opacity-30">
          <div className="flex items-center gap-2">
            <span className="text-white font-bold tracking-wider text-[11px] uppercase">
              mimimusic
            </span>
            <span className="w-1 h-1 rounded-full bg-white/30" />
            <span className="text-white text-[10px] font-medium">V0.2</span>
          </div>
          <p className="text-[9px] text-white/80 tracking-[0.15em] uppercase">极简沉浸版</p>
        </div>
      }
    >
      <div className="p-5 space-y-6">
        <input
          value={settingsSearch}
          onChange={(e) => setSettingsSearch(e.target.value)}
          placeholder="搜索设置、工具与功能..."
          className="w-full rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 text-xs text-white outline-none placeholder:text-white/35 focus:border-white/30"
        />

        {/* Professional & View Tools (Migrated from floating buttons) */}
        <div
          className={`space-y-2.5 ${
            matchesSetting("tools professional visual abloop lyrics 工具 专业 可视化 循环 歌词")
              ? ""
              : "hidden"
          }`}
        >
          <h3 className="text-[12px] font-medium text-white/70 uppercase tracking-wider">
            专业工具与视图
          </h3>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => {
                onClose();
                openPanel("professionalTools");
              }}
              className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] transition-colors text-left group"
            >
              <div className="w-7 h-7 rounded-lg bg-purple-500/20 text-purple-300 flex items-center justify-center shrink-0">
                <Wrench className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-medium text-white/90 truncate">专业工具箱</div>
                <div className="text-[10px] text-white/40 truncate">剪辑/格式转换/混音</div>
              </div>
            </button>

            <button
              onClick={() => {
                onClose();
                setCurrentView("visualization");
              }}
              className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] transition-colors text-left group"
            >
              <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-300 flex items-center justify-center shrink-0">
                <Activity className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-medium text-white/90 truncate">音乐可视化</div>
                <div className="text-[10px] text-white/40 truncate">V8 动态粒子舞台</div>
              </div>
            </button>

            <button
              onClick={() => {
                onClose();
                openPanel("lyricSettings");
              }}
              className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] transition-colors text-left group"
            >
              <div className="w-7 h-7 rounded-lg bg-blue-500/20 text-blue-300 flex items-center justify-center shrink-0">
                <Type className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-medium text-white/90 truncate">歌词与桌面</div>
                <div className="text-[10px] text-white/40 truncate">桌面歌词/样式设置</div>
              </div>
            </button>

            <button
              onClick={() => {
                onClose();
                openPanel("professionalTools");
              }}
              className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] transition-colors text-left group"
            >
              <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-300 flex items-center justify-center shrink-0">
                <Repeat className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-medium text-white/90 truncate">A-B 循环</div>
                <div className="text-[10px] text-white/40 truncate">片段循环复读</div>
              </div>
            </button>
          </div>
        </div>

        {/* Volume */}
        <div
          className={`space-y-3 ${matchesSetting("volume mute audio 音量 静音") ? "" : "hidden"}`}
        >
          <div className="flex items-center justify-between">
            <h3 className="text-[13px] font-medium text-white/80">音量</h3>
            <button
              onClick={toggleMute}
              className="text-white/40 hover:text-white transition-colors"
            >
              {isMuted || volume === 0 ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"
                  />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                  />
                </svg>
              )}
            </button>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              className="flex-1 h-1 bg-white/10 rounded-full appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, rgba(255,255,255,0.5) ${volume * 100}%, rgba(255,255,255,0.1) ${volume * 100}%)`,
              }}
            />
            <span className="text-white/40 text-[11px] w-10 text-right tabular-nums">
              {Math.round(volume * 100)}%
            </span>
          </div>
        </div>

        {/* Playback Speed */}
        <div
          className={`space-y-3 ${matchesSetting("playback speed rate 播放 速度") ? "" : "hidden"}`}
        >
          <h3 className="text-[13px] font-medium text-white/80">播放速度</h3>
          <div className="grid grid-cols-3 gap-1.5">
            {speedOptions.map((speed) => (
              <button
                key={speed}
                onClick={() => setPlaybackRate(speed)}
                className={`py-2 rounded-lg text-[13px] font-medium transition-colors duration-150 ${
                  playbackRate === speed
                    ? "bg-white/[0.15] text-white"
                    : "bg-white/[0.06] text-white/50 hover:bg-white/[0.10] hover:text-white/80"
                }`}
              >
                {speed}x
              </button>
            ))}
          </div>
          <div className="pt-1">
            <input
              type="range"
              min="0.5"
              max="2"
              step="0.1"
              value={playbackRate}
              onChange={(e) => setPlaybackRate(parseFloat(e.target.value))}
              className="w-full h-1 bg-white/10 rounded-full appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, rgba(255,255,255,0.5) ${((playbackRate - 0.5) / 1.5) * 100}%, rgba(255,255,255,0.1) ${((playbackRate - 0.5) / 1.5) * 100}%)`,
              }}
            />
            <div className="flex justify-between text-white/30 text-[10px] mt-1">
              <span>0.5x</span>
              <span className="text-white/50">{playbackRate.toFixed(1)}x</span>
              <span>2.0x</span>
            </div>
          </div>
        </div>

        {/* Audio Effects */}
        <div
          className={`space-y-3 ${
            matchesSetting("audio effects eq bass treble vocal surround stereo 音效 均衡器")
              ? ""
              : "hidden"
          }`}
        >
          <h3 className="text-[13px] font-medium text-white/80">音频效果</h3>

          <button
            onClick={onOpenEQ}
            className="w-full flex items-center justify-between p-3.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.10] border border-white/[0.06] transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-full bg-white/[0.10] flex items-center justify-center text-white/60">
                <Sliders className="w-3.5 h-3.5" />
              </div>
              <span className="text-white/80 text-[13px] font-medium">均衡器 (EQ)</span>
            </div>
            <svg
              className="w-4 h-4 text-white/30 group-hover:text-white/60 transition-colors"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          <div className="p-3.5 rounded-xl bg-white/[0.04] border border-white/[0.06] space-y-4">
            <h4 className="text-[10px] font-semibold text-white/40 uppercase tracking-widest">
              高级音效
            </h4>
            {[
              { label: "重低音", value: bassBoost, set: setBassBoost },
              { label: "高音", value: trebleBoost, set: setTrebleBoost },
              { label: "人声", value: vocalEnhance, set: setVocalEnhance },
              { label: "环绕", value: surroundSound, set: setSurroundSound },
              { label: "立体声", value: stereoEnhance, set: setStereoEnhance },
            ].map((effect, idx) => (
              <div key={idx} className="space-y-1.5">
                <div className="flex justify-between text-[11px]">
                  <span className="text-white/50">{effect.label}</span>
                  <span className="text-white/30 tabular-nums">{effect.value}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={effect.value}
                  onChange={(e) => effect.set(parseInt(e.target.value))}
                  className="w-full h-1 rounded-full appearance-none cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, rgba(255,255,255,0.5) ${effect.value}%, rgba(255,255,255,0.08) ${effect.value}%)`,
                  }}
                />
              </div>
            ))}
          </div>

          {/* Toggle switches */}
          {[
            { label: "淡入淡出", value: fadeInOut, toggle: () => setFadeInOut(!fadeInOut) },
            { label: "播放完暂停", value: autoPause, toggle: () => setAutoPause(!autoPause) },
          ].map((item) => (
            <div
              key={item.label}
              className="flex items-center justify-between p-3 rounded-xl bg-white/[0.04]"
            >
              <span className="text-white/60 text-[13px]">{item.label}</span>
              <button
                onClick={item.toggle}
                className={`w-[42px] h-[24px] rounded-full transition-colors duration-200 relative ${
                  item.value ? "bg-white/30" : "bg-white/[0.10]"
                }`}
              >
                <motion.div
                  className="w-[20px] h-[20px] rounded-full bg-white absolute top-[2px]"
                  animate={{ left: item.value ? "20px" : "2px" }}
                  transition={{ duration: 0.2 }}
                />
              </button>
            </div>
          ))}
        </div>
      </div>
    </GlassPanel>
  );
};
