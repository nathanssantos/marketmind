import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import type { AIStudy, AIStudyLine, AIStudyZone, Candle } from '@shared/types';
import { AI_STUDY_COLORS } from '@shared/types';
import { useEffect, useRef, useState } from 'react';

interface AIStudyRendererProps {
  canvasManager: CanvasManager | null;
  candles: Candle[];
  studies: AIStudy[];
  width: number;
  height: number;
  mousePosition: { x: number; y: number } | null;
  onStudyHover: (study: AIStudy | null) => void;
}

const AI_ICON_SIZE = 16;
const AI_ICON_PADDING = 4;

export const AIStudyRenderer = ({
  canvasManager,
  candles,
  studies,
  width,
  height,
  mousePosition,
  onStudyHover,
}: AIStudyRendererProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoveredStudy, setHoveredStudy] = useState<AIStudy | null>(null);

  useEffect(() => {
    if (!canvasManager || candles.length === 0 || !mousePosition) {
      setHoveredStudy(null);
      onStudyHover(null);
      return;
    }

    const { x: mouseX, y: mouseY } = mousePosition;
    let found: AIStudy | null = null;

    for (const study of studies) {
      if (study.visible === false) continue;
      
      if ('topPrice' in study) {
        const startIndex = candles.findIndex(c => c.timestamp >= study.startTimestamp);
        const endIndex = candles.findIndex(c => c.timestamp >= study.endTimestamp);
        
        if (startIndex === -1 || endIndex === -1) continue;

        const x1 = canvasManager.indexToX(startIndex);
        const x2 = canvasManager.indexToX(endIndex);
        const y1 = canvasManager.priceToY(study.topPrice);
        const y2 = canvasManager.priceToY(study.bottomPrice);

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
        
        const lineThreshold = 5;
        const minX = Math.min(x1, x2);
        const maxX = Math.max(x1, x2);
        
        if (mouseX >= minX && mouseX <= maxX) {
          const t = (mouseX - x1) / (x2 - x1);
          const lineY = y1 + t * (y2 - y1);
          
          if (Math.abs(mouseY - lineY) <= lineThreshold) {
            found = study;
            break;
          }
        }
      }
    }

    setHoveredStudy(found);
    onStudyHover(found);
  }, [canvasManager, candles, studies, mousePosition, onStudyHover]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !canvasManager || candles.length === 0 || studies.length === 0) {
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);

    studies.forEach((study) => {
      if (study.visible === false) return;
      
      const isHovered = hoveredStudy === study;
      
      if ('points' in study) {
        drawLine(ctx, study as AIStudyLine, canvasManager, candles, isHovered);
      } else {
        drawZone(ctx, study as AIStudyZone, canvasManager, candles, isHovered);
      }
    });
  }, [canvasManager, candles, studies, width, height, hoveredStudy]);

  const drawLine = (
    ctx: CanvasRenderingContext2D,
    study: AIStudyLine,
    manager: CanvasManager,
    candles: Candle[],
    isHovered: boolean
  ) => {
    const [point1, point2] = study.points;
    
    const index1 = candles.findIndex(c => c.timestamp >= point1.timestamp);
    const index2 = candles.findIndex(c => c.timestamp >= point2.timestamp);
    
    if (index1 === -1 || index2 === -1) return;

    const x1 = manager.indexToX(index1);
    const x2 = manager.indexToX(index2);
    const y1 = manager.priceToY(point1.price);
    const y2 = manager.priceToY(point2.price);

    ctx.save();
    ctx.strokeStyle = AI_STUDY_COLORS[study.type];
    ctx.lineWidth = isHovered ? 3 : 2;
    ctx.setLineDash([5, 5]);

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.restore();

    const iconX = Math.min(x1, x2);
    const iconY = Math.min(y1, y2) - AI_ICON_SIZE - AI_ICON_PADDING;
    drawAIIcon(ctx, iconX, iconY);
  };

  const drawZone = (
    ctx: CanvasRenderingContext2D,
    study: AIStudyZone,
    manager: CanvasManager,
    candles: Candle[],
    isHovered: boolean
  ) => {
    const startIndex = candles.findIndex(c => c.timestamp >= study.startTimestamp);
    const endIndex = candles.findIndex(c => c.timestamp >= study.endTimestamp);
    
    if (startIndex === -1 || endIndex === -1) return;

    const x1 = manager.indexToX(startIndex);
    const x2 = manager.indexToX(endIndex);
    const y1 = manager.priceToY(study.topPrice);
    const y2 = manager.priceToY(study.bottomPrice);

    const opacity = isHovered ? '0.3' : '0.2';
    
    ctx.save();
    ctx.fillStyle = AI_STUDY_COLORS[study.type].replace('0.2', opacity);
    ctx.fillRect(x1, y1, x2 - x1, y2 - y1);

    ctx.strokeStyle = AI_STUDY_COLORS[study.type].replace('0.2', '1');
    ctx.lineWidth = isHovered ? 2 : 1;
    ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
    ctx.restore();

    drawAIIcon(ctx, x1 + AI_ICON_PADDING, y1 + AI_ICON_PADDING);
  };

  const drawAIIcon = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
    ctx.save();
    
    ctx.fillStyle = 'rgba(138, 43, 226, 0.9)';
    ctx.beginPath();
    ctx.arc(x + AI_ICON_SIZE / 2, y + AI_ICON_SIZE / 2, AI_ICON_SIZE / 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'white';
    ctx.font = 'bold 10px system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('AI', x + AI_ICON_SIZE / 2, y + AI_ICON_SIZE / 2);
    
    ctx.restore();
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
        zIndex: 2,
      }}
    />
  );
};
