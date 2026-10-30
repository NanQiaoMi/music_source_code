import { afterEach, describe, expect, it, vi } from "vitest";
import {
  MISSING_AUDIO_SOURCE_MESSAGE,
  createAudioElementLoadError,
  createMissingAudioSourceError,
  describeMediaElementError,
  hasPlayableAudioSource,
  isValidAudioData,
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

  describe("isValidAudioData", () => {
    it("rejects null, undefined, or undersized buffers", () => {
      expect(isValidAudioData(null)).toBe(false);
      expect(isValidAudioData(undefined)).toBe(false);
      expect(isValidAudioData(new ArrayBuffer(100))).toBe(false);
      expect(isValidAudioData(new Uint8Array(2048))).toBe(false);
    });

    it("rejects text, HTML, and JSON responses even if large enough", () => {
      const html = "<!DOCTYPE html><html><body>Error 404</body></html>" + "x".repeat(5000);
      const htmlBuf = new TextEncoder().encode(html);
      expect(isValidAudioData(htmlBuf.buffer)).toBe(false);

      const json = '{"code":404,"message":"Audio resource expired"}' + " ".repeat(5000);
      const jsonBuf = new TextEncoder().encode(json);
      expect(isValidAudioData(jsonBuf)).toBe(false);

      // UTF-8 BOM rejection
      const bomBuf = new Uint8Array(5000);
      bomBuf[0] = 0xef;
      bomBuf[1] = 0xbb;
      bomBuf[2] = 0xbf;
      expect(isValidAudioData(bomBuf)).toBe(false);

      // Random non-audio binary rejection
      const randomBuf = new Uint8Array(70000);
      randomBuf.fill(0x12);
      expect(isValidAudioData(randomBuf)).toBe(false);
    });

    it("recognizes valid AIFF FORM...AIFF headers", () => {
      const buf = new Uint8Array(8192);
      buf[0] = 0x46; // 'F'
      buf[1] = 0x4f; // 'O'
      buf[2] = 0x52; // 'R'
      buf[3] = 0x4d; // 'M'
      buf[8] = 0x41; // 'A'
      buf[9] = 0x49; // 'I'
      buf[10] = 0x46; // 'F'
      buf[11] = 0x46; // 'F'
      expect(isValidAudioData(buf)).toBe(true);
    });

    it("recognizes valid MP3 with ID3 header", () => {
      const buf = new Uint8Array(8192);
      buf[0] = 0x49; // 'I'
      buf[1] = 0x44; // 'D'
      buf[2] = 0x33; // '3'
      expect(isValidAudioData(buf.buffer)).toBe(true);
      expect(isValidAudioData(buf)).toBe(true);
    });

    it("recognizes valid MP3 with MPEG sync word", () => {
      const buf = new Uint8Array(8192);
      buf[0] = 0xff;
      buf[1] = 0xfb; // MPEG-1 Layer 3
      expect(isValidAudioData(buf)).toBe(true);
    });

    it("recognizes valid FLAC magic bytes", () => {
      const buf = new Uint8Array(8192);
      buf[0] = 0x66; // 'f'
      buf[1] = 0x4c; // 'L'
      buf[2] = 0x61; // 'a'
      buf[3] = 0x43; // 'C'
      expect(isValidAudioData(buf)).toBe(true);
    });

    it("recognizes valid OGG magic bytes", () => {
      const buf = new Uint8Array(8192);
      buf[0] = 0x4f; // 'O'
      buf[1] = 0x67; // 'g'
      buf[2] = 0x67; // 'g'
      buf[3] = 0x53; // 'S'
      expect(isValidAudioData(buf)).toBe(true);
    });

    it("recognizes valid WAV RIFF...WAVE headers", () => {
      const buf = new Uint8Array(8192);
      buf[0] = 0x52; // 'R'
      buf[1] = 0x49; // 'I'
      buf[2] = 0x46; // 'F'
      buf[3] = 0x46; // 'F'
      buf[8] = 0x57; // 'W'
      buf[9] = 0x41; // 'A'
      buf[10] = 0x56; // 'V'
      buf[11] = 0x45; // 'E'
      expect(isValidAudioData(buf)).toBe(true);
    });

    it("recognizes valid M4A/AAC ftyp headers", () => {
      const buf = new Uint8Array(8192);
      buf[4] = 0x66; // 'f'
      buf[5] = 0x74; // 't'
      buf[6] = 0x79; // 'y'
      buf[7] = 0x70; // 'p'
      expect(isValidAudioData(buf)).toBe(true);
    });
  });
});
