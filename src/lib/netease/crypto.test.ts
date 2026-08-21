import { describe, it, expect } from "vitest";
import { weapi, cookieToJson, cookieObjToString } from "./crypto";

describe("NetEase WeAPI Crypto", () => {
  it("should encrypt payload with params and encSecKey", () => {
    const payload = { type: 3, key: "test-unikey" };
    const result = weapi(payload);

    expect(result).toHaveProperty("params");
    expect(result).toHaveProperty("encSecKey");
    expect(typeof result.params).toBe("string");
    expect(typeof result.encSecKey).toBe("string");
    expect(result.params.length).toBeGreaterThan(10);
    expect(result.encSecKey.length).toBe(256); // 128 bytes in hex = 256 chars
  });

  it("should parse and serialize cookies correctly", () => {
    const cookieStr = "MUSIC_U=abc123xyz; __csrf=token456; os=pc";
    const cookieObj = cookieToJson(cookieStr);

    expect(cookieObj).toEqual({
      MUSIC_U: "abc123xyz",
      __csrf: "token456",
      os: "pc",
    });

    const serialized = cookieObjToString(cookieObj);
    expect(serialized).toContain("MUSIC_U=abc123xyz");
    expect(serialized).toContain("__csrf=token456");
    expect(serialized).toContain("os=pc");
  });
});
