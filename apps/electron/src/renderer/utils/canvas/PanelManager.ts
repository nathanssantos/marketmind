import { PANEL_RENDER_ORDER, type PanelId } from '@shared/constants';

export interface PanelConfig {
  id: string;
  height: number;
  order: number;
}

export class PanelManager {
  private panels: Map<string, PanelConfig> = new Map();
  private cachedTotalPanelHeight: number = 0;
  private eventRowHeight: number = 0;

  setPanelHeight(panelId: string, height: number): boolean {
    const existingPanel = this.panels.get(panelId);
    const order = PANEL_RENDER_ORDER.indexOf(panelId as PanelId);
    const panelOrder = order >= 0 ? order : this.panels.size;
    const oldHeight = existingPanel?.height ?? 0;

    if (height === 0) {
      if (existingPanel) {
        this.cachedTotalPanelHeight -= oldHeight;
        this.panels.delete(panelId);
        return true;
      }
      return false;
    }

    if (existingPanel?.height !== height) {
      this.cachedTotalPanelHeight += height - oldHeight;
      this.panels.set(panelId, { id: panelId, height, order: panelOrder });
      return true;
    }

    return false;
  }

  getPanelHeight(panelId: string): number {
    return this.panels.get(panelId)?.height ?? 0;
  }

  getTotalPanelHeight(): number {
    return this.cachedTotalPanelHeight;
  }

  getPanelTop(panelId: string, chartHeight: number): number {
    const sortedPanels = this.getActivePanels();
    let top = chartHeight;

    for (const panel of sortedPanels) {
      if (panel.id === panelId) return top;
      top += panel.height;
    }
    return top;
  }

  getActivePanels(): PanelConfig[] {
    return Array.from(this.panels.values()).sort((a, b) => a.order - b.order);
  }

  getPanelInfo(panelId: string, chartHeight: number): { y: number; height: number } | null {
    const height = this.getPanelHeight(panelId);
    if (height === 0) return null;
    const panelTop = this.getPanelTop(panelId, chartHeight);
    return { y: panelTop, height };
  }

  setEventRowHeight(height: number): boolean {
    if (this.eventRowHeight === height) return false;
    this.eventRowHeight = height;
    return true;
  }

  getEventRowHeight(): number {
    return this.eventRowHeight;
  }

  getEventRowY(chartHeight: number): number {
    return chartHeight + this.cachedTotalPanelHeight;
  }
}
