import type { Drawing, DrawingType } from './types';

export interface SerializedDrawingData {
  startIndex?: number;
  startPrice?: number;
  endIndex?: number;
  endPrice?: number;
  points?: Array<{ index: number; price: number }>;
  swingLowIndex?: number;
  swingLowPrice?: number;
  swingHighIndex?: number;
  swingHighPrice?: number;
  direction?: 'up' | 'down';
  levels?: Array<{ level: number; label: string; price: number }>;
}

export const serializeDrawingData = (drawing: Drawing): string => {
  const data: SerializedDrawingData = {};

  switch (drawing.type) {
    case 'line':
    case 'ruler':
    case 'rectangle':
    case 'area':
      data.startIndex = drawing.startIndex;
      data.startPrice = drawing.startPrice;
      data.endIndex = drawing.endIndex;
      data.endPrice = drawing.endPrice;
      break;
    case 'pencil':
      data.points = drawing.points;
      break;
    case 'fibonacci':
      data.swingLowIndex = drawing.swingLowIndex;
      data.swingLowPrice = drawing.swingLowPrice;
      data.swingHighIndex = drawing.swingHighIndex;
      data.swingHighPrice = drawing.swingHighPrice;
      data.direction = drawing.direction;
      data.levels = drawing.levels;
      break;
  }

  return JSON.stringify(data);
};

export const deserializeDrawingData = (
  type: DrawingType,
  dataStr: string,
  base: { id: string; symbol: string; visible: boolean; locked: boolean; zIndex: number; createdAt: number; updatedAt: number },
): Drawing | null => {
  try {
    const data = JSON.parse(dataStr) as SerializedDrawingData;
    const common = { ...base, type };

    switch (type) {
      case 'line':
        return { ...common, type: 'line', startIndex: data.startIndex!, startPrice: data.startPrice!, endIndex: data.endIndex!, endPrice: data.endPrice! };
      case 'ruler':
        return { ...common, type: 'ruler', startIndex: data.startIndex!, startPrice: data.startPrice!, endIndex: data.endIndex!, endPrice: data.endPrice! };
      case 'rectangle':
        return { ...common, type: 'rectangle', startIndex: data.startIndex!, startPrice: data.startPrice!, endIndex: data.endIndex!, endPrice: data.endPrice! };
      case 'area':
        return { ...common, type: 'area', startIndex: data.startIndex!, startPrice: data.startPrice!, endIndex: data.endIndex!, endPrice: data.endPrice! };
      case 'pencil':
        return { ...common, type: 'pencil', points: data.points ?? [] };
      case 'fibonacci':
        return {
          ...common, type: 'fibonacci',
          swingLowIndex: data.swingLowIndex!, swingLowPrice: data.swingLowPrice!,
          swingHighIndex: data.swingHighIndex!, swingHighPrice: data.swingHighPrice!,
          direction: data.direction ?? 'up', levels: data.levels ?? [],
        };
      default:
        return null;
    }
  } catch {
    return null;
  }
};
