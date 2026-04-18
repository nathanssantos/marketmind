import type { Drawing } from '@marketmind/chart-studies';

export interface DuplicateOptions {
  offsetIndex?: number;
  offsetPrice?: number;
  targetSymbol?: string;
  targetInterval?: string;
}

let nextCloneSeq = 1;
const generateCloneId = (): string => `drawing-${Date.now()}-clone-${nextCloneSeq++}`;

const offsetPoint = <T extends { index: number; price: number; time?: number }>(
  point: T,
  dIndex: number,
  dPrice: number,
): T => ({
  ...point,
  index: point.index + dIndex,
  price: point.price + dPrice,
  time: undefined,
});

export const duplicateDrawing = (source: Drawing, options: DuplicateOptions = {}): Drawing => {
  const dIndex = options.offsetIndex ?? 0;
  const dPrice = options.offsetPrice ?? 0;

  const clone = structuredClone(source);
  clone.id = generateCloneId();
  clone.createdAt = Date.now();
  clone.updatedAt = Date.now();

  if (options.targetSymbol) clone.symbol = options.targetSymbol;
  if (options.targetInterval) clone.interval = options.targetInterval;

  switch (clone.type) {
    case 'line':
    case 'ruler':
    case 'rectangle':
    case 'area':
    case 'arrow':
    case 'ray':
    case 'trendLine':
    case 'priceRange':
    case 'ellipse':
    case 'gannFan': {
      clone.startIndex += dIndex;
      clone.endIndex += dIndex;
      clone.startPrice += dPrice;
      clone.endPrice += dPrice;
      clone.startTime = undefined;
      clone.endTime = undefined;
      break;
    }
    case 'channel':
    case 'pitchfork': {
      clone.startIndex += dIndex;
      clone.endIndex += dIndex;
      clone.widthIndex += dIndex;
      clone.startPrice += dPrice;
      clone.endPrice += dPrice;
      clone.widthPrice += dPrice;
      clone.startTime = undefined;
      clone.endTime = undefined;
      clone.widthTime = undefined;
      break;
    }
    case 'horizontalLine':
    case 'verticalLine':
    case 'anchoredVwap':
    case 'text': {
      clone.index += dIndex;
      clone.price += dPrice;
      clone.time = undefined;
      break;
    }
    case 'pencil':
    case 'highlighter': {
      clone.points = clone.points.map((p) => offsetPoint(p, dIndex, dPrice));
      break;
    }
    case 'fibonacci': {
      clone.swingLowIndex += dIndex;
      clone.swingHighIndex += dIndex;
      clone.swingLowPrice += dPrice;
      clone.swingHighPrice += dPrice;
      clone.swingLowTime = undefined;
      clone.swingHighTime = undefined;
      clone.levels = clone.levels.map((lvl) => ({ ...lvl, price: lvl.price + dPrice }));
      break;
    }
    case 'longPosition':
    case 'shortPosition': {
      clone.entryIndex += dIndex;
      clone.entryPrice += dPrice;
      clone.stopLossPrice += dPrice;
      clone.takeProfitPrice += dPrice;
      clone.entryTime = undefined;
      break;
    }
  }

  return clone;
};
