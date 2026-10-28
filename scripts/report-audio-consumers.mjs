#!/usr/bin/env node
/** S6-4 audioStore 播放字段消费清单：9 个播放字段在 selector / getState / 别名 / setState 中的读写点。
 *  用法：node scripts/report-audio-consumers.mjs [--json <path>] [--fields a,b] [--check]
 *  --check：components/hooks 仍有目标字段引用时 exit 1；src/store 自身实现单独计入 store 层。 */
import fs from "node:fs";
import path from "node:path";

const FIELDS =
  "currentSong isPlaying currentTime duration volume isMuted playbackRate loopMode isLoading".split(
    " "
  );
const LAYERS = "components hooks lib services store app".split(" ");
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
const targetFields = (argValue("--fields") || FIELDS.join(",")).split(",");
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
  if (!text.includes("useAudioStore")) return [];
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
    for (const member of text.matchAll(pattern)) membersOf("." + member[1]).forEach(push);
  }

  let index = -1;
  while ((index = text.indexOf("useAudioStore", index + 1)) !== -1) {
    let cursor = index + "useAudioStore".length;
    while (/\s/.test(text[cursor])) cursor++;
    if (text[cursor] === "(") {
      membersOf(balanced(text, cursor)).forEach(push);
    } else if (text.startsWith(".getState()", cursor)) {
      const segment = text.slice(cursor + 11, cursor + 171).split(/\n/)[0];
      const destructure = /\{[^}]*\}\s*=\s*$/.exec(text.slice(Math.max(0, index - 200), index));
      membersOf(segment, destructure ? destructure[0] : "").forEach(push);
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
  const offenders = records.filter(
    (record) =>
      ["components", "hooks"].includes(record.layer) && targetFields.includes(record.field)
  );
  if (offenders.length) {
    console.error("FAIL: " + offenders.length + " playback field reference(s) remain:");
    for (const record of offenders.slice(0, 40))
      console.error("  " + record.file + " " + record.field);
    process.exit(1);
  }
  console.log("OK: target fields have 0 component/hook references");
}
