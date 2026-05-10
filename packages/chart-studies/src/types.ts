export type DrawingType = 'line' | 'rectangle' | 'pencil' | 'fibonacci' | 'ruler' | 'area' | 'arrow' | 'text' | 'ray' | 'horizontalLine' | 'channel' | 'trendLine' | 'priceRange' | 'verticalLine' | 'highlighter' | 'ellipse' | 'pitchfork' | 'gannFan' | 'longPosition' | 'shortPosition';

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
export interface RayDrawing extends DrawingBase, TwoPointFields { type: 'ray'; }

export interface ChannelDrawing extends DrawingBase, TwoPointFields {
  type: 'channel';
  widthIndex: number;
  widthPrice: number;
  widthTime?: number;
}

export interface HorizontalLineDrawing extends DrawingBase {
  type: 'horizontalLine';
  index: number;
  price: number;
  time?: number;
}

export interface PencilDrawing extends DrawingBase {
  type: 'pencil';
  points: Array<{ index: number; price: number; time?: number }>;
}

export interface TrendLineDrawing extends DrawingBase, TwoPointFields { type: 'trendLine'; }
export interface PriceRangeDrawing extends DrawingBase, TwoPointFields { type: 'priceRange'; }
export interface VerticalLineDrawing extends DrawingBase {
  type: 'verticalLine';
  index: number;
  price: number;
  time?: number;
}
export interface HighlighterDrawing extends DrawingBase {
  type: 'highlighter';
  points: Array<{ index: number; price: number; time?: number }>;
}
export interface EllipseDrawing extends DrawingBase, TwoPointFields { type: 'ellipse'; }
export interface PitchforkDrawing extends DrawingBase, TwoPointFields {
  type: 'pitchfork';
  widthIndex: number;
  widthPrice: number;
  widthTime?: number;
}
export interface GannFanDrawing extends DrawingBase, TwoPointFields { type: 'gannFan'; }

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

export interface LongPositionDrawing extends DrawingBase {
  type: 'longPosition';
  entryIndex: number;
  entryPrice: number;
  entryTime?: number;
  stopLossPrice: number;
  takeProfitPrice: number;
}

export interface ShortPositionDrawing extends DrawingBase {
  type: 'shortPosition';
  entryIndex: number;
  entryPrice: number;
  entryTime?: number;
  stopLossPrice: number;
  takeProfitPrice: number;
}

export type Drawing =
  | LineDrawing
  | RulerDrawing
  | RectangleDrawing
  | AreaDrawing
  | PencilDrawing
  | FibonacciDrawing
  | ArrowDrawing
  | TextDrawing
  | RayDrawing
  | HorizontalLineDrawing
  | ChannelDrawing
  | TrendLineDrawing
  | PriceRangeDrawing
  | VerticalLineDrawing
  | HighlighterDrawing
  | EllipseDrawing
  | PitchforkDrawing
  | GannFanDrawing
  | LongPositionDrawing
  | ShortPositionDrawing;

export type TwoPointDrawingType = 'line' | 'ruler' | 'rectangle' | 'area' | 'fibonacci' | 'arrow' | 'ray' | 'trendLine' | 'priceRange' | 'ellipse' | 'gannFan';

export interface DrawingHandle {
  drawingId: string;
  handleType: 'start' | 'end' | 'swingLow' | 'swingHigh' | 'body' | 'width';
  x: number;
  y: number;
}

export interface CoordinateMapper {
  priceToY: (price: number) => number;
  yToPrice: (y: number) => number;
  indexToX: (index: number) => number;
  xToIndex: (x: number) => number;
  indexToCenterX: (index: number) => number;
  /**
   * Resolves a stored kline timestamp (`drawing.startTime` /
   * `drawing.endTime` / `drawing.time`) to its current array index.
   * Drawing renderers should prefer this over the stored `*Index`
   * field so that pagination prepends, kline reloads, or any other
   * array-shifting events don't cause drawings to drift on the time
   * axis. Returns -1 if the manager has no klines loaded yet.
   */
  timeToIndex: (timestamp: number) => number;
}
