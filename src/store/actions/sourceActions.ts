/**
 * S6-10a：MultiSourceResolver 的 store 命令式入口。
 *
 * 与 serviceActions 分文件：useOfflineDownloadStore 运行时 import MultiSourceResolver，
 * 若 MultiSourceResolver 反向 import 含离线下载的 serviceActions 会形成模块环。
 */
import { useSourceConfigStore } from "@/store/sourceConfigStore";
import { useUserAccountStore } from "@/store/userAccountStore";

export function getSourceConfigSnapshot() {
  const { sources, lxScripts, resolutionMode } = useSourceConfigStore.getState();
  return { sources, lxScripts, resolutionMode };
}

export function getPlatformCookie(platform?: string): string {
  return useUserAccountStore.getState().getPlatformCookie(platform);
}
