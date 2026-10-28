import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { useAudioStore } from "@/store/audioStore";
import { usePlayerStore } from "@/store/playerStore";

/**
 * S6-4（混音字段批次）契约：
 * volume / isMuted / playbackRate / loopMode 的消费方一律读 playerStore，
 * audioStore 上同名字段只剩兼容投影，不得再被 components/hooks/lib 引用。
 */
const SRC = path.resolve(process.cwd(), "src");
const SCOPES = ["components", "hooks", "lib"];
const MIXER_FIELDS = ["volume", "isMuted", "playbackRate", "loopMode"];
const MIXER_ACTIONS: Record<string, string> = {
  setVolume: "volume",
  toggleMute: "isMuted",
  setIsMuted: "isMuted",
  setPlaybackRate: "playbackRate",
  resetPlaybackRate: "playbackRate",
  setLoopMode: "loopMode",
  cycleLoopMode: "loopMode",
};

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "__tests__") sourceFiles(full, out);
    } else if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\./.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

function audioStoreMixerReferences(file: string): string[] {
  const text = fs.readFileSync(file, "utf8");
  if (!text.includes("useAudioStore")) return [];
  const refs: string[] = [];
  const note = (name: string, where: string) => {
    if (MIXER_FIELDS.includes(name) || name in MIXER_ACTIONS) refs.push(name + " @" + where);
  };
  for (const call of text.matchAll(/useAudioStore\s*\(([^)]*)\)/g)) {
    for (const member of call[1].matchAll(/\.\s*([A-Za-z_$][\w$]*)/g)) note(member[1], "selector");
  }
  for (const chain of text.matchAll(/useAudioStore\.getState\(\)\s*\.\s*([A-Za-z_$][\w$]*)/g)) {
    note(chain[1], "getState");
  }
  for (const payload of text.matchAll(/useAudioStore\.setState\(\s*\{([^}]*)\}/g)) {
    for (const key of payload[1].matchAll(/([A-Za-z_$][\w$]*)\s*:/g)) note(key[1], "setState");
  }
  for (const alias of text.matchAll(
    /const\s+([A-Za-z_$][\w$]*)\s*=\s*useAudioStore\.getState\(\)/g
  )) {
    const pattern = new RegExp("\\b" + alias[1] + "\\.([A-Za-z_$][\\w$]*)", "g");
    for (const member of text.matchAll(pattern)) note(member[1], "alias");
  }
  return refs;
}

describe("S6-4 mixer field consumers", () => {
  it("reads volume/isMuted/playbackRate/loopMode from playerStore only", () => {
    const offenders = SCOPES.flatMap((scope) => sourceFiles(path.join(SRC, scope)))
      .map((file) => ({
        file: path.relative(SRC, file).replace(/\\/g, "/"),
        refs: audioStoreMixerReferences(file),
      }))
      .filter((entry) => entry.refs.length > 0)
      .map((entry) => entry.file + ": " + entry.refs.join(", "));

    expect(offenders).toEqual([]);
  });

  it("keeps the audioStore mirror in sync when consumers write playerStore", () => {
    usePlayerStore.setState({ volume: 0.7, isMuted: false });
    useAudioStore.setState({ volume: 0.7, isMuted: false });

    const player = usePlayerStore.getState();
    player.setVolume(0.35);
    player.toggleMute();

    expect(usePlayerStore.getState().volume).toBe(0.35);
    expect(usePlayerStore.getState().isMuted).toBe(true);
    // 兼容投影：audioStore 旧读点仍看到同一值，行为与迁移前一致
    expect(useAudioStore.getState().volume).toBe(0.35);
    expect(useAudioStore.getState().isMuted).toBe(true);
  });
});
