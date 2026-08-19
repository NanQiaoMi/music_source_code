import type { Song } from "@/types/song";

export const MISSING_AUDIO_SOURCE_MESSAGE =
  "这首歌还没有可播放的音频文件。请先导入本地音乐，或选择资料库中已有音频源的歌曲。";

export const MISSING_AUDIO_SOURCE_HELP_TEXT = "请导入本地音乐，或选择资料库中已有音频源的歌曲。";

export const AUDIO_FILE_UNAVAILABLE_MESSAGE = "Audio file is not available.";

type AudioSourceSong = Partial<Pick<Song, "audioUrl" | "id">> | null | undefined;
type MediaElementErrorLike = Pick<MediaError, "code" | "message"> | null | undefined;

const MEDIA_ERROR_DESCRIPTIONS: Record<number, string> = {
  1: "The audio load was aborted",
  2: "A network error stopped the audio load",
  3: "The audio could not be decoded",
  4: "The audio source is unsupported or unavailable",
};

export function hasPlayableAudioSource(song: AudioSourceSong): boolean {
  return Boolean(song?.audioUrl?.trim());
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
