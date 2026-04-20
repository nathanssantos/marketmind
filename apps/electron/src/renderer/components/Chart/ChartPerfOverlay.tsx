import type { ReactElement } from 'react';
import { useSyncExternalStore } from 'react';
import { perfMonitor, type PerfSnapshot } from '@renderer/utils/canvas/perfMonitor';

const emptySnapshot: PerfSnapshot = {
  enabled: false,
  fps: 0,
  lastFrameMs: 0,
  sections: [],
  componentRenders: [],
};

const subscribe = (cb: () => void): (() => void) => perfMonitor.subscribe(cb);
const getSnapshot = (): PerfSnapshot => perfMonitor.getSnapshot();

const fmtMs = (n: number): string => (n >= 10 ? n.toFixed(0) : n.toFixed(2));

export const ChartPerfOverlay = (): ReactElement | null => {
  const snap = useSyncExternalStore(subscribe, getSnapshot, () => emptySnapshot);
  if (!snap.enabled) return null;

  const fpsColor = snap.fps >= 55 ? '#4ade80' : snap.fps >= 30 ? '#facc15' : '#f87171';
  const frameColor = snap.lastFrameMs <= 16.7 ? '#4ade80' : snap.lastFrameMs <= 33 ? '#facc15' : '#f87171';

  return (
    <div
      style={{
        position: 'absolute',
        top: 8,
        right: 8,
        padding: '8px 10px',
        background: 'rgba(0,0,0,0.78)',
        color: '#e5e7eb',
        fontFamily: 'ui-monospace, Menlo, monospace',
        fontSize: 11,
        lineHeight: 1.35,
        borderRadius: 6,
        zIndex: 1000,
        minWidth: 220,
        pointerEvents: 'none',
        border: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ color: '#9ca3af' }}>chart.perf</span>
        <span style={{ color: fpsColor, fontWeight: 600 }}>{snap.fps} fps</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ color: '#9ca3af' }}>last frame</span>
        <span style={{ color: frameColor }}>{fmtMs(snap.lastFrameMs)} ms</span>
      </div>
      {snap.sections.length > 0 && (
        <>
          <div style={{ color: '#9ca3af', marginTop: 6, marginBottom: 2 }}>sections (ms)</div>
          {snap.sections.slice(0, 8).map((s) => (
            <div key={s.name} style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>{s.name}</span>
              <span>
                {fmtMs(s.lastMs)} <span style={{ color: '#6b7280' }}>/ {fmtMs(s.avgMs)}</span>
              </span>
            </div>
          ))}
        </>
      )}
      {snap.componentRenders.length > 0 && (
        <>
          <div style={{ color: '#9ca3af', marginTop: 6, marginBottom: 2 }}>renders/s</div>
          {snap.componentRenders.slice(0, 5).map((c) => (
            <div key={c.name} style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>{c.name}</span>
              <span>
                {c.ratePerSec.toFixed(1)} <span style={{ color: '#6b7280' }}>({c.total})</span>
              </span>
            </div>
          ))}
        </>
      )}
    </div>
  );
};
