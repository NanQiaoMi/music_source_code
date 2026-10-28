import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const hookSource = fs.readFileSync(
  path.join(process.cwd(), "src/hooks/useKeyboardShortcuts.ts"),
  "utf8"
);

describe("useKeyboardShortcuts 播放命令边界", () => {
  it("不再直写 audioStore/playerStore 的播放传输动作", () => {
    expect(hookSource).not.toContain("useAudioStore");
    expect(hookSource).not.toMatch(/playerStore\.(setVolume|toggleMute|nextSong|prevSong)\(/);
    expect(hookSource).not.toMatch(
      /audioStore\.(setCurrentTime|togglePlaybackIntent|setIsPlaying)\(/
    );
  });

  it("播放/跳播/上下曲/音量/静音均调用 playbackCommands", () => {
    const commands = [
      "togglePlayback",
      "seekTo",
      "nextTrack",
      "prevTrack",
      "setVolume",
      "toggleMute",
    ];
    commands.forEach((command) => {
      expect(hookSource).toContain(`playbackCommands.${command}(`);
    });
  });
});
