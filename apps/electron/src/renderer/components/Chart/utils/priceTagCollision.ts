import { ORDER_LINE_LAYOUT } from '@shared/constants';

interface TagSlot {
  y: number;
  height: number;
}

interface ResolveOptions {
  tags: TagSlot[];
  fixedAnchor?: TagSlot | null;
  chartHeight: number;
  gap?: number;
}

/**
 * Stack price-scale tags vertically so they never overlap. Tags closer
 * to the chart edges may visually drift away from their actual price line
 * — that is the intended trade-off for legibility when many lines cluster
 * near the same price (e.g. entry + SL + current price).
 *
 * Algorithm: anchor the cluster around the closest tag to the fixed
 * anchor (current-price tag, immovable), then walk outward both
 * directions placing tags above/below with `gap` spacing. If a tag
 * would extend past chart bounds, the cluster compresses back into
 * the visible region.
 *
 * Returns a new array of resolved Y positions (same order as input).
 */
export const resolvePriceTagCollisions = ({
  tags,
  fixedAnchor = null,
  chartHeight,
  gap = 2,
}: ResolveOptions): number[] => {
  if (tags.length === 0) return [];

  const indexed = tags.map((t, i) => ({ ...t, index: i }));
  indexed.sort((a, b) => a.y - b.y);

  type Slot = { y: number; height: number; index: number; fixed: boolean };
  const slots: Slot[] = indexed.map((t) => ({ y: t.y, height: t.height, index: t.index, fixed: false }));

  if (fixedAnchor) {
    let insertAt = slots.findIndex((s) => s.y >= fixedAnchor.y);
    if (insertAt === -1) insertAt = slots.length;
    slots.splice(insertAt, 0, { y: fixedAnchor.y, height: fixedAnchor.height, index: -1, fixed: true });
  }

  for (let i = 1; i < slots.length; i++) {
    const prev = slots[i - 1]!;
    const curr = slots[i]!;
    if (curr.fixed) continue;
    const prevBottom = prev.y + prev.height / 2;
    const currTop = curr.y - curr.height / 2;
    if (currTop < prevBottom + gap) {
      curr.y = prevBottom + gap + curr.height / 2;
    }
  }

  for (let i = slots.length - 2; i >= 0; i--) {
    const next = slots[i + 1]!;
    const curr = slots[i]!;
    if (curr.fixed) continue;
    const currBottom = curr.y + curr.height / 2;
    const nextTop = next.y - next.height / 2;
    if (currBottom > nextTop - gap) {
      curr.y = nextTop - gap - curr.height / 2;
    }
  }

  for (const slot of slots) {
    if (slot.fixed) continue;
    const halfH = slot.height / 2;
    if (slot.y - halfH < 0) slot.y = halfH;
    if (slot.y + halfH > chartHeight) slot.y = chartHeight - halfH;
  }

  const out = new Array<number>(tags.length);
  for (const slot of slots) {
    if (slot.index >= 0) out[slot.index] = slot.y;
  }
  return out;
};

export const PRICE_TAG_HEIGHT = ORDER_LINE_LAYOUT.LABEL_HEIGHT;
