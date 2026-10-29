# ADR 0006: 主题单一所有者（themeStore）

- 状态: Proposed（**D6 未拍板**；S6-7 已按推荐 A 的默认假设实现，待用户追认）
- 日期: 2026-10-21（提议）/ 2026-10-29（补录）
- 关联: D6、S6-6/S6-7、S3-2
- 决策人: 待用户

## 背景

- 主题状态有 3 条来源：uiStore.themeColors/themeMode/isDynamicTheme、visualSettingsStore.currentTheme 等、CSS 变量。
- layout.tsx 固定 `className="dark"`；切换时可能多写/闪烁，且 CSS 变量存在双写。

## 决策（推荐 A）

新建 themeStore 独占 `themeMode/themeColors/isDynamicTheme` + setter：

- uiStore 三个 theme 字段降级为**写时投影**（单向同步，一次切换 = 一次写盘）；
- CSS 变量单点：`useThemeVars` 唯一写入 `html class` + `--theme-*`；
- 首帧防闪：`ThemeBootScript` 在 hydration 前读持久化 themeMode；
- 持久化 key/格式不变（仍 `ui-store-v2`，不新增 `theme-store-v1`）。

替代方案 B：uiStore 独占，visualSettingsStore 只留视觉参数（语义较混，未采用）。

## 现状（2026-10-29 补录）

S6-7 已按 A 落地：`src/store/themeStore.ts`（transient，不挂 persist、不进 storageRegistry）、`src/hooks/useThemeVars.ts`、`src/components/layout/ThemeBootScript.tsx`；uiStore 为投影；`themeSource.contract` 7 例 + themeStore 6 例 + useThemeVars 5 例 + ThemeBootScript 5 例通过。**D6 本身仍 Pending**（本 ADR 保持 Proposed，批准后转 Accepted）。

## 影响

- S6-6/S6-7、S3-2（theme 订阅）；主题相关契约测试已就位。

## 验收

主题来源唯一（静态扫描）；切歌/切换主题不闪；旧 visual-settings-v4 主题字段迁移后删除；ui-store-v2 payload 形状不变。
