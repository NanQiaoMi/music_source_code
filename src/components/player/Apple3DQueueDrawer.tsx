/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Shelf3DView } from "@/components/library/Shelf3DView";

export function Apple3DQueueDrawer() {
  const [isOpen, setIsOpen] = useState(false);

  // 1. 鼠标贴近屏幕右边缘 24px 触发滑出真正的 3D 空间唱片架
  const handleEdgeMouseEnter = useCallback(() => {
    setIsOpen(true);
  }, []);

  // 全局鼠标移动监听 (右侧边缘靠近触发呼出)
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      const distFromRight = window.innerWidth - e.clientX;
      if (distFromRight <= 24 && !isOpen) {
        setIsOpen(true);
      }
    };

    window.addEventListener("mousemove", handleGlobalMouseMove, { passive: true });
    return () => window.removeEventListener("mousemove", handleGlobalMouseMove);
  }, [isOpen]);

  // 键盘快捷键 (Esc / ⌘L 切换与关闭)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      } else if ((e.metaKey || e.ctrlKey) && (e.key === "l" || e.key === "L")) {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  return (
    <>
      {/* 屏幕右侧 24px 隐形感应带 */}
      <div
        onMouseEnter={handleEdgeMouseEnter}
        onClick={() => setIsOpen((prev) => !prev)}
        className="fixed top-0 right-0 bottom-0 w-6 z-40 pointer-events-auto cursor-pointer group"
        title="鼠标贴近右侧或点击呼出 3D 空间唱片架 (⌘L)"
      >
        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1.5 h-28 rounded-l-full bg-white/0 group-hover:bg-[#2997ff]/40 group-hover:shadow-[0_0_20px_rgba(41,151,255,0.8)] transition-all duration-300" />
      </div>

      {/* 真实 Three.js 3D WebGL 空间悬浮唱片架 (Side 3D Mode) - 纯手动退出 */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, x: 60 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 60 }}
            transition={{ type: "spring", stiffness: 350, damping: 30, mass: 0.8 }}
            className="fixed inset-0 z-50 pointer-events-auto"
          >
            <Shelf3DView
              isOpen={true}
              defaultMode="side"
              transparentBg={false}
              isDrawerMode={true}
              onClose={() => setIsOpen(false)}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
