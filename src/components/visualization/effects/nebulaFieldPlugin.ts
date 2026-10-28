import {
  applyEffectFrame,
  createEmptyEffectRefs,
  createPluginEffectContext,
  type EffectFrame,
  type EffectInitContext,
  type EffectPlugin,
} from "@/runtime/effectPlugin";
import { drawNebulaField } from "./nebulaField";
import type { EffectContext } from "./types";

/**
 * S5-4c：nebulaField 试点插件。与 legacy 的差别只有状态归属：三档平滑值与星场数组由插件自持。
 * 星场沿用现状（当前没有任何代码填充它 → 空数组），本轮不新增绘制内容；init/dispose 都会清空。
 */
export class NebulaFieldPlugin implements EffectPlugin {
  readonly id = "nebulaField" as const;
  readonly budget = { maxParticles: 800 };

  private readonly bass = { current: 0 };
  private readonly mid = { current: 0 };
  private readonly treble = { current: 0 };
  private readonly stars: unknown[] = [];
  private readonly refs: EffectContext["refs"] = createEmptyEffectRefs();
  private readonly view: EffectContext = createPluginEffectContext(this.refs);

  constructor() {
    this.refs.smoothBass = this.bass;
    this.refs.smoothMid = this.mid;
    this.refs.smoothTreble = this.treble;
    this.refs.nebulaStars = { current: this.stars };
  }

  init(_size: EffectInitContext): void {
    this.resetState();
  }

  resize(_width: number, _height: number, _dpr: number): void {
    // 星场按透视投影每帧现算，不缓存画布尺寸。
  }

  draw(frame: EffectFrame): void {
    applyEffectFrame(this.view, frame);
    drawNebulaField(this.view);
  }

  dispose(): void {
    this.resetState();
  }

  private resetState(): void {
    this.bass.current = 0;
    this.mid.current = 0;
    this.treble.current = 0;
    this.stars.length = 0;
  }
}
