/**
 * S5-5：共享粒子对象池。resize 只重置坐标、保留对象与数组引用；
 * 只有请求数量超过现有容量时才 push 新对象，容量足够时零分配。
 */
export interface EffectParticle {
  x: number;
  y: number;
  z: number;
  ox: number;
  oy: number;
}

/** 把 pool 调整到 count 个粒子并重新随机化；数组与已有粒子对象都原地复用。 */
export function resizeParticlePool(
  pool: EffectParticle[],
  count: number,
  random: () => number = Math.random
): EffectParticle[] {
  for (let i = pool.length; i < count; i += 1) {
    pool.push({ x: 0, y: 0, z: 0, ox: 0, oy: 0 });
  }
  if (pool.length > count) pool.length = count;

  for (let i = 0; i < count; i += 1) {
    const particle = pool[i];
    particle.x = (random() - 0.5) * 2000;
    particle.y = (random() - 0.5) * 2000;
    particle.z = random() * 2000;
    particle.ox = 0;
    particle.oy = 0;
  }
  return pool;
}
