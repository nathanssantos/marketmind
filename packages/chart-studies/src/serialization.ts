import type { Drawing, DrawingType } from './types';

export interface SerializedDrawingData {
  startIndex?: number;
  startPrice?: number;
  endIndex?: number;
  endPrice?: number;
  startTime?: number;
  endTime?: number;
  widthIndex?: number;
  widthPrice?: number;
  widthTime?: number;
  points?: Array<{ index: number; price: number; time?: number }>;
  swingLowIndex?: number;
  swingLowPrice?: number;
  swingHighIndex?: number;
  swingHighPrice?: number;
  swingLowTime?: number;
  swingHighTime?: number;
  direction?: 'up' | 'down';
  levels?: Array<{ level: number; label: string; price: number }>;
  color?: string;
  lineWidth?: number;
  index?: number;
  price?: number;
  time?: number;
  text?: string;
  fontSize?: number;
  fontWeight?: 'normal' | 'bold';
  textDecoration?: 'none' | 'underline';
  entryIndex?: number;
  entryPrice?: number;
  entryTime?: number;
  stopLossPrice?: number;
  takeProfitPrice?: number;
}

export type KlineTimeLookup = (index: number) => number | undefined;
export type TimeToIndexLookup = (time: number) => number;

export const serializeDrawingData = (drawing: Drawing, getOpenTime?: KlineTimeLookup): string => {
  const data: SerializedDrawingData = {};
  const t = getOpenTime ?? (() => undefined);

  if (drawing.color) data.color = drawing.color;
  if (drawing.lineWidth) data.lineWidth = drawing.lineWidth;

  switch (drawing.type) {
    case 'line':
    case 'ruler':
    case 'rectangle':
    case 'area':
    case 'arrow':
    case 'ray':
    case 'trendLine':
    case 'priceRange':
    case 'ellipse':
    case 'gannFan':
      data.startIndex = drawing.startIndex;
      data.startPrice = drawing.startPrice;
      data.endIndex = drawing.endIndex;
      data.endPrice = drawing.endPrice;
      data.startTime = t(drawing.startIndex);
      data.endTime = t(drawing.endIndex);
      break;
    case 'channel':
    case 'pitchfork':
      data.startIndex = drawing.startIndex;
      data.startPrice = drawing.startPrice;
      data.endIndex = drawing.endIndex;
      data.endPrice = drawing.endPrice;
      data.startTime = t(drawing.startIndex);
      data.endTime = t(drawing.endIndex);
      data.widthIndex = drawing.widthIndex;
      data.widthPrice = drawing.widthPrice;
      data.widthTime = t(drawing.widthIndex);
      break;
    case 'pencil':
    case 'highlighter':
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
    case 'text':
      data.index = drawing.index;
      data.price = drawing.price;
      data.time = t(drawing.index);
      data.text = drawing.text;
      data.fontSize = drawing.fontSize;
      data.fontWeight = drawing.fontWeight;
      data.textDecoration = drawing.textDecoration;
      break;
    case 'horizontalLine':
    case 'verticalLine':
      data.index = drawing.index;
      data.price = drawing.price;
      data.time = t(drawing.index);
      break;
    case 'longPosition':
    case 'shortPosition':
      data.entryIndex = drawing.entryIndex;
      data.entryPrice = drawing.entryPrice;
      data.entryTime = t(drawing.entryIndex);
      data.stopLossPrice = drawing.stopLossPrice;
      data.takeProfitPrice = drawing.takeProfitPrice;
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
    const common = { ...base, type, ...(data.color && { color: data.color }), ...(data.lineWidth && { lineWidth: data.lineWidth }) };
    const ri = (idx: number, time?: number) => resolveIndex(idx, time, timeToIndex);

    const twoPointFields = {
      startIndex: ri(data.startIndex!, data.startTime), startPrice: data.startPrice!,
      endIndex: ri(data.endIndex!, data.endTime), endPrice: data.endPrice!,
      startTime: data.startTime, endTime: data.endTime,
    };

    switch (type) {
      case 'line':
      case 'ruler':
      case 'rectangle':
      case 'area':
      case 'arrow':
      case 'ray':
      case 'trendLine':
      case 'priceRange':
      case 'ellipse':
      case 'gannFan':
        return { ...common, type, ...twoPointFields } as Drawing;
      case 'channel':
      case 'pitchfork':
        return { ...common, type, ...twoPointFields, widthIndex: ri(data.widthIndex ?? 0, data.widthTime), widthPrice: data.widthPrice ?? 0, widthTime: data.widthTime } as Drawing;
      case 'pencil':
      case 'highlighter':
        return { ...common, type, points: (data.points ?? []).map((p) => ({ index: ri(p.index, p.time), price: p.price, time: p.time })) } as Drawing;
      case 'fibonacci':
        return {
          ...common, type: 'fibonacci',
          swingLowIndex: ri(data.swingLowIndex!, data.swingLowTime), swingLowPrice: data.swingLowPrice!,
          swingHighIndex: ri(data.swingHighIndex!, data.swingHighTime), swingHighPrice: data.swingHighPrice!,
          swingLowTime: data.swingLowTime, swingHighTime: data.swingHighTime,
          direction: data.direction ?? 'up', levels: data.levels ?? [],
        };
      case 'text':
        return {
          ...common, type: 'text',
          index: ri(data.index!, data.time), price: data.price!,
          time: data.time,
          text: data.text ?? '', fontSize: data.fontSize ?? 14,
          fontWeight: data.fontWeight ?? 'normal', textDecoration: data.textDecoration ?? 'none',
        };
      case 'horizontalLine':
        return {
          ...common, type: 'horizontalLine',
          index: ri(data.index!, data.time), price: data.price!,
          time: data.time,
        };
      case 'verticalLine':
        return { ...common, type, index: ri(data.index!, data.time), price: data.price!, time: data.time } as Drawing;
      case 'longPosition':
      case 'shortPosition':
        return {
          ...common, type,
          entryIndex: ri(data.entryIndex!, data.entryTime), entryPrice: data.entryPrice!,
          entryTime: data.entryTime,
          stopLossPrice: data.stopLossPrice!, takeProfitPrice: data.takeProfitPrice!,
        } as Drawing;
      default:
        return null;
    }
  } catch {
    return null;
  }
};
