/**
 * S6-9a：播放域类型化事件总线（无外部依赖）。
 *
 * domain 用例只负责说明"发生了什么"，订阅方按事件名显式登记，避免用例层反向
 * import 订阅方的 store。派发是同步的：事件在命令改完状态之后发出，订阅方读到
 * 的是更新后的快照；单个订阅方抛错不会中断其他订阅方，也不会影响命令结果。
 */

/** 播放域事件表：事件名 → 载荷。新增事件只需在这里加一行。 */
export type PlaybackEventMap = {
  /** 命令发起了播放（真正出声由 mediaBridge 事件驱动）。 */
  "playback:started": { songId: string; previousSongId: string | null; queued: boolean };
  "playback:resumed": { songId: string | null };
  "playback:paused": { songId: string | null };
  "playback:seeked": { seconds: number; duration: number };
  "playback:track-changed": { from: string | null; to: string | null; direction: "next" | "prev" };
  "playback:volume-changed": { volume: number; previous: number };
  "playback:mute-changed": { isMuted: boolean };
  "playback:rejected": { songId: string; reason: "missing-audio-source" };
};

export type DomainEventMap = PlaybackEventMap;
export type DomainEventName = keyof DomainEventMap;
export type DomainEventHandler<K extends DomainEventName> = (payload: DomainEventMap[K]) => void;

type UntypedHandler = (payload: unknown) => void;

const handlers = new Map<DomainEventName, Set<UntypedHandler>>();

/** 订阅事件，返回退订函数。 */
export function on<K extends DomainEventName>(type: K, handler: DomainEventHandler<K>): () => void {
  const listeners = handlers.get(type) ?? new Set<UntypedHandler>();
  // 注册表按事件名擦除泛型；读侧载荷由 emit 的签名保证，不需要在业务侧断言。
  const untyped = handler as UntypedHandler;
  listeners.add(untyped);
  handlers.set(type, listeners);
  return () => {
    listeners.delete(untyped);
    if (listeners.size === 0) handlers.delete(type);
  };
}

/** 同步派发事件；订阅方异常被隔离，不向调用方冒泡。 */
export function emit<K extends DomainEventName>(type: K, payload: DomainEventMap[K]): void {
  const listeners = handlers.get(type);
  if (!listeners || listeners.size === 0) return;
  for (const handler of Array.from(listeners)) {
    try {
      handler(payload);
    } catch (error) {
      console.error(`[domain-events] "${type}" 订阅方处理失败:`, error);
    }
  }
}

/** 清空订阅（测试/热重载用）；传 type 只清该事件。 */
export function clearDomainEvents(type?: DomainEventName): void {
  if (type) {
    handlers.delete(type);
    return;
  }
  handlers.clear();
}
