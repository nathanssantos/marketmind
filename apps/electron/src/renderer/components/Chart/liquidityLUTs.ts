function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

interface LUTStop {
  r: [number, number];
  g: [number, number];
  b: [number, number];
  a: [number, number];
}

export function buildLUT(stops: LUTStop[]): string[] {
  const lut: string[] = [];
  const segCount = stops.length;
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    const segIdx = Math.min(segCount - 1, (t * segCount) | 0);
    const segT = t * segCount - segIdx;
    const s = stops[segIdx]!;
    const r = lerp(s.r[0], s.r[1], segT) | 0;
    const g = lerp(s.g[0], s.g[1], segT) | 0;
    const b = lerp(s.b[0], s.b[1], segT) | 0;
    const a = lerp(s.a[0], s.a[1], segT);
    lut.push(`rgba(${r},${g},${b},${a.toFixed(2)})`);
  }
  return lut;
}

export const BID_LUT_COLORED = buildLUT([
  { r: [20, 30], g: [80, 160], b: [60, 80], a: [0.3, 0.45] },
  { r: [30, 50], g: [160, 220], b: [80, 100], a: [0.45, 0.6] },
  { r: [50, 100], g: [220, 255], b: [100, 120], a: [0.6, 0.75] },
  { r: [100, 200], g: [255, 255], b: [120, 180], a: [0.75, 0.9] },
]);

export const ASK_LUT_COLORED = buildLUT([
  { r: [120, 180], g: [30, 40], b: [40, 50], a: [0.3, 0.45] },
  { r: [180, 230], g: [40, 60], b: [50, 60], a: [0.45, 0.6] },
  { r: [230, 255], g: [60, 100], b: [60, 50], a: [0.6, 0.75] },
  { r: [255, 255], g: [100, 200], b: [50, 120], a: [0.75, 0.9] },
]);

export const INTENSITY_LUT = buildLUT([
  { r: [140, 210], g: [130, 170], b: [130, 110], a: [0.35, 0.55] },
  { r: [210, 240], g: [170, 165], b: [110, 60], a: [0.55, 0.7] },
  { r: [240, 255], g: [165, 120], b: [60, 50], a: [0.7, 0.85] },
  { r: [255, 255], g: [120, 235], b: [50, 190], a: [0.85, 0.95] },
]);

export type LiquidityColorMode = 'colored' | 'intensity';

export const getLiquidityLUTs = (mode: LiquidityColorMode): { bid: string[]; ask: string[] } => {
  if (mode === 'intensity') return { bid: INTENSITY_LUT, ask: INTENSITY_LUT };
  return { bid: BID_LUT_COLORED, ask: ASK_LUT_COLORED };
};
