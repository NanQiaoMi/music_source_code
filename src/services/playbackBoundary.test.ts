import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * S6-9b/S6-10 契约：service 层不得直接调用 audioStore 的播放传输方法。
 * 传输统一走 @/domain/playback/playbackCommands 或 PlaybackPorts（可注入 fake ports）；
 * S6-10 移除了 songPurgeService 的遗留白名单。
 */
const SRC = path.resolve(process.cwd(), "src");
const SERVICES = path.join(SRC, "services");
const TRANSPORT_METHODS = new Set([
  "playSong",
  "playQueue",
  "appendSongsAndPlay",
  "setIsPlaying",
  "togglePlaybackIntent",
  "seekTo",
  "nextSong",
  "prevSong",
  "setVolume",
  "toggleMute",
  "setCurrentSong",
]);

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

/** 抽取对 audioStore 播放传输方法的直接调用：链式 getState / 别名 / 解构。 */
export function directTransportCalls(text: string): string[] {
  const found = new Set<string>();
  const note = (name: string) => {
    if (TRANSPORT_METHODS.has(name)) found.add(name);
  };

  for (const call of text.matchAll(
    /useAudioStore\s*\.\s*getState\(\)\s*\.\s*([A-Za-z_$][\w$]*)\s*\(/g
  )) {
    note(call[1]);
  }

  for (const destructure of text.matchAll(
    /const\s*\{([^}]*)\}\s*=\s*useAudioStore\s*\.\s*getState\(\)/g
  )) {
    for (const name of destructure[1].matchAll(/([A-Za-z_$][\w$]*)\s*(?:[,:}]|$)/g)) {
      note(name[1]);
    }
  }

  for (const alias of text.matchAll(
    /const\s+([A-Za-z_$][\w$]*)\s*=\s*useAudioStore\s*\.\s*getState\(\)/g
  )) {
    const pattern = new RegExp("\\b" + alias[1] + "\\s*\\.\\s*([A-Za-z_$][\\w$]*)", "g");
    for (const member of text.matchAll(pattern)) {
      note(member[1]);
    }
  }

  return Array.from(found).sort();
}

describe("S6-9b service playback boundary", () => {
  it("detects every direct audioStore transport call shape", () => {
    const samples = [
      "useAudioStore.getState().playSong(song);",
      "const audio = useAudioStore.getState();\naudio.nextSong();",
      "const { setIsPlaying } = useAudioStore.getState();",
      "playbackCommands.playSong(song);",
      "usePlayerStore.getState().setVolume(0.5);",
    ];
    expect(samples.map((sample) => directTransportCalls(sample))).toEqual([
      ["playSong"],
      ["nextSong"],
      ["setIsPlaying"],
      [],
      [],
    ]);
  });

  it("keeps services free of direct audioStore transport calls", () => {
    const offenders = sourceFiles(SERVICES)
      .map((file) => ({
        file: path.relative(SRC, file).replace(/\\/g, "/"),
        calls: directTransportCalls(fs.readFileSync(file, "utf8")),
      }))
      .filter((entry) => entry.calls.length > 0)
      .map((entry) => entry.file + ": " + entry.calls.join(", "));

    expect(offenders).toEqual([]);
  });

  it("stops purged playback through PlaybackPorts", () => {
    const source = fs.readFileSync(path.join(SERVICES, "songPurgeService.ts"), "utf8");
    expect(source).not.toContain("useAudioStore");
    expect(source).toContain("PlaybackPorts");
    expect(source).toContain("clearCurrentSong()");
  });

  it("routes aiAgentTools playback tools through commands/ports", () => {
    const source = fs.readFileSync(path.join(SERVICES, "aiAgentTools.ts"), "utf8");
    expect(source).not.toContain("useAudioStore");
    expect(source).toContain("createPlaybackCommands");
    expect(source).toContain("playbackPorts.getSnapshot()");
    expect(source).toContain("commands.playSong(");
    expect(source).toContain("commands.togglePlayback(");
    expect(source).toContain("commands.nextTrack(");
    expect(source).toContain("commands.prevTrack(");
    expect(source).toContain("commands.setVolume(");
    expect(source).toContain("commands.toggleMute(");
  });
});
