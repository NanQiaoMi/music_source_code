import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// S2-1 E2 守卫：音量/静音只允许在 AudioEngine.masterGain 写一次，
// 媒体元素恒为满幅（element.volume === 1），否则双写会再次放大/衰减输出。
const hookSource = readFileSync(path.resolve(process.cwd(), "src/hooks/useAudioPlayer.ts"), "utf8");

describe("S2-1 volume authority", () => {
  it("never writes user volume or mute into media elements", () => {
    expect(hookSource).not.toMatch(/\baudio\.volume\s*=/);
    expect(hookSource).toContain("audioInstance.volume = 1;");
    expect(hookSource).toContain("secondaryAudioInstance.volume = 1;");
  });

  it("routes volume and mute through the single AudioEngine masterGain call", () => {
    const volumeWrites = hookSource.match(/setVolume\(isMuted \? 0 : volume\)/g) ?? [];
    expect(volumeWrites).toHaveLength(1);
  });
});
