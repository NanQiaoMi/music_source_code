/**
 * Network Priority Manager
 * 
 * 严格三级优先级网络调度队列：
 * - P0 (Critical): 音频流代理 (/api/audio/proxy)、音频直链嗅探 (独占通道，零等待)
 * - P1 (High): 当前播放曲目歌词、高清专辑封面
 * - P2 (Background): AI 歌词笔记生成 (/api/ai/chat)、后台大歌单离线同步、预拉取
 * 
 * 调度规则：
 * - 当音频处于拉流加载或缓冲中断时 (isAudioBuffering = true)，自动挂起 P2 任务，保障带宽与 TCP 连接池；
 * - 音频平稳播放或就绪后，唤醒并放行 P2 队列任务。
 */

export enum NetworkPriority {
  P0_AUDIO_STREAM = 0,
  P1_METADATA = 1,
  P2_BACKGROUND = 2,
}

class NetworkPriorityManagerService {
  private static instance: NetworkPriorityManagerService;
  private isBuffering: boolean = false;
  private pendingP2Queue: Array<() => void> = [];
  private activeP1Count: number = 0;
  private readonly MAX_CONCURRENT_P1 = 3;

  public static getInstance(): NetworkPriorityManagerService {
    if (!NetworkPriorityManagerService.instance) {
      NetworkPriorityManagerService.instance = new NetworkPriorityManagerService();
    }
    return NetworkPriorityManagerService.instance;
  }

  public setAudioBuffering(buffering: boolean): void {
    const prev = this.isBuffering;
    this.isBuffering = buffering;

    if (prev && !buffering) {
      // 从缓冲状态恢复，释放挂起的 P2 任务
      this.drainP2Queue();
    }
  }

  public isAudioBuffering(): boolean {
    return this.isBuffering;
  }

  public async schedule<T>(
    priority: NetworkPriority,
    task: () => Promise<T>,
    options?: { signal?: AbortSignal }
  ): Promise<T> {
    if (options?.signal?.aborted) {
      return Promise.reject(new DOMException("Aborted", "AbortError"));
    }

    // P0: 绝对最高优先级，零延迟立即穿透
    if (priority === NetworkPriority.P0_AUDIO_STREAM) {
      return task();
    }

    // P1: 元数据高优先级（歌词、封面），轻度限流防抖
    if (priority === NetworkPriority.P1_METADATA) {
      while (this.activeP1Count >= this.MAX_CONCURRENT_P1) {
        await new Promise((resolve) => setTimeout(resolve, 50));
        if (options?.signal?.aborted) {
          return Promise.reject(new DOMException("Aborted", "AbortError"));
        }
      }
      this.activeP1Count++;
      try {
        return await task();
      } finally {
        this.activeP1Count = Math.max(0, this.activeP1Count - 1);
      }
    }

    // P2: 后台次要任务（AI笔记、预加载），当音频拉流缓冲时自动挂起等待
    if (priority === NetworkPriority.P2_BACKGROUND) {
      if (this.isBuffering) {
        await new Promise<void>((resolve, reject) => {
          if (options?.signal?.aborted) {
            return reject(new DOMException("Aborted", "AbortError"));
          }

          const onAbort = () => {
            const index = this.pendingP2Queue.indexOf(resume);
            if (index !== -1) this.pendingP2Queue.splice(index, 1);
            reject(new DOMException("Aborted", "AbortError"));
          };

          const resume = () => {
            options?.signal?.removeEventListener("abort", onAbort);
            resolve();
          };

          options?.signal?.addEventListener("abort", onAbort, { once: true });
          this.pendingP2Queue.push(resume);
        });
      }

      return task();
    }

    return task();
  }

  private drainP2Queue(): void {
    while (this.pendingP2Queue.length > 0 && !this.isBuffering) {
      const next = this.pendingP2Queue.shift();
      if (next) next();
    }
  }

  public clearQueue(): void {
    this.pendingP2Queue = [];
    this.activeP1Count = 0;
  }
}

export const networkPriorityManager = NetworkPriorityManagerService.getInstance();
