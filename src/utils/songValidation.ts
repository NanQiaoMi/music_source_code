import { Song } from "@/store/playlistStore";

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

export const validateSong = (song: Partial<Song>): ValidationResult => {
  const errors: ValidationError[] = [];

  if (!song.id || song.id.trim() === "") {
    errors.push({ field: "id", message: "歌曲ID不能为空" });
  } else if (!/^[a-zA-Z0-9-_]+$/.test(song.id)) {
    errors.push({ field: "id", message: "歌曲ID只能包含字母、数字、横线和下划线" });
  }

  if (!song.title || song.title.trim() === "") {
    errors.push({ field: "title", message: "歌曲标题不能为空" });
  } else if (song.title.length > 100) {
    errors.push({ field: "title", message: "歌曲标题不能超过100个字符" });
  }

  if (!song.artist || song.artist.trim() === "") {
    errors.push({ field: "artist", message: "艺术家名称不能为空" });
  } else if (song.artist.length > 100) {
    errors.push({ field: "artist", message: "艺术家名称不能超过100个字符" });
  }

  if (song.album && song.album.length > 100) {
    errors.push({ field: "album", message: "专辑名称不能超过100个字符" });
  }

  if (!song.cover || song.cover.trim() === "") {
    errors.push({ field: "cover", message: "封面图片URL不能为空" });
  } else {
    try {
      new URL(song.cover);
    } catch {
      errors.push({ field: "cover", message: "封面图片URL格式不正确" });
    }
  }

  if (song.audioUrl) {
    try {
      new URL(song.audioUrl);
    } catch {
      errors.push({ field: "audioUrl", message: "音频URL格式不正确" });
    }
  }

  if (song.duration !== undefined) {
    if (typeof song.duration !== "number" || song.duration < 0) {
      errors.push({ field: "duration", message: "时长必须是正数" });
    } else if (song.duration > 36000) {
      errors.push({ field: "duration", message: "时长不能超过10小时" });
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

export const validateSongsBatch = (songs: Partial<Song>[]): ValidationResult[] => {
  return songs.map((song, index) => {
    const result = validateSong(song);
    if (!result.isValid) {
      result.errors = result.errors.map((err) => ({
        ...err,
        message: `第${index + 1}首歌曲: ${err.message}`,
      }));
    }
    return result;
  });
};

export const formatDuration = (seconds: number): string => {
  if (!seconds || seconds < 0) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

export const parseDuration = (timeStr: string): number => {
  const parts = timeStr.split(":").map(Number);
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  } else if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  return 0;
};

export const generateSongId = (): string => {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 5);
  return `song-${timestamp}-${random}`;
};
