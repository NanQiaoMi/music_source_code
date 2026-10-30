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
        {/* 拦截屏蔽第三方浏览器插件（如币安钱包/MetaMask等）注入脚本抛出的未捕获错误，防止误触发 Next.js 开发时全屏报错遮罩 */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                if (typeof window === 'undefined') return;

                function isIgnored(val) {
                  if (!val) return false;
                  var str = '';
                  if (typeof val === 'string') {
                    str = val;
                  } else if (val instanceof Error) {
                    str = (val.message || '') + ' ' + (val.stack || '');
                  } else if (typeof val === 'object') {
                    try {
                      str = (val.filename || '') + ' ' + (val.message || '') + ' ' + (val.error && val.error.stack || '') + ' ' + (val.reason && val.reason.stack || '') + ' ' + (val.reason && val.reason.message || '') + ' ' + String(val.reason || '') + ' ' + JSON.stringify(val);
                    } catch (_) {
                      str = String(val);
                    }
                  } else {
                    str = String(val);
                  }
                  return (
                    str.indexOf('chrome-extension://') !== -1 ||
                    str.indexOf('moz-extension://') !== -1 ||
                    str.indexOf('cadiboklkpojfamcoggejbbdjcoiljjk') !== -1 ||
                    str.indexOf('sseError') !== -1 ||
                    str.indexOf('inpage.js') !== -1
                  );
                }

                // 1. 劫持 console.error 与 console.warn
                // Next.js 15/16 的 react-dev-overlay 会拦截 console.error，一旦捕获到 Error 就会弹窗
                var origConsoleError = console.error;
                console.error = function() {
                  for (var i = 0; i < arguments.length; i++) {
                    if (isIgnored(arguments[i])) {
                      return;
                    }
                  }
                  return origConsoleError.apply(console, arguments);
                };

                var origConsoleWarn = console.warn;
                console.warn = function() {
                  for (var i = 0; i < arguments.length; i++) {
                    if (isIgnored(arguments[i])) {
                      return;
                    }
                  }
                  return origConsoleWarn.apply(console, arguments);
                };

                // 2. 劫持 window.onerror
                var origOnError = window.onerror;
                window.onerror = function(msg, url, line, col, error) {
                  if (isIgnored(msg) || isIgnored(url) || isIgnored(error)) {
                    return true;
                  }
                  if (typeof origOnError === 'function') {
                    return origOnError.apply(this, arguments);
                  }
                };

                // 3. 劫持 window.onunhandledrejection
                var origOnUnhandledRejection = window.onunhandledrejection;
                window.onunhandledrejection = function(event) {
                  if (event && isIgnored(event.reason)) {
                    if (typeof event.preventDefault === 'function') event.preventDefault();
                    if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
                    return true;
                  }
                  if (typeof origOnUnhandledRejection === 'function') {
                    return origOnUnhandledRejection.apply(this, arguments);
                  }
                };

                // 4. 捕获阶段拦截 error 与 unhandledrejection
                window.addEventListener('error', function(event) {
                  if (isIgnored(event) || isIgnored(event.error) || isIgnored(event.message) || isIgnored(event.filename)) {
                    event.stopImmediatePropagation();
                    event.preventDefault();
                  }
                }, true);

                window.addEventListener('unhandledrejection', function(event) {
                  if (event && (isIgnored(event.reason) || isIgnored(event))) {
                    event.stopImmediatePropagation();
                    event.preventDefault();
                  }
                }, true);

                // 5. DOM 级终极防护：主动监控并关闭由插件报错触发的 nextjs-portal 遮罩
                function cleanupNextJsPortal() {
                  try {
                    var portals = document.querySelectorAll('nextjs-portal');
                    for (var i = 0; i < portals.length; i++) {
                      var portal = portals[i];
                      var root = portal.shadowRoot;
                      if (root) {
                        var text = root.textContent || '';
                        if (
                          text.indexOf('sseError') !== -1 ||
                          text.indexOf('cadiboklkpojfamcoggejbbdjcoiljjk') !== -1 ||
                          text.indexOf('chrome-extension://') !== -1 ||
                          text.indexOf('inpage.js') !== -1
                        ) {
                          portal.style.display = 'none';
                          var closeBtn = root.querySelector('button[aria-label="Close"]') ||
                                         root.querySelector('button[data-nextjs-dialog-header-close]') ||
                                         root.querySelector('[data-nextjs-toast-close]');
                          if (closeBtn && typeof closeBtn.click === 'function') {
                            closeBtn.click();
                          }
                          if (portal.parentNode) {
                            portal.parentNode.removeChild(portal);
                          }
                        }
                      }
                    }
                  } catch (_) {}
                }

                if (typeof MutationObserver !== 'undefined') {
                  var observer = new MutationObserver(function() {
                    cleanupNextJsPortal();
                  });
                  var target = document.documentElement || document.body;
                  if (target) {
                    observer.observe(target, { childList: true, subtree: true });
                  } else {
                    window.addEventListener('DOMContentLoaded', function() {
                      observer.observe(document.documentElement || document.body, { childList: true, subtree: true });
                    });
                  }
                }

                var pollCount = 0;
                var timer = setInterval(function() {
                  cleanupNextJsPortal();
                  pollCount++;
                  if (pollCount > 30) clearInterval(timer);
                }, 200);
              })();
            `,
          }}
        />
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
