/**
 * First-sound source resolver (S1-9)
 *
 * 离线下载 / 本地导入 / 网络缓存 / 网络解析四路在 t0 并发启动，先成功者胜出：
 * - 胜出后立刻 abort 其余候选（IDB 读取不可取消，读完后在 race signal 上补检查点）；
 * - 晚到的候选若已创建 Blob URL，会在这里调用它自己的 cleanup，避免泄漏；
 * - 全部失败或调用方 abort 时返回 null，由调用方走既有兜底/抢救路径。
 */
import { throwIfAborted } from "./requestCoordinator";

export type FirstSoundKind = "offline" | "local" | "cache" | "resolved";

export interface FirstSoundCandidate {
  kind: FirstSoundKind;
  url: string;
  cleanup?: () => void;
}

/**
 * 四个候选读取函数由调用方按当前歌曲闭包绑定；接口保留计划里的 id/source 形参，
 * 但 resolveFirstSound 本身没有歌曲上下文，因此用下面的 BOUND_* 占位调用，
 * 真实 id/source 由闭包捕获（hook 侧即如此接线）。
 */
export interface FirstSoundDeps {
  getOfflineAudio: (id: string) => Promise<{ url: string; cleanup?: () => void } | null>;
  getStoredMusic: (id: string) => Promise<{ url: string; cleanup?: () => void } | null>;
  getCachedAudio: (
    id: string,
    source: string
  ) => Promise<{ url: string; cleanup?: () => void } | null>;
  resolvePlayableAudio: (signal: AbortSignal) => Promise<{ url: string } | null>;
}

interface RawCandidate {
  url: string;
  cleanup?: () => void;
}

const BOUND_ID = "";
const BOUND_SOURCE = "";

/** cleanup 绝不能把已经成功的首声变成失败，也不能阻塞其他候选。 */
function runCleanup(cleanup?: () => void): void {
  if (!cleanup) return;
  try {
    cleanup();
  } catch {
    // 释放 Blob URL 失败不影响播放；忽略即可
  }
}

export async function resolveFirstSound(
  deps: FirstSoundDeps,
  signal: AbortSignal
): Promise<FirstSoundCandidate | null> {
  try {
    throwIfAborted(signal);
  } catch {
    // 调用方已经取消：不启动任何候选
    return null;
  }

  const losers = new AbortController();
  const raceSignal = losers.signal;
  let done = false;
  let resolveAborted: (() => void) | null = null;

  const onExternalAbort = (): void => {
    done = true;
    if (!raceSignal.aborted) losers.abort(signal.reason);
    resolveAborted?.();
  };
  signal.addEventListener("abort", onExternalAbort, { once: true });

  const aborted = new Promise<null>((resolve) => {
    resolveAborted = () => resolve(null);
  });

  const candidates: Array<{ kind: FirstSoundKind; run: () => Promise<RawCandidate | null> }> = [
    { kind: "offline", run: () => deps.getOfflineAudio(BOUND_ID) },
    { kind: "local", run: () => deps.getStoredMusic(BOUND_ID) },
    { kind: "cache", run: () => deps.getCachedAudio(BOUND_ID, BOUND_SOURCE) },
    { kind: "resolved", run: () => deps.resolvePlayableAudio(raceSignal) },
  ];

  const firstSuccess = new Promise<FirstSoundCandidate | null>((resolve) => {
    let failures = 0;

    candidates.forEach(({ kind, run }) => {
      void (async () => {
        let raw: RawCandidate | null = null;
        let ok = true;
        try {
          raw = await run();
          // IDB 读完后补检查点：胜出/取消后晚到的结果一律丢弃（cleanup 兜底）
          throwIfAborted(raceSignal);
        } catch {
          // run() 失败或 race signal 已 abort：晚到的 raw 由下面的 done 分支统一 cleanup
          ok = false;
        }

        if (done) {
          runCleanup(raw?.cleanup);
          return;
        }
        if (ok && raw?.url) {
          done = true;
          resolve({ kind, url: raw.url, cleanup: raw.cleanup });
          if (!raceSignal.aborted) {
            losers.abort(new DOMException("First sound already resolved", "AbortError"));
          }
          return;
        }
        runCleanup(raw?.cleanup);
        failures += 1;
        if (failures === candidates.length) {
          done = true;
          resolve(null);
        }
      })();
    });
  });

  try {
    const winner = await Promise.race([firstSuccess, aborted]);
    if (signal.aborted) {
      runCleanup(winner?.cleanup);
      return null;
    }
    return winner;
  } finally {
    signal.removeEventListener("abort", onExternalAbort);
  }
}
