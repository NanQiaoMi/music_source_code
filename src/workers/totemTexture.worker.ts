/// <reference lib="webworker" />

interface TotemTextureMessage {
  type: "generate";
  id: string;
  text: string;
  style: "serif" | "sans";
}

interface TotemTextureResponse {
  type: "texture-generated";
  id: string;
  bitmap: ImageBitmap;
}

self.onmessage = async (event: MessageEvent<TotemTextureMessage>) => {
  const { type, id, text, style } = event.data;

  if (type !== "generate") return;

  try {
    const canvas = new OffscreenCanvas(512, 512);
    const ctx = canvas.getContext("2d");

    if (!ctx) throw new Error("Could not get 2D context");

    // Background must be transparent for composition
    ctx.clearRect(0, 0, 512, 512);

    // Setup text style based on Resonance Totem V2 spec
    // Minimalist, Swiss Editorial, High-End Precision
    const fontFamily =
      style === "serif"
        ? "'EB Garamond', 'Times New Roman', serif"
        : "'Inter', 'Helvetica Neue', sans-serif";

    // Italic 300 weight for V2
    ctx.font = `italic 300 80px ${fontFamily}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // Warm White OKLCH equivalent (approximate for canvas)
    ctx.fillStyle = "#faf9f6";

    // REMOVE cheap shadows and gradients per V2 spec
    ctx.shadowBlur = 0;

    // Draw text with tracking (if supported, otherwise default)
    if ("letterSpacing" in ctx) {
      (ctx as any).letterSpacing = "8px";
    }

    ctx.fillText(text.toUpperCase(), 256, 256);

    const bitmap = canvas.transferToImageBitmap();

    const response: TotemTextureResponse = {
      type: "texture-generated",
      id,
      bitmap,
    };

    self.postMessage(response, [bitmap]);
  } catch (error) {
    console.error("Totem texture generation failed:", error);
  }
};

export {};
