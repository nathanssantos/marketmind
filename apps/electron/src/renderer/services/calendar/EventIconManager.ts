import type { EventIcon } from '@marketmind/types';
import { CHART_CONFIG } from '@shared/constants';

const FLAG_CDN_URL = 'https://flagcdn.com';
const FLAG_SIZES = {
  small: { width: 16, height: 12 },
  medium: { width: 24, height: 18 },
  large: { width: 32, height: 24 },
} as const;

type FlagSize = keyof typeof FLAG_SIZES;

interface CachedImage {
  image: HTMLImageElement;
  loaded: boolean;
  error: boolean;
}

export class EventIconManager {
  private imageCache: Map<string, CachedImage> = new Map();
  private loadingPromises: Map<string, Promise<HTMLImageElement | null>> = new Map();
  private defaultSize: FlagSize = 'medium';

  setDefaultSize(size: FlagSize): void {
    this.defaultSize = size;
  }

  private getFlagUrl(countryCode: string, size: FlagSize = this.defaultSize): string {
    const { width, height } = FLAG_SIZES[size];
    return `${FLAG_CDN_URL}/${width}x${height}/${countryCode.toLowerCase()}.png`;
  }

  private getCacheKey(icon: EventIcon, size?: FlagSize): string {
    return `${icon.type}:${icon.value}:${size ?? this.defaultSize}`;
  }

  async preloadIcon(icon: EventIcon, size?: FlagSize): Promise<HTMLImageElement | null> {
    const cacheKey = this.getCacheKey(icon, size);

    const cached = this.imageCache.get(cacheKey);
    if (cached?.loaded) return cached.image;
    if (cached?.error) return null;

    const existingPromise = this.loadingPromises.get(cacheKey);
    if (existingPromise) return existingPromise;

    const loadPromise = this.loadImage(icon, size ?? this.defaultSize, cacheKey);
    this.loadingPromises.set(cacheKey, loadPromise);

    const result = await loadPromise;
    this.loadingPromises.delete(cacheKey);
    return result;
  }

  private async loadImage(
    icon: EventIcon,
    size: FlagSize,
    cacheKey: string,
  ): Promise<HTMLImageElement | null> {
    return new Promise((resolve) => {
      const img = new Image();

      img.onload = () => {
        this.imageCache.set(cacheKey, { image: img, loaded: true, error: false });
        resolve(img);
      };

      img.onerror = () => {
        this.imageCache.set(cacheKey, { image: img, loaded: false, error: true });
        resolve(null);
      };

      if (icon.type === 'flag') {
        img.crossOrigin = 'anonymous';
        img.src = this.getFlagUrl(icon.value, size);
      } else if (icon.type === 'image') {
        img.crossOrigin = 'anonymous';
        img.src = icon.value;
      } else {
        this.imageCache.set(cacheKey, { image: img, loaded: false, error: true });
        resolve(null);
      }
    });
  }

  getIcon(icon: EventIcon, size?: FlagSize): HTMLImageElement | null {
    const cacheKey = this.getCacheKey(icon, size);
    const cached = this.imageCache.get(cacheKey);
    if (cached?.loaded) return cached.image;
    this.preloadIcon(icon, size);
    return null;
  }

  drawIcon(
    ctx: CanvasRenderingContext2D,
    icon: EventIcon,
    x: number,
    y: number,
    size: number = CHART_CONFIG.EVENT_ICON_SIZE,
  ): boolean {
    if (icon.type === 'emoji') {
      ctx.font = `${size}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(icon.value, x, y);
      return true;
    }

    if (icon.type === 'icon') {
      ctx.font = `${size}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(icon.value, x, y);
      return true;
    }

    const img = this.getIcon(icon);
    if (!img) return false;

    const aspectRatio = img.width / img.height;
    const drawWidth = size * aspectRatio;
    const drawHeight = size;

    ctx.drawImage(img, x - drawWidth / 2, y - drawHeight / 2, drawWidth, drawHeight);
    return true;
  }

  async preloadIcons(icons: EventIcon[]): Promise<void> {
    const uniqueIcons = icons.filter(
      (icon, index, self) =>
        icon.type === 'flag' || icon.type === 'image'
          ? self.findIndex((i) => i.type === icon.type && i.value === icon.value) === index
          : false,
    );

    await Promise.all(uniqueIcons.map((icon) => this.preloadIcon(icon)));
  }

  clearCache(): void {
    this.imageCache.clear();
    this.loadingPromises.clear();
  }

  getCacheStats(): { total: number; loaded: number; errors: number } {
    let loaded = 0;
    let errors = 0;
    for (const entry of this.imageCache.values()) {
      if (entry.loaded) loaded++;
      if (entry.error) errors++;
    }
    return { total: this.imageCache.size, loaded, errors };
  }
}

let iconManagerInstance: EventIconManager | null = null;

export const getEventIconManager = (): EventIconManager => {
  if (!iconManagerInstance) {
    iconManagerInstance = new EventIconManager();
  }
  return iconManagerInstance;
};

export const resetEventIconManager = (): void => {
  iconManagerInstance?.clearCache();
  iconManagerInstance = null;
};
