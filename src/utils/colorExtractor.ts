export interface ThemeColors {
  primary: string;
  secondary: string;
  accent: string;
  complementary: string;
  background: string;
  surface: string;
  gradient: string[];
  text: string;
  textMuted: string;
}

// 颜色缓存
const colorCache = new Map<string, ThemeColors>();
const CACHE_SIZE_LIMIT = 50;

// 默认颜色方案 - 更鲜艳的默认颜色（暗黑模式）
export const defaultColors: ThemeColors = {
  primary: "rgb(168, 85, 247)",
  secondary: "rgb(59, 130, 246)",
  accent: "rgb(236, 72, 153)",
  complementary: "rgb(72, 236, 153)",
  background: "rgb(15, 15, 35)",
  surface: "rgb(30, 30, 60)",
  gradient: ["rgb(168, 85, 247)", "rgb(59, 130, 246)", "rgb(236, 72, 153)"],
  text: "rgb(255, 255, 255)",
  textMuted: "rgba(255, 255, 255, 0.6)",
};

// 浅色模式默认颜色方案
export const lightModeColors: ThemeColors = {
  primary: "rgb(147, 51, 234)",
  secondary: "rgb(37, 99, 235)",
  accent: "rgb(219, 39, 119)",
  complementary: "rgb(16, 185, 129)",
  background: "rgb(245, 245, 247)",
  surface: "rgb(255, 255, 255)",
  gradient: ["rgb(147, 51, 234)", "rgb(37, 99, 235)", "rgb(219, 39, 119)"],
  text: "rgb(28, 28, 30)",
  textMuted: "rgba(28, 28, 30, 0.6)",
};

/**
 * 从图像URL提取主题色
 * 使用优化的算法，采样像素并聚类分析
 */
export function extractColorsFromImage(imageUrl: string): Promise<ThemeColors> {
  return new Promise((resolve) => {
    // 检查缓存
    if (colorCache.has(imageUrl)) {
      resolve(colorCache.get(imageUrl)!);
      return;
    }

    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      try {
        const colors = performColorExtraction(img);

        // 缓存结果
        // 缓存结果
        if (colorCache.size >= CACHE_SIZE_LIMIT) {
          const firstKey = colorCache.keys().next().value;
          if (firstKey !== undefined) {
            colorCache.delete(firstKey);
          }
        }
        colorCache.set(imageUrl, colors);

        resolve(colors);
      } catch (error) {
        console.error("Color extraction failed:", error);
        resolve(defaultColors);
      }
    };

    img.onerror = () => {
      console.error("Failed to load image for color extraction");
      resolve(defaultColors);
    };

    // 设置超时
    const timeout = setTimeout(() => {
      console.warn("Color extraction timeout, using default colors");
      resolve(defaultColors);
    }, 5000);

    img.onload = () => {
      clearTimeout(timeout);
      try {
        const colors = performColorExtraction(img);

        if (colorCache.size >= CACHE_SIZE_LIMIT) {
          const firstKey = colorCache.keys().next().value;
          if (firstKey !== undefined) {
            colorCache.delete(firstKey);
          }
        }
        colorCache.set(imageUrl, colors);

        resolve(colors);
      } catch (error) {
        console.error("Color extraction failed:", error);
        resolve(defaultColors);
      }
    };

    img.src = imageUrl;
  });
}

/**
 * 执行颜色提取的核心算法
 */
