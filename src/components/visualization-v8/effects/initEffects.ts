"use client";
import * as Effects from "./index";
import { registerEffect } from "./index";
import { EffectPlugin } from "@/lib/visualization/types";

export function initAllEffects() {
  const effectEntries = Object.values(Effects);
  let count = 0;

  effectEntries.forEach((effect) => {
    // 确保它是一个插件对象（通过检查是否有 id 和 init 属性）
    if (effect && typeof effect === "object" && "id" in effect && "init" in (effect as any)) {
      registerEffect(effect as EffectPlugin);
      count++;
    }
  });

  console.log(`V8.0 Effects initialized: ${count} effects registered.`);
}