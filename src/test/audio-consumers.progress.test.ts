import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { useAudioStore } from "@/store/audioStore";
import { getPlaybackClockSnapshot } from "@/lib/playback/playbackClock";

/**
 * S6-4（进度字段批次）契约：
 * currentTime / duration / isLoading 的读点统一走 PlaybackClock；
 * audioStore 仍是兼容投影与 seek 写路径，但 components/hooks/lib 不得再直接读取。
 */
const SRC = path.resolve(process.cwd(), "src");
const SCOPES = ["components", "hooks", "lib"];
const PROGRESS_FIELDS = ["currentTime", "duration", "isLoading"];

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "__tests__") sourceFiles(full, out);
    } else if (/.(ts|tsx)$/.test(entry.name) && !/\.test\./.test(entry.name)) {
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

/** 抽取 audioStore 进度字段的读点：selector / getState 链 / 解构 / 别名；setState/seek 写点忽略。 */
export function audioStoreProgressRefs(text: string): string[] {
  const refs: string[] = [];
  const note = (name: string, where: string) => {
    if (PROGRESS_FIELDS.includes(name)) refs.push(name + " @" + where);
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
  return refs;
}

afterEach(() => {
  useAudioStore.setState({ currentTime: 0, duration: 0, isLoading: false });
});

describe("S6-4 progress field consumers", () => {
  it("detects every audioStore progress read shape without flagging writes", () => {
    const samples = [
      "const t = useAudioStore((state) => state.currentTime);",
      "const t = useAudioStore((s) => s.duration);",
      "const t = useAudioStore.getState().currentTime;",
      "const t = useAudioStore\n  .getState()\n  .duration;",
      "const { currentTime, duration, isLoading } = useAudioStore.getState();",
      "const store = useAudioStore.getState();\nstore.currentTime;",
    ];
    expect(samples.map((sample) => audioStoreProgressRefs(sample).length)).toEqual([
      1, 1, 1, 1, 3, 1,
    ]);

    expect(audioStoreProgressRefs("useAudioStore.getState().seekTo(10);")).toEqual([]);
    expect(audioStoreProgressRefs("useAudioStore.getState().setCurrentTime(10);")).toEqual([]);
    expect(audioStoreProgressRefs("useAudioStore.setState({ currentTime: 10 });")).toEqual([]);
    expect(audioStoreProgressRefs("useAudioStore((state) => state.isPlaying);")).toEqual([]);
  });

  it("keeps components/hooks/lib free of audioStore progress reads", () => {
    const offenders = SCOPES.flatMap((scope) => sourceFiles(path.join(SRC, scope)))
      .map((file) => ({
        file: path.relative(SRC, file).replace(/\\/g, "/"),
        refs: audioStoreProgressRefs(fs.readFileSync(file, "utf8")),
      }))
      .filter((entry) => entry.refs.length > 0)
      .map((entry) => entry.file + ": " + entry.refs.join(", "));

    expect(offenders).toEqual([]);
  });

  it("keeps audioStore writes as the compatibility projection behind the clock", () => {
    useAudioStore.setState({ currentTime: 42.5, duration: 210, isLoading: true });
    expect(getPlaybackClockSnapshot()).toMatchObject({
      currentTime: 42.5,
      duration: 210,
      isLoading: true,
    });
    expect(useAudioStore.getState().currentTime).toBe(42.5);
  });
});
