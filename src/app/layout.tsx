import type { Metadata } from "next";
import "./globals.css";
import { GlobalClientComponents } from "@/components/GlobalClientComponents";

export const metadata: Metadata = {
  title: "Vibe Music Player",
  description: "沉浸式音乐播放器",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="dark" suppressHydrationWarning>
      <body className="w-screen h-screen overflow-hidden" suppressHydrationWarning>
        {children}
        <GlobalClientComponents />
      </body>
    </html>
  );
}
