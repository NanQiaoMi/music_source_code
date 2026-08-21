/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { useAudioStore } from "@/store/audioStore";
import { useUIStore } from "@/store/uiStore";
import { GlassPanel } from "@/components/shared/Glass";
import {
  Wrench,
  Activity,
  Repeat,
  Sliders,
  Type,
  Volume2,
  VolumeX,
  Gauge,
  Sparkles,
  ChevronRight,
  Disc3,
  Search,
} from "lucide-react";

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
  onOpenVisualSettings,
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
      title="系统偏好设置"
      footer={
        <div className="flex flex-col items-center gap-0.5 opacity-40 py-2">
          <div className="flex items-center gap-1.5">
            <span className="text-white font-semibold tracking-tight text-[11px]">
              MIMI Music Player
            </span>
            <span className="w-1 h-1 rounded-full bg-white/40" />
            <span className="text-white/80 font-mono text-[10px]">v0.2 Pro</span>
          </div>
          <p className="text-[9px] text-[#86868b] tracking-wider uppercase">
            Apple High-Res Audio Engine
          </p>
        </div>
      }
    >
      <div className="p-4 space-y-5 text-left font-sans antialiased text-[#f5f5f7]">
        {/* 搜索栏 (Apple Style Search Bar) */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-[#86868b] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={settingsSearch}
            onChange={(e) => setSettingsSearch(e.target.value)}
            placeholder="搜索设置、音效与功能..."
            className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] pl-8 pr-3 py-2 text-[12px] text-white outline-none placeholder:text-[#86868b] focus:border-[#0071e3] transition-colors"
          />
        </div>

        {/* 1. 快捷工具与空间舞台 */}
        <div
          className={`space-y-2 ${
            matchesSetting("tools professional visual abloop lyrics 工具 专业 可视化 循环 歌词 舞台 唱片架")
              ? ""
              : "hidden"
          }`}
        >
          <span className="text-[11px] font-semibold text-[#86868b] uppercase tracking-wider px-1">
            空间与专业工具
          </span>
          <div className="rounded-2xl bg-white/[0.04] border border-white/[0.06] divide-y divide-white/[0.04] overflow-hidden">
            <button
              onClick={() => {
                onClose();
                openPanel("shelf3D");
              }}
              className="w-full flex items-center justify-between p-3 hover:bg-white/[0.03] transition-colors text-left group"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0">
                  <Disc3 className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className="text-[13px] font-medium text-white">3D 空间唱片架</div>
                  <div className="text-[10px] text-[#86868b]">物理惯性旋转浏览</div>
                </div>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-[#86868b] group-hover:text-white transition-colors" />
            </button>

            <button
              onClick={() => {
                onClose();
                setCurrentView("visualization");
              }}
              className="w-full flex items-center justify-between p-3 hover:bg-white/[0.03] transition-colors text-left group"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center shrink-0">
                  <Activity className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className="text-[13px] font-medium text-white">暗场粒子歌词舞台</div>
                  <div className="text-[10px] text-[#86868b]">3D 粒子流场与发光歌词</div>
                </div>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-[#86868b] group-hover:text-white transition-colors" />
            </button>

            <button
              onClick={() => {
                onClose();
                openPanel("lyricSettings");
              }}
              className="w-full flex items-center justify-between p-3 hover:bg-white/[0.03] transition-colors text-left group"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-[#0071e3]/20 text-[#2997ff] flex items-center justify-center shrink-0">
                  <Type className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className="text-[13px] font-medium text-white">歌词显示样式</div>
                  <div className="text-[10px] text-[#86868b]">排版/动效/发光特效</div>
                </div>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-[#86868b] group-hover:text-white transition-colors" />
            </button>
          </div>
        </div>

        {/* 2. 主音量控制 */}
        <div
          className={`space-y-2 ${matchesSetting("volume mute audio 音量 静音") ? "" : "hidden"}`}
        >
          <div className="flex items-center justify-between px-1">
            <span className="text-[11px] font-semibold text-[#86868b] uppercase tracking-wider">
              主音量控制
            </span>
            <span className="text-[11px] font-mono text-[#2997ff]">{Math.round(volume * 100)}%</span>
          </div>

          <div className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center gap-3">
            <button
              type="button"
              onClick={toggleMute}
              className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/15 flex items-center justify-center text-white/80 transition-colors shrink-0"
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="w-3.5 h-3.5 text-rose-400" />
              ) : (
                <Volume2 className="w-3.5 h-3.5 text-white/80" />
              )}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              className="flex-1 h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-[#0071e3]"
            />
          </div>
        </div>

        {/* 3. 播放速度 */}
        <div
          className={`space-y-2 ${matchesSetting("playback speed rate 播放 速度") ? "" : "hidden"}`}
        >
          <div className="flex items-center justify-between px-1">
            <span className="text-[11px] font-semibold text-[#86868b] uppercase tracking-wider">
              播放速度
            </span>
            <span className="text-[11px] font-mono text-[#2997ff]">{playbackRate.toFixed(2)}x</span>
          </div>

          <div className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/[0.06] space-y-3">
            <div className="grid grid-cols-6 gap-1">
              {speedOptions.map((speed) => (
                <button
                  key={speed}
                  onClick={() => setPlaybackRate(speed)}
                  className={`py-1.5 rounded-lg text-[11px] font-mono font-medium transition-colors ${
                    playbackRate === speed
                      ? "bg-[#0071e3] text-white shadow-sm font-semibold"
                      : "bg-white/[0.04] text-[#86868b] hover:text-white"
                  }`}
                >
                  {speed}x
                </button>
              ))}
            </div>

            <input
              type="range"
              min="0.5"
              max="2"
              step="0.05"
              value={playbackRate}
              onChange={(e) => setPlaybackRate(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-[#0071e3]"
            />
          </div>
        </div>

        {/* 4. 音效与均衡器 */}
        <div
          className={`space-y-2 ${
            matchesSetting("audio effects eq bass treble vocal surround stereo 音效 均衡器")
              ? ""
              : "hidden"
          }`}
        >
          <span className="text-[11px] font-semibold text-[#86868b] uppercase tracking-wider px-1">
            音效与 DSP 增强
          </span>

          <div className="rounded-2xl bg-white/[0.04] border border-white/[0.06] divide-y divide-white/[0.04] overflow-hidden">
            <button
              onClick={() => {
                onClose();
                onOpenEQ();
              }}
              className="w-full flex items-center justify-between p-3 hover:bg-white/[0.03] transition-colors text-left group"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
                  <Sliders className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className="text-[13px] font-medium text-white">专业均衡器 (EQ)</div>
                  <div className="text-[10px] text-[#86868b]">10 段图形增益与风格预设</div>
                </div>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-[#86868b] group-hover:text-white transition-colors" />
            </button>

            <div className="p-3.5 space-y-3">
              {[
                { label: "重低音增强 (Bass Boost)", value: bassBoost, set: setBassBoost },
                { label: "高音透亮 (Treble Clarity)", value: trebleBoost, set: setTrebleBoost },
                { label: "人声凸显 (Vocal Enhance)", value: vocalEnhance, set: setVocalEnhance },
                { label: "空间环绕 (Surround Sound)", value: surroundSound, set: setSurroundSound },
                { label: "立体声展宽 (Stereo Widen)", value: stereoEnhance, set: setStereoEnhance },
              ].map((effect, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-white/80">{effect.label}</span>
                    <span className="text-[#2997ff] font-mono">{effect.value}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={effect.value}
                    onChange={(e) => effect.set(parseInt(e.target.value))}
                    className="w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-[#0071e3]"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 5. 播放习惯开关 */}
        <div className="space-y-2">
          <span className="text-[11px] font-semibold text-[#86868b] uppercase tracking-wider px-1">
            播放偏好
          </span>
          <div className="rounded-2xl bg-white/[0.04] border border-white/[0.06] divide-y divide-white/[0.04] overflow-hidden">
            <div className="flex items-center justify-between p-3.5">
              <div>
                <div className="text-[13px] font-medium text-white">切歌淡入淡出 (Crossfade)</div>
                <div className="text-[10px] text-[#86868b]">平滑过渡曲目音量</div>
              </div>
              <button
                type="button"
                onClick={() => setFadeInOut(!fadeInOut)}
                className={`w-10 h-5.5 rounded-full transition-colors relative shrink-0 ${
                  fadeInOut ? "bg-[#34c759]" : "bg-white/20"
                }`}
              >
                <motion.div
                  className="w-4.5 h-4.5 rounded-full bg-white absolute top-0.5 shadow-sm"
                  animate={{ left: fadeInOut ? "20px" : "2px" }}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
              </button>
            </div>

            <div className="flex items-center justify-between p-3.5">
              <div>
                <div className="text-[13px] font-medium text-white">失焦自动静音 (Auto Pause)</div>
                <div className="text-[10px] text-[#86868b]">切换标签页时暂停播放</div>
              </div>
              <button
                type="button"
                onClick={() => setAutoPause(!autoPause)}
                className={`w-10 h-5.5 rounded-full transition-colors relative shrink-0 ${
                  autoPause ? "bg-[#34c759]" : "bg-white/20"
                }`}
              >
                <motion.div
                  className="w-4.5 h-4.5 rounded-full bg-white absolute top-0.5 shadow-sm"
                  animate={{ left: autoPause ? "20px" : "2px" }}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
              </button>
            </div>
          </div>
        </div>
      </div>
    </GlassPanel>
  );
};
