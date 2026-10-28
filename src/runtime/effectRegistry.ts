import type { VisualizationEffect } from "@/store/visualizationStore";
import type { EffectPlugin } from "./effectPlugin";

export type EffectPluginFactory = () => EffectPlugin;

/** 双跑期缓存上限：当前效果 + 上一个效果，切换 20 轮后已加载实例数仍 ≤2（S5-4 验收）。 */
export const EFFECT_PLUGIN_CACHE_SIZE = 2;

/**
 * S5-4：效果 id → 插件工厂的注册表，实例按 LRU 缓存（默认 2 个）。
 * 重复注册直接抛错；被淘汰或 release 的实例先 dispose() 再丢弃，下次 get() 由工厂重建。
 */
export class EffectRegistry {
  private readonly factories = new Map<VisualizationEffect, EffectPluginFactory>();
  private readonly instances = new Map<VisualizationEffect, EffectPlugin>();

  constructor(private readonly capacity: number = EFFECT_PLUGIN_CACHE_SIZE) {
    if (capacity < 1) throw new RangeError("[effectRegistry] capacity must be >= 1");
  }

  register(id: VisualizationEffect, factory: EffectPluginFactory): void {
    if (this.factories.has(id)) {
      throw new Error(`[effectRegistry] duplicate registration for "${id}"`);
    }
    this.factories.set(id, factory);
  }

  has(id: VisualizationEffect): boolean {
    return this.factories.has(id);
  }

  /** 已注册的效果 id（注册顺序）。 */
  ids(): VisualizationEffect[] {
    return Array.from(this.factories.keys());
  }

  /** 取插件实例：命中缓存刷新 LRU 位置；未注册返回 null（调用方回退旧 switch）。 */
  get(id: VisualizationEffect): EffectPlugin | null {
    const cached = this.instances.get(id);
    if (cached) {
      this.touch(id, cached);
      return cached;
    }
    const factory = this.factories.get(id);
    if (!factory) return null;
    const plugin = factory();
    this.instances.set(id, plugin);
    this.evictOverflow();
    return plugin;
  }

  /** 缓存中的效果 id，按最近使用顺序（最旧在前）。 */
  getLoadedEffects(): VisualizationEffect[] {
    return Array.from(this.instances.keys());
  }

  /** 释放单个实例并 dispose；未加载时无事发生。 */
  release(id: VisualizationEffect): void {
    const plugin = this.instances.get(id);
    if (!plugin) return;
    this.instances.delete(id);
    plugin.dispose();
  }

  /** 卸载路径：释放并 dispose 全部缓存实例。 */
  disposeAll(): void {
    for (const id of Array.from(this.instances.keys())) this.release(id);
  }

  private touch(id: VisualizationEffect, plugin: EffectPlugin): void {
    this.instances.delete(id);
    this.instances.set(id, plugin);
  }

  /** 超出容量的最旧实例先 dispose 再丢弃；刚加入的实例排在最后，不会被误淘汰。 */
  private evictOverflow(): void {
    while (this.instances.size > this.capacity) {
      const oldest = this.instances.keys().next().value as VisualizationEffect;
      this.release(oldest);
    }
  }
}

export function createEffectRegistry(capacity = EFFECT_PLUGIN_CACHE_SIZE): EffectRegistry {
  return new EffectRegistry(capacity);
}
