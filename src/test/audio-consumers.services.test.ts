import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * S6-4 PR5 契约：services 与 store（audioStore 自身除外）不得再直接读 audioStore 的 9 个播放字段。
 * src/store/audioStore.ts 是字段声明、双向镜像订阅与 useAudio* 原子 hook 的定义点，按定义性豁免
 * （scripts/report-audio-consumers.mjs 的 --check 使用同一豁免）。
 */
const SRC = path.resolve(process.cwd(), "src");
const SCOPES = ["services", "store"];
const EXEMPT = new Set(["store/audioStore.ts"]);
const FIELDS =
  "currentSong isPlaying currentTime duration volume isMuted playbackRate loopMode isLoading".split(
    " "
  );

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

/** 抽取 audioStore 播放字段的读点：selector / getState 链 / 解构 / 别名 / 便捷 hook；写点忽略。 */
export function audioStoreReadRefs(text: string): string[] {
  const refs: string[] = [];
  const note = (name: string) => {
    if (FIELDS.includes(name)) refs.push(name);
  };
  for (const call of text.matchAll(/useAudioStore\s*\(/g)) {
    const body = balanced(text, call.index! + "useAudioStore".length);
    for (const member of body.matchAll(/(?:\.|\b(?:state|s)\s*\.\s*)([A-Za-z_$][\w$]*)/g)) {
      note(member[1]);
    }
  }
  for (const chain of text.matchAll(/useAudioStore\s*\.\s*getState\(\)/g)) {
    const rest = text.slice(chain.index! + chain[0].length);
    let offset = 0;
    for (let step = 0; step < 3; step++) {
      const member = /^\s*\.\s*([A-Za-z_$][\w$]*)/.exec(rest.slice(offset));
      if (!member) break;
      note(member[1]);
      offset += member[0].length;
    }
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
      if (/=>\s*$/.test(text.slice(Math.max(0, member.index! - 8), member.index))) continue;
      note(member[1]);
    }
  }
  for (const _ of text.matchAll(/\buseAudioCurrentSong\b/g)) refs.push("currentSong");
  return refs;
}

describe("S6-4 service/store layer consumers", () => {
  it("detects every audioStore playback read shape without flagging writes", () => {
    const samples = [
      "const t = useAudioStore((state) => state.currentTime);",
      "const t = useAudioStore.getState().volume;",
      "const t = useAudioStore\n  .getState()\n  .isMuted;",
      "const { currentSong, loopMode } = useAudioStore.getState();",
      "const audioState = useAudioStore.getState();\naudioState.duration;",
      "const song = useAudioCurrentSong();",
    ];
    expect(samples.map((sample) => audioStoreReadRefs(sample).length)).toEqual([1, 1, 1, 2, 1, 1]);

    expect(audioStoreReadRefs("useAudioStore.getState().setIsPlaying(false);")).toEqual([]);
    expect(audioStoreReadRefs("useAudioStore.getState().setCurrentSong(null);")).toEqual([]);
    expect(audioStoreReadRefs("useAudioStore.setState({ currentSong: null });")).toEqual([]);
  });

  it("keeps services and store free of non-exempt audioStore playback reads", () => {
    const offenders = SCOPES.flatMap((scope) => sourceFiles(path.join(SRC, scope)))
      .map((file) => ({
        file: path.relative(SRC, file).replace(/\\/g, "/"),
        refs: audioStoreReadRefs(fs.readFileSync(file, "utf8")),
      }))
      .filter((entry) => !EXEMPT.has(entry.file) && entry.refs.length > 0)
      .map((entry) => entry.file + ": " + entry.refs.join(", "));

    expect(offenders).toEqual([]);
  });
});
