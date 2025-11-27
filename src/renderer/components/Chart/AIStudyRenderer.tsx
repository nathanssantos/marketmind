import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import { CHART_CONFIG, LINE_STYLES, STUDY_COLORS } from '@shared/constants';
import type { AIStudy, AIStudyChannel, AIStudyCupAndHandle, AIStudyDoublePattern, AIStudyFibonacci, AIStudyFlag, AIStudyGap, AIStudyHeadAndShoulders, AIStudyLine, AIStudyPennant, AIStudyRoundingBottom, AIStudyTriangle, AIStudyTriplePattern, AIStudyWedge, AIStudyZone, Candle } from '@shared/types';
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

        const x1 = canvasManager.indexToCenterX(startIndex);
        let x2 = canvasManager.indexToCenterX(endIndex);
        const y1 = canvasManager.priceToY(study.topPrice);
        const y2 = canvasManager.priceToY(study.bottomPrice);

        if (study.type === 'buy-zone' || study.type === 'sell-zone' || study.type === 'liquidity-zone' || study.type === 'accumulation-zone') {
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

        const x1 = canvasManager.indexToCenterX(index1);
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
      } else if (study.type === 'head-and-shoulders' || study.type === 'inverse-head-and-shoulders') {
        const pattern = study;
        const points = [pattern.leftShoulder, pattern.head, pattern.rightShoulder];
        const indices = points.map(p => candles.findIndex(c => c.timestamp >= p.timestamp));

        if (indices.some(i => i === -1)) continue;

        const minX = Math.min(...indices.map(i => canvasManager.indexToCenterX(i)));
        const maxX = Math.max(...indices.map(i => canvasManager.indexToCenterX(i)));
        const minY = Math.min(...points.map(p => canvasManager.priceToY(p.price)));
        const maxY = Math.max(...points.map(p => canvasManager.priceToY(p.price)));

        const padding = 10;
        if (mouseX >= minX - padding && mouseX <= maxX + padding &&
          mouseY >= minY - padding && mouseY <= maxY + padding) {
          found = study;
          break;
        }
      } else if (study.type === 'double-top' || study.type === 'double-bottom') {
        const pattern = study;
        const points = [pattern.firstPeak, pattern.secondPeak];
        const indices = points.map(p => candles.findIndex(c => c.timestamp >= p.timestamp));

        if (indices.some(i => i === -1)) continue;

        const minX = Math.min(...indices.map(i => canvasManager.indexToCenterX(i)));
        const maxX = Math.max(...indices.map(i => canvasManager.indexToCenterX(i)));

        if (pattern.neckline) {
          const neckY = canvasManager.priceToY(pattern.neckline.price);
          const allY = [...points.map(p => canvasManager.priceToY(p.price)), neckY];
          const minYAll = Math.min(...allY);
          const maxYAll = Math.max(...allY);

          const padding = 10;
          if (mouseX >= minX - padding && mouseX <= maxX + padding &&
            mouseY >= minYAll - padding && mouseY <= maxYAll + padding) {
            found = study;
            break;
          }
        }
      } else if (study.type === 'triangle-ascending' || study.type === 'triangle-descending' || study.type === 'triangle-symmetrical') {
        const pattern = study;
        const allPoints = [...pattern.upperTrendline, ...pattern.lowerTrendline];
        if (pattern.apex) allPoints.push(pattern.apex);
        const indices = allPoints.map(p => candles.findIndex(c => c.timestamp >= p.timestamp));

        if (indices.some(i => i === -1)) continue;

        const minX = Math.min(...indices.map(i => canvasManager.indexToCenterX(i)));
        const maxX = Math.max(...indices.map(i => canvasManager.indexToCenterX(i)));
        const minY = Math.min(...allPoints.map(p => canvasManager.priceToY(p.price)));
        const maxY = Math.max(...allPoints.map(p => canvasManager.priceToY(p.price)));

        const padding = 10;
        if (mouseX >= minX - padding && mouseX <= maxX + padding &&
          mouseY >= minY - padding && mouseY <= maxY + padding) {
          found = study;
          break;
        }
      } else if (study.type === 'wedge-rising' || study.type === 'wedge-falling') {
        const pattern = study;
        const allPoints = [...pattern.upperTrendline, ...pattern.lowerTrendline];
        if (pattern.convergencePoint) allPoints.push(pattern.convergencePoint);
        const indices = allPoints.map(p => candles.findIndex(c => c.timestamp >= p.timestamp));

        if (indices.some(i => i === -1)) continue;

        const minX = Math.min(...indices.map(i => canvasManager.indexToCenterX(i)));
        const maxX = Math.max(...indices.map(i => canvasManager.indexToCenterX(i)));
        const minY = Math.min(...allPoints.map(p => canvasManager.priceToY(p.price)));
        const maxY = Math.max(...allPoints.map(p => canvasManager.priceToY(p.price)));

        const padding = 10;
        if (mouseX >= minX - padding && mouseX <= maxX + padding &&
          mouseY >= minY - padding && mouseY <= maxY + padding) {
          found = study;
          break;
        }
      } else if (study.type === 'channel-ascending' || study.type === 'channel-descending' || study.type === 'channel-horizontal') {
        const channel = study;
        const allPoints = [...channel.upperLine, ...channel.lowerLine];
        const indices = allPoints.map(p => candles.findIndex(c => c.timestamp >= p.timestamp));

        if (indices.some(i => i === -1)) continue;

        const minX = Math.min(...indices.map(i => canvasManager.indexToCenterX(i)));
        const maxX = Math.max(...indices.map(i => canvasManager.indexToCenterX(i)));
        const minY = Math.min(...allPoints.map(p => canvasManager.priceToY(p.price)));
        const maxY = Math.max(...allPoints.map(p => canvasManager.priceToY(p.price)));

        const padding = 10;
        if (mouseX >= minX - padding && mouseX <= maxX + padding &&
          mouseY >= minY - padding && mouseY <= maxY + padding) {
          found = study;
          break;
        }
      } else if (study.type === 'fibonacci-retracement' || study.type === 'fibonacci-extension') {
        const fib = study;
        const allPoints = [fib.startPoint, fib.endPoint];
        const indices = allPoints.map(p => candles.findIndex(c => c.timestamp >= p.timestamp));

        if (indices.some(i => i === -1)) continue;

        const minX = Math.min(...indices.map(i => canvasManager.indexToCenterX(i)));
        const maxX = Math.max(...indices.map(i => canvasManager.indexToCenterX(i)));
        const minY = Math.min(...allPoints.map(p => canvasManager.priceToY(p.price)));
        const maxY = Math.max(...allPoints.map(p => canvasManager.priceToY(p.price)));

        const padding = 10;
        if (mouseX >= minX - padding && mouseX <= maxX + padding &&
          mouseY >= minY - padding && mouseY <= maxY + padding) {
          found = study;
          break;
        }
      } else if (study.type === 'triple-top' || study.type === 'triple-bottom') {
        const pattern = study;
        const points = [pattern.peak1, pattern.peak2, pattern.peak3, ...pattern.neckline];
        const indices = points.map(p => candles.findIndex(c => c.timestamp >= p.timestamp));

        if (indices.some(i => i === -1)) continue;

        const minX = Math.min(...indices.map(i => canvasManager.indexToCenterX(i)));
        const maxX = Math.max(...indices.map(i => canvasManager.indexToCenterX(i)));
        const minY = Math.min(...points.map(p => canvasManager.priceToY(p.price)));
        const maxY = Math.max(...points.map(p => canvasManager.priceToY(p.price)));

        const padding = 10;
        if (mouseX >= minX - padding && mouseX <= maxX + padding &&
          mouseY >= minY - padding && mouseY <= maxY + padding) {
          found = study;
          break;
        }
      } else if (study.type === 'flag-bullish' || study.type === 'flag-bearish') {
        const flag = study;
        const allPoints = [
          flag.flagpole.start,
          flag.flagpole.end,
          ...flag.flag.upperTrendline,
          ...flag.flag.lowerTrendline
        ];
        const indices = allPoints.map(p => candles.findIndex(c => c.timestamp >= p.timestamp));

        if (indices.some(i => i === -1)) continue;

        const minX = Math.min(...indices.map(i => canvasManager.indexToCenterX(i)));
        const maxX = Math.max(...indices.map(i => canvasManager.indexToCenterX(i)));
        const minY = Math.min(...allPoints.map(p => canvasManager.priceToY(p.price)));
        const maxY = Math.max(...allPoints.map(p => canvasManager.priceToY(p.price)));

        const padding = 10;
        if (mouseX >= minX - padding && mouseX <= maxX + padding &&
          mouseY >= minY - padding && mouseY <= maxY + padding) {
          found = study;
          break;
        }
      } else if (study.type === 'pennant') {
        const pennant = study;
        const allPoints = [
          pennant.flagpole.start,
          pennant.flagpole.end,
          ...pennant.pennant.upperTrendline,
          ...pennant.pennant.lowerTrendline
        ];
        if (pennant.pennant.apex) allPoints.push(pennant.pennant.apex);
        const indices = allPoints.map(p => candles.findIndex(c => c.timestamp >= p.timestamp));

        if (indices.some(i => i === -1)) continue;

        const minX = Math.min(...indices.map(i => canvasManager.indexToCenterX(i)));
        const maxX = Math.max(...indices.map(i => canvasManager.indexToCenterX(i)));
        const minY = Math.min(...allPoints.map(p => canvasManager.priceToY(p.price)));
        const maxY = Math.max(...allPoints.map(p => canvasManager.priceToY(p.price)));

        const padding = 10;
        if (mouseX >= minX - padding && mouseX <= maxX + padding &&
          mouseY >= minY - padding && mouseY <= maxY + padding) {
          found = study;
          break;
        }
      } else if (study.type === 'cup-and-handle') {
        const cup = study;
        const allPoints = [
          cup.cupStart,
          cup.cupBottom,
          cup.cupEnd,
          cup.handleStart,
          cup.handleLow,
          cup.handleEnd
        ];
        const indices = allPoints.map(p => candles.findIndex(c => c.timestamp >= p.timestamp));

        if (indices.some(i => i === -1)) continue;

        const minX = Math.min(...indices.map(i => canvasManager.indexToCenterX(i)));
        const maxX = Math.max(...indices.map(i => canvasManager.indexToCenterX(i)));
        const minY = Math.min(...allPoints.map(p => canvasManager.priceToY(p.price)));
        const maxY = Math.max(...allPoints.map(p => canvasManager.priceToY(p.price)));

        const padding = 10;
        if (mouseX >= minX - padding && mouseX <= maxX + padding &&
          mouseY >= minY - padding && mouseY <= maxY + padding) {
          found = study;
          break;
        }
      } else if (study.type === 'rounding-bottom') {
        const rounding = study;
        const allPoints = [rounding.start, rounding.bottom, rounding.end];
        const indices = allPoints.map(p => candles.findIndex(c => c.timestamp >= p.timestamp));

        if (indices.some(i => i === -1)) continue;

        const minX = Math.min(...indices.map(i => canvasManager.indexToCenterX(i)));
        const maxX = Math.max(...indices.map(i => canvasManager.indexToCenterX(i)));
        const minY = Math.min(...allPoints.map(p => canvasManager.priceToY(p.price)));
        const maxY = Math.max(...allPoints.map(p => canvasManager.priceToY(p.price)));

        const padding = 10;
        if (mouseX >= minX - padding && mouseX <= maxX + padding &&
          mouseY >= minY - padding && mouseY <= maxY + padding) {
          found = study;
          break;
        }
      } else if (study.type === 'gap-common' || study.type === 'gap-breakaway' || study.type === 'gap-runaway' || study.type === 'gap-exhaustion') {
        const gap = study;
        const allPoints = [gap.gapStart, gap.gapEnd];
        const indices = allPoints.map(p => candles.findIndex(c => c.timestamp >= p.timestamp));

        if (indices.some(i => i === -1)) continue;

        const minX = Math.min(...indices.map(i => canvasManager.indexToCenterX(i)));
        const maxX = Math.max(...indices.map(i => canvasManager.indexToCenterX(i)));
        const minY = Math.min(...allPoints.map(p => canvasManager.priceToY(p.price)));
        const maxY = Math.max(...allPoints.map(p => canvasManager.priceToY(p.price)));

        const padding = 10;
        if (mouseX >= minX - padding && mouseX <= maxX + padding &&
          mouseY >= minY - padding && mouseY <= maxY + padding) {
          found = study;
          break;
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

    const clipWidth = dimensions.chartWidth;
    const clipHeight = dimensions.chartHeight;

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, clipWidth, clipHeight);
    ctx.clip();

    studyTagsRef.current.clear(); studies.forEach((study, index) => {
      if (study.visible === false) return;

      const isHovered = hoveredStudy === study;
      const studyNumber = study.id ?? index + 1;

      switch (study.type) {
        case 'support':
        case 'resistance':
        case 'trendline-bullish':
        case 'trendline-bearish':
          if ('points' in study) {
            drawLine(ctx, study, canvasManager, candles, isHovered, studyNumber);
          }
          break;

        case 'channel-ascending':
        case 'channel-descending':
        case 'channel-horizontal':
          if ('upperLine' in study) {
            drawChannel(ctx, study, canvasManager, candles, isHovered, studyNumber);
          }
          break;

        case 'fibonacci-retracement':
        case 'fibonacci-extension':
          if ('startPoint' in study) {
            drawFibonacci(ctx, study, canvasManager, candles, isHovered, studyNumber);
          }
          break;

        case 'head-and-shoulders':
        case 'inverse-head-and-shoulders':
          if ('leftShoulder' in study) {
            drawHeadAndShoulders(ctx, study, canvasManager, candles, isHovered, studyNumber);
          }
          break;

        case 'double-top':
        case 'double-bottom':
          if ('firstPeak' in study) {
            drawDoublePattern(ctx, study, canvasManager, candles, isHovered, studyNumber);
          }
          break;

        case 'triple-top':
        case 'triple-bottom':
          if ('peak1' in study) {
            drawTriplePattern(ctx, study, canvasManager, candles, isHovered, studyNumber);
          }
          break;

        case 'triangle-ascending':
        case 'triangle-descending':
        case 'triangle-symmetrical':
          if ('upperTrendline' in study) {
            drawTriangle(ctx, study, canvasManager, candles, isHovered, studyNumber);
          }
          break;

        case 'wedge-rising':
        case 'wedge-falling':
          if ('upperTrendline' in study) {
            drawWedge(ctx, study, canvasManager, candles, isHovered, studyNumber);
          }
          break;

        case 'flag-bullish':
        case 'flag-bearish':
          if ('flagpole' in study) {
            drawFlag(ctx, study, canvasManager, candles, isHovered, studyNumber);
          }
          break;

        case 'pennant':
          if ('flagpole' in study) {
            drawPennant(ctx, study, canvasManager, candles, isHovered, studyNumber);
          }
          break;

        case 'cup-and-handle':
          if ('cupBottom' in study) {
            drawCupAndHandle(ctx, study, canvasManager, candles, isHovered, studyNumber);
          }
          break;

        case 'rounding-bottom':
          if ('bottom' in study) {
            drawRoundingBottom(ctx, study, canvasManager, candles, isHovered, studyNumber);
          }
          break;

        case 'gap-common':
        case 'gap-breakaway':
        case 'gap-runaway':
        case 'gap-exhaustion':
          if ('gapStart' in study) {
            drawGap(ctx, study, canvasManager, candles, isHovered, studyNumber);
          }
          break;

        case 'liquidity-zone':
        case 'sell-zone':
        case 'buy-zone':
        case 'accumulation-zone':
          if ('topPrice' in study) {
            drawZone(ctx, study, canvasManager, candles, isHovered, studyNumber);
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

    const x1 = manager.indexToCenterX(index1);
    const x2 = manager.indexToCenterX(index2);
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

    const iconX = Math.min(x1, x2);
    const iconY = Math.min(y1, y2) - 22;
    drawAndStoreStudyTag(ctx, iconX, iconY, studyNumber, study);

    ctx.restore();
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

    const upperPoint1 = study.upperLine[0];
    const upperPoint2 = study.upperLine[1];
    const lowerPoint1 = study.lowerLine[0];
    const lowerPoint2 = study.lowerLine[1];

    const upperIndex1 = candles.findIndex(c => c.timestamp >= upperPoint1.timestamp);
    const upperIndex2 = candles.findIndex(c => c.timestamp >= upperPoint2.timestamp);
    const lowerIndex1 = candles.findIndex(c => c.timestamp >= lowerPoint1.timestamp);
    const lowerIndex2 = candles.findIndex(c => c.timestamp >= lowerPoint2.timestamp);

    if (upperIndex1 === -1 || upperIndex2 === -1 || lowerIndex1 === -1 || lowerIndex2 === -1) return;

    const upperX1 = manager.indexToCenterX(upperIndex1);
    const upperX2 = manager.indexToCenterX(upperIndex2);
    const upperY1 = manager.priceToY(upperPoint1.price);
    const upperY2 = manager.priceToY(upperPoint2.price);

    const lowerX1 = manager.indexToCenterX(lowerIndex1);
    const lowerX2 = manager.indexToCenterX(lowerIndex2);
    const lowerY1 = manager.priceToY(lowerPoint1.price);
    const lowerY2 = manager.priceToY(lowerPoint2.price);

    ctx.save();

    ctx.fillStyle = `${color  }0D`;
    ctx.beginPath();
    ctx.moveTo(upperX1, upperY1);
    ctx.lineTo(upperX2, upperY2);
    ctx.lineTo(lowerX2, lowerY2);
    ctx.lineTo(lowerX1, lowerY1);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.setLineDash(getLineStyle(study.type));

    if (isHovered) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;
    }

    ctx.beginPath();
    ctx.moveTo(upperX1, upperY1);
    ctx.lineTo(upperX2, upperY2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(lowerX1, lowerY1);
    ctx.lineTo(lowerX2, lowerY2);
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.restore();

    const x = Math.min(upperX1, lowerX1);
    const y = Math.min(upperY1, lowerY1);
    drawStudyTag(ctx, x, y - 22, studyNumber, study.type);
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
    const x1 = manager.indexToCenterX(startIndex);
    const x2 = manager.indexToCenterX(endIndex);
    const y1 = manager.priceToY(study.startPoint.price);
    const y2 = manager.priceToY(study.endPoint.price);

    ctx.save();

    ctx.strokeStyle = `${color  }40`;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.setLineDash([]);

    const keyLevels = study.type === 'fibonacci-retracement'
      ? [0.382, 0.5, 0.618]
      : [1.272, 1.618];

    study.levels.forEach((level, index) => {
      const y = manager.priceToY(level.price);

      if (keyLevels.includes(level.ratio) && index < study.levels.length - 1) {
        const nextLevel = study.levels[index + 1];
        if (nextLevel) {
          const nextY = manager.priceToY(nextLevel.price);

          ctx.fillStyle = `${color  }0D`;
          ctx.fillRect(x1, y, x2 - x1, nextY - y);
        }
      }
    });

    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.setLineDash([2, 3]);

    if (isHovered) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;
    }

    study.levels.forEach((level) => {
      const y = manager.priceToY(level.price);
      const isKeyLevel = keyLevels.includes(level.ratio);
      const is0or100 = level.ratio === 0 || level.ratio === 1;

      if (isKeyLevel || is0or100) {
        ctx.lineWidth = lineWidth + 0.5;
      } else {
        ctx.lineWidth = lineWidth;
      }

      ctx.beginPath();
      ctx.moveTo(x1, y);
      ctx.lineTo(x2, y);
      ctx.stroke();

      ctx.save();
      ctx.setLineDash([]);
      ctx.fillStyle = color;
      ctx.font = (isKeyLevel || is0or100) ? 'bold 10px system-ui' : '10px system-ui';
      const text = `${(level.ratio * 100).toFixed(1)}%`;

      ctx.fillStyle = color;
      ctx.fillText(text, x2 + 5, y - 2);
      ctx.restore();
    });

    const pointRadius = 3;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x1, y1, pointRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x2, y2, pointRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.setLineDash([]);
    ctx.restore();

    const x = manager.indexToCenterX(startIndex);
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

    if (isHovered) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;
    }

    ctx.beginPath();
    indices.forEach((index, i) => {
      if (index === -1) return;
      const x = manager.indexToCenterX(index);
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
        ctx.moveTo(manager.indexToCenterX(neckIndex1), manager.priceToY(neck1.price));
        ctx.lineTo(manager.indexToCenterX(neckIndex2), manager.priceToY(neck2.price));
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }

    ctx.restore();

    if (indices[0] !== undefined && indices[0] !== -1) {
      const x = manager.indexToCenterX(indices[0]);
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
      const x = manager.indexToCenterX(index);
      const y = manager.priceToY(points[i]!.price);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();

    if (study.neckline) {
      ctx.setLineDash([5, 5]);
      const neckY = manager.priceToY(study.neckline.price);
      if (indices[0] !== -1 && indices[1] !== -1 && indices[0] !== undefined && indices[1] !== undefined) {
        ctx.beginPath();
        ctx.moveTo(manager.indexToCenterX(indices[0]), neckY);
        ctx.lineTo(manager.indexToCenterX(indices[1]), neckY);
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }

    ctx.restore();

    if (indices[0] !== undefined && indices[0] !== -1) {
      const x = manager.indexToCenterX(indices[0]);
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
      const x = manager.indexToCenterX(index);
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
        ctx.moveTo(manager.indexToCenterX(neckIndex1), manager.priceToY(neck1.price));
        ctx.lineTo(manager.indexToCenterX(neckIndex2), manager.priceToY(neck2.price));
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }

    ctx.restore();

    if (indices[0] !== undefined && indices[0] !== -1) {
      const x = manager.indexToCenterX(indices[0]);
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

    const upperPoint1 = study.upperTrendline[0];
    const upperPoint2 = study.upperTrendline[1];
    const lowerPoint1 = study.lowerTrendline[0];
    const lowerPoint2 = study.lowerTrendline[1];

    const upperIndex1 = candles.findIndex(c => c.timestamp >= upperPoint1.timestamp);
    const upperIndex2 = candles.findIndex(c => c.timestamp >= upperPoint2.timestamp);
    const lowerIndex1 = candles.findIndex(c => c.timestamp >= lowerPoint1.timestamp);
    const lowerIndex2 = candles.findIndex(c => c.timestamp >= lowerPoint2.timestamp);

    if (upperIndex1 === -1 || upperIndex2 === -1 || lowerIndex1 === -1 || lowerIndex2 === -1) return;

    const upperX1 = manager.indexToCenterX(upperIndex1);
    const upperX2 = manager.indexToCenterX(upperIndex2);
    const upperY1 = manager.priceToY(upperPoint1.price);
    const upperY2 = manager.priceToY(upperPoint2.price);

    const lowerX1 = manager.indexToCenterX(lowerIndex1);
    const lowerX2 = manager.indexToCenterX(lowerIndex2);
    const lowerY1 = manager.priceToY(lowerPoint1.price);
    const lowerY2 = manager.priceToY(lowerPoint2.price);

    ctx.save();

    ctx.fillStyle = `${color  }0D`;
    ctx.beginPath();
    ctx.moveTo(upperX1, upperY1);
    ctx.lineTo(upperX2, upperY2);
    if (study.apex) {
      const apexIndex = candles.findIndex(c => c.timestamp >= study.apex!.timestamp);
      if (apexIndex !== -1) {
        const apexX = manager.indexToCenterX(apexIndex);
        const apexY = manager.priceToY(study.apex.price);
        ctx.lineTo(apexX, apexY);
      }
    }
    ctx.lineTo(lowerX2, lowerY2);
    ctx.lineTo(lowerX1, lowerY1);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.setLineDash(getLineStyle(study.type));

    if (isHovered) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;
    }

    ctx.beginPath();
    ctx.moveTo(upperX1, upperY1);
    ctx.lineTo(upperX2, upperY2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(lowerX1, lowerY1);
    ctx.lineTo(lowerX2, lowerY2);
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.restore();

    const firstPoint = study.upperTrendline[0];
    const index = candles.findIndex(c => c.timestamp >= firstPoint.timestamp);
    if (index !== -1) {
      const x = manager.indexToCenterX(index);
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

    const upperPoint1 = study.upperTrendline[0];
    const upperPoint2 = study.upperTrendline[1];
    const lowerPoint1 = study.lowerTrendline[0];
    const lowerPoint2 = study.lowerTrendline[1];

    const upperIndex1 = candles.findIndex(c => c.timestamp >= upperPoint1.timestamp);
    const upperIndex2 = candles.findIndex(c => c.timestamp >= upperPoint2.timestamp);
    const lowerIndex1 = candles.findIndex(c => c.timestamp >= lowerPoint1.timestamp);
    const lowerIndex2 = candles.findIndex(c => c.timestamp >= lowerPoint2.timestamp);

    if (upperIndex1 === -1 || upperIndex2 === -1 || lowerIndex1 === -1 || lowerIndex2 === -1) return;

    const upperX1 = manager.indexToCenterX(upperIndex1);
    const upperX2 = manager.indexToCenterX(upperIndex2);
    const upperY1 = manager.priceToY(upperPoint1.price);
    const upperY2 = manager.priceToY(upperPoint2.price);

    const lowerX1 = manager.indexToCenterX(lowerIndex1);
    const lowerX2 = manager.indexToCenterX(lowerIndex2);
    const lowerY1 = manager.priceToY(lowerPoint1.price);
    const lowerY2 = manager.priceToY(lowerPoint2.price);

    ctx.save();

    ctx.fillStyle = `${color  }0D`;
    ctx.beginPath();
    ctx.moveTo(upperX1, upperY1);
    ctx.lineTo(upperX2, upperY2);
    if (study.convergencePoint) {
      const convIndex = candles.findIndex(c => c.timestamp >= study.convergencePoint!.timestamp);
      if (convIndex !== -1) {
        const convX = manager.indexToCenterX(convIndex);
        const convY = manager.priceToY(study.convergencePoint.price);
        ctx.lineTo(convX, convY);
      }
    }
    ctx.lineTo(lowerX2, lowerY2);
    ctx.lineTo(lowerX1, lowerY1);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.setLineDash(getLineStyle(study.type));

    if (isHovered) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;
    }

    ctx.beginPath();
    ctx.moveTo(upperX1, upperY1);
    ctx.lineTo(upperX2, upperY2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(lowerX1, lowerY1);
    ctx.lineTo(lowerX2, lowerY2);
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.restore();

    const firstPoint = study.upperTrendline[0];
    const index = candles.findIndex(c => c.timestamp >= firstPoint.timestamp);
    if (index !== -1) {
      const x = manager.indexToCenterX(index);
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
      ctx.moveTo(manager.indexToCenterX(poleStartIndex), manager.priceToY(study.flagpole.start.price));
      ctx.lineTo(manager.indexToCenterX(poleEndIndex), manager.priceToY(study.flagpole.end.price));
      ctx.stroke();
    }

    ctx.setLineDash([5, 5]);
    [study.flag.upperTrendline, study.flag.lowerTrendline].forEach((line) => {
      const [point1, point2] = line;
      const index1 = candles.findIndex(c => c.timestamp >= point1.timestamp);
      const index2 = candles.findIndex(c => c.timestamp >= point2.timestamp);

      if (index1 === -1 || index2 === -1) return;

      ctx.beginPath();
      ctx.moveTo(manager.indexToCenterX(index1), manager.priceToY(point1.price));
      ctx.lineTo(manager.indexToCenterX(index2), manager.priceToY(point2.price));
      ctx.stroke();
    });

    ctx.setLineDash([]);
    ctx.restore();

    if (poleStartIndex !== -1) {
      const x = manager.indexToCenterX(poleStartIndex);
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
      ctx.moveTo(manager.indexToCenterX(poleStartIndex), manager.priceToY(study.flagpole.start.price));
      ctx.lineTo(manager.indexToCenterX(poleEndIndex), manager.priceToY(study.flagpole.end.price));
      ctx.stroke();
    }

    ctx.setLineDash([5, 5]);
    [study.pennant.upperTrendline, study.pennant.lowerTrendline].forEach((line) => {
      const [point1, point2] = line;
      const index1 = candles.findIndex(c => c.timestamp >= point1.timestamp);
      const index2 = candles.findIndex(c => c.timestamp >= point2.timestamp);

      if (index1 === -1 || index2 === -1) return;

      ctx.beginPath();
      ctx.moveTo(manager.indexToCenterX(index1), manager.priceToY(point1.price));
      ctx.lineTo(manager.indexToCenterX(index2), manager.priceToY(point2.price));
      ctx.stroke();
    });

    ctx.setLineDash([]);
    ctx.restore();

    if (poleStartIndex !== -1) {
      const x = manager.indexToCenterX(poleStartIndex);
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
    ctx.moveTo(manager.indexToCenterX(cupStartIndex), manager.priceToY(study.cupStart.price));
    ctx.quadraticCurveTo(
      manager.indexToCenterX(cupBottomIndex),
      manager.priceToY(study.cupBottom.price),
      manager.indexToCenterX(cupEndIndex),
      manager.priceToY(study.cupEnd.price)
    );
    ctx.stroke();

    const handleStartIndex = candles.findIndex(c => c.timestamp >= study.handleStart.timestamp);
    const handleLowIndex = candles.findIndex(c => c.timestamp >= study.handleLow.timestamp);
    const handleEndIndex = candles.findIndex(c => c.timestamp >= study.handleEnd.timestamp);

    if (handleStartIndex !== -1 && handleLowIndex !== -1 && handleEndIndex !== -1) {
      ctx.beginPath();
      ctx.moveTo(manager.indexToCenterX(handleStartIndex), manager.priceToY(study.handleStart.price));
      ctx.lineTo(manager.indexToCenterX(handleLowIndex), manager.priceToY(study.handleLow.price));
      ctx.lineTo(manager.indexToCenterX(handleEndIndex), manager.priceToY(study.handleEnd.price));
      ctx.stroke();
    }

    ctx.restore();

    const x = manager.indexToCenterX(cupStartIndex);
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
    ctx.moveTo(manager.indexToCenterX(startIndex), manager.priceToY(study.start.price));
    ctx.quadraticCurveTo(
      manager.indexToCenterX(bottomIndex),
      manager.priceToY(study.bottom.price),
      manager.indexToCenterX(endIndex),
      manager.priceToY(study.end.price)
    );
    ctx.stroke();

    ctx.restore();

    const x = manager.indexToCenterX(startIndex);
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

    const x1 = manager.indexToCenterX(startIndex);
    const x2 = manager.indexToCenterX(endIndex);
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

    const x1 = manager.indexToCenterX(startIndex);
    let x2 = manager.indexToCenterX(endIndex);
    const y1 = manager.priceToY(study.topPrice);
    const y2 = manager.priceToY(study.bottomPrice);

    if (study.type === 'buy-zone' || study.type === 'sell-zone' || study.type === 'liquidity-zone' || study.type === 'accumulation-zone') {
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

    drawAndStoreStudyTag(ctx, x1 + 4, y1 + 4, studyNumber, study);

    ctx.restore();
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
    _studyType: AIStudy['type']
  ): { x: number; y: number; width: number; height: number } => {
    // const studyColor = STUDY_COLORS[studyType] || '#8b5cf6';
    // const rgb = hexToRgb(studyColor);
    // const bgColor = rgb ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.15)` : 'rgba(139, 92, 246, 0.15)';

    const text = `#${studyNumber}`;
    const fontSize = 9;
    const paddingX = 4;
    const paddingY = 2;

    // ctx.save();
    // ctx.font = `bold ${fontSize}px system-ui`;
    const textWidth = ctx.measureText(text).width;
    const boxWidth = textWidth + paddingX * 2;
    const boxHeight = fontSize + paddingY * 2 + 2;

    // ctx.fillStyle = bgColor;
    // ctx.beginPath();
    // ctx.roundRect(x, y, boxWidth, boxHeight, 3);
    // ctx.fill();

    // ctx.strokeStyle = studyColor;
    // ctx.lineWidth = 1.5;
    // ctx.stroke();

    // ctx.fillStyle = studyColor;
    // ctx.textAlign = 'left';
    // ctx.textBaseline = 'top';
    // ctx.fillText(text, x + paddingX, y + paddingY + 1);

    // ctx.restore();

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
