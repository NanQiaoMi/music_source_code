/**
 * 直链解析的并发竞速工具。
 *
 * 用在「多条互不依赖的解析分支同时发起，但结果要按优先级依次接受」的场合：
 * 全部分支在 t=0 一起跑，接受时按优先级逐个等 —— 因为它们早就并发启动了，
 * "等到"通常只是读一个已经就绪的结果，总耗时接近 max 而不是旧实现的 sum。
 *
 * 约束：所有传入的 Promise **不应 reject**（调用方需自行兜底），
 * 否则会退化成"某条分支失败就整链失败"。
 */

export interface UrlBearing {
  url?: string | null;
}

/** 取第一个给出可用 url 的结果；全部落空则返回 null。 */
export function firstUsable<T extends UrlBearing>(
  branches: (Promise<T | null> | null | undefined)[]
): Promise<T | null> {
  const pending = branches.filter((b): b is Promise<T | null> => Boolean(b));
  if (pending.length === 0) return Promise.resolve(null);

  return new Promise<T | null>((resolve) => {
    let remaining = pending.length;
    for (const branch of pending) {
      branch
        .then((value) => {
          if (value?.url) {
            resolve(value);
          } else if (--remaining === 0) {
            resolve(null);
          }
        })
        .catch(() => {
          if (--remaining === 0) resolve(null);
        });
    }
  });
}

/**
 * 等某个分支给出可用 url，但最多等 `ms` 毫秒；超时返回 null 并把该分支留在后台继续跑。
 * 用于防止高优先级分支长时间无果时挡住已经就绪的低优先级分支。
 */
export function takeWithin<T extends UrlBearing>(
  branch: Promise<T | null> | null | undefined,
  ms: number
): Promise<T | null> {
  if (!branch) return Promise.resolve(null);
  if (ms <= 0) return Promise.resolve(null);

  return new Promise<T | null>((resolve) => {
    let settled = false;
    const finish = (value: T | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(value);
    };
    const timer = setTimeout(() => finish(null), ms);

    branch.then((value) => finish(value?.url ? value : null)).catch(() => finish(null));
  });
}
