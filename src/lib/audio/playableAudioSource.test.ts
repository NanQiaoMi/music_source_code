import { afterEach, describe, expect, it, vi } from "vitest";
import {
  MISSING_AUDIO_SOURCE_MESSAGE,
  createAudioElementLoadError,
  createMissingAudioSourceError,
  describeMediaElementError,
  hasPlayableAudioSource,
  logHandledAudioWarning,
} from "./playableAudioSource";

describe("playableAudioSource", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects missing or blank audio sources", () => {
    expect(hasPlayableAudioSource(null)).toBe(false);
    expect(hasPlayableAudioSource(undefined)).toBe(false);
    expect(hasPlayableAudioSource({ audioUrl: "" })).toBe(false);
    expect(hasPlayableAudioSource({ audioUrl: "   " })).toBe(false);
  });

  it("accepts persistent and session audio sources", () => {
    expect(hasPlayableAudioSource({ audioUrl: "stored://song-1" })).toBe(true);
    expect(hasPlayableAudioSource({ audioUrl: "local://song-1" })).toBe(true);
    expect(hasPlayableAudioSource({ audioUrl: "https://example.com/song.mp3" })).toBe(true);
    expect(hasPlayableAudioSource({ audioUrl: "blob:http://localhost:3025/song" })).toBe(true);
  });

  it("creates a consistent missing-source load error", () => {
    expect(createMissingAudioSourceError(1234)).toEqual({
      type: "load",
      message: MISSING_AUDIO_SOURCE_MESSAGE,
      timestamp: 1234,
    });
  });

  it("describes browser media errors without serializing them as empty objects", () => {
    expect(describeMediaElementError({ code: 4, message: "" })).toBe(
      "The audio source is unsupported or unavailable (code 4)"
    );

    expect(createAudioElementLoadError({ code: 3, message: "Decode failed" }, 5678)).toEqual({
      type: "load",
      message:
        "Audio file is not available. The audio could not be decoded (code 3): Decode failed",
      timestamp: 5678,
    });
  });

  it("reports handled audio failures as warnings instead of console errors", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);

    logHandledAudioWarning("Audio element load failed", "Audio file is not available");

    expect(warn).toHaveBeenCalledWith("Audio element load failed", "Audio file is not available");
    expect(error).not.toHaveBeenCalled();
  });
});
