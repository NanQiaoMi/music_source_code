import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { useAudioStore } from "@/store/audioStore";
import { usePlayerStore } from "@/store/playerStore";
import {
  getPlaybackClockServerSnapshot,
  getPlaybackClockSnapshot,
  subscribePlaybackClock,
} from "@/lib/playback/playbackClock";

/**
 * S6-4（isPlaying 批次）契约：
 * isPlaying 的 UI 读点统一走 PlaybackClock（audioStore 的只读投影）；audioStore 仍是
 * 播放确认状态的写路径，components/hooks/lib 不得再直接读取其 isPlaying。
 */
const SRC = path.resolve(process.cwd(), "src");
const SCOPES = ["components", "hooks", "lib"];
const PLAYBACK_FIELDS = ["isPlaying"];

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

function balanced(text: string, open: number): string {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === "(") depth++;
    else if (text[i] === ")" && --depth === 0) return text.slice(open, i + 1);
  }
  return text.slice(open);
}

/** 抽取 audioStore isPlaying 读点；setIsPlaying/togglePlaybackIntent/setState 写点忽略。 */
export function audioStoreIsPlayingRefs(text: string): string[] {
  const refs: string[] = [];
  const note = (name: string, where: string) => {
    if (PLAYBACK_FIELDS.includes(name)) refs.push(name + " @" + where);
  };
  for (const call of text.matchAll(/useAudioStore\s*\(/g)) {
    const body = balanced(text, call.index! + "useAudioStore".length);
    for (const member of body.matchAll(/(?:\.|\b(?:state|s)\s*\.\s*)([A-Za-z_$][\w$]*)/g)) {
      note(member[1], "selector");
    }
  }
  for (const chain of text.matchAll(/useAudioStore\s*\.\s*getState\(\)/g)) {
    const rest = text.slice(chain.index! + chain[0].length);
    let offset = 0;
    for (let step = 0; step < 3; step++) {
      const member = /^\s*\.\s*([A-Za-z_$][\w$]*)/.exec(rest.slice(offset));
      if (!member) break;
      note(member[1], "getState");
      offset += member[0].length;
    }
  }
  for (const destructure of text.matchAll(
    /const\s*\{([^}]*)\}\s*=\s*useAudioStore\s*\.\s*getState\(\)/g
  )) {
    for (const name of destructure[1].matchAll(/([A-Za-z_$][\w$]*)\s*(?:[,:}]|$)/g)) {
      note(name[1], "destructure");
    }
  }
  for (const alias of text.matchAll(
    /const\s+([A-Za-z_$][\w$]*)\s*=\s*useAudioStore\.getState\(\)/g
  )) {
    const pattern = new RegExp("\\b" + alias[1] + "\\s*\\.\\s*([A-Za-z_$][\\w$]*)", "g");
    for (const member of text.matchAll(pattern)) {
      if (/=>\s*$/.test(text.slice(Math.max(0, member.index! - 8), member.index))) continue;
      note(member[1], "alias");
    }
  }
  for (const _ of text.matchAll(/\buseAudioIsPlaying\b/g)) refs.push("useAudioIsPlaying @helper");
  return refs;
}

afterEach(() => {
  useAudioStore.setState({ isPlaying: false });
  usePlayerStore.setState({ isPlaying: false });
});

describe("S6-4 isPlaying consumers", () => {
  it("detects audioStore isPlaying reads without flagging playback writes", () => {
    const samples = [
      "const playing = useAudioStore((state) => state.isPlaying);",
      "const playing = useAudioStore((s) => s.isPlaying);",
      "const playing = useAudioStore.getState().isPlaying;",
      "const playing = useAudioStore\n  .getState()\n  .isPlaying;",
      "const { isPlaying } = useAudioStore.getState();",
      "const store = useAudioStore.getState();\nstore.isPlaying;",
      "const playing = useAudioIsPlaying();",
    ];
    expect(samples.map((sample) => audioStoreIsPlayingRefs(sample).length)).toEqual(
      samples.map(() => 1)
    );

    expect(audioStoreIsPlayingRefs("useAudioStore.getState().setIsPlaying(true);")).toEqual([]);
    expect(audioStoreIsPlayingRefs("useAudioStore.getState().togglePlaybackIntent();")).toEqual([]);
    expect(audioStoreIsPlayingRefs("useAudioStore.setState({ isPlaying: true });")).toEqual([]);
    expect(audioStoreIsPlayingRefs("useAudioStore((state) => state.setIsPlaying);")).toEqual([]);
  });

  it("keeps components/hooks/lib free of audioStore isPlaying reads", () => {
    const offenders = SCOPES.flatMap((scope) => sourceFiles(path.join(SRC, scope)))
      .map((file) => ({
        file: path.relative(SRC, file).replace(/\\/g, "/"),
        refs: audioStoreIsPlayingRefs(fs.readFileSync(file, "utf8")),
      }))
      .filter((entry) => entry.refs.length > 0)
      .map((entry) => entry.file + ": " + entry.refs.join(", "));

    expect(offenders).toEqual([]);
  });

  it("projects playback state through PlaybackClock and keeps the audioStore mirror bidirectional", () => {
    expect(getPlaybackClockServerSnapshot().isPlaying).toBe(false);

    const seen: boolean[] = [];
    const unsubscribe = subscribePlaybackClock(() => {
      seen.push(getPlaybackClockSnapshot().isPlaying);
    });

    useAudioStore.setState({ isPlaying: true });
    expect(getPlaybackClockSnapshot().isPlaying).toBe(true);
    expect(usePlayerStore.getState().isPlaying).toBe(true);

    usePlayerStore.setState({ isPlaying: false });
    expect(useAudioStore.getState().isPlaying).toBe(false);
    expect(getPlaybackClockSnapshot().isPlaying).toBe(false);
    expect(seen).toEqual([true, false]);

    unsubscribe();
    useAudioStore.setState({ isPlaying: true });
    expect(getPlaybackClockSnapshot().isPlaying).toBe(true);
    expect(seen).toEqual([true, false]);
  });
});
