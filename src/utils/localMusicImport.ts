import { Song } from "@/types/song";
import { generateSongId } from "./songValidation";
import { associateLyricsWithAudioFiles } from "@/services/lyricsService";
import { saveMusicFile, StoredMusic } from "@/services/localMusicStorage";

import jsmediatags, { type MediaTagResult } from "jsmediatags";

export interface LocalImportResult {
  success: boolean;
  songs: Song[];
  errors: string[];
  totalCount: number;
  successCount: number;
}

const SUPPORTED_AUDIO_FORMATS = [".mp3", ".wav", ".flac", ".aac", ".ogg", ".m4a", ".wma", ".opus"];
const SUPPORTED_IMAGE_FORMATS = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp"];

function splitFilename(fileName: string) {
  const name = fileName.replace(/\.[^/.]+$/, "").trim();
  const parts = name.split(/\s*[-–—]\s*/);
  if (parts.length >= 2) {
    return { artist: parts[0].trim(), title: parts.slice(1).join(" - ").trim() };
  }
  return { artist: "Unknown Artist", title: name || fileName };
}

function extractMetadata(file: File): Promise<{
  title: string;
  artist: string;
  album: string;
  duration: number;
  cover?: string;
}> {
  return new Promise((resolve) => {
    const fallback = { ...splitFilename(file.name), album: "Unknown Album", duration: 0 };
    jsmediatags.read(file, {
      onSuccess: (tag: MediaTagResult) => {
        const tags = tag.tags || {};
        let cover: string | undefined;
        if (tags.picture) {
          const { data, format } = tags.picture;
          const bytes = new Uint8Array(data);
          const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
          cover = `data:${format};base64,${btoa(binary)}`;
        }
        resolve({
          title: tags.title || fallback.title,
          artist: tags.artist || fallback.artist,
          album: tags.album || fallback.album,
          duration: 0,
          cover,
        });
      },
      onError: () => resolve(fallback),
    });
  });
}

function getAudioDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const audio = new Audio();
    const url = URL.createObjectURL(file);
    const cleanup = () => URL.revokeObjectURL(url);
    audio.addEventListener("loadedmetadata", () => {
      const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
      cleanup();
      resolve(duration);
    });
    audio.addEventListener("error", () => {
      cleanup();
      resolve(0);
    });
    setTimeout(() => {
      cleanup();
      resolve(0);
    }, 5000);
    audio.src = url;
  });
}

function fileToArrayBuffer(file: File): Promise<ArrayBuffer> {
  return file.arrayBuffer();
}

function findCoverImage(audioFile: File, imageFiles: File[]): File | undefined {
  const audioName = audioFile.name.replace(/\.[^/.]+$/, "").toLowerCase();
  return imageFiles.find((imageFile) => {
    const imageName = imageFile.name.replace(/\.[^/.]+$/, "").toLowerCase();
    return (
      imageName === audioName ||
      imageName === `${audioName}_cover` ||
      imageName === `${audioName}_art` ||
      imageName === "cover" ||
      imageName === "folder" ||
      imageName.includes(audioName) ||
      audioName.includes(imageName)
    );
  });
}

async function processAudioFile(
  file: File,
  coverFile?: File,
  lyricsContent?: string
): Promise<Song | null> {
  const extension = `.${file.name.split(".").pop()?.toLowerCase()}`;
  if (!SUPPORTED_AUDIO_FORMATS.includes(extension)) return null;

  try {
    const [metadata, duration, fileData] = await Promise.all([
      extractMetadata(file),
      getAudioDuration(file),
      fileToArrayBuffer(file),
    ]);
    let cover = metadata.cover;
    if (!cover && coverFile) cover = URL.createObjectURL(coverFile);
    if (!cover)
      cover = "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=600&h=600&fit=crop";

    const id = generateSongId();
    const roundedDuration = Math.round(duration) || 180;
    const addedAt = Date.now();
    const storedMusic: StoredMusic = {
      id,
      fileData,
      fileType: file.type || "audio/mpeg",
      fileName: file.name,
      title: metadata.title || file.name,
      artist: metadata.artist || "Unknown Artist",
      album: metadata.album || "Unknown Album",
      duration: roundedDuration,
      coverData: metadata.cover,
      lyrics: lyricsContent,
      addedAt,
    };

    await saveMusicFile(storedMusic);

    return {
      id,
      title: storedMusic.title,
      artist: storedMusic.artist,
      album: storedMusic.album,
      cover,
      audioUrl: `stored://${id}`,
      lyrics: lyricsContent,
      duration: roundedDuration,
      source: "local",
      format: extension.replace(/^\./, ""),
      fileSize: file.size,
      addedAt,
    };
  } catch (error) {
    console.error("Error processing file:", file.name, error);
    return null;
  }
}

export async function importLocalSongs(files: FileList): Promise<LocalImportResult> {
  const result: LocalImportResult = {
    success: false,
    songs: [],
    errors: [],
    totalCount: 0,
    successCount: 0,
  };

  const audioFiles: File[] = [];
  const imageFiles: File[] = [];
  const allFiles: File[] = [];

  for (let index = 0; index < files.length; index++) {
    const file = files[index];
    const extension = `.${file.name.split(".").pop()?.toLowerCase()}`;
    allFiles.push(file);
    if (SUPPORTED_AUDIO_FORMATS.includes(extension)) audioFiles.push(file);
    if (SUPPORTED_IMAGE_FORMATS.includes(extension)) imageFiles.push(file);
  }

  result.totalCount = audioFiles.length;
  if (audioFiles.length === 0) {
    result.errors.push("未找到支持的音频文件。支持格式：mp3, wav, flac, aac, ogg, m4a, wma, opus");
    return result;
  }

  let lyricsAssociations = new Map<string, string>();
  try {
    lyricsAssociations = await associateLyricsWithAudioFiles(audioFiles, allFiles);
  } catch (error) {
    console.warn("Failed to associate lyrics files:", error);
  }

  for (const audioFile of audioFiles) {
    try {
      const song = await processAudioFile(
        audioFile,
        findCoverImage(audioFile, imageFiles),
        lyricsAssociations.get(audioFile.name)
      );
      if (song) {
        result.songs.push(song);
        result.successCount++;
      } else {
        result.errors.push(`导入失败: ${audioFile.name}`);
      }
    } catch (error) {
      result.errors.push(
        `导入失败 - ${audioFile.name}: ${error instanceof Error ? error.message : "未知错误"}`
      );
    }
  }

  result.success = result.successCount > 0;
  return result;
}
