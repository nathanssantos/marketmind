import type { LayoutPreset, SymbolTab } from '@shared/types/layout';
import type { IndicatorParamValue } from '@marketmind/trading-core';

/**
 * Seed snapshot generated from a curated user setup. Replaces the
 * 3-preset starter (#423) with a 9-preset / 6-tab seed that ships
 * meaningful symbol coverage and pre-bound indicators per chart
 * panel — new users land in a working trading view instead of a
 * blank chart.
 *
 * IDs are stable strings (`seed-*`) so the backend's
 * `isDefaultLayoutData` guard can recognize the snapshot and the
 * indicator bindings can reference panels by ID across users.
 *
 * To regenerate: run scripts/dump-default-layout-seed.ts.
 */
export interface SeedIndicatorBinding {
  /** UserIndicator label — resolved to id at activation time. */
  label: string;
  catalogType: string;
  params: Record<string, IndicatorParamValue>;
  /** Grid-panel id this instance binds to (matches a panel id in `layoutPresets`). */
  panelId: string;
  visible: boolean;
}

export interface DefaultLayoutSeed {
  symbolTabs: SymbolTab[];
  activeSymbolTabId: string;
  activeLayoutId: string;
  layoutPresets: LayoutPreset[];
  indicatorBindings: SeedIndicatorBinding[];
}

