export type DrawingType = 'line' | 'rectangle' | 'pencil' | 'fibonacci' | 'ruler' | 'area';

export interface DrawingBase {
  id: string;
  type: DrawingType;
  symbol: string;
  createdAt: number;
  updatedAt: number;
  visible: boolean;
  locked: boolean;
  zIndex: number;
}

export interface LineDrawing extends DrawingBase {
  type: 'line';
  startIndex: number;
  startPrice: number;
  endIndex: number;
  endPrice: number;
  startTime?: number;
  endTime?: number;
}

export interface RulerDrawing extends DrawingBase {
  type: 'ruler';
  startIndex: number;
  startPrice: number;
  endIndex: number;
  endPrice: number;
  startTime?: number;
  endTime?: number;
}

export interface RectangleDrawing extends DrawingBase {
  type: 'rectangle';
  startIndex: number;
  startPrice: number;
  endIndex: number;
  endPrice: number;
  startTime?: number;
  endTime?: number;
}

export interface AreaDrawing extends DrawingBase {
  type: 'area';
  startIndex: number;
  startPrice: number;
  endIndex: number;
  endPrice: number;
  startTime?: number;
  endTime?: number;
}

export interface PencilDrawing extends DrawingBase {
  type: 'pencil';
  points: Array<{ index: number; price: number; time?: number }>;
}

export interface FibonacciLevel {
  level: number;
  label: string;
  price: number;
}

export interface FibonacciDrawing extends DrawingBase {
  type: 'fibonacci';
  swingLowIndex: number;
  swingLowPrice: number;
  swingHighIndex: number;
  swingHighPrice: number;
  swingLowTime?: number;
  swingHighTime?: number;
  direction: 'up' | 'down';
  levels: FibonacciLevel[];
}

export type Drawing =
  | LineDrawing
  | RulerDrawing
  | RectangleDrawing
  | AreaDrawing
  | PencilDrawing
  | FibonacciDrawing;

export type TwoPointDrawingType = 'line' | 'ruler' | 'rectangle' | 'area' | 'fibonacci';

export interface DrawingHandle {
  drawingId: string;
  handleType: 'start' | 'end' | 'swingLow' | 'swingHigh' | 'body';
  x: number;
  y: number;
}

export interface CoordinateMapper {
  priceToY: (price: number) => number;
  yToPrice: (y: number) => number;
  indexToX: (index: number) => number;
  xToIndex: (x: number) => number;
  indexToCenterX: (index: number) => number;
}
