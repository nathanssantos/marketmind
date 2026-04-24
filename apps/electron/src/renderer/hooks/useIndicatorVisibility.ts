import { useIndicatorStore } from '@renderer/store/indicatorStore';
import { useShallow } from 'zustand/react/shallow';

export interface IndicatorVisibility {
  showVolume: boolean;
  showOrb: boolean;
  heatmapEnabled: boolean;
  needsScalpingMetrics: boolean;
  needsVolumeProfile: boolean;
}

export const useIndicatorVisibility = (): IndicatorVisibility =>
  useIndicatorStore(
    useShallow((s) => {
      let showVolume = false;
      let showOrb = false;
      let heatmapEnabled = false;
      let needsScalpingMetrics = false;
      let needsVolumeProfile = false;
      for (const i of s.instances) {
        if (!i.visible) continue;
        switch (i.catalogType) {
          case 'volume':
            showVolume = true;
            break;
          case 'orb':
            showOrb = true;
            break;
          case 'liquidityHeatmap':
          case 'liquidationMarkers':
            heatmapEnabled = true;
            break;
          case 'cvd':
          case 'bookImbalance':
            needsScalpingMetrics = true;
            break;
          case 'volumeProfile':
            needsVolumeProfile = true;
            break;
        }
      }
      return { showVolume, showOrb, heatmapEnabled, needsScalpingMetrics, needsVolumeProfile };
    }),
  );