function performColorExtraction(img: HTMLImageElement): ThemeColors {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });

  if (!ctx) {
    return defaultColors;
  }

  // 降低分辨率以提高性能
  const maxSize = 150;
  const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
  canvas.width = img.width * scale;
  canvas.height = img.height * scale;

  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const pixels = imageData.data;

  // 采样像素（步长为4，提高性能）
  const samples: { r: number; g: number; b: number; count: number }[] = [];
  const sampleStep = 4;

  for (let i = 0; i < pixels.length; i += 4 * sampleStep) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    const a = pixels[i + 3];

    // 跳过透明像素
    if (a < 128) continue;

    // 计算亮度，跳过过暗或过亮的像素
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    if (brightness < 20 || brightness > 235) continue;

    // 颜色量化（减少颜色数量）
    const quantizedR = Math.round(r / 32) * 32;
    const quantizedG = Math.round(g / 32) * 32;
    const quantizedB = Math.round(b / 32) * 32;

    // 查找相似颜色
    const existingIndex = samples.findIndex(
      (s) =>
        Math.abs(s.r - quantizedR) < 32 &&
        Math.abs(s.g - quantizedG) < 32 &&
        Math.abs(s.b - quantizedB) < 32
    );

    if (existingIndex >= 0) {
      samples[existingIndex].count++;
    } else {
      samples.push({ r: quantizedR, g: quantizedG, b: quantizedB, count: 1 });
    }
  }

  if (samples.length === 0) {
    return defaultColors;
  }

  // 按出现频率排序
  samples.sort((a, b) => b.count - a.count);

  // 选择主色调（排除过于相似的颜色）
  const dominantColors: { r: number; g: number; b: number }[] = [];
  for (const sample of samples) {
    if (dominantColors.length >= 5) break;

    // 检查是否与已选颜色过于相似
    const isSimilar = dominantColors.some((c) => colorDistance(c, sample) < 60);

    if (!isSimilar) {
      dominantColors.push({ r: sample.r, g: sample.g, b: sample.b });
    }
  }

  // 确保至少有3种颜色
  while (dominantColors.length < 3) {
    dominantColors.push(dominantColors[0] || { r: 147, g: 51, b: 234 });
  }

  // 生成主题色
  const primary = dominantColors[0];
  const secondary = dominantColors[1];
  const accent = dominantColors[2];

  // 调整颜色以适合UI使用
  const adjustedPrimary = adjustForUI(primary, 1.2);
  const adjustedSecondary = adjustForUI(secondary, 1.0);
  const adjustedAccent = adjustForUI(accent, 1.1);

  // 生成背景色（基于主色调的暗色版本，但保留更多色彩信息）
  const background = {
    r: Math.round(Math.max(10, primary.r * 0.2)),
    g: Math.round(Math.max(10, primary.g * 0.2)),
    b: Math.round(Math.max(10, primary.b * 0.25)),
  };

  // 生成表面色（更明显的色彩）
  const surface = {
    r: Math.round(Math.max(20, primary.r * 0.35)),
    g: Math.round(Math.max(20, primary.g * 0.35)),
    b: Math.round(Math.max(20, primary.b * 0.4)),
  };

  // 计算互补色（用于顶部光晕）
  const complementary = calculateComplementaryColor(adjustedPrimary);

  // 计算文字颜色（根据背景亮度）
  const bgBrightness = (background.r * 299 + background.g * 587 + background.b * 114) / 1000;
  const textColor = bgBrightness > 128 ? "rgb(30, 30, 30)" : "rgb(255, 255, 255)";
  const textMutedColor = bgBrightness > 128 ? "rgba(30, 30, 30, 0.6)" : "rgba(255, 255, 255, 0.6)";

  return {
    primary: `rgb(${adjustedPrimary.r}, ${adjustedPrimary.g}, ${adjustedPrimary.b})`,
    secondary: `rgb(${adjustedSecondary.r}, ${adjustedSecondary.g}, ${adjustedSecondary.b})`,
    accent: `rgb(${adjustedAccent.r}, ${adjustedAccent.g}, ${adjustedAccent.b})`,
    complementary: `rgb(${complementary.r}, ${complementary.g}, ${complementary.b})`,
    background: `rgb(${background.r}, ${background.g}, ${background.b})`,
    surface: `rgb(${surface.r}, ${surface.g}, ${surface.b})`,
    gradient: [
      `rgb(${adjustedPrimary.r}, ${adjustedPrimary.g}, ${adjustedPrimary.b})`,
      `rgb(${adjustedSecondary.r}, ${adjustedSecondary.g}, ${adjustedSecondary.b})`,
      `rgb(${adjustedAccent.r}, ${adjustedAccent.g}, ${adjustedAccent.b})`,
    ],
    text: textColor,
    textMuted: textMutedColor,
  };
}

/**
 * 计算互补色
 * 在色轮上旋转180度，并调整饱和度和亮度使其更鲜明
 */
function calculateComplementaryColor(color: { r: number; g: number; b: number }): {
  r: number;
  g: number;
  b: number;
} {
  // 转换为HSL
  const r = color.r / 255;
  const g = color.g / 255;
  const b = color.b / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;

  let h = 0;
  let s = 0;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  // 旋转180度得到互补色
  h = (h + 0.5) % 1;

  // 增加饱和度使颜色更鲜明
  s = Math.min(1, s * 1.2 + 0.1);

  // 调整亮度使其更明亮
  const adjustedL = Math.max(0.5, Math.min(0.7, l));

  // 转换回RGB
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  const q = adjustedL < 0.5 ? adjustedL * (1 + s) : adjustedL + s - adjustedL * s;
  const p = 2 * adjustedL - q;

  return {
    r: Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    g: Math.round(hue2rgb(p, q, h) * 255),
    b: Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
  };
}

/**
 * 计算两个颜色之间的距离
 */
function colorDistance(
  c1: { r: number; g: number; b: number },
  c2: { r: number; g: number; b: number }
): number {
  const dr = c1.r - c2.r;
  const dg = c1.g - c2.g;
  const db = c1.b - c2.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

/**
 * 调整颜色以适应UI显示 - 增强版，颜色更鲜艳
 */
function adjustForUI(
  color: { r: number; g: number; b: number },
  saturationBoost: number = 1.3
): { r: number; g: number; b: number } {
  // 转换为HSL
  const r = color.r / 255;
  const g = color.g / 255;
  const b = color.b / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;

  let h = 0;
  let s = 0;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  // 增强饱和度和亮度，使颜色更鲜艳
  s = Math.min(1, s * saturationBoost + 0.15); // 增加饱和度
  const adjustedL = Math.max(0.4, Math.min(0.65, l * 1.1)); // 提高亮度

  // 转换回RGB
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  const q = adjustedL < 0.5 ? adjustedL * (1 + s) : adjustedL + s - adjustedL * s;
  const p = 2 * adjustedL - q;

  return {
    r: Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    g: Math.round(hue2rgb(p, q, h) * 255),
    b: Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
  };
}

/**
 * 清除颜色缓存
 */
export function clearColorCache(): void {
  colorCache.clear();
}

/**
 * 获取缓存大小
 */
export function getCacheSize(): number {
  return colorCache.size;
}

/**
 * 调整颜色亮度
 */
export function adjustColorBrightness(color: string, factor: number): string {
  const match = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (!match) return color;

  const r = Math.min(255, Math.max(0, Math.round(parseInt(match[1]) * factor)));
  const g = Math.min(255, Math.max(0, Math.round(parseInt(match[2]) * factor)));
  const b = Math.min(255, Math.max(0, Math.round(parseInt(match[3]) * factor)));

  return `rgb(${r}, ${g}, ${b})`;
}

/**
 * 生成渐变字符串
 */
export function generateGradient(colors: string[], angle: number = 135): string {
  return `linear-gradient(${angle}deg, ${colors.join(", ")})`;
}
