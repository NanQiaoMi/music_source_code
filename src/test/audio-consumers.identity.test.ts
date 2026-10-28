import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { useAudioStore } from "@/store/audioStore";
import { usePlayerStore } from "@/store/playerStore";
import type { Song } from "@/types/song";

/**
 * S6-4（身份字段批次）契约：
 * currentSong 的唯一身份权威是 playerStore；audioStore 同名字段只剩 S6-3 的单向兼容投影，
 * components/hooks/lib 不得再通过 audioStore 读/写身份字段。
 */
const SRC = path.resolve(process.cwd(), "src");
const SCOPES = ["components", "hooks", "lib"];
const IDENTITY_FIELDS = ["currentSong"];
const IDENTITY_ACTIONS = ["setCurrentSong", "updateCurrentSongCover", "updateCurrentSongLyrics"];

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

/** 抽取片段中的 audioStore 身份字段引用：selector / getState 链 / 解构 / 别名 / setState / 便捷钩子。 */
export function audioStoreIdentityRefs(text: string): string[] {
  const refs: string[] = [];
  const note = (name: string, where: string) => {
    if (IDENTITY_FIELDS.includes(name) || IDENTITY_ACTIONS.includes(name)) {
      refs.push(name + " @" + where);
    }
  };
  for (const call of text.matchAll(/useAudioStore\s*\(/g)) {
    const body = balanced(text, call.index! + call[0].length - 1);
    for (const member of body.matchAll(/(?:\.|\b(?:state|s)\s*\.\s*)([A-Za-z_$][\w$]*)/g)) {
      note(member[1], "selector");
    }
  }
  for (const call of text.matchAll(/useAudioStore\s*\.\s*setState\s*\(/g)) {
    const body = balanced(text, call.index! + call[0].length - 1);
    for (const key of body.matchAll(/([A-Za-z_$][\w$]*)\s*:/g)) note(key[1], "setState");
  }
  for (const chain of text.matchAll(/useAudioStore\s*\.\s*getState\(\)/g)) {
    // 逐段吃掉链式成员（允许跨行），避免把参数里的 activeAudio.duration 之类算成 store 字段
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
      // (state) => state.currentSong 里的 state 是箭头参数，不是 audioStore 别名
      if (/=>\s*$/.test(text.slice(Math.max(0, member.index! - 8), member.index))) continue;
      note(member[1], "alias");
    }
  }
  for (const _ of text.matchAll(/\buseAudioCurrentSong\b/g))
    refs.push("useAudioCurrentSong @helper");
  return refs;
}

describe("S6-4 identity field consumers", () => {
  it("detects every audioStore currentSong access shape", () => {
    const samples = [
      "const song = useAudioStore((state) => state.currentSong);",
      "const song = useAudioStore((s) => s.currentSong);",
      "const song = useAudioStore.getState().currentSong;",
      "const song = useAudioStore\n  .getState()\n  .currentSong;",
      "const { currentSong } = useAudioStore.getState();",
      "const store = useAudioStore.getState();\nstore.currentSong;",
      "useAudioStore.getState().setCurrentSong(song);",
      "useAudioStore.getState().updateCurrentSongCover(url);",
      "useAudioStore.setState({ currentSong: song });",
      "const song = useAudioCurrentSong();",
    ];
    expect(samples.map((sample) => audioStoreIdentityRefs(sample).length)).toEqual(
      samples.map(() => 1)
    );
    // 非身份字段与箭头参数不该被误报
    expect(audioStoreIdentityRefs("useAudioStore((state) => state.isPlaying);")).toEqual([]);
    expect(
      audioStoreIdentityRefs("const store = useAudioStore.getState();\nstore.isPlaying;")
    ).toEqual([]);
  });

  it("keeps components/hooks/lib free of audioStore currentSong references", () => {
    const offenders = SCOPES.flatMap((scope) => sourceFiles(path.join(SRC, scope)))
      .map((file) => ({
        file: path.relative(SRC, file).replace(/\\/g, "/"),
        refs: audioStoreIdentityRefs(fs.readFileSync(file, "utf8")),
      }))
      .filter((entry) => entry.refs.length > 0)
      .map((entry) => entry.file + ": " + entry.refs.join(", "));

    expect(offenders).toEqual([]);
  });

  it("projects playerStore currentSong writes into the audioStore mirror", () => {
    const song: Song = {
      id: "identity-a",
      title: "Identity A",
      artist: "Mimi",
      duration: 180,
      source: "local",
    };
    usePlayerStore.getState().setCurrentSong(song);
    expect(useAudioStore.getState().currentSong?.id).toBe("identity-a");

    usePlayerStore.getState().updateCurrentSongCover("https://cdn.example/cover.png");
    expect(usePlayerStore.getState().currentSong?.cover).toBe("https://cdn.example/cover.png");
    expect(useAudioStore.getState().currentSong?.cover).toBe("https://cdn.example/cover.png");

    usePlayerStore.getState().updateCurrentSongLyrics("[00:01]line", "[00:01]译文");
    expect(useAudioStore.getState().currentSong?.lyrics).toBe("[00:01]line");
    expect(useAudioStore.getState().currentSong?.translationLyrics).toBe("[00:01]译文");

    usePlayerStore.getState().setCurrentSong(null);
    expect(usePlayerStore.getState().currentSong).toBeNull();
    expect(useAudioStore.getState().currentSong).toBeNull();
  });
});
