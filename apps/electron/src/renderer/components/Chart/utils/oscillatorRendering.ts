interface OscillatorPanelConfig {
  ctx: CanvasRenderingContext2D;
  panelY: number;
  panelHeight: number;
  chartWidth: number;
}

interface ZoneLevelConfig {
  y: number;
}

export const drawPanelBackground = ({
  ctx,
  panelY,
  panelHeight,
  chartWidth,
}: OscillatorPanelConfig): void => {
  ctx.fillStyle = 'rgba(128, 128, 128, 0.02)';
  ctx.fillRect(0, panelY, chartWidth, panelHeight);
};

export const drawZoneFill = ({
  ctx,
  chartWidth,
  topY,
  bottomY,
}: OscillatorPanelConfig & { topY: number; bottomY: number }): void => {
  ctx.fillStyle = 'rgba(128, 128, 128, 0.08)';
  ctx.fillRect(0, topY, chartWidth, bottomY - topY);
};

export const drawZoneLines = ({
  ctx,
  chartWidth,
  levels,
}: Pick<OscillatorPanelConfig, 'ctx' | 'chartWidth'> & { levels: ZoneLevelConfig[] }): void => {
  ctx.strokeStyle = 'rgba(128, 128, 128, 0.3)';
  ctx.lineWidth = 1;
  ctx.setLineDash([2, 2]);

  for (const level of levels) {
    ctx.beginPath();
    ctx.moveTo(0, level.y);
    ctx.lineTo(chartWidth, level.y);
    ctx.stroke();
  }

  ctx.setLineDash([]);
};
