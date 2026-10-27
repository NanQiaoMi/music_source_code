import { describe, expect, it } from "vitest";
import type { LyricFilmProfile } from "./lyricFilmProgram";
import type { HandwrittenDoodleSpec } from "./handwrittenScene";
import {
  resolveDoodleProgress,
  resolveHandwrittenCameraFrame,
  resolveHandwrittenScene,
  resolveIllustrationAccent,
  resolveSemanticIllustrationKind,
  stableRandom,
} from "./handwrittenScene";

const BASE_INPUT = {
  seed: "song-1:shot:3",
  profile: "spotlight" as LyricFilmProfile,
  shotKind: "lyrics" as const,
  width: 1920,
  height: 1080,
  units: ["跌倒了", "就不敢", "继续", "往前走"],
  reducedMotion: false,
};

describe("handwrittenScene", () => {
  describe("稳定随机", () => {
    it("同一个 seed + salt 永远返回同一个值", () => {
      expect(stableRandom("seed-a", "salt")).toBe(stableRandom("seed-a", "salt"));
      expect(stableRandom("seed-a", "salt")).not.toBe(stableRandom("seed-b", "salt"));
    });
  });

  describe("镜头版式", () => {
    it("同输入得到完全一致的版式（seek / 重绘可复现）", () => {
      expect(resolveHandwrittenScene(BASE_INPUT)).toEqual(resolveHandwrittenScene(BASE_INPUT));
    });

    it("主句锚点与最大宽度都落在安全范围内", () => {
      const scene = resolveHandwrittenScene(BASE_INPUT);
      expect(scene.anchorX).toBeGreaterThanOrEqual(0.26);
      expect(scene.anchorX).toBeLessThanOrEqual(0.74);
      expect(scene.anchorY).toBeGreaterThanOrEqual(0.28);
      expect(scene.anchorY).toBeLessThanOrEqual(0.7);
      expect(scene.maxWidthRatio).toBeGreaterThan(0.5);
      expect(scene.maxWidthRatio).toBeLessThanOrEqual(0.82);
      expect(Math.abs(scene.tilt)).toBeLessThan(0.05);
    });

    it("歌词镜头不依赖重复漂浮的小图标", () => {
      const scene = resolveHandwrittenScene(BASE_INPUT);
      const kinds = scene.doodles.map((doodle) => doodle.kind);
      expect(new Set(kinds).size).toBe(kinds.length);
      expect(scene.doodles.length).toBeLessThanOrEqual(1);
    });

    it("重点标注覆盖 2–3 个连续单元且不越界", () => {
      const scene = resolveHandwrittenScene(BASE_INPUT);
      expect(scene.emphasis).not.toBeNull();
      const emphasis = scene.emphasis!;
      expect(emphasis.unitCount).toBeGreaterThanOrEqual(2);
      expect(emphasis.unitCount).toBeLessThanOrEqual(3);
      expect(emphasis.unitIndex).toBeGreaterThanOrEqual(0);
      expect(emphasis.unitIndex + emphasis.unitCount).toBeLessThanOrEqual(BASE_INPUT.units.length);
      expect(["underline", "circle", "highlight"]).toContain(emphasis.style);
    });

    it("非歌词镜头不产生重点标注", () => {
      const scene = resolveHandwrittenScene({ ...BASE_INPUT, shotKind: "interlude" });
      expect(scene.emphasis).toBeNull();
    });

    it("减少动态时不倾斜、不推镜，涂鸦立即出现", () => {
      const scene = resolveHandwrittenScene({ ...BASE_INPUT, reducedMotion: true });
      expect(scene.tilt).toBe(0);
      expect(scene.paperRotation).toBe(0);
      expect(scene.camera.driftX).toBe(0);
      expect(scene.camera.rotation).toBe(0);
      expect(scene.doodles.every((doodle) => doodle.delay === 0)).toBe(true);
    });
  });

  describe("镜头帧与涂鸦进度", () => {
    it("镜头随时间推进缓慢推近，暂停时由音乐时间冻结", () => {
      const scene = resolveHandwrittenScene(BASE_INPUT);
      const early = resolveHandwrittenCameraFrame(scene, 10, 10, 20, false, 1);
      const late = resolveHandwrittenCameraFrame(scene, 19, 10, 20, false, 1);
      expect(late.zoom).toBeGreaterThan(early.zoom);
      expect(resolveHandwrittenCameraFrame(scene, 10, 10, 20, false, 1)).toEqual(early);
    });

    it("减少动态时镜头完全静止", () => {
      const scene = resolveHandwrittenScene({ ...BASE_INPUT, reducedMotion: true });
      expect(resolveHandwrittenCameraFrame(scene, 15, 10, 20, true, 1)).toEqual({
        zoom: 1,
        x: 0,
        y: 0,
        rotation: 0,
      });
    });

    it("涂鸦在延迟前为 0，画完后为 1", () => {
      const doodle: HandwrittenDoodleSpec = {
        kind: "wave",
        x: 0.5,
        y: 0.5,
        scale: 1,
        rotation: 0,
        delay: 0.25,
        duration: 0.75,
        color: "pencil",
        layer: "back",
        flip: false,
      };
      const start = 10;
      expect(resolveDoodleProgress(doodle, start, start)).toBe(0);
      expect(
        resolveDoodleProgress(doodle, start + doodle.delay + doodle.duration + 0.01, start)
      ).toBe(1);
    });

    it("镜头漂移是确定的数值噪声，不会出现 NaN 或跳变", () => {
      const scene = resolveHandwrittenScene(BASE_INPUT);
      const first = resolveHandwrittenCameraFrame(scene, 24.5, 20, 30, false, 1);
      const second = resolveHandwrittenCameraFrame(scene, 24.5, 20, 30, false, 1);
      expect(first).toEqual(second);
      expect(Number.isFinite(first.x)).toBe(true);
      expect(Number.isFinite(first.y)).toBe(true);
      expect(Number.isFinite(first.rotation)).toBe(true);
      expect(Math.abs(first.x)).toBeLessThan(6);
      expect(Math.abs(first.y)).toBeLessThan(6);
      expect(first.zoom).toBeGreaterThan(0.99);
      expect(first.zoom).toBeLessThan(1.08);
    });
  });

  describe("页面装饰与大幅线稿", () => {
    it("歌词页的实体细节：胶带压住内容或页边，可选第二件实物，单页 ≤2", () => {
      const secondKinds = new Set<string>();
      for (let index = 0; index < 12; index += 1) {
        const scene = resolveHandwrittenScene({
          ...BASE_INPUT,
          seed: `song-1:shot:${index}`,
        });
        expect(scene.decorations.length).toBeGreaterThanOrEqual(1);
        expect(scene.decorations.length).toBeLessThanOrEqual(2);
        expect(scene.decorations[0]?.kind).toBe("tape");
        for (const decoration of scene.decorations) {
          expect(decoration.x).toBeGreaterThanOrEqual(0);
          expect(decoration.x).toBeLessThanOrEqual(1);
          expect(decoration.y).toBeGreaterThanOrEqual(0);
          expect(decoration.y).toBeLessThanOrEqual(1);
          expect(decoration.scale).toBeGreaterThan(0);
          expect([
            "tape",
            "paperclip",
            "postageStamp",
            "fold",
            "seal",
            "scrap",
            "polaroid",
          ]).toContain(decoration.kind);
          if (decoration.kind === "scrap" || decoration.kind === "polaroid") {
            expect(decoration.caption?.length).toBeGreaterThan(0);
          }
        }
        scene.decorations.slice(1).forEach((decoration) => secondKinds.add(decoration.kind));
      }
      expect(secondKinds.size).toBeGreaterThanOrEqual(2);
    });

    it("歌词页不再把小图标撒在文字块与四角", () => {
      for (let index = 0; index < 12; index += 1) {
        const scene = resolveHandwrittenScene({
          ...BASE_INPUT,
          seed: `song-1:shot:${index}`,
        });
        expect(scene.doodles.length).toBe(0);
      }
    });

    it("歌词页的页边小字是日期与页码，不是随机角标", () => {
      for (let index = 0; index < 8; index += 1) {
        const scene = resolveHandwrittenScene({
          ...BASE_INPUT,
          seed: `song-1:shot:${index}`,
        });
        expect(scene.notes.length).toBeGreaterThanOrEqual(2);
        expect(scene.notes.length).toBeLessThanOrEqual(3);
        const date = scene.notes.find((note) => note.kind === "date");
        expect(date?.text).toMatch(/^2026\.\d{2}\.\d{2}$/u);
        expect(scene.notes.some((note) => note.kind === "page")).toBe(true);
        for (const note of scene.notes) {
          expect(note.text.length).toBeGreaterThan(0);
          expect(note.x).toBeGreaterThanOrEqual(0);
          expect(note.x).toBeLessThanOrEqual(1);
          expect(note.y).toBeGreaterThanOrEqual(0);
          expect(note.y).toBeLessThanOrEqual(1);
          expect(note.scale).toBeGreaterThan(0.1);
          expect(Math.abs(note.rotation)).toBeLessThan(0.2);
        }
      }
    });

    it("大幅线稿只有一张、放在文字相反一侧", () => {
      for (let index = 0; index < 12; index += 1) {
        const scene = resolveHandwrittenScene({
          ...BASE_INPUT,
          seed: `song-1:shot:${index}`,
        });
        expect(scene.illustrations.length).toBe(1);
        const illustration = scene.illustrations[0]!;
        expect(illustration.scale).toBeGreaterThan(0.5);
        expect(illustration.scale).toBeLessThan(3);
        expect(illustration.layer).toBe("back");
        if (scene.anchorX > 0.5) expect(illustration.x).toBeLessThan(0.5);
        else expect(illustration.x).toBeGreaterThan(0.5);
      }
    });

    it("歌词页在编辑手稿、左右分栏与明信片三类构图间切换", () => {
      const layouts = new Set<string>();
      for (let index = 0; index < 60; index += 1) {
        layouts.add(
          resolveHandwrittenScene({ ...BASE_INPUT, seed: `layout-probe:${index}` }).layout
        );
      }
      expect(layouts.size).toBe(3);
      expect([...layouts].every((layout) => ["left", "right", "postcard"].includes(layout))).toBe(
        true
      );
    });

    it("片尾排版变体在三种形式之间切换", () => {
      const variants = new Set<string>();
      for (let index = 0; index < 40; index += 1) {
        variants.add(
          resolveHandwrittenScene({ ...BASE_INPUT, seed: `credits-probe:${index}` }).creditsVariant
        );
      }
      expect(variants.size).toBe(3);
    });

    it("歌词镜头只使用少数可复用的构图家族", () => {
      const layouts = new Set<string>();
      for (let index = 0; index < 80; index += 1) {
        layouts.add(
          resolveHandwrittenScene({ ...BASE_INPUT, seed: `composition:${index}` }).layout
        );
      }

      expect(layouts.size).toBeLessThanOrEqual(3);
      expect([...layouts].every((layout) => ["left", "right", "postcard"].includes(layout))).toBe(
        true
      );
    });

    it("歌词页的主体速写至少占画面高度的三分之一", () => {
      const height = BASE_INPUT.height;
      const scene = resolveHandwrittenScene(BASE_INPUT);
      const illustration = scene.illustrations[0];
      expect(illustration).toBeDefined();

      // 速写局部路径约跨越两个 unit；用相对画布尺寸衡量，避免锁定某个随机 scale。
      const projectedHeight = illustration!.scale * Math.min(BASE_INPUT.width, height) * 0.08 * 2;
      expect(projectedHeight).toBeGreaterThanOrEqual(height / 3);
    });

    it("歌词页的视觉锚点预算：涂鸦 0、实体 ≤2、页边小字 ≤3", () => {
      const scene = resolveHandwrittenScene(BASE_INPUT);

      expect(scene.notes.length).toBeLessThanOrEqual(3);
      expect(scene.doodles.length).toBeLessThanOrEqual(1);
      expect(scene.decorations.length).toBeLessThanOrEqual(2);
    });

    it("歌词块的预留区域在宽屏与竖屏都留在安全边界内", () => {
      for (const [width, height] of [
        [1920, 1080],
        [390, 844],
        [2560, 1080],
      ] as const) {
        for (let index = 0; index < 40; index += 1) {
          const scene = resolveHandwrittenScene({
            ...BASE_INPUT,
            width,
            height,
            seed: `bounds:${width}:${height}:${index}`,
          });
          const left = scene.anchorX - scene.maxWidthRatio / 2;
          const right = scene.anchorX + scene.maxWidthRatio / 2;
          expect(left).toBeGreaterThanOrEqual(0.04);
          expect(right).toBeLessThanOrEqual(0.96);
        }
      }
    });

    it("竖屏把速写放在上半页、把主歌词横向铺开到下半页", () => {
      const scene = resolveHandwrittenScene({
        ...BASE_INPUT,
        width: 390,
        height: 844,
      });
      const sketch = scene.illustrations[0];

      expect(scene.layout).toBe("postcard");
      expect(scene.anchorX).toBe(0.5);
      expect(scene.anchorY).toBeGreaterThanOrEqual(0.58);
      expect(scene.anchorY).toBeLessThanOrEqual(0.66);
      expect(scene.maxWidthRatio).toBeGreaterThanOrEqual(0.78);
      expect(sketch?.x).toBe(0.5);
      expect(sketch?.y).toBeLessThan(0.4);
      expect(sketch?.scale).toBeGreaterThanOrEqual(4.5);
    });

    it("为纯器乐段安排中央线稿主体与标题落款空间", () => {
      const scene = resolveHandwrittenScene({ ...BASE_INPUT, shotKind: "instrumental" });
      const sketch = scene.illustrations[0];

      expect(scene.layout).toBe("center");
      expect(scene.anchorX).toBe(0.5);
      expect(sketch?.x).toBe(0.5);
      expect(sketch?.y).toBeGreaterThanOrEqual(0.36);
      expect(sketch?.y).toBeLessThanOrEqual(0.5);
      expect(sketch?.scale).toBeGreaterThanOrEqual(3.5);
    });
  });

  describe("相机的音乐时间连续性", () => {
    it("不会在句群边界把镜头位移收回原点", () => {
      const scene = resolveHandwrittenScene(BASE_INPUT);
      const end = resolveHandwrittenCameraFrame(scene, 20, 10, 20, false, 1);

      expect(Math.hypot(end.x, end.y)).toBeGreaterThan(0.05);
    });

    it("从不同时间顺序 seek 到同一时刻会得到同一镜头帧", () => {
      const scene = resolveHandwrittenScene(BASE_INPUT);
      const times = [10.2, 12.5, 19.8, 15.4];
      const forward = times.map((time) =>
        resolveHandwrittenCameraFrame(scene, time, 10, 20, false, 1)
      );
      const reverse = [...times]
        .reverse()
        .map((time) => resolveHandwrittenCameraFrame(scene, time, 10, 20, false, 1));

      expect(reverse.reverse()).toEqual(forward);
    });
  });

  describe("语义配图", () => {
    it("歌词里的具体意象会替换插画主题", () => {
      expect(resolveSemanticIllustrationKind("还记得你说家是唯一的城堡", "seed")).toBe("window");
      expect(resolveSemanticIllustrationKind("童年的纸飞机 现在终于飞回我手里", "seed")).toBe(
        "paperplane"
      );
      expect(resolveSemanticIllustrationKind("不要哭让萤火虫带着你逃跑", "seed")).toBe("rain");
      expect(resolveSemanticIllustrationKind("阳光洒在路上就不怕心碎", "seed")).toBe("sun");
      expect(resolveSemanticIllustrationKind("回家吧 回到最初的美好", "seed")).toBe("window");
      expect(resolveSemanticIllustrationKind("随着稻香河流继续奔跑", "seed")).toMatch(
        /^(wheat|sprig|flower)$/u
      );
    });

    it("没有具体意象时返回 null，且同输入同一结果", () => {
      expect(resolveSemanticIllustrationKind("多少人为生命在努力勇敢的走下去", "seed")).toBeNull();
      expect(resolveSemanticIllustrationKind("   ", "seed")).toBeNull();
      const first = resolveSemanticIllustrationKind("随着稻香河流继续奔跑", "seed-2");
      expect(resolveSemanticIllustrationKind("随着稻香河流继续奔跑", "seed-2")).toBe(first);
    });

    it("叶/山也有对应主题，并给出配套笔触", () => {
      expect(resolveSemanticIllustrationKind("一片叶子落在书页上", "seed")).toBe("leaf");
      expect(resolveSemanticIllustrationKind("远处的山坡", "seed")).toBe("mountain");
      expect(resolveIllustrationAccent("paperplane")).toBe("speed");
      expect(resolveIllustrationAccent("rain")).toBe("drops");
      expect(resolveIllustrationAccent("moon")).toBe("sparkle");
      expect(resolveIllustrationAccent("window")).toBe("sill");
      expect(resolveIllustrationAccent("leaf")).toBeNull();
    });
  });
});