export const DEFAULT_LAYOUT_SEED: DefaultLayoutSeed = {
  "symbolTabs": [
    {
      "id": "default",
      "symbol": "BTCUSDT",
      "marketType": "FUTURES",
      "order": 0
    },
    {
      "id": "seed-tab-ethusdt",
      "symbol": "ETHUSDT",
      "marketType": "FUTURES",
      "order": 1
    },
    {
      "id": "seed-tab-solusdt",
      "symbol": "SOLUSDT",
      "marketType": "FUTURES",
      "order": 2
    },
    {
      "id": "seed-tab-xrpusdt",
      "symbol": "XRPUSDT",
      "marketType": "FUTURES",
      "order": 3
    },
    {
      "id": "seed-tab-adausdt",
      "symbol": "ADAUSDT",
      "marketType": "FUTURES",
      "order": 4
    },
    {
      "id": "seed-tab-politifi",
      "symbol": "POLITIFI",
      "marketType": "SPOT",
      "order": 5
    }
  ],
  "activeSymbolTabId": "default",
  "activeLayoutId": "seed-1m-5m-15min",
  "layoutPresets": [
    {
      "id": "seed-1m-5m-15min",
      "name": "1m / 5m / 15min",
      "grid": [
        {
          "id": "seed-1m-5m-15min-p0",
          "kind": "chart",
          "timeframe": "1m",
          "chartType": "kline",
          "gridPosition": {
            "x": 0,
            "y": 0,
            "w": 111,
            "h": 82
          },
          "windowState": "normal",
          "savedGridPosition": {
            "x": 0,
            "y": 0,
            "w": 122,
            "h": 82
          }
        },
        {
          "id": "seed-1m-5m-15min-p1",
          "kind": "ticket",
          "gridPosition": {
            "x": 159,
            "y": 35,
            "w": 33,
            "h": 9
          },
          "windowState": "normal"
        },
        {
          "id": "seed-1m-5m-15min-p2",
          "kind": "checklist",
          "gridPosition": {
            "x": 159,
            "y": 44,
            "w": 33,
            "h": 38
          },
          "windowState": "normal"
        },
        {
          "id": "seed-1m-5m-15min-p3",
          "kind": "positions",
          "gridPosition": {
            "x": 0,
            "y": 82,
            "w": 96,
            "h": 32
          },
          "windowState": "normal"
        },
        {
          "id": "seed-1m-5m-15min-p4",
          "kind": "orders",
          "gridPosition": {
            "x": 96,
            "y": 82,
            "w": 96,
            "h": 32
          },
          "windowState": "normal"
        },
        {
          "id": "seed-1m-5m-15min-p5",
          "kind": "portfolio",
          "gridPosition": {
            "x": 159,
            "y": 0,
            "w": 33,
            "h": 35
          },
          "windowState": "normal"
        },
        {
          "id": "seed-1m-5m-15min-p6",
          "kind": "chart",
          "timeframe": "5m",
          "chartType": "kline",
          "gridPosition": {
            "x": 111,
            "y": 0,
            "w": 48,
            "h": 44
          },
          "windowState": "normal"
        },
        {
          "id": "seed-1m-5m-15min-p7",
          "kind": "chart",
          "timeframe": "15m",
          "chartType": "kline",
          "gridPosition": {
            "x": 111,
            "y": 44,
            "w": 48,
            "h": 38
          },
          "windowState": "normal"
        }
      ],
      "order": 0
    },
    {
      "id": "seed-5m-15m-1h",
      "name": "5m / 15m / 1h",
      "grid": [
        {
          "id": "seed-5m-15m-1h-p0",
          "kind": "chart",
          "timeframe": "5m",
          "chartType": "kline",
          "gridPosition": {
            "x": 0,
            "y": 0,
            "w": 111,
            "h": 82
          },
          "windowState": "normal",
          "savedGridPosition": {
            "x": 0,
            "y": 0,
            "w": 122,
            "h": 82
          }
        },
        {
          "id": "seed-5m-15m-1h-p1",
          "kind": "ticket",
          "gridPosition": {
            "x": 159,
            "y": 35,
            "w": 33,
            "h": 9
          },
          "windowState": "normal"
        },
        {
          "id": "seed-5m-15m-1h-p2",
          "kind": "checklist",
          "gridPosition": {
            "x": 159,
            "y": 44,
            "w": 33,
            "h": 38
          },
          "windowState": "normal"
        },
        {
          "id": "seed-5m-15m-1h-p3",
          "kind": "positions",
          "gridPosition": {
            "x": 0,
            "y": 82,
            "w": 96,
            "h": 32
          },
          "windowState": "normal"
        },
        {
          "id": "seed-5m-15m-1h-p4",
          "kind": "orders",
          "gridPosition": {
            "x": 96,
            "y": 82,
            "w": 96,
            "h": 32
          },
          "windowState": "normal"
        },
        {
          "id": "seed-5m-15m-1h-p5",
          "kind": "portfolio",
          "gridPosition": {
            "x": 159,
            "y": 0,
            "w": 33,
            "h": 35
          },
          "windowState": "normal"
        },
        {
          "id": "seed-5m-15m-1h-p6",
          "kind": "chart",
          "timeframe": "15m",
          "chartType": "kline",
          "gridPosition": {
            "x": 111,
            "y": 0,
            "w": 48,
            "h": 44
          },
          "windowState": "normal"
        },
        {
          "id": "seed-5m-15m-1h-p7",
          "kind": "chart",
          "timeframe": "1h",
          "chartType": "kline",
          "gridPosition": {
            "x": 111,
            "y": 44,
            "w": 48,
            "h": 38
          },
          "windowState": "normal"
        }
      ],
      "order": 1
    },
    {
      "id": "seed-15m-1h-4h",
      "name": "15m / 1h / 4h",
      "grid": [
        {
          "id": "seed-15m-1h-4h-p0",
          "kind": "chart",
          "timeframe": "15m",
          "chartType": "kline",
          "gridPosition": {
            "x": 0,
            "y": 0,
            "w": 111,
            "h": 82
          },
          "windowState": "normal",
          "savedGridPosition": {
            "x": 0,
            "y": 0,
            "w": 111,
            "h": 82
          }
        },
        {
          "id": "seed-15m-1h-4h-p1",
          "kind": "ticket",
          "gridPosition": {
            "x": 159,
            "y": 35,
            "w": 33,
            "h": 9
          },
          "windowState": "normal"
        },
        {
          "id": "seed-15m-1h-4h-p2",
          "kind": "checklist",
          "gridPosition": {
            "x": 159,
            "y": 44,
            "w": 33,
            "h": 38
          },
          "windowState": "normal"
        },
        {
          "id": "seed-15m-1h-4h-p3",
          "kind": "positions",
          "gridPosition": {
            "x": 0,
            "y": 82,
            "w": 96,
            "h": 32
          },
          "windowState": "normal"
        },
        {
          "id": "seed-15m-1h-4h-p4",
          "kind": "orders",
          "gridPosition": {
            "x": 96,
            "y": 82,
            "w": 96,
            "h": 32
          },
          "windowState": "normal"
        },
        {
          "id": "seed-15m-1h-4h-p5",
          "kind": "portfolio",
          "gridPosition": {
            "x": 159,
            "y": 0,
            "w": 33,
            "h": 35
          },
          "windowState": "normal"
        },
        {
          "id": "seed-15m-1h-4h-p6",
          "kind": "chart",
          "timeframe": "1h",
          "chartType": "kline",
          "gridPosition": {
            "x": 111,
            "y": 0,
            "w": 48,
            "h": 44
          },
          "windowState": "normal"
        },
        {
          "id": "seed-15m-1h-4h-p7",
          "kind": "chart",
          "timeframe": "4h",
          "chartType": "kline",
          "gridPosition": {
            "x": 111,
            "y": 44,
            "w": 48,
            "h": 38
          },
          "windowState": "normal"
        }
      ],
      "order": 2
    },
    {
      "id": "seed-1h-4h-1d",
      "name": "1h / 4h / 1d",
      "grid": [
        {
          "id": "seed-1h-4h-1d-p0",
          "kind": "chart",
          "timeframe": "1h",
          "chartType": "kline",
          "gridPosition": {
            "x": 0,
            "y": 0,
            "w": 111,
            "h": 82
          },
          "windowState": "normal"
        },
        {
          "id": "seed-1h-4h-1d-p1",
          "kind": "ticket",
          "gridPosition": {
            "x": 159,
            "y": 35,
            "w": 33,
            "h": 9
          },
          "windowState": "normal"
        },
        {
          "id": "seed-1h-4h-1d-p2",
          "kind": "checklist",
          "gridPosition": {
            "x": 159,
            "y": 44,
            "w": 33,
            "h": 38
          },
          "windowState": "normal"
        },
        {
          "id": "seed-1h-4h-1d-p3",
          "kind": "positions",
          "gridPosition": {
            "x": 0,
            "y": 82,
            "w": 96,
            "h": 32
          },
          "windowState": "normal"
        },
        {
          "id": "seed-1h-4h-1d-p4",
          "kind": "orders",
          "gridPosition": {
            "x": 96,
            "y": 82,
            "w": 96,
            "h": 32
          },
          "windowState": "normal"
        },
        {
          "id": "seed-1h-4h-1d-p5",
          "kind": "portfolio",
          "gridPosition": {
            "x": 159,
            "y": 0,
            "w": 33,
            "h": 35
          },
          "windowState": "normal"
        },
        {
          "id": "seed-1h-4h-1d-p6",
          "kind": "chart",
          "timeframe": "4h",
          "chartType": "kline",
          "gridPosition": {
            "x": 111,
            "y": 0,
            "w": 48,
            "h": 44
          },
          "windowState": "normal"
        },
        {
          "id": "seed-1h-4h-1d-p7",
          "kind": "chart",
          "timeframe": "1d",
          "chartType": "kline",
          "gridPosition": {
            "x": 111,
            "y": 44,
            "w": 48,
            "h": 38
          },
          "windowState": "normal"
        }
      ],
      "order": 3
    },
    {
      "id": "seed-4h-1d-1w",
      "name": "4h / 1d / 1w",
      "grid": [
        {
          "id": "seed-4h-1d-1w-p0",
          "kind": "chart",
          "timeframe": "4h",
          "chartType": "kline",
          "gridPosition": {
            "x": 0,
            "y": 0,
            "w": 110,
            "h": 82
          },
          "windowState": "normal"
        },
        {
          "id": "seed-4h-1d-1w-p1",
          "kind": "ticket",
          "gridPosition": {
            "x": 159,
            "y": 35,
            "w": 33,
            "h": 9
          },
          "windowState": "normal"
        },
        {
          "id": "seed-4h-1d-1w-p2",
          "kind": "checklist",
          "gridPosition": {
            "x": 159,
            "y": 44,
            "w": 33,
            "h": 38
          },
          "windowState": "normal"
        },
        {
          "id": "seed-4h-1d-1w-p3",
          "kind": "positions",
          "gridPosition": {
            "x": 0,
            "y": 82,
            "w": 96,
            "h": 32
          },
          "windowState": "normal"
        },
        {
          "id": "seed-4h-1d-1w-p4",
          "kind": "orders",
          "gridPosition": {
            "x": 96,
            "y": 82,
            "w": 96,
            "h": 32
          },
          "windowState": "normal"
        },
        {
          "id": "seed-4h-1d-1w-p5",
          "kind": "portfolio",
          "gridPosition": {
            "x": 159,
            "y": 0,
            "w": 33,
            "h": 35
          },
          "windowState": "normal"
        },
        {
          "id": "seed-4h-1d-1w-p6",
          "kind": "chart",
          "timeframe": "1d",
          "chartType": "kline",
          "gridPosition": {
            "x": 110,
            "y": 0,
            "w": 49,
            "h": 44
          },
          "windowState": "normal"
        },
        {
          "id": "seed-4h-1d-1w-p7",
          "kind": "chart",
          "timeframe": "1w",
          "chartType": "kline",
          "gridPosition": {
            "x": 110,
            "y": 44,
            "w": 49,
            "h": 38
          },
          "windowState": "normal",
          "savedGridPosition": {
            "x": 122,
            "y": 44,
            "w": 37,
            "h": 38
          }
        }
      ],
      "order": 4
    },
    {
      "id": "seed-1d-1w-1m",
      "name": "1d / 1w / 1M",
      "grid": [
        {
          "id": "seed-1d-1w-1m-p0",
          "kind": "chart",
          "timeframe": "1d",
          "chartType": "kline",
          "gridPosition": {
            "x": 0,
            "y": 0,
            "w": 110,
            "h": 82
          },
          "windowState": "normal"
        },
        {
          "id": "seed-1d-1w-1m-p1",
          "kind": "ticket",
          "gridPosition": {
            "x": 159,
            "y": 35,
            "w": 33,
            "h": 9
          },
          "windowState": "normal"
        },
        {
          "id": "seed-1d-1w-1m-p2",
          "kind": "checklist",
          "gridPosition": {
            "x": 159,
            "y": 44,
            "w": 33,
            "h": 38
          },
          "windowState": "normal"
        },
        {
          "id": "seed-1d-1w-1m-p3",
          "kind": "positions",
          "gridPosition": {
            "x": 0,
            "y": 82,
            "w": 96,
            "h": 32
          },
          "windowState": "normal"
        },
        {
          "id": "seed-1d-1w-1m-p4",
          "kind": "orders",
          "gridPosition": {
            "x": 96,
            "y": 82,
            "w": 96,
            "h": 32
          },
          "windowState": "normal"
        },
        {
          "id": "seed-1d-1w-1m-p5",
          "kind": "portfolio",
          "gridPosition": {
            "x": 159,
            "y": 0,
            "w": 33,
            "h": 35
          },
          "windowState": "normal"
        },
        {
          "id": "seed-1d-1w-1m-p6",
          "kind": "chart",
          "timeframe": "1w",
          "chartType": "kline",
          "gridPosition": {
            "x": 110,
            "y": 0,
            "w": 49,
            "h": 44
          },
          "windowState": "normal",
          "savedGridPosition": {
            "x": 122,
            "y": 0,
            "w": 37,
            "h": 44
          }
        },
        {
          "id": "seed-1d-1w-1m-p7",
          "kind": "chart",
          "timeframe": "1M",
          "chartType": "kline",
          "gridPosition": {
            "x": 110,
            "y": 44,
            "w": 49,
            "h": 38
          },
          "windowState": "normal"
        }
      ],
      "order": 5
    },
    {
      "id": "seed-auto-trading",
      "name": "Auto-Trading",
      "grid": [
        {
          "id": "seed-auto-trading-p0",
          "kind": "chart",
          "timeframe": "15m",
          "chartType": "kline",
          "gridPosition": {
            "x": 0,
            "y": 0,
            "w": 122,
            "h": 82
          },
          "windowState": "normal"
        },
        {
          "id": "seed-auto-trading-p1",
          "kind": "positions",
          "gridPosition": {
            "x": 0,
            "y": 82,
            "w": 96,
            "h": 32
          },
          "windowState": "normal"
        },
        {
          "id": "seed-auto-trading-p2",
          "kind": "orders",
          "gridPosition": {
            "x": 96,
            "y": 82,
            "w": 96,
            "h": 32
          },
          "windowState": "normal"
        },
        {
          "id": "seed-auto-trading-p3",
          "kind": "portfolio",
          "gridPosition": {
            "x": 159,
            "y": 0,
            "w": 33,
            "h": 35
          },
          "windowState": "normal"
        },
        {
          "id": "seed-auto-trading-p4",
          "kind": "chart",
          "timeframe": "1h",
          "chartType": "kline",
          "gridPosition": {
            "x": 122,
            "y": 0,
            "w": 37,
            "h": 44
          },
          "windowState": "normal"
        },
        {
          "id": "seed-auto-trading-p5",
          "kind": "chart",
          "timeframe": "4h",
          "chartType": "kline",
          "gridPosition": {
            "x": 122,
            "y": 44,
            "w": 37,
            "h": 38
          },
          "windowState": "normal"
        },
        {
          "id": "seed-auto-trading-p6",
          "kind": "watchers",
          "gridPosition": {
            "x": 159,
            "y": 35,
            "w": 33,
            "h": 47
          },
          "windowState": "normal"
        }
      ],
      "order": 6
    },
    {
      "id": "seed-auto-scalping",
      "name": "Auto-Scalping",
      "grid": [
        {
          "id": "seed-auto-scalping-p0",
          "kind": "chart",
          "timeframe": "1m",
          "chartType": "kline",
          "gridPosition": {
            "x": 0,
            "y": 0,
            "w": 133,
            "h": 81
          },
          "windowState": "normal"
        },
        {
          "id": "seed-auto-scalping-p1",
          "kind": "positions",
          "gridPosition": {
            "x": 0,
            "y": 81,
            "w": 96,
            "h": 32
          },
          "windowState": "normal"
        },
        {
          "id": "seed-auto-scalping-p2",
          "kind": "orders",
          "gridPosition": {
            "x": 96,
            "y": 81,
            "w": 96,
            "h": 32
          },
          "windowState": "normal"
        },
        {
          "id": "seed-auto-scalping-p3",
          "kind": "portfolio",
          "gridPosition": {
            "x": 159,
            "y": 0,
            "w": 33,
            "h": 35
          },
          "windowState": "normal"
        },
        {
          "id": "seed-auto-scalping-p4",
          "kind": "orderBook",
          "gridPosition": {
            "x": 133,
            "y": 0,
            "w": 26,
            "h": 81
          },
          "windowState": "normal"
        },
        {
          "id": "seed-auto-scalping-p5",
          "kind": "autoTradingSetup",
          "gridPosition": {
            "x": 159,
            "y": 51,
            "w": 33,
            "h": 30
          },
          "windowState": "normal"
        },
        {
          "id": "seed-auto-scalping-p6",
          "kind": "orderFlowMetrics",
          "gridPosition": {
            "x": 159,
            "y": 35,
            "w": 33,
            "h": 16
          },
          "windowState": "normal"
        }
      ],
      "order": 7
    },
    {
      "id": "seed-market-indicators",
      "name": "Market Indicators",
      "grid": [
        {
          "id": "seed-market-indicators-p0",
          "kind": "marketFearGreed",
          "gridPosition": {
            "x": 0,
            "y": 63,
            "w": 64,
            "h": 41
          },
          "windowState": "normal"
        },
        {
          "id": "seed-market-indicators-p1",
          "kind": "marketBtcDominance",
          "gridPosition": {
            "x": 64,
            "y": 63,
            "w": 64,
            "h": 41
          },
          "windowState": "normal"
        },
        {
          "id": "seed-market-indicators-p2",
          "kind": "marketMvrv",
          "gridPosition": {
            "x": 128,
            "y": 63,
            "w": 64,
            "h": 41
          },
          "windowState": "normal"
        },
        {
          "id": "seed-market-indicators-p3",
          "kind": "marketProductionCost",
          "gridPosition": {
            "x": 0,
            "y": 104,
            "w": 64,
            "h": 41
          },
          "windowState": "normal"
        },
        {
          "id": "seed-market-indicators-p4",
          "kind": "marketOpenInterest",
          "gridPosition": {
            "x": 64,
            "y": 104,
            "w": 64,
            "h": 41
          },
          "windowState": "normal"
        },
        {
          "id": "seed-market-indicators-p5",
          "kind": "marketLongShort",
          "gridPosition": {
            "x": 128,
            "y": 104,
            "w": 64,
            "h": 41
          },
          "windowState": "normal"
        },
        {
          "id": "seed-market-indicators-p6",
          "kind": "marketIndicators",
          "gridPosition": {
            "x": 0,
            "y": 0,
            "w": 192,
            "h": 63
          },
          "windowState": "normal"
        }
      ],
      "order": 8
    }
  ],
  "indicatorBindings": [
    {
      "label": "RSI 2",
      "catalogType": "rsi",
      "params": {
        "period": 2,
        "color": "#2196f3",
        "lineWidth": 1
      },
      "panelId": "seed-1m-5m-15min-p0",
      "visible": true
    },
    {
      "label": "Stoch 14",
      "catalogType": "stoch",
      "params": {
        "period": 14,
        "smoothK": 3,
        "smoothD": 3,
        "color": "#2196f3",
        "lineWidth": 1
      },
      "panelId": "seed-1m-5m-15min-p0",
      "visible": true
    },
    {
      "label": "EMA 9",
      "catalogType": "ema",
      "params": {
        "period": 9,
        "color": "#ff00ff",
        "lineWidth": 1
      },
      "panelId": "seed-1m-5m-15min-p0",
      "visible": true
    },
    {
      "label": "EMA 21",
      "catalogType": "ema",
      "params": {
        "period": 21,
        "color": "#00e676",
        "lineWidth": 1
      },
      "panelId": "seed-1m-5m-15min-p0",
      "visible": true
    },
    {
      "label": "EMA 200",
      "catalogType": "ema",
      "params": {
        "period": 200,
        "color": "#607d8b",
        "lineWidth": 3
      },
      "panelId": "seed-1m-5m-15min-p0",
      "visible": true
    },
    {
      "label": "Volume",
      "catalogType": "volume",
      "params": {
        "color": "#607d8b"
      },
      "panelId": "seed-1m-5m-15min-p0",
      "visible": true
    },
    {
      "label": "Stoch 14",
      "catalogType": "stoch",
      "params": {
        "period": 14,
        "smoothK": 3,
        "smoothD": 3,
        "color": "#2196f3",
        "lineWidth": 1
      },
      "panelId": "seed-1m-5m-15min-p6",
      "visible": true
    },
    {
      "label": "Stoch 14",
      "catalogType": "stoch",
      "params": {
        "period": 14,
        "smoothK": 3,
        "smoothD": 3,
        "color": "#2196f3",
        "lineWidth": 1
      },
      "panelId": "seed-1m-5m-15min-p7",
      "visible": true
    },
    {
      "label": "RSI 2",
      "catalogType": "rsi",
      "params": {
        "period": 2,
        "color": "#2196f3",
        "lineWidth": 1
      },
      "panelId": "seed-15m-1h-4h-p0",
      "visible": true
    },
    {
      "label": "Stoch 14",
      "catalogType": "stoch",
      "params": {
        "period": 14,
        "smoothK": 3,
        "smoothD": 3,
        "color": "#2196f3",
        "lineWidth": 1
      },
      "panelId": "seed-15m-1h-4h-p0",
      "visible": true
    },
    {
      "label": "EMA 9",
      "catalogType": "ema",
      "params": {
        "period": 9,
        "color": "#ff00ff",
        "lineWidth": 1
      },
      "panelId": "seed-15m-1h-4h-p0",
      "visible": true
    },
    {
      "label": "EMA 21",
      "catalogType": "ema",
      "params": {
        "period": 21,
        "color": "#00e676",
        "lineWidth": 1
      },
      "panelId": "seed-15m-1h-4h-p0",
      "visible": true
    },
    {
      "label": "EMA 200",
      "catalogType": "ema",
      "params": {
        "period": 200,
        "color": "#607d8b",
        "lineWidth": 3
      },
      "panelId": "seed-15m-1h-4h-p0",
      "visible": true
    },
    {
      "label": "Stoch 14",
      "catalogType": "stoch",
      "params": {
        "period": 14,
        "smoothK": 3,
        "smoothD": 3,
        "color": "#2196f3",
        "lineWidth": 1
      },
      "panelId": "seed-15m-1h-4h-p6",
      "visible": true
    },
    {
      "label": "Stoch 14",
      "catalogType": "stoch",
      "params": {
        "period": 14,
        "smoothK": 3,
        "smoothD": 3,
        "color": "#2196f3",
        "lineWidth": 1
      },
      "panelId": "seed-15m-1h-4h-p7",
      "visible": true
    },
    {
      "label": "Stoch 14",
      "catalogType": "stoch",
      "params": {
        "period": 14,
        "smoothK": 3,
        "smoothD": 3,
        "color": "#2196f3",
        "lineWidth": 1
      },
      "panelId": "seed-1h-4h-1d-p0",
      "visible": true
    },
    {
      "label": "RSI 2",
      "catalogType": "rsi",
      "params": {
        "period": 2,
        "color": "#2196f3",
        "lineWidth": 1
      },
      "panelId": "seed-1h-4h-1d-p0",
      "visible": true
    },
    {
      "label": "EMA 9",
      "catalogType": "ema",
      "params": {
        "period": 9,
        "color": "#ff00ff",
        "lineWidth": 1
      },
      "panelId": "seed-1h-4h-1d-p0",
      "visible": true
    },
    {
      "label": "EMA 21",
      "catalogType": "ema",
      "params": {
        "period": 21,
        "color": "#00e676",
        "lineWidth": 1
      },
      "panelId": "seed-1h-4h-1d-p0",
      "visible": true
    },
    {
      "label": "EMA 200",
      "catalogType": "ema",
      "params": {
        "period": 200,
        "color": "#607d8b",
        "lineWidth": 3
      },
      "panelId": "seed-1h-4h-1d-p0",
      "visible": true
    },
    {
      "label": "Stoch 14",
      "catalogType": "stoch",
      "params": {
        "period": 14,
        "smoothK": 3,
        "smoothD": 3,
        "color": "#2196f3",
        "lineWidth": 1
      },
      "panelId": "seed-1h-4h-1d-p6",
      "visible": true
    },
    {
      "label": "Stoch 14",
      "catalogType": "stoch",
      "params": {
        "period": 14,
        "smoothK": 3,
        "smoothD": 3,
        "color": "#2196f3",
        "lineWidth": 1
      },
      "panelId": "seed-1h-4h-1d-p7",
      "visible": true
    },
    {
      "label": "Stoch 14",
      "catalogType": "stoch",
      "params": {
        "period": 14,
        "smoothK": 3,
        "smoothD": 3,
        "color": "#2196f3",
        "lineWidth": 1
      },
      "panelId": "seed-5m-15m-1h-p0",
      "visible": true
    },
    {
      "label": "RSI 2",
      "catalogType": "rsi",
      "params": {
        "period": 2,
        "color": "#2196f3",
        "lineWidth": 1
      },
      "panelId": "seed-5m-15m-1h-p0",
      "visible": true
    },
    {
      "label": "EMA 9",
      "catalogType": "ema",
      "params": {
        "period": 9,
        "color": "#ff00ff",
        "lineWidth": 1
      },
      "panelId": "seed-5m-15m-1h-p0",
      "visible": true
    },
    {
      "label": "EMA 21",
      "catalogType": "ema",
      "params": {
        "period": 21,
        "color": "#00e676",
        "lineWidth": 1
      },
      "panelId": "seed-5m-15m-1h-p0",
      "visible": true
    },
    {
      "label": "EMA 200",
      "catalogType": "ema",
      "params": {
        "period": 200,
        "color": "#607d8b",
        "lineWidth": 3
      },
      "panelId": "seed-5m-15m-1h-p0",
      "visible": true
    },
    {
      "label": "ORB 15m",
      "catalogType": "orb",
      "params": {
        "orbPeriodMinutes": 15
      },
      "panelId": "seed-5m-15m-1h-p0",
      "visible": true
    },
    {
      "label": "Volume",
      "catalogType": "volume",
      "params": {
        "color": "#607d8b"
      },
      "panelId": "seed-5m-15m-1h-p0",
      "visible": true
    },
    {
      "label": "Stoch 14",
      "catalogType": "stoch",
      "params": {
        "period": 14,
        "smoothK": 3,
        "smoothD": 3,
        "color": "#2196f3",
        "lineWidth": 1
      },
      "panelId": "seed-5m-15m-1h-p6",
      "visible": true
    },
    {
      "label": "Stoch 14",
      "catalogType": "stoch",
      "params": {
        "period": 14,
        "smoothK": 3,
        "smoothD": 3,
        "color": "#2196f3",
        "lineWidth": 1
      },
      "panelId": "seed-5m-15m-1h-p7",
      "visible": true
    },
    {
      "label": "Stoch 14",
      "catalogType": "stoch",
      "params": {
        "period": 14,
        "smoothK": 3,
        "smoothD": 3,
        "color": "#2196f3",
        "lineWidth": 1
      },
      "panelId": "seed-4h-1d-1w-p0",
      "visible": true
    },
    {
      "label": "RSI 2",
      "catalogType": "rsi",
      "params": {
        "period": 2,
        "color": "#2196f3",
        "lineWidth": 1
      },
      "panelId": "seed-4h-1d-1w-p0",
      "visible": true
    },
    {
      "label": "Volume",
      "catalogType": "volume",
      "params": {
        "color": "#607d8b"
      },
      "panelId": "seed-4h-1d-1w-p0",
      "visible": true
    },
    {
      "label": "EMA 9",
      "catalogType": "ema",
      "params": {
        "period": 9,
        "color": "#ff00ff",
        "lineWidth": 1
      },
      "panelId": "seed-4h-1d-1w-p0",
      "visible": true
    },
    {
      "label": "EMA 21",
      "catalogType": "ema",
      "params": {
        "period": 21,
        "color": "#00e676",
        "lineWidth": 1
      },
      "panelId": "seed-4h-1d-1w-p0",
      "visible": true
    },
    {
      "label": "EMA 200",
      "catalogType": "ema",
      "params": {
        "period": 200,
        "color": "#607d8b",
        "lineWidth": 3
      },
      "panelId": "seed-4h-1d-1w-p0",
      "visible": true
    },
    {
      "label": "Volume",
      "catalogType": "volume",
      "params": {
        "color": "#607d8b"
      },
      "panelId": "seed-1h-4h-1d-p0",
      "visible": true
    },
    {
      "label": "Volume",
      "catalogType": "volume",
      "params": {
        "color": "#607d8b"
      },
      "panelId": "seed-15m-1h-4h-p0",
      "visible": true
    },
    {
      "label": "Stoch 14",
      "catalogType": "stoch",
      "params": {
        "period": 14,
        "smoothK": 3,
        "smoothD": 3,
        "color": "#2196f3",
        "lineWidth": 1
      },
      "panelId": "seed-1d-1w-1m-p0",
      "visible": true
    },
    {
      "label": "RSI 2",
      "catalogType": "rsi",
      "params": {
        "period": 2,
        "color": "#2196f3",
        "lineWidth": 1
      },
      "panelId": "seed-1d-1w-1m-p0",
      "visible": true
    },
    {
      "label": "Volume",
      "catalogType": "volume",
      "params": {
        "color": "#607d8b"
      },
      "panelId": "seed-1d-1w-1m-p0",
      "visible": true
    },
    {
      "label": "EMA 9",
      "catalogType": "ema",
      "params": {
        "period": 9,
        "color": "#ff00ff",
        "lineWidth": 1
      },
      "panelId": "seed-1d-1w-1m-p0",
      "visible": true
    },
    {
      "label": "EMA 21",
      "catalogType": "ema",
      "params": {
        "period": 21,
        "color": "#00e676",
        "lineWidth": 1
      },
      "panelId": "seed-1d-1w-1m-p0",
      "visible": true
    },
    {
      "label": "EMA 200",
      "catalogType": "ema",
      "params": {
        "period": 200,
        "color": "#607d8b",
        "lineWidth": 3
      },
      "panelId": "seed-1d-1w-1m-p0",
      "visible": true
    },
    {
      "label": "Stoch 14",
      "catalogType": "stoch",
      "params": {
        "period": 14,
        "smoothK": 3,
        "smoothD": 3,
        "color": "#2196f3",
        "lineWidth": 1
      },
      "panelId": "seed-1d-1w-1m-p6",
      "visible": true
    },
    {
      "label": "Stoch 14",
      "catalogType": "stoch",
      "params": {
        "period": 14,
        "smoothK": 3,
        "smoothD": 3,
        "color": "#2196f3",
        "lineWidth": 1
      },
      "panelId": "seed-1d-1w-1m-p7",
      "visible": true
    },
    {
      "label": "Stoch 14",
      "catalogType": "stoch",
      "params": {
        "period": 14,
        "smoothK": 3,
        "smoothD": 3,
        "color": "#2196f3",
        "lineWidth": 1
      },
      "panelId": "seed-4h-1d-1w-p6",
      "visible": true
    },
    {
      "label": "Stoch 14",
      "catalogType": "stoch",
      "params": {
        "period": 14,
        "smoothK": 3,
        "smoothD": 3,
        "color": "#2196f3",
        "lineWidth": 1
      },
      "panelId": "seed-4h-1d-1w-p7",
      "visible": true
    }
  ]
};
