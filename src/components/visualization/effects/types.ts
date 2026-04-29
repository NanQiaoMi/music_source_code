export interface EffectContext {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  data: Uint8Array;
  params: any;
  time: number;
  refs: {
    particles: { current: any[] };
    nebulaStars: { current: any[] };
    spectrumStars: { current: any[] };
    matrixDrops: { current: number[] };
    smoothBass: { current: number };
    smoothMid: { current: number };
    smoothTreble: { current: number };
    bokeh: { current: any[] };
    shockwaves: { current: any[] };
  };
  theme: {
    primary: number;
    secondary: number;
    accent: number;
  };
  utils: {
    getThemeBaseHue: () => number;
  };
}
