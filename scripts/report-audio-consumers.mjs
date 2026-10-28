#!/usr/bin/env node
/** S6-4 audioStore 播放字段消费清单：9 个播放字段在 selector / getState / 别名 / setState 中的读写点。
 *  用法：node scripts/report-audio-consumers.mjs [--json <path>] [--fields a,b] [--group progress|playback] [--check]
 *  --group：按迁移批次选择目标字段（progress = currentTime/duration/isLoading；
 *           playback = isPlaying；两组都只校验读点）。
 *  --check：components/hooks/lib 仍有目标字段引用时 exit 1；src/store 自身实现单独计入 store 层。 */
import fs from "node:fs";
import path from "node:path";

const FIELDS =
  "currentSong isPlaying currentTime duration volume isMuted playbackRate loopMode isLoading".split(
    " "
  );
const LAYERS = "components hooks lib services store app".split(" ");
/** 批次目标组：checkKinds 限定只迁移读点时，写操作（seekTo/setCurrentTime）仍留在 audioStore。 */
const TARGET_GROUPS = {
  progress: {
    fields: ["currentTime", "duration", "isLoading"],
    checkKinds: ["read"],
    // 唯一获准读 audioStore 进度字段的适配器：PlaybackClock 把它转成外部快照。
    ignoreFiles: ["src/lib/playback/playbackClock.ts"],
  },
  playback: {
    fields: ["isPlaying"],
    checkKinds: ["read"],
    // isPlaying 的 UI 读点统一走 PlaybackClock；写点（setIsPlaying/togglePlaybackIntent）仍走 audioStore。
    ignoreFiles: ["src/lib/playback/playbackClock.ts"],
  },
};
const ACTION_FIELDS = Object.fromEntries(
  `setCurrentSong:currentSong updateCurrentSongCover:currentSong updateCurrentSongLyrics:currentSong
   setIsPlaying:isPlaying togglePlaybackIntent:isPlaying togglePlay:isPlaying setCurrentTime:currentTime
   seekTo:currentTime setDuration:duration setVolume:volume toggleMute:isMuted setIsMuted:isMuted
   setPlaybackRate:playbackRate resetPlaybackRate:playbackRate setLoopMode:loopMode cycleLoopMode:loopMode
   setIsLoading:isLoading`
    .split(/\s+/)
    .map((pair) => pair.split(":"))
);
const args = process.argv.slice(2);
const argValue = (flag) => (args.indexOf(flag) >= 0 ? args[args.indexOf(flag) + 1] : null);
const groupName = argValue("--group");
const group = groupName ? TARGET_GROUPS[groupName] : null;
if (groupName && !group) {
  console.error(
    "unknown --group: " + groupName + " (expected: " + Object.keys(TARGET_GROUPS) + ")"
  );
  process.exit(2);
}
const targetFields = group ? group.fields : (argValue("--fields") || FIELDS.join(",")).split(",");
const ROOT = path.resolve(process.cwd(), "src");

const walk = (dir, out = []) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!["__tests__", "node_modules"].includes(entry.name)) walk(full, out);
    } else if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\./.test(entry.name)) out.push(full);
  }
  return out;
};

/** 截取 useAudioStore(...) / .setState(...) 的完整括号片段（selector 内含一层箭头函数）。 */
const balanced = (text, start) => {
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === "(") depth++;
    else if (text[i] === ")" && --depth === 0) return text.slice(start, i + 1);
  }
  return text.slice(start);
};

/** 抽取片段中的播放字段读写点；extra 为解构前缀（const { volume } = ...）。 */
const membersOf = (segment, extra = "") => {
  const found = [];
  const push = (name) => {
    if (ACTION_FIELDS[name])
      found.push({ field: ACTION_FIELDS[name], kind: "write", action: name });
    else if (FIELDS.includes(name)) found.push({ field: name, kind: "read", action: name });
  };
  for (const m of segment.matchAll(/(?:\.|\b(?:state|s)\s*\.\s*)([A-Za-z_$][\w$]*)/g)) push(m[1]);
  if (/\.setState\s*\(/.test(segment)) {
    for (const m of segment.matchAll(/([A-Za-z_$][\w$]*)\s*:/g)) push(m[1]);
  }
  for (const m of extra.matchAll(/([A-Za-z_$][\w$]*)\s*[,:}\s]/g)) push(m[1]);
  return found;
};

