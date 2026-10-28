/**
 * S5-4 测试工具：记录 Canvas2D 的调用序列（方法调用 + 属性赋值），
 * 用来断言"插件绘制结果与旧绘制函数逐条一致"，即绘制代码确实只是搬家、没有改行为。
 */
export type RecordedCanvasCall = [name: string, ...args: unknown[]];

export interface RecordingCanvasContext {
  context: CanvasRenderingContext2D;
  calls: RecordedCanvasCall[];
}

export function createRecordingCanvasContext(width = 1024, height = 768): RecordingCanvasContext {
  const calls: RecordedCanvasCall[] = [];
  const state = new Map<PropertyKey, unknown>();
  const gradient = {
    addColorStop(position: number, color: string) {
      calls.push(["gradient.addColorStop", position, color]);
    },
  };
  const context = new Proxy(
    {
      canvas: { width, height },
      createLinearGradient: (...args: number[]) => {
        calls.push(["createLinearGradient", ...args]);
        return gradient;
      },
      createRadialGradient: (...args: number[]) => {
        calls.push(["createRadialGradient", ...args]);
        return gradient;
      },
    },
    {
      get(target, property, receiver) {
        if (Reflect.has(target, property)) return Reflect.get(target, property, receiver);
        if (!state.has(property)) {
          state.set(property, (...args: unknown[]) => {
            calls.push([String(property), ...args]);
          });
        }
        return state.get(property);
      },
      set(_target, property, value) {
        // 渐变对象跨两次录制不是同一个引用，用占位符保证两份序列可比
        calls.push([`set:${String(property)}`, value === gradient ? "<gradient>" : value]);
        return true;
      },
    }
  ) as unknown as CanvasRenderingContext2D;
  return { context, calls };
}
