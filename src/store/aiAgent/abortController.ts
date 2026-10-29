// S6-12o: 请求中止句柄的唯一 owner（原 useAIAgentStore.ts 模块级变量），
// 会话/消息/面板动作共享同一个可变单例，行为与拆分前一致。
let currentAbortController: AbortController | null = null;

export function getAbortController(): AbortController | null {
  return currentAbortController;
}

export function setAbortController(controller: AbortController | null): void {
  currentAbortController = controller;
}

export function abortPendingRequest(): void {
  if (currentAbortController) {
    currentAbortController.abort();
    currentAbortController = null;
  }
}
