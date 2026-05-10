"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Song } from "@/types/song";
import {
  validateSong,
  ValidationError,
  formatDuration,
  parseDuration,
  generateSongId,
} from "@/utils/songValidation";
import Image from "next/image";

interface SongEditFormProps {
  song?: Song | null;
  onSave: (song: Song) => void;
  onCancel: () => void;
}

const initialSong: Partial<Song> = {
  id: "",
  title: "",
  artist: "",
  album: "",
  cover: "",
  audioUrl: "",
  lyrics: "",
  duration: 0,
  source: "local",
};

export const SongEditForm: React.FC<SongEditFormProps> = ({ song, onSave, onCancel }) => {
  const [formData, setFormData] = useState<Partial<Song>>(initialSong);
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [durationInput, setDurationInput] = useState("0:00");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (song) {
      setFormData(song);
      setDurationInput(formatDuration(song.duration));
    } else {
      setFormData({ ...initialSong, id: generateSongId() });
      setDurationInput("0:00");
    }
    setErrors([]);
  }, [song]);

  const handleChange = (field: keyof Song, value: string | number) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => prev.filter((e) => e.field !== field));
  };

  const handleDurationChange = (value: string) => {
    setDurationInput(value);
    const seconds = parseDuration(value);
    setFormData((prev) => ({ ...prev, duration: seconds }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const validation = validateSong(formData);
    if (!validation.isValid) {
      setErrors(validation.errors);
      setIsSubmitting(false);
      return;
    }

    onSave(formData as Song);
    setIsSubmitting(false);
  };

  const getFieldError = (field: string): string | undefined => {
    return errors.find((e) => e.field === field)?.message;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="bg-white/10 backdrop-blur-xl rounded-2xl p-6 border border-white/20"
    >
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-white">{song ? "编辑歌曲" : "添加新歌曲"}</h2>
        <button onClick={onCancel} className="text-white/60 hover:text-white transition-colors">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-white/80 mb-1">
              歌曲ID <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={formData.id}
              onChange={(e) => handleChange("id", e.target.value)}
              disabled={!!song}
              className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-white/50 disabled:opacity-50"
              placeholder="song-001"
            />
            {getFieldError("id") && (
              <p className="mt-1 text-sm text-red-400">{getFieldError("id")}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-white/80 mb-1">
              歌曲标题 <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => handleChange("title", e.target.value)}
              className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-white/50"
              placeholder="输入歌曲标题"
            />
            {getFieldError("title") && (
              <p className="mt-1 text-sm text-red-400">{getFieldError("title")}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-white/80 mb-1">
              艺术家 <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={formData.artist}
              onChange={(e) => handleChange("artist", e.target.value)}
              className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-white/50"
              placeholder="输入艺术家名称"
            />
            {getFieldError("artist") && (
              <p className="mt-1 text-sm text-red-400">{getFieldError("artist")}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-white/80 mb-1">专辑</label>
            <input
              type="text"
              value={formData.album}
              onChange={(e) => handleChange("album", e.target.value)}
              className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-white/50"
              placeholder="输入专辑名称"
            />
            {getFieldError("album") && (
              <p className="mt-1 text-sm text-red-400">{getFieldError("album")}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-white/80 mb-1">时长 (MM:SS)</label>
            <input
              type="text"
              value={durationInput}
              onChange={(e) => handleDurationChange(e.target.value)}
              className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-white/50"
              placeholder="3:45"
            />
            {getFieldError("duration") && (
              <p className="mt-1 text-sm text-red-400">{getFieldError("duration")}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-white/80 mb-1">来源</label>
            <select
              value={formData.source}
              onChange={(e) => handleChange("source", e.target.value)}
              className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white focus:outline-none focus:border-white/50"
            >
              <option value="local" className="bg-gray-800">
                本地
              </option>
              <option value="demo" className="bg-gray-800">
                演示
              </option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-white/80 mb-1">
            封面图片URL <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={formData.cover}
            onChange={(e) => handleChange("cover", e.target.value)}
            className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-white/50"
            placeholder="https://example.com/cover.jpg"
          />
          {getFieldError("cover") && (
            <p className="mt-1 text-sm text-red-400">{getFieldError("cover")}</p>
          )}
          {formData.cover && !getFieldError("cover") && (
            <div className="mt-2 relative w-24 h-24 rounded-lg overflow-hidden">
              <Image
                src={formData.cover}
                alt="封面预览"
                fill
                className="object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = "https://via.placeholder.com/96";
                }}
              />
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-white/80 mb-1">音频URL</label>
          <input
            type="text"
            value={formData.audioUrl}
            onChange={(e) => handleChange("audioUrl", e.target.value)}
            className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-white/50"
            placeholder="https://example.com/audio.mp3"
          />
          {getFieldError("audioUrl") && (
            <p className="mt-1 text-sm text-red-400">{getFieldError("audioUrl")}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-white/80 mb-1">歌词</label>
          <textarea
            value={formData.lyrics}
            onChange={(e) => handleChange("lyrics", e.target.value)}
            rows={4}
            className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-white/50 resize-none"
            placeholder="[00:00.000]歌词内容..."
          />
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
          >
            取消
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-2 bg-gradient-to-r from-pink-500 to-violet-500 hover:from-pink-600 hover:to-violet-600 text-white rounded-lg transition-all disabled:opacity-50"
          >
            {isSubmitting ? "保存中..." : song ? "保存修改" : "添加歌曲"}
          </button>
        </div>
      </form>
    </motion.div>
  );
};
