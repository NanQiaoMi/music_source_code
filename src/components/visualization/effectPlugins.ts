import { featureFlags } from "@/lib/perf/featureFlags";
import type { EffectPlugin } from "@/runtime/effectPlugin";
import { createEffectRegistry } from "@/runtime/effectRegistry";
import type { VisualizationEffect } from "@/store/visualizationStore";
import { NebulaFieldPlugin } from "./effects/nebulaFieldPlugin";
import { SpatialMeshPlugin } from "./effects/spatialMeshPlugin";

/**
 * S5-4：V7 效果插件注册表（试点 2 个）。
 * 迁移一个效果 = 在这里注册一个 id；VisualizationView 每帧按当前效果取插件，
 * 未注册的效果继续走旧 switch，NEXT_PUBLIC_EFFECT_PLUGINS=off 时全部回退旧路径。
 */
export const effectRegistry = createEffectRegistry();
effectRegistry.register("spatialMesh", () => new SpatialMeshPlugin());
effectRegistry.register("nebulaField", () => new NebulaFieldPlugin());

/** flag on 且该效果已迁移时返回插件实例；未迁移 / flag off / 工厂异常都返回 null（调用方走旧 switch）。 */
export function resolveEffectPlugin(
  id: VisualizationEffect,
  enabled: boolean = featureFlags.effectPlugins
): EffectPlugin | null {
  if (!enabled) return null;
  try {
    return effectRegistry.get(id);
  } catch (error) {
    console.error("[effectPlugins] failed to create plugin", id, error);
    return null;
  }
}
