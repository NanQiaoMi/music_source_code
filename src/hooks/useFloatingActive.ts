"use client";

import { useEffect, useState, type RefObject } from "react";

/**
 * 浮动层活跃判定（S3-5）。
 *
 * 浮动层在 `hidden`（沉浸式可视化）时只是 display:none，JS 循环并不会停止。
 * 这里把三个信号合成一个布尔值，供画布/遥测循环决定是否排帧：
 * - 外部门控 `active`（视图切换、沉浸式、暂停等由调用方计算）；
 * - 标签页可见性（document.visibilityState + visibilitychange）；
 * - 元素是否在视口内（IntersectionObserver，可选，需传 targetRef）。
 *
 * SSR 与首帧返回 `true`（与现有行为一致，避免服务端渲染差异）；
 * 默认值保持 true 保证“不传即维持旧行为”，可逐文件回滚。
 */
export interface UseFloatingActiveOptions {
  /** 外部门控：false 时立即判定为不活跃，不再挂观察器。 */
  active?: boolean;
  /** 需要观察可见性的元素（通常是画布容器）。 */
  targetRef?: RefObject<Element | null>;
  /** IntersectionObserver 阈值，默认 0.01（露出一像素即算可见）。 */
  threshold?: number;
}

function readDocumentHidden(): boolean {
  return typeof document !== "undefined" && document.visibilityState === "hidden";
}

export function useFloatingActive(options: UseFloatingActiveOptions = {}): boolean {
  const { active = true, targetRef, threshold = 0.01 } = options;
  const [isDocumentHidden, setIsDocumentHidden] = useState(readDocumentHidden);
  const [isIntersecting, setIsIntersecting] = useState(true);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const sync = () => setIsDocumentHidden(readDocumentHidden());
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, []);

  useEffect(() => {
    const target = targetRef?.current;
    if (!active || !target || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry) setIsIntersecting(entry.isIntersecting);
      },
      { threshold }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [active, targetRef, threshold]);

  return active && !isDocumentHidden && isIntersecting;
}
