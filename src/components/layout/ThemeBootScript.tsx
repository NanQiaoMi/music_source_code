/**
 * S6-7：首帧前主题引导（SSR 无闪烁）。
 *
 * 服务端固定输出 className="dark"（globals.css 的 :root 深色默认值），本脚本在
 * hydration 之前同步读 ui-store-v2（主题的唯一持久化 key，形状不变）里的 themeMode，
 * 把 html class 切成 dark/light；auto 按 prefers-color-scheme 解析。调色板本身由
 * globals.css 的 :root / :root.light 提供，不在这里写 --theme-* 变量（唯一写入方是
 * useThemeVars），所以脚本不需要序列化颜色，也不会与 hydration 抢写。
 *
 * 读取失败（隐私模式 / 坏 JSON / SSR）时保留服务端默认 dark，绝不抛错阻塞首屏。
 */
export const THEME_BOOT_STORAGE_KEY = "ui-store-v2";

export const THEME_BOOT_SCRIPT = `(function () {
  try {
    var raw = window.localStorage.getItem("${THEME_BOOT_STORAGE_KEY}");
    var mode = "dark";
    if (raw) {
      var parsed = JSON.parse(raw);
      mode = (parsed && parsed.state && parsed.state.themeMode) || "dark";
    }
    if (mode === "auto") {
      mode = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    }
    var root = document.documentElement;
    root.classList.toggle("dark", mode === "dark");
    root.classList.toggle("light", mode === "light");
  } catch (error) {
    /* 保持服务端默认 dark */
  }
})();`;

/** 行内同步脚本：必须渲染在 <head>，先于 body 首帧执行。 */
export function ThemeBootScript() {
  return <script id="theme-boot" dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />;
}