const scanFile = (file) => {
  const text = fs.readFileSync(file, "utf8");
  if (!text.includes("useAudioStore") && !text.includes("useAudioCurrentSong")) return [];
  const rel = path.relative(process.cwd(), file).replace(/\\/g, "/");
  const [first] = path.relative(ROOT, file).split(/[\\/]/);
  const layer = LAYERS.includes(first) ? first : "other";
  const records = [];
  const push = (record) => records.push({ file: rel, layer, ...record });

  const aliases = new Set(
    [...text.matchAll(/const\s+([A-Za-z_$][\w$]*)\s*=\s*useAudioStore\.getState\(\)/g)].map(
      (m) => m[1]
    )
  );
  for (const alias of aliases) {
    const pattern = new RegExp("\\b" + alias + "\\.([A-Za-z_$][\\w$]*)", "g");
    for (const member of text.matchAll(pattern)) {
      // 跳过箭头函数参数（(state) => state.currentSong），那不是 audioStore 别名读取
      if (/=>\s*$/.test(text.slice(Math.max(0, member.index - 8), member.index))) continue;
      membersOf("." + member[1]).forEach(push);
    }
  }

  // audioStore 的细粒度身份钩子等价于读 currentSong
  for (const _ of text.matchAll(/\buseAudioCurrentSong\b/g)) {
    push({ field: "currentSong", kind: "read", action: "useAudioCurrentSong" });
  }

  let index = -1;
  while ((index = text.indexOf("useAudioStore", index + 1)) !== -1) {
    let cursor = index + "useAudioStore".length;
    while (/\s/.test(text[cursor])) cursor++;
    if (text[cursor] === "(") {
      membersOf(balanced(text, cursor)).forEach(push);
    } else if (text.startsWith(".getState()", cursor)) {
      const destructure = /\{[^}]*\}\s*=\s*$/.exec(text.slice(Math.max(0, index - 200), index));
      if (destructure) membersOf("", destructure[0]).forEach(push);
      // 逐段吃掉 getState() 之后的链式成员（允许跨行），如 .currentSong / .setCurrentSong(...)
      let offset = cursor + 11;
      for (let step = 0; step < 3; step++) {
        const member = /^\s*\.\s*([A-Za-z_$][\w$]*)/.exec(text.slice(offset));
        if (!member) break;
        membersOf("." + member[1]).forEach(push);
        offset += member[0].length;
      }
    } else if (text.startsWith(".setState(", cursor)) {
      for (const key of balanced(text, cursor + 9).matchAll(/([A-Za-z_$][\w$]*)\s*:/g)) {
        if (FIELDS.includes(key[1])) push({ field: key[1], kind: "write", action: "setState" });
      }
    }
  }
  return records;
};

const records = walk(ROOT)
  .flatMap(scanFile)
  .filter((record) => targetFields.includes(record.field));
const uniqueFiles = (list) => [...new Set(list.map((record) => record.file))];
const byField = {};
const byLayer = {};
for (const field of FIELDS) {
  const list = records.filter((record) => record.field === field);
  if (!list.length && !targetFields.includes(field)) continue;
  byField[field] = {
    read: list.filter((record) => record.kind === "read").length,
    write: list.filter((record) => record.kind === "write").length,
    files: uniqueFiles(list).sort(),
  };
}
for (const layer of LAYERS) {
  const list = records.filter((record) => record.layer === layer);
  byLayer[layer] = { references: list.length, files: uniqueFiles(list).length };
}
const report = {
  metric: "playback field member accesses through useAudioStore (selector/getState/alias/setState)",
  group: groupName || null,
  fields: FIELDS,
  targetFields,
  totals: { references: records.length, files: uniqueFiles(records).length },
  byField,
  byLayer,
  consumers: records
    .map((record) => record.file + ":" + record.field + ":" + record.kind + ":" + record.action)
    .sort(),
};

console.log(JSON.stringify({ totals: report.totals, byField, byLayer }, null, 2));
const jsonPath = argValue("--json");
if (jsonPath) {
  fs.mkdirSync(path.dirname(jsonPath), { recursive: true });
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2) + "\n");
  console.log("wrote " + jsonPath);
}
if (args.includes("--check")) {
  const checkKinds = group?.checkKinds;
  const ignored = new Set(group?.ignoreFiles || []);
  const offenders = records.filter(
    (record) =>
      ["components", "hooks", "lib"].includes(record.layer) &&
      targetFields.includes(record.field) &&
      !ignored.has(record.file) &&
      (!checkKinds || checkKinds.includes(record.kind))
  );
  if (offenders.length) {
    console.error("FAIL: " + offenders.length + " playback field reference(s) remain:");
    for (const record of offenders.slice(0, 40))
      console.error("  " + record.file + " " + record.field);
    process.exit(1);
  }
  console.log("OK: target fields have 0 component/hook/lib references");
}
