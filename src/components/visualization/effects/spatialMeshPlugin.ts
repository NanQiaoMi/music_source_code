import {
  applyEffectFrame,
  createEmptyEffectRefs,
  createPluginEffectContext,
  type EffectFrame,
  type EffectInitContext,
  type EffectPlugin,
} from "@/runtime/effectPlugin";
import { drawSpatialMesh } from "./spatialMesh";
import type { EffectContext } from "./types";

/**
 * S5-4b：spatialMesh 试点插件。绘制体仍留在 spatialMesh.ts（旧导出原样保留给 flag off 路径），
 * 插件只接管生命周期，并把 smoothBass/smoothTreble 从共享 refs 移到实例自持。
 */
export class SpatialMeshPlugin implements EffectPlugin {
  readonly id = "spatialMesh" as const;
  readonly budget = { maxParticles: 0 };

  private readonly bass = { current: 0 };
  private readonly treble = { current: 0 };
  private readonly refs: EffectContext["refs"] = createEmptyEffectRefs();
  private readonly view: EffectContext = createPluginEffectContext(this.refs);

  constructor() {
    this.refs.smoothBass = this.bass;
    this.refs.smoothTreble = this.treble;
  }

  init(_size: EffectInitContext): void {
    this.bass.current = 0;
    this.treble.current = 0;
  }

  resize(_width: number, _height: number, _dpr: number): void {
    // 纯 Canvas2D 绘制，不持有离屏画布/纹理/尺寸缓存，尺寸变化无需重建资源。
  }

  draw(frame: EffectFrame): void {
    applyEffectFrame(this.view, frame);
    drawSpatialMesh(this.view);
  }

  dispose(): void {
    this.bass.current = 0;
    this.treble.current = 0;
  }
}
