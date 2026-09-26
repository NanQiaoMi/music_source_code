import type { Metadata } from "next";
import "./globals.css";
import { GlobalClientComponents } from "@/components/layout/GlobalClientComponents";
import { PanelErrorBoundary } from "@/components/shared/PanelErrorBoundary";

export const metadata: Metadata = {
  title: "MIMI Music Player",
  description: "沉浸式音乐播放器",
  icons: {
    icon: "/logo.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="dark" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="w-screen h-screen overflow-hidden" suppressHydrationWarning>
        {/* 最后一道防线：任何未被面板级边界捕获的渲染错误都不再把整树卸载成白屏，
            而是降级成可重试的提示。GlobalClientComponents 留在边界外，
            这样媒体会话 / 音频看门狗等全局服务在主界面出错时仍继续运行。 */}
        <PanelErrorBoundary panelName="应用主界面">{children}</PanelErrorBoundary>
        <GlobalClientComponents />
      </body>
    </html>
  );
}
