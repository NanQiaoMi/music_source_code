"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { usePlaylistStore } from "@/store/playlistStore";
import { Song } from "@/types/song";
import { generateSongId } from "@/utils/songValidation";
import {
  saveMusicFile,
  getAllStoredMusic,
  deleteStoredMusic,
  clearAllStoredMusic,
  StoredMusic,
} from "@/services/localMusicStorage";
import { associateLyricsWithAudioFiles } from "@/services/lyricsService";
import Image from "next/image";

// @ts-ignore - jsmediatags doesn't have proper types
import jsmediatags from "jsmediatags";

// Supported audio formats
const SUPPORTED_AUDIO_FORMATS = [".mp3", ".wav", ".flac", ".aac", ".ogg", ".m4a", ".wma", ".opus"];
const DEFAULT_COVER_SRC = "/default-cover.svg";

interface ProcessingFile {
  file: File;
  status: "pending" | "processing" | "done" | "error";
  error?: string;
}

export const LocalMusicManager: React.FC = () => {
  const { songs, addSong, removeSong, importSongs } = usePlaylistStore();
  const [localSongs, setLocalSongs] = useState<Song[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingFiles, setProcessingFiles] = useState<ProcessingFile[]>([]);
  const [showProcessModal, setShowProcessModal] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  // Load stored music on mount
  useEffect(() => {
    loadStoredMusic();
  }, []);

  const loadStoredMusic = async () => {
    setIsLoading(true);
    try {
      const stored = await getAllStoredMusic();
      const songList: Song[] = stored.map((music) => ({
        id: music.id,
        title: music.title,
        artist: music.artist,
        album: music.album,
        cover:
          music.coverData ||
          "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=600&h=600&fit=crop",
        audioUrl: `stored://${music.id}`, // Special protocol for stored files
        lyrics: music.lyrics, // Include lyrics from stored music
        duration: music.duration,
        source: "local",
      }));

      setLocalSongs(songList);

      // Also add to playlist store if not already there
      const existingIds = new Set(songs.map((s) => s.id));
      const newSongs = songList.filter((s) => !existingIds.has(s.id));
      if (newSongs.length > 0) {
        importSongs(newSongs);
      }
    } catch (error) {
      console.error("Error loading stored music:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const isSupportedAudioFile = (file: File): boolean => {
    const extension = "." + file.name.split(".").pop()?.toLowerCase();
    return SUPPORTED_AUDIO_FORMATS.includes(extension);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const extractMetadata = (
    file: File
  ): Promise<{ title: string; artist: string; album: string; cover?: string }> => {
    return new Promise((resolve) => {
      const fileName = file.name.replace(/\.[^/.]+$/, "");
      const parts = fileName.split(/\s*[-–—]\s*/);

      const defaultResult = {
        title: parts.length >= 2 ? parts[1].trim() : fileName.trim(),
        artist: parts.length >= 2 ? parts[0].trim() : "未知艺术家",
        album: "未知专辑",
      };

      jsmediatags.read(file, {
        onSuccess: async (tag: any) => {
          const tags = tag.tags;
          let coverData: string | undefined;

          if (tags.picture) {
            const { data, format } = tags.picture;
            const byteArray = new Uint8Array(data);
            // Convert to base64 for persistent storage (safe for large arrays)
            let binary = "";
            for (let i = 0; i < byteArray.length; i++) {
              binary += String.fromCharCode(byteArray[i]);
            }
            const base64 = btoa(binary);
            coverData = `data:${format};base64,${base64}`;
          }

          resolve({
            title: tags.title || defaultResult.title,
            artist: tags.artist || defaultResult.artist,
            album: tags.album || defaultResult.album,
            cover: coverData,
          });
        },
        onError: () => resolve(defaultResult),
      });
    });
  };

  const getAudioDuration = (file: File): Promise<number> => {
    return new Promise((resolve) => {
      const audio = new Audio();
      const url = URL.createObjectURL(file);

      audio.addEventListener("loadedmetadata", () => {
        URL.revokeObjectURL(url);
        resolve(audio.duration);
      });

      audio.addEventListener("error", () => {
        URL.revokeObjectURL(url);
        resolve(180);
      });

      setTimeout(() => {
        URL.revokeObjectURL(url);
        resolve(180);
      }, 3000);

      audio.src = url;
    });
  };

  const fileToArrayBuffer = (file: File): Promise<ArrayBuffer> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(file);
    });
  };

  const processFile = async (file: File, lyricsContent?: string): Promise<StoredMusic | null> => {
    try {
      const [metadata, duration, fileData] = await Promise.all([
        extractMetadata(file),
        getAudioDuration(file),
        fileToArrayBuffer(file),
      ]);

      const id = generateSongId();

      return {
        id,
        fileData,
        fileType: file.type || "audio/mpeg",
        fileName: file.name,
        title: metadata.title,
        artist: metadata.artist,
        album: metadata.album,
        duration: Math.round(duration) || 180,
        coverData: metadata.cover,
        lyrics: lyricsContent,
        addedAt: Date.now(),
      };
    } catch (error) {
      console.error("Error processing file:", file.name, error);
      return null;
    }
  };

  const handleFiles = async (files: File[]) => {
    const audioFiles = files.filter(isSupportedAudioFile);
    if (audioFiles.length === 0) return;

    setProcessingFiles(audioFiles.map((f) => ({ file: f, status: "pending" })));
    setShowProcessModal(true);
    setIsProcessing(true);

    // Associate lyrics files with audio files
    let lyricsAssociations: Map<string, string> = new Map();
    try {
      lyricsAssociations = await associateLyricsWithAudioFiles(audioFiles, files);
    } catch (error) {
      console.warn("Failed to associate lyrics files:", error);
    }

    for (let i = 0; i < audioFiles.length; i++) {
      const file = audioFiles[i];

      setProcessingFiles((prev) =>
        prev.map((pf, idx) => (idx === i ? { ...pf, status: "processing" } : pf))
      );

      // Get associated lyrics content if available
      const lyricsContent = lyricsAssociations.get(file.name);

      const storedMusic = await processFile(file, lyricsContent);

      if (storedMusic) {
        try {
          // Save to IndexedDB
          await saveMusicFile(storedMusic);

          // Create song object
          const song: Song = {
            id: storedMusic.id,
            title: storedMusic.title,
            artist: storedMusic.artist,
            album: storedMusic.album,
            cover:
              storedMusic.coverData ||
              "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=600&h=600&fit=crop",
            audioUrl: `stored://${storedMusic.id}`,
            lyrics: lyricsContent,
            duration: storedMusic.duration,
            source: "local",
          };

          // Add to playlist
          addSong(song);

          setProcessingFiles((prev) =>
            prev.map((pf, idx) => (idx === i ? { ...pf, status: "done" } : pf))
          );
        } catch (error) {
          console.error("Error saving file:", error);
          setProcessingFiles((prev) =>
            prev.map((pf, idx) => (idx === i ? { ...pf, status: "error", error: "保存失败" } : pf))
          );
        }
      } else {
        setProcessingFiles((prev) =>
          prev.map((pf, idx) => (idx === i ? { ...pf, status: "error", error: "处理失败" } : pf))
        );
      }
    }

    setIsProcessing(false);

    // Reload songs
    await loadStoredMusic();

    // Auto close after success
    setTimeout(() => {
      setShowProcessModal(false);
      setProcessingFiles([]);
    }, 1500);
  };

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = Array.from(e.dataTransfer.files);
    await handleFiles(files);
  }, []);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    await handleFiles(files);

    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (folderInputRef.current) folderInputRef.current.value = "";
  };

  const handleDelete = async (songId: string) => {
    if (confirm("确定要删除这首本地音乐吗？")) {
      try {
        await deleteStoredMusic(songId);
        removeSong(songId);
        await loadStoredMusic();
      } catch (error) {
        console.error("Error deleting music:", error);
      }
    }
  };

  const handleClearAll = async () => {
    if (confirm(`确定要清空所有 ${localSongs.length} 首本地音乐吗？`)) {
      try {
        await clearAllStoredMusic();
        localSongs.forEach((song) => removeSong(song.id));
        setLocalSongs([]);
      } catch (error) {
        console.error("Error clearing music:", error);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Upload Area */}
      <div
        className={`relative border-2 border-dashed rounded-2xl p-8 text-center transition-all ${
          dragActive ? "border-pink-500 bg-pink-500/10" : "border-white/20 hover:border-white/40"
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <div className="space-y-4">
          <div className="w-16 h-16 mx-auto bg-white/10 rounded-full flex items-center justify-center">
            <svg
              className="w-8 h-8 text-white/60"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
          </div>
          <div>
            <p className="text-white font-medium mb-1">拖拽音乐文件到此处导入</p>
            <p className="text-white/40 text-sm">支持 MP3, WAV, FLAC, AAC, OGG, M4A, WMA 格式</p>
          </div>
          <div className="flex justify-center gap-3">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 bg-pink-500 hover:bg-pink-600 text-white rounded-lg transition-colors"
            >
              选择文件
            </button>
            <button
              onClick={() => folderInputRef.current?.click()}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
            >
              选择文件夹
            </button>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".mp3,.wav,.flac,.aac,.ogg,.m4a,.wma,.opus"
          onChange={handleFileSelect}
          className="hidden"
        />
        <input
          ref={folderInputRef}
          type="file"
          // @ts-ignore
          webkitdirectory=""
          directory=""
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      {/* Stats */}
      <div className="flex justify-between items-center">
        <div className="text-white/60">
          本地音乐库: <span className="text-white font-medium">{localSongs.length}</span> 首
          {isLoading && <span className="text-white/40 ml-2">(加载中...)</span>}
        </div>
        {localSongs.length > 0 && (
          <button
            onClick={handleClearAll}
            className="text-red-400 hover:text-red-300 text-sm transition-colors"
          >
            清空全部
          </button>
        )}
      </div>

      {/* Song List */}
      <div className="space-y-2 max-h-[400px] overflow-y-auto custom-scrollbar min-h-0">
        {isLoading ? (
          <div className="text-center py-12 text-white/40">
            <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-4" />
            <p>正在加载本地音乐...</p>
          </div>
        ) : (
          <AnimatePresence>
            {localSongs.map((song, index) => (
              <motion.div
                key={song.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -100 }}
                transition={{ delay: index * 0.03 }}
                className="flex items-center gap-3 p-3 bg-white/5 hover:bg-white/10 rounded-xl transition-colors group"
              >
                <div className="relative w-12 h-12 rounded-lg overflow-hidden flex-shrink-0">
                  <Image
                    src={song.cover || DEFAULT_COVER_SRC}
                    alt={song.title}
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-white font-medium truncate">{song.title}</h4>
                  <p className="text-white/50 text-sm truncate">{song.artist}</p>
                </div>
                <span className="text-white/40 text-sm">
                  {Math.floor(song.duration / 60)}:
                  {(song.duration % 60).toString().padStart(2, "0")}
                </span>
                <button
                  onClick={() => handleDelete(song.id)}
                  className="p-2 text-white/40 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        )}

        {!isLoading && localSongs.length === 0 && (
          <div className="text-center py-12 text-white/40">
            <svg
              className="w-16 h-16 mx-auto mb-4 opacity-30"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
              />
            </svg>
            <p>暂无本地音乐</p>
            <p className="text-sm mt-1">导入音乐文件开始构建您的音乐库</p>
            <p className="text-xs mt-2 text-white/30">音乐将保存在浏览器本地存储中</p>
          </div>
        )}
      </div>

      {/* Processing Modal */}
      <AnimatePresence>
        {showProcessModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-gray-900 rounded-2xl p-6 max-w-md w-full mx-4 border border-white/20"
            >
              <h3 className="text-xl font-semibold text-white mb-4">导入音乐</h3>

              <div className="space-y-2 mb-4 max-h-60 overflow-y-auto custom-scrollbar min-h-0">
                {processingFiles.map((pf, index) => (
                  <div key={index} className="flex items-center gap-3 p-2 bg-white/5 rounded-lg">
                    {pf.status === "pending" && (
                      <div className="w-5 h-5 rounded-full border-2 border-white/20" />
                    )}
                    {pf.status === "processing" && (
                      <div className="w-5 h-5 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" />
                    )}
                    {pf.status === "done" && (
                      <svg
                        className="w-5 h-5 text-green-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    )}
                    {pf.status === "error" && (
                      <svg
                        className="w-5 h-5 text-red-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm truncate">{pf.file.name}</p>
                      <p className="text-white/40 text-xs">{formatFileSize(pf.file.size)}</p>
                    </div>
                  </div>
                ))}
              </div>

              {!isProcessing && (
                <button
                  onClick={() => {
                    setShowProcessModal(false);
                    setProcessingFiles([]);
                  }}
                  className="w-full px-4 py-2 bg-pink-500 hover:bg-pink-600 text-white rounded-lg transition-colors"
                >
                  完成
                </button>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
