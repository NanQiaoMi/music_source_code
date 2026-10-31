import type { Song } from "@/types/song";

export const MISSING_AUDIO_SOURCE_MESSAGE =
  "这首歌还没有可播放的音频文件。请先导入本地音乐，或选择资料库中已有音频源的歌曲。";

export const MISSING_AUDIO_SOURCE_HELP_TEXT = "请导入本地音乐，或选择资料库中已有音频源的歌曲。";

export const AUDIO_FILE_UNAVAILABLE_MESSAGE = "Audio file is not available.";

type AudioSourceSong =
  | (Partial<Pick<Song, "audioUrl" | "id" | "title">> & { source?: string })
  | null
  | undefined;
type MediaElementErrorLike = Pick<MediaError, "code" | "message"> | null | undefined;

const MEDIA_ERROR_DESCRIPTIONS: Record<number, string> = {
  1: "The audio load was aborted",
  2: "A network error stopped the audio load",
  3: "The audio could not be decoded",
  4: "The audio source is unsupported or unavailable",
};

export function hasPlayableAudioSource(song: AudioSourceSong): boolean {
  if (!song) return false;
  if (song.audioUrl && song.audioUrl.trim().length > 0) return true;
  if (song.source === "demo" || (song.id && String(song.id).startsWith("demo-"))) {
    return false;
  }
  if (song.source === "local" || song.source === "upload") {
    return false;
  }
  // 在线平台音源（netease, qq, kugou, kuwo, qishui, lx_custom 等）支持在播放时动态嗅探解析真实音频流
  return Boolean(
    (song.source &&
      song.source !== "local" &&
      song.source !== "upload" &&
      song.source !== "demo") ||
    (song.id && String(song.id).trim().length > 0 && !String(song.id).startsWith("demo-"))
  );
}

export function describeMediaElementError(error: MediaElementErrorLike): string {
  const code = typeof error?.code === "number" ? error.code : undefined;
  const description = code
    ? MEDIA_ERROR_DESCRIPTIONS[code] || "The audio source could not be loaded"
    : "The audio source could not be loaded";
  const message = error?.message?.trim();
  const codeSuffix = code ? " (code " + code + ")" : "";
  const messageSuffix = message ? ": " + message : "";
  return description + codeSuffix + messageSuffix;
}

export function createMissingAudioSourceError(timestamp = Date.now()) {
  return {
    type: "load" as const,
    message: MISSING_AUDIO_SOURCE_MESSAGE,
    timestamp,
  };
}

export function createAudioElementLoadError(error: MediaElementErrorLike, timestamp = Date.now()) {
  return {
    type: "load" as const,
    message: AUDIO_FILE_UNAVAILABLE_MESSAGE + " " + describeMediaElementError(error),
    timestamp,
  };
}

export function logHandledAudioWarning(label: string, detail: string): void {
  console.warn(label, detail);
}

/**
 * 校验 ArrayBuffer / Uint8Array 是否为合法的音频二进制数据（检查魔数与基本大小）。
 * 能有效拦截将 HTML 错误页 (<!DOCTYPE...)、JSON ({"code":...) 或空字节误当音频保存/播放的情况。
 */
export function isValidAudioData(
  data: ArrayBuffer | ArrayBufferView | null | undefined,
  minSize = 4096
): boolean {
  if (!data) return false;
  const byteLength = "byteLength" in data ? data.byteLength : 0;
  if (byteLength < minSize) return false;

  const buffer = "buffer" in data ? (data as ArrayBufferView).buffer : data;
  const byteOffset = "byteOffset" in data ? (data as ArrayBufferView).byteOffset : 0;
  const bytes = new Uint8Array(buffer, byteOffset, Math.min(byteLength, 64));

  // 1. 明确排除文本/HTML/JSON 响应开头的 ASCII 字符与 UTF-8 BOM
  // UTF-8 BOM: 0xEF 0xBB 0xBF
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return false;
  }

  const firstByte = bytes[0];
  if (
    firstByte === 0x3c || // '<' (<!DOCTYPE, <html>)
    firstByte === 0x7b || // '{' ({"code":...)
    firstByte === 0x5b || // '[' ([{"...)
    firstByte === 0x20 || // ' ' (leading whitespace)
    firstByte === 0x09 || // '\t'
    firstByte === 0x0a || // '\n'
    firstByte === 0x0d // '\r'
  ) {
    return false;
  }

  // 2. 检查常见音频格式魔数 (Magic Numbers)
  // MP3: 'ID3' (0x49 0x44 0x33) 或 MPEG Frame Sync Word (0xFF followed by 0xE0 ~ 0xFF)
  if (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) return true;
  if (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0) return true;

  // FLAC: 'fLaC' (0x66 0x4C 0x61 0x43)
  if (bytes[0] === 0x66 && bytes[1] === 0x4c && bytes[2] === 0x61 && bytes[3] === 0x43) return true;

  // Ogg: 'OggS' (0x4F 0x67 0x67 0x53)
  if (bytes[0] === 0x4f && bytes[1] === 0x67 && bytes[2] === 0x67 && bytes[3] === 0x53) return true;

  // WAV: 'RIFF' .... 'WAVE'
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    byteLength >= 12
  ) {
    if (bytes[8] === 0x57 && bytes[9] === 0x41 && bytes[10] === 0x56 && bytes[11] === 0x45) {
      return true;
    }
  }

  // AIFF: 'FORM' .... 'AIFF' / 'AIFC'
  if (
    bytes[0] === 0x46 &&
    bytes[1] === 0x4f &&
    bytes[2] === 0x52 &&
    bytes[3] === 0x4d &&
    byteLength >= 12
  ) {
    if (
      bytes[8] === 0x41 &&
      bytes[9] === 0x49 &&
      bytes[10] === 0x46 &&
      (bytes[11] === 0x46 || bytes[11] === 0x43)
    ) {
      return true;
    }
  }

  // M4A / AAC / MP4: 'ftyp' at offset 4
  if (byteLength >= 12) {
    if (bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
      return true;
    }
  }

  // DSD: 'DSD ' (0x44 0x53 0x44 0x20)
  if (bytes[0] === 0x44 && bytes[1] === 0x53 && bytes[2] === 0x44 && bytes[3] === 0x20) return true;

  // WebM / Matroska: 0x1A 0x45 0xDF 0xA3
  if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) return true;

  // 未能识别为已知合法音频容器魔数，严格判定为非法或损坏音频
  return false;
}
