import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import { CHART_CONFIG, LINE_STYLES, STUDY_COLORS } from '@shared/constants';
import type { AIStudy, AIStudyChannel, AIStudyCupAndHandle, AIStudyDoublePattern, AIStudyElliottWave, AIStudyFibonacci, AIStudyFlag, AIStudyGap, AIStudyHeadAndShoulders, AIStudyLine, AIStudyPennant, AIStudyRoundingBottom, AIStudyTriangle, AIStudyTriplePattern, AIStudyWedge, AIStudyZone, Candle } from '@shared/types';
import { useEffect, useRef, useState } from 'react';
import { useAIStudyHover } from '../../context/AIStudyHoverContext';

interface AIStudyRendererProps {
  canvasManager: CanvasManager | null;
  candles: Candle[];
  studies: AIStudy[];
  width: number;
  height: number;
  mousePosition: { x: number; y: number } | null;
  onStudyHover: (study: AIStudy | null) => void;
  advancedConfig?: {
    paddingLeft?: number;
    paddingRight?: number;
    paddingTop?: number;
    paddingBottom?: number;
  } | undefined;
}

export const AIStudyRenderer = ({
  canvasManager,
  candles,
  studies,
  width,
  height,
  mousePosition,
  onStudyHover,
  advancedConfig,
}: AIStudyRendererProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoveredStudy, setHoveredStudy] = useState<AIStudy | null>(null);
  const { hoveredStudyId, setHoveredStudyId } = useAIStudyHover();
  const studyTagsRef = useRef<Map<number, { x: number; y: number; width: number; height: number }>>(new Map());

  const getStudyColor = (type: AIStudy['type']): string => {
    return STUDY_COLORS[type] || '#6366f1';
  };

  const getLineStyle = (type: AIStudy['type']): number[] => {
    const style = LINE_STYLES[type];
    if (style === 'solid') return [];
    if (style === 'dashed') return [5, 5];
    if (style === 'dotted') return [2, 3];
    return [];
  };

  useEffect(() => {
    if (!canvasManager || candles.length === 0 || !mousePosition) {
      setHoveredStudy(null);
      return;
    }

    const { x: mouseX, y: mouseY } = mousePosition;
    let found: AIStudy | null = null;

    for (const study of studies) {
      if (study.visible === false) continue;
      
      const studyId = study.id;
      if (studyId !== undefined) {
        const tagBounds = studyTagsRef.current.get(studyId);
        
        if (tagBounds) {
          if (mouseX >= tagBounds.x && 
              mouseX <= tagBounds.x + tagBounds.width && 
              mouseY >= tagBounds.y && 
              mouseY <= tagBounds.y + tagBounds.height) {
            found = study;
            break;
          }
        }
      }
      
      if ('topPrice' in study) {
        const startIndex = candles.findIndex(c => c.timestamp >= study.startTimestamp);
        const endIndex = candles.findIndex(c => c.timestamp >= study.endTimestamp);
        
        if (startIndex === -1 || endIndex === -1) continue;

        const x1 = canvasManager.indexToX(startIndex);
        let x2 = canvasManager.indexToX(endIndex);
        const y1 = canvasManager.priceToY(study.topPrice);
        const y2 = canvasManager.priceToY(study.bottomPrice);

        if (study.type === 'buy-zone' || study.type === 'sell-zone' || study.type === 'liquidity-zone') {
          const lastCandleX = canvasManager.indexToX(candles.length - 1);
          const extensionDistance = CHART_CONFIG.STUDY_EXTENSION_DISTANCE;
          const targetX = lastCandleX + extensionDistance;

          if (x2 < targetX) {
            x2 = targetX;
          }
        }

        if (mouseX >= x1 && mouseX <= x2 && mouseY >= y1 && mouseY <= y2) {
          found = study;
          break;
        }
      } else if ('points' in study) {
        const [point1, point2] = study.points;
        const index1 = candles.findIndex(c => c.timestamp >= point1.timestamp);
        const index2 = candles.findIndex(c => c.timestamp >= point2.timestamp);
        
        if (index1 === -1 || index2 === -1) continue;

        const x1 = canvasManager.indexToX(index1);
        const x2 = canvasManager.indexToX(index2);
        const y1 = canvasManager.priceToY(point1.price);
        const y2 = canvasManager.priceToY(point2.price);

        let finalX2 = x2;
        let finalY2 = y2;

        if (study.type === 'support' || study.type === 'resistance') {
          const lastCandleX = canvasManager.indexToX(candles.length - 1);
          const extensionDistance = CHART_CONFIG.STUDY_EXTENSION_DISTANCE;
          const targetX = lastCandleX + extensionDistance;

          if (x2 < targetX) {
            finalX2 = targetX;
            const slope = (y2 - y1) / (x2 - x1);
            finalY2 = y1 + slope * (finalX2 - x1);
          }
        }
        
        const lineThreshold = 5;
        const minX = Math.min(x1, finalX2);
        const maxX = Math.max(x1, finalX2);
        
        if (mouseX >= minX && mouseX <= maxX) {
          const t = (mouseX - x1) / (finalX2 - x1);
          const lineY = y1 + t * (finalY2 - y1);
          
          if (Math.abs(mouseY - lineY) <= lineThreshold) {
            found = study;
            break;
          }
        }
      }
    }

    setHoveredStudy(found);
    if (found?.id) {
      setHoveredStudyId(found.id);
    } else {
      setHoveredStudyId(null);
    }
  }, [canvasManager, candles, studies, mousePosition, setHoveredStudyId]);

  useEffect(() => {
    if (hoveredStudyId !== null) {
      const studyById = studies.find(s => s.id === hoveredStudyId);
      if (studyById && studyById !== hoveredStudy) {
        setHoveredStudy(studyById);
      }
    } else if (!mousePosition) {
      setHoveredStudy(null);
    }
  }, [hoveredStudyId, studies, mousePosition, hoveredStudy]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !canvasManager || candles.length === 0) {
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);

    if (studies.length === 0) {
      return;
    }

    const dimensions = canvasManager.getDimensions();
    if (!dimensions) return;

    const paddingRight = advancedConfig?.paddingRight ?? CHART_CONFIG.CANVAS_PADDING_RIGHT;
    const paddingBottom = advancedConfig?.paddingBottom ?? CHART_CONFIG.CANVAS_PADDING_BOTTOM;

    const chartRightBoundary = dimensions.width - paddingRight;
    const chartBottomBoundary = dimensions.height - paddingBottom;

    const chartArea = {
      left: 0,
      right: chartRightBoundary,
      top: 0,
      bottom: chartBottomBoundary,
    };

    ctx.save();
    ctx.beginPath();
    ctx.rect(chartArea.left, chartArea.top, chartArea.right - chartArea.left, chartArea.bottom - chartArea.top);
    ctx.clip();

    studyTagsRef.current.clear();

    studies.forEach((study, index) => {
      if (study.visible === false) return;
      
      const isHovered = hoveredStudy === study;
      const studyNumber = study.id ?? index + 1;
      
      switch (study.type) {
        case 'support':
        case 'resistance':
        case 'trendline-bullish':
        case 'trendline-bearish':
          if ('points' in study) {
            drawLine(ctx, study as AIStudyLine, canvasManager, candles, isHovered, studyNumber);
          }
          break;

        case 'channel-ascending':
        case 'channel-descending':
        case 'channel-horizontal':
          if ('upperLine' in study) {
            drawChannel(ctx, study as AIStudyChannel, canvasManager, candles, isHovered, studyNumber);
          }
          break;

        case 'fibonacci-retracement':
        case 'fibonacci-extension':
          if ('start' in study) {
            drawFibonacci(ctx, study as AIStudyFibonacci, canvasManager, candles, isHovered, studyNumber);
          }
          break;

        case 'head-and-shoulders':
        case 'inverse-head-and-shoulders':
          if ('leftShoulder' in study) {
            drawHeadAndShoulders(ctx, study as AIStudyHeadAndShoulders, canvasManager, candles, isHovered, studyNumber);
          }
          break;

        case 'double-top':
        case 'double-bottom':
          if ('firstPeak' in study) {
            drawDoublePattern(ctx, study as AIStudyDoublePattern, canvasManager, candles, isHovered, studyNumber);
          }
          break;

        case 'triple-top':
        case 'triple-bottom':
          if ('firstPeak' in study) {
            drawTriplePattern(ctx, study as AIStudyTriplePattern, canvasManager, candles, isHovered, studyNumber);
          }
          break;

        case 'triangle-ascending':
        case 'triangle-descending':
        case 'triangle-symmetrical':
          if ('resistance' in study) {
            drawTriangle(ctx, study as AIStudyTriangle, canvasManager, candles, isHovered, studyNumber);
          }
          break;

        case 'wedge-rising':
        case 'wedge-falling':
          if ('upperTrendline' in study) {
            drawWedge(ctx, study as AIStudyWedge, canvasManager, candles, isHovered, studyNumber);
          }
          break;

        case 'flag-bullish':
        case 'flag-bearish':
          if ('flagpole' in study) {
            drawFlag(ctx, study as AIStudyFlag, canvasManager, candles, isHovered, studyNumber);
          }
          break;

        case 'pennant':
          if ('flagpole' in study) {
            drawPennant(ctx, study as AIStudyPennant, canvasManager, candles, isHovered, studyNumber);
          }
          break;

        case 'cup-and-handle':
          if ('cupBottom' in study) {
            drawCupAndHandle(ctx, study as AIStudyCupAndHandle, canvasManager, candles, isHovered, studyNumber);
          }
          break;

        case 'rounding-bottom':
          if ('bottom' in study) {
            drawRoundingBottom(ctx, study as AIStudyRoundingBottom, canvasManager, candles, isHovered, studyNumber);
          }
          break;

        case 'gap-common':
        case 'gap-breakaway':
        case 'gap-runaway':
        case 'gap-exhaustion':
          if ('gapStart' in study) {
            drawGap(ctx, study as AIStudyGap, canvasManager, candles, isHovered, studyNumber);
          }
          break;

        case 'elliott-wave':
          if ('waves' in study) {
            drawElliottWave(ctx, study as AIStudyElliottWave, canvasManager, candles, isHovered, studyNumber);
          }
          break;

        case 'liquidity-zone':
        case 'sell-zone':
        case 'buy-zone':
        case 'accumulation-zone':
          if ('topPrice' in study) {
            drawZone(ctx, study as AIStudyZone, canvasManager, candles, isHovered, studyNumber);
          }
          break;
      }
    });

    ctx.restore();
  }, [canvasManager, candles, studies, width, height, hoveredStudy, advancedConfig]);

  useEffect(() => {
    onStudyHover(hoveredStudy);
  }, [hoveredStudy, onStudyHover]);

  const drawLine = (
    ctx: CanvasRenderingContext2D,
    study: AIStudyLine,
    manager: CanvasManager,
    candles: Candle[],
    isHovered: boolean,
    studyNumber: number
  ) => {
    const [point1, point2] = study.points;
    
    const index1 = candles.findIndex(c => c.timestamp >= point1.timestamp);
    const index2 = candles.findIndex(c => c.timestamp >= point2.timestamp);
    
    if (index1 === -1 || index2 === -1) return;

    const x1 = manager.indexToX(index1);
    const x2 = manager.indexToX(index2);
    const y1 = manager.priceToY(point1.price);
    const y2 = manager.priceToY(point2.price);

    let finalX2 = x2;
    let finalY2 = y2;

    if (study.type === 'support' || study.type === 'resistance') {
      const lastCandleX = manager.indexToX(candles.length - 1);
      const extensionDistance = CHART_CONFIG.STUDY_EXTENSION_DISTANCE;
      const targetX = lastCandleX + extensionDistance;

      if (x2 < targetX) {
        finalX2 = targetX;
        const slope = (y2 - y1) / (x2 - x1);
        finalY2 = y1 + slope * (finalX2 - x1);
      }
    }

    ctx.save();
    ctx.strokeStyle = getStudyColor(study.type);
    ctx.lineWidth = isHovered ? 3 : 2;
    ctx.setLineDash(getLineStyle(study.type));

    if (isHovered) {
      ctx.shadowColor = getStudyColor(study.type);
      ctx.shadowBlur = 8;
    }

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(finalX2, finalY2);
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.restore();

    const iconX = Math.min(x1, x2);
    const iconY = Math.min(y1, y2) - 22;
    drawAndStoreStudyTag(ctx, iconX, iconY, studyNumber, study);
  };

  const drawChannel = (
    ctx: CanvasRenderingContext2D,
    study: AIStudyChannel,
    manager: CanvasManager,
    candles: Candle[],
    isHovered: boolean,
    studyNumber: number
  ) => {
    const color = getStudyColor(study.type);
    const lineWidth = isHovered ? 3 : 2;

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.setLineDash(getLineStyle(study.type));

    if (isHovered) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;
    }

    [study.upperLine, study.lowerLine].forEach((line) => {
      const [point1, point2] = line;
      const index1 = candles.findIndex(c => c.timestamp >= point1.timestamp);
      const index2 = candles.findIndex(c => c.timestamp >= point2.timestamp);
      
      if (index1 === -1 || index2 === -1) return;

      const x1 = manager.indexToX(index1);
      const x2 = manager.indexToX(index2);
      const y1 = manager.priceToY(point1.price);
      const y2 = manager.priceToY(point2.price);

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    });

    ctx.setLineDash([]);
    ctx.restore();

    const firstPoint = study.upperLine[0];
    const index = candles.findIndex(c => c.timestamp >= firstPoint.timestamp);
    if (index !== -1) {
      const x = manager.indexToX(index);
      const y = manager.priceToY(firstPoint.price);
      drawStudyTag(ctx, x, y - 22, studyNumber, study.type);
    }
  };

  const drawFibonacci = (
    ctx: CanvasRenderingContext2D,
    study: AIStudyFibonacci,
    manager: CanvasManager,
    candles: Candle[],
    isHovered: boolean,
    studyNumber: number
  ) => {
    const startIndex = candles.findIndex(c => c.timestamp >= study.startPoint.timestamp);
    const endIndex = candles.findIndex(c => c.timestamp >= study.endPoint.timestamp);
    
    if (startIndex === -1 || endIndex === -1) return;

    const color = getStudyColor(study.type);
    const lineWidth = isHovered ? 2 : 1;

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.setLineDash([2, 3]);

    if (isHovered) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;
    }

    study.levels.forEach((level) => {
      const y = manager.priceToY(level.price);
      const x1 = manager.indexToX(startIndex);
      const x2 = manager.indexToX(endIndex);

      ctx.beginPath();
      ctx.moveTo(x1, y);
      ctx.lineTo(x2, y);
      ctx.stroke();

      ctx.fillStyle = color;
      ctx.font = '10px system-ui';
      ctx.fillText(`${(level.ratio * 100).toFixed(1)}%`, x2 + 5, y - 2);
    });

    ctx.setLineDash([]);
    ctx.restore();

    const x = manager.indexToX(startIndex);
    const y = manager.priceToY(study.startPoint.price);
    drawStudyTag(ctx, x, y - 22, studyNumber, study.type);
  };

  const drawHeadAndShoulders = (
    ctx: CanvasRenderingContext2D,
    study: AIStudyHeadAndShoulders,
    manager: CanvasManager,
    candles: Candle[],
    isHovered: boolean,
    studyNumber: number
  ) => {
    const color = getStudyColor(study.type);
    const lineWidth = isHovered ? 3 : 2;

    const points = [study.leftShoulder, study.head, study.rightShoulder];
    const indices = points.map(p => candles.findIndex(c => c.timestamp >= p.timestamp));
    
    if (indices.some(i => i === -1)) return;

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;

    ctx.beginPath();
    indices.forEach((index, i) => {
      if (index === -1) return;
      const x = manager.indexToX(index);
      const y = manager.priceToY(points[i]!.price);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();

    if (study.neckline) {
      ctx.setLineDash([5, 5]);
      const [neck1, neck2] = study.neckline;
      const neckIndex1 = candles.findIndex(c => c.timestamp >= neck1.timestamp);
      const neckIndex2 = candles.findIndex(c => c.timestamp >= neck2.timestamp);
      
      if (neckIndex1 !== -1 && neckIndex2 !== -1) {
        ctx.beginPath();
        ctx.moveTo(manager.indexToX(neckIndex1), manager.priceToY(neck1.price));
        ctx.lineTo(manager.indexToX(neckIndex2), manager.priceToY(neck2.price));
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }

    ctx.restore();

    if (indices[0] !== undefined && indices[0] !== -1) {
      const x = manager.indexToX(indices[0]);
      const y = manager.priceToY(points[0]!.price);
      drawStudyTag(ctx, x, y - 22, studyNumber, study.type);
    }
  };

  const drawDoublePattern = (
    ctx: CanvasRenderingContext2D,
    study: AIStudyDoublePattern,
    manager: CanvasManager,
    candles: Candle[],
    isHovered: boolean,
    studyNumber: number
  ) => {
    const color = getStudyColor(study.type);
    const lineWidth = isHovered ? 3 : 2;

    const points = [study.firstPeak, study.secondPeak];
    const indices = points.map(p => candles.findIndex(c => c.timestamp >= p.timestamp));
    
    if (indices.some(i => i === -1)) return;

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;

    if (isHovered) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;
    }

    ctx.beginPath();
    indices.forEach((index, i) => {
      if (index === -1) return;
      const x = manager.indexToX(index);
      const y = manager.priceToY(points[i]!.price);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();

    if (study.neckline) {
      ctx.setLineDash([5, 5]);
      const neckY = manager.priceToY(study.neckline.price);
      if (indices[0] !== -1 && indices[1] !== -1 && indices[0] !== undefined && indices[1] !== undefined) {
        ctx.beginPath();
        ctx.moveTo(manager.indexToX(indices[0]), neckY);
        ctx.lineTo(manager.indexToX(indices[1]), neckY);
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }

    ctx.restore();

    if (indices[0] !== undefined && indices[0] !== -1) {
      const x = manager.indexToX(indices[0]);
      const y = manager.priceToY(points[0]!.price);
      drawStudyTag(ctx, x, y - 22, studyNumber, study.type);
    }
  };

  const drawTriplePattern = (
    ctx: CanvasRenderingContext2D,
    study: AIStudyTriplePattern,
    manager: CanvasManager,
    candles: Candle[],
    isHovered: boolean,
    studyNumber: number
  ) => {
    const color = getStudyColor(study.type);
    const lineWidth = isHovered ? 3 : 2;

    const points = [study.peak1, study.peak2, study.peak3];
    const indices = points.map(p => candles.findIndex(c => c.timestamp >= p.timestamp));
    
    if (indices.some(i => i === -1)) return;

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;

    ctx.beginPath();
    indices.forEach((index, i) => {
      if (index === -1) return;
      const x = manager.indexToX(index);
      const y = manager.priceToY(points[i]!.price);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();

    if (study.neckline) {
      ctx.setLineDash([5, 5]);
      const [neck1, neck2] = study.neckline;
      const neckIndex1 = candles.findIndex(c => c.timestamp >= neck1.timestamp);
      const neckIndex2 = candles.findIndex(c => c.timestamp >= neck2.timestamp);
      
      if (neckIndex1 !== -1 && neckIndex2 !== -1) {
        ctx.beginPath();
        ctx.moveTo(manager.indexToX(neckIndex1), manager.priceToY(neck1.price));
        ctx.lineTo(manager.indexToX(neckIndex2), manager.priceToY(neck2.price));
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }

    ctx.restore();

    if (indices[0] !== undefined && indices[0] !== -1) {
      const x = manager.indexToX(indices[0]);
      const y = manager.priceToY(points[0]!.price);
      drawStudyTag(ctx, x, y - 22, studyNumber, study.type);
    }
  };

  const drawTriangle = (
    ctx: CanvasRenderingContext2D,
    study: AIStudyTriangle,
    manager: CanvasManager,
    candles: Candle[],
    isHovered: boolean,
    studyNumber: number
  ) => {
    const color = getStudyColor(study.type);
    const lineWidth = isHovered ? 3 : 2;

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.setLineDash([5, 5]);

    if (isHovered) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;
    }

    [study.upperTrendline, study.lowerTrendline].forEach((line) => {
      const [point1, point2] = line;
      const index1 = candles.findIndex(c => c.timestamp >= point1.timestamp);
      const index2 = candles.findIndex(c => c.timestamp >= point2.timestamp);
      
      if (index1 === -1 || index2 === -1) return;

      ctx.beginPath();
      ctx.moveTo(manager.indexToX(index1), manager.priceToY(point1.price));
      ctx.lineTo(manager.indexToX(index2), manager.priceToY(point2.price));
      ctx.stroke();
    });

    ctx.setLineDash([]);
    ctx.restore();

    const firstPoint = study.upperTrendline[0];
    const index = candles.findIndex(c => c.timestamp >= firstPoint.timestamp);
    if (index !== -1) {
      const x = manager.indexToX(index);
      const y = manager.priceToY(firstPoint.price);
      drawStudyTag(ctx, x, y - 22, studyNumber, study.type);
    }
  };

  const drawWedge = (
    ctx: CanvasRenderingContext2D,
    study: AIStudyWedge,
    manager: CanvasManager,
    candles: Candle[],
    isHovered: boolean,
    studyNumber: number
  ) => {
    const color = getStudyColor(study.type);
    const lineWidth = isHovered ? 3 : 2;

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.setLineDash([5, 5]);

    if (isHovered) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;
    }

    [study.upperTrendline, study.lowerTrendline].forEach((line) => {
      const [point1, point2] = line;
      const index1 = candles.findIndex(c => c.timestamp >= point1.timestamp);
      const index2 = candles.findIndex(c => c.timestamp >= point2.timestamp);
      
      if (index1 === -1 || index2 === -1) return;

      ctx.beginPath();
      ctx.moveTo(manager.indexToX(index1), manager.priceToY(point1.price));
      ctx.lineTo(manager.indexToX(index2), manager.priceToY(point2.price));
      ctx.stroke();
    });

    ctx.setLineDash([]);
    ctx.restore();

    const firstPoint = study.upperTrendline[0];
    const index = candles.findIndex(c => c.timestamp >= firstPoint.timestamp);
    if (index !== -1) {
      const x = manager.indexToX(index);
      const y = manager.priceToY(firstPoint.price);
      drawStudyTag(ctx, x, y - 22, studyNumber, study.type);
    }
  };

  const drawFlag = (
    ctx: CanvasRenderingContext2D,
    study: AIStudyFlag,
    manager: CanvasManager,
    candles: Candle[],
    isHovered: boolean,
    studyNumber: number
  ) => {
    const color = getStudyColor(study.type);
    const lineWidth = isHovered ? 3 : 2;

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;

    if (isHovered) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;
    }

    const poleStartIndex = candles.findIndex(c => c.timestamp >= study.flagpole.start.timestamp);
    const poleEndIndex = candles.findIndex(c => c.timestamp >= study.flagpole.end.timestamp);
    
    if (poleStartIndex !== -1 && poleEndIndex !== -1) {
      ctx.beginPath();
      ctx.moveTo(manager.indexToX(poleStartIndex), manager.priceToY(study.flagpole.start.price));
      ctx.lineTo(manager.indexToX(poleEndIndex), manager.priceToY(study.flagpole.end.price));
      ctx.stroke();
    }

    ctx.setLineDash([5, 5]);
    [study.flag.upperTrendline, study.flag.lowerTrendline].forEach((line) => {
      const [point1, point2] = line;
      const index1 = candles.findIndex(c => c.timestamp >= point1.timestamp);
      const index2 = candles.findIndex(c => c.timestamp >= point2.timestamp);
      
      if (index1 === -1 || index2 === -1) return;

      ctx.beginPath();
      ctx.moveTo(manager.indexToX(index1), manager.priceToY(point1.price));
      ctx.lineTo(manager.indexToX(index2), manager.priceToY(point2.price));
      ctx.stroke();
    });

    ctx.setLineDash([]);
    ctx.restore();

    if (poleStartIndex !== -1) {
      const x = manager.indexToX(poleStartIndex);
      const y = manager.priceToY(study.flagpole.start.price);
      drawStudyTag(ctx, x, y - 22, studyNumber, study.type);
    }
  };

  const drawPennant = (
    ctx: CanvasRenderingContext2D,
    study: AIStudyPennant,
    manager: CanvasManager,
    candles: Candle[],
    isHovered: boolean,
    studyNumber: number
  ) => {
    const color = getStudyColor(study.type);
    const lineWidth = isHovered ? 3 : 2;

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;

    if (isHovered) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;
    }

    const poleStartIndex = candles.findIndex(c => c.timestamp >= study.flagpole.start.timestamp);
    const poleEndIndex = candles.findIndex(c => c.timestamp >= study.flagpole.end.timestamp);
    
    if (poleStartIndex !== -1 && poleEndIndex !== -1) {
      ctx.beginPath();
      ctx.moveTo(manager.indexToX(poleStartIndex), manager.priceToY(study.flagpole.start.price));
      ctx.lineTo(manager.indexToX(poleEndIndex), manager.priceToY(study.flagpole.end.price));
      ctx.stroke();
    }

    ctx.setLineDash([5, 5]);
    [study.pennant.upperTrendline, study.pennant.lowerTrendline].forEach((line) => {
      const [point1, point2] = line;
      const index1 = candles.findIndex(c => c.timestamp >= point1.timestamp);
      const index2 = candles.findIndex(c => c.timestamp >= point2.timestamp);
      
      if (index1 === -1 || index2 === -1) return;

      ctx.beginPath();
      ctx.moveTo(manager.indexToX(index1), manager.priceToY(point1.price));
      ctx.lineTo(manager.indexToX(index2), manager.priceToY(point2.price));
      ctx.stroke();
    });

    ctx.setLineDash([]);
    ctx.restore();

    if (poleStartIndex !== -1) {
      const x = manager.indexToX(poleStartIndex);
      const y = manager.priceToY(study.flagpole.start.price);
      drawStudyTag(ctx, x, y - 22, studyNumber, study.type);
    }
  };

  const drawCupAndHandle = (
    ctx: CanvasRenderingContext2D,
    study: AIStudyCupAndHandle,
    manager: CanvasManager,
    candles: Candle[],
    isHovered: boolean,
    studyNumber: number
  ) => {
    const color = getStudyColor(study.type);
    const lineWidth = isHovered ? 2 : 1;

    const cupStartIndex = candles.findIndex(c => c.timestamp >= study.cupStart.timestamp);
    const cupBottomIndex = candles.findIndex(c => c.timestamp >= study.cupBottom.timestamp);
    const cupEndIndex = candles.findIndex(c => c.timestamp >= study.cupEnd.timestamp);
    
    if (cupStartIndex === -1 || cupBottomIndex === -1 || cupEndIndex === -1) return;

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;

    if (isHovered) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;
    }

    ctx.beginPath();
    ctx.moveTo(manager.indexToX(cupStartIndex), manager.priceToY(study.cupStart.price));
    ctx.quadraticCurveTo(
      manager.indexToX(cupBottomIndex), 
      manager.priceToY(study.cupBottom.price),
      manager.indexToX(cupEndIndex), 
      manager.priceToY(study.cupEnd.price)
    );
    ctx.stroke();

    const handleStartIndex = candles.findIndex(c => c.timestamp >= study.handleStart.timestamp);
    const handleLowIndex = candles.findIndex(c => c.timestamp >= study.handleLow.timestamp);
    const handleEndIndex = candles.findIndex(c => c.timestamp >= study.handleEnd.timestamp);
    
    if (handleStartIndex !== -1 && handleLowIndex !== -1 && handleEndIndex !== -1) {
      ctx.beginPath();
      ctx.moveTo(manager.indexToX(handleStartIndex), manager.priceToY(study.handleStart.price));
      ctx.lineTo(manager.indexToX(handleLowIndex), manager.priceToY(study.handleLow.price));
      ctx.lineTo(manager.indexToX(handleEndIndex), manager.priceToY(study.handleEnd.price));
      ctx.stroke();
    }

    ctx.restore();

    const x = manager.indexToX(cupStartIndex);
    const y = manager.priceToY(study.cupStart.price);
    drawStudyTag(ctx, x, y - 22, studyNumber, study.type);
  };

  const drawRoundingBottom = (
    ctx: CanvasRenderingContext2D,
    study: AIStudyRoundingBottom,
    manager: CanvasManager,
    candles: Candle[],
    isHovered: boolean,
    studyNumber: number
  ) => {
    const color = getStudyColor(study.type);
    const lineWidth = isHovered ? 2 : 1;

    const startIndex = candles.findIndex(c => c.timestamp >= study.start.timestamp);
    const bottomIndex = candles.findIndex(c => c.timestamp >= study.bottom.timestamp);
    const endIndex = candles.findIndex(c => c.timestamp >= study.end.timestamp);
    
    if (startIndex === -1 || bottomIndex === -1 || endIndex === -1) return;

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;

    if (isHovered) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;
    }

    ctx.beginPath();
    ctx.moveTo(manager.indexToX(startIndex), manager.priceToY(study.start.price));
    ctx.quadraticCurveTo(
      manager.indexToX(bottomIndex), 
      manager.priceToY(study.bottom.price),
      manager.indexToX(endIndex), 
      manager.priceToY(study.end.price)
    );
    ctx.stroke();

    ctx.restore();

    const x = manager.indexToX(startIndex);
    const y = manager.priceToY(study.start.price);
    drawStudyTag(ctx, x, y - 22, studyNumber, study.type);
  };

  const drawGap = (
    ctx: CanvasRenderingContext2D,
    study: AIStudyGap,
    manager: CanvasManager,
    candles: Candle[],
    isHovered: boolean,
    studyNumber: number
  ) => {
    const startIndex = candles.findIndex(c => c.timestamp >= study.gapStart.timestamp);
    const endIndex = candles.findIndex(c => c.timestamp >= study.gapEnd.timestamp);
    
    if (startIndex === -1 || endIndex === -1) return;

    const x1 = manager.indexToX(startIndex);
    const x2 = manager.indexToX(endIndex);
    const y1 = manager.priceToY(study.gapStart.price);
    const y2 = manager.priceToY(study.gapEnd.price);

    const color = getStudyColor(study.type);
    const rgb = hexToRgb(color);
    const fillColor = rgb 
      ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.15)` 
      : 'rgba(99, 102, 241, 0.15)';
    
    ctx.save();
    ctx.fillStyle = fillColor;
    ctx.fillRect(x1, Math.min(y1, y2), x2 - x1, Math.abs(y2 - y1));

    ctx.strokeStyle = color;
    ctx.lineWidth = isHovered ? 2 : 1;
    ctx.setLineDash([3, 3]);
    
    if (isHovered) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;
    }
    
    ctx.strokeRect(x1, Math.min(y1, y2), x2 - x1, Math.abs(y2 - y1));
    ctx.setLineDash([]);
    
    ctx.restore();

    drawStudyTag(ctx, x1 + 4, Math.min(y1, y2) + 4, studyNumber, study.type);
  };

  const drawElliottWave = (
    ctx: CanvasRenderingContext2D,
    study: AIStudyElliottWave,
    manager: CanvasManager,
    candles: Candle[],
    isHovered: boolean,
    studyNumber: number
  ) => {
    const color = getStudyColor(study.type);
    const lineWidth = isHovered ? 3 : 2;

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;

    if (isHovered) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;
    }

    const wavePoints = [
      study.impulse.wave1.start,
      study.impulse.wave1.end,
      study.impulse.wave2.end,
      study.impulse.wave3.end,
      study.impulse.wave4.end,
      study.impulse.wave5.end,
    ];

    const indices = wavePoints.map(p => candles.findIndex(c => c.timestamp >= p.timestamp));
    
    if (indices.some(i => i === -1)) {
      ctx.restore();
      return;
    }

    ctx.beginPath();
    indices.forEach((index, i) => {
      if (index === -1) return;
      const x = manager.indexToX(index);
      const y = manager.priceToY(wavePoints[i]!.price);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      
      if (i > 0 && i <= 5) {
        ctx.save();
        ctx.fillStyle = color;
        ctx.font = 'bold 12px system-ui';
        ctx.fillText(`${i}`, x + 5, y - 5);
        ctx.restore();
      }
    });
    ctx.stroke();

    if (study.correction) {
      ctx.setLineDash([3, 3]);
      const corrective = [
        study.correction.waveA.start,
        study.correction.waveA.end,
        study.correction.waveB.end,
        study.correction.waveC.end,
      ];
      const correctiveIndices = corrective.map(p => candles.findIndex(c => c.timestamp >= p.timestamp));
      
      if (!correctiveIndices.some(i => i === -1)) {
        ctx.beginPath();
        correctiveIndices.forEach((index, i) => {
          if (index === -1) return;
          const x = manager.indexToX(index);
          const y = manager.priceToY(corrective[i]!.price);
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
          
          const labels = ['A', 'B', 'C', 'D'];
          ctx.fillStyle = color;
          ctx.font = 'bold 12px system-ui';
          ctx.fillText(labels[i]!, x + 5, y - 5);
        });
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }

    ctx.restore();

    if (indices[0] !== undefined && indices[0] !== -1) {
      const x = manager.indexToX(indices[0]);
      const y = manager.priceToY(wavePoints[0]!.price);
      drawStudyTag(ctx, x, y - 22, studyNumber, study.type);
    }
  };

  const drawZone = (
    ctx: CanvasRenderingContext2D,
    study: AIStudyZone,
    manager: CanvasManager,
    candles: Candle[],
    isHovered: boolean,
    studyNumber: number
  ) => {
    const startIndex = candles.findIndex(c => c.timestamp >= study.startTimestamp);
    const endIndex = candles.findIndex(c => c.timestamp >= study.endTimestamp);
    
    if (startIndex === -1 || endIndex === -1) return;

    const x1 = manager.indexToX(startIndex);
    let x2 = manager.indexToX(endIndex);
    const y1 = manager.priceToY(study.topPrice);
    const y2 = manager.priceToY(study.bottomPrice);

    if (study.type === 'buy-zone' || study.type === 'sell-zone' || study.type === 'liquidity-zone') {
      const lastCandleX = manager.indexToX(candles.length - 1);
      const extensionDistance = CHART_CONFIG.STUDY_EXTENSION_DISTANCE;
      const targetX = lastCandleX + extensionDistance;

      if (x2 < targetX) {
        x2 = targetX;
      }
    }

    const baseColor = getStudyColor(study.type);
    const rgb = hexToRgb(baseColor);
    
    const fillOpacity = isHovered ? 0.25 : 0.15;
    const fillColor = rgb 
      ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${fillOpacity})` 
      : `rgba(99, 102, 241, ${fillOpacity})`;
    
    ctx.save();
    ctx.fillStyle = fillColor;
    ctx.fillRect(x1, y1, x2 - x1, y2 - y1);

    ctx.strokeStyle = baseColor;
    ctx.lineWidth = isHovered ? 2 : 1;
    
    if (isHovered) {
      ctx.shadowColor = baseColor;
      ctx.shadowBlur = 8;
    }
    
    ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
    ctx.restore();

    drawAndStoreStudyTag(ctx, x1 + 4, y1 + 4, studyNumber, study);
  };

  const hexToRgb = (hex: string): { r: number; g: number; b: number } | null => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1]!, 16),
      g: parseInt(result[2]!, 16),
      b: parseInt(result[3]!, 16)
    } : null;
  };

  const drawStudyTag = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    studyNumber: number,
    studyType: AIStudy['type']
  ): { x: number; y: number; width: number; height: number } => {
    const studyColor = STUDY_COLORS[studyType] || '#8b5cf6';
    const rgb = hexToRgb(studyColor);
    const bgColor = rgb ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.15)` : 'rgba(139, 92, 246, 0.15)';
    
    const text = `#${studyNumber}`;
    const fontSize = 9;
    const paddingX = 4;
    const paddingY = 2;
    
    ctx.save();
    ctx.font = `bold ${fontSize}px system-ui`;
    const textWidth = ctx.measureText(text).width;
    const boxWidth = textWidth + paddingX * 2;
    const boxHeight = fontSize + paddingY * 2 + 2;
    
    ctx.fillStyle = bgColor;
    ctx.beginPath();
    ctx.roundRect(x, y, boxWidth, boxHeight, 3);
    ctx.fill();
    
    ctx.strokeStyle = studyColor;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    
    ctx.fillStyle = studyColor;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(text, x + paddingX, y + paddingY + 1);
    
    ctx.restore();
    
    return { x, y, width: boxWidth, height: boxHeight };
  };

  const storeTagBounds = (study: AIStudy, bounds: { x: number; y: number; width: number; height: number }) => {
    if (study.id !== undefined) {
      studyTagsRef.current.set(study.id, bounds);
    }
  };

  const drawAndStoreStudyTag = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    studyNumber: number,
    study: AIStudy
  ) => {
    const tagBounds = drawStudyTag(ctx, x, y, studyNumber, study.type);
    storeTagBounds(study, tagBounds);
  };

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        pointerEvents: 'none',
        zIndex: 1,
      }}
    />
  );
};
