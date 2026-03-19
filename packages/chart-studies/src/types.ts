export type DrawingType = 'line' | 'rectangle' | 'pencil' | 'fibonacci' | 'ruler' | 'area' | 'arrow' | 'text';

export interface DrawingBase {
  id: string;
  type: DrawingType;
  symbol: string;
  interval: string;
  createdAt: number;
  updatedAt: number;
  visible: boolean;
  locked: boolean;
  zIndex: number;
  color?: string;
  lineWidth?: number;
}

interface TwoPointFields {
  startIndex: number;
  startPrice: number;
  endIndex: number;
  endPrice: number;
  startTime?: number;
  endTime?: number;
}

export interface LineDrawing extends DrawingBase, TwoPointFields { type: 'line'; }
export interface RulerDrawing extends DrawingBase, TwoPointFields { type: 'ruler'; }
export interface RectangleDrawing extends DrawingBase, TwoPointFields { type: 'rectangle'; }
export interface AreaDrawing extends DrawingBase, TwoPointFields { type: 'area'; }
export interface ArrowDrawing extends DrawingBase, TwoPointFields { type: 'arrow'; }

export interface PencilDrawing extends DrawingBase {
  type: 'pencil';
  points: Array<{ index: number; price: number; time?: number }>;
}

export interface TextDrawing extends DrawingBase {
  type: 'text';
  index: number;
  price: number;
  time?: number;
  text: string;
  fontSize: number;
  fontWeight: 'normal' | 'bold';
  textDecoration: 'none' | 'underline';
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
  | FibonacciDrawing
  | ArrowDrawing
  | TextDrawing;

export type TwoPointDrawingType = 'line' | 'ruler' | 'rectangle' | 'area' | 'fibonacci' | 'arrow';

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
