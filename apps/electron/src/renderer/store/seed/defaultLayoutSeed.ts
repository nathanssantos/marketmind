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

export interface SeedPatternBinding {
  /** Stable pattern catalog id (e.g. 'hammer'). Resolved to user-pattern id at activation. */
  patternId: string;
  /** Grid-panel id this binding applies to. */
  panelId: string;
}

export interface DefaultLayoutSeed {
  symbolTabs: SymbolTab[];
  activeSymbolTabId: string;
  activeLayoutId: string;
  layoutPresets: LayoutPreset[];
  indicatorBindings: SeedIndicatorBinding[];
  /**
   * Per-panel candle-pattern bindings. Each new chart panel gets the
   * default pattern set (Hammer / Shooting Star / Engulfings / Doji)
   * enabled on first run; users add or remove from the popover.
   */
  patternBindings: SeedPatternBinding[];
}

// Pattern bindings are populated at activation time by
// `useAutoActivateDefaultPatterns` (DEFAULT_ENABLED_PATTERN_IDS × every
// chart panel of every layout). The seed file just declares the empty
// array so the type contract is satisfied without regenerating the JSON
// snapshot when DEFAULT_ENABLED_PATTERN_IDS changes.
export const DEFAULT_LAYOUT_SEED: DefaultLayoutSeed = {
  patternBindings: [],
  "symbolTabs": [
    {
      "id": "default",
      "symbol": "BTCUSDT",
      "marketType": "FUTURES",
      "activeLayoutId": "1777760167701-96ty68",
      "order": 0
    },
    {
      "id": "1777561512460-teuxun",
      "symbol": "ETHUSDT",
      "marketType": "FUTURES",
      "activeLayoutId": "1777750823737-thmk81",
      "order": 1
    },
    {
      "id": "1777561519815-0hz85e",
      "symbol": "SOLUSDT",
      "marketType": "FUTURES",
      "activeLayoutId": "1777760167701-96ty68",
      "order": 2
    },
    {
      "id": "1777561525547-26m3kz",
      "symbol": "XRPUSDT",
      "marketType": "FUTURES",
      "activeLayoutId": "1777750823737-thmk81",
      "order": 3
    },
    {
      "id": "1777561530180-o3n94x",
      "symbol": "ADAUSDT",
      "marketType": "FUTURES",
      "activeLayoutId": "1777750823737-thmk81",
      "order": 4
    },
    {
      "id": "1777561540597-zjd3r9",
      "symbol": "POLITIFI",
      "marketType": "SPOT",
      "activeLayoutId": "1777750823737-thmk81",
      "order": 5
    }
  ],
  "activeSymbolTabId": "default",
  "activeLayoutId": "1777750823737-thmk81",
  "layoutPresets": [
    {
      "id": "1777750823737-thmk81",
      "name": "1m / 5m / 15min",
      "grid": [
        {
          "id": "1777750823737-r6v1vf",
          "kind": "chart",
          "timeframe": "1m",
          "chartType": "kline",
          "gridPosition": {
            "x": 0,
            "y": 0,
            "w": 117,
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
          "id": "1777750823737-c5t09z",
          "kind": "ticket",
          "gridPosition": {
            "x": 159,
            "y": 35,
            "w": 33,
            "h": 19
          },
          "windowState": "normal"
        },
        {
          "id": "1777750823737-nuzi1m",
          "kind": "checklist",
          "gridPosition": {
            "x": 159,
            "y": 54,
            "w": 33,
            "h": 28
          },
          "windowState": "normal"
        },
        {
          "id": "1777750823737-lru0eo",
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
          "id": "1777750823737-nr5xnu",
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
          "id": "1777750916192-1hj1fv",
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
          "id": "1777758910073-qbl12r",
          "kind": "chart",
          "timeframe": "5m",
          "chartType": "kline",
          "gridPosition": {
            "x": 117,
            "y": 0,
            "w": 42,
            "h": 42
          },
          "windowState": "normal"
        },
        {
          "id": "1777758914094-pl4dt9",
          "kind": "chart",
          "timeframe": "15m",
          "chartType": "kline",
          "gridPosition": {
            "x": 117,
            "y": 42,
            "w": 42,
            "h": 40
          },
          "windowState": "normal"
        }
      ],
      "order": 1
    },
    {
      "id": "1777760165454-n4vvlx",
      "name": "5m / 15m / 1h",
      "grid": [
        {
          "id": "1777760165454-qh0a2a",
          "kind": "chart",
          "timeframe": "5m",
          "chartType": "kline",
          "gridPosition": {
            "x": 0,
            "y": 0,
            "w": 117,
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
          "id": "1777760165454-ol3ygj",
          "kind": "ticket",
          "gridPosition": {
            "x": 159,
            "y": 35,
            "w": 33,
            "h": 19
          },
          "windowState": "normal"
        },
        {
          "id": "1777760165454-vav2ol",
          "kind": "checklist",
          "gridPosition": {
            "x": 159,
            "y": 54,
            "w": 33,
            "h": 28
          },
          "windowState": "normal"
        },
        {
          "id": "1777760165454-g5zocu",
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
          "id": "1777760165454-yhleqy",
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
          "id": "1777760165454-7teuhm",
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
          "id": "1777760165454-ano6ud",
          "kind": "chart",
          "timeframe": "15m",
          "chartType": "kline",
          "gridPosition": {
            "x": 117,
            "y": 0,
            "w": 42,
            "h": 42
          },
          "windowState": "normal"
        },
        {
          "id": "1777760165454-hdm0we",
          "kind": "chart",
          "timeframe": "1h",
          "chartType": "kline",
          "gridPosition": {
            "x": 117,
            "y": 42,
            "w": 42,
            "h": 40
          },
          "windowState": "normal"
        }
      ],
      "order": 1
    },
    {
      "id": "1777760167701-96ty68",
      "name": "15m / 1h / 4h",
      "grid": [
        {
          "id": "1777760167701-9kdao9",
          "kind": "chart",
          "timeframe": "15m",
          "chartType": "kline",
          "gridPosition": {
            "x": 0,
            "y": 0,
            "w": 117,
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
          "id": "1777760167701-h1a2rf",
          "kind": "ticket",
          "gridPosition": {
            "x": 159,
            "y": 35,
            "w": 33,
            "h": 19
          },
          "windowState": "normal"
        },
        {
          "id": "1777760167701-hb0qfv",
          "kind": "checklist",
          "gridPosition": {
            "x": 159,
            "y": 54,
            "w": 33,
            "h": 28
          },
          "windowState": "normal"
        },
        {
          "id": "1777760167701-5qcfsw",
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
          "id": "1777760167701-luywbk",
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
          "id": "1777760167701-bxvreb",
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
          "id": "1777760167701-8t6iq2",
          "kind": "chart",
          "timeframe": "1h",
          "chartType": "kline",
          "gridPosition": {
            "x": 117,
            "y": 0,
            "w": 42,
            "h": 42
          },
          "windowState": "normal"
        },
        {
          "id": "1777760167701-uv6vgx",
          "kind": "chart",
          "timeframe": "4h",
          "chartType": "kline",
          "gridPosition": {
            "x": 117,
            "y": 42,
            "w": 42,
            "h": 40
          },
          "windowState": "normal"
        }
      ],
      "order": 2
    },
    {
      "id": "1777760221340-xrq2zz",
      "name": "1h / 4h / 1d",
      "grid": [
        {
          "id": "1777760221340-jfuxhi",
          "kind": "chart",
          "timeframe": "1h",
          "chartType": "kline",
          "gridPosition": {
            "x": 0,
            "y": 0,
            "w": 117,
            "h": 82
          },
          "windowState": "normal"
        },
        {
          "id": "1777760221340-84m7ln",
          "kind": "ticket",
          "gridPosition": {
            "x": 159,
            "y": 35,
            "w": 33,
            "h": 19
          },
          "windowState": "normal"
        },
        {
          "id": "1777760221340-bgq39n",
          "kind": "checklist",
          "gridPosition": {
            "x": 159,
            "y": 54,
            "w": 33,
            "h": 28
          },
          "windowState": "normal"
        },
        {
          "id": "1777760221340-m0eoe0",
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
          "id": "1777760221340-0q7mor",
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
          "id": "1777760221340-fw8o1x",
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
          "id": "1777760221340-nqfpb2",
          "kind": "chart",
          "timeframe": "4h",
          "chartType": "kline",
          "gridPosition": {
            "x": 117,
            "y": 0,
            "w": 42,
            "h": 42
          },
          "windowState": "normal"
        },
        {
          "id": "1777760221340-1pp0ag",
          "kind": "chart",
          "timeframe": "1d",
          "chartType": "kline",
          "gridPosition": {
            "x": 117,
            "y": 42,
            "w": 42,
            "h": 40
          },
          "windowState": "normal"
        }
      ],
      "order": 3
    },
    {
      "id": "1777760238827-zb44fy",
      "name": "4h / 1d / 1w",
      "grid": [
        {
          "id": "1777760238827-fx9d21",
          "kind": "chart",
          "timeframe": "4h",
          "chartType": "kline",
          "gridPosition": {
            "x": 0,
            "y": 0,
            "w": 117,
            "h": 82
          },
          "windowState": "normal"
        },
        {
          "id": "1777760238827-d00fdw",
          "kind": "ticket",
          "gridPosition": {
            "x": 159,
            "y": 35,
            "w": 33,
            "h": 19
          },
          "windowState": "normal"
        },
        {
          "id": "1777760238827-g5tv6l",
          "kind": "checklist",
          "gridPosition": {
            "x": 159,
            "y": 54,
            "w": 33,
            "h": 28
          },
          "windowState": "normal"
        },
        {
          "id": "1777760238827-i0umph",
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
          "id": "1777760238827-u3kz59",
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
          "id": "1777760238827-rfssvu",
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
          "id": "1777760238827-jgzu1b",
          "kind": "chart",
          "timeframe": "1d",
          "chartType": "kline",
          "gridPosition": {
            "x": 117,
            "y": 0,
            "w": 42,
            "h": 42
          },
          "windowState": "normal"
        },
        {
          "id": "1777760238827-h6m59t",
          "kind": "chart",
          "timeframe": "1w",
          "chartType": "kline",
          "gridPosition": {
            "x": 117,
            "y": 42,
            "w": 42,
            "h": 40
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
      "id": "1777760258591-e4ozh3",
      "name": "1d / 1w / 1M",
      "grid": [
        {
          "id": "1777760258591-xdchtj",
          "kind": "chart",
          "timeframe": "1d",
          "chartType": "kline",
          "gridPosition": {
            "x": 0,
            "y": 0,
            "w": 117,
            "h": 82
          },
          "windowState": "normal"
        },
        {
          "id": "1777760258591-1rjl6a",
          "kind": "ticket",
          "gridPosition": {
            "x": 159,
            "y": 35,
            "w": 33,
            "h": 19
          },
          "windowState": "normal"
        },
        {
          "id": "1777760258591-fvl79s",
          "kind": "checklist",
          "gridPosition": {
            "x": 159,
            "y": 54,
            "w": 33,
            "h": 28
          },
          "windowState": "normal"
        },
        {
          "id": "1777760258591-jhsi9t",
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
          "id": "1777760258591-3475ec",
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
          "id": "1777760258591-vq8lkq",
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
          "id": "1777760258591-hqu3ij",
          "kind": "chart",
          "timeframe": "1w",
          "chartType": "kline",
          "gridPosition": {
            "x": 117,
            "y": 0,
            "w": 42,
            "h": 42
          },
          "windowState": "normal",
          "savedGridPosition": {
            "x": 110,
            "y": 0,
            "w": 49,
            "h": 44
          }
        },
        {
          "id": "1777760258591-908z3b",
          "kind": "chart",
          "timeframe": "1M",
          "chartType": "kline",
          "gridPosition": {
            "x": 117,
            "y": 42,
            "w": 42,
            "h": 40
          },
          "windowState": "normal"
        }
      ],
      "order": 5
    },
    {
      "id": "1777760602696-2vv7ns",
      "name": "Auto-Trading",
      "grid": [
        {
          "id": "1777760602696-5rassu",
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
          "id": "1777760602696-21xp0b",
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
          "id": "1777760602696-3jr29c",
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
          "id": "1777760602696-6ryyjs",
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
          "id": "1777760602696-ltqj8b",
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
          "id": "1777760602696-h904rw",
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
          "id": "1777760643589-zfb3iw",
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
      "id": "1777760676537-yvn4ij",
      "name": "Auto-Scalping",
      "grid": [
        {
          "id": "1777760676537-qbdxh1",
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
          "id": "1777760676537-e1feiv",
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
          "id": "1777760676537-m8zzeg",
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
          "id": "1777760676537-5si2qi",
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
          "id": "1777760691737-vmuj6c",
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
          "id": "1777760777970-mno2y7",
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
          "id": "1777760861460-omayzy",
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
      "id": "1777992346938-9a2fof",
      "name": "Market Indicators",
      "grid": [
        {
          "id": "1777994013239-drtiju",
          "kind": "marketFearGreed",
          "gridPosition": {
            "x": 0,
            "y": 0,
            "w": 64,
            "h": 41
          },
          "windowState": "normal"
        },
        {
          "id": "1777994060026-uiyde1",
          "kind": "marketBtcDominance",
          "gridPosition": {
            "x": 64,
            "y": 0,
            "w": 64,
            "h": 41
          },
          "windowState": "normal"
        },
        {
          "id": "1777994070337-j8trax",
          "kind": "marketMvrv",
          "gridPosition": {
            "x": 128,
            "y": 0,
            "w": 64,
            "h": 41
          },
          "windowState": "normal"
        },
        {
          "id": "1777994075260-63ob7a",
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
          "id": "1777994078035-8tctgp",
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
          "id": "1777994088543-85pddx",
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
          "id": "1777994326165-xrehzc",
          "kind": "marketIndicators",
          "gridPosition": {
            "x": 0,
            "y": 41,
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
      "label": "Stoch 14",
      "catalogType": "stoch",
      "params": {
        "period": 14,
        "smoothK": 3,
        "smoothD": 3,
        "color": "#2196f3",
        "lineWidth": 1
      },
      "panelId": "1777750823737-r6v1vf",
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
      "panelId": "1777750823737-r6v1vf",
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
      "panelId": "1777750823737-r6v1vf",
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
      "panelId": "1777750823737-r6v1vf",
      "visible": true
    },
    {
      "label": "Volume",
      "catalogType": "volume",
      "params": {
        "color": "#607d8b"
      },
      "panelId": "1777750823737-r6v1vf",
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
      "panelId": "1777758910073-qbl12r",
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
      "panelId": "1777758914094-pl4dt9",
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
      "panelId": "1777760167701-9kdao9",
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
      "panelId": "1777760167701-9kdao9",
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
      "panelId": "1777760167701-9kdao9",
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
      "panelId": "1777760167701-9kdao9",
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
      "panelId": "1777760167701-8t6iq2",
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
      "panelId": "1777760167701-uv6vgx",
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
      "panelId": "1777760221340-jfuxhi",
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
      "panelId": "1777760221340-jfuxhi",
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
      "panelId": "1777760221340-jfuxhi",
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
      "panelId": "1777760221340-jfuxhi",
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
      "panelId": "1777760221340-nqfpb2",
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
      "panelId": "1777760221340-1pp0ag",
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
      "panelId": "1777760165454-qh0a2a",
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
      "panelId": "1777760165454-qh0a2a",
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
      "panelId": "1777760165454-qh0a2a",
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
      "panelId": "1777760165454-qh0a2a",
      "visible": true
    },
    {
      "label": "ORB 15m",
      "catalogType": "orb",
      "params": {
        "orbPeriodMinutes": 15
      },
      "panelId": "1777760165454-qh0a2a",
      "visible": true
    },
    {
      "label": "Volume",
      "catalogType": "volume",
      "params": {
        "color": "#607d8b"
      },
      "panelId": "1777760165454-qh0a2a",
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
      "panelId": "1777760165454-ano6ud",
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
      "panelId": "1777760165454-hdm0we",
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
      "panelId": "1777760238827-fx9d21",
      "visible": true
    },
    {
      "label": "Volume",
      "catalogType": "volume",
      "params": {
        "color": "#607d8b"
      },
      "panelId": "1777760238827-fx9d21",
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
      "panelId": "1777760238827-fx9d21",
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
      "panelId": "1777760238827-fx9d21",
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
      "panelId": "1777760238827-fx9d21",
      "visible": true
    },
    {
      "label": "Volume",
      "catalogType": "volume",
      "params": {
        "color": "#607d8b"
      },
      "panelId": "1777760221340-jfuxhi",
      "visible": true
    },
    {
      "label": "Volume",
      "catalogType": "volume",
      "params": {
        "color": "#607d8b"
      },
      "panelId": "1777760167701-9kdao9",
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
      "panelId": "1777760258591-xdchtj",
      "visible": true
    },
    {
      "label": "Volume",
      "catalogType": "volume",
      "params": {
        "color": "#607d8b"
      },
      "panelId": "1777760258591-xdchtj",
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
      "panelId": "1777760258591-xdchtj",
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
      "panelId": "1777760258591-xdchtj",
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
      "panelId": "1777760258591-xdchtj",
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
      "panelId": "1777760258591-hqu3ij",
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
      "panelId": "1777760258591-908z3b",
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
      "panelId": "1777760238827-jgzu1b",
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
      "panelId": "1777760238827-h6m59t",
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
      "panelId": "1777760167701-8t6iq2",
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
      "panelId": "1777760167701-8t6iq2",
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
      "panelId": "1777760167701-8t6iq2",
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
      "panelId": "1777760165454-ano6ud",
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
      "panelId": "1777760165454-ano6ud",
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
      "panelId": "1777760165454-ano6ud",
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
      "panelId": "1777760165454-hdm0we",
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
      "panelId": "1777760165454-hdm0we",
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
      "panelId": "1777760165454-hdm0we",
      "visible": true
    },
    {
      "label": "ORB 15m",
      "catalogType": "orb",
      "params": {
        "orbPeriodMinutes": 15
      },
      "panelId": "1777750823737-r6v1vf",
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
      "panelId": "1777758910073-qbl12r",
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
      "panelId": "1777758910073-qbl12r",
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
      "panelId": "1777758910073-qbl12r",
      "visible": true
    },
    {
      "label": "ORB 15m",
      "catalogType": "orb",
      "params": {
        "orbPeriodMinutes": 15
      },
      "panelId": "1777758910073-qbl12r",
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
      "panelId": "1777758914094-pl4dt9",
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
      "panelId": "1777758914094-pl4dt9",
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
      "panelId": "1777758914094-pl4dt9",
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
      "panelId": "1777760167701-uv6vgx",
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
      "panelId": "1777760167701-uv6vgx",
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
      "panelId": "1777760167701-uv6vgx",
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
      "panelId": "1777760221340-1pp0ag",
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
      "panelId": "1777760221340-1pp0ag",
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
      "panelId": "1777760221340-1pp0ag",
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
      "panelId": "1777760221340-nqfpb2",
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
      "panelId": "1777760221340-nqfpb2",
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
      "panelId": "1777760221340-nqfpb2",
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
      "panelId": "1777760238827-jgzu1b",
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
      "panelId": "1777760238827-jgzu1b",
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
      "panelId": "1777760238827-jgzu1b",
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
      "panelId": "1777760238827-h6m59t",
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
      "panelId": "1777760238827-h6m59t",
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
      "panelId": "1777760238827-h6m59t",
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
      "panelId": "1777760258591-hqu3ij",
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
      "panelId": "1777760258591-hqu3ij",
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
      "panelId": "1777760258591-hqu3ij",
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
      "panelId": "1777760258591-908z3b",
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
      "panelId": "1777760258591-908z3b",
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
      "panelId": "1777760258591-908z3b",
      "visible": true
    }
  ]
};
