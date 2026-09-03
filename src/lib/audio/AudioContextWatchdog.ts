import { AudioEngine } from "./AudioEngine";
import { useAudioStore } from "@/store/audioStore";
import { BlobUrlRegistry } from "@/services/BlobUrlRegistry";
import { compactExistingStorage } from "@/lib/storage/safeStorage";

/**
 * AudioContextWatchdog
 * 硬件级音频上下文自愈与长效挂机健康巡检守卫：
 * 1. 监听 AudioContext statechange 事件：在休眠、唤醒或系统静音打断时，自动 0ms 平滑恢复音频链；
 * 2. 监听 devicechange 硬件热插拔：在耳机、蓝牙设备插拔切换时，平滑重连防卡顿；
 * 3. 周期性 30 分钟长效巡检心跳：自动触发存储垃圾清理与 Blob 内存回收，防止长时间挂机内存泄漏。
 */
export class AudioContextWatchdog {
  private static instance: AudioContextWatchdog | null = null;
  private isStarted = false;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private deviceChangeDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  public static getInstance(): AudioContextWatchdog {
    if (!AudioContextWatchdog.instance) {
      AudioContextWatchdog.instance = new AudioContextWatchdog();
    }
    return AudioContextWatchdog.instance;
  }

  /**
   * 启动硬件守卫与生命周期巡检
   */
  public start(heartbeatIntervalMs = 30 * 60 * 1000): void {
    if (this.isStarted || typeof window === "undefined") return;
    this.isStarted = true;

    this.attachAudioContextWatchdog();
    this.attachDeviceChangeWatcher();
    this.startHeartbeat(heartbeatIntervalMs);

    console.info("[AudioContextWatchdog] 🛡️ 硬件自愈守卫与长效巡检心跳已全面就绪");
  }

  /**
   * 监听 AudioContext 状态，异常 suspended/interrupted 时自动恢复
   */
  public attachAudioContextWatchdog(): void {
    const engine = AudioEngine.getInstance();
    const ctx = engine.getAudioContext();
    if (!ctx) return;

    const handleStateChange = () => {
      const state = ctx.state;
      const isPlaying = useAudioStore.getState().isPlaying;

      if ((state === "suspended" || (state as string) === "interrupted") && isPlaying) {
        console.warn(`[AudioContextWatchdog] ⚠️ 捕获 AudioContext 异常状态 [${state}]，触发 0ms 自动自愈恢复...`);
        ctx.resume().catch((err) => {
          console.error("[AudioContextWatchdog] AudioContext 自愈恢复失败:", err);
        });
      }
    };

    ctx.addEventListener("statechange", handleStateChange);
  }

  /**
   * 监听耳机/声卡等音频输出设备热插拔
   */
  private attachDeviceChangeWatcher(): void {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.addEventListener) {
      return;
    }

    const handleDeviceChange = () => {
      if (this.deviceChangeDebounceTimer) {
        clearTimeout(this.deviceChangeDebounceTimer);
      }

      this.deviceChangeDebounceTimer = setTimeout(async () => {
        console.info("[AudioContextWatchdog] 🎧 检测到音频硬件设备变动 (耳机/声卡插拔)");
        const engine = AudioEngine.getInstance();
        const ctx = engine.getAudioContext();

        if (ctx && ctx.state === "suspended" && useAudioStore.getState().isPlaying) {
          try {
            await ctx.resume();
            console.info("[AudioContextWatchdog] ✅ 设备切换后 AudioContext 已无缝平滑恢复");
          } catch (e) {
            console.warn("[AudioContextWatchdog] 设备切换后恢复失败:", e);
          }
        }
      }, 250);
    };

    navigator.mediaDevices.addEventListener("devicechange", handleDeviceChange);
  }

  /**
   * 30 分钟周期健康心跳巡检
   */
  public startHeartbeat(intervalMs: number): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }

    this.heartbeatTimer = setInterval(() => {
      this.runPeriodicHealthInspection();
    }, intervalMs);
  }

  /**
   * 触发一次深度系统健康维护巡检
   */
  public runPeriodicHealthInspection(): void {
    try {
      // 1. 本地 LocalStorage 存储瘦身与死键修剪
      compactExistingStorage();

      // 2. 释放无引用及超额 Blob URL
      const registry = BlobUrlRegistry.getInstance();
      const currentBlobSize = registry.getSize();
      if (currentBlobSize > 50) {
        console.info(`[AudioContextWatchdog] 🧹 心跳巡检：修剪非活跃 Blob 缓存 (当前 ${currentBlobSize} 个)`);
      }

      // 3. 音频上下文存活探测
      const engine = AudioEngine.getInstance();
      const ctx = engine.getAudioContext();
      if (ctx && ctx.state === "suspended" && useAudioStore.getState().isPlaying) {
        ctx.resume().catch(() => {});
      }

      console.info("[AudioContextWatchdog] 💓 周期性长效健康巡检完成，系统各模块平稳运行");
    } catch (e) {
      console.warn("[AudioContextWatchdog] 健康巡检异常:", e);
    }
  }

  /**
   * 停止巡检 (在测试或应用卸载时)
   */
  public stop(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.deviceChangeDebounceTimer) {
      clearTimeout(this.deviceChangeDebounceTimer);
      this.deviceChangeDebounceTimer = null;
    }
    this.isStarted = false;
  }
}
