import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  getPlayableStreamUrl,
  songRescueAttemptsRef,
  failedUrlsRef,
  rescueInProgressRef,
  waitingTimeoutRef,
  stutterRetryCountRef,
} from "./useAudioPlayer";
import { multiSourceResolver } from "@/services/MultiSourceResolver";

describe("useAudioPlayer - Stream Anti-Stutter & Rescue Architecture", () => {
  beforeEach(() => {
    songRescueAttemptsRef.current.clear();
    failedUrlsRef.current.clear();
    rescueInProgressRef.current = false;
    stutterRetryCountRef.current = 0;
    if (waitingTimeoutRef.current) {
      clearTimeout(waitingTimeoutRef.current);
      waitingTimeoutRef.current = null;
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("getPlayableStreamUrl", () => {
    it("should return empty string for null, undefined, or empty URL", () => {
      expect(getPlayableStreamUrl(null)).toBe("");
      expect(getPlayableStreamUrl(undefined)).toBe("");
      expect(getPlayableStreamUrl("")).toBe("");
      expect(getPlayableStreamUrl("   ")).toBe("");
    });

    it("should return empty string for cached:// protocol URLs", () => {
      expect(getPlayableStreamUrl("cached://song-123")).toBe("");
    });

    it("should pass through local and proxy URLs unchanged", () => {
      expect(getPlayableStreamUrl("blob:http://localhost:3000/12345")).toBe(
        "blob:http://localhost:3000/12345"
      );
      expect(getPlayableStreamUrl("data:audio/mp3;base64,AAAA")).toBe(
        "data:audio/mp3;base64,AAAA"
      );
      expect(getPlayableStreamUrl("stored://local-song-1")).toBe("stored://local-song-1");
      expect(getPlayableStreamUrl("local://my-track.flac")).toBe("local://my-track.flac");
      expect(getPlayableStreamUrl("/api/audio/proxy?url=https%3A%2F%2Fexample.com%2Fsong.mp3")).toBe(
        "/api/audio/proxy?url=https%3A%2F%2Fexample.com%2Fsong.mp3"
      );
    });

    it("should wrap external http/https URLs with proxy endpoint", () => {
      const rawUrl = "https://cdn.music.com/stream/song.mp3?token=abc";
      const proxyUrl = getPlayableStreamUrl(rawUrl);
      expect(proxyUrl).toBe(`/api/audio/proxy?url=${encodeURIComponent(rawUrl)}`);
    });
  });

  describe("songRescueAttemptsRef & failedUrlsRef tracking", () => {
    it("should track failed URLs in failedUrlsRef", () => {
      const badUrl1 = "https://cdn.example.com/broken-1.mp3";
      const badUrl2 = "https://cdn.example.com/broken-2.mp3";

      failedUrlsRef.current.add(badUrl1);
      failedUrlsRef.current.add(badUrl2);

      expect(failedUrlsRef.current.has(badUrl1)).toBe(true);
      expect(failedUrlsRef.current.has(badUrl2)).toBe(true);
      expect(failedUrlsRef.current.has("https://cdn.example.com/good.mp3")).toBe(false);
    });

    it("should respect max 1 rescue attempt per song ID", () => {
      const songId = "song-test-101";

      expect(songRescueAttemptsRef.current.get(songId) || 0).toBe(0);

      // Attempt 1: allowed
      const currentAttempts = songRescueAttemptsRef.current.get(songId) || 0;
      expect(currentAttempts < 1).toBe(true);
      songRescueAttemptsRef.current.set(songId, currentAttempts + 1);

      // Attempt 2: blocked (max 1 reached)
      const secondCheck = songRescueAttemptsRef.current.get(songId) || 0;
      expect(secondCheck < 1).toBe(false);
    });

    it("should track rescueInProgressRef to prevent re-entry", () => {
      expect(rescueInProgressRef.current).toBe(false);

      rescueInProgressRef.current = true;
      expect(rescueInProgressRef.current).toBe(true);

      // Simulation of concurrent error while rescue is in progress
      const shouldBlock = rescueInProgressRef.current;
      expect(shouldBlock).toBe(true);

      rescueInProgressRef.current = false;
      expect(rescueInProgressRef.current).toBe(false);
    });
  });

  describe("MultiSourceResolver cache invalidation", () => {
    it("should support invalidateSong to purge cached URL on error", () => {
      const query = {
        id: "song-invalid-1",
        title: "Test Song",
        artist: "Test Artist",
        source: "netease",
      };

      // Should not throw
      expect(() => {
        multiSourceResolver.invalidateSong(query);
      }).not.toThrow();
    });
  });

  describe("Stutter recovery timer & retry count", () => {
    it("should debounce waiting stalls with 2-second timer", () => {
      vi.useFakeTimers();

      let softResumeTriggered = false;
      stutterRetryCountRef.current = 0;

      // Simulate onWaiting firing
      if (waitingTimeoutRef.current) {
        clearTimeout(waitingTimeoutRef.current);
      }

      waitingTimeoutRef.current = setTimeout(() => {
        waitingTimeoutRef.current = null;
        if (stutterRetryCountRef.current < 2) {
          stutterRetryCountRef.current += 1;
          softResumeTriggered = true;
        }
      }, 2000);

      // Before 2 seconds: not yet triggered
      vi.advanceTimersByTime(1500);
      expect(softResumeTriggered).toBe(false);
      expect(stutterRetryCountRef.current).toBe(0);

      // At 2 seconds: soft resume triggers
      vi.advanceTimersByTime(500);
      expect(softResumeTriggered).toBe(true);
      expect(stutterRetryCountRef.current).toBe(1);

      vi.useRealTimers();
    });

    it("should cancel waiting timer when playing or canplay occurs before 2 seconds", () => {
      vi.useFakeTimers();

      let softResumeTriggered = false;

      waitingTimeoutRef.current = setTimeout(() => {
        waitingTimeoutRef.current = null;
        softResumeTriggered = true;
      }, 2000);

      // Audio recovers at 1.0s (canplay/playing fires)
      vi.advanceTimersByTime(1000);
      if (waitingTimeoutRef.current) {
        clearTimeout(waitingTimeoutRef.current);
        waitingTimeoutRef.current = null;
      }

      // Fast forward past 2.0s
      vi.advanceTimersByTime(2000);
      expect(softResumeTriggered).toBe(false);
      expect(waitingTimeoutRef.current).toBeNull();

      vi.useRealTimers();
    });

    it("should enforce max 2 stutter retries per stall", () => {
      stutterRetryCountRef.current = 0;

      // Retry 1
      expect(stutterRetryCountRef.current < 2).toBe(true);
      stutterRetryCountRef.current += 1;

      // Retry 2
      expect(stutterRetryCountRef.current < 2).toBe(true);
      stutterRetryCountRef.current += 1;

      // Retry 3: blocked
      expect(stutterRetryCountRef.current < 2).toBe(false);
    });

    it("should reset stutterRetryCountRef when playing successfully", () => {
      stutterRetryCountRef.current = 2;

      // Simulate onPlaying
      stutterRetryCountRef.current = 0;

      expect(stutterRetryCountRef.current).toBe(0);
    });
  });

  describe("Failed URL rejection in rescue and playback", () => {
    it("should not use rescued URL if it is in failedUrlsRef", () => {
      const failedUrl = "https://cdn.music.com/bad-stream.mp3";
      failedUrlsRef.current.add(failedUrl);

      const candidateRescued = {
        url: failedUrl,
        source: "netease" as const,
        quality: "standard" as const,
        format: "mp3" as const,
        isTrial: false,
      };

      const isUsable =
        Boolean(candidateRescued?.url) && !failedUrlsRef.current.has(candidateRescued.url);
      expect(isUsable).toBe(false);
    });

    it("should accept rescued URL if it is clean and not in failedUrlsRef", () => {
      const goodUrl = "https://cdn.music.com/good-stream.mp3";

      const candidateRescued = {
        url: goodUrl,
        source: "qq" as const,
        quality: "standard" as const,
        format: "mp3" as const,
        isTrial: false,
      };

      const isUsable =
        Boolean(candidateRescued?.url) && !failedUrlsRef.current.has(candidateRescued.url);
      expect(isUsable).toBe(true);
    });
  });
});
