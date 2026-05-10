import { Song } from "@/types/song";
import { validateSongsBatch, ValidationResult } from "./songValidation";

export interface ImportResult {
  success: boolean;
  songs: Song[];
  errors: string[];
  totalCount: number;
  successCount: number;
}

export const exportSongsToJSON = (songs: Song[]): string => {
  const data = {
    version: "1.0",
    exportDate: new Date().toISOString(),
    songCount: songs.length,
    songs: songs.map((song) => ({
      ...song,
      durationFormatted: formatDuration(song.duration),
    })),
  };
  return JSON.stringify(data, null, 2);
};

export const exportSongsToCSV = (songs: Song[]): string => {
  const headers = [
    "ID",
    "标题",
    "艺术家",
    "专辑",
    "时长(秒)",
    "时长(格式化)",
    "封面URL",
    "音频URL",
    "歌词",
    "来源",
  ];
  const rows = songs.map((song) => [
    song.id,
    song.title,
    song.artist,
    song.album || "",
    song.duration.toString(),
    formatDuration(song.duration),
    song.cover,
    song.audioUrl || "",
    song.lyrics ? "[有歌词]" : "",
    song.source || "local",
  ]);

  const escapeCSV = (value: string): string => {
    if (value.includes(",") || value.includes('"') || value.includes("\n")) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  };

  return [headers.join(","), ...rows.map((row) => row.map(escapeCSV).join(","))].join("\n");
};

export const importSongsFromJSON = (jsonString: string): ImportResult => {
  const result: ImportResult = {
    success: false,
    songs: [],
    errors: [],
    totalCount: 0,
    successCount: 0,
  };

  try {
    const data = JSON.parse(jsonString);
    const songs = data.songs || data;

    if (!Array.isArray(songs)) {
      result.errors.push("数据格式错误：歌曲数据必须是数组");
      return result;
    }

    result.totalCount = songs.length;

    const validationResults = validateSongsBatch(songs);

    validationResults.forEach((validation, index) => {
      if (validation.isValid) {
        const song = songs[index] as Song;
        result.songs.push({
          ...song,
          source: song.source || "imported",
        });
        result.successCount++;
      } else {
        result.errors.push(...validation.errors.map((e) => e.message));
      }
    });

    result.success = result.successCount > 0;
  } catch (error) {
    result.errors.push(`JSON解析错误: ${error instanceof Error ? error.message : "未知错误"}`);
  }

  return result;
};

export const importSongsFromCSV = (csvString: string): ImportResult => {
  const result: ImportResult = {
    success: false,
    songs: [],
    errors: [],
    totalCount: 0,
    successCount: 0,
  };

  try {
    const lines = csvString.trim().split("\n");
    if (lines.length < 2) {
      result.errors.push("CSV数据格式错误：至少需要包含表头和一行数据");
      return result;
    }

    const headers = parseCSVLine(lines[0]);
    const songs: Partial<Song>[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      const song: Partial<Song> = {
        id: values[0] || "",
        title: values[1] || "",
        artist: values[2] || "",
        album: values[3] || undefined,
        duration: parseInt(values[4]) || 0,
        cover: values[6] || "",
        audioUrl: values[7] || "",
        lyrics: values[8] || undefined,
        source: (values[9] as Song["source"]) || "imported",
      };
      songs.push(song);
    }

    result.totalCount = songs.length;

    const validationResults = validateSongsBatch(songs);

    validationResults.forEach((validation, index) => {
      if (validation.isValid) {
        result.songs.push(songs[index] as Song);
        result.successCount++;
      } else {
        result.errors.push(...validation.errors.map((e) => e.message));
      }
    });

    result.success = result.successCount > 0;
  } catch (error) {
    result.errors.push(`CSV解析错误: ${error instanceof Error ? error.message : "未知错误"}`);
  }

  return result;
};

const parseCSVLine = (line: string): string[] => {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  values.push(current.trim());
  return values;
};

const formatDuration = (seconds: number): string => {
  if (!seconds || seconds < 0) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

export const downloadFile = (content: string, filename: string, mimeType: string): void => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const readFileAsText = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = (e) => reject(e);
    reader.readAsText(file);
  });
};
