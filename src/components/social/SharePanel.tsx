"use client";

import React, { useState, useRef, useMemo, useCallback, useEffect } from "react";
import { Clipboard, Check } from "lucide-react";
import { motion } from "framer-motion";
import { useAudioStore } from "@/store/audioStore";
import type { Song } from "@/types/song";
import {
  X,
  Share2,
  Music,
  Download,
  RefreshCw,
  Type,
  Palette,
  ImagePlus,
  Eye,
  Edit3,
  Box,
  LayoutTemplate,
  Activity,
  Disc3,
  Wand2,
  Info,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { toPng } from "html-to-image";
import { toast } from "@/components/shared/GlassToast";
import {
  DEFAULT_POSTER_CONFIG,
  POSTER_ASPECT_RATIO_PRESETS,
  POSTER_QUICK_PRESETS,
  POSTER_RESOLUTION_PRESETS,
  POSTER_TEMPLATE_META,
  POSTER_THEME_COLORS,
  applyPosterPreset,
  createPosterFileName,
  getPosterExportMeta,
  getPosterQualityChecks,
  getTemplateMeta,
} from "@/utils/posterWorkshop";
import type { PosterConfig, PosterTemplate } from "@/utils/posterWorkshop";
import { PosterPreview, parseLyrics } from "./PosterTemplates";
import { ControlGroup, GlassSlider } from "./PosterControls";

interface SharePanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const RENDER_WIDTH = 800;

export const SharePanel: React.FC<SharePanelProps> = ({ isOpen, onClose }) => {
  const currentSong = useAudioStore((state) => state.currentSong);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [selectedLyric, _setSelectedLyric] = useState<string>("");
  const [customLyric, setCustomLyric] = useState<string>("");
  const [isEditingLyric, setIsEditingLyric] = useState(false);
  const [selectedLyricLines, setSelectedLyricLines] = useState<string[]>([]);
  const [config, setConfig] = useState<PosterConfig>(DEFAULT_POSTER_CONFIG);
  const [resolution, setResolution] = useState<number>(2);

  const previewContainerRef = useRef<HTMLDivElement>(null);
  const posterRef = useRef<HTMLDivElement>(null);
  const [previewScale, setPreviewScale] = useState(1);

  const renderHeight = RENDER_WIDTH / config.aspectRatio;

  useEffect(() => {
    if (!isOpen) return;
    const container = previewContainerRef.current;
    if (!container) return;

    const updateScale = () => {
      const { width, height } = container.getBoundingClientRect();
      const padding = 48; // safe padding
      const availableWidth = width - padding;
      const availableHeight = height - padding;

      const scaleX = availableWidth / RENDER_WIDTH;
      const scaleY = availableHeight / renderHeight;
      setPreviewScale(Math.min(scaleX, scaleY));
    };

    updateScale();
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, [renderHeight, isOpen]);

  const parsedLyrics = useMemo(() => {
    return currentSong?.lyrics
      ? parseLyrics(currentSong.lyrics)
      : ["在这美好的时光里", "让音乐治愈你的心灵", "每一个音符都是故事", "聆听内心的声音"];
  }, [currentSong]);

  const lyricLineCount = useMemo(() => {
    if (isEditingLyric) {
      return customLyric
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean).length;
    }

    if (selectedLyricLines.length > 0) return selectedLyricLines.length;
    return selectedLyric ? 1 : 0;
  }, [customLyric, isEditingLyric, selectedLyric, selectedLyricLines.length]);

  const exportMeta = useMemo(
    () => getPosterExportMeta(config, resolution, RENDER_WIDTH),
    [config, resolution]
  );

  const qualityChecks = useMemo(
    () =>
      getPosterQualityChecks({
        config,
        resolution,
        lyricLineCount,
        hasCover: Boolean(currentSong?.cover),
      }),
    [config, currentSong?.cover, lyricLineCount, resolution]
  );

  const failedQualityChecks = qualityChecks.filter((check) => !check.passed);

  const updateConfig = useCallback((key: keyof PosterConfig, value: any) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  }, []);

  const applyQuickPreset = useCallback((presetId: (typeof POSTER_QUICK_PRESETS)[number]["id"]) => {
    setConfig((prev) => applyPosterPreset(prev, presetId));
  }, []);

  useEffect(() => {
    setSelectedLyricLines((prev) =>
      prev.length > config.maxLyricLines ? prev.slice(0, config.maxLyricLines) : prev
    );
  }, [config.maxLyricLines]);

  const handleSaveImage = async () => {
    if (!posterRef.current || !currentSong) return;
    setIsGenerating(true);
    try {
      const dataUrl = await toPng(posterRef.current, {
        cacheBust: true,
        quality: 1.0,
        pixelRatio: resolution,
        // Since we scale the container via CSS transform, the actual DOM node remains unscaled (800xH).
        // html-to-image captures the unscaled node, achieving high quality!
      });
      const link = document.createElement("a");
      link.download = createPosterFileName(currentSong.title, config.template);
      link.href = dataUrl;
      link.click();
      toast.success("海报已保存！");
    } catch (error) {
      console.error("Failed to generate poster:", error);
      toast.error("生成海报失败，请重试");
    } finally {
      setIsGenerating(false);
    }
  };

  const toggleLyricLine = useCallback(
    (line: string) => {
      setSelectedLyricLines((prev) => {
        if (prev.includes(line)) return prev.filter((l) => l !== line);
        if (prev.length >= config.maxLyricLines) return prev;
        return [...prev, line];
      });
    },
    [config.maxLyricLines]
  );

  const displayLyric = isEditingLyric
    ? customLyric
    : selectedLyricLines.length > 0
      ? selectedLyricLines.slice(0, config.maxLyricLines).join("\n")
      : selectedLyric;

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 10 }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-[1300px] max-h-[90vh] bg-[#1c1c1e]/95 backdrop-blur-[40px] rounded-3xl border border-white/10 shadow-2xl overflow-hidden flex flex-col"
      >
        <div className="flex items-center justify-between p-6 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center shadow-lg">
              <Share2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-white text-xl font-semibold tracking-wide">海报工坊</h2>
              <p className="text-white/50 text-xs">生成专属音乐卡片</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {currentSong ? (
          <div className="flex flex-1 min-h-0">
            {/* PREVIEW AREA */}
            <div className="flex-1 flex flex-col relative overflow-hidden bg-black/40">
              <div className="absolute top-4 left-4 z-20 bg-black/40 backdrop-blur-md rounded-full px-4 py-2 flex items-center gap-2 border border-white/10">
                <Eye className="w-4 h-4 text-white/70" />
                <span className="text-white/70 text-xs font-medium tracking-widest uppercase">
                  {config.template} PREVIEW
                </span>
              </div>

              <div
                ref={previewContainerRef}
                className="flex-1 w-full h-full flex items-center justify-center overflow-hidden relative"
              >
                <div
                  style={{
                    width: RENDER_WIDTH,
                    height: renderHeight,
                    transform: `scale(${previewScale})`,
                    transformOrigin: "center center",
                    boxShadow: "0 30px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.1)",
                    borderRadius: 32,
                    willChange: "transform",
                  }}
                >
                  <PosterPreview
                    song={currentSong}
                    lyric={displayLyric}
                    config={config}
                    posterRef={posterRef}
                    renderHeight={renderHeight}
                  />
                </div>
              </div>
            </div>

            {/* CONTROLS AREA */}
            <div className="w-[440px] bg-white/5 border-l border-white/10 flex flex-col shrink-0 shadow-2xl z-10">
              <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-8 min-h-0">
                <ControlGroup title="快速预设" icon={Wand2}>
                  <div className="grid grid-cols-2 gap-3">
                    {POSTER_QUICK_PRESETS.map((preset) => {
                      const isActive = Object.entries(preset.config).every(
                        ([key, value]) => config[key as keyof PosterConfig] === value
                      );

                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => applyQuickPreset(preset.id)}
                          title={preset.description}
                          className={`rounded-xl border p-3 text-left transition-all ${
                            isActive
                              ? "border-white/50 bg-white/15 text-white"
                              : "border-white/10 bg-black/20 text-white/70 hover:border-white/25 hover:bg-white/10"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-semibold">{preset.nameZh}</span>
                            {isActive && <CheckCircle2 className="h-4 w-4 text-emerald-300" />}
                          </div>
                          <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-white/45">
                            {preset.descriptionZh}
                          </p>
                        </button>
                      );
                    })}
                  </div>

                  <div className="grid grid-cols-3 gap-2 rounded-2xl border border-white/10 bg-black/20 p-3">
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-white/35">导出</div>
                      <div className="mt-1 text-xs font-semibold text-white">
                        {exportMeta.label}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-white/35">质量</div>
                      <div className="mt-1 text-xs font-semibold text-white">
                        {exportMeta.megapixels.toFixed(2)} MP
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-white/35">检查</div>
                      <div
                        className={`mt-1 text-xs font-semibold ${
                          failedQualityChecks.length === 0 ? "text-emerald-300" : "text-amber-300"
                        }`}
                      >
                        {failedQualityChecks.length === 0
                          ? "Ready"
                          : `${failedQualityChecks.length} issue${
                              failedQualityChecks.length === 1 ? "" : "s"
                            }`}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {qualityChecks.map((check) => {
                      const Icon = check.passed
                        ? CheckCircle2
                        : check.severity === "warning"
                          ? AlertTriangle
                          : Info;

                      return (
                        <div
                          key={check.id}
                          className={`flex items-start gap-2 rounded-xl border px-3 py-2 ${
                            check.passed
                              ? "border-emerald-400/15 bg-emerald-400/5"
                              : check.severity === "warning"
                                ? "border-amber-400/20 bg-amber-400/10"
                                : "border-white/10 bg-white/[0.04]"
                          }`}
                        >
                          <Icon
                            className={`mt-0.5 h-4 w-4 shrink-0 ${
                              check.passed
                                ? "text-emerald-300"
                                : check.severity === "warning"
                                  ? "text-amber-300"
                                  : "text-white/45"
                            }`}
                          />
                          <div className="min-w-0">
                            <div className="text-xs font-medium text-white/80">{check.labelZh}</div>
                            <div className="mt-0.5 text-[11px] leading-relaxed text-white/45">
                              {check.detailZh}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ControlGroup>

                {/* TEMPLATE SELECTION */}
                <ControlGroup title="模板风格" icon={LayoutTemplate}>
                  <div className="grid grid-cols-2 gap-3">
                    {POSTER_TEMPLATE_META.map((tpl) => (
                      <button
                        key={tpl.id}
                        onClick={() => updateConfig("template", tpl.id)}
                        className={`relative overflow-hidden rounded-xl p-3 flex flex-col items-start gap-2 transition-all border ${
                          config.template === tpl.id
                            ? "border-pink-500 shadow-[0_0_20px_rgba(236,72,153,0.3)] bg-white/10"
                            : "border-white/10 hover:border-white/30 bg-black/20 hover:bg-white/5"
                        }`}
                      >
                        <div
                          className={`w-full h-10 rounded-lg bg-gradient-to-br ${tpl.gradient} opacity-80 flex items-center justify-center text-xl`}
                        >
                          {tpl.icon}
                        </div>
                        <span
                          className={`text-xs font-semibold ${config.template === tpl.id ? "text-white" : "text-white/70"}`}
                        >
                          {tpl.nameZh}
                        </span>
                      </button>
                    ))}
                  </div>
                </ControlGroup>

                {/* THEME COLOR */}
                {getTemplateMeta(config.template).supportsThemeColor && (
                  <ControlGroup title="主题色彩" icon={Palette}>
                    <div className="flex gap-3 flex-wrap">
                      {POSTER_THEME_COLORS.map((color) => (
                        <button
                          key={color}
                          onClick={() => updateConfig("primaryColor", color)}
                          className={`w-8 h-8 rounded-full border-2 transition-all ${config.primaryColor === color ? "border-white scale-110 shadow-lg" : "border-transparent opacity-60 hover:opacity-100"}`}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                      <div className="relative w-8 h-8 rounded-full overflow-hidden border-2 border-white/30 opacity-80 hover:opacity-100 transition-opacity">
                        <input
                          type="color"
                          value={config.primaryColor}
                          onChange={(e) => updateConfig("primaryColor", e.target.value)}
                          className="absolute inset-[-10px] w-12 h-12 cursor-pointer border-0 p-0"
                        />
                      </div>
                    </div>
                  </ControlGroup>
                )}

                {/* IMAGE CONTROLS */}
                <ControlGroup title="封面构图" icon={ImagePlus}>
                  <GlassSlider
                    label="封面缩放"
                    value={config.coverScale}
                    min={0.3}
                    max={2.5}
                    step={0.01}
                    onChange={(v: number) => updateConfig("coverScale", v)}
                  />
                  <GlassSlider
                    label="垂直位移"
                    value={config.coverYOffset}
                    min={-4}
                    max={4}
                    step={0.01}
                    onChange={(v: number) => updateConfig("coverYOffset", v)}
                  />
                  <GlassSlider
                    label="圆角半径"
                    value={config.coverRadius}
                    min={0}
                    max={2}
                    step={0.01}
                    onChange={(v: number) => updateConfig("coverRadius", v)}
                  />
                </ControlGroup>

                {/* TYPOGRAPHY */}
                <ControlGroup title="文字排版" icon={Type}>
                  <GlassSlider
                    label="标题大小"
                    value={config.titleSize}
                    min={0.1}
                    max={3}
                    step={0.01}
                    onChange={(v: number) => updateConfig("titleSize", v)}
                  />
                  <GlassSlider
                    label="标题垂直位移"
                    value={config.titleYOffset}
                    min={-3}
                    max={3}
                    step={0.01}
                    onChange={(v: number) => updateConfig("titleYOffset", v)}
                  />
                  <GlassSlider
                    label="歌手名透明度"
                    value={config.artistOpacity}
                    min={0}
                    max={1}
                    step={0.01}
                    onChange={(v: number) => updateConfig("artistOpacity", v)}
                  />
                  <GlassSlider
                    label="歌词字号"
                    value={config.lyricSize}
                    min={0.2}
                    max={3}
                    step={0.01}
                    onChange={(v: number) => updateConfig("lyricSize", v)}
                  />
                  <ControlGroup title="歌词排版" icon={Type}>
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={config.lyricAlignment}
                        onChange={(e) => updateConfig("lyricAlignment", e.target.value as any)}
                        className="bg-black/30 text-white/80 text-sm rounded-lg p-2 border border-white/10 outline-none"
                      >
                        <option value="left">左对齐</option>
                        <option value="center">居中对齐</option>
                        <option value="right">右对齐</option>
                      </select>
                      <select
                        value={config.lyricFont}
                        onChange={(e) => updateConfig("lyricFont", e.target.value as any)}
                        className="bg-black/30 text-white/80 text-sm rounded-lg p-2 border border-white/10 outline-none"
                      >
                        <option value="sans">黑体 (无衬线)</option>
                        <option value="serif">宋体 (衬线)</option>
                        <option value="mono">等宽字体</option>
                        <option value="cursive">手写体</option>
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={config.textEffect}
                        onChange={(e) => updateConfig("textEffect", e.target.value as any)}
                        className="bg-black/30 text-white/80 text-sm rounded-lg p-2 border border-white/10 outline-none"
                      >
                        <option value="none">无文字特效</option>
                        <option value="shadow">基础阴影</option>
                        <option value="glow">发光 (Glow)</option>
                        <option value="neon">霓虹 (Neon)</option>
                        <option value="stroke">描边 (Stroke)</option>
                      </select>
                      <div className="flex items-center gap-2">
                        <span className="text-white/60 text-xs whitespace-nowrap">颜色</span>
                        <input
                          type="color"
                          value={config.lyricColor}
                          onChange={(e) => updateConfig("lyricColor", e.target.value)}
                          className="w-full h-8 rounded border-none p-0 cursor-pointer"
                        />
                      </div>
                    </div>
                    <GlassSlider
                      label="行间距"
                      value={config.lineSpacing}
                      min={0.8}
                      max={2.5}
                      step={0.05}
                      onChange={(v: number) => updateConfig("lineSpacing", v)}
                    />
                    <GlassSlider
                      label="最大行数"
                      value={config.maxLyricLines}
                      min={1}
                      max={10}
                      step={1}
                      onChange={(v: number) => updateConfig("maxLyricLines", v)}
                    />
                  </ControlGroup>
                </ControlGroup>

                {/* ATMOSPHERE */}
                {config.template === "apple" && (
                  <ControlGroup title="滤镜与氛围" icon={Activity}>
                    <GlassSlider
                      label="背景模糊"
                      value={config.blurIntensity}
                      min={0}
                      max={3}
                      step={0.01}
                      onChange={(v: number) => updateConfig("blurIntensity", v)}
                    />
                    <GlassSlider
                      label="暗角与遮罩"
                      value={config.overlayDepth}
                      min={0}
                      max={1}
                      step={0.01}
                      onChange={(v: number) => updateConfig("overlayDepth", v)}
                    />
                  </ControlGroup>
                )}

                <ControlGroup title="胶片材质" icon={Disc3}>
                  <GlassSlider
                    label="噪点纹理透明度"
                    value={config.noiseOpacity}
                    min={0}
                    max={1}
                    step={0.01}
                    onChange={(v: number) => updateConfig("noiseOpacity", v)}
                  />
                </ControlGroup>

                {/* DECORATIONS */}
                <ControlGroup title="装饰元素" icon={Box}>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 text-white/80 text-sm cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={config.showWaveform}
                        onChange={(e) => updateConfig("showWaveform", e.target.checked)}
                        className="rounded border-white/20 bg-black/20 text-pink-500 focus:ring-pink-500"
                      />
                      显示音频波形
                    </label>
                    <label className="flex items-center gap-2 text-white/80 text-sm cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={config.showQRCode}
                        onChange={(e) => updateConfig("showQRCode", e.target.checked)}
                        className="rounded border-white/20 bg-black/20 text-pink-500 focus:ring-pink-500"
                      />
                      显示二维码徽标
                    </label>
                  </div>
                </ControlGroup>

                {/* LYRICS MULTI-SELECT */}
                <ControlGroup title="歌词摘录" icon={Edit3}>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-white/50">
                        {isEditingLyric
                          ? "手动输入"
                          : `已选 ${selectedLyricLines.length}/${config.maxLyricLines} 行`}
                      </span>
                      <button
                        onClick={() => setIsEditingLyric(!isEditingLyric)}
                        className="text-xs text-pink-400 hover:text-pink-300 transition-colors"
                      >
                        {isEditingLyric ? "切换多选模式" : "切换自定义输入"}
                      </button>
                    </div>

                    {isEditingLyric ? (
                      <textarea
                        value={customLyric}
                        onChange={(e) => setCustomLyric(e.target.value)}
                        placeholder="输入打动你的金句，每行一句..."
                        className="w-full h-28 p-3 rounded-xl bg-black/20 border border-white/10 text-white placeholder-white/30 text-sm focus:outline-none focus:border-pink-500 resize-none custom-scrollbar"
                      />
                    ) : (
                      <div className="max-h-[400px] overflow-y-auto custom-scrollbar space-y-1.5">
                        {parsedLyrics.length > 0 ? (
                          parsedLyrics.map((line, index) => {
                            const isSelected = selectedLyricLines.includes(line);
                            const isDisabled =
                              !isSelected && selectedLyricLines.length >= config.maxLyricLines;
                            return (
                              <label
                                key={index}
                                className={`flex items-start gap-2.5 p-2 rounded-lg cursor-pointer transition-all text-left ${
                                  isSelected
                                    ? "bg-pink-500/15 border border-pink-500/40"
                                    : isDisabled
                                      ? "opacity-40 cursor-not-allowed border border-transparent"
                                      : "hover:bg-white/5 border border-transparent hover:border-white/10"
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  disabled={isDisabled}
                                  onChange={() => toggleLyricLine(line)}
                                  className="mt-0.5 rounded border-white/20 bg-black/20 text-pink-500 focus:ring-pink-500 shrink-0"
                                />
                                <span
                                  className={`text-xs leading-relaxed ${isSelected ? "text-pink-300" : "text-white/70"}`}
                                >
                                  {line}
                                </span>
                              </label>
                            );
                          })
                        ) : (
                          <p className="text-white/40 text-sm italic py-2">
                            当前歌曲没有可用的内置歌词
                          </p>
                        )}
                      </div>
                    )}

                    {selectedLyricLines.length > 0 && !isEditingLyric && (
                      <button
                        onClick={() => setSelectedLyricLines([])}
                        className="text-xs text-white/40 hover:text-white/70 transition-colors"
                      >
                        清空已选歌词
                      </button>
                    )}
                  </div>
                </ControlGroup>

                {/* EXPORT SETTINGS */}
                <div className="pt-4 border-t border-white/10 space-y-4">
                  <div className="flex gap-2">
                    {POSTER_ASPECT_RATIO_PRESETS.map((preset) => (
                      <button
                        key={preset.nameZh}
                        onClick={() => updateConfig("aspectRatio", preset.value)}
                        className={`px-2 py-2 rounded-lg text-xs transition-all flex-1 ${
                          Math.abs(config.aspectRatio - preset.value) < 0.01
                            ? "bg-white/20 text-white font-medium"
                            : "bg-black/20 text-white/50 hover:bg-white/10"
                        }`}
                      >
                        {preset.nameZh}
                      </button>
                    ))}
                  </div>

                  <div className="flex gap-2">
                    {POSTER_RESOLUTION_PRESETS.map((preset) => (
                      <button
                        key={preset.pixelRatio}
                        onClick={() => setResolution(preset.pixelRatio)}
                        className={`px-2 py-2 rounded-lg text-xs transition-all flex-1 ${
                          resolution === preset.pixelRatio
                            ? "bg-white/20 text-white font-medium shadow-lg"
                            : "bg-black/20 text-white/50 hover:bg-white/10"
                        }`}
                      >
                        {preset.labelZh}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* ACTION BUTTONS */}
              <div className="p-6 border-t border-white/10 bg-white/5 shrink-0 space-y-3">
                <button
                  onClick={() => setConfig(DEFAULT_POSTER_CONFIG)}
                  className="w-full py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 text-sm font-medium transition-all flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  恢复默认参数
                </button>

                <div className="flex gap-3">
                  <button
                    onClick={async () => {
                      if (!posterRef.current || !currentSong) return;
                      try {
                        const dataUrl = await toPng(posterRef.current, {
                          cacheBust: true,
                          quality: 1.0,
                          pixelRatio: resolution,
                        });
                        const res = await fetch(dataUrl);
                        const blob = await res.blob();
                        await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
                        setCopied(true);
                        toast.success("已复制到剪贴板！");
                        setTimeout(() => setCopied(false), 2000);
                      } catch {
                        toast.error("复制失败，请使用下载按钮");
                      }
                    }}
                    className="flex-1 py-4 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold tracking-wide transition-all flex items-center justify-center gap-2 border border-white/10"
                  >
                    {copied ? (
                      <>
                        <Check className="w-5 h-5 text-green-400" /> 已复制
                      </>
                    ) : (
                      <>
                        <Clipboard className="w-5 h-5" /> 复制
                      </>
                    )}
                  </button>

                  <button
                    onClick={handleSaveImage}
                    disabled={isGenerating}
                    className="flex-[2] py-4 rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white font-bold tracking-wide transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-[0_0_20px_rgba(236,72,153,0.3)]"
                  >
                    {isGenerating ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />{" "}
                        生成中...
                      </>
                    ) : (
                      <>
                        <Download className="w-5 h-5" /> 导出海报
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center py-12">
            <Music className="w-16 h-16 text-white/20 mb-4" />
            <h3 className="text-white font-medium text-lg">暂无音乐</h3>
            <p className="text-white/40 text-sm mt-2">请先播放一首你喜欢的音乐，再来生成专属卡片</p>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
};
