import { describe, it, expect, beforeEach, vi } from "vitest";
import { useUserAccountStore, isPlatformLoggedIn, handlePlatformSessionExpired } from "@/store/userAccountStore";
import { useSourceConfigStore, isSourceUsable } from "@/store/sourceConfigStore";
import { multiSourceResolver } from "@/services/MultiSourceResolver";

describe("Platform Login Gatekeeper & Link Guard", () => {
  beforeEach(() => {
    // Reset account store to completely logged out state
    useUserAccountStore.setState({
      neteaseUser: { loggedIn: false },
      qqUser: { loggedIn: false },
      kugouUser: { loggedIn: false },
      kuwoUser: { loggedIn: false },
      qishuiUser: { loggedIn: false },
    });

    // Reset sourceConfigStore
    useSourceConfigStore.setState({
      sources: {
        local: { id: "local", name: "本地母带", enabled: true, priority: 1, qualityPreference: "hires" },
        netease: { id: "netease", name: "网易云音乐", enabled: true, priority: 2, qualityPreference: "flac" },
        qq: { id: "qq", name: "QQ 音乐", enabled: true, priority: 3, qualityPreference: "flac" },
        kugou: { id: "kugou", name: "酷狗音乐", enabled: true, priority: 4, qualityPreference: "flac" },
        kuwo: { id: "kuwo", name: "酷我音乐", enabled: true, priority: 5, qualityPreference: "flac" },
        qishui: { id: "qishui", name: "汽水音乐", enabled: true, priority: 6, qualityPreference: "320k" },
        lx_custom: { id: "lx_custom", name: "落雪母带", enabled: false, priority: 7, qualityPreference: "hires" },
      },
      lxScripts: [],
      resolutionMode: "hybrid_racing",
    });
  });

  describe("1. Default unauthenticated state verification", () => {
    it("network music platforms should be logged out and disabled by default", () => {
      expect(isPlatformLoggedIn("netease")).toBe(false);
      expect(isPlatformLoggedIn("qq")).toBe(false);
      expect(isPlatformLoggedIn("kugou")).toBe(false);
      expect(isPlatformLoggedIn("kuwo")).toBe(false);
      expect(isPlatformLoggedIn("qishui")).toBe(false);
    });

    it("local master source should always remain usable without login", () => {
      expect(isSourceUsable("local")).toBe(true);
    });

    it("unauthenticated network sources should report unusable through isSourceUsable", () => {
      expect(isSourceUsable("netease")).toBe(false);
      expect(isSourceUsable("qq")).toBe(false);
      expect(isSourceUsable("kugou")).toBe(false);
      expect(isSourceUsable("kuwo")).toBe(false);
      expect(isSourceUsable("qishui")).toBe(false);
    });
  });

  describe("2. Dynamic per-platform login & gatekeeper activation", () => {
    it("logging into QQ Music should only enable QQ Music and keep other platforms blocked", () => {
      useUserAccountStore.setState({
        qqUser: { loggedIn: true, userId: "qq_123", nickname: "QQ用户", isVip: true },
      });

      expect(isPlatformLoggedIn("qq")).toBe(true);
      expect(isSourceUsable("qq")).toBe(true);

      // Other platforms MUST remain closed
      expect(isPlatformLoggedIn("netease")).toBe(false);
      expect(isSourceUsable("netease")).toBe(false);
      expect(isPlatformLoggedIn("kuwo")).toBe(false);
      expect(isSourceUsable("kuwo")).toBe(false);
      expect(isPlatformLoggedIn("kugou")).toBe(false);
      expect(isSourceUsable("kugou")).toBe(false);
    });

    it("logging into Kuwo should open Kuwo link exclusively", () => {
      useUserAccountStore.setState({
        kuwoUser: { loggedIn: true, userId: "kw_999", nickname: "酷我VIP", isVip: true },
      });

      expect(isPlatformLoggedIn("kuwo")).toBe(true);
      expect(isSourceUsable("kuwo")).toBe(true);

      expect(isPlatformLoggedIn("netease")).toBe(false);
      expect(isPlatformLoggedIn("qq")).toBe(false);
    });
  });

  describe("3. Strict source isolation in MultiSourceResolver", () => {
    it("should immediately reject single-source resolution if the specified platform is unauthenticated", async () => {
      // Platform is netease, but netease is not logged in
      const res = await multiSourceResolver.resolvePlayableAudio({
        id: "123456",
        title: "七里香",
        artist: "周杰伦",
        source: "netease",
      });

      expect(res).toBeNull();
    });

    it("should immediately reject QQ track resolution if QQ is not logged in", async () => {
      const res = await multiSourceResolver.resolvePlayableAudio({
        id: "0039MnYb0qxYTI",
        title: "晴天",
        artist: "周杰伦",
        source: "qq",
      });

      expect(res).toBeNull();
    });

    it("should return null for unspecified source when NO platform is logged in and LX is disabled", async () => {
      const res = await multiSourceResolver.resolvePlayableAudio({
        title: "夜曲",
        artist: "周杰伦",
      });

      expect(res).toBeNull();
    });
  });

  describe("4. Session expiry & 401 circuit breaker", () => {
    it("handlePlatformSessionExpired should invalidate platform login and trigger session reset", () => {
      // First login
      useUserAccountStore.setState({
        qqUser: { loggedIn: true, userId: "qq_123", nickname: "QQ用户", isVip: true },
      });
      expect(isPlatformLoggedIn("qq")).toBe(true);

      // Session expires (401 captured)
      handlePlatformSessionExpired("qq", "Cookie 过期");

      expect(isPlatformLoggedIn("qq")).toBe(false);
      expect(isSourceUsable("qq")).toBe(false);
    });
  });
});
