import type { Drawing, DrawingType } from './types';

export interface SerializedDrawingData {
  startIndex?: number;
  startPrice?: number;
  endIndex?: number;
  endPrice?: number;
  startTime?: number;
  endTime?: number;
  points?: Array<{ index: number; price: number; time?: number }>;
  swingLowIndex?: number;
  swingLowPrice?: number;
  swingHighIndex?: number;
  swingHighPrice?: number;
  swingLowTime?: number;
  swingHighTime?: number;
  direction?: 'up' | 'down';
  levels?: Array<{ level: number; label: string; price: number }>;
}

export type KlineTimeLookup = (index: number) => number | undefined;
export type TimeToIndexLookup = (time: number) => number;

export const serializeDrawingData = (drawing: Drawing, getOpenTime?: KlineTimeLookup): string => {
  const data: SerializedDrawingData = {};
  const t = getOpenTime ?? (() => undefined);

  switch (drawing.type) {
    case 'line':
    case 'ruler':
    case 'rectangle':
    case 'area':
      data.startIndex = drawing.startIndex;
      data.startPrice = drawing.startPrice;
      data.endIndex = drawing.endIndex;
      data.endPrice = drawing.endPrice;
      data.startTime = t(drawing.startIndex);
      data.endTime = t(drawing.endIndex);
      break;
    case 'pencil':
      data.points = drawing.points.map((p) => ({ index: p.index, price: p.price, time: t(p.index) }));
      break;
    case 'fibonacci':
      data.swingLowIndex = drawing.swingLowIndex;
      data.swingLowPrice = drawing.swingLowPrice;
      data.swingHighIndex = drawing.swingHighIndex;
      data.swingHighPrice = drawing.swingHighPrice;
      data.swingLowTime = t(drawing.swingLowIndex);
      data.swingHighTime = t(drawing.swingHighIndex);
      data.direction = drawing.direction;
      data.levels = drawing.levels;
      break;
  }

  return JSON.stringify(data);
};

const resolveIndex = (storedIndex: number, storedTime: number | undefined, timeToIndex?: TimeToIndexLookup): number => {
  if (storedTime && timeToIndex) return timeToIndex(storedTime);
  return storedIndex;
};

export const deserializeDrawingData = (
  type: DrawingType,
  dataStr: string,
  base: { id: string; symbol: string; interval: string; visible: boolean; locked: boolean; zIndex: number; createdAt: number; updatedAt: number },
  timeToIndex?: TimeToIndexLookup,
): Drawing | null => {
  try {
    const data = JSON.parse(dataStr) as SerializedDrawingData;
    const common = { ...base, type };
    const ri = (idx: number, time?: number) => resolveIndex(idx, time, timeToIndex);

    switch (type) {
      case 'line':
        return { ...common, type: 'line', startIndex: ri(data.startIndex!, data.startTime), startPrice: data.startPrice!, endIndex: ri(data.endIndex!, data.endTime), endPrice: data.endPrice! };
      case 'ruler':
        return { ...common, type: 'ruler', startIndex: ri(data.startIndex!, data.startTime), startPrice: data.startPrice!, endIndex: ri(data.endIndex!, data.endTime), endPrice: data.endPrice! };
      case 'rectangle':
        return { ...common, type: 'rectangle', startIndex: ri(data.startIndex!, data.startTime), startPrice: data.startPrice!, endIndex: ri(data.endIndex!, data.endTime), endPrice: data.endPrice! };
      case 'area':
        return { ...common, type: 'area', startIndex: ri(data.startIndex!, data.startTime), startPrice: data.startPrice!, endIndex: ri(data.endIndex!, data.endTime), endPrice: data.endPrice! };
      case 'pencil':
        return { ...common, type: 'pencil', points: (data.points ?? []).map((p) => ({ index: ri(p.index, p.time), price: p.price })) };
      case 'fibonacci':
        return {
          ...common, type: 'fibonacci',
          swingLowIndex: ri(data.swingLowIndex!, data.swingLowTime), swingLowPrice: data.swingLowPrice!,
          swingHighIndex: ri(data.swingHighIndex!, data.swingHighTime), swingHighPrice: data.swingHighPrice!,
          direction: data.direction ?? 'up', levels: data.levels ?? [],
        };
      default:
        return null;
    }
  } catch {
    return null;
  }
};
