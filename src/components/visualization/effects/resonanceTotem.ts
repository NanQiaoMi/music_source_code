import { EffectContext } from "./types";

/**
 * RESONANCE TOTEM (共鸣图腾)
 * Aesthetics: Minimalist, Swiss Editorial, High-End Precision.
 * Tone: Subconscious, Poetic, Structured, Masterpiece.
 */
export const drawResonanceTotem = ({ ctx, width, height, data, params, time, refs, theme }: EffectContext) => {
  const sw = width || 1920;
  const sh = height || 1080;
  const cx = sw / 2;
  const cy = sh / 2;

  const {
    opacity = 1.0,
    scanSpeed = 1.0,
    grainIntensity = 0.05,
    fontFamily = "'EB Garamond', serif"
  } = params || {};

  // 1. SIGNAL PROCESSING
  const getVal = (i: number) => (data && data[i] !== undefined) ? data[i] / 255 : 0;
  // Fallbacks if refs don't exist
  const bass = refs?.smoothBass?.current || getVal(2) * 1.5 || 0;
  const treble = refs?.smoothTreble?.current || getVal(20) || 0;

  // 2. BACKGROUND CLEAR (Minimalists use deep carbon)
  ctx.save();
  ctx.fillStyle = "rgba(5, 5, 5, 0.15)";
  ctx.fillRect(0, 0, sw, sh);
  ctx.restore();

  // 3. GRAIN TEXTURE (Swiss quality)
  if (grainIntensity > 0) {
    ctx.save();
    ctx.globalAlpha = grainIntensity * 0.5;
    ctx.globalCompositeOperation = "overlay";
    // For performance, pre-calculate or use a static noise pattern, but simple random loop is okay for now
    for (let i = 0; i < 200; i++) {
      const gx = Math.random() * sw;
      const gy = Math.random() * sh;
      ctx.fillStyle = Math.random() > 0.5 ? "#ffffff" : "#000000";
      ctx.fillRect(gx, gy, 1.5, 1.5);
    }
    ctx.restore();
  }

  // 4. DRAW TOTEMS (The words)
  const totems = refs?.resonanceTotems?.current || [];
  
  totems.forEach((totem: any) => {
    // Current time relative to activation (which starts 3s before startTime)
    const musicTime = time * 0.001; // Fallback if musicTime isn't passed down (though EffectContext usually should)
    const age = musicTime - (totem.startTime - 3); 
    const totalDuration = totem.duration + 3; 
    
    if (age < 0 || age > totalDuration) return;

    // Fade logic (Appears 3s early, lasts for totem.duration)
    let alpha = 0;
    if (age < 1.5) alpha = age / 1.5; // Smooth fade in
    else if (age > totalDuration - 1.5) alpha = (totalDuration - age) / 1.5; // Smooth fade out
    else alpha = 1;

    ctx.save();
    // Use totem.intensity to vary opacity
    const totemOpacity = (totem.intensity || 0.8) * opacity;
    ctx.globalAlpha = alpha * 0.25 * totemOpacity; // Max 25% opacity
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    
    // Minimalist Typography
    const fontSize = 70 + (totem.intensity * 30) + (bass * 30); // Reduced bass scaling for more elegant look
    ctx.font = `italic 300 ${fontSize}px ${fontFamily}`;
    ctx.fillStyle = `oklch(95% 0.01 40)`; // Warm White

    // Center position with slight breathing
    const driftY = Math.sin(time * 0.0005 + totem.startTime) * 10; // Slower drift
    ctx.translate(cx, cy + driftY);

    // Subtle tracking animation (expands over time)
    const letterSpacing = 8 + age * 2; // Slower tracking
    // letterSpacing is not universally supported in 2D canvas, using an alternative if needed
    // ctx.letterSpacing = `${letterSpacing}px`; // Chrome supports this, but might be slow
    
    // Polyfill or reliance on context
    if ('letterSpacing' in ctx) {
      (ctx as any).letterSpacing = `${letterSpacing}px`;
    }

    // Draw the word
    ctx.fillText(totem.text.toUpperCase(), 0, 0);

    // 5. SCAN LINE / BURST (The "Resonance" phase when music reaches the word)
    const isBursting = musicTime >= totem.startTime && musicTime < totem.startTime + 2;
    if (isBursting) {
      const burstProgress = (musicTime - totem.startTime) / 2;
      
      ctx.save();
      // Calculate alpha based on progress (peak at middle)
      const burstAlpha = Math.sin(burstProgress * Math.PI) * 0.4;
      ctx.globalAlpha = alpha * burstAlpha * totemOpacity;
      
      ctx.strokeStyle = `oklch(95% 0.01 40)`;
      ctx.lineWidth = 0.5;
      
      // Horizontal scan line going down
      const scanY = (burstProgress - 0.5) * (fontSize * 1.5);
      ctx.beginPath();
      // Make line width relative to text width
      const textWidth = ctx.measureText(totem.text.toUpperCase()).width;
      const lineWidth = textWidth * 1.2;
      ctx.moveTo(-lineWidth/2, scanY);
      ctx.lineTo(lineWidth/2, scanY);
      ctx.stroke();
      
      // Optional: subtle glow during burst
      ctx.shadowBlur = 10 * Math.sin(burstProgress * Math.PI);
      ctx.shadowColor = `oklch(95% 0.01 40 / 0.5)`;
      ctx.fillText(totem.text.toUpperCase(), 0, 0);
      
      ctx.restore();
    }

    ctx.restore();
  });


  // 6. ATMOSPHERIC BORDER (Branding)
  ctx.save();
  ctx.strokeStyle = `oklch(30% 0.01 40 / 0.1)`;
  ctx.lineWidth = 1;
  ctx.strokeRect(40, 40, sw - 80, sh - 80);
  
  // Technical corners
  ctx.fillStyle = `oklch(40% 0.01 40 / 0.3)`;
  ctx.font = "10px 'JetBrains Mono', monospace";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText("RESONANCE_TOTEM_V2", 50, 50);
  
  ctx.textAlign = "right";
  ctx.fillText("MINIMALIST_VOID", sw - 50, sh - 50);
  
  ctx.textAlign = "left";
  ctx.textBaseline = "bottom";
  ctx.fillText(`SEQ_${Math.floor(time * 0.001)}`, 50, sh - 50);
  ctx.restore();
};
